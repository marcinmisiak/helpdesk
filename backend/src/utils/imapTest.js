const Imap = require('imap');

// Sprawdza tylko logowanie i dostęp do skrzynki (readOnly) — nie pobiera ani nie
// modyfikuje żadnych wiadomości. Te same opcje połączenia co w imapPoller.js,
// żeby wynik testu odzwierciedlał realne zachowanie pollera.
function testImapConnection({ host, port, user, password, path }) {
  return new Promise((resolve, reject) => {
    if (!host) return reject(new Error('Brak adresu serwera IMAP'));
    if (!user) return reject(new Error('Brak loginu IMAP'));
    if (!password) return reject(new Error('Brak hasła IMAP'));

    const imap = new Imap({
      user,
      password,
      host,
      port: port || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
      connTimeout: 15000,
    });

    // Nasłuch błędów musi być stały (`.on`, nie `.once`) — inaczej spóźniony błąd
    // po rozstrzygnięciu obietnicy (np. EPIPE przy zapisie do już zamkniętego
    // socketu) nie miałby handlera i ubiłby cały proces Node.
    let settled = false;
    const finish = (err, result) => {
      if (settled) {
        if (err) console.warn('[IMAP-test] Błąd połączenia po zakończeniu testu (zignorowany):', err.message);
        return;
      }
      settled = true;
      try { imap.end(); } catch {}
      if (err) reject(err); else resolve(result);
    };

    imap.once('ready', () => {
      imap.openBox(path || 'INBOX', true, (err, box) => {
        if (err) return finish(err);
        imap.search(['UNSEEN'], (err, uids) => {
          if (err) return finish(err);
          finish(null, { total: box.messages.total, unseen: uids.length });
        });
      });
    });
    imap.on('error', (err) => finish(err));

    imap.connect();
  });
}

module.exports = { testImapConnection };
