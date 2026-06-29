const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const backupManager = require('../utils/backupManager');

router.use(authenticate, requireAdmin);

// GET /api/backup — lista wykonanych kopii zapasowych
router.get('/', async (req, res) => {
  try {
    res.json({ data: await backupManager.listBackups() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/backup/status — postęp aktualnie trwającej kopii (do pollingu)
router.get('/status', (req, res) => {
  res.json(backupManager.getStatus());
});

// POST /api/backup — uruchom nową kopię zapasową { includeDb, includeFiles }
router.post('/', async (req, res) => {
  try {
    const { includeDb, includeFiles } = req.body;
    const result = await backupManager.runBackup({
      includeDb: !!includeDb,
      includeFiles: !!includeFiles,
      userId: req.user.id,
    });
    res.json(result);
  } catch (err) {
    res.status(err.message.includes('już w trakcie') ? 409 : 400).json({ error: err.message });
  }
});

// GET /api/backup/:id/download — pobierz archiwum kopii zapasowej
router.get('/:id/download', async (req, res) => {
  try {
    const { filePath, filename } = await backupManager.getBackupFilePath(req.params.id);
    res.download(filePath, filename);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// DELETE /api/backup/:id — usuń kopię zapasową
router.delete('/:id', async (req, res) => {
  try {
    await backupManager.deleteBackup(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
