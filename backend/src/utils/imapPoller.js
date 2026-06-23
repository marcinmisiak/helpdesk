const Imap = require('imap');
const { simpleParser } = require('mailparser');
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const msGraph = require('./msGraphClient');
const { getSiteUrl } = require('./siteUrl');
const { sendWebhookEvent } = require('./webhookClient');

const uploadDir = process.env.UPLOAD_DIR || '/var/www/html/pomoc/pliki';

// ─── NDR / bounce detection ────────────────────────────────────────────────────

function isNDR(from, subject) {
  const f = (from || '').toLowerCase();
  const s = (subject || '').toLowerCase();
  if (/mailer-daemon|mail-daemon|postmaster@|mail delivery subsystem/i.test(f)) return true;
  if (/undelivered mail|mail delivery failed|delivery status notification|delivery failure|returned mail|niedostarczone|niedoręczone|failure notice|undeliverable/i.test(s)) return true;
  return false;
}

const BOUNCE_CODE_MAP = [
  [/550\s*5\.7\.1|rejected.*spam|spam.*reject|bl\.spamcop|spamhaus|barracuda|blocked.*policy/i,
    'Wiadomość odrzucona jako spam przez serwer odbiorcy'],
  [/550\s*5\.1\.[12]|user unknown|no such user|does not exist|address.*reject|invalid.*recipient/i,
    'Adres e-mail odbiorcy nie istnieje'],
  [/552\s*5\.2\.2|552\s*5\.3\.4|over.*quota|mailbox.*full|quota.*exceeded|storage.*limit/i,
    'Skrzynka odbiorcy jest pełna'],
  [/421\s*4\.|450\s*4\.|451\s*4\.|452\s*4\.|temporary|try again|try later|temporarily/i,
    'Tymczasowy błąd serwera odbiorcy — wiadomość nie została dostarczona'],
  [/550\s*5\.7\.0|ip.*blacklist|dnsbl|rbl|relay.*denied|not permitted/i,
    'Adres IP naszego serwera jest na czarnej liście (blacklist)'],
  [/535\s*5\.7\.|authentication.*fail|auth.*fail/i,
    'Błąd uwierzytelniania serwera pocztowego'],
  [/552\s*5\.2\.3|message.*too large|size.*limit|message.*size/i,
    'Wiadomość zbyt duża — serwer odbiorcy odrzucił ze względu na rozmiar'],
  [/op\.pl|onet\.pl|wp\.pl|gmail\.com|yahoo/i,
    null], // domena — wyciągniemy z kontekstu
];

function extractBounceReason(text) {
  if (!text) return 'Wiadomość nie została dostarczona (brak szczegółów)';
  const t = text.substring(0, 3000); // ogranicz wielkość przeszukiwanego tekstu

  for (const [pattern, desc] of BOUNCE_CODE_MAP) {
    if (pattern.test(t)) {
      if (desc) return desc;
    }
  }

  // Spróbuj wyciągnąć linię z kodem SMTP 5xx / 4xx
  const smtpLine = t.match(/\b[45]\d{2}\s+[\d.]+\s+.{5,80}/m);
  if (smtpLine) return `Błąd serwera pocztowego: ${smtpLine[0].trim()}`;

  const diagLine = t.match(/^Diagnostic-Code:\s*(.+)$/im);
  if (diagLine) return `Kod diagnostyczny: ${diagLine[1].trim()}`;

  const statusLine = t.match(/^Status:\s*([45]\.\d\.\d)/im);
  if (statusLine) return `Status SMTP: ${statusLine[1].trim()} — wiadomość nie została dostarczona`;

  return 'Wiadomość nie została dostarczona — serwer odbiorcy odrzucił wiadomość';
}

// Spróbuj znaleźć ticket powiązany z bouncem (przez In-Reply-To lub numer w temacie)
async function findTicketForNDR(inReplyTo, references, subject) {
  const ids = [inReplyTo, ...(references || [])].filter(Boolean).map(id => id.replace(/[<>]/g, ''));
  for (const refId of ids) {
    const [[row]] = await pool.query('SELECT id FROM ticket WHERE message_id = ?', [refId]).catch(() => [[null]]);
    if (row) return row.id;
    const [[row2]] = await pool.query('SELECT ticket_id FROM korespondencja WHERE message_id = ?', [refId]).catch(() => [[null]]);
    if (row2) return row2.ticket_id;
  }
  const nrMatch = subject?.match(/\b(\d{6})\b/);
  if (nrMatch) {
    const [[row]] = await pool.query('SELECT id FROM ticket WHERE numer = ?', [nrMatch[1]]).catch(() => [[null]]);
    if (row) return row.id;
  }
  return null;
}

