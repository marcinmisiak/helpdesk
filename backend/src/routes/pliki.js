const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authenticate, requireWorker } = require('../middleware/auth');

const uploadDir = process.env.UPLOAD_DIR || '/var/www/html/pomoc/pliki';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const now = new Date();
    const subdir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dir = path.join(uploadDir, subdir);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authenticate, requireWorker);

// POST /api/pliki/upload
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    const { tabela, ref_id } = req.body;
    const saved = [];

    for (const file of req.files) {
      const filepath = file.path.replace(uploadDir + '/', '');
      const [result] = await pool.query(
        'INSERT INTO plik (tabela, ticket_id, filepath, originalname) VALUES (?, ?, ?, ?)',
        [tabela, ref_id, filepath, file.originalname]
      );
      saved.push({ id: result.insertId, filepath, originalname: file.originalname });
    }

    res.json({ files: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pliki/:id
router.get('/:id', async (req, res) => {
  try {
    const [[plik]] = await pool.query('SELECT * FROM plik WHERE id = ?', [req.params.id]);
    if (!plik) return res.status(404).json({ error: 'Plik nie znaleziony' });

    const filePath = path.join(uploadDir, plik.filepath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Plik nie istnieje na dysku' });

    res.download(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pliki/:id
router.delete('/:id', async (req, res) => {
  try {
    const [[plik]] = await pool.query('SELECT * FROM plik WHERE id = ?', [req.params.id]);
    if (!plik) return res.status(404).json({ error: 'Nie znaleziono' });

    const filePath = path.join(uploadDir, plik.filepath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await pool.query('DELETE FROM plik WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
