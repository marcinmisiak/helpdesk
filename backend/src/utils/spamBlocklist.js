const pool = require('../config/db');

const STOPFORUMSPAM_CONFIDENCE_THRESHOLD = 40;

function extractEmail(from) {
  if (!from) return null;
  const angleMatch = from.match(/<([^>]+)>/);
  const candidate = (angleMatch ? angleMatch[1] : from).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : null;
}

// Zaufane domeny (ustawienia.trusted_domains, admin: zakładka Spam) — nadawcy z tych
// domen i ich subdomen nigdy nie są traktowani jako spam, niezależnie od lokalnej
// czarnej listy czy StopForumSpam. Jedna domena na linię, bez wstępnego "@".
async function isTrustedDomain(email) {
  if (!email) return false;
  const domain = email.split('@')[1];
  if (!domain) return false;

  const [[row]] = await pool.query('SELECT trusted_domains FROM ustawienia WHERE id = 1');
  const domains = (row?.trusted_domains || '')
    .split(/\r?\n/)
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

  return domains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

async function checkLocalList({ typ, email, ip }) {
  if (!email && !ip) return null;
  const conditions = [];
  const params = [typ];
  if (email) { conditions.push('email = ?'); params.push(email); }
  if (ip) { conditions.push('ip = ?'); params.push(ip); }
  if (!conditions.length) return null;

  const [[row]] = await pool.query(
    `SELECT reason FROM spam_blocklist WHERE typ = ? AND (${conditions.join(' OR ')}) LIMIT 1`,
    params
  );
  return row || null;
}

async function checkStopForumSpam({ email, ip }) {
  if (!email && !ip) return null;
  try {
    const params = new URLSearchParams({ json: '1' });
    if (email) params.set('email', email);
    if (ip) params.set('ip', ip);

    const res = await fetch(`https://api.stopforumspam.org/api?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.success) return null;

    const emailHit = data.email?.appears && data.email.confidence > STOPFORUMSPAM_CONFIDENCE_THRESHOLD;
    const ipHit = data.ip?.appears && data.ip.confidence > STOPFORUMSPAM_CONFIDENCE_THRESHOLD;
    if (!emailHit && !ipHit) return null;

    const confidence = Math.max(data.email?.confidence || 0, data.ip?.confidence || 0);
    return { reason: `Wykryto w StopForumSpam (confidence ${confidence.toFixed(0)}%)` };
  } catch (err) {
    console.error('[StopForumSpam] Błąd zapytania:', err.message);
    return null;
  }
}

// Sprawdza, czy nadawca jest już znany — zaufany (z e-maila) ma priorytet nad spamem,
// a oba mają priorytet nad zapytaniem AI.
async function checkSenderStatus({ email, ip }) {
  if (!email && !ip) return null;

  if (await isTrustedDomain(email)) return { typ: 'zaufany' };

  const trusted = await checkLocalList({ typ: 'zaufany', email, ip: null });
  if (trusted) return { typ: 'zaufany' };

  const blocked = await checkLocalList({ typ: 'spam', email, ip });
  if (blocked) return { typ: 'spam', reason: blocked.reason || 'Wykryto w lokalnej bazie spamerów' };

  const sfsHit = await checkStopForumSpam({ email, ip });
  if (sfsHit) return { typ: 'spam', reason: sfsHit.reason };

  return null;
}

// Zapisuje ręczną decyzję człowieka i rozwiązuje sprzeczności z wcześniejszym wpisem
// dla tego samego e-maila (najnowsza decyzja wygrywa).
async function rememberSenderStatus({ email, ip, typ, reason, ticketId }) {
  const useIp = typ === 'spam' ? (ip || null) : null;
  if (!email && !useIp) return;

  if (email) {
    const innyTyp = typ === 'spam' ? 'zaufany' : 'spam';
    await pool.query('DELETE FROM spam_blocklist WHERE email = ? AND typ = ?', [email, innyTyp]);
  }

  const [[existing]] = await pool.query(
    'SELECT id FROM spam_blocklist WHERE typ = ? AND email <=> ? AND ip <=> ? LIMIT 1',
    [typ, email || null, useIp]
  );
  if (existing) return;

  await pool.query(
    'INSERT INTO spam_blocklist (typ, email, ip, reason, ticket_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [typ, email || null, useIp, reason || null, ticketId || null, Math.floor(Date.now() / 1000)]
  );
}

module.exports = { extractEmail, checkSenderStatus, rememberSenderStatus };
