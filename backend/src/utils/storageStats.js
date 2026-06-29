const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const pool = require('../config/db');

const uploadDir = process.env.UPLOAD_DIR || '/var/www/html/pomoc/pliki';

async function getDatabaseSizeBytes() {
  const [[row]] = await pool.query(
    `SELECT COALESCE(SUM(data_length + index_length), 0) AS bytes
     FROM information_schema.TABLES WHERE table_schema = ?`,
    [process.env.DB_NAME]
  );
  return Number(row?.bytes || 0);
}

// Rekurencyjne sumowanie rozmiaru plików — fallback gdy `du` nie jest dostępne
// (np. minimalny obraz kontenera bez coreutils).
async function walkDirSize(dir) {
  let total = 0;
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await walkDirSize(full);
    } else if (entry.isFile()) {
      try {
        total += (await fs.promises.stat(full)).size;
      } catch {}
    }
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

async function getUploadsSizeBytes() {
  try {
    return await duSizeBytes(uploadDir);
  } catch {
    return walkDirSize(uploadDir);
  }
}

// Wolne/całkowite miejsce na partycji, na której leży aplikacja — fs.statfs() jest
// wbudowane w Node (libuv) od 18.15+ i działa tak samo na Linuxie, Windows i w Dockerze
// (zwraca dane dla systemu plików faktycznie zamontowanego pod podaną ścieżką — w
// kontenerze to bind-mount/wolumen, nie host), bez żadnych zewnętrznych komend (`df`).
async function getAppDiskSpace() {
  const appRoot = path.resolve(__dirname, '../../..');
  const stats = await fs.promises.statfs(appRoot);
  return {
    totalBytes: stats.blocks * stats.bsize,
    freeBytes: stats.bavail * stats.bsize,
  };
}

module.exports = { getDatabaseSizeBytes, getUploadsSizeBytes, getAppDiskSpace, uploadDir };
