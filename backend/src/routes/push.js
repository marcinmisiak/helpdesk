const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

// GET /api/push/vapid-key — publiczny klucz VAPID dla frontendu
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe — zapisz lub zaktualizuj subskrypcję
router.post('/subscribe', authenticate, async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Nieprawidłowe dane subskrypcji' });
  }

  const now = Math.floor(Date.now() / 1000);
  await pool.query(
    `INSERT INTO push_subscription (user_id, endpoint, p256dh, auth, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [req.user.id, endpoint, keys.p256dh, keys.auth, now]
  );

  res.json({ success: true });
});

// DELETE /api/push/subscribe — usuń subskrypcję użytkownika
router.delete('/subscribe', authenticate, async (req, res) => {
  await pool.query('DELETE FROM push_subscription WHERE user_id = ?', [req.user.id]);
  res.json({ success: true });
});

module.exports = router;
