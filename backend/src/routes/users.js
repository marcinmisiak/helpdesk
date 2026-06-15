const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authenticate, requireAdmin, requireWorker } = require('../middleware/auth');

router.use(authenticate);

// GET /api/users - lista (admin widzi wszystkich, pracownik widzi pracowników do przydziału)
router.get('/', requireWorker, async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.imie, u.nazwisko, u.status,
              u.powiadom_nowy_ticket, u.powiadom_korespondencja,
              aa.item_name as rola,
              CASE WHEN up.last_seen_at > ? THEN 1 ELSE 0 END as is_online
       FROM user u
       LEFT JOIN auth_assignment aa ON aa.user_id = u.id
       LEFT JOIN user_presence up ON up.user_id = u.id
       WHERE u.status = 10
       ORDER BY u.nazwisko, u.imie`,
      [now - 3 * 60]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const [[user]] = await pool.query(
      `SELECT u.id, u.email, u.imie, u.nazwisko, u.status,
              u.powiadom_nowy_ticket, u.powiadom_korespondencja,
              aa.item_name as rola
       FROM user u
       LEFT JOIN auth_assignment aa ON aa.user_id = u.id
       WHERE u.id = ?`,
      [req.params.id]
    );
    if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users - nowy użytkownik
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { email, password, imie, nazwisko, rola = 'pracownik' } = req.body;
    const now = Math.floor(Date.now() / 1000);
    const hash = await bcrypt.hash(password, 13);
    const authKey = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

    const [result] = await pool.query(
      'INSERT INTO user (email, password, auth_key, status, imie, nazwisko, created_at, updated_at) VALUES (?, ?, ?, 10, ?, ?, ?, ?)',
      [email, hash, authKey, imie, nazwisko, now, now]
    );

    const userId = result.insertId;
    await pool.query('DELETE FROM auth_assignment WHERE user_id = ?', [userId]);
    await pool.query(
      'INSERT INTO auth_assignment (item_name, user_id, created_at) VALUES (?, ?, ?)',
      [rola, userId, now]
    );

    res.status(201).json({ id: userId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { email, password, imie, nazwisko, rola, status, powiadom_nowy_ticket, powiadom_korespondencja, language } = req.body;
    const now = Math.floor(Date.now() / 1000);

    const updates = ['email=?', 'imie=?', 'nazwisko=?', 'updated_at=?'];
    const values = [email, imie, nazwisko, now];

    if (status !== undefined) { updates.push('status=?'); values.push(status); }
    if (powiadom_nowy_ticket !== undefined) { updates.push('powiadom_nowy_ticket=?'); values.push(powiadom_nowy_ticket); }
    if (powiadom_korespondencja !== undefined) { updates.push('powiadom_korespondencja=?'); values.push(powiadom_korespondencja); }
    if (language !== undefined) { updates.push('language=?'); values.push(language || null); }
    if (password) {
      const hash = await bcrypt.hash(password, 13);
      updates.push('password=?');
      values.push(hash);
    }

    values.push(req.params.id);
    await pool.query(`UPDATE user SET ${updates.join(', ')} WHERE id=?`, values);

    if (rola) {
      await pool.query('DELETE FROM auth_assignment WHERE user_id = ?', [req.params.id]);
      await pool.query(
        'INSERT INTO auth_assignment (item_name, user_id, created_at) VALUES (?, ?, ?)',
        [rola, req.params.id, now]
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/me/preferences - moje preferencje powiadomień
router.put('/me/preferences', async (req, res) => {
  try {
    const { powiadom_nowy_ticket, powiadom_korespondencja } = req.body;
    await pool.query(
      'UPDATE user SET powiadom_nowy_ticket=?, powiadom_korespondencja=? WHERE id=?',
      [powiadom_nowy_ticket, powiadom_korespondencja, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
