const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate, requireWorker } = require('../middleware/auth');

router.use(authenticate, requireWorker);

// GET /api/notatki?ticket_id=X
router.get('/', async (req, res) => {
  try {
    const { ticket_id } = req.query;
    const [rows] = await pool.query(
      'SELECT * FROM notatka WHERE ticket_id = ? ORDER BY data ASC',
      [ticket_id]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notatki
router.post('/', async (req, res) => {
  try {
    const { ticket_id, tresc } = req.body;
    const now = Math.floor(Date.now() / 1000);
    const [result] = await pool.query(
      'INSERT INTO notatka (ticket_id, data, tresc) VALUES (?, ?, ?)',
      [ticket_id, now, tresc]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notatki/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM notatka WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
