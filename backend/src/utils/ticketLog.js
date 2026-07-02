const pool = require('../config/db');

// Zapisuje jedno zdarzenie w dzienniku ticketu (kto/co/kiedy) — patrz CLAUDE.md
// "Dziennik zdarzeń ticketu". Nigdy nie rzuca: log nie może zepsuć głównej akcji
// na tickecie, dlatego wywołania nie potrzebują .catch() w miejscu użycia.
async function logTicketEvent(ticketId, { typ, userId = null, actorLabel = null, meta = null }) {
  try {
    const [[row]] = await pool.query('SELECT ticket_log_enabled FROM ustawienia WHERE id = 1');
    if (row && row.ticket_log_enabled === 0) return;
    await pool.query(
      'INSERT INTO ticket_log (ticket_id, typ, user_id, actor_label, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [ticketId, typ, userId, actorLabel, meta ? JSON.stringify(meta) : null, Math.floor(Date.now() / 1000)]
    );
  } catch (err) {
    console.warn('[ticketLog] Nie zapisano zdarzenia:', err.message);
  }
}

module.exports = { logTicketEvent };
