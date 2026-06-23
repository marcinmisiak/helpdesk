const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../config/db');
const { sendTicketReply } = require('../utils/ticketReply');

function secretMatches(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// POST /api/webhook/n8n/reply — n8n wstawia automatyczną odpowiedź na ticket.
// Publiczny endpoint (jak /api/messenger/webhook) — autoryzacja przez sekret z nagłówka,
// nie przez JWT, bo wywołującym jest zewnętrzny serwis, nie zalogowany użytkownik.
router.post('/reply', async (req, res) => {
  try {
    const [[settings]] = await pool.query(
      'SELECT webhook_enabled, webhook_secret FROM ustawienia WHERE id = 1'
    );
    if (!settings?.webhook_enabled) return res.status(403).json({ error: 'Webhook n8n jest wyłączony.' });
    if (!secretMatches(req.get('X-Webhook-Secret'), settings.webhook_secret)) {
      return res.status(403).json({ error: 'Nieprawidłowy sekret webhooka.' });
    }

    const { ticket_id, ticket_numer, to, tresc, html, close } = req.body;
    if (!ticket_id && !ticket_numer) return res.status(400).json({ error: 'Podaj ticket_id lub ticket_numer.' });
    if (!tresc?.trim()) return res.status(400).json({ error: 'Brak treści odpowiedzi.' });

    const [[ticket]] = ticket_id
      ? await pool.query('SELECT id, message_from FROM ticket WHERE id = ?', [ticket_id])
      : await pool.query('SELECT id, message_from FROM ticket WHERE numer = ?', [ticket_numer]);
    if (!ticket) return res.status(404).json({ error: 'Ticket nie znaleziony.' });

    const result = await sendTicketReply(ticket.id, {
      to: to || ticket.message_from,
      tresc,
      html: html || null,
      close: !!close,
      closeNotify: false,
      actorLabel: 'Automatyzacja (n8n)',
      typ: 'n8n',
    });

    res.json({ success: true, korespondencja_id: result.korespondencja_id, mailError: result.mailError });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
