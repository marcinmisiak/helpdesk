const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, requireAdmin } = require('../middleware/auth');
const pool = require('../config/db');

const DOCS_DIR = path.join(__dirname, '../../docs');

const storage = multer.diskStorage({
  destination: DOCS_DIR,
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.md')) cb(null, true);
    else cb(new Error('Tylko pliki .md'));
  },
});

router.use(authenticate, requireAdmin);

// GET /api/docs
router.get('/', (req, res) => {
  const files = fs.readdirSync(DOCS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const stat = fs.statSync(path.join(DOCS_DIR, f));
      return { name: f, size: stat.size, modified: Math.floor(stat.mtimeMs / 1000) };
    });
  res.json({ data: files });
});

// POST /api/docs
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Brak pliku' });
  res.json({ name: req.file.filename, size: req.file.size });
});

// DELETE /api/docs/:name
router.delete('/:name', (req, res) => {
  const name = req.params.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const full = path.join(DOCS_DIR, name);
  if (!full.startsWith(DOCS_DIR)) return res.status(400).json({ error: 'Nieprawidłowa nazwa' });
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Nie znaleziono' });
  fs.unlinkSync(full);
  res.json({ success: true });
});

// POST /api/docs/generate-ai-replies — generuj dokument Q&A na podstawie zamkniętych ticketów
router.post('/generate-ai-replies', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.body.limit) || 60, 200);

    // Pobierz zamknięte tickety z pierwszą odpowiedzią pracownika
    const [rows] = await pool.query(
      `SELECT
         t.message_subject,
         t.tresc AS ticket_tresc,
         k.tresc AS reply_tresc,
         t.data_zamkniecia
       FROM ticket t
       JOIN korespondencja k ON k.ticket_id = t.id
         AND k.id = (
           SELECT MIN(k2.id) FROM korespondencja k2
           WHERE k2.ticket_id = t.id
             AND k2.created_by IS NOT NULL
             AND (k2.typ = 'reply' OR k2.typ IS NULL OR k2.typ = '')
             AND k2.tresc IS NOT NULL
             AND LENGTH(TRIM(k2.tresc)) > 30
         )
       WHERE t.status = 3
         AND t.tresc IS NOT NULL
         AND LENGTH(TRIM(t.tresc)) > 10
       ORDER BY t.data_zamkniecia DESC
       LIMIT ?`,
      [limit]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'Brak zamkniętych zgłoszeń z odpowiedziami pracowników' });
    }

    const trim = (text, max) => {
      if (!text) return '';
      const t = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return t.length > max ? t.slice(0, max) + '…' : t;
    };

    const now = new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const sections = rows.map((r, i) => {
      const subject = (r.message_subject || '(brak tematu)').replace(/\n/g, ' ').slice(0, 120);
      const problem = trim(r.ticket_tresc, 600);
      const reply = trim(r.reply_tresc, 800);
      return `## Przykład ${i + 1}: ${subject}\n\n**Zgłoszenie:**\n${problem}\n\n**Odpowiedź:**\n${reply}`;
    }).join('\n\n---\n\n');

    const content = `# Przykłady udzielonych odpowiedzi helpdesk\n\nWygenerowano: ${now} | Liczba przykładów: ${rows.length}\n\nTen dokument zawiera rzeczywiste pary pytanie–odpowiedź z systemu helpdesk.\nUżywaj go jako kontekstu przy generowaniu propozycji odpowiedzi — dopasuj ton, styl i poziom szczegółowości do poniższych przykładów.\n\n---\n\n${sections}\n`;

    if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
    const filePath = path.join(DOCS_DIR, 'ai-udzielone-odp.md');
    fs.writeFileSync(filePath, content, 'utf8');

    res.json({
      success: true,
      count: rows.length,
      size: Buffer.byteLength(content, 'utf8'),
      filename: 'ai-udzielone-odp.md',
    });
  } catch (err) {
    console.error('[Docs] Błąd generowania:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
