const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const archiveManager = require('../utils/archiveManager');

router.use(authenticate, requireAdmin);

// GET /api/archiwum — lista folderów YYYY-MM (aktywne + zarchiwizowane)
router.get('/', async (req, res) => {
  try {
    res.json({ data: await archiveManager.listMonths() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/archiwum/:month/archive — spakuj i usuń folder z aktywnej ścieżki plików
router.post('/:month/archive', async (req, res) => {
  try {
    await archiveManager.archiveMonth(req.params.month, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/archiwum/:month/restore — wypakuj z powrotem do aktywnej ścieżki plików
router.post('/:month/restore', async (req, res) => {
  try {
    await archiveManager.restoreMonth(req.params.month);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/archiwum/:month — trwale usuń archiwum (bez przywracania, nieodwracalne)
router.delete('/:month', async (req, res) => {
  try {
    await archiveManager.deleteArchive(req.params.month);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
