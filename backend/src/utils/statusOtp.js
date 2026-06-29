const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendNotification, getAppName } = require('./mailer');
const { t: tr, getAppLang } = require('../i18n/index');

const CODE_TTL_SECONDS = 10 * 60;
const MAX_ATTEMPTS = 8;
const SESSION_TTL = '24h';
const OTP_PURPOSE = 'public_status';
const RESEND_COOLDOWN_SECONDS = 30;

function maskEmail(addr) {
  if (!addr) return '';
  // message_from bywa w formacie "Imię Nazwisko <email>" (nagłówek From z poczty) —
  // wyciągnij sam adres, inaczej maska łapie fragment nazwy i końcowy "<...>".
  const match = addr.match(/<([^>]+)>/);
  const email = match ? match[1] : addr;
  if (!email.includes('@')) return email;
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0] || ''}***@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

async function generateAndSendCode(ticket) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const expires = Math.floor(Date.now() / 1000) + CODE_TTL_SECONDS;
  await pool.query(
    'UPDATE ticket SET status_otp_code = ?, status_otp_expires = ?, status_otp_attempts = 0 WHERE id = ?',
    [code, expires, ticket.id]
  );

  const lang = await getAppLang(pool);
  const appName = await getAppName();
  await sendNotification({
    to: ticket.message_from,
    subject: tr(lang, 'subject_status_otp', { numer: ticket.numer, appName }),
    lang,
    html: `
      <p>${tr(lang, 'status_otp_intro', { numer: ticket.numer })}</p>
      <p style="margin:24px 0;text-align:center">
        <span style="display:inline-block;background:#f3f4f6;border-radius:8px;padding:14px 28px;font-size:28px;font-weight:700;letter-spacing:0.15em;color:#111827">${code}</span>
      </p>
      <p style="color:#6b7280;font-size:13px">${tr(lang, 'status_otp_expire', { minutes: CODE_TTL_SECONDS / 60 })}</p>
    `,
  });

  return { expires };
}

async function verifyCode(ticket, code) {
  if (!ticket.status_otp_code || !ticket.status_otp_expires) return { ok: false, reason: 'no_code' };
  if (Math.floor(Date.now() / 1000) > ticket.status_otp_expires) return { ok: false, reason: 'expired' };
  if (ticket.status_otp_attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };

  if (String(code).trim() !== ticket.status_otp_code) {
    await pool.query('UPDATE ticket SET status_otp_attempts = status_otp_attempts + 1 WHERE id = ?', [ticket.id]);
    return { ok: false, reason: 'mismatch', attemptsLeft: MAX_ATTEMPTS - (ticket.status_otp_attempts + 1) };
  }

  await pool.query(
    'UPDATE ticket SET status_otp_code = NULL, status_otp_expires = NULL, status_otp_attempts = 0 WHERE id = ?',
    [ticket.id]
  );
  return { ok: true };
}

function issueSession(ticket) {
  return jwt.sign({ tid: ticket.id, purpose: OTP_PURPOSE }, process.env.JWT_SECRET, { expiresIn: SESSION_TTL });
}

function verifySession(req, ticketId, otpEnabled) {
  if (!otpEnabled) return true;
  const header = req.get('X-Otp-Session');
  if (!header) return false;
  try {
    const decoded = jwt.verify(header, process.env.JWT_SECRET);
    return decoded.purpose === OTP_PURPOSE && decoded.tid === ticketId;
  } catch {
    return false;
  }
}

async function isOtpEnabled() {
  const [[row]] = await pool.query('SELECT status_otp_enabled FROM ustawienia WHERE id = 1');
  return !!row?.status_otp_enabled;
}

// Sekundy od ostatnio wysłanego kodu (status_otp_expires - TTL = moment wysłania).
// Infinity gdy nigdy nie wysłano — używane jako wspólny limit (30s) dla auto-wysyłki
// przy GET i dla jawnego "wyślij ponownie", żeby odświeżanie strony nigdy nie zalało
// skrzynki zgłaszającego kodami częściej niż raz na 30 sekund.
function secondsSinceLastCode(ticket) {
  if (!ticket.status_otp_expires) return Infinity;
  return Math.floor(Date.now() / 1000) - (ticket.status_otp_expires - CODE_TTL_SECONDS);
}

// Pozwala zalogowanemu pracownikowi/adminowi (ten sam JWT co w panelu) ominąć kod OTP —
// i tak ma pełny dostęp do wszystkich zgłoszeń przez uwierzytelniony /api/tickets,
// więc OTP (zabezpieczenie dla anonimowych odbiorców linku) nic by tu nie chroniło.
async function isStaffSession(req) {
  const authHeader = req.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  try {
    const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    const [[user]] = await pool.query(
      `SELECT u.status, aa.item_name AS rola FROM user u
       LEFT JOIN auth_assignment aa ON aa.user_id = u.id WHERE u.id = ?`,
      [decoded.id]
    );
    return !!user && user.status === 10 && ['admin', 'pracownik'].includes(user.rola);
  } catch {
    return false;
  }
}

module.exports = {
  generateAndSendCode, verifyCode, issueSession, verifySession, maskEmail, isOtpEnabled,
  secondsSinceLastCode, isStaffSession, CODE_TTL_SECONDS, RESEND_COOLDOWN_SECONDS,
};
