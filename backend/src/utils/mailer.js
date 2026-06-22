const nodemailer = require('nodemailer');
const crypto = require('crypto');
const pool = require('../config/db');
const msGraph = require('./msGraphClient');
const { getSiteUrl } = require('./siteUrl');
const { t, resolveLang, getAppLang } = require('../i18n/index');

async function getSettings() {
  const [[s]] = await pool.query('SELECT * FROM ustawienia WHERE id = 1');
  return s;
}

async function getTransport(settings) {
  if (!settings.host) throw new Error('Brak skonfigurowanego serwera SMTP');
  if (!settings.username) throw new Error('Brak loginu SMTP');
  if (!settings.password) throw new Error('Brak hasła SMTP — zapisz ustawienia ponownie');

  return nodemailer.createTransport({
    host: settings.host,
    port: parseInt(settings.port) || 587,
    secure: settings.encryption === 'ssl',
    auth: { user: settings.username, pass: settings.password },
    tls: { rejectUnauthorized: false },
  });
}

// ─── Formalny szablon HTML ────────────────────────────────────────────────────
function formalTemplate({ greeting, content, senderName, stopka, appName, replyLine = false, lang = 'pl' }) {
  if (!greeting) greeting = lang === 'en' ? 'Dear Sir/Madam,' : 'Szanowni Państwo,';
  const stopkaHtml = stopka
    ? `<div style="margin-top:4px;font-size:12px;color:#6b7280;white-space:pre-line">${stopka}</div>`
    : '';

  // Separator "odpowiadaj powyżej" — pojawia się poniżej całego boxa emaila,
  // w szarym tle, poza białą kartą. Komentarz HTML <!-- helpdesk-separator -->
  // służy jako niezawodny marker do przycinania historii cytowanej w odpowiedziach.
  const replyLineHtml = replyLine ? `
    <!-- helpdesk-separator -->
    <tr>
      <td align="center" style="padding:18px 16px 0">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
          <tr>
            <td style="border-top:2px dashed #9ca3af;padding-top:10px;text-align:center">
              <span style="color:#6b7280;font-size:11px;font-weight:600;letter-spacing:0.04em;white-space:nowrap">
                &#x2015;&#x2015; PROSIMY ODPOWIADAĆ POWYŻEJ TEJ LINII &#x2015;&#x2015;
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : '';

  return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">

        <!-- Nagłówek -->
        <tr>
          <td style="background:#1e40af;padding:20px 28px">
            <span style="color:#ffffff;font-size:18px;font-weight:700">${appName || 'Helpdesk'}</span>
          </td>
        </tr>

        <!-- Treść -->
        <tr>
          <td style="padding:28px 28px 0">
            <p style="margin:0 0 16px;color:#111827;font-size:15px">${greeting}</p>
            <div style="color:#374151;font-size:14px;line-height:1.6">
              ${content}
            </div>
          </td>
        </tr>

        <!-- Podpis -->
        <tr>
          <td style="padding:24px 28px 28px">
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px">
            <p style="margin:0;color:#374151;font-size:14px;line-height:1.6">
              ${lang === 'en' ? 'Kind regards,' : 'Z poważaniem,'}<br>
              <strong>${senderName || 'Helpdesk'}</strong>
            </p>
            ${stopkaHtml}
          </td>
        </tr>

        <!-- Stopka -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:12px 28px;text-align:center">
            <span style="color:#9ca3af;font-size:11px">${appName || 'Helpdesk'} &mdash; ${lang === 'en' ? 'automated message' : 'wiadomość generowana automatycznie'}</span>
          </td>
        </tr>

      </table>
    </td></tr>

    ${replyLineHtml}

  </table>
</body>
</html>`;
}

