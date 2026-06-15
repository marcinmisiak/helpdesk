'use strict';

const pool = require('../config/db');
const { sendNotification } = require('./mailer');
const { getSiteUrl } = require('./siteUrl');
const { t: tr, resolveLang, getAppLang } = require('../i18n/index');

let timer = null;

async function getSettings() {
  const [[s]] = await pool.query('SELECT * FROM ustawienia WHERE id = 1');
  return s;
}

let _siteUrl = null;
async function siteUrl() {
  if (!_siteUrl) _siteUrl = await getSiteUrl();
  return _siteUrl;
}

function pluralUnit(lang, count, base) {
  if (count === 1) return tr(lang, `${base}_unit_1`);
  if (lang === 'pl' && count >= 2 && count <= 4) return tr(lang, `${base}_unit_234`);
  return tr(lang, `${base}_unit_many`);
}

function countVerb(lang, count) {
  return lang === 'en' ? (count === 1 ? 'is' : 'are') : '';
}

function ticketTableHtml(tickets, baseUrl, lang) {
  const rows = tickets.map(t => {
    const subject = (t.message_subject || tr(lang, 'no_subject')).replace(/</g, '&lt;');
    const age = t.age_hours != null ? `${Math.round(t.age_hours)} h` : '';
    const link = `<a href="${baseUrl}/tickets/${t.id}" style="color:#1d4ed8;text-decoration:none;font-weight:600">#${t.numer}</a>`;
    return `
      <tr>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">${link}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#374151">${subject}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#6b7280;white-space:nowrap">${age}</td>
      </tr>`;
  }).join('');

  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;color:#374151;width:90px">${tr(lang, 'col_ticket_no')}</th>
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;color:#374151">${tr(lang, 'col_subject')}</th>
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;color:#374151;width:90px">${tr(lang, 'col_waiting')}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function sendUnassignedReminder(worker, tickets, baseUrl, appName) {
  const lang = await resolveLang(pool, worker.id);
  const count = tickets.length;
  const hours = tickets[0]?.delay_hours || 24;
  const unit = pluralUnit(lang, count, 'unassigned');

  const subject = count === 1
    ? tr(lang, 'subject_unassigned_single', { appName, count })
    : tr(lang, 'subject_unassigned_plural', { appName, count });

  const greeting = worker.imie
    ? tr(lang, 'greeting_day_with_name', { name: worker.imie })
    : tr(lang, 'greeting_day', { name: '' });

  const html = `
    <p>${tr(lang, 'unassigned_intro', { count, unit, hours, count_verb: countVerb(lang, count) })}</p>
    ${ticketTableHtml(tickets, baseUrl, lang)}
    <p style="margin-top:16px">
      <a href="${baseUrl}/tickets" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">
        ${tr(lang, 'btn_view_tickets')}
      </a>
    </p>`;

  await sendNotification({ to: worker.email, subject, html, greeting, lang });
}

async function sendPendingReminder(worker, tickets, baseUrl, appName) {
  const lang = await resolveLang(pool, worker.id);
  const count = tickets.length;
  const hours = tickets[0]?.delay_hours || 24;
  const unit = pluralUnit(lang, count, 'pending');

  const subject = count === 1
    ? tr(lang, 'subject_pending_single', { appName, count })
    : tr(lang, 'subject_pending_plural', { appName, count });

  const greeting = worker.imie
    ? tr(lang, 'greeting_day_with_name', { name: worker.imie })
    : tr(lang, 'greeting_day', { name: '' });

  const html = `
    <p>${tr(lang, 'pending_intro', { count, unit, hours })}</p>
    ${ticketTableHtml(tickets, baseUrl, lang)}
    <p style="margin-top:16px">
      <a href="${baseUrl}/tickets" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">
        ${tr(lang, 'btn_view_my')}
      </a>
    </p>`;

  await sendNotification({ to: worker.email, subject, html, greeting, lang });
}

async function runCloseReminders(settings) {
  const frontendUrl = await getSiteUrl();
  const appName = settings?.app_name || 'Helpdesk';
  const resendAfterSeconds = Math.floor((settings?.reminder_delay_hours || 48) * 3600);
  const resendCutoff = Math.floor(Date.now() / 1000) - resendAfterSeconds;
  const crypto = require('crypto');
  const lang = await getAppLang(pool);

  const [tickets] = await pool.query(
    `SELECT id, numer, message_from, message_subject, autor_token
     FROM ticket
     WHERE status = 2
       AND (odlozony = 0 OR odlozony IS NULL)
       AND (close_reminder_sent_at IS NULL OR close_reminder_sent_at < ?)
     ORDER BY data_utworzenia ASC
     LIMIT 100`,
    [resendCutoff]
  );

  let sent = 0;
  for (const ticket of tickets) {
    let token = ticket.autor_token;
    if (!token) {
      token = crypto.randomUUID();
      await pool.query('UPDATE ticket SET autor_token = ? WHERE id = ?', [token, ticket.id]);
    }

    const statusLink = `${frontendUrl}/status/${token}`;
    const subject = ticket.message_subject
      ? tr(lang, 'subject_close_reminder_with_subject', { appName, numer: ticket.numer, subject: ticket.message_subject })
      : tr(lang, 'subject_close_reminder', { appName, numer: ticket.numer });

    const html = `
      <p>${tr(lang, 'close_reminder_intro', { numer: ticket.numer })}</p>
      <p>${tr(lang, 'close_reminder_body')}</p>
      <p style="margin:20px 0">
        <a href="${statusLink}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">
          ${tr(lang, 'btn_close_ticket')}
        </a>
      </p>
      <p>${tr(lang, 'close_reminder_ignore')}</p>`;

    try {
      await sendNotification({
        to: ticket.message_from,
        subject,
        html,
        greeting: tr(lang, 'greeting_formal'),
        lang,
      });
      await pool.query('UPDATE ticket SET close_reminder_sent_at = ? WHERE id = ?', [Math.floor(Date.now() / 1000), ticket.id]);
      sent++;
    } catch (e) {
      console.warn(`[Reminder] Close reminder do ${ticket.message_from} nie wysłany:`, e.message);
    }
  }

  if (sent > 0) console.log(`[Reminder] Close reminders: wysłano ${sent} wiadomości`);
}

