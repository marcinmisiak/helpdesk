const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

// GET /api/szablony — dostępne dla admina i pracownika (wybór szablonu przy odpowiadaniu)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM szablon_odpowiedzi WHERE aktywny = 1 ORDER BY kolejnosc ASC, nazwa ASC'
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/szablony
router.post('/', requireAdmin, async (req, res) => {
  const { nazwa, tresc, kolejnosc } = req.body;
  if (!nazwa?.trim()) return res.status(400).json({ error: 'Nazwa szablonu jest wymagana' });
  if (!tresc?.trim()) return res.status(400).json({ error: 'Treść szablonu jest wymagana' });

  try {
    const now = Math.floor(Date.now() / 1000);
    const [result] = await pool.query(
      'INSERT INTO szablon_odpowiedzi (nazwa, tresc, kolejnosc, aktywny, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)',
      [nazwa.trim(), tresc, kolejnosc || 0, now, now]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/szablony/:id
router.put('/:id', requireAdmin, async (req, res) => {
  const { nazwa, tresc, kolejnosc, aktywny } = req.body;
  if (nazwa !== undefined && !nazwa?.trim()) {
    return res.status(400).json({ error: 'Nazwa nie może być pusta' });
  }
  if (tresc !== undefined && !tresc?.trim()) {
    return res.status(400).json({ error: 'Treść nie może być pusta' });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const updates = ['updated_at = ?'];
    const values = [now];

    if (nazwa !== undefined) { updates.push('nazwa = ?'); values.push(nazwa.trim()); }
    if (tresc !== undefined) { updates.push('tresc = ?'); values.push(tresc); }
    if (kolejnosc !== undefined) { updates.push('kolejnosc = ?'); values.push(parseInt(kolejnosc) || 0); }
    if (aktywny !== undefined) { updates.push('aktywny = ?'); values.push(aktywny ? 1 : 0); }

    values.push(req.params.id);
    await pool.query(
      `UPDATE szablon_odpowiedzi SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/szablony/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    await pool.query(
      'UPDATE szablon_odpowiedzi SET aktywny = 0, updated_at = ? WHERE id = ?',
      [now, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
