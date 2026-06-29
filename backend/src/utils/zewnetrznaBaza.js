const mysql = require('mysql2/promise');
const pool = require('../config/db');

// Tylko alfanumeryczne + podkreślnik, bez cyfry na początku — chroni przed wstrzyknięciem
// SQL przez nazwę tabeli/kolumny skonfigurowaną przez admina (mysql2/node-firebird nie
// parametryzują identyfikatorów, tylko wartości).
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

function assertSafeIdentifier(name, what) {
  if (!IDENT_RE.test(name || '')) {
    throw new Error(`Niedozwolona nazwa ${what}: ${name}`);
  }
}

// Wyodrębnij sam adres email z "Name <email>" lub "email" (jak w utils/ldap.js,
// zduplikowane lokalnie żeby nie sprzęgać dwóch niezależnych integracji).
function extractEmail(addr) {
  if (!addr) return addr;
  const m = addr.match(/<([^>]+)>/);
  return m ? m[1].trim() : addr.trim();
}

async function getActiveSources() {
  const [rows] = await pool.query('SELECT * FROM zewnetrzna_baza WHERE aktywna = 1 ORDER BY nazwa');
  return rows.map(parseSource);
}

function parseSource(row) {
  let mapowanie = [];
  try { mapowanie = row.mapowanie_pol ? JSON.parse(row.mapowanie_pol) : []; } catch {}
  return { ...row, mapowanie };
}

function safeErrorMessage(err) {
  const code = err?.code || err?.errno;
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'EHOSTUNREACH') {
    return 'Nie udało się połączyć z serwerem bazy danych';
  }
  if (code === 'ER_ACCESS_DENIED_ERROR' || /password|login|authent/i.test(err?.message || '')) {
    return 'Błąd autoryzacji (login/hasło)';
  }
  if (/no such table|doesn't exist|unknown table|table.*not.*exist/i.test(err?.message || '')) {
    return 'Tabela nie istnieje lub brak dostępu';
  }
  return 'Błąd połączenia z bazą zewnętrzną';
}

function buildSelect(source) {
  const columns = source.mapowanie.map((m) => m.column);
  return columns.length ? columns.map((c) => `\`${c}\``).join(', ') : '*';
}

async function lookupMysql(source, email) {
  const selectCols = buildSelect(source);
  const conn = await mysql.createConnection({
    host: source.host,
    port: source.port || 3306,
    user: source.login,
    password: source.haslo,
    database: source.baza,
    connectTimeout: 5000,
  });
  try {
    const [rows] = await conn.query(
      `SELECT ${selectCols} FROM \`${source.tabela}\` WHERE \`${source.kolumna_email}\` = ? LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  } finally {
    await conn.end().catch(() => {});
  }
}

function firebirdQuery(options, sql, params) {
  const Firebird = require('node-firebird');
  return new Promise((resolve, reject) => {
    Firebird.attach(options, (err, db) => {
      if (err) { reject(err); return; }
      db.query(sql, params, (qerr, rows) => {
        db.detach();
        if (qerr) reject(qerr);
        else resolve(rows);
      });
    });
  });
}

async function lookupFirebird(source, email) {
  const selectCols = buildSelect(source);
  const options = {
    host: source.host,
    port: source.port || 3050,
    database: source.baza,
    user: source.login,
    password: source.haslo,
    connectTimeout: 5000,
    lowercase_keys: true, // Firebird domyślnie zwraca nazwy kolumn wielkimi literami
  };
  const sql = `SELECT ${selectCols} FROM "${source.tabela}" WHERE "${source.kolumna_email}" = ? ROWS 1`;
  const rows = await firebirdQuery(options, sql, [email]);
  return rows[0] || null;
}

function mapResultRow(row, mapowanie) {
  if (!row) return null;
  if (!mapowanie.length) {
    // Brak skonfigurowanego mapowania — pokaż surowe kolumny, żeby funkcja była użyteczna
    // nawet przy niedokończonej konfiguracji (analogon ldap_data "extra" bez ldap_labels).
    const fields = {};
    for (const [k, v] of Object.entries(row)) {
      if (v !== undefined && v !== null && v !== '') fields[k] = v;
    }
    return fields;
  }
  const fields = {};
  for (const { column, label } of mapowanie) {
    const val = row[column];
    if (val !== undefined && val !== null && val !== '') fields[label || column] = val;
  }
  return fields;
}

function validateSourceIdentifiers(source) {
  assertSafeIdentifier(source.tabela, 'tabeli');
  assertSafeIdentifier(source.kolumna_email, 'kolumny email');
  for (const m of source.mapowanie || []) assertSafeIdentifier(m.column, 'kolumny mapowania');
}

async function lookupEmailInSource(source, email) {
  try {
    validateSourceIdentifiers(source);
    const cleanEmail = extractEmail(email);
    if (!cleanEmail) return { status: 'not_found' };

    const row = source.silnik === 'firebird'
      ? await lookupFirebird(source, cleanEmail)
      : await lookupMysql(source, cleanEmail);

    if (!row) return { status: 'not_found' };
    return { status: 'found', fields: mapResultRow(row, source.mapowanie || []) };
  } catch (err) {
    return { status: 'error', error: safeErrorMessage(err) };
  }
}

async function testConnection(source) {
  assertSafeIdentifier(source.tabela, 'tabeli');
  if (source.silnik === 'firebird') {
    const options = {
      host: source.host,
      port: source.port || 3050,
      database: source.baza,
      user: source.login,
      password: source.haslo,
      connectTimeout: 5000,
      lowercase_keys: true,
    };
    try {
      await firebirdQuery(options, `SELECT 1 AS OK FROM "${source.tabela}" ROWS 1`, []);
    } catch (err) {
      throw new Error(`Połączono, ale zapytanie testowe nie powiodło się: ${safeErrorMessage(err)}`);
    }
    return true;
  }

  const conn = await mysql.createConnection({
    host: source.host,
    port: source.port || 3306,
    user: source.login,
    password: source.haslo,
    database: source.baza,
    connectTimeout: 5000,
  });
  try {
    await conn.query(`SELECT 1 FROM \`${source.tabela}\` LIMIT 1`);
  } catch (err) {
    throw new Error(`Połączono, ale tabela "${source.tabela}" nie istnieje lub brak dostępu`);
  } finally {
    await conn.end().catch(() => {});
  }
  return true;
}

module.exports = {
  getActiveSources,
  parseSource,
  lookupEmailInSource,
  testConnection,
  assertSafeIdentifier,
};
