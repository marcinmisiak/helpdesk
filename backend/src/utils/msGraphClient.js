const fs = require('fs');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

const GRAPH_ERROR_MAP = {
  ErrorSubmissionQuotaExceeded:     'Przekroczony limit dzienny wysyłki (quota konta Microsoft)',
  SubmissionQuotaExceeded:          'Przekroczony limit dzienny wysyłki (quota konta Microsoft)',
  ErrorMailboxFull:                 'Skrzynka odbiorcy jest pełna — wiadomość nie może być dostarczona',
  MailboxFull:                      'Skrzynka odbiorcy jest pełna — wiadomość nie może być dostarczona',
  ErrorInvalidRecipients:           'Nieprawidłowy adres e-mail odbiorcy',
  InvalidRecipients:                'Nieprawidłowy adres e-mail odbiorcy',
  ErrorRecipientNotFound:           'Adres odbiorcy nie istnieje lub jest niedostępny',
  ErrorInvalidRecipientAddress:     'Adres e-mail odbiorcy jest niepoprawny składniowo',
  ServiceUnavailable:               'Usługa pocztowa Microsoft jest chwilowo niedostępna — spróbuj ponownie',
  AuthenticationError:              'Błąd autoryzacji konta pocztowego — sprawdź dane Graph API',
  Unauthorized:                     'Brak uprawnień do skrzynki — sprawdź uprawnienia aplikacji Azure',
  ResourceNotFound:                 'Skrzynka nadawcy nie istnieje lub aplikacja nie ma do niej dostępu',
  TooManyRequests:                  'Przekroczono limit zapytań do API — wysyłka będzie możliwa za chwilę',
  MessageSizeExceeded:              'Wiadomość jest zbyt duża — zmniejsz rozmiar załączników',
  ErrorMessageSizeExceeded:         'Wiadomość jest zbyt duża — zmniejsz rozmiar załączników',
};

function parseGraphError(errBody, httpStatus) {
  const code = errBody?.error?.innerError?.code || errBody?.error?.code || '';
  const msg  = errBody?.error?.message || '';

  if (GRAPH_ERROR_MAP[code]) return GRAPH_ERROR_MAP[code];
  if (httpStatus === 429) return 'Przekroczono limit zapytań do Microsoft Graph — wysyłka będzie możliwa za chwilę';
  if (httpStatus === 503 || httpStatus === 502) return 'Usługa pocztowa Microsoft jest chwilowo niedostępna';

  // Szukaj wzorców w komunikacie
  const lc = msg.toLowerCase();
  if (lc.includes('spam') || lc.includes('block') || lc.includes('reject'))
    return `Wiadomość odrzucona (potencjalnie spam): ${msg}`;
  if (lc.includes('quota') || lc.includes('limit'))
    return `Przekroczony limit konta: ${msg}`;
  if (lc.includes('recipient') || lc.includes('address') || lc.includes('mailbox'))
    return `Błąd adresu odbiorcy: ${msg}`;

  return msg || `Błąd Graph API (kod: ${code || httpStatus})`;
}
const TOKEN_URL = (tenant) => `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

// In-memory token cache — wystarczy dla client_credentials (tokeny ważne 1h)
let _cache = { token: null, expiresAt: 0 };

async function getAccessToken(settings) {
  const now = Math.floor(Date.now() / 1000);
  if (_cache.token && _cache.expiresAt > now + 60) return _cache.token;

  if (!settings.ms_graph_client_id) throw new Error('Brak ms_graph_client_id w ustawieniach');
  if (!settings.ms_graph_client_secret) throw new Error('Brak ms_graph_client_secret w ustawieniach');

  const tenant = settings.ms_graph_tenant_id || 'common';
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: settings.ms_graph_client_id,
    client_secret: settings.ms_graph_client_secret,
    scope: 'https://graph.microsoft.com/.default',
  });

  const res = await fetch(TOKEN_URL(tenant), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || `Token error ${res.status}`);
  }

  _cache = { token: data.access_token, expiresAt: now + (data.expires_in || 3600) };
  return _cache.token;
}

function invalidateToken() {
  _cache = { token: null, expiresAt: 0 };
}

// Zamień adres "Imię Nazwisko <email>" → "email"
function extractEmail(addr) {
  if (!addr) return addr;
  const m = addr.match(/<([^>]+)>/);
  return m ? m[1].trim() : addr.trim();
}

function toRecipients(addrs) {
  const list = Array.isArray(addrs) ? addrs : (addrs || '').split(',').map(s => s.trim()).filter(Boolean);
  return list.map(a => ({ emailAddress: { address: extractEmail(a) } }));
}

async function sendMail(settings, { to, cc, subject, html, text, attachments }) {
  const token = await getAccessToken(settings);
  const mailbox = settings.ms_graph_mailbox;
  if (!mailbox) throw new Error('Brak ms_graph_mailbox w ustawieniach');

  const message = {
    subject,
    body: { contentType: 'HTML', content: html || (text || '') },
    toRecipients: toRecipients(to),
  };

  if (cc) {
    const ccList = toRecipients(cc);
    if (ccList.length) message.ccRecipients = ccList;
  }

  if (attachments?.length) {
    message.attachments = attachments
      .map(att => {
        let contentBytes = null;
        if (att.content) {
          contentBytes = Buffer.isBuffer(att.content)
            ? att.content.toString('base64')
            : Buffer.from(att.content).toString('base64');
        } else if (att.path) {
          try { contentBytes = fs.readFileSync(att.path).toString('base64'); } catch {}
        }
        if (!contentBytes) return null;
        return {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: att.filename || att.path?.split('/').pop() || 'attachment',
          contentType: att.contentType || 'application/octet-stream',
          contentBytes,
        };
      })
      .filter(Boolean);
  }

  const res = await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}/sendMail`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, saveToSentItems: true }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseGraphError(err, res.status));
  }

  console.log(`[Graph] sendMail to=${Array.isArray(to) ? to.join(',') : to} subject="${subject}"`);
}