async function runReminders() {
  try {
    const settings = await getSettings();
    if (!settings?.reminder_enabled) return;

    const today = new Date().toISOString().slice(0, 10);
    const nowHour = new Date().getHours();
    const reminderHour = settings.reminder_hour ?? 8;
    const delayHours = settings.reminder_delay_hours || 24;

    if (settings.reminder_last_date === today) return;
    if (nowHour < reminderHour) return;

    const cutoff = Math.floor(Date.now() / 1000) - delayHours * 3600;
    const baseUrl = await getSiteUrl();

    // ── 1. Nieprzypisane nowe tickety ─────────────────────────────────────────
    const [unassigned] = await pool.query(
      `SELECT t.id, t.numer, t.message_subject,
              ROUND((UNIX_TIMESTAMP() - t.data_utworzenia) / 3600, 0) AS age_hours,
              ? AS delay_hours
       FROM ticket t
       WHERE t.status = 1
         AND t.data_utworzenia < ?
         AND NOT EXISTS (SELECT 1 FROM user_has_ticket uht WHERE uht.ticket_id = t.id)
       ORDER BY t.data_utworzenia ASC
       LIMIT 50`,
      [delayHours, cutoff]
    );

    const appName = settings?.app_name || 'Helpdesk';

    if (unassigned.length > 0) {
      const [admins] = await pool.query(
        `SELECT u.id, u.email, u.imie, u.nazwisko
         FROM user u JOIN auth_assignment aa ON aa.user_id = u.id
         WHERE aa.item_name = 'admin' AND u.email IS NOT NULL AND u.email != ''`
      );
      for (const admin of admins) {
        await sendUnassignedReminder(admin, unassigned, baseUrl, appName).catch(e =>
          console.warn(`[Reminder] Email do admina ${admin.email} nie wysłany:`, e.message)
        );
      }
      console.log(`[Reminder] Nieprzypisane: ${unassigned.length} ticketów → ${admins.length} adminów`);
    }

    // ── 2. Przypisane tickety z oczekującą korespondencją ─────────────────────
    const [pendingRows] = await pool.query(
      `SELECT
         t.id, t.numer, t.message_subject,
         uht.user_id,
         ROUND((UNIX_TIMESTAMP() - MAX(CASE WHEN k.typ = 'received' THEN k.data END)) / 3600, 0) AS age_hours,
         ? AS delay_hours
       FROM ticket t
       JOIN user_has_ticket uht ON uht.ticket_id = t.id
       JOIN korespondencja k ON k.ticket_id = t.id
       WHERE t.status != 3
         AND t.podswietl = 1
         AND k.typ = 'received'
       GROUP BY t.id, uht.user_id
       HAVING MAX(CASE WHEN k.typ = 'received' THEN k.data END) < ?
          AND (MAX(CASE WHEN k.typ IN ('reply','forward') THEN k.data END) IS NULL
               OR MAX(CASE WHEN k.typ IN ('reply','forward') THEN k.data END) <
                  MAX(CASE WHEN k.typ = 'received' THEN k.data END))
       ORDER BY age_hours DESC`,
      [delayHours, cutoff]
    );

    const byWorker = {};
    for (const row of pendingRows) {
      if (!byWorker[row.user_id]) byWorker[row.user_id] = [];
      byWorker[row.user_id].push(row);
    }

    let workerCount = 0;
    for (const [userId, tickets] of Object.entries(byWorker)) {
      const [[worker]] = await pool.query(
        'SELECT id, email, imie, nazwisko FROM user WHERE id = ?', [userId]
      );
      if (!worker?.email) continue;
      await sendPendingReminder(worker, tickets, baseUrl, appName).catch(e =>
        console.warn(`[Reminder] Email do ${worker.email} nie wysłany:`, e.message)
      );
      workerCount++;
    }
    if (pendingRows.length > 0) {
      console.log(`[Reminder] Oczekująca korespondencja: ${pendingRows.length} ticketów → ${workerCount} pracowników`);
    }

    // ── 3. Przypomnienie do autorów ticketów "w toku" o możliwości zamknięcia ──
    await runCloseReminders(settings);

    await pool.query('UPDATE ustawienia SET reminder_last_date = ? WHERE id = 1', [today]);
    console.log(`[Reminder] Zakończono (${today})`);
  } catch (e) {
    console.error('[Reminder] Błąd:', e.message);
  }
}

function start(checkIntervalMs = 60 * 60 * 1000) {
  if (timer) return;
  runReminders();
  timer = setInterval(runReminders, checkIntervalMs);
  console.log('[Reminder] Scheduler uruchomiony');
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { start, stop, runReminders };