async function processNDR({ from, subject, text, inReplyTo, references }) {
  const reason = extractBounceReason(text);
  const ticketId = await findTicketForNDR(inReplyTo, references, subject);

  if (!ticketId) {
    console.log(`[IMAP] NDR bez dopasowania do ticketu — pominięto. Od: ${from} | Temat: ${subject}`);
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  await pool.query(
    `INSERT INTO korespondencja
       (ticket_id, data, created_by, updated_by, created_at, updated_at,
        tresc, html, message_to, message_cc, message_subject, message_from, typ, mail_error)
     VALUES (?, ?, 0, 0, ?, ?, ?, ?, '', '', ?, ?, 'bounce', ?)`,
    [ticketId, now, now, now,
     `[NDR] ${reason}\n\nOryginalna wiadomość bounce:\n${(text || '').substring(0, 1000)}`,
     null,
     subject, from,
     reason]
  );
  await pool.query('UPDATE ticket SET podswietl = 1 WHERE id = ?', [ticketId]);
  console.log(`[IMAP] NDR zapisany do ticket #${ticketId}: ${reason}`);
}

// Returns a map of contentId → public URL for inline CID image replacement
async function saveEmailAttachments(attachments, tabela, refId) {
  if (!attachments?.length) return {};
  const baseUrl = await getSiteUrl();
  const cidMap = {};

  for (const att of attachments) {
    if (!att.content) continue;
    // Generate a filename for pasted/inline images that have no name
    let filename = att.filename;
    if (!filename) {
      const ext = (att.contentType || '').split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'bin';
      filename = `inline-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
    }
    try {
      const now = new Date();
      const subdir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const dir = path.join(uploadDir, subdir);
      fs.mkdirSync(dir, { recursive: true });
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(filename) || '';
      const savedFilename = unique + ext;
      const filepath = `${subdir}/${savedFilename}`;
      fs.writeFileSync(path.join(dir, savedFilename), att.content);
      await pool.query(
        'INSERT INTO plik (tabela, ticket_id, filepath, originalname) VALUES (?, ?, ?, ?)',
        [tabela, refId, filepath, att.filename || filename]
      );
      // Map CID → public URL so callers can replace cid: references in HTML
      if (att.contentId) {
        const cid = att.contentId.replace(/^<|>$/g, '');
        const url = `${baseUrl}/pliki/${filepath}`;
        cidMap[cid] = url;
        // Also map without @domain suffix (some clients use bare cid without domain)
        const bareCid = cid.replace(/@.*$/, '');
        if (bareCid !== cid) cidMap[bareCid] = url;
      }
    } catch (e) {
      console.warn('[IMAP] Błąd zapisu załącznika:', filename, e.message);
    }
  }
  return cidMap;
}

function replaceCidReferences(html, cidMap) {
  if (!html || !Object.keys(cidMap).length) return html;
  return html.replace(/cid:([^\s"'>]+)/gi, (match, cid) => {
    return cidMap[cid] || cidMap[cid.replace(/@.*$/, '')] || match;
  });
}

// ─── Usuwanie historii cytowanej z przychodzących emaili ─────────────────────

function stripQuotedText(text) {
  if (!text) return text;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();

    // Nasz własny separator helpdesk (─── PROSIMY ODPOWIADAĆ POWYŻEJ TEJ LINII ───)
    if (/PROSIMY ODPOWIADAĆ POWYŻEJ/i.test(t)) {
      let cut = i;
      while (cut > 0 && lines[cut - 1].trim() === '') cut--;
      return lines.slice(0, cut).join('\n').trimEnd();
    }
    // Cytowane linie (> )
    if (/^>/.test(t)) {
      let cut = i;
      while (cut > 0 && lines[cut - 1].trim() === '') cut--;
      return lines.slice(0, cut).join('\n').trimEnd();
    }
    // "On ... wrote:" / "W dniu ... napisał(a):"
    if (/^On .{5,120} wrote:$/i.test(t) || /^W dniu .{5,120} napisa[łl]/i.test(t)) {
      let cut = i;
      while (cut > 0 && lines[cut - 1].trim() === '') cut--;
      return lines.slice(0, cut).join('\n').trimEnd();
    }
    // Separatory Outlook: -----Original Message----- lub ciąg kresek/podkreśleń
    if (/^-{5,}/.test(t) || /^_{5,}/.test(t)) {
      let cut = i;
      while (cut > 0 && lines[cut - 1].trim() === '') cut--;
      return lines.slice(0, cut).join('\n').trimEnd();
    }
    // Outlook "From:" po pustej linii
    if (i > 0 && lines[i - 1].trim() === '' && /^From:\s+/i.test(t)) {
      let cut = i - 1;
      while (cut > 0 && lines[cut - 1].trim() === '') cut--;
      return lines.slice(0, cut).join('\n').trimEnd();
    }
  }
  return text;
}

function stripQuotedHtml(html) {
  if (!html) return html;

  // Nasz własny marker helpdesk — najwyższy priorytet
  let idx = html.search(/<!--\s*helpdesk-separator\s*-->/i);
  if (idx !== -1) return html.slice(0, idx).trimEnd();

  // Gmail / Apple Mail / Thunderbird: <blockquote ...>
  idx = html.search(/<blockquote/i);
  if (idx !== -1) {
    let before = html.slice(0, idx);
    // Usuń poprzedzający "On ... wrote:" akapit
    before = before.replace(/(<br\s*\/?>|<\/p>)\s*(<p[^>]*>)?\s*(?:On\s.{5,120}\swrote:|W\sdniu\s.{5,120}\snapisa[łl])[^<]*(<\/p>)?\s*$/is, '$1');
    return before.trimEnd();
  }

  // Outlook Web App: <div id="divRplyFwdMsg">
  idx = html.search(/<div[^>]+id="divRplyFwdMsg"/i);
  if (idx !== -1) return html.slice(0, idx).trimEnd();

  // Gmail quote wrapper: class="gmail_quote"
  idx = html.search(/<div[^>]+class="[^"]*gmail_quote[^"]*"/i);
  if (idx !== -1) return html.slice(0, idx).trimEnd();

  // Outlook desktop: <hr> z id="stopSpelling"
  idx = html.search(/<hr[^>]+id="stopSpelling"/i);
  if (idx !== -1) return html.slice(0, idx).trimEnd();

  return html;
}

let timer = null;

async function getSettings() {
  const [[s]] = await pool.query('SELECT * FROM ustawienia WHERE id = 1');
  return s;
}

// ─── Dopasowanie po nadawcy + temacie (fallback gdy nagłówki i numer w temacie nie pomogą) ──

function normalizeSubjectForMatch(s) {
  let str = (s || '').toLowerCase();
  str = str.replace(/^(?:\s*(re|fwd|fw|odp)\s*:\s*)+/i, '');
  str = str.replace(/\[[^\]]*\]/g, ' ');
  str = str.replace(/[‐-―]/g, ' ');
  str = str.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return str;
}

function extractEmailAddress(fromText) {
  const m = (fromText || '').match(/<([^>]+)>/);
  return (m ? m[1] : (fromText || '')).trim().toLowerCase();
}

// Gdy odpowiedź nie ma dopasowania przez Message-ID ani numer w temacie (np. mail
// systemowy bez śledzonego Message-ID i bez numeru w temacie), spróbuj znaleźć
// zgłoszenie tego samego nadawcy, którego temat zawiera się w temacie odpowiedzi.
//
// Uwaga: dopasowanie (tu i w processEmailItem poniżej) jest celowo GLOBALNE — nie
// filtrowane po kanale/skrzynce (ticket.kanal_id). Odpowiedzi pracowników wychodzą
// zawsze z jednej, głównej tożsamości SMTP, więc klient odpisujący na naszą wiadomość
// i tak trafia do głównej skrzynki, nie do skrzynki kanału, z którego przyszło pierwsze
// zgłoszenie. Filtrowanie po kanale tutaj sprawiłoby, że taka odpowiedź nigdy nie
// znalazłaby swojego ticketu (kanal_id się nie zgadza) i tworzyłaby duplikat.
async function findTicketBySenderAndSubject(from, subject) {
  const email = extractEmailAddress(from);
  if (!email || !email.includes('@')) return null;

  const normIncoming = normalizeSubjectForMatch(subject);
  if (!normIncoming) return null;

  const cutoff = Math.floor(Date.now() / 1000) - 90 * 24 * 3600;
  const [candidates] = await pool.query(
    `SELECT id, message_subject FROM ticket
     WHERE message_from LIKE ? AND data_utworzenia >= ?
     ORDER BY data_utworzenia DESC
     LIMIT 25`,
    [`%${email}%`, cutoff]
  );

  for (const c of candidates) {
    const normTicket = normalizeSubjectForMatch(c.message_subject);
    if (normTicket.length >= 4 && (normIncoming.includes(normTicket) || normTicket.includes(normIncoming))) {
      return c.id;
    }
  }
  return null;
}

// ─── Wspólna logika przetwarzania pojedynczej wiadomości ─────────────────────
// channel (opcjonalnie) = { id, zespolId } gdy wiadomość przyszła ze skrzynki kanału
// e-mail (kanal_czatu.typ='email'), null dla głównej skrzynki z ustawienia.
async function processEmailItem({ from, to, subject, text, html, messageId, inReplyTo, references, attachments }, settings, channel = null) {
  let ticketId = null;
  let isForwardReply = false;

  if (inReplyTo || references.length) {
    const ids = [inReplyTo, ...references].filter(Boolean).map(id => id.replace(/[<>]/g, ''));

    for (const refId of ids) {
      const [rows] = await pool.query('SELECT id FROM ticket WHERE message_id = ?', [refId]);
      if (rows.length) { ticketId = rows[0].id; break; }
    }

    if (!ticketId) {
      for (const refId of ids) {
        const [rows] = await pool.query(
          'SELECT ticket_id, typ FROM korespondencja WHERE message_id = ?', [refId]
        );
        if (rows.length) {
          ticketId = rows[0].ticket_id;
          isForwardReply = rows[0].typ === 'forward';
          break;
        }
      }
    }
  }

  if (!ticketId) {
    const nrMatch = subject.match(/\b(\d{6})\b/);
    if (nrMatch) {
      const [[row]] = await pool.query('SELECT id FROM ticket WHERE numer = ?', [nrMatch[1]]);
      if (row) ticketId = row.id;
    }
  }

  if (!ticketId) {
    ticketId = await findTicketBySenderAndSubject(from, subject);
    if (ticketId) {
      console.log(`[IMAP] Dopasowano przez nadawcę+temat (fallback) → ticket #${ticketId}`);
    }
  }

  const now = Math.floor(Date.now() / 1000);

  const saveText = settings?.strip_quoted_reply ? stripQuotedText(text) : text;
  const saveHtml = settings?.strip_quoted_reply ? stripQuotedHtml(html) : html;

  if (ticketId) {
    const incomingMsgId = messageId ? messageId.replace(/[<>]/g, '') : null;

    const [kResult] = await pool.query(
      `INSERT INTO korespondencja
        (ticket_id, data, created_by, updated_by, created_at, updated_at,
         tresc, html, message_to, message_cc, message_subject, message_from, message_id, typ)
       VALUES (?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ticketId, now, now, now, saveText, saveHtml || null, to, '', subject, from,
       incomingMsgId, isForwardReply ? 'forward_reply' : 'received']
    );
    const cidMapK = await saveEmailAttachments(attachments, 2, kResult.insertId);
    if (saveHtml && Object.keys(cidMapK).length) {
      await pool.query('UPDATE korespondencja SET html = ? WHERE id = ?',
        [replaceCidReferences(saveHtml, cidMapK), kResult.insertId]);
    }
    await pool.query('UPDATE ticket SET podswietl = 1 WHERE id = ?', [ticketId]);

    const [reopen] = await pool.query(
      'UPDATE ticket SET status = 1, data_zamkniecia = NULL WHERE id = ? AND status = 3',
      [ticketId]
    );
    if (reopen.affectedRows) {
      console.log(`[IMAP] Ticket #${ticketId} był zamknięty — otworzono ponownie po otrzymaniu wiadomości`);
    }

    if (isForwardReply) {
      try {
        const { sendReply } = require('./mailer');
        const [[ticket]] = await pool.query(
          'SELECT message_from, message_subject, numer FROM ticket WHERE id = ?', [ticketId]
        );
        if (ticket?.message_from) {
          const replySubject = subject.startsWith('Re:') ? subject : `Re: ${ticket.message_subject}`;
          await sendReply({ to: ticket.message_from, subject: replySubject, html: html || null, tresc: text });
          console.log(`[IMAP] Przekazano odpowiedź do nadawcy zgłoszenia: ${ticket.message_from}`);
        }
      } catch (fwdErr) {
        console.error('[IMAP] Błąd przekazania odpowiedzi do nadawcy:', fwdErr.message);
      }
    }

    console.log(`[IMAP] Dodano odpowiedź do ticketu #${ticketId}${isForwardReply ? ' (forward_reply)' : ''}`);

    const [[ticketRow]] = await pool.query('SELECT numer, message_subject, status, zrodlo, kanal_id FROM ticket WHERE id = ?', [ticketId]);
    // Tickety z kanału e-mail (przypisane do zespołu) są obsługiwane wyłącznie ręcznie przez
    // pracowników — webhook n8n (i jego automatyczne odpowiedzi) celowo ich nie dotyczy.
    if (!ticketRow?.kanal_id) {
      sendWebhookEvent('ticket.message.received', {
        ticket: { id: ticketId, numer: ticketRow?.numer, subject: ticketRow?.message_subject, from, status: ticketRow?.status, zrodlo: ticketRow?.zrodlo },
        message: { tresc: saveText, html: saveHtml || null, from },
      }).catch(() => {});
    }
  } else {
    const numer = Math.random().toString().slice(2, 8);
    const [result] = await pool.query(
      `INSERT INTO ticket
        (numer, message_from, message_to, message_subject, tresc, html, message_cc, status, data_utworzenia, odlozony, podswietl, message_id, zrodlo, kanal_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 0, 1, ?, 'email', ?)`,
      [numer, from, to, subject, saveText, saveHtml || null, '', now, messageId.replace(/[<>]/g, ''), channel?.id || null]
    );
    const cidMapT = await saveEmailAttachments(attachments, 1, result.insertId);
    if (saveHtml && Object.keys(cidMapT).length) {
      await pool.query('UPDATE ticket SET html = ? WHERE id = ?',
        [replaceCidReferences(saveHtml, cidMapT), result.insertId]);
    }

    // Status zostaje 1 (nowy) niezależnie od kanału — w przeciwieństwie do czatu/Messengera,
    // e-mail jest async i musi przejść tę samą kolejkę nowy→przydzielony→zamknięty, inaczej
    // liczniki "nowe"/"w toku" (statystyki.js, alerts.js) zostałyby zafałszowane.
    if (channel?.zespolId) {
      await pool.query(
        'INSERT INTO zespol_has_ticket (zespol_id, ticket_id, created_at) VALUES (?, ?, ?)',
        [channel.zespolId, result.insertId, now]
      );
    }

    const { notifyAllAdmins, notifyUsers } = require('./webpush');
    const { classifyAndSave } = require('./groqClassifier');
    const { lookupEmail } = require('./ldap');
    const { notifyAdminsNewTicket, sendTicketRegisteredEmail } = require('./mailer');

    if (channel?.zespolId) {
      const [members] = await pool.query('SELECT user_id FROM zespol_user WHERE zespol_id = ?', [channel.zespolId]);
      notifyUsers(members.map((m) => m.user_id), {
        title: 'Nowe zgłoszenie e-mail',
        body: `Od: ${from} | Temat: ${subject}`,
        url: `/tickets/${result.insertId}`,
      }).catch(() => {});
    } else {
      notifyAllAdmins({
        title: 'Nowe zgłoszenie',
        body: `Od: ${from} | Temat: ${subject}`,
        url: `/tickets/${result.insertId}`,
      }).catch(() => {});
    }

    // notifyAdminsNewTicket: siatka bezpieczeństwa "nikt nie czyta push" (sprawdza globalnie
    // czy jakikolwiek admin jest online, nie per zespół) — celowo zostaje bez zmian dla obu
    // ścieżek, to nie jest główny mechanizm powiadomień.
    notifyAdminsNewTicket({
      ticketId: result.insertId,
      numer,
      from,
      subject,
      source: 'email',
    }).catch(() => {});

    classifyAndSave(result.insertId, { subject, body: text, from }).catch(() => {});

    sendTicketRegisteredEmail({ numer, from, subject }).catch(() => {});

    const { sendWeekendAutoReply } = require('./weekendAutoReply');
    sendWeekendAutoReply(pool, result.insertId, { email: from, numer, subject }).catch(() => {});

    lookupEmail(from).then(ldap => {
      if (ldap) {
        pool.query(
          'UPDATE ticket SET ldap_name=?, ldap_ou=?, ldap_num=?, ldap_data=? WHERE id=?',
          [ldap.name, ldap.ou, ldap.num, JSON.stringify(ldap.extra || {}), result.insertId]
        ).catch(() => {});
      }
    }).catch(() => {});

    // Tickety z kanału e-mail (przypisane do zespołu) są obsługiwane wyłącznie ręcznie przez
    // pracowników — webhook n8n (i jego automatyczne odpowiedzi) celowo ich nie dotyczy.
    if (!channel?.id) {
      sendWebhookEvent('ticket.created', {
        ticket: { id: result.insertId, numer, subject, from, priority: null, status: 1, zrodlo: 'email' },
        message: { tresc: saveText, html: saveHtml || null, from },
      }).catch(() => {});
    }

    console.log(`[IMAP] Nowy ticket #${result.insertId} (${numer}) od ${from}`);
  }
}

// ─── Przetwarzanie surowych emaili (IMAP) ────────────────────────────────────
async function processEmails(emails, settings, channel = null) {
  for (const raw of emails) {
    try {
      const parsed = await simpleParser(raw);

      const fromText = parsed.from?.text || '';
      const subjectText = parsed.subject || '(brak tematu)';

      if (isNDR(fromText, subjectText)) {
        await processNDR({
          from: fromText,
          subject: subjectText,
          text: parsed.text || '',
          inReplyTo: parsed.inReplyTo || '',
          references: parsed.references || [],
        });
      } else {
        await processEmailItem({
          from: fromText,
          to: parsed.to?.text || settings.senderEmail || '',
          subject: subjectText,
          text: parsed.text || '',
          html: parsed.html || '',
          messageId: parsed.messageId || '',
          inReplyTo: parsed.inReplyTo || '',
          references: parsed.references || [],
          attachments: parsed.attachments || [],
        }, settings, channel);
      }
    } catch (e) {
      console.error('[IMAP] Błąd przetwarzania wiadomości:', e.message);
    }
  }
}

// ─── Przetwarzanie wiadomości z Microsoft Graph ───────────────────────────────
async function processGraphMessages(messages, settings, channel = null) {
  for (const msg of messages) {
    try {
      const fromAddr = msg.from?.emailAddress
        ? `${msg.from.emailAddress.name || ''} <${msg.from.emailAddress.address}>`.trim()
        : '';
      const toAddr = (msg.toRecipients?.[0]?.emailAddress?.address) || settings.ms_graph_mailbox || '';
      const subject = msg.subject || '(brak tematu)';
      const messageId = msg.internetMessageId || `<graph-${msg.id}>`;

      const headers = msg.internetMessageHeaders || [];
      const inReplyTo = headers.find(h => h.name.toLowerCase() === 'in-reply-to')?.value || '';
      const refsHeader = headers.find(h => h.name.toLowerCase() === 'references')?.value || '';
      const references = refsHeader ? refsHeader.split(/\s+/).filter(Boolean) : [];

      const isHtml = msg.body?.contentType?.toLowerCase() === 'html';
      const bodyContent = msg.body?.content || '';

      // Pobierz załączniki jeśli są
      let attachments = [];
      try {
        const rawAtts = await msGraph.getAttachments(settings, msg.id);
        attachments = rawAtts
          .filter(a => a['@odata.type'] === '#microsoft.graph.fileAttachment')
          .map(a => ({
            filename: a.name,
            content: Buffer.from(a.contentBytes, 'base64'),
            contentType: a.contentType,
            contentId: a.contentId || null,
          }));
      } catch {}

      // Oznacz jako przeczytane / usuń przed przetworzeniem (żeby uniknąć duplikatów przy błędzie)
      if (settings.clean_mailbox) {
        await msGraph.deleteMessage(settings, msg.id).catch(() => {});
      } else {
        await msGraph.markAsRead(settings, msg.id).catch(() => {});
      }

      if (isNDR(fromAddr, subject)) {
        await processNDR({
          from: fromAddr,
          subject,
          text: isHtml ? '' : bodyContent,
          inReplyTo,
          references,
        });
      } else {
        await processEmailItem({
          from: fromAddr,
          to: toAddr,
          subject,
          text: isHtml ? '' : bodyContent,
          html: isHtml ? bodyContent : '',
          messageId,
          inReplyTo,
          references,
          attachments,
        }, settings, channel);
      }
    } catch (e) {
      console.error('[Graph] Błąd przetwarzania wiadomości:', e.message);
    }
  }
}

// ─── IMAP fetch ───────────────────────────────────────────────────────────────
function fetchUnseen(settings) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: settings.imapLogin,
      password: settings.imapPassword,
      host: settings.imapServer,
      port: settings.imapPort || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
      connTimeout: 15000,
    });

    const emails = [];

    imap.once('ready', () => {
      imap.openBox(settings.imapPath || 'INBOX', false, (err) => {
        if (err) { imap.end(); return reject(err); }

        imap.search(['UNSEEN'], (err, uids) => {
          if (err) { imap.end(); return reject(err); }
          if (!uids.length) { imap.end(); return resolve([]); }

          const fetch = imap.fetch(uids, { bodies: '', markSeen: true });

          fetch.on('message', (msg) => {
            let raw = '';
            msg.on('body', (stream) => {
              stream.on('data', (chunk) => { raw += chunk.toString(); });
            });
            msg.once('end', () => { emails.push(raw); });
          });

          fetch.once('error', (e) => { imap.end(); reject(e); });
          fetch.once('end', () => {
            if (settings.clean_mailbox) {
              imap.addFlags(uids, '\\Deleted', (err) => {
                if (err) console.warn('[IMAP] Błąd oznaczania do usunięcia:', err.message);
                imap.expunge((err) => {
                  if (err) console.warn('[IMAP] Błąd expunge:', err.message);
                  else console.log(`[IMAP] Usunięto ${uids.length} wiadomości ze skrzynki`);
                  imap.end();
                });
              });
            } else {
              imap.end();
            }
          });
        });
      });
    });

    imap.once('end', () => resolve(emails));
    imap.once('error', reject);
    imap.connect();
  });
}

