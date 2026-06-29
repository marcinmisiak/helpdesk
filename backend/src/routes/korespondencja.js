const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate, requireWorker } = require('../middleware/auth');
const { getArchivedMonthsSet } = require('../utils/archiveManager');

router.use(authenticate, requireWorker);

// GET /api/korespondencja/:id
router.get('/:id', async (req, res) => {
  try {
    const [[koresp]] = await pool.query(
      `SELECT k.*, u.imie, u.nazwisko FROM korespondencja k
       LEFT JOIN user u ON u.id = k.created_by
       WHERE k.id = ?`,
      [req.params.id]
    );
    if (!koresp) return res.status(404).json({ error: 'Nie znaleziono' });

    const [pliki] = await pool.query(
      'SELECT * FROM plik WHERE tabela = 2 AND ticket_id = ?',
      [req.params.id]
    );
    const archivedMonths = await getArchivedMonthsSet();
    const plikiZFlaga = pliki.map((f) => ({ ...f, archived: archivedMonths.has(f.filepath.slice(0, 7)) }));

    res.json({ korespondencja: koresp, pliki: plikiZFlaga });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/korespondencja/:id/przeczytane — oznacz jako przeczytane
router.patch('/:id/przeczytane', async (req, res) => {
  try {
    await pool.query('UPDATE korespondencja SET przeczytane = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/korespondencja/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM korespondencja WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/korespondencja/:id/redact — anonimizacja treści (RODO)
router.post('/:id/redact', async (req, res) => {
  if (req.user.rola !== 'admin') return res.status(403).json({ error: 'Brak uprawnień' });
  try {
    const [[k]] = await pool.query('SELECT id, ticket_id FROM korespondencja WHERE id = ?', [req.params.id]);
    if (!k) return res.status(404).json({ error: 'Nie znaleziono' });

    const redactedText = '[Treść usunięta — zawierała dane osobowe lub poufne informacje. Usunięto przez administratora.]';
    const redactedHtml = `<p style="color:#6b7280;font-style:italic">${redactedText}</p>`;

    await pool.query(
      'UPDATE korespondencja SET tresc = ?, html = ? WHERE id = ?',
      [redactedText, redactedHtml, req.params.id]
    );

    // Notatka audytowa
    const now = Math.floor(Date.now() / 1000);
    try {
      await pool.query(
        `INSERT INTO notatka (ticket_id, tresc, data, created_by, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          k.ticket_id,
          `[RODO] Treść wiadomości (korespondencja #${k.id}) została zanonimizowana przez ${req.user.imie} ${req.user.nazwisko}.`,
          now, req.user.id, req.user.id, now, now,
        ]
      );
    } catch { /* tabela notatka może mieć inną strukturę */ }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

