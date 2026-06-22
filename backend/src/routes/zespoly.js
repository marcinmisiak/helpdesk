const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate, requireAdmin, requireWorker } = require('../middleware/auth');

router.use(authenticate);

// GET /api/zespoly — dostępne dla każdego zalogowanego (wybór zespołu przy przydzielaniu ticketu)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT z.*, GROUP_CONCAT(DISTINCT zu.user_id) as czlonkowie_ids,
              GROUP_CONCAT(DISTINCT CONCAT(u.imie, ' ', u.nazwisko) SEPARATOR ', ') as czlonkowie
       FROM zespol z
       LEFT JOIN zespol_user zu ON zu.zespol_id = z.id
       LEFT JOIN user u ON u.id = zu.user_id
       GROUP BY z.id
       ORDER BY z.nazwa ASC`
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/zespoly
router.post('/', requireAdmin, async (req, res) => {
  const { nazwa, opis, user_ids } = req.body;
  if (!nazwa?.trim()) return res.status(400).json({ error: 'Nazwa zespołu jest wymagana' });

  try {
    const now = Math.floor(Date.now() / 1000);
    const [result] = await pool.query(
      'INSERT INTO zespol (nazwa, opis, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [nazwa.trim(), opis?.trim() || null, now, now]
    );
    const zespolId = result.insertId;
    if (Array.isArray(user_ids) && user_ids.length) {
      const values = user_ids.map((uid) => [zespolId, uid, now]);
      await pool.query('INSERT INTO zespol_user (zespol_id, user_id, created_at) VALUES ?', [values]);
    }
    res.status(201).json({ id: zespolId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/zespoly/:id
router.put('/:id', requireAdmin, async (req, res) => {
  const { nazwa, opis, user_ids } = req.body;
  if (nazwa !== undefined && !nazwa?.trim()) {
    return res.status(400).json({ error: 'Nazwa nie może być pusta' });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const updates = ['updated_at = ?'];
    const values = [now];

    if (nazwa !== undefined) { updates.push('nazwa = ?'); values.push(nazwa.trim()); }
    if (opis !== undefined) { updates.push('opis = ?'); values.push(opis?.trim() || null); }

    values.push(req.params.id);
    await pool.query(`UPDATE zespol SET ${updates.join(', ')} WHERE id = ?`, values);

    if (Array.isArray(user_ids)) {
      await pool.query('DELETE FROM zespol_user WHERE zespol_id = ?', [req.params.id]);
      if (user_ids.length) {
        const memberValues = user_ids.map((uid) => [req.params.id, uid, now]);
        await pool.query('INSERT INTO zespol_user (zespol_id, user_id, created_at) VALUES ?', [memberValues]);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/zespoly/:id/join — pracownik/admin samodzielnie dołącza do zespołu (bez udziału admina)
router.post('/:id/join', requireWorker, async (req, res) => {
  try {
    const [teams] = await pool.query('SELECT id FROM zespol WHERE id = ?', [req.params.id]);
    if (!teams.length) return res.status(404).json({ error: 'Zespół nie istnieje' });

    const now = Math.floor(Date.now() / 1000);
    await pool.query(
      'INSERT INTO zespol_user (zespol_id, user_id, created_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE zespol_id = zespol_id',
      [req.params.id, req.user.id, now]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/zespoly/:id/leave — pracownik/admin samodzielnie opuszcza zespół
router.post('/:id/leave', requireWorker, async (req, res) => {
  try {
    await pool.query('DELETE FROM zespol_user WHERE zespol_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/zespoly/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM zespol_has_ticket WHERE zespol_id = ?', [req.params.id]);
    await pool.query('DELETE FROM zespol_user WHERE zespol_id = ?', [req.params.id]);
    await pool.query('DELETE FROM zespol WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