async function getUnreadMessages(settings) {
  const token = await getAccessToken(settings);
  const mailbox = settings.ms_graph_mailbox;
  if (!mailbox) throw new Error('Brak ms_graph_mailbox w ustawieniach');

  const params = new URLSearchParams({
    '$filter': 'isRead eq false',
    '$select': 'id,subject,from,toRecipients,ccRecipients,body,internetMessageId,internetMessageHeaders',
    '$top': '50',
    '$orderby': 'receivedDateTime asc',
  });

  const res = await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}/mailFolders/Inbox/messages?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Graph getUnreadMessages error ${res.status}`);
  }

  const data = await res.json();
  return data.value || [];
}

async function markAsRead(settings, graphMessageId) {
  const token = await getAccessToken(settings);
  const mailbox = settings.ms_graph_mailbox;

  const res = await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}/messages/${graphMessageId}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true }),
    }
  );

  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Graph markAsRead error ${res.status}`);
  }
}

async function getAttachments(settings, graphMessageId) {
  const token = await getAccessToken(settings);
  const mailbox = settings.ms_graph_mailbox;

  const res = await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}/messages/${graphMessageId}/attachments`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return data.value || [];
}

async function getMailboxStats(settings) {
  const token = await getAccessToken(settings);
  const mailbox = settings.ms_graph_mailbox;
  if (!mailbox) throw new Error('Brak ms_graph_mailbox w ustawieniach');

  // sizeInBytes jest tylko w beta — v1.0 zwraca totalItemCount i unreadItemCount
  const res = await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}/mailFolders?$select=displayName,totalItemCount,unreadItemCount&$top=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Graph getMailboxStats error ${res.status}`);
  }
  const data = await res.json();
  const folders = data.value || [];
  const totalItems = folders.reduce((sum, f) => sum + (f.totalItemCount || 0), 0);
  const inbox = folders.find(f => f.displayName === 'Inbox' || f.displayName === 'Skrzynka odbiorcza');
  return {
    totalItems,
    inboxItems: inbox?.totalItemCount || 0,
    inboxUnread: inbox?.unreadItemCount || 0,
  };
}

async function getOldMessages(settings, daysAgo) {
  const token = await getAccessToken(settings);
  const mailbox = settings.ms_graph_mailbox;
  const cutoff = new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toISOString();

  const params = new URLSearchParams({
    '$filter': `receivedDateTime le ${cutoff}`,
    '$select': 'id,subject,receivedDateTime',
    '$top': '100',
  });

  const res = await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}/mailFolders/Inbox/messages?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.value || [];
}

async function deleteMessage(settings, graphMessageId) {
  const token = await getAccessToken(settings);
  const mailbox = settings.ms_graph_mailbox;

  const res = await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}/messages/${graphMessageId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Graph deleteMessage error ${res.status}`);
  }
}

module.exports = { getAccessToken, sendMail, getUnreadMessages, markAsRead, deleteMessage, getAttachments, getMailboxStats, getOldMessages, invalidateToken };