// ─── Czyszczenie starych wiadomości (IMAP) ────────────────────────────────────
function cleanOldImapMessages(settings, days) {
  return new Promise((resolve) => {
    const imap = new Imap({
      user: settings.imapLogin,
      password: settings.imapPassword,
      host: settings.imapServer,
      port: settings.imapPort || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
      connTimeout: 15000,
    });

    imap.once('ready', () => {
      imap.openBox(settings.imapPath || 'INBOX', false, (err) => {
        if (err) { imap.end(); return resolve(); }

        const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const imapDate = `${String(cutoff.getDate()).padStart(2,'0')}-${months[cutoff.getMonth()]}-${cutoff.getFullYear()}`;

        imap.search([['BEFORE', imapDate]], (err, uids) => {
          if (err || !uids.length) { imap.end(); return resolve(); }

          imap.addFlags(uids, '\\Deleted', (err) => {
            if (err) { imap.end(); return resolve(); }
            imap.expunge((err) => {
              if (!err) console.log(`[IMAP] Usunięto ${uids.length} wiadomości starszych niż ${days} dni`);
              imap.end();
              resolve();
            });
          });
        });
      });
    });

    imap.once('error', () => resolve());
    imap.once('end', () => resolve());
    imap.connect();
  });
}

// ─── Czyszczenie starych wiadomości (Graph) ───────────────────────────────────
async function cleanOldGraphMessages(settings, days) {
  try {
    const messages = await msGraph.getOldMessages(settings, days);
    if (!messages.length) return;
    for (const msg of messages) {
      await msGraph.deleteMessage(settings, msg.id).catch(() => {});
    }
    console.log(`[Graph] Usunięto ${messages.length} wiadomości starszych niż ${days} dni`);
  } catch (e) {
    console.warn('[Graph] Błąd czyszczenia starych wiadomości:', e.message);
  }
}

