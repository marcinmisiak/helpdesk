const pool = require('../config/db');

// Wysyła zdarzenie do skonfigurowanego webhooka n8n (helpdesk -> n8n).
// Wołane jako fire-and-forget (.catch(() => {})) — nigdy nie blokuje odpowiedzi API
// i nigdy nie przerywa głównego przepływu w przypadku błędu sieci.
async function sendWebhookEvent(event, data) {
  const [[settings]] = await pool.query(
    'SELECT webhook_enabled, webhook_url, webhook_secret FROM ustawienia WHERE id = 1'
  );
  if (!settings?.webhook_enabled || !settings.webhook_url) return;

  const res = await fetch(settings.webhook_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Secret': settings.webhook_secret || '',
    },
    body: JSON.stringify({ event, timestamp: Math.floor(Date.now() / 1000), data }),
  });

  if (!res.ok) {
    throw new Error(`Webhook n8n odpowiedział ${res.status}`);
  }
}

module.exports = { sendWebhookEvent };
