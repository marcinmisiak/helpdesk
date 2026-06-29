const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const pool = require('../config/db');
const { uploadDir } = require('./storageStats');

const MONTH_RE = /^\d{4}-\d{2}$/;

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function getSettings() {
  const [[row]] = await pool.query('SELECT archive_path FROM ustawienia WHERE id = 1');
  return row || {};
}

async function getArchivedMonthsSet() {
  const [rows] = await pool.query('SELECT month FROM plik_archiwum');
  return new Set(rows.map((r) => r.month));
}

async function countFiles(dir) {
  let total = 0;
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) total += await countFiles(path.join(dir, entry.name));
    else if (entry.isFile()) total += 1;
  }
  return total;
}

function duSizeBytes(dir) {
  return new Promise((resolve, reject) => {
    execFile('du', ['-sb', dir], (err, stdout) => {
      if (err) return reject(err);
      const bytes = parseInt(stdout.split('\t')[0], 10);
      if (Number.isNaN(bytes)) return reject(new Error('Nieprawidłowa odpowiedź du'));
      resolve(bytes);
    });
  });
}

// Ścieżka archiwum musi leżeć poza UPLOAD_DIR — UPLOAD_DIR jest serwowany publicznie
// przez alias Apache /pliki/ (app.js), archiwum z danymi nie może tam wylądować.
function assertArchivePathSafe(archivePath) {
  const a = path.resolve(archivePath);
  const u = path.resolve(uploadDir);
  if (a === u || a.startsWith(u + path.sep) || u.startsWith(a + path.sep)) {
    throw new Error('Ścieżka archiwum nie może być taka sama jak ścieżka plików ani się z nią zagnieżdżać.');
  }
}

async function listMonths() {
  const { archive_path } = await getSettings();
  const archivedRows = await pool.query('SELECT * FROM plik_archiwum').then(([r]) => r);
  const archivedByMonth = Object.fromEntries(archivedRows.map((r) => [r.month, r]));

  let liveDirs = [];
  try {
    liveDirs = (await fs.promises.readdir(uploadDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && MONTH_RE.test(e.name))
      .map((e) => e.name);
  } catch { /* uploadDir nieosiągalny — pusta lista */ }

  const months = new Set([...liveDirs, ...Object.keys(archivedByMonth)]);
  const nowMonth = currentMonth();
  const result = [];

  for (const month of months) {
    const archived = archivedByMonth[month];
    if (archived) {
      result.push({
        month,
        archived: true,
        current: false,
        sizeBytes: archived.size_bytes,
        fileCount: archived.file_count,
        archivedAt: archived.archived_at,
      });
    } else {
      const dir = path.join(uploadDir, month);
      const [sizeBytes, fileCount] = await Promise.all([
        duSizeBytes(dir).catch(() => null),
        countFiles(dir),
      ]);
      result.push({ month, archived: false, current: month === nowMonth, sizeBytes, fileCount });
    }
  }

  return result.sort((a, b) => b.month.localeCompare(a.month));
}

async function archiveMonth(month, userId) {
  if (!MONTH_RE.test(month)) throw new Error('Nieprawidłowy format miesiąca.');
  if (month === currentMonth()) throw new Error('Nie można zarchiwizować bieżącego miesiąca — wciąż trafiają tam nowe załączniki.');

  const [[existing]] = await pool.query('SELECT id FROM plik_archiwum WHERE month = ?', [month]);
  if (existing) throw new Error('Ten miesiąc jest już zarchiwizowany.');

  const sourceDir = path.join(uploadDir, month);
  if (!fs.existsSync(sourceDir)) throw new Error('Folder tego miesiąca nie istnieje.');

  const { archive_path } = await getSettings();
  if (!archive_path) throw new Error('Najpierw ustaw ścieżkę archiwum.');
  assertArchivePathSafe(archive_path);
  await fs.promises.mkdir(archive_path, { recursive: true });

  const [fileCount, sizeBytes] = await Promise.all([countFiles(sourceDir), duSizeBytes(sourceDir).catch(() => null)]);
  const archiveFilename = `${month}.tar.gz`;
  const archiveFile = path.join(archive_path, archiveFilename);

  await new Promise((resolve, reject) => {
    const child = spawn('tar', ['-czf', archiveFile, '-C', uploadDir, month]);
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`tar zakończył się kodem ${code}: ${stderr.slice(0, 500)}`));
      resolve();
    });
  });

  // Folder źródłowy usuwamy tylko po potwierdzonym sukcesie tar (powyżej) — błąd tar
  // nigdy nie dotyka oryginalnych plików.
  await fs.promises.rm(sourceDir, { recursive: true });

  await pool.query(
    'INSERT INTO plik_archiwum (month, archive_filename, size_bytes, file_count, archived_by, archived_at) VALUES (?, ?, ?, ?, ?, ?)',
    [month, archiveFilename, sizeBytes, fileCount, userId || null, Math.floor(Date.now() / 1000)]
  );
}

async function restoreMonth(month) {
  const [[row]] = await pool.query('SELECT * FROM plik_archiwum WHERE month = ?', [month]);
  if (!row) throw new Error('Ten miesiąc nie jest zarchiwizowany.');

  const { archive_path } = await getSettings();
  if (!archive_path) throw new Error('Ścieżka archiwum nie jest ustawiona.');
  const archiveFile = path.join(archive_path, row.archive_filename);
  if (!fs.existsSync(archiveFile)) throw new Error('Plik archiwum nie istnieje na dysku.');

  await new Promise((resolve, reject) => {
    const child = spawn('tar', ['-xzf', archiveFile, '-C', uploadDir]);
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`tar zakończył się kodem ${code}: ${stderr.slice(0, 500)}`));
      resolve();
    });
  });

  await fs.promises.unlink(archiveFile);
  await pool.query('DELETE FROM plik_archiwum WHERE month = ?', [month]);
}

// Trwałe usunięcie archiwum (bez przywracania) — nieodwracalne, to jedyna kopia tych
// załączników (folder źródłowy w UPLOAD_DIR został już usunięty przy archiwizacji).
async function deleteArchive(month) {
  const [[row]] = await pool.query('SELECT * FROM plik_archiwum WHERE month = ?', [month]);
  if (!row) throw new Error('Ten miesiąc nie jest zarchiwizowany.');

  const { archive_path } = await getSettings();
  if (archive_path) {
    const archiveFile = path.join(archive_path, row.archive_filename);
    // Rzuca błąd (zamiast cicho kontynuować), jeśli plik nie istnieje pod skonfigurowaną
    // ścieżką — to jedyny sygnał, że archive_path mógł się zmienić od czasu archiwizacji
    // (inaczej kasujemy wiersz w DB, a plik zostaje osierocony na dysku, niewidoczny w UI).
    if (!fs.existsSync(archiveFile)) {
      throw new Error(`Plik archiwum nie istnieje pod ścieżką ${archiveFile} — sprawdź czy ścieżka archiwum się nie zmieniła.`);
    }
    await fs.promises.unlink(archiveFile);
  }
  await pool.query('DELETE FROM plik_archiwum WHERE month = ?', [month]);
}

module.exports = { listMonths, archiveMonth, restoreMonth, deleteArchive, getArchivedMonthsSet, MONTH_RE };
