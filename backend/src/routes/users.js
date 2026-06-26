const express = require('express');
const router = express.Router();
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticate, requireAdmin, requireWorker } = require('../middleware/auth');
const { saveAvatarFromBuffer, deleteAvatar } = require('../utils/avatar');

const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate);

// GET /api/users - lista (admin widzi wszystkich, pracownik widzi pracowników do przydziału)
router.get('/', requireWorker, async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.imie, u.nazwisko, u.status, u.avatar_path,
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
      `SELECT u.id, u.email, u.imie, u.nazwisko, u.status, u.avatar_path,
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

// POST /api/users/:id/impersonate - admin loguje się jako wskazany użytkownik
router.post('/:id/impersonate', requireAdmin, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Nie można zalogować się jako siebie' });
    }

    const [[target]] = await pool.query(
      `SELECT u.id, u.email, u.imie, u.nazwisko, u.status, u.avatar_path,
              u.powiadom_nowy_ticket, u.powiadom_korespondencja,
              aa.item_name as rola,
              (SELECT GROUP_CONCAT(zespol_id) FROM zespol_user WHERE user_id = u.id AND is_kierownik = 1) as kierownik_zespol_ids_raw
       FROM user u
       LEFT JOIN auth_assignment aa ON aa.user_id = u.id
       WHERE u.id = ?`,
      [targetId]
    );
    if (!target || target.status !== 10) {
      return res.status(404).json({ error: 'Użytkownik nie znaleziony lub nieaktywny' });
    }

    const token = jwt.sign(
      { id: target.id, email: target.email, rola: target.rola },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    console.log(`[impersonate] admin #${req.user.id} (${req.user.email}) -> user #${target.id} (${target.email})`);

    res.json({
      token,
      user: {
        id: target.id,
        email: target.email,
        imie: target.imie,
        nazwisko: target.nazwisko,
        rola: target.rola,
        avatar_path: target.avatar_path,
        powiadom_nowy_ticket: target.powiadom_nowy_ticket,
        powiadom_korespondencja: target.powiadom_korespondencja,
        kierownik_zespol_ids: target.kierownik_zespol_ids_raw ? target.kierownik_zespol_ids_raw.split(',').map(Number) : [],
      },
    });
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

// POST /api/users/me/avatar - wgraj własne zdjęcie profilowe
router.post('/me/avatar', avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Brak pliku' });
    if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Plik musi być obrazem' });
    const avatar_path = await saveAvatarFromBuffer(req.user.id, req.file.buffer);
    res.json({ avatar_path });
  } catch (err) {
    res.status(400).json({ error: 'Nieprawidłowy plik obrazu' });
  }
});

// DELETE /api/users/me/avatar - usuń własne zdjęcie profilowe
router.delete('/me/avatar', async (req, res) => {
  try {
    await deleteAvatar(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:id/avatar - admin wgrywa zdjęcie innemu użytkownikowi
router.post('/:id/avatar', requireAdmin, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Brak pliku' });
    if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Plik musi być obrazem' });
    const avatar_path = await saveAvatarFromBuffer(req.params.id, req.file.buffer);
    res.json({ avatar_path });
  } catch (err) {
    res.status(400).json({ error: 'Nieprawidłowy plik obrazu' });
  }
});

// DELETE /api/users/:id/avatar - admin usuwa zdjęcie innego użytkownika
router.delete('/:id/avatar', requireAdmin, async (req, res) => {
  try {
    await deleteAvatar(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
