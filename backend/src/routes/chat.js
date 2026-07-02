const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { rateLimit } = require('express-rate-limit');
const pool = require('../config/db');
const { notifyUsers } = require('../utils/webpush');
const { notifyAdminsNewTicket } = require('../utils/mailer');
const { normalizePriority, computeDeadlines } = require('../utils/sla');
const { getSiteUrl } = require('../utils/siteUrl');
const { classifyAndSave } = require('../utils/groqClassifier');
const { sendWebhookEvent } = require('../utils/webhookClient');
const { verifyChallenge } = require('../utils/mathCaptcha');
const { logTicketEvent } = require('../utils/ticketLog');

const MAX_MESSAGE_LENGTH = 4000;

// Start nowej rozmowy — restrykcyjny limit, jak przy zakładaniu zgłoszenia
const startLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele rozmów. Spróbuj ponownie za 15 minut.' },
});

// Klucz per token rozmowy, nie per IP — wiele równoległych rozmów z tego samego adresu
// (NAT/sieć szkolna, kilka otwartych zakładek) inaczej dzieliłoby jeden wspólny limit
// i wywalało 429 mimo że żadna pojedyncza rozmowa nie przekracza swojego budżetu.
const byToken = (req) => req.params.token;

// Odpytywanie o nowe wiadomości — częste, musi być liberalne (polling co ~4s)
const pollLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byToken,
  message: { error: 'Zbyt wiele zapytań. Spróbuj ponownie za chwilę.' },
});

// Wysyłanie wiadomości — liberalne, żeby nie blokować żywej rozmowy
const messageLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byToken,
  message: { error: 'Zbyt wiele wiadomości. Zwolnij tempo.' },
});

// Widget osadza się jako iframe wskazujący na własną domenę helpdesku (zarówno w trybie
// bubble z widget.js, jak i w trybie czystego <iframe>), więc Origin/Referer żądania API
// to zawsze ten serwer, nigdy strona klienta. Prawdziwy adres strony, na której wstawiono
// widget, dociera tylko jako document.referrer przechwycony w iframe'ie i przekazany przez
// frontend w body (parent_url). To "miękka" weryfikacja — bot strzelający bezpośrednio w
// API może to podstawić — ale chroni przed przekopiowaniem cudzego embed snippetu na inną stronę.
function domainAllowed(dozwoloneDomeny, req) {
  if (!dozwoloneDomeny?.trim()) return true;
  const allowed = dozwoloneDomeny.split('\n').map((d) => d.trim().toLowerCase()).filter(Boolean);
  const origin = (req.body?.parent_url || req.headers.origin || req.headers.referer || '').toLowerCase();
  if (!origin) return true; // brak danych — nie blokujemy (np. testy lokalne, dostęp poza iframe)
  return allowed.some((d) => origin.includes(d));
}

