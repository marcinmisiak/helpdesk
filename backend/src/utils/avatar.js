const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pool = require('../config/db');

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/www/html/pomoc/pliki';
const AVATAR_DIR = path.join(UPLOAD_DIR, 'avatars');

// Przetwarza bufor obrazu (z multer albo z MS Graph), zapisuje pod nową ścieżką
// i usuwa poprzedni plik awatara użytkownika (jeśli był) — współdzielone przez
// samoobsługowy upload, upload admina i synchronizację zdjęcia z konta Microsoft.
async function saveAvatarFromBuffer(userId, buffer) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
  const filename = `user-${userId}-${Date.now()}.jpg`;
  await sharp(buffer).resize(256, 256, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(path.join(AVATAR_DIR, filename));

  const [[old]] = await pool.query('SELECT avatar_path FROM user WHERE id = ?', [userId]);
  const relPath = `avatars/${filename}`;
  await pool.query('UPDATE user SET avatar_path = ? WHERE id = ?', [relPath, userId]);

  if (old?.avatar_path && old.avatar_path !== relPath) {
    fs.unlink(path.join(UPLOAD_DIR, old.avatar_path), () => {});
  }
  return relPath;
}

async function deleteAvatar(userId) {
  const [[u]] = await pool.query('SELECT avatar_path FROM user WHERE id = ?', [userId]);
  if (u?.avatar_path) {
    fs.unlink(path.join(UPLOAD_DIR, u.avatar_path), () => {});
  }
  await pool.query('UPDATE user SET avatar_path = NULL WHERE id = ?', [userId]);
}

module.exports = { saveAvatarFromBuffer, deleteAvatar };
