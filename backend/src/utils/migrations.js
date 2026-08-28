const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../db/migrations');
const SCHEMA_FILE = path.resolve(__dirname, '../../../db/schema.sql');

// Wykonuje statementy z pliku .sql na jednym połączeniu (spójna sesja — ważne dla
// SET FOREIGN_KEY_CHECKS w schema.sql), tolerując błędy "już istnieje" (idempotentne).
async function runSqlFile(conn, filePath, label) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const statements = sql
    .split(/;\s*(\n|$)/)
    .map(s => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    try {
      await conn.query(stmt);
    } catch (err) {
      if ([1050, 1060, 1061].includes(err.errno)) {
        console.log(`[migrations] ${label}: pominięto (już istnieje): ${err.message}`);
      } else {
        throw err;
      }
    }
  }
}

async function runMigrations() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS migration (
        version VARCHAR(180) NOT NULL,
        apply_time INT,
        PRIMARY KEY (version)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Bazowy schemat (CREATE TABLE IF NOT EXISTS) wykonywany zawsze przy starcie —
    // niezależnie od tego, czy /docker-entrypoint-initdb.d MariaDB w ogóle zdążył/mógł
    // zainicjalizować bazę (np. wdrożenia "docker pull" bez lokalnego repo nie mają
    // db/schema.sql na hoście do zamontowania w kontener bazy).
    if (fs.existsSync(SCHEMA_FILE)) {
      await runSqlFile(conn, SCHEMA_FILE, 'schema.sql');
    } else {
      console.warn('[migrations] Brak pliku schema.sql — pomijam inicjalizację bazowego schematu');
    }

    if (!fs.existsSync(MIGRATIONS_DIR)) return;

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (!files.length) return;

    const [applied] = await conn.query('SELECT version FROM migration');
    const appliedSet = new Set(applied.map(r => r.version));

    for (const file of files) {
      if (appliedSet.has(file)) continue;

      console.log(`[migrations] Applying: ${file}`);
      await runSqlFile(conn, path.join(MIGRATIONS_DIR, file), file);
      await conn.query(
        'INSERT INTO migration (version, apply_time) VALUES (?, ?)',
        [file, Math.floor(Date.now() / 1000)]
      );
      console.log(`[migrations] Applied: ${file}`);
    }
  } finally {
    conn.release();
  }
}

module.exports = runMigrations;