// ─── sendReply — odpowiedź na ticket ─────────────────────────────────────────
async function sendReply({ to, cc, subject, html, tresc, attachments }) {
  const settings = await getSettings();
  if (!settings) throw new Error('Brak ustawień poczty');

  const bodyContent = html
    ? html
    : `<p style="white-space:pre-wrap">${(tresc || '').replace(/</g, '&lt;')}</p>`;

  const body = formalTemplate({
    content: bodyContent,
    senderName: settings.senderName,
    stopka: settings.email_stopka,
    appName: settings.app_name,
    replyLine: true,
  });

  // Dodaj separator do wersji tekstowej
  const textWithSeparator = tresc
    ? `${tresc}\n\n${'─'.repeat(52)}\nPROSIMY ODPOWIADAĆ POWYŻEJ TEJ LINII\n${'─'.repeat(52)}`
    : tresc;

  if (settings.ms_graph_enabled) {
    await msGraph.sendMail(settings, { to, cc, subject, html: body, text: textWithSeparator, attachments });
    return;
  }

  const transport = await getTransport(settings);
  const from = `"${settings.senderName}" <${settings.senderEmail}>`;
  console.log(`[Mailer] sendReply from=${from} to=${to} subject="${subject}"`);

  const info = await transport.sendMail({
    from,
    replyTo: settings.senderEmail,
    to,
    cc: cc || undefined,
    subject,
    html: body,
    text: textWithSeparator || '',
    attachments: attachments || [],
  });

  console.log(`[Mailer] Accepted: ${info.accepted?.join(', ')} | Rejected: ${info.rejected?.join(', ') || 'brak'} | MsgId: ${info.messageId}`);

  if (info.rejected?.length) {
    throw new Error(`SMTP odrzucił adresatów: ${info.rejected.join(', ')}`);
  }

  return info.messageId ? info.messageId.replace(/[<>]/g, '') : null;
}

// ─── sendNotification — powiadomienie systemowe ───────────────────────────────
async function sendNotification({ to, subject, html, greeting, lang = 'pl' }) {
  const settings = await getSettings();
  if (!settings) throw new Error('Brak ustawień poczty');

  const body = formalTemplate({
    greeting,
    content: html,
    senderName: settings.senderName,
    stopka: settings.email_stopka,
    appName: settings.app_name,
    replyLine: true,
    lang,
  });

  if (settings.ms_graph_enabled) {
    await msGraph.sendMail(settings, { to, subject, html: body });
    console.log(`[Graph] sendNotification to=${to} subject="${subject}"`);
    return;
  }

  const transport = await getTransport(settings);
  await transport.sendMail({
    from: `"${settings.senderName}" <${settings.senderEmail}>`,
    replyTo: settings.senderEmail,
    to,
    subject,
    html: body,
  });

  console.log(`[Mailer] sendNotification to=${to} subject="${subject}"`);
}