// POST /api/chat/start — rozpoczęcie nowej rozmowy z widgetu, tworzy ticket
router.post('/start', startLimiter, async (req, res) => {
  const { channel_key, imie, email, tresc, website, captchaId, captchaAnswer } = req.body;
  // Honeypot — pole niewidoczne dla ludzi w formularzu, wypełniane tylko przez boty.
  if (website) return res.status(400).json({ error: 'Nieprawidłowe zgłoszenie.' });
  if (!channel_key) return res.status(400).json({ error: 'Brak kanału.' });
  if (!imie?.trim() || imie.trim().length > 150) return res.status(400).json({ error: 'Podaj imię.' });
  if (!tresc?.trim() || tresc.trim().length < 2) return res.status(400).json({ error: 'Wiadomość jest za krótka.' });
  if (tresc.trim().length > MAX_MESSAGE_LENGTH) return res.status(400).json({ error: 'Wiadomość jest za długa.' });

  const captchaResult = verifyChallenge(captchaId, captchaAnswer);
  if (captchaResult === 'expired') {
    return res.status(400).json({ error: 'Captcha wygasła. Odśwież stronę i spróbuj ponownie.' });
  }
  if (captchaResult === 'wrong') {
    return res.status(400).json({ error: 'Nieprawidłowa odpowiedź captcha.' });
  }

  try {
    const [[kanal]] = await pool.query(
      'SELECT id, zespol_id, dozwolone_domeny, notification_email FROM kanal_czatu WHERE channel_key = ? AND aktywny = 1',
      [channel_key]
    );
    if (!kanal) return res.status(404).json({ error: 'Kanał czatu nie został znaleziony.' });
    if (!domainAllowed(kanal.dozwolone_domeny, req)) {
      return res.status(403).json({ error: 'Ta domena nie jest uprawniona do korzystania z tego kanału.' });
    }

    const numer = Math.random().toString().slice(2, 8);
    const now = Math.floor(Date.now() / 1000);
    const autorToken = crypto.randomUUID();
    const messageFrom = email?.trim() ? `${imie.trim()} <${email.trim()}>` : imie.trim();
    const priority = 2;
    const deadlines = computeDeadlines(now, normalizePriority(priority));

    const [result] = await pool.query(
      `INSERT INTO ticket
         (numer, message_from, message_subject, tresc, status, data_utworzenia, odlozony, podswietl,
          zrodlo, autor_token, priority, sla_response_deadline, sla_resolution_deadline, zrodlo_ip)
       VALUES (?, ?, ?, ?, 2, ?, 0, 1, 'live_chat', ?, ?, ?, ?, ?)`,
      [numer, messageFrom, 'Rozmowa na czacie', tresc.trim(), now, autorToken,
       priority, deadlines.responseDeadline, deadlines.resolutionDeadline, req.ip]
    );
    const ticketId = result.insertId;

    logTicketEvent(ticketId, { typ: 'created', meta: { source: 'chat' }, actorLabel: 'Czat na żywo' });

    await pool.query(
      'INSERT INTO zespol_has_ticket (zespol_id, ticket_id, created_at) VALUES (?, ?, ?)',
      [kanal.zespol_id, ticketId, now]
    );

    // Wiadomość systemowa z linkiem do statusu — odwiedzający zachowuje dostęp do rozmowy
    // nawet jeśli zamknie widget lub wejdzie z innego urządzenia.
    const baseUrl = await getSiteUrl();
    const statusLink = `${baseUrl}/status/${autorToken}`;
    await pool.query(
      `INSERT INTO korespondencja
         (ticket_id, data, created_by, updated_by, created_at, updated_at, tresc, html, message_to, message_cc, message_from, typ, przeczytane)
       VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, '', '', 'System', 'system', 1)`,
      [ticketId, now, now, now,
       `Możesz śledzić tę rozmowę i odpowiadać na nią pod tym adresem: ${statusLink}`,
       `<p>Możesz śledzić tę rozmowę i odpowiadać na nią pod tym adresem: <a href="${statusLink}">${statusLink}</a></p>`]
    );

    // Jeśli odwiedzający nie podał emaila w formularzu startowym, dopytaj o niego automatycznie
    // na czacie (osobna wiadomość systemowa, sekundę później, żeby zachować kolejność wątku).
    if (!email?.trim()) {
      const emailPrompt = 'Aby ułatwić nam kontakt z Tobą, prosimy o podanie adresu e-mail w odpowiedzi.';
      await pool.query(
        `INSERT INTO korespondencja
           (ticket_id, data, created_by, updated_by, created_at, updated_at, tresc, html, message_to, message_cc, message_from, typ, przeczytane)
         VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, '', '', 'System', 'system', 1)`,
        [ticketId, now + 1, now + 1, now + 1, emailPrompt, `<p>${emailPrompt}</p>`]
      );
    }

    const [members] = await pool.query('SELECT user_id FROM zespol_user WHERE zespol_id = ?', [kanal.zespol_id]);
    notifyUsers(members.map((m) => m.user_id), {
      title: '💬 Nowa rozmowa na czacie',
      body: tresc.trim().slice(0, 120),
      url: `/czaty/${ticketId}`,
    }).catch(() => {});

    // Siatka bezpieczeństwa "nikt nie czyta push" — tylko gdy kanał ma skonfigurowany
    // notification_email; bez tego pola czat zostaje przy samym push jak dawniej (nie ma
    // tu sensownego adresata zastępczego — w przeciwieństwie do e-maila, gdzie zawsze
    // zostają admini).
    if (kanal.notification_email) {
      notifyAdminsNewTicket({
        ticketId,
        numer,
        from: messageFrom,
        subject: 'Rozmowa na czacie',
        source: 'live_chat',
        zespolId: kanal.zespol_id,
        channelEmail: kanal.notification_email,
      }).catch(() => {});
    }

    // Ta sama klasyfikacja AI co przy zgłoszeniach z formularza/e-maila — spam zostaje
    // automatycznie otagowany i odfiltrowany z głównej kolejki (GET /tickets już to pomija).
    classifyAndSave(ticketId, {
      subject: 'Rozmowa na czacie',
      body: tresc.trim(),
      from: messageFrom,
      ip: req.ip,
    }).catch(() => {});

    sendWebhookEvent('ticket.created', {
      ticket: { id: ticketId, numer, subject: 'Rozmowa na czacie', from: messageFrom, priority, status: 2, zrodlo: 'live_chat' },
      message: { tresc: tresc.trim(), html: null, from: messageFrom },
    }).catch(() => {});

    res.status(201).json({ token: autorToken, numer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/:token/messages — odpytywanie o stan rozmowy
router.get('/:token/messages', pollLimiter, async (req, res) => {
  const { token } = req.params;
  if (!token || token.length < 8) return res.status(400).json({ error: 'Nieprawidłowy token.' });

  try {
    const [[ticket]] = await pool.query(
      'SELECT id, numer, status, tresc, data_utworzenia FROM ticket WHERE autor_token = ? AND zrodlo = \'live_chat\'',
      [token]
    );
    if (!ticket) return res.status(404).json({ error: 'Rozmowa nie została znaleziona.' });

    const [korespondencja] = await pool.query(
      `SELECT k.id, k.data, k.tresc, k.typ, u.imie, u.nazwisko, u.avatar_path
       FROM korespondencja k
       LEFT JOIN user u ON u.id = k.created_by
       WHERE k.ticket_id = ?
       ORDER BY k.data ASC`,
      [ticket.id]
    );

    const [pliki] = await pool.query(
      `SELECT p.id, p.originalname, p.filepath
       FROM plik p
       WHERE (p.tabela = 1 AND p.ticket_id = ?)
          OR (p.tabela = 2 AND p.ticket_id IN (SELECT id FROM korespondencja WHERE ticket_id = ?))`,
      [ticket.id, ticket.id]
    );

    // Pierwsza wiadomość odwiedzającego trafia do ticket.tresc (jak przy formularzu/e-mailu),
    // nie do korespondencja — dosztukowujemy ją na początku wątku, żeby widget pokazał całą rozmowę.
    const pierwsza = {
      id: 'first',
      data: ticket.data_utworzenia,
      tresc: ticket.tresc,
      jest_od_pracownika: false,
      jest_systemowa: false,
    };

    res.json({
      numer: ticket.numer,
      status: ticket.status,
      korespondencja: [
        pierwsza,
        ...korespondencja.map((k) => ({
          id: k.id,
          data: k.data,
          tresc: k.tresc,
          jest_od_pracownika: !!k.imie,
          jest_systemowa: k.typ === 'system',
          pracownik_imie: k.imie ? `${k.imie} ${k.nazwisko}` : null,
          imie: k.imie || null,
          nazwisko: k.imie ? k.nazwisko : null,
          avatar_path: k.imie ? k.avatar_path : null,
        })),
      ],
      pliki: pliki.map((p) => ({ id: p.id, originalname: p.originalname, filepath: p.filepath })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// POST /api/chat/:token/message — wiadomość odwiedzającego
router.post('/:token/message', messageLimiter, async (req, res) => {
  const { token } = req.params;
  const { tresc } = req.body;
  if (!token || token.length < 8) return res.status(400).json({ error: 'Nieprawidłowy token.' });
  if (!tresc?.trim()) return res.status(400).json({ error: 'Wiadomość jest pusta.' });
  if (tresc.trim().length > MAX_MESSAGE_LENGTH) return res.status(400).json({ error: 'Wiadomość jest za długa.' });

  try {
    const [[ticket]] = await pool.query(
      'SELECT id, numer, message_subject, status, message_from FROM ticket WHERE autor_token = ? AND zrodlo = \'live_chat\'',
      [token]
    );
    if (!ticket) return res.status(404).json({ error: 'Rozmowa nie została znaleziona.' });

    const now = Math.floor(Date.now() / 1000);
    const wasClosed = ticket.status === 3;

    // Odwiedzający może ponownie otworzyć zamkniętą rozmowę, pisząc kolejną wiadomość —
    // zachowujemy historię w tym samym tickecie, zamiast wymuszać nową rozmowę.
    if (wasClosed) {
      await pool.query('UPDATE ticket SET status=2, data_zamkniecia=NULL WHERE id=?', [ticket.id]);
    }

    await pool.query(
      `INSERT INTO korespondencja
         (ticket_id, data, created_by, updated_by, created_at, updated_at, tresc, html, message_to, message_cc, message_from, typ, przeczytane)
       VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, '', '', ?, 'chat', 0)`,
      [ticket.id, now, now, now, tresc.trim(), `<p style="white-space:pre-wrap">${tresc.trim().replace(/</g, '&lt;')}</p>`, ticket.message_from]
    );

    if (wasClosed) {
      const [recipients] = await pool.query(
        `SELECT user_id FROM user_has_ticket WHERE ticket_id = ?
         UNION
         SELECT zu.user_id FROM zespol_has_ticket zht JOIN zespol_user zu ON zu.zespol_id = zht.zespol_id WHERE zht.ticket_id = ?`,
        [ticket.id, ticket.id]
      );
      notifyUsers(recipients.map((r) => r.user_id), {
        title: '💬 Rozmowa na czacie została ponownie otwarta',
        body: tresc.trim().slice(0, 120),
        url: `/czaty/${ticket.id}`,
      }).catch(() => {});
    }

    sendWebhookEvent('ticket.message.received', {
      ticket: { id: ticket.id, numer: ticket.numer, subject: ticket.message_subject, status: wasClosed ? 2 : ticket.status, zrodlo: 'live_chat' },
      message: { tresc: tresc.trim(), html: null, from: ticket.message_from },
    }).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

module.exports = router;
