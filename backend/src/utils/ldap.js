const ldap = require('ldapjs');
const pool = require('../config/db');

async function getLdapSettings() {
  const [[row]] = await pool.query(
    `SELECT ldap_enabled, ldap_host, ldap_port, ldap_base_dn,
            ldap_bind_dn, ldap_bind_password, ldap_user_filter,
            ldap_attr_name, ldap_attr_type, ldap_tls
     FROM ustawienia WHERE id = 1`
  );
  return row;
}

function buildClient(s) {
  const protocol = s.ldap_tls ? 'ldaps' : 'ldap';
  const url = `${protocol}://${s.ldap_host}:${s.ldap_port || 389}`;
  return ldap.createClient({
    url,
    tlsOptions: { rejectUnauthorized: false },
    timeout: 5000,
    connectTimeout: 5000,
  });
}

function bindAsync(client, dn, password) {
  return new Promise((resolve, reject) => {
    client.bind(dn || '', password || '', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function searchAsync(client, base, filter, attributes) {
  return new Promise((resolve, reject) => {
    client.search(base, { filter, attributes, scope: 'sub' }, (err, res) => {
      if (err) { reject(err); return; }
      const results = [];
      res.on('searchEntry', (entry) => {
        // ldapjs 3.x: entry.object jest undefined — atrybuty są w entry.pojo.attributes
        const dn = entry.pojo?.objectName || (entry.dn ? entry.dn.toString() : '');
        const obj = { _dn: dn };
        const attrs = entry.pojo?.attributes || entry.attributes || [];
        for (const attr of attrs) {
          const vals = attr.values || attr.vals || [];
          if (vals.length) obj[attr.type] = vals.length === 1 ? vals[0] : vals;
        }
        results.push(obj);
      });
      res.on('error', reject);
      res.on('end', () => resolve(results));
    });
  });
}

// Wyodrębnij sam adres email z "Name <email>" lub "email"
function extractEmail(addr) {
  if (!addr) return addr;
  const m = addr.match(/<([^>]+)>/);
  return m ? m[1].trim() : addr.trim();
}

// Parsuje wynik wpisu LDAP i zwraca { name, ou, num }
// DN studenta:    cn=61832 Agata Wrześniak,ou=studenci,dc=...
// DN wykładowcy:  cn=61066,ou=wykladowcy,dc=...
function parseEntry(obj) {
  const dn = obj._dn || '';

  // OU z DN → "studenci" lub "wykladowcy"
  const ouMatch = dn.match(/ou=([^,]+)/i);
  const ou = ouMatch ? ouMatch[1].toLowerCase() : null;

  // CN może być "61832 Agata Wrześniak" (student) albo "61066" (wykładowca)
  const rawCn = Array.isArray(obj.cn) ? obj.cn[0] : (obj.cn || '');
  const cnMatch = rawCn.match(/^(\d+)\s*(.*)$/);
  const num = cnMatch ? cnMatch[1] : null;
  const nameFromCn = cnMatch && cnMatch[2].trim() ? cnMatch[2].trim() : null;

  // Pełne imię: najpierw z CN, potem displayName, potem sn+givenName
  const name = nameFromCn
    || obj.displayName
    || [obj.givenName, obj.sn].filter(Boolean).join(' ')
    || rawCn
    || null;

  return { name: name || null, ou, num };
}

async function lookupEmail(email) {
  const s = await getLdapSettings();
  if (!s?.ldap_enabled || !s.ldap_host) return null;

  const cleanEmail = extractEmail(email);
  if (!cleanEmail) return null;

  const client = buildClient(s);

  return new Promise((resolve) => {
    client.on('error', () => { client.destroy(); resolve(null); });

    bindAsync(client, s.ldap_bind_dn, s.ldap_bind_password)
      .then(() => {
        const filter = (s.ldap_user_filter || '(mail={email})').replace('{email}', cleanEmail);
        // Pobierz wszystkie przydatne atrybuty
        const attrs = [
          'cn', 'uid', 'sn', 'givenName', 'displayName', 'mail',
          'telephoneNumber', 'mobile', 'l', 'description',
          'ou', 'department', 'title', 'employeeType', 'eduPersonAffiliation',
          'studid', 'osobaid', 'prow_id',
          s.ldap_attr_name || 'cn', s.ldap_attr_type || 'employeeType',
        ];
        return searchAsync(client, s.ldap_base_dn, filter, attrs);
      })
      .then((results) => {
        client.destroy();
        if (!results.length) { resolve(null); return; }
        const entry = results[0];
        const base = parseEntry(entry);

        // Zbierz wszystkie niepuste atrybuty (bez wewnętrznych _dn)
        const extra = {};
        const wantedAttrs = ['cn', 'uid', 'sn', 'givenName', 'displayName', 'mail',
          'telephoneNumber', 'mobile', 'l', 'description', 'ou',
          'department', 'title', 'employeeType', 'eduPersonAffiliation',
          'studid', 'osobaid', 'prow_id'];
        for (const attr of wantedAttrs) {
          const val = entry[attr];
          if (val !== undefined && val !== null && val !== '') {
            extra[attr] = Array.isArray(val) ? val[0] : val;
          }
        }

        resolve({ ...base, extra });
      })
      .catch(() => { client.destroy(); resolve(null); });
  });
}

async function testConnection() {
  const s = await getLdapSettings();
  if (!s?.ldap_host) throw new Error('Brak adresu serwera LDAP');

  const client = buildClient(s);

  return new Promise((resolve, reject) => {
    client.on('error', (err) => { client.destroy(); reject(err); });

    bindAsync(client, s.ldap_bind_dn, s.ldap_bind_password)
      .then(() => { client.destroy(); resolve(true); })
      .catch((err) => { client.destroy(); reject(err); });
  });
}

module.exports = { lookupEmail, testConnection };