// ─── Dodatkowe skrzynki e-mail przypisane do zespołu (kanal_czatu.typ='email') ─
// Każdy kanał ma własne dane IMAP i jest odpytywany niezależnie od głównej skrzynki;
// błąd jednego kanału (np. złe dane logowania) nie przerywa innych ani głównej skrzynki.
async function pollEmailChannels(globalSettings) {
  const [channels] = await pool.query(
    `SELECT id, zespol_id, imap_server, imap_port, imap_login, imap_password, imap_path,
            ms_graph_enabled, ms_graph_mailbox
     FROM kanal_czatu WHERE typ = 'email' AND aktywny = 1`
  );
  for (const ch of channels) {
    const channel = { id: ch.id, zespolId: ch.zespol_id };

    if (ch.ms_graph_enabled) {
      // Skrzynka Microsoft 365 — używa współdzielonej aplikacji Azure skonfigurowanej
      // w Ustawieniach (ms_graph_client_id/secret/tenant_id), tylko inna skrzynka docelowa.
      if (!globalSettings?.ms_graph_client_id || !ch.ms_graph_mailbox) {
        console.error(`[Graph] Kanał e-mail #${ch.id}: brak konfiguracji Microsoft Graph (aplikacja w Ustawieniach lub adres skrzynki) — pomijam`);
        continue;
      }
      const channelSettings = {
        ms_graph_client_id: globalSettings.ms_graph_client_id,
        ms_graph_client_secret: globalSettings.ms_graph_client_secret,
        ms_graph_tenant_id: globalSettings.ms_graph_tenant_id,
        ms_graph_mailbox: ch.ms_graph_mailbox,
        senderEmail: ch.ms_graph_mailbox,
        strip_quoted_reply: globalSettings?.strip_quoted_reply,
      };
      try {
        const messages = await msGraph.getUnreadMessages(channelSettings);
        if (messages.length) {
          console.log(`[Graph] Kanał e-mail #${ch.id}: pobrano ${messages.length} nowych wiadomości`);
          await processGraphMessages(messages, channelSettings, channel);
        }
      } catch (e) {
        console.error(`[Graph] Kanał e-mail #${ch.id}: błąd połączenia:`, e.message);
      }
      continue;
    }

    if (!ch.imap_server || !ch.imap_login) continue;
    const channelSettings = {
      imapServer: ch.imap_server,
      imapPort: ch.imap_port,
      imapLogin: ch.imap_login,
      imapPassword: ch.imap_password,
      imapPath: ch.imap_path,
      senderEmail: ch.imap_login,
      strip_quoted_reply: globalSettings?.strip_quoted_reply,
    };
    try {
      const emails = await fetchUnseen(channelSettings);
      if (emails.length) {
        console.log(`[IMAP] Kanał e-mail #${ch.id}: pobrano ${emails.length} nowych wiadomości`);
        await processEmails(emails, channelSettings, channel);
      }
    } catch (e) {
      console.error(`[IMAP] Kanał e-mail #${ch.id}: błąd połączenia:`, e.message);
    }
  }
}

