const crypto = require('crypto');
const { sendNotification } = require('./mailer');

// Returns true if current Warsaw time is within "weekend hours":
// Friday >= weekendStartHour, Saturday (all day), Sunday (all day)
function isWeekend(weekendStartHour = 18) {
  const now = new Date();
  const warsaw = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
  const day = warsaw.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const hour = warsaw.getHours();

  if (day === 6 || day === 0) return true;
  if (day === 5 && hour >= weekendStartHour) return true;
  return false;
}

async function sendWeekendAutoReply(pool, ticketId, { email, numer, subject, ldap_name }) {
  let weekendStartHour = 18;
  try {
    const [[cfg]] = await pool.query('SELECT weekend_start_hour FROM ustawienia WHERE id = 1');
    if (cfg?.weekend_start_hour != null) weekendStartHour = Number(cfg.weekend_start_hour);
  } catch { /* użyj domyślnej */ }

  if (!isWeekend(weekendStartHour)) return;

  const [[ticket]] = await pool.query('SELECT autor_token FROM ticket WHERE id = ?', [ticketId]);
  let token = ticket?.autor_token;
  if (!token) {
    token = crypto.randomUUID();
    await pool.query('UPDATE ticket SET autor_token = ? WHERE id = ?', [token, ticketId]);
  }

  const frontendUrl = process.env.FRONTEND_URL || '';
  const link = `${frontendUrl}/status/${token}`;
  const now = Math.floor(Date.now() / 1000);

  const autoText = `Dziękujemy za zgłoszenie #${numer}.\n\nW soboty i niedziele oraz w piątki po godzinie ${weekendStartHour}:00 nasz helpdesk jest nieczynny. Twoje zgłoszenie zostanie rozpatrzone w najbliższy dzień roboczy.\n\nW międzyczasie możesz skorzystać z pomocy sztucznej inteligencji, która może pomóc rozwiązać Twój problem. Kliknij poniższy link i użyj przycisku „Zapytaj AI":\n\n${link}`;
  const autoHtml = `
    <p>Dziękujemy za zgłoszenie <strong>#${numer}</strong>.</p>
    <p>W soboty i niedziele oraz w piątki po godzinie ${weekendStartHour}:00 nasz helpdesk jest nieczynny.
       Twoje zgłoszenie zostanie rozpatrzone w najbliższy dzień roboczy.</p>
    <p>W międzyczasie możesz skorzystać z pomocy sztucznej inteligencji, która może pomóc rozwiązać Twój problem.
       Kliknij poniższy link i użyj przycisku „Zapytaj AI":</p>
    <p><a href="${link}">${link}</a></p>
  `.trim();

  await pool.query(
    `INSERT INTO korespondencja
       (ticket_id, data, created_by, updated_by, created_at, updated_at,
        tresc, html, message_to, message_cc, message_subject, message_from, przeczytane, typ)
     VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, '', ?, 'Helpdesk', 1, 'auto_weekend')`,
    [ticketId, now, now, now, autoText, autoHtml, email, subject]
  );

  const greeting = ldap_name
    ? `Szanowna Pani / Szanowny Panie ${ldap_name.split(' ')[0]},`
    : 'Szanowni Państwo,';

  sendNotification({
    to: email,
    subject: `Re: ${subject}`,
    greeting,
    html: autoHtml,
  }).catch(e => console.warn('[weekendAutoReply] Błąd email:', e.message));
}

module.exports = { isWeekend, sendWeekendAutoReply };
