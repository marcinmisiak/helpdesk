const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const pool = require('../config/db');
const { uploadDir } = require('./storageStats');

const backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');
const tmpDir = path.join(backupDir, '.tmp');

// Jeden aktywny backup na raz — wystarczające dla ręcznie odpalanej, nadzorowanej operacji admina.
let currentJob = null;

function ensureDirs() {
  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });
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

function countTables() {
  return pool.query('SHOW TABLES').then(([rows]) => rows.length);
}

function setProgress(step, progress, extra = {}) {
  if (!currentJob) return;
  currentJob = { ...currentJob, step, progress, ...extra };
}

// Zrzut bazy przez mysqldump, hasło przez MYSQL_PWD (nie -p, żeby nie wyciekło w `ps aux`).
// --verbose loguje "Dumping data for table `x`" do stderr — liczymy te linie względem
// liczby tabel, żeby dać realny postęp w zakresie [progressFrom, progressTo].
function dumpDatabase(outFile, { progressFrom, progressTo, tableCount }) {
  return new Promise((resolve, reject) => {
    const args = [
      '-h', process.env.DB_HOST,
      '-u', process.env.DB_USER,
      '--single-transaction', '--routines', '--triggers', '--verbose',
      process.env.DB_NAME,
    ];
    const child = spawn('mysqldump', args, {
      env: { ...process.env, MYSQL_PWD: process.env.DB_PASS },
    });

    const out = fs.createWriteStream(outFile);
    child.stdout.pipe(out);

    let dumped = 0;
    const rl = readline.createInterface({ input: child.stderr });
    rl.on('line', (line) => {
      if (line.includes('Dumping data for table')) {
        dumped += 1;
        const pct = tableCount ? Math.min(1, dumped / tableCount) : 0;
        setProgress('db', Math.round(progressFrom + pct * (progressTo - progressFrom)));
      }
    });

    // Czeka też na 'finish' strumienia pliku — `close` procesu mysqldump nie gwarantuje,
    // że bufor pipe() do `out` już został w całości zapisany na dysk.
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      if (err) return reject(err);
      setProgress('db', progressTo);
      resolve();
    };

    child.on('error', finish);
    out.on('error', finish);
    child.on('close', (code) => {
      if (code !== 0) return finish(new Error(`mysqldump zakończył się kodem ${code}`));
      if (out.writableFinished) finish();
      else out.once('finish', () => finish());
    });
  });
}

// Pakuje sql dump i/lub katalog uploadów do jednego archiwum tar.gz, bez kopiowania plików —
// GNU tar pozwala zmieniać katalog źródłowy (-C) wielokrotnie w jednym wywołaniu (wymaga GNU
// tar; obrazy alpine/busybox nie wspierają --transform). database.sql trafia bez prefiksu
// (nazwa nie zaczyna się od "./", regex transformu jej nie dotyczy), pliki z uploadDir są
// dodawane jako katalog "." więc dostają "./" — stąd JEDEN globalny --transform podany PRZED
// oboma blokami plików: kolejne --transform w tar SKŁADAJĄ SIĘ (nie zastępują poprzedniego),
// więc dwa osobne --transform (jeden na database/, drugi na pliki/) nadpisywałyby się nawzajem
// i wszystko trafiałoby pod database/ — zweryfikowane empirycznie.
function packArchive(outFile, { sqlFile, includeFiles, totalFiles, progressFrom, progressTo }) {
  return new Promise((resolve, reject) => {
    const args = ['-czvf', outFile];
    if (includeFiles) args.push('--transform', 's,^\\./,pliki/,');
    if (sqlFile) args.push('-C', path.dirname(sqlFile), path.basename(sqlFile));
    if (includeFiles) args.push('-C', uploadDir, '.');

    const child = spawn('tar', args);
    let packed = 0;
    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', () => {
      packed += 1;
      const pct = totalFiles ? Math.min(1, packed / totalFiles) : 1;
      setProgress('files', Math.round(progressFrom + pct * (progressTo - progressFrom)));
    });

    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`tar zakończył się kodem ${code}: ${stderr.slice(0, 500)}`));
      setProgress('files', progressTo);
      resolve();
    });
  });
}

