const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate, requireWorker } = require('../middleware/auth');
const { sendNotification, getAppName } = require('../utils/mailer');
const { t: tr, resolveLang } = require('../i18n/index');
const { getSiteUrl } = require('../utils/siteUrl');

router.use(authenticate, requireWorker);

// GET /api/notatki?ticket_id=X
router.get('/', async (req, res) => {
  try {
    const { ticket_id } = req.query;
    const [rows] = await pool.query(
      'SELECT * FROM notatka WHERE ticket_id = ? ORDER BY data ASC',
      [ticket_id]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notatki
router.post('/', async (req, res) => {
  try {
    const { ticket_id, tresc } = req.body;
    const now = Math.floor(Date.now() / 1000);
    const [result] = await pool.query(
      'INSERT INTO notatka (ticket_id, data, tresc) VALUES (?, ?, ?)',
      [ticket_id, now, tresc]
    );
    res.status(201).json({ id: result.insertId });

    // Powiadom przypisanych pracowników (poza autorem notatki) o nowej notatce wewnętrznej
    try {
      const [[ticket]] = await pool.query('SELECT numer FROM ticket WHERE id = ?', [ticket_id]);
      const [przypisani] = await pool.query(
        `SELECT u.id, u.email, u.imie FROM user u
         INNER JOIN user_has_ticket uht ON uht.user_id = u.id
         WHERE uht.ticket_id = ? AND u.id != ? AND u.email IS NOT NULL AND u.email != ''`,
        [ticket_id, req.user.id]
      );
      if (ticket && przypisani.length) {
        const baseUrl = await getSiteUrl();
        const appName = await getAppName();
        const authorName = [req.user.imie, req.user.nazwisko].filter(Boolean).join(' ') || req.user.email;
        const noteContent = (tresc || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        for (const p of przypisani) {
          const lang = await resolveLang(pool, p.id);
          const greeting = p.imie ? tr(lang, 'greeting_day_with_name', { name: p.imie }) : tr(lang, 'greeting_formal');
          sendNotification({
            to: p.email,
            subject: tr(lang, 'subject_internal_note', { appName, numer: ticket.numer }),
            greeting,
            lang,
            html: `
              <p>${tr(lang, 'internal_note_intro', { author: authorName, numer: ticket.numer })}</p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 16px;margin:12px 0;font-size:14px;white-space:pre-wrap;color:#374151">${noteContent}</div>
              <p style="margin-top:16px">
                <a href="${baseUrl}/tickets/${ticket_id}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">
                  ${tr(lang, 'btn_view_ticket')}
                </a>
              </p>`,
          }).catch(e => console.warn('[Notatka] Email nie wysłany:', e.message));
        }
      }
    } catch (e) {
      console.warn('[Notatka] Błąd powiadomienia email:', e.message);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notatki/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM notatka WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
