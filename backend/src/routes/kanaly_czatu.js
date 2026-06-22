const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

// GET /api/kanaly-czatu — dostępne dla każdego zalogowanego
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT k.*, z.nazwa as zespol_nazwa
       FROM kanal_czatu k
       LEFT JOIN zespol z ON z.id = k.zespol_id
       ORDER BY k.nazwa ASC`
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/kanaly-czatu
router.post('/', requireAdmin, async (req, res) => {
  const { nazwa, zespol_id, dozwolone_domeny, powitanie } = req.body;
  if (!nazwa?.trim()) return res.status(400).json({ error: 'Nazwa kanału jest wymagana' });
  if (!zespol_id) return res.status(400).json({ error: 'Wybierz zespół docelowy' });

  try {
    const now = Math.floor(Date.now() / 1000);
    const channelKey = crypto.randomUUID();
    const [result] = await pool.query(
      'INSERT INTO kanal_czatu (channel_key, nazwa, zespol_id, dozwolone_domeny, powitanie, aktywny, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
      [channelKey, nazwa.trim(), zespol_id, dozwolone_domeny?.trim() || null, powitanie?.trim() || null, now, now]
    );
    res.status(201).json({ id: result.insertId, channel_key: channelKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/kanaly-czatu/:id
router.put('/:id', requireAdmin, async (req, res) => {
  const { nazwa, zespol_id, dozwolone_domeny, powitanie, aktywny } = req.body;
  if (nazwa !== undefined && !nazwa?.trim()) {
    return res.status(400).json({ error: 'Nazwa nie może być pusta' });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const updates = ['updated_at = ?'];
    const values = [now];

    if (nazwa !== undefined) { updates.push('nazwa = ?'); values.push(nazwa.trim()); }
    if (zespol_id !== undefined) { updates.push('zespol_id = ?'); values.push(zespol_id); }
    if (dozwolone_domeny !== undefined) { updates.push('dozwolone_domeny = ?'); values.push(dozwolone_domeny?.trim() || null); }
    if (powitanie !== undefined) { updates.push('powitanie = ?'); values.push(powitanie?.trim() || null); }
    if (aktywny !== undefined) { updates.push('aktywny = ?'); values.push(aktywny ? 1 : 0); }

    values.push(req.params.id);
    await pool.query(`UPDATE kanal_czatu SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