// ─── Główna funkcja poll ──────────────────────────────────────────────────────
async function poll() {
  let settings;
  try {
    settings = await getSettings();
    if (settings?.email_receive) {
      if (settings.ms_graph_enabled) {
        // Microsoft Graph
        const messages = await msGraph.getUnreadMessages(settings);
        if (messages.length) {
          console.log(`[Graph] Pobrano ${messages.length} nowych wiadomości`);
          await processGraphMessages(messages, settings);
        }
        if (settings.clean_mailbox_days > 0) {
          await cleanOldGraphMessages(settings, settings.clean_mailbox_days);
        }
      } else {
        // Tradycyjny IMAP
        const emails = await fetchUnseen(settings);
        if (emails.length) {
          console.log(`[IMAP] Pobrano ${emails.length} nowych wiadomości`);
          await processEmails(emails, settings);
        }
        if (settings.clean_mailbox_days > 0) {
          await cleanOldImapMessages(settings, settings.clean_mailbox_days);
        }
      }
    }
  } catch (e) {
    console.error('[IMAP] Błąd połączenia:', e.message);
  }

  await pollEmailChannels(settings).catch((e) => console.error('[IMAP] Błąd kanałów e-mail:', e.message));
}

function start(intervalMs = 60000) {
  if (timer) return;
  poll();
  timer = setInterval(poll, intervalMs);
  console.log(`[IMAP] Poller uruchomiony (interwał: ${intervalMs / 1000}s)`);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { start, stop, poll };