// ─── sendForward — przekazanie ticketu ───────────────────────────────────────
async function sendForward({ to, ticketNumer, ticketSubject, ticketFrom, ticketDate, ticketTresc, ticketHtml, wiadomoscOd, inReplyTo }) {
  const settings = await getSettings();
  if (!settings) throw new Error('Brak ustawień poczty');

  const msgId = `fwd-${crypto.randomBytes(14).toString('hex')}@helpdesk`;

  const noteHtml = wiadomoscOd
    ? `<div style="margin-bottom:16px;padding:12px 16px;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 6px 6px 0">
         <p style="margin:0;font-size:14px;color:#1e40af;white-space:pre-wrap">${wiadomoscOd.replace(/</g, '&lt;')}</p>
       </div>`
    : '';

  const originalContent = ticketHtml
    ? ticketHtml
    : `<p style="white-space:pre-wrap;font-size:13px">${(ticketTresc || '').replace(/</g, '&lt;')}</p>`;

  const content = `
    <p>Zostało do Państwa przekazane zgłoszenie z systemu helpdesk. Uprzejmie prosimy o zapoznanie się z jego treścią i udzielenie odpowiedzi.</p>

    ${noteHtml}

    <div style="background:#fefce8;border:1px solid #fbbf24;border-radius:6px;padding:12px 16px;margin:16px 0;font-size:13px;color:#92400e">
      <strong>Ważna informacja:</strong> Prosimy o odpowiedź bezpośrednio na tę wiadomość —
      Państwa odpowiedź zostanie automatycznie zapisana w zgłoszeniu oraz przesłana do osoby zgłaszającej.
      Uprzejmie prosimy o niezmenianie tematu wiadomości przy odpowiedzi.
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
      <tr style="background:#f9fafb">
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;width:140px;color:#374151">Numer zgłoszenia</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">#${ticketNumer}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#374151">Zgłaszający</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">${ticketFrom}</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#374151">Temat</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">${ticketSubject}</td>
      </tr>
      ${ticketDate ? `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#374151">Data zgłoszenia</td><td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">${ticketDate}</td></tr>` : ''}
    </table>

    <p style="font-weight:600;color:#374151;margin:16px 0 8px">Treść zgłoszenia:</p>
    <div style="border-left:3px solid #d1d5db;padding-left:12px;color:#374151">
      ${originalContent}
    </div>
  `;

  const emailSubject = `[FWD #${ticketNumer}] ${ticketSubject}`;

  const body = formalTemplate({
    content,
    senderName: settings.senderName,
    stopka: settings.email_stopka,
    appName: settings.app_name,
  });

  if (settings.ms_graph_enabled) {
    await msGraph.sendMail(settings, { to, subject: emailSubject, html: body });
    console.log(`[Graph] sendForward to=${to} subject="${emailSubject}" msgId=${msgId}`);
    return msgId;
  }

  const transport = await getTransport(settings);
  await transport.sendMail({
    from: `"${settings.senderName}" <${settings.senderEmail}>`,
    replyTo: settings.senderEmail,
    to,
    subject: emailSubject,
    html: body,
    messageId: `<${msgId}>`,
    ...(inReplyTo ? { inReplyTo: `<${inReplyTo}>`, references: `<${inReplyTo}>` } : {}),
  });

  console.log(`[Mailer] sendForward to=${to} subject="${emailSubject}" msgId=${msgId}`);
  return msgId;
}

// ─── notifyAdminsNewTicket — email do adminów o nowym zgłoszeniu ──────────────
async function notifyAdminsNewTicket({ ticketId, numer, from, subject, source }) {
  try {
    const ONLINE_THRESHOLD = 3 * 60;
    const now = Math.floor(Date.now() / 1000);
    try {
      const [online] = await pool.query(
        `SELECT 1 FROM user_presence up
         JOIN auth_assignment aa ON aa.user_id = up.user_id
         WHERE aa.item_name = 'admin' AND up.last_seen_at > ?
         LIMIT 1`,
        [now - ONLINE_THRESHOLD]
      );
      if (online.length > 0) return;
    } catch {}

    const [admins] = await pool.query(
      `SELECT u.email, u.imie FROM user u
       INNER JOIN auth_assignment aa ON aa.user_id = u.id
       WHERE aa.item_name = 'admin' AND u.status = 10 AND u.email IS NOT NULL AND u.email != ''`
    );
    if (!admins.length) return;

    const baseUrl = await getSiteUrl();
    const link = `${baseUrl}/tickets/${ticketId}`;
    const sourceLabel = source === 'web_form' ? 'formularz WWW' : 'email';
    const displaySubject = (subject || '(brak tematu)').replace(/</g, '&lt;');
    const displayFrom = (from || '').replace(/</g, '&lt;');

    const appName = await getAppName();
    for (const admin of admins) {
      const lang = await resolveLang(pool, admin.id);
      const sourceKey = source === 'web_form' ? 'source_web_form' : 'source_email';
      const srcLabel = t(lang, sourceKey);
      const greeting = admin.imie
        ? t(lang, 'greeting_day_with_name', { name: admin.imie })
        : t(lang, 'greeting_formal');
      sendNotification({
        to: admin.email,
        subject: t(lang, 'subject_new_ticket', { appName, numer }),
        greeting,
        lang,
        html: `
          <p>${t(lang, 'new_ticket_intro', { source: srcLabel })}</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
            <tr style="background:#f9fafb">
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;width:140px;color:#374151">${t(lang, 'col_ticket_no')}</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">#${numer}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#374151">${t(lang, 'col_from')}</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">${displayFrom}</td>
            </tr>
            <tr style="background:#f9fafb">
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#374151">${t(lang, 'col_subject')}</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">${displaySubject}</td>
            </tr>
          </table>
          <p style="margin-top:16px">
            <a href="${link}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">
              ${t(lang, 'btn_view_ticket')}
            </a>
          </p>
        `,
      }).catch(e => console.warn(`[notifyAdmins] email do ${admin.email} nie wysłany:`, e.message));
    }
  } catch (e) {
    console.warn('[notifyAdminsNewTicket]', e.message);
  }
}

// ─── sendSurvey — ankieta satysfakcji (CSAT) po zamknięciu zgłoszenia ────────
async function sendSurvey({ to, surveyLink, ticketNumer, lang = 'pl' }) {
  const appName = await getAppName();

  await sendNotification({
    to,
    subject: t(lang, 'subject_satisfaction_survey', { appName, numer: ticketNumer }),
    greeting: t(lang, 'greeting_formal'),
    lang,
    html: `
      <p>${t(lang, 'survey_intro', { numer: ticketNumer })}</p>
      <p style="margin-top:16px">
        <a href="${surveyLink}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">
          ${t(lang, 'btn_rate_survey')}
        </a>
      </p>
    `,
  });

  console.log(`[Mailer] sendSurvey to=${to} numer=${ticketNumer}`);
}

// Eksportujemy też getSenderInfo dla kompatybilności z imapPoller
async function getSenderInfo() {
  const [[settings]] = await pool.query(
    'SELECT senderEmail, senderName, email_stopka, app_name FROM ustawienia WHERE id = 1'
  );
  return settings || { senderEmail: '', senderName: 'Helpdesk', email_stopka: '', app_name: 'Helpdesk' };
}

async function getAppName() {
  try {
    const [[row]] = await pool.query('SELECT app_name FROM ustawienia WHERE id = 1');
    return row?.app_name || 'Helpdesk';
  } catch {
    return 'Helpdesk';
  }
}

// ─── sendTicketRegisteredEmail — potwierdzenie zarejestrowania ticketu ────────
async function sendTicketRegisteredEmail({ numer, from, subject, kategoriaNazwa }) {
  try {
    if (!from) return;
    const [[settings]] = await pool.query(
      'SELECT powiadom_rejestracja FROM ustawienia WHERE id = 1'
    );
    if (!settings?.powiadom_rejestracja) return;

    const lang = await getAppLang(pool);
    const appName = await getAppName();
    const displaySubject = (subject || t(lang, 'no_subject')).replace(/</g, '&lt;');

    const categoryRow = kategoriaNazwa
      ? `<tr style="background:#f9fafb">
           <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;width:160px;color:#374151">${t(lang, 'ticket_received_col_category')}</td>
           <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">${kategoriaNazwa.replace(/</g, '&lt;')}</td>
         </tr>`
      : '';

    await sendNotification({
      to: from,
      subject: t(lang, 'subject_ticket_received', { numer }),
      greeting: t(lang, 'greeting_formal'),
      lang,
      html: `
        <p>${t(lang, 'ticket_received_intro')}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
          <tr>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;width:160px;color:#374151">${t(lang, 'ticket_received_col_number')}</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827;font-weight:700">#${numer}</td>
          </tr>
          ${categoryRow}
          <tr ${kategoriaNazwa ? '' : 'style="background:#f9fafb"'}>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#374151">${t(lang, 'ticket_received_col_content')}</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">${displaySubject}</td>
          </tr>
        </table>
        <p>${t(lang, 'ticket_received_footer')}</p>
        <p style="font-size:12px;color:#6b7280">${t(lang, 'ticket_received_note')}</p>
      `,
    });

    console.log(`[Mailer] sendTicketRegisteredEmail to=${from} numer=${numer}`);
  } catch (e) {
    console.warn('[sendTicketRegisteredEmail]', e.message);
  }
}

module.exports = { sendReply, sendNotification, sendForward, formalTemplate, getSenderInfo, getAppName, notifyAdminsNewTicket, sendTicketRegisteredEmail, sendSurvey };
