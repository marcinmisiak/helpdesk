const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { rateLimit } = require('express-rate-limit');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { sendNotification, getAppName } = require('../utils/mailer');
const { t: tr, resolveLang } = require('../i18n/index');

// --- Rate limitery ---

// Globalny limit na login: 20 prób / 15 min z jednego IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.' },
  skipSuccessfulRequests: true,
});

// Limit na forgot-password: 5 prób / godzinę z jednego IP
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele prób resetowania hasła. Spróbuj ponownie za godzinę.' },
});

// --- Blokada konta po nieudanych próbach logowania ---
const loginFailures = new Map(); // email -> { count, lockedUntil }
const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function checkAccountLock(email) {
  const rec = loginFailures.get(email);
  if (!rec) return null;
  if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
    const secsLeft = Math.ceil((rec.lockedUntil - Date.now()) / 1000);
    return secsLeft;
  }
  return null;
}

function recordFailure(email) {
  const rec = loginFailures.get(email) || { count: 0, lockedUntil: null };
  rec.count += 1;
  if (rec.count >= MAX_FAILURES) {
    rec.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  loginFailures.set(email, rec);
}

function clearFailures(email) {
  loginFailures.delete(email);
}

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Podaj email i hasło' });
  }

  // Sprawdź blokadę konta
  const secsLeft = checkAccountLock(email);
  if (secsLeft) {
    const mins = Math.ceil(secsLeft / 60);
    return res.status(429).json({
      error: `Konto tymczasowo zablokowane po ${MAX_FAILURES} nieudanych próbach. Spróbuj za ${mins} min.`,
    });
  }

  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.password, u.imie, u.nazwisko, u.status,
              u.powiadom_nowy_ticket, u.powiadom_korespondencja,
              aa.item_name as rola
       FROM user u
       LEFT JOIN auth_assignment aa ON aa.user_id = u.id
       WHERE u.email = ?`,
      [email]
    );

    if (!rows.length) {
      recordFailure(email);
      return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });
    }

    const user = rows[0];
    if (user.status !== 10) {
      return res.status(401).json({ error: 'Konto nieaktywne' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      recordFailure(email);
      const rec = loginFailures.get(email);
      const remaining = MAX_FAILURES - (rec?.count || 0);
      const msg = remaining > 0
        ? `Nieprawidłowy email lub hasło. Pozostało prób: ${remaining}`
        : `Nieprawidłowy email lub hasło`;
      return res.status(401).json({ error: msg });
    }

    clearFailures(email);

    const token = jwt.sign(
      { id: user.id, email: user.email, rola: user.rola },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        imie: user.imie,
        nazwisko: user.nazwisko,
        rola: user.rola,
        powiadom_nowy_ticket: user.powiadom_nowy_ticket,
        powiadom_korespondencja: user.powiadom_korespondencja,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera', details: err.message });
  }
});

// GET /api/auth/providers – publiczny endpoint; informuje frontend które OAuth są skonfigurowane
router.get('/providers', (req, res) => {
  res.json({
    microsoft: !!process.env.MICROSOFT_CLIENT_ID,
    google: !!process.env.GOOGLE_CLIENT_ID,
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM user_presence WHERE user_id = ?', [req.user.id]);
  } catch {}
  res.json({ message: 'Wylogowano' });
});

// ============================================================
// ODZYSKIWANIE HASŁA
// ============================================================

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Podaj adres email' });

  // Zawsze odpowiedz OK – nie ujawniaj czy email istnieje
  res.json({ message: 'Jeśli podany adres istnieje w systemie, zostanie wysłany link do resetowania hasła.' });

  try {
    const [rows] = await pool.query(
      'SELECT id, imie FROM user WHERE email = ? AND status = 10',
      [email]
    );
    if (!rows.length) return;

    const user = rows[0];

    // Pobierz czas wygaśnięcia z ustawień (domyślnie 3600 s)
    const [[settings]] = await pool.query(
      'SELECT user_passwordResetTokenExpire FROM ustawienia WHERE id = 1'
    );
    const expireSecs = settings?.user_passwordResetTokenExpire || 3600;

    // Token: 16 bajtów hex (32 znaki) + _ + timestamp = max 43 znaków (mieści się w varchar(45))
    const tokenRaw = crypto.randomBytes(16).toString('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + expireSecs;
    const token = `${tokenRaw}_${expiresAt}`;

    await pool.query(
      'UPDATE user SET password_reset_token = ? WHERE id = ?',
      [token, user.id]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    const appName = await getAppName();
    const lang = await resolveLang(pool, user.id);
    const expireHours = Math.round(expireSecs / 3600);
    await sendNotification({
      to: email,
      subject: tr(lang, 'subject_reset_password', { appName }),
      greeting: tr(lang, 'greeting_formal_name', { name: user.imie }),
      lang,
      html: `
        <p>${tr(lang, 'reset_password_intro', { appName })}</p>
        <p>${tr(lang, 'reset_password_body')}</p>
        <p style="margin:24px 0">
          <a href="${resetLink}"
             style="background:#1e40af;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-size:14px;font-weight:600">
            ${tr(lang, 'btn_reset_password')}
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">
          ${tr(lang, 'reset_password_expire', { hours: expireHours })}
        </p>
      `,
    });
  } catch (err) {
    console.error('[forgot-password]', err.message);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Brakuje tokenu lub nowego hasła' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Hasło musi mieć co najmniej 8 znaków' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id FROM user WHERE password_reset_token = ? AND status = 10',
      [token]
    );
    if (!rows.length) {
      return res.status(400).json({ error: 'Nieprawidłowy lub wygasły link resetowania hasła' });
    }

    // Sprawdź timestamp zakodowany w tokenie: format {hex}_{timestamp}
    const parts = token.split('_');
    const expiresAt = parseInt(parts[parts.length - 1], 10);
    if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) {
      return res.status(400).json({ error: 'Link resetowania hasła wygasł' });
    }

    const user = rows[0];
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE user SET password = ?, password_reset_token = NULL, updated_at = ? WHERE id = ?',
      [hash, Math.floor(Date.now() / 1000), user.id]
    );

    res.json({ message: 'Hasło zostało zmienione. Możesz się teraz zalogować.' });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera', details: err.message });
  }
});

// ============================================================
// OAUTH – GOOGLE
// ============================================================

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Tymczasowy store na state CSRF (wygasa po 10 minutach)
const oauthStates = new Map();
function createState() {
  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.set(state, Date.now() + 10 * 60 * 1000);
  return state;
}
function validateState(state) {
  const exp = oauthStates.get(state);
  if (!exp || Date.now() > exp) return false;
  oauthStates.delete(state);
  return true;
}

function getBackendUrl() {
  return process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
}

// GET /api/auth/google
router.get('/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=oauth_not_configured`);
  }
  const state = createState();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${getBackendUrl()}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
  });
  res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const { code, state, error } = req.query;

  if (error || !code) {
    return res.redirect(`${frontendUrl}/login?error=oauth_denied`);
  }
  if (!validateState(state)) {
    return res.redirect(`${frontendUrl}/login?error=oauth_invalid_state`);
  }

  try {
    // Wymień kod na token dostępu
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${getBackendUrl()}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('Brak access_token od Google');

    // Pobierz dane użytkownika
    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await userRes.json();
    if (!profile.email) throw new Error('Brak email od Google');

    const jwt_token = await handleOAuthLogin('google', profile.id, profile.email);
    res.redirect(`${frontendUrl}/auth/callback?token=${jwt_token}`);
  } catch (err) {
    console.error('[google/callback]', err.message);
    res.redirect(`${frontendUrl}/login?error=oauth_error`);
  }
});

