const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');

const POMOC_DIR = path.join(__dirname, '../../podrecznik-pomocy');

router.use(authenticate);

function resolveDir(lang) {
  if (lang === 'en') {
    const enDir = path.join(POMOC_DIR, 'en');
    if (fs.existsSync(enDir)) return enDir;
  }
  return POMOC_DIR;
}

// GET /api/pomoc — lista plików z tytułami
router.get('/', (req, res) => {
  const dir = resolveDir(req.query.lang);
  if (!fs.existsSync(dir)) return res.json({ data: [] });

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .map(f => {
      const content = fs.readFileSync(path.join(dir, f), 'utf8');
      const match = content.match(/^#\s+(.+)/m);
      const title = match ? match[1] : f.replace(/^\d+-/, '').replace(/\.md$/, '').replace(/-/g, ' ');
      return { name: f, title };
    });

  res.json({ data: files });
});

// GET /api/pomoc/:name — zawartość pliku
router.get('/:name', (req, res) => {
  const name = req.params.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!name.endsWith('.md')) return res.status(400).json({ error: 'Tylko pliki .md' });

  const dir = resolveDir(req.query.lang);
  const full = path.join(dir, name);
  if (!full.startsWith(dir + path.sep) && full !== dir) {
    return res.status(400).json({ error: 'Nieprawidłowa nazwa pliku' });
  }

  // Fallback: if EN file not found, try Polish version
  if (!fs.existsSync(full) && dir !== POMOC_DIR) {
    const fallback = path.join(POMOC_DIR, name);
    if (fs.existsSync(fallback)) {
      return res.json({ content: fs.readFileSync(fallback, 'utf8') });
    }
  }

  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Nie znaleziono' });

  const content = fs.readFileSync(full, 'utf8');
  res.json({ content });
});

module.exports = router;
