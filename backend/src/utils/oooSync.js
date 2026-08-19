const pool = require('../config/db');
const msGraph = require('./msGraphClient');

let timer = null;

async function getSettings() {
  const [[row]] = await pool.query('SELECT * FROM ustawienia WHERE id = 1');
  return row;
}

// Prefer: outlook.timezone="UTC" na wywołaniu Graph gwarantuje, że dateTime jest już w UTC
// (bez offsetu w stringu) — wystarczy dopisać "Z" i sparsować jako ISO.
function parseGraphDateTimeUtc(dt) {
  if (!dt?.dateTime) return null;
  const iso = dt.dateTime.endsWith('Z') ? dt.dateTime : `${dt.dateTime}Z`;
  const ts = Date.parse(iso);
  return Number.isNaN(ts) ? null : Math.floor(ts / 1000);
}

function stripHtml(html) {
  if (!html) return null;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 255) : null;
}

async function syncUser(settings, user) {
  try {
    const reply = await msGraph.getAutomaticReplies(settings, user.email);
    // Tylko 'scheduled' ma wypełniony zakres dat — 'alwaysEnabled' (bezterminowe OOF) nie mapuje
    // się na nasz model od-do, więc jest traktowane tak samo jak 'disabled'.
    const scheduled = reply?.status === 'scheduled';
    const od = scheduled ? parseGraphDateTimeUtc(reply.scheduledStartDateTime) : null;
    const doTs = scheduled ? parseGraphDateTimeUtc(reply.scheduledEndDateTime) : null;

    if (od && doTs) {
      // Nigdy nie nadpisuje wiersza ustawionego ręcznie (poza_biurem_zrodlo='reczne') —
      // ręczna edycja w UI ma pierwszeństwo, dopóki użytkownik sam jej nie wyczyści.
      await pool.query(
        `UPDATE user SET poza_biurem_od=?, poza_biurem_do=?, poza_biurem_powod=?, poza_biurem_zrodlo='microsoft'
         WHERE id=? AND (poza_biurem_zrodlo IS NULL OR poza_biurem_zrodlo='microsoft')`,
        [od, doTs, stripHtml(reply.internalReplyMessage), user.id]
      );
    } else {
      // Nic zaplanowanego w Microsoft — wyczyść tylko to, co sam sync tu wcześniej wpisał.
      await pool.query(
        `UPDATE user SET poza_biurem_od=NULL, poza_biurem_do=NULL, poza_biurem_powod=NULL, poza_biurem_zrodlo=NULL
         WHERE id=? AND poza_biurem_zrodlo='microsoft'`,
        [user.id]
      );
    }
  } catch (e) {
    // Typowe i nie-błędne: pracownik bez skrzynki Exchange w tym tenancie (404/403) —
    // pomiń go i idź dalej, nie przerywaj synchronizacji reszty.
    console.warn(`[ooo-sync] ${user.email}:`, e.message);
  }
}

async function runSync() {
  try {
    const settings = await getSettings();
    if (!settings?.ms_graph_enabled || !settings?.ms_graph_sync_ooo) return;

    const [users] = await pool.query(
      "SELECT id, email FROM user WHERE status = 10 AND email IS NOT NULL AND email != ''"
    );
    for (const user of users) {
      await syncUser(settings, user);
    }
    console.log(`[ooo-sync] Zsynchronizowano nieobecności dla ${users.length} użytkowników`);
  } catch (e) {
    console.warn('[ooo-sync]', e.message);
  }
}

function start(intervalMs = 30 * 60 * 1000) {
  if (timer) return;
  runSync();
  timer = setInterval(runSync, intervalMs);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { start, stop, runSync };
