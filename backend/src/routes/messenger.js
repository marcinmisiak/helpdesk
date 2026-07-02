const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../config/db');
const { notifyUsers, notifyAllAdmins } = require('../utils/webpush');
const { normalizePriority, computeDeadlines } = require('../utils/sla');
const { classifyAndSave } = require('../utils/groqClassifier');
const messengerClient = require('../utils/messengerClient');
const { sendWebhookEvent } = require('../utils/webhookClient');
const { logTicketEvent } = require('../utils/ticketLog');

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function verifySignature(req, appSecret) {
  const sig = req.get('X-Hub-Signature-256') || '';
  if (!sig.startsWith('sha256=') || !req.rawBody) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
  const provided = sig.slice(7);
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

// GET /api/messenger/webhook — weryfikacja webhooka w panelu Meta for Developers
router.get('/webhook', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  try {
    const [[s]] = await pool.query('SELECT messenger_verify_token FROM ustawienia WHERE id = 1');
    if (mode === 'subscribe' && token && s?.messenger_verify_token && token === s.messenger_verify_token) {
      return res.status(200).send(challenge);
    }
    res.sendStatus(403);
  } catch {
    res.sendStatus(403);
  }
});

async function handleIncomingMessage(settings, evt) {
  const psid = evt.sender.id;
  const text = (evt.message.text || '').trim();
  const attachmentLinks = (evt.message.attachments || []).map((a) => a.payload?.url).filter(Boolean);
  const fullText = [text, ...attachmentLinks].filter(Boolean).join('\n') || '(brak treści)';
  const now = Math.floor(Date.now() / 1000);

  const [[existing]] = await pool.query(
    'SELECT id, numer, message_subject, message_from, status FROM ticket WHERE messenger_psid = ? ORDER BY id DESC LIMIT 1',
    [psid]
  );

  if (existing) {
    const wasClosed = existing.status === 3;
    if (wasClosed) {
      await pool.query('UPDATE ticket SET status=2, data_zamkniecia=NULL WHERE id=?', [existing.id]);
    }
    await pool.query('UPDATE ticket SET messenger_last_user_message_at=? WHERE id=?', [now, existing.id]);
    await pool.query(
      `INSERT INTO korespondencja
         (ticket_id, data, created_by, updated_by, created_at, updated_at, tresc, html, message_to, message_cc, message_from, typ, przeczytane)
       VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, '', '', 'Messenger', 'messenger', 0)`,
      [existing.id, now, now, now, fullText, `<p style="white-space:pre-wrap">${escapeHtml(fullText)}</p>`]
    );

    sendWebhookEvent('ticket.message.received', {
      ticket: { id: existing.id, numer: existing.numer, subject: existing.message_subject, from: existing.message_from, status: existing.status, zrodlo: 'messenger' },
      message: { tresc: fullText, html: null, from: 'Messenger' },
    }).catch(() => {});

    if (wasClosed) {
      const [recipients] = await pool.query(
        `SELECT user_id FROM user_has_ticket WHERE ticket_id = ?
         UNION
         SELECT zu.user_id FROM zespol_has_ticket zht JOIN zespol_user zu ON zu.zespol_id = zht.zespol_id WHERE zht.ticket_id = ?`,
        [existing.id, existing.id]
      );
      notifyUsers(recipients.map((r) => r.user_id), {
        title: '📘 Rozmowa Messenger została ponownie otwarta',
        body: fullText.slice(0, 120),
        url: `/czaty/${existing.id}`,
      }).catch(() => {});
    }
    return;
  }

  let displayName = 'Messenger user';
  const profile = await messengerClient.getUserProfile(psid, settings.messenger_page_access_token);
  if (profile?.first_name) displayName = `${profile.first_name} ${profile.last_name || ''}`.trim();

  const numer = Math.random().toString().slice(2, 8);
  const priority = 2;
  const deadlines = computeDeadlines(now, normalizePriority(priority));

  const [result] = await pool.query(
    `INSERT INTO ticket
       (numer, message_from, message_subject, tresc, status, data_utworzenia, odlozony, podswietl,
        zrodlo, messenger_psid, messenger_last_user_message_at, priority, sla_response_deadline, sla_resolution_deadline)
     VALUES (?, ?, 'Wiadomość z Messengera', ?, 2, ?, 0, 1, 'messenger', ?, ?, ?, ?, ?)`,
    [numer, displayName, fullText, now, psid, now, priority, deadlines.responseDeadline, deadlines.resolutionDeadline]
  );
  const ticketId = result.insertId;

  logTicketEvent(ticketId, { typ: 'created', meta: { source: 'messenger' }, actorLabel: 'Messenger' });

  if (settings.messenger_zespol_id) {
    await pool.query('INSERT INTO zespol_has_ticket (zespol_id, ticket_id, created_at) VALUES (?, ?, ?)', [settings.messenger_zespol_id, ticketId, now]);
    const [members] = await pool.query('SELECT user_id FROM zespol_user WHERE zespol_id = ?', [settings.messenger_zespol_id]);
    notifyUsers(members.map((m) => m.user_id), {
      title: '📘 Nowa wiadomość z Messengera',
      body: fullText.slice(0, 120),
      url: `/czaty/${ticketId}`,
    }).catch(() => {});
  } else {
    notifyAllAdmins({
      title: '📘 Nowa wiadomość z Messengera',
      body: fullText.slice(0, 120),
      url: `/czaty/${ticketId}`,
    }).catch(() => {});
  }

  classifyAndSave(ticketId, {
    subject: 'Wiadomość z Messengera',
    body: fullText,
    from: displayName,
  }).catch(() => {});

  sendWebhookEvent('ticket.created', {
    ticket: { id: ticketId, numer, subject: 'Wiadomość z Messengera', from: displayName, priority, status: 2, zrodlo: 'messenger' },
    message: { tresc: fullText, html: null, from: displayName },
  }).catch(() => {});
}

// POST /api/messenger/webhook — odbiór zdarzeń z Messenger Platform
router.post('/webhook', async (req, res) => {
  let settings;
  try {
    const [[s]] = await pool.query('SELECT * FROM ustawienia WHERE id = 1');
    settings = s;
  } catch {
    return res.sendStatus(500);
  }

  if (!settings?.messenger_enabled || !settings.messenger_app_secret) return res.sendStatus(403);
  if (!verifySignature(req, settings.messenger_app_secret)) return res.sendStatus(403);

  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== 'page') return;
    for (const entry of body.entry || []) {
      for (const evt of entry.messaging || []) {
        if (!evt.message || evt.message.is_echo) continue;
        await handleIncomingMessage(settings, evt);
      }
    }
  } catch (err) {
    console.error('[messenger] Błąd przetwarzania webhooka:', err.message);
  }
});

module.exports = router;