// ============================================================
// OAUTH – MICROSOFT
// ============================================================

const MS_TENANT = process.env.MICROSOFT_TENANT_ID || 'common';
const MS_AUTH_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize`;
const MS_TOKEN_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;
const MS_GRAPH_URL = 'https://graph.microsoft.com/v1.0/me';

// GET /api/auth/microsoft
router.get('/microsoft', (req, res) => {
  if (!process.env.MICROSOFT_CLIENT_ID) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=oauth_not_configured`);
  }
  const state = createState();
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    redirect_uri: `${getBackendUrl()}/api/auth/microsoft/callback`,
    response_type: 'code',
    scope: 'openid email profile User.Read',
    state,
    response_mode: 'query',
  });
  res.redirect(`${MS_AUTH_URL}?${params}`);
});

// GET /api/auth/microsoft/callback
router.get('/microsoft/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const { code, state, error } = req.query;

  if (error || !code) {
    return res.redirect(`${frontendUrl}/login?error=oauth_denied`);
  }
  if (!validateState(state)) {
    return res.redirect(`${frontendUrl}/login?error=oauth_invalid_state`);
  }

  try {
    const tokenRes = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        redirect_uri: `${getBackendUrl()}/api/auth/microsoft/callback`,
        grant_type: 'authorization_code',
        scope: 'openid email profile User.Read',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('Brak access_token od Microsoft');

    const userRes = await fetch(MS_GRAPH_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await userRes.json();
    const email = profile.mail || profile.userPrincipalName;
    if (!email) throw new Error('Brak email od Microsoft');

    const jwt_token = await handleOAuthLogin('microsoft', profile.id, email);
    res.redirect(`${frontendUrl}/auth/callback?token=${jwt_token}`);
  } catch (err) {
    console.error('[microsoft/callback]', err.message);
    res.redirect(`${frontendUrl}/login?error=oauth_error`);
  }
});

// ============================================================
// Wspólna logika OAuth login/linkowania konta
// ============================================================
async function handleOAuthLogin(provider, providerId, email) {
  // 1. Szukaj istniejącego powiązania OAuth
  const [oauthRows] = await pool.query(
    `SELECT u.id, u.email, u.imie, u.nazwisko, u.status, aa.item_name as rola
     FROM user_oauth uo
     JOIN user u ON u.id = uo.user_id
     LEFT JOIN auth_assignment aa ON aa.user_id = u.id
     WHERE uo.provider = ? AND uo.provider_id = ?`,
    [provider, providerId]
  );

  let user;
  if (oauthRows.length) {
    user = oauthRows[0];
  } else {
    // 2. Szukaj użytkownika po emailu
    const [userRows] = await pool.query(
      `SELECT u.id, u.email, u.imie, u.nazwisko, u.status, aa.item_name as rola
       FROM user u
       LEFT JOIN auth_assignment aa ON aa.user_id = u.id
       WHERE u.email = ?`,
      [email]
    );

    if (!userRows.length) {
      throw new Error('Brak konta powiązanego z tym adresem email. Skontaktuj się z administratorem.');
    }

    user = userRows[0];

    // Powiąż konto OAuth z istniejącym użytkownikiem
    await pool.query(
      'INSERT INTO user_oauth (user_id, provider, provider_id, created_at) VALUES (?, ?, ?, ?)',
      [user.id, provider, providerId, Math.floor(Date.now() / 1000)]
    );
  }

  if (user.status !== 10) {
    throw new Error('Konto nieaktywne');
  }

  return jwt.sign(
    { id: user.id, email: user.email, rola: user.rola },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
}

module.exports = router;
