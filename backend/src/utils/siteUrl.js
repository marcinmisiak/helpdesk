const pool = require('../config/db');

// Zwraca adres strony — najpierw z ustawień DB, potem z .env, na końcu fallback
async function getSiteUrl() {
  try {
    const [[row]] = await pool.query('SELECT site_url FROM ustawienia WHERE id = 1');
    const url = row?.site_url?.trim();
    if (url) return url.replace(/\/$/, '');
  } catch {}
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

module.exports = { getSiteUrl };
