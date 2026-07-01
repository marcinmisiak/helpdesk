const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { testImapConnection } = require('../utils/imapTest');

router.use(authenticate);

const TYPY = ['chat', 'email'];

// GET /api/kanaly-czatu — dostępne dla każdego zalogowanego
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT k.*, z.nazwa as zespol_nazwa
       FROM kanal_czatu k
       LEFT JOIN zespol z ON z.id = k.zespol_id
       ORDER BY k.nazwa ASC`
    );
    rows.forEach((r) => { delete r.imap_password; });
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/kanaly-czatu
router.post('/', requireAdmin, async (req, res) => {
  const {
    nazwa, zespol_id, typ, dozwolone_domeny, powitanie, notification_email,
    imap_server, imap_port, imap_login, imap_password, imap_path,
    ms_graph_enabled, ms_graph_mailbox,
  } = req.body;
  if (!nazwa?.trim()) return res.status(400).json({ error: 'Nazwa kanału jest wymagana' });
  if (!zespol_id) return res.status(400).json({ error: 'Wybierz zespół docelowy' });
  if (typ !== undefined && !TYPY.includes(typ)) return res.status(400).json({ error: 'Nieprawidłowy typ kanału' });

  try {
    const now = Math.floor(Date.now() / 1000);
    const channelKey = crypto.randomUUID();
    const [result] = await pool.query(
      `INSERT INTO kanal_czatu
         (channel_key, nazwa, zespol_id, typ, dozwolone_domeny, powitanie, notification_email,
          imap_server, imap_port, imap_login, imap_password, imap_path,
          ms_graph_enabled, ms_graph_mailbox, aktywny, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [channelKey, nazwa.trim(), zespol_id, typ || 'chat', dozwolone_domeny?.trim() || null, powitanie?.trim() || null,
       notification_email?.trim() || null,
       imap_server?.trim() || null, imap_port || null, imap_login?.trim() || null, imap_password || null, imap_path?.trim() || null,
       ms_graph_enabled ? 1 : 0, ms_graph_mailbox?.trim() || null,
       now, now]
    );
    res.status(201).json({ id: result.insertId, channel_key: channelKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/kanaly-czatu/:id
router.put('/:id', requireAdmin, async (req, res) => {
  const {
    nazwa, zespol_id, typ, dozwolone_domeny, powitanie, aktywny, notification_email,
    imap_server, imap_port, imap_login, imap_password, imap_path,
    ms_graph_enabled, ms_graph_mailbox,
  } = req.body;
  if (nazwa !== undefined && !nazwa?.trim()) {
    return res.status(400).json({ error: 'Nazwa nie może być pusta' });
  }
  if (typ !== undefined && !TYPY.includes(typ)) return res.status(400).json({ error: 'Nieprawidłowy typ kanału' });

  try {
    const now = Math.floor(Date.now() / 1000);
    const updates = ['updated_at = ?'];
    const values = [now];

    if (nazwa !== undefined) { updates.push('nazwa = ?'); values.push(nazwa.trim()); }
    if (zespol_id !== undefined) { updates.push('zespol_id = ?'); values.push(zespol_id); }
    if (typ !== undefined) { updates.push('typ = ?'); values.push(typ); }
    if (dozwolone_domeny !== undefined) { updates.push('dozwolone_domeny = ?'); values.push(dozwolone_domeny?.trim() || null); }
    if (powitanie !== undefined) { updates.push('powitanie = ?'); values.push(powitanie?.trim() || null); }
    if (notification_email !== undefined) { updates.push('notification_email = ?'); values.push(notification_email?.trim() || null); }
    if (aktywny !== undefined) { updates.push('aktywny = ?'); values.push(aktywny ? 1 : 0); }
    if (imap_server !== undefined) { updates.push('imap_server = ?'); values.push(imap_server?.trim() || null); }
    if (imap_port !== undefined) { updates.push('imap_port = ?'); values.push(imap_port || null); }
    if (imap_login !== undefined) { updates.push('imap_login = ?'); values.push(imap_login?.trim() || null); }
    // imap_password: aktualizowany tylko gdy faktycznie przyszedł w body — front nie wysyła
    // go, jeśli admin nie wpisał nowej wartości (GET nigdy nie zwraca prawdziwego hasła).
    if (imap_password) { updates.push('imap_password = ?'); values.push(imap_password); }
    if (imap_path !== undefined) { updates.push('imap_path = ?'); values.push(imap_path?.trim() || null); }
    if (ms_graph_enabled !== undefined) { updates.push('ms_graph_enabled = ?'); values.push(ms_graph_enabled ? 1 : 0); }
    if (ms_graph_mailbox !== undefined) { updates.push('ms_graph_mailbox = ?'); values.push(ms_graph_mailbox?.trim() || null); }

    values.push(req.params.id);
    await pool.query(`UPDATE kanal_czatu SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/kanaly-czatu/imap-test — testuje połączenie IMAP danymi z formularza (przed zapisem).
// Jeśli imap_password jest puste, a podano id istniejącego kanału, używa hasła już
// zapisanego w bazie — front nigdy nie ma dostępu do prawdziwego hasła (GET je usuwa),
// więc przy edycji bez zmiany hasła pole w formularzu jest puste.
router.post('/imap-test', requireAdmin, async (req, res) => {
  const { id, imap_server, imap_port, imap_login, imap_password, imap_path } = req.body;

  if (!imap_server?.trim()) return res.status(400).json({ error: 'Podaj adres serwera IMAP' });
  if (!imap_login?.trim()) return res.status(400).json({ error: 'Podaj login IMAP' });

  try {
    let password = imap_password || null;
    if (!password && id) {
      const [[row]] = await pool.query('SELECT imap_password FROM kanal_czatu WHERE id = ?', [id]);
      password = row?.imap_password || null;
    }

    await testImapConnection({
      host: imap_server.trim(),
      port: imap_port || null,
      user: imap_login.trim(),
      password,
      path: imap_path?.trim() || null,
    });
    res.json({ success: true, message: 'Połączenie z serwerem IMAP nawiązane pomyślnie.' });
  } catch (err) {
    res.status(400).json({ success: false, error: `Błąd IMAP: ${err.message}` });
  }
});

// DELETE /api/kanaly-czatu/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM kanal_czatu WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
