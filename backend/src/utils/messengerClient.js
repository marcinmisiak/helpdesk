const pool = require('../config/db');

const GRAPH_VERSION = 'v21.0';

async function getToken() {
  const [[s]] = await pool.query('SELECT messenger_enabled, messenger_page_access_token FROM ustawienia WHERE id = 1');
  if (!s?.messenger_enabled || !s.messenger_page_access_token) {
    throw new Error('Messenger nie jest skonfigurowany.');
  }
  return s.messenger_page_access_token;
}

// Wysyłka odpowiedzi agenta do użytkownika Facebooka. Poza 24h oknem standardowych
// odpowiedzi trzeba użyć tagu HUMAN_AGENT (polityka Messenger Platform dla obsługi klienta).
async function sendMessage(psid, text, withinWindow) {
  const token = await getToken();
  const body = {
    recipient: { id: psid },
    message: { text },
    ...(withinWindow ? { messaging_type: 'RESPONSE' } : { messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' }),
  };

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/me/messages?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Błąd wysyłki do Messengera');
  return data.message_id;
}

async function getUserProfile(psid, token) {
  try {
    const res = await fetch(`https://graph.facebook.com/${psid}?fields=first_name,last_name&access_token=${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Uwaga: zapytanie przez alias /me wymaga uprawnienia 'pages_read_engagement', którego
// token z samym 'pages_messaging' nie ma — odpytujemy bezpośrednio po ID strony.
async function testConnection(token, pageId) {
  const target = pageId || 'me';
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${target}?fields=name,id&access_token=${encodeURIComponent(token)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Nieprawidłowy token.');
  return data;
}

module.exports = { sendMessage, getUserProfile, testConnection };
