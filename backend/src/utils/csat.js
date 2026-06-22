const crypto = require('crypto');
const pool = require('../config/db');
const mailer = require('./mailer');
const { getSiteUrl } = require('./siteUrl');
const { getAppLang } = require('../i18n/index');

// Wysyła ankietę CSAT po zamknięciu ticketu — bezpiecznie wywoływana z wielu
// miejsc (różne ścieżki zamykania ticketu), idempotentna przez csat_sent_at.
async function maybeSendCsatSurvey(ticketId) {
  try {
    const [[settings]] = await pool.query('SELECT csat_survey_enabled FROM ustawienia WHERE id = 1');
    if (!settings?.csat_survey_enabled) return;

    const [[ticket]] = await pool.query(
      'SELECT numer, message_from, csat_sent_at FROM ticket WHERE id = ?',
      [ticketId]
    );
    if (!ticket || !ticket.message_from || ticket.csat_sent_at) return;

    const token = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await pool.query('UPDATE ticket SET csat_token = ?, csat_sent_at = ? WHERE id = ?', [token, now, ticketId]);

    const baseUrl = await getSiteUrl();
    const lang = await getAppLang(pool);

    await mailer.sendSurvey({
      to: ticket.message_from,
      surveyLink: `${baseUrl}/ocena/${token}`,
      ticketNumer: ticket.numer,
      lang,
    });
  } catch (err) {
    console.warn('[csat] maybeSendCsatSurvey:', err.message);
  }
}

module.exports = { maybeSendCsatSurvey };
