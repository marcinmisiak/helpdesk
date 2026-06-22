const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate, requireWorker } = require('../middleware/auth');

(async () => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS user_presence (
      user_id INT PRIMARY KEY,
      last_seen_at INT NOT NULL
    )`);
  } catch (e) {
    console.warn('[presence] init:', e.message);
  }
})();

router.use(authenticate, requireWorker);

// GET /api/alerts - powiadomienia (nowa korespondencja dla moich ticketów)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, t.message_subject, t.numer
       FROM alert a
       JOIN ticket t ON t.id = a.ticket_id
       WHERE a.user_id = ?
       ORDER BY a.id DESC LIMIT 20`,
      [req.user.id]
    );
    res.json({ data: rows });
  } catch {
    // tabela alert może nie istnieć - zwróć pustą listę
    res.json({ data: [] });
  }
});

// DELETE /api/alerts/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM alert WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alerts/count
router.get('/count', async (req, res) => {
  try {
    try {
      await pool.query(
        `INSERT INTO user_presence (user_id, last_seen_at) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE last_seen_at = VALUES(last_seen_at)`,
        [req.user.id, Math.floor(Date.now() / 1000)]
      );
    } catch {}

    const [[nowe]] = await pool.query('SELECT COUNT(*) as cnt FROM ticket WHERE status = 1 AND (odlozony = 0 OR odlozony IS NULL)');
    const [[wtoku]] = await pool.query('SELECT COUNT(*) as cnt FROM ticket WHERE status = 2 AND (odlozony = 0 OR odlozony IS NULL)');
    const [[moje]] = await pool.query(
      `SELECT COUNT(DISTINCT t.id) as cnt FROM ticket t
       WHERE t.status = 2 AND (t.odlozony = 0 OR t.odlozony IS NULL)
         AND (EXISTS (SELECT 1 FROM user_has_ticket uht WHERE uht.ticket_id = t.id AND uht.user_id = ?)
              OR EXISTS (SELECT 1 FROM zespol_has_ticket zht JOIN zespol_user zu ON zu.zespol_id = zht.zespol_id WHERE zht.ticket_id = t.id AND zu.user_id = ?))`,
      [req.user.id, req.user.id]
    );
    const [[czaty]] = await pool.query(
      `SELECT COUNT(DISTINCT t.id) as cnt FROM ticket t
       WHERE t.zrodlo = 'live_chat' AND t.status != 3
         AND (EXISTS (SELECT 1 FROM user_has_ticket uht WHERE uht.ticket_id = t.id AND uht.user_id = ?)
              OR EXISTS (SELECT 1 FROM zespol_has_ticket zht JOIN zespol_user zu ON zu.zespol_id = zht.zespol_id WHERE zht.ticket_id = t.id AND zu.user_id = ?))`,
      [req.user.id, req.user.id]
    );
    const [[odloz]] = await pool.query('SELECT COUNT(*) as cnt FROM ticket WHERE odlozony = 1');
    const [[mojeOdloz]] = await pool.query(
      `SELECT COUNT(DISTINCT t.id) as cnt FROM ticket t
       WHERE t.odlozony = 1
         AND (EXISTS (SELECT 1 FROM user_has_ticket uht WHERE uht.ticket_id = t.id AND uht.user_id = ?)
              OR EXISTS (SELECT 1 FROM zespol_has_ticket zht JOIN zespol_user zu ON zu.zespol_id = zht.zespol_id WHERE zht.ticket_id = t.id AND zu.user_id = ?))`,
      [req.user.id, req.user.id]
    );

    let alertCount = 0;
    try {
      const [[ac]] = await pool.query('SELECT COUNT(*) as cnt FROM alert WHERE user_id = ?', [req.user.id]);
      alertCount = ac.cnt;
    } catch {}

    let spamCount = 0;
    if (req.user.rola === 'admin') {
      try {
        const [[sc]] = await pool.query("SELECT COUNT(*) as cnt FROM ticket WHERE ai_tag = 'spam'");
        spamCount = sc.cnt;
      } catch {}
    }

    const [[newest]] = await pool.query('SELECT MAX(data_utworzenia) as ts FROM ticket');

    // Ostatnia odpowiedź na ticketach przypisanych do mnie (nie moja własna + nie od praconików = od klienta/autora)
    let lastReplyAt = 0, lastReplyTicketId = null;
    try {
      const [[lr]] = await pool.query(
        `SELECT k.data, k.ticket_id
         FROM korespondencja k
         JOIN user_has_ticket uht ON uht.ticket_id = k.ticket_id
         WHERE uht.user_id = ? AND (k.created_by IS NULL OR k.created_by != ?)
         ORDER BY k.data DESC LIMIT 1`,
        [req.user.id, req.user.id]
      );
      if (lr) { lastReplyAt = lr.data || 0; lastReplyTicketId = lr.ticket_id; }
    } catch {}

    // Ostatnie przypisanie ticketu do mnie
    let lastAssignedAt = 0, lastAssignedTicketId = null;
    try {
      const [[la]] = await pool.query(
        `SELECT created_at, ticket_id FROM user_has_ticket WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
        [req.user.id]
      );
      if (la) { lastAssignedAt = la.created_at || 0; lastAssignedTicketId = la.ticket_id; }
    } catch {}

    let onlineUsers = [];
    try {
      const now = Math.floor(Date.now() / 1000);
      const [onlineRows] = await pool.query(
        `SELECT u.id, u.imie, u.nazwisko FROM user u
         JOIN user_presence up ON up.user_id = u.id
         WHERE up.last_seen_at > ?`,
        [now - 3 * 60]
      );
      onlineUsers = onlineRows;
    } catch {}

    res.json({
      nowe: nowe.cnt, wtoku: wtoku.cnt, moje: moje.cnt, czaty: czaty.cnt, odlozone: odloz.cnt, mojeOdlozone: mojeOdloz.cnt,
      alerts: alertCount, spam: spamCount,
      last_ticket_at: newest.ts || 0,
      last_reply_at: lastReplyAt,
      last_reply_ticket_id: lastReplyTicketId,
      last_assigned_at: lastAssignedAt,
      last_assigned_ticket_id: lastAssignedTicketId,
      online_users: onlineUsers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/leave - oznacz siebie jako offline (wylogowanie / zamknięcie strony)
router.post('/leave', async (req, res) => {
  try {
    await pool.query('DELETE FROM user_presence WHERE user_id = ?', [req.user.id]);
  } catch {}
  res.json({ success: true });
});

module.exports = router;
