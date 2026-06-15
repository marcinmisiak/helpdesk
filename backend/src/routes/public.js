const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit');
const pool = require('../config/db');
const { sendNotification, notifyAdminsNewTicket, getAppName } = require('../utils/mailer');
const { notifyAllAdmins } = require('../utils/webpush');
const { t: tr, resolveLang, getAppLang } = require('../i18n/index');
const { normalizePriority, computeDeadlines } = require('../utils/sla');
const { lookupEmail } = require('../utils/ldap');
const { classifyAndSave, generatePublicReply } = require('../utils/groqClassifier');
const { sendWeekendAutoReply } = require('../utils/weekendAutoReply');

const uploadDir = process.env.UPLOAD_DIR || '/var/www/html/pomoc/pliki';

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/plain',
  'application/zip',
]);

const publicStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const now = new Date();
    const subdir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dir = path.join(uploadDir, subdir);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const publicUpload = multer({
  storage: publicStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Niedozwolony typ pliku: ${file.mimetype}`));
    }
  },
});

// Rate limiter: 5 zgłoszeń na 15 min z jednego IP
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele zgłoszeń. Spróbuj ponownie za 15 minut.' },
});

// Rate limiter na LDAP lookup: 20 na minutę (debounce z frontu)
const ldapLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele zapytań.' },
});

// Przechowuj wyzwania captcha (w pamięci, wygasają po 15 min)
const captchaChallenges = new Map();

function cleanExpiredCaptchas() {
  const now = Date.now();
  for (const [id, ch] of captchaChallenges) {
    if (now > ch.expiresAt) captchaChallenges.delete(id);
  }
}
setInterval(cleanExpiredCaptchas, 5 * 60 * 1000);

// GET /api/public/kategorie — aktywne kategorie dla formularza
router.get('/kategorie', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nazwa, opis FROM kategoria_zgloszenia WHERE aktywna = 1 ORDER BY kolejnosc ASC, nazwa ASC'
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /api/public/captcha — nowe wyzwanie matematyczne
router.get('/captcha', (req, res) => {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const id = crypto.randomBytes(10).toString('hex');

  captchaChallenges.set(id, {
    answer: a + b,
    expiresAt: Date.now() + 15 * 60 * 1000,
  });

  res.json({ id, question: `${a} + ${b}` });
});

// GET /api/public/ldap-lookup?email=xxx — sprawdź email w LDAP
router.get('/ldap-lookup', ldapLimiter, async (req, res) => {
  const { email } = req.query;
  if (!email) return res.json({ found: false });

  try {
    const result = await lookupEmail(email);
    if (!result) return res.json({ found: false });
    res.json({ found: true, ...result });
  } catch {
    res.json({ found: false });
  }
});

// GET /api/public/info — publiczne ustawienia formularza (tytuł, czy włączony)
router.get('/info', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      'SELECT formularz_publiczny, formularz_tytul, app_name, logo_path, kontakt_telefony, kontakt_emaile, app_language FROM ustawienia WHERE id = 1'
    );
    res.json({
      enabled: !!row?.formularz_publiczny,
      tytul: row?.formularz_tytul || 'Formularz zgłoszenia',
      app_name: row?.app_name || 'Helpdesk',
      logo_path: row?.logo_path || null,
      kontakt_telefony: row?.kontakt_telefony || '',
      kontakt_emaile: row?.kontakt_emaile || '',
      app_language: row?.app_language || 'pl',
    });
  } catch {
    res.json({ enabled: true, tytul: 'Formularz zgłoszenia', app_name: 'Helpdesk', logo_path: null, kontakt_telefony: '', kontakt_emaile: '', app_language: 'pl' });
  }
});

// POST /api/public/zgloszenie — wyślij zgłoszenie (bez logowania)
router.post('/zgloszenie', submitLimiter, (req, res, next) => {
  publicUpload.array('attachments', 5)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Plik jest za duży. Maksymalny rozmiar to 10 MB.' });
      if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'Maksymalnie 5 załączników.' });
      return res.status(400).json({ error: `Błąd przesyłania pliku: ${err.message}` });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  const {
    email, opis, kategoria_id,
    captchaId, captchaAnswer,
    // honeypot - jeśli wypełniony, to bot
    website,
    ldap_name,
  } = req.body;

  // Honeypot: boty często wypełniają ukryte pola
  if (website) {
    return res.status(400).json({ error: 'Błąd weryfikacji formularza.' });
  }

  // Walidacja pól
  if (!email || !opis) {
    return res.status(400).json({ error: 'Podaj email i opis zgłoszenia.' });
  }
  if (opis.trim().length < 10) {
    return res.status(400).json({ error: 'Opis musi zawierać co najmniej 10 znaków.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Nieprawidłowy adres email.' });
  }

  // Weryfikacja captcha
  const challenge = captchaChallenges.get(captchaId);
  if (!challenge || Date.now() > challenge.expiresAt) {
    return res.status(400).json({ error: 'Captcha wygasła. Odśwież stronę i spróbuj ponownie.' });
  }
  if (parseInt(captchaAnswer, 10) !== challenge.answer) {
    return res.status(400).json({ error: 'Nieprawidłowa odpowiedź captcha.' });
  }
  captchaChallenges.delete(captchaId);

  try {
    // Sprawdź kategorie
    let kategoriaName = '';
    if (kategoria_id) {
      const [[kat]] = await pool.query(
        'SELECT nazwa FROM kategoria_zgloszenia WHERE id = ? AND aktywna = 1',
        [kategoria_id]
      );
      kategoriaName = kat?.nazwa || '';
    }

    // Skonstruuj nadawcę (imię z LDAP jeśli jest)
    const senderName = ldap_name ? `${ldap_name}` : '';
    const messageFrom = senderName ? `${senderName} <${email}>` : email;
    const messageSubject = kategoriaName
      ? `[${kategoriaName}] Zgłoszenie przez formularz`
      : 'Zgłoszenie przez formularz';

    const numer = Math.random().toString().slice(2, 8);
    const now = Math.floor(Date.now() / 1000);
    const priority = 2; // normalny
    const deadlines = computeDeadlines(now, normalizePriority(priority));

    const [result] = await pool.query(
      `INSERT INTO ticket
         (numer, message_from, message_to, message_subject, tresc, status,
          data_utworzenia, odlozony, podswietl, kategoria_id, zrodlo)
       VALUES (?, ?, '', ?, ?, 1, ?, 0, 1, ?, 'web_form')`,
      [numer, messageFrom, messageSubject, opis.trim(), now,
       kategoria_id || null]
    );

    const ticketId = result.insertId;

    // Zapisz załączniki
    for (const file of (req.files || [])) {
      const filepath = file.path.replace(uploadDir + '/', '');
      await pool.query(
        'INSERT INTO plik (tabela, ticket_id, filepath, originalname) VALUES (1, ?, ?, ?)',
        [ticketId, filepath, file.originalname]
      );
    }

    // SLA
    try {
      await pool.query(
        'UPDATE ticket SET priority = ?, sla_response_deadline = ?, sla_resolution_deadline = ? WHERE id = ?',
        [priority, deadlines.responseDeadline, deadlines.resolutionDeadline, ticketId]
      );
    } catch { /* brak kolumn SLA — OK */ }

    // Powiadomienia push dla adminów
    notifyAllAdmins({
      title: 'Nowe zgłoszenie z formularza',
      body: `Od: ${messageFrom} | ${kategoriaName || 'Brak kategorii'}`,
      url: `/tickets/${ticketId}`,
    }).catch(() => {});

    // Klasyfikacja AI
    classifyAndSave(ticketId, {
      subject: messageSubject,
      body: opis,
      from: messageFrom,
    }).catch(() => {});

    // Email do adminów o nowym zgłoszeniu
    notifyAdminsNewTicket({
      ticketId,
      numer,
      from: messageFrom,
      subject: messageSubject,
      source: 'web_form',
    }).catch(() => {});

    // Auto-odpowiedź weekendowa
    sendWeekendAutoReply(pool, ticketId, {
      email,
      numer,
      subject: messageSubject,
      ldap_name: ldap_name || '',
    }).catch(() => {});

    // Email potwierdzający dla nadawcy
    try {
      const lang = await getAppLang(pool);
      const greeting = ldap_name
        ? tr(lang, 'greeting_formal_name', { name: ldap_name.split(' ')[0] })
        : tr(lang, 'greeting_formal');
      await sendNotification({
        to: email,
        subject: tr(lang, 'subject_ticket_received', { numer }),
        greeting,
        lang,
        html: `
          <p>${tr(lang, 'ticket_received_intro')}</p>

          <table style="width:100%;max-width:480px;border-collapse:collapse;font-size:14px;margin:16px 0">
            <tr style="background:#f9fafb">
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;width:160px;color:#374151">${tr(lang, 'ticket_received_col_number')}</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827;font-weight:700">#${numer}</td>
            </tr>
            ${kategoriaName ? `
            <tr>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#374151">${tr(lang, 'ticket_received_col_category')}</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">${kategoriaName}</td>
            </tr>` : ''}
            <tr ${kategoriaName ? '' : 'style="background:#f9fafb"'}>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#374151">${tr(lang, 'ticket_received_col_content')}</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#374151;white-space:pre-wrap">${opis.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
            </tr>
          </table>

          <p>${tr(lang, 'ticket_received_footer')}</p>
          <p>${tr(lang, 'ticket_received_note')}</p>
        `,
      });
    } catch (mailErr) {
      console.warn('[public/zgloszenie] Nie udało się wysłać potwierdzenia:', mailErr.message);
    }

    res.json({ success: true, numer });
  } catch (err) {
    console.error('[public/zgloszenie]', err.message);
    res.status(500).json({ error: 'Błąd serwera. Spróbuj ponownie.' });
  }
});

// ─── Rate limiter dla podglądu statusu ───────────────────────────────────────
const statusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele prób. Spróbuj ponownie za 15 minut.' },
});

const replyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele odpowiedzi. Spróbuj ponownie za 15 minut.' },
});

// GET /api/public/status/:token — podgląd ticketu przez autora (bez JWT)
router.get('/status/:token', statusLimiter, async (req, res) => {
  const { token } = req.params;
  if (!token || token.length < 8) return res.status(400).json({ error: 'Nieprawidłowy token.' });

  try {
    const [[ticket]] = await pool.query(
      `SELECT id, numer, message_subject, message_from, tresc, html, status, data_utworzenia
       FROM ticket WHERE autor_token = ?`,
      [token]
    );
    if (!ticket) return res.status(404).json({ error: 'Nie znaleziono zgłoszenia lub link jest nieważny.' });

    const [korespondencja] = await pool.query(
      `SELECT k.id, k.data, k.tresc, k.html, k.message_from, k.message_to, k.typ,
              u.imie, u.nazwisko
       FROM korespondencja k
       LEFT JOIN user u ON u.id = k.created_by
       WHERE k.ticket_id = ?
       ORDER BY k.data ASC`,
      [ticket.id]
    );

    const [pliki] = await pool.query(
      'SELECT id, originalname FROM plik WHERE tabela = 1 AND ticket_id = ?',
      [ticket.id]
    );

    res.json({
      ticket: {
        id: ticket.id,
        numer: ticket.numer,
        temat: ticket.message_subject,
        tresc: ticket.tresc,
        html: ticket.html,
        status: ticket.status,
        data_utworzenia: ticket.data_utworzenia,
        message_from: ticket.message_from,
      },
      korespondencja: korespondencja.map(k => ({
        id: k.id,
        data: k.data,
        tresc: k.tresc,
        html: k.html,
        od: k.imie ? `${k.imie} ${k.nazwisko}` : null,
        jest_od_pracownika: !!k.imie,
        typ: k.typ || null,
      })),
      pliki: pliki.map(p => ({ id: p.id, originalname: p.originalname })),
    });
  } catch (err) {
    console.error('[public/status GET]', err.message);
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// POST /api/public/status/:token/odpowiedz — odpowiedź autora na ticket
router.post('/status/:token/odpowiedz', replyLimiter, async (req, res) => {
  const { token } = req.params;
  const { tresc } = req.body;

  if (!token || token.length < 8) return res.status(400).json({ error: 'Nieprawidłowy token.' });
  if (!tresc?.trim() || tresc.trim().length < 5) return res.status(400).json({ error: 'Wiadomość jest za krótka.' });

  try {
    const [[ticket]] = await pool.query(
      'SELECT id, numer, message_from, message_subject, status FROM ticket WHERE autor_token = ?',
      [token]
    );
    if (!ticket) return res.status(404).json({ error: 'Nie znaleziono zgłoszenia lub link jest nieważny.' });
    if (ticket.status === 3) return res.status(400).json({ error: 'Zgłoszenie jest zamknięte — nie można dodać odpowiedzi.' });

    const now = Math.floor(Date.now() / 1000);
    await pool.query(
      `INSERT INTO korespondencja
         (ticket_id, data, created_by, updated_by, created_at, updated_at,
          tresc, html, message_to, message_cc, message_subject, message_from, przeczytane)
       VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, '', '', ?, ?, 0)`,
      [
        ticket.id, now, now, now,
        tresc.trim(),
        `<p style="white-space:pre-wrap">${tresc.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`,
        ticket.message_subject,
        ticket.message_from,
      ]
    );

    // Powiadom przypisanych pracowników emailem (pomijaj tych, którzy są online)
    try {
      const ONLINE_THRESHOLD = 3 * 60;
      const presenceNow = Math.floor(Date.now() / 1000);
      const [przypisani] = await pool.query(
        `SELECT u.email, u.imie FROM user u
         INNER JOIN user_has_ticket uht ON uht.user_id = u.id
         LEFT JOIN user_presence up ON up.user_id = u.id
         WHERE uht.ticket_id = ?
           AND (up.last_seen_at IS NULL OR up.last_seen_at <= ?)`,
        [ticket.id, presenceNow - ONLINE_THRESHOLD]
      );
      const subject = ticket.message_subject
        ? `Re: ${ticket.message_subject}`
        : `Nowa wiadomość od zgłaszającego — #${ticket.numer}`;

      for (const p of przypisani) {
        const wLang = await resolveLang(pool, p.id);
        sendNotification({
          to: p.email,
          subject,
          greeting: p.imie ? tr(wLang, 'greeting_day_with_name', { name: p.imie }) : tr(wLang, 'greeting_formal'),
          lang: wLang,
          html: `
            <p>${tr(wLang, 'public_reply_intro', { numer: ticket.numer })}</p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 16px;margin:12px 0;font-size:14px;white-space:pre-wrap;color:#374151">${tresc.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          `,
        }).catch(() => {});
      }
    } catch { /* email nieobowiązkowy */ }

    res.json({ success: true });
  } catch (err) {
    console.error('[public/status POST odpowiedz]', err.message);
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// POST /api/public/status/:token/zamknij — autor zamyka ticket
router.post('/status/:token/zamknij', replyLimiter, async (req, res) => {
  const { token } = req.params;
  if (!token || token.length < 8) return res.status(400).json({ error: 'Nieprawidłowy token.' });

  try {
    const [[ticket]] = await pool.query(
      'SELECT id, numer, message_from, message_subject, status FROM ticket WHERE autor_token = ?',
      [token]
    );
    if (!ticket) return res.status(404).json({ error: 'Nie znaleziono zgłoszenia lub link jest nieważny.' });
    if (ticket.status === 3) return res.json({ success: true, already_closed: true });

    const now = Math.floor(Date.now() / 1000);
    await pool.query('UPDATE ticket SET status=3, data_zamkniecia=? WHERE id=?', [now, ticket.id]);

    // Powiadom przypisanych pracowników
    try {
      const [przypisani] = await pool.query(
        `SELECT u.email, u.imie FROM user u
         INNER JOIN user_has_ticket uht ON uht.user_id = u.id
         WHERE uht.ticket_id = ?`,
        [ticket.id]
      );
      const appName = await getAppName();
      for (const p of przypisani) {
        const wLang = await resolveLang(pool, p.id);
        sendNotification({
          to: p.email,
          subject: tr(wLang, 'subject_closed_by_requester', { appName, numer: ticket.numer }),
          greeting: p.imie ? tr(wLang, 'greeting_day_with_name', { name: p.imie }) : tr(wLang, 'greeting_formal'),
          lang: wLang,
          html: `<p>${tr(wLang, 'closed_by_requester_intro', { numer: ticket.numer, subject: (ticket.message_subject || '').replace(/</g, '&lt;') })}</p>`,
        }).catch(() => {});
      }
    } catch { /* email nieobowiązkowy */ }

    res.json({ success: true });
  } catch (err) {
    console.error('[public/status POST zamknij]', err.message);
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele zapytań do AI. Spróbuj ponownie za godzinę.' },
});

// POST /api/public/status/:token/zapytaj-ai — odpowiedź AI dla zgłaszającego (wymaga zgody RODO)
router.post('/status/:token/zapytaj-ai', aiLimiter, async (req, res) => {
  const { token } = req.params;
  const { rodo_zgoda } = req.body;

  if (!token || token.length < 8) return res.status(400).json({ error: 'Nieprawidłowy token.' });
  if (!rodo_zgoda) return res.status(400).json({ error: 'Wymagana jest zgoda na przetwarzanie danych przez AI.' });

  try {
    const [[ticket]] = await pool.query(
      `SELECT t.id, t.numer, t.message_subject, t.tresc, t.status,
              k.nazwa AS kategoria_nazwa
       FROM ticket t
       LEFT JOIN kategoria_zgloszenia k ON k.id = t.kategoria_id
       WHERE t.autor_token = ?`,
      [token]
    );
    if (!ticket) return res.status(404).json({ error: 'Nie znaleziono zgłoszenia lub link jest nieważny.' });
    if (ticket.status === 3) return res.status(400).json({ error: 'Zgłoszenie jest zamknięte.' });

    const [[existing]] = await pool.query(
      `SELECT id FROM korespondencja WHERE ticket_id = ? AND typ = 'ai_answer' LIMIT 1`,
      [ticket.id]
    );
    if (existing) return res.status(400).json({ error: 'AI już udzieliło odpowiedzi na to zgłoszenie.' });

    const [pliki] = await pool.query(
      'SELECT originalname, filepath FROM plik WHERE tabela = 1 AND ticket_id = ?',
      [ticket.id]
    );
    const attachmentNames = pliki.map(p => p.originalname);

    const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
    let sharp; try { sharp = require('sharp'); } catch { sharp = null; }
    const images = [];
    for (const p of pliki) {
      const ext = path.extname(p.originalname).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;
      const fullPath = path.join(uploadDir, p.filepath);
      try {
        let buf;
        if (sharp) {
          // Skaluj do max 1280px i kompresuj do JPEG ~85% — docelowo < 1 MB
          buf = await sharp(fullPath)
            .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();
        } else {
          const stat = fs.statSync(fullPath);
          if (stat.size > 2 * 1024 * 1024) continue;
          buf = fs.readFileSync(fullPath);
        }
        images.push(`data:image/jpeg;base64,${buf.toString('base64')}`);
      } catch { /* plik niedostępny lub błąd resize — pomiń */ }
    }

    const aiText = await generatePublicReply({
      subject: ticket.message_subject || '',
      body: ticket.tresc || '',
      kategoria: ticket.kategoria_nazwa || '',
      attachmentNames,
      images,
    });

    if (!aiText) return res.status(503).json({ error: 'Nie udało się uzyskać odpowiedzi od AI. Spróbuj ponownie.' });

    const now = Math.floor(Date.now() / 1000);
    const escaped = aiText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const aiHtml = `<p style="white-space:pre-wrap">${escaped}</p><p style="margin-top:16px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">🤖 Ta odpowiedź została wygenerowana automatycznie przez sztuczną inteligencję i nie pochodzi od pracownika helpdesku.</p>`;

    await pool.query(
      `INSERT INTO korespondencja
         (ticket_id, data, created_by, updated_by, created_at, updated_at,
          tresc, html, message_to, message_cc, message_subject, message_from, przeczytane, typ)
       VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, '', '', ?, 'Helpdesk AI', 1, 'ai_answer')`,
      [ticket.id, now, now, now, aiText, aiHtml, ticket.message_subject]
    );

    res.json({ success: true, tresc: aiText });
  } catch (err) {
    console.error('[public/zapytaj-ai]', err.message);
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

module.exports = router;