async function runBackup({ includeDb, includeFiles, userId }) {
  if (currentJob?.running) throw new Error('Inna kopia zapasowa jest już w trakcie wykonywania.');
  if (!includeDb && !includeFiles) throw new Error('Wybierz co najmniej jedną opcję (baza danych lub pliki).');

  ensureDirs();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${ts}.tar.gz`;
  const outFile = path.join(backupDir, filename);
  // Nazwa pliku tymczasowego trafia 1:1 do archiwum (nie jest przepisywana --transform),
  // więc nazwa "database.sql" jest tu celowa — czytelna przy ewentualnym ręcznym przywracaniu.
  const sqlFile = includeDb ? path.join(tmpDir, 'database.sql') : null;
  const startedAt = Math.floor(Date.now() / 1000);

  const [result] = await pool.query(
    'INSERT INTO backup_log (filename, include_db, include_files, status, created_by, started_at) VALUES (?, ?, ?, ?, ?, ?)',
    [filename, includeDb ? 1 : 0, includeFiles ? 1 : 0, 'running', userId || null, startedAt]
  );
  const backupLogId = result.insertId;
  currentJob = { running: true, step: 'start', progress: 0, backupLogId, filename, error: null };

  (async () => {
    try {
      const dbWeight = includeDb && includeFiles ? 40 : includeDb ? 95 : 0;
      const filesFrom = dbWeight;
      const filesTo = includeFiles ? 95 : dbWeight;

      if (includeDb) {
        const tableCount = await countTables();
        await dumpDatabase(sqlFile, { progressFrom: 0, progressTo: dbWeight, tableCount });
      }

      const totalFiles = includeFiles ? await countFiles(uploadDir) : 0;
      await packArchive(outFile, { sqlFile, includeFiles, totalFiles, progressFrom: filesFrom, progressTo: filesTo });

      if (sqlFile) await fs.promises.unlink(sqlFile).catch(() => {});

      const { size } = await fs.promises.stat(outFile);
      const finishedAt = Math.floor(Date.now() / 1000);
      await pool.query(
        'UPDATE backup_log SET status = ?, size_bytes = ?, finished_at = ? WHERE id = ?',
        ['done', size, finishedAt, backupLogId]
      );
      currentJob = { running: false, step: 'done', progress: 100, backupLogId, filename, error: null };
    } catch (err) {
      if (sqlFile) await fs.promises.unlink(sqlFile).catch(() => {});
      await pool.query(
        'UPDATE backup_log SET status = ?, error_message = ?, finished_at = ? WHERE id = ?',
        ['error', err.message, Math.floor(Date.now() / 1000), backupLogId]
      ).catch(() => {});
      currentJob = { running: false, step: 'error', progress: currentJob?.progress || 0, backupLogId, filename, error: err.message };
    }
  })();

  return { started: true, backupLogId };
}

function getStatus() {
  return currentJob || { running: false, step: 'idle', progress: 0 };
}

async function listBackups() {
  const [rows] = await pool.query('SELECT * FROM backup_log ORDER BY started_at DESC LIMIT 50');
  return rows.map((row) => ({
    ...row,
    existsOnDisk: fs.existsSync(path.join(backupDir, row.filename)),
  }));
}

async function getBackupFilePath(id) {
  const [[row]] = await pool.query('SELECT filename FROM backup_log WHERE id = ?', [id]);
  if (!row) throw Object.assign(new Error('Kopia zapasowa nie znaleziona.'), { status: 404 });
  const filePath = path.join(backupDir, row.filename);
  if (!fs.existsSync(filePath)) throw Object.assign(new Error('Plik kopii zapasowej nie istnieje na dysku.'), { status: 404 });
  return { filePath, filename: row.filename };
}

async function deleteBackup(id) {
  const [[row]] = await pool.query('SELECT filename FROM backup_log WHERE id = ?', [id]);
  if (!row) throw Object.assign(new Error('Kopia zapasowa nie znaleziona.'), { status: 404 });
  const filePath = path.join(backupDir, row.filename);
  if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
  await pool.query('DELETE FROM backup_log WHERE id = ?', [id]);
}

module.exports = { runBackup, getStatus, listBackups, getBackupFilePath, deleteBackup, backupDir };
