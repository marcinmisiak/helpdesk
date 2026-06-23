require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const path = require('path');
const runMigrations = require('./utils/migrations');
const { ensureSlaSchema } = require('./utils/sla');
const { startSlaScheduler } = require('./utils/slaScheduler');
const { start: startReminderScheduler } = require('./utils/reminderScheduler');

const app = express();

// Apache (reverse proxy) działa na tym samym hoście i dodaje X-Forwarded-For —
// bez tego express-rate-limit nie może poprawnie rozpoznać adresu IP klienta.
app.set('trust proxy', 'loopback');

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// verify capture'uje surowe body (Buffer) do req.rawBody — potrzebne do weryfikacji
// podpisu HMAC webhooków Facebooka (musi liczyć HMAC po bajtach, nie po sparsowanym JSON).
app.use(express.json({ limit: '10mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Statyczne pliki z Yii2 (załączniki)
app.use('/pliki', express.static(process.env.UPLOAD_DIR || '/var/www/html/pomoc/pliki'));

// Routy API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/korespondencja', require('./routes/korespondencja'));
app.use('/api/notatki', require('./routes/notatki'));
app.use('/api/users', require('./routes/users'));
app.use('/api/pliki', require('./routes/pliki'));
app.use('/api/ustawienia', require('./routes/ustawienia'));
app.use('/api/statystyki', require('./routes/statystyki'));
app.use('/api/opinie', require('./routes/opinie'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/push', require('./routes/push'));
app.use('/api/docs', require('./routes/docs'));
app.use('/api/pomoc', require('./routes/pomoc'));
app.use('/api/public', require('./routes/public'));
app.use('/api/kategorie', require('./routes/kategorie'));
app.use('/api/szablony', require('./routes/szablony'));
app.use('/api/zespoly', require('./routes/zespoly'));
app.use('/api/kanaly-czatu', require('./routes/kanaly_czatu'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/messenger', require('./routes/messenger'));
app.use('/api/webhook/n8n', require('./routes/webhookN8n'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Wyzwól ręczne sprawdzenie IMAP (admin)
app.post('/api/imap/check', require('./middleware/auth').authenticate, require('./middleware/auth').requireAdmin, async (req, res) => {
  const { poll } = require('./utils/imapPoller');
  poll().then(() => res.json({ success: true })).catch(e => res.status(500).json({ error: e.message }));
});

// 404 handler
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint nie znaleziony' }));

const PORT = process.env.PORT || 3001;

async function boot() {
  try {
    await runMigrations();
  } catch (err) {
    console.error('[migrations] Błąd migracji:', err.message);
  }

  try {
    await ensureSlaSchema();
  } catch (err) {
    console.error('Nie udało się zainicjalizować schematu SLA:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`Helpdesk API działa na porcie ${PORT}`);
    require('./utils/imapPoller').start(60000);
    startSlaScheduler();
    startReminderScheduler();
  });
}

boot();

module.exports = app;
