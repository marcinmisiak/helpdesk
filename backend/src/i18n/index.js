'use strict';

const pl = require('./pl');
const en = require('./en');
const uk = require('./uk');

const translations = { pl, en, uk };

function t(lang, key, vars = {}) {
  const dict = translations[lang] || translations['pl'];
  let str = dict[key];
  if (str === undefined) str = translations['pl'][key];
  if (str === undefined) return key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v ?? '');
  }
  return str;
}

async function getUserLang(pool, userId) {
  if (!userId) return null;
  try {
    const [[row]] = await pool.query('SELECT language FROM user WHERE id = ?', [userId]);
    return row?.language || null;
  } catch { return null; }
}

async function getAppLang(pool) {
  try {
    const [[row]] = await pool.query('SELECT app_language FROM ustawienia WHERE id = 1');
    return row?.app_language || 'pl';
  } catch { return 'pl'; }
}

async function resolveLang(pool, userId) {
  const userLang = await getUserLang(pool, userId);
  if (userLang) return userLang;
  return getAppLang(pool);
}

module.exports = { t, getUserLang, getAppLang, resolveLang };
