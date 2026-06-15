const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { testConnection } = require('../utils/ldap');

const uploadDir = process.env.UPLOAD_DIR || '/var/www/html/pomoc/pliki';

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, 'logo');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, 'logo' + path.extname(file.originalname));
  },
});

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Dozwolone tylko obrazy (JPG, PNG, GIF, SVG, WebP)'));
  },
});

// ─── Publiczne endpointy (przed authenticate) ─────────────────────────────────

// GET /api/ustawienia/app-name - publiczny: nazwa, logo, kontakty
router.get('/app-name', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      'SELECT app_name, logo_path, kontakt_telefony, kontakt_emaile, app_language FROM ustawienia WHERE id = 1'
    );
    res.json({
      app_name: row?.app_name || 'Helpdesk',
      logo_path: row?.logo_path || null,
      kontakt_telefony: row?.kontakt_telefony || '',
      kontakt_emaile: row?.kontakt_emaile || '',
      app_language: row?.app_language || 'pl',
    });
  } catch {
    res.json({ app_name: 'Helpdesk', logo_path: null, kontakt_telefony: '', kontakt_emaile: '', app_language: 'pl' });
  }
});

router.use(authenticate);

// GET /api/ustawienia/ldap-card-config — konfiguracja karty LDAP (dla pracowników i adminów)
router.get('/ldap-card-config', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      'SELECT ldap_card_enabled, ldap_labels FROM ustawienia WHERE id = 1'
    );
    let labels = [];
    try { if (row?.ldap_labels) labels = JSON.parse(row.ldap_labels); } catch {}
    res.json({
      ldap_card_enabled: row?.ldap_card_enabled ?? 1,
      ldap_labels: labels,
    });
  } catch {
    res.json({ ldap_card_enabled: 1, ldap_labels: [] });
  }
});

// GET /api/ustawienia
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [[row]] = await pool.query('SELECT * FROM ustawienia WHERE id = 1');
    if (!row) return res.status(404).json({ error: 'Brak ustawień' });
    const safe = { ...row };
    delete safe.password;
    delete safe.imapPassword;
    delete safe.ms_graph_client_secret;
    res.json({ ustawienia: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/ustawienia
router.put('/', requireAdmin, async (req, res) => {
  try {
    const allowed = [
      'adminEmail', 'senderEmail', 'senderName', 'app_name',
      'encryption', 'host', 'port', 'username', 'password',
      'imapServer', 'imapPort', 'imapPath', 'imapLogin', 'imapPassword',
      'email_stopka', 'email_receive',
      'ticket_czas_ostrzezenia', 'ticket_czas_zamykania',
      'powiadom_nadawce',
      'powiadom_rejestracja',
      // LDAP
      'ldap_enabled', 'ldap_host', 'ldap_port', 'ldap_base_dn',
      'ldap_bind_dn', 'ldap_bind_password', 'ldap_user_filter',
      'ldap_attr_name', 'ldap_attr_type', 'ldap_tls',
      'ldap_card_enabled', 'ldap_labels',
      // Formularz publiczny
      'formularz_publiczny', 'formularz_tytul',
      // Branding i kontakt
      'kontakt_telefony', 'kontakt_emaile',
      // Microsoft Graph
      'ms_graph_enabled', 'ms_graph_client_id', 'ms_graph_client_secret',
      'ms_graph_tenant_id', 'ms_graph_mailbox',
      // Skrzynka
      'clean_mailbox', 'clean_mailbox_days',
      // Przetwarzanie poczty
      'strip_quoted_reply',
      // Przypomnienia
      'reminder_enabled', 'reminder_delay_hours', 'reminder_hour',
      // Adres strony
      'site_url',
      // Weekend
      'weekend_start_hour',
      // Język
      'app_language',
    ];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'Brak pól do aktualizacji' });
    values.push(1);
    await pool.query(`UPDATE ustawienia SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ustawienia/logo — wgraj logo
router.post('/logo', requireAdmin, (req, res, next) => {
  logoUpload.single('logo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Brak pliku' });
  const filepath = 'logo/' + req.file.filename;
  await pool.query('UPDATE ustawienia SET logo_path = ? WHERE id = 1', [filepath]);
  res.json({ success: true, logo_path: filepath });
});

// DELETE /api/ustawienia/logo — usuń logo
router.delete('/logo', requireAdmin, async (req, res) => {
  try {
    const [[row]] = await pool.query('SELECT logo_path FROM ustawienia WHERE id = 1');
    if (row?.logo_path) {
      const fullPath = path.join(uploadDir, row.logo_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    await pool.query('UPDATE ustawienia SET logo_path = NULL WHERE id = 1', []);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ustawienia/ms-graph-stats — statystyki skrzynki Microsoft Graph
router.get('/ms-graph-stats', requireAdmin, async (req, res) => {
  try {
    const [[settings]] = await pool.query('SELECT * FROM ustawienia WHERE id = 1');
    if (!settings?.ms_graph_enabled) return res.status(400).json({ error: 'Microsoft Graph nie jest włączony' });
    const { getMailboxStats } = require('../utils/msGraphClient');
    const stats = await getMailboxStats(settings);
    res.json(stats);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/ustawienia/ms-graph-test — test połączenia Microsoft Graph
router.post('/ms-graph-test', requireAdmin, async (req, res) => {
  try {
    const [[settings]] = await pool.query('SELECT * FROM ustawienia WHERE id = 1');
    if (!settings) return res.status(400).json({ error: 'Brak ustawień' });

    const { getAccessToken, getUnreadMessages } = require('../utils/msGraphClient');
    const { invalidateToken } = require('../utils/msGraphClient');
    invalidateToken(); // wymuś świeży token

    await getAccessToken(settings);
    const msgs = await getUnreadMessages(settings);

    res.json({
      ok: true,
      mailbox: settings.ms_graph_mailbox,
      unreadCount: msgs.length,
      message: `Połączono z Graph. Skrzynka: ${settings.ms_graph_mailbox} | Nieprzeczytanych: ${msgs.length}`,
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/ustawienia/reminder-test — wymuś wysłanie przypomnień teraz
router.post('/reminder-test', requireAdmin, async (req, res) => {
  try {
    // Wyczyść datę ostatniego uruchomienia, żeby scheduler nie blokował
    await pool.query('UPDATE ustawienia SET reminder_last_date = NULL WHERE id = 1');
    const { runReminders } = require('../utils/reminderScheduler');
    await runReminders();
    res.json({ success: true, message: 'Przypomnienia wysłane' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ustawienia/ldap-test — test połączenia LDAP
router.post('/ldap-test', requireAdmin, async (req, res) => {
  try {
    await testConnection();
    res.json({ success: true, message: 'Połączenie z serwerem LDAP nawiązane pomyślnie.' });
  } catch (err) {
    res.status(400).json({ success: false, error: `Błąd LDAP: ${err.message}` });
  }
});

module.exports = router;
