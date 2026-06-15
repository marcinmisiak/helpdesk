const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../db/migrations');

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migration (
      version VARCHAR(180) NOT NULL,
      apply_time INT,
      PRIMARY KEY (version)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  if (!fs.existsSync(MIGRATIONS_DIR)) return;

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (!files.length) return;

  const [applied] = await pool.query('SELECT version FROM migration');
  const appliedSet = new Set(applied.map(r => r.version));

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const statements = sql
      .split(/;\s*(\n|$)/)
      .map(s => s.trim())
      .filter(Boolean);

    console.log(`[migrations] Applying: ${file}`);
    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err) {
        // 1060 = ER_DUP_FIELDNAME (column already exists — idempotent)
        // 1061 = ER_DUP_KEYNAME   (index already exists — idempotent)
        // 1050 = ER_TABLE_EXISTS_ERROR
        if ([1050, 1060, 1061].includes(err.errno)) {
          console.log(`[migrations] ${file}: skipped (already applied): ${err.message}`);
        } else {
          throw err;
        }
      }
    }
    await pool.query(
      'INSERT INTO migration (version, apply_time) VALUES (?, ?)',
      [file, Math.floor(Date.now() / 1000)]
    );
    console.log(`[migrations] Applied: ${file}`);
  }
}

module.exports = runMigrations;
