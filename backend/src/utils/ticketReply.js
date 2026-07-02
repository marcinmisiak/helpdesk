const pool = require('../config/db');
const mailer = require('./mailer');
const { notifyUsers } = require('./webpush');
const { maybeSendCsatSurvey } = require('./csat');
const messengerClient = require('./messengerClient');
const { getSiteUrl } = require('./siteUrl');
const { logTicketEvent } = require('./ticketLog');

const uploadDir = process.env.UPLOAD_DIR || '/var/www/html/pomoc/pliki';

function notFound() {
  return Object.assign(new Error('Ticket nie znaleziony'), { status: 404 });
}

// Wspólna logika wysyłki odpowiedzi na ticket — używana przez POST /:id/odpowiedz
// (pracownik) oraz przez webhook n8n (automatyzacja).
async function sendTicketReply(ticketId, {
  to,
  cc = '',
  tresc,
  html,
  files = [],
  close = false,
  closeNotify = false,
  actorUserId = null,
  actorEmail = null,
  actorLabel = 'Automatyzacja',
  actorAvatarPath = null,
  typ,
}) {
  const now = Math.floor(Date.now() / 1000);

  const [[ticket]] = await pool.query('SELECT * FROM ticket WHERE id=?', [ticketId]);
  if (!ticket) throw notFound();

  const oldStatus = ticket.status;
  const resolvedTyp = typ || (ticket.zrodlo === 'live_chat' ? 'chat' : (ticket.zrodlo === 'messenger' ? 'messenger' : 'reply'));

  const [kResult] = await pool.query(
    `INSERT INTO korespondencja (ticket_id, data, created_by, updated_by, created_at, updated_at, tresc, html, message_to, message_cc, message_subject, message_from, typ, przeczytane)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [ticketId, now, actorUserId, actorUserId, now, now, tresc, html,
     to, cc || '', ticket.message_subject, actorEmail, resolvedTyp]
  );

  logTicketEvent(ticketId, { typ: 'replied', userId: actorUserId, actorLabel, meta: { to } });

  if (actorUserId) {
    const [existing] = await pool.query(
      'SELECT id FROM user_has_ticket WHERE ticket_id=? AND user_id=?',
      [ticketId, actorUserId]
    );
    if (!existing.length) {
      await pool.query(
        'INSERT INTO user_has_ticket (ticket_id, user_id, data, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [ticketId, actorUserId, now, actorUserId, actorUserId, now, now]
      );
    }
  }

  // zawsze ustaw status=2 przy odpowiedzi (chyba że zamknięcie)
  if (!close && oldStatus !== 3) {
    await pool.query('UPDATE ticket SET status=2 WHERE id=?', [ticketId]);
  }

  try {
    await pool.query('UPDATE ticket SET first_response_at = COALESCE(first_response_at, ?) WHERE id = ?', [now, ticketId]);
  } catch {
    // Kolumna first_response_at może nie istnieć przed migracją schematu.
  }

  if (close) {
    await pool.query('UPDATE ticket SET status=3, data_zamkniecia=?, odlozony=0 WHERE id=?', [now, ticketId]);
    maybeSendCsatSurvey(ticketId).catch(() => {});
    logTicketEvent(ticketId, { typ: 'closed', userId: actorUserId, actorLabel, meta: { viaReply: true } });
  }

  const newStatus = close ? 3 : (oldStatus !== 3 ? 2 : 3);
  const statusChanged = oldStatus !== newStatus;

  // Zapisz załączniki do DB
  const savedFiles = [];
  for (const file of files) {
    const filepath = file.path.replace(uploadDir + '/', '');
    const [fResult] = await pool.query(
      'INSERT INTO plik (tabela, ticket_id, filepath, originalname) VALUES (?, ?, ?, ?)',
      [2, kResult.insertId, filepath, file.originalname]
    );
    savedFiles.push({ id: fResult.insertId, filepath: file.path, originalname: file.originalname, mimetype: file.mimetype });
  }

  // wyślij email — pomijamy dla ticketów z czatu (odwiedzający nie ma adresu e-mail,
  // odpowiedź trafia do niego przez polling widgetu, treść już zapisana w korespondencja)
  let mailError = null;
  if (ticket.zrodlo === 'messenger') {
    try {
      const withinWindow = ticket.messenger_last_user_message_at
        && (now - ticket.messenger_last_user_message_at < 24 * 3600);
      const sentId = await messengerClient.sendMessage(ticket.messenger_psid, tresc, withinWindow);
      if (sentId) await pool.query('UPDATE korespondencja SET message_id = ? WHERE id = ?', [sentId, kResult.insertId]);
    } catch (msgErr) {
      mailError = msgErr.message;
      await pool.query('UPDATE korespondencja SET mail_error = ? WHERE id = ?', [msgErr.message, kResult.insertId]).catch(() => {});
    }
  } else if (ticket.zrodlo !== 'live_chat' && await mailer.isSystemSenderEmail(ticket.message_from)) {
    console.log(`[Mail] Pomijam wysyłkę do adresu systemowego: ${ticket.message_from}`);
  } else if (ticket.zrodlo !== 'live_chat') {
    try {
      const rawSubject = ticket.message_subject || '(brak tematu)';
      const numerTag = `[#${ticket.numer}]`;
      let subject = rawSubject.startsWith('Re:') ? rawSubject : `Re: ${rawSubject}`;
      if (!subject.includes(numerTag)) subject += ` ${numerTag}`;

      // Dołącz informację o zamknięciu do treści emaila (tylko jeśli closeNotify=true)
      const includeCloseNote = close && closeNotify;
      const closingNote = includeCloseNote
        ? `<div style="margin-top:20px;padding:12px 16px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;font-size:13px;color:#166534">
             <strong>Zgłoszenie zostało zamknięte.</strong> Uznajemy sprawę za rozwiązaną. Jeżeli problem powróci lub pojawią się nowe pytania, prosimy o ponowny kontakt — chętnie pomożemy.
           </div>`
        : '';
      const emailHtml = html ? `${html}${closingNote}` : null;
      const emailTresc = includeCloseNote
        ? `${tresc}\n\n---\nZgłoszenie zostało zamknięte. Jeżeli problem powróci, prosimy o kontakt.`
        : tresc;

      const emailAttachments = savedFiles.map(f => ({
        filename: f.originalname,
        path: f.filepath,
        contentType: f.mimetype,
      }));

      // Pokazujemy zgłaszającemu kto konkretnie odpisał (zdjęcie + imię/nazwisko) — tylko dla
      // prawdziwego pracownika (actorUserId), nie dla automatyzacji (n8n, brak konta/zdjęcia).
      const staffName = actorUserId ? actorLabel : null;
      const staffAvatarUrl = actorUserId && actorAvatarPath
        ? `${(await getSiteUrl())}/pliki/${actorAvatarPath}`
        : null;

      console.log(`[Mail] Wysyłam odpowiedź na ticket #${ticket.numer} do: ${to}, temat: ${subject}, załączników: ${emailAttachments.length}`);
      const sentMsgId = await mailer.sendReply({ to, cc, subject, html: emailHtml, tresc: emailTresc, attachments: emailAttachments, staffName, staffAvatarUrl });
      console.log(`[Mail] Wysłano pomyślnie do ${to}`);
      if (sentMsgId) {
        await pool.query('UPDATE korespondencja SET message_id = ? WHERE id = ?', [sentMsgId, kResult.insertId]);
      }
    } catch (mailErr) {
      mailError = mailErr.message;
      console.error(`[Mail] BŁĄD wysyłki do ${to}:`, mailErr.message);
      // Zapisz błąd trwale przy wiadomości — widoczny w wątku korespondencji
      await pool.query('UPDATE korespondencja SET mail_error = ? WHERE id = ?', [mailErr.message, kResult.insertId]).catch(() => {});
    }
  }

  // push do przypisanych (z wyłączeniem autora odpowiedzi, jeśli to pracownik)
  const [przypisani] = actorUserId
    ? await pool.query('SELECT user_id FROM user_has_ticket WHERE ticket_id = ? AND user_id != ?', [ticketId, actorUserId])
    : await pool.query('SELECT user_id FROM user_has_ticket WHERE ticket_id = ?', [ticketId]);
  const idsDoNotify = przypisani.map((r) => r.user_id);
  notifyUsers(idsDoNotify, {
    title: `Nowa odpowiedź: ${ticket.message_subject}`,
    body: `Odpowiedź od: ${actorLabel}`,
    url: `/tickets/${ticketId}`,
  }).catch(() => {});

  return { ticket, korespondencja_id: kResult.insertId, mailError, statusChanged, newStatus };
}

module.exports = { sendTicketReply };
