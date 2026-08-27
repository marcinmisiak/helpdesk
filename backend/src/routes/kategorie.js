const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

// GET /api/kategorie
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT k.*, z.nazwa as zespol_nazwa
       FROM kategoria_zgloszenia k
       LEFT JOIN zespol z ON z.id = k.zespol_id
       ORDER BY k.kolejnosc ASC, k.nazwa ASC`
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/kategorie
router.post('/', async (req, res) => {
  const { nazwa, opis, kolejnosc, zespol_id } = req.body;
  if (!nazwa?.trim()) return res.status(400).json({ error: 'Nazwa kategorii jest wymagana' });

  try {
    const now = Math.floor(Date.now() / 1000);
    const [result] = await pool.query(
      'INSERT INTO kategoria_zgloszenia (nazwa, opis, kolejnosc, aktywna, zespol_id, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)',
      [nazwa.trim(), opis?.trim() || null, kolejnosc || 0, zespol_id ? parseInt(zespol_id) : null, now, now]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/kategorie/:id
router.put('/:id', async (req, res) => {
  const { nazwa, opis, kolejnosc, aktywna, zespol_id } = req.body;
  if (nazwa !== undefined && !nazwa?.trim()) {
    return res.status(400).json({ error: 'Nazwa nie może być pusta' });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const updates = ['updated_at = ?'];
    const values = [now];

    if (nazwa !== undefined) { updates.push('nazwa = ?'); values.push(nazwa.trim()); }
    if (opis !== undefined) { updates.push('opis = ?'); values.push(opis?.trim() || null); }
    if (kolejnosc !== undefined) { updates.push('kolejnosc = ?'); values.push(parseInt(kolejnosc) || 0); }
    if (aktywna !== undefined) { updates.push('aktywna = ?'); values.push(aktywna ? 1 : 0); }
    if (zespol_id !== undefined) { updates.push('zespol_id = ?'); values.push(zespol_id ? parseInt(zespol_id) : null); }

    values.push(req.params.id);
    await pool.query(
      `UPDATE kategoria_zgloszenia SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/kategorie/:id
router.delete('/:id', async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    await pool.query(
      'UPDATE kategoria_zgloszenia SET aktywna = 0, updated_at = ? WHERE id = ?',
      [now, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
