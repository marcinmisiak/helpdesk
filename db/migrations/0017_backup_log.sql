-- Historia kopii zapasowych (baza danych + pliki uploadów), wykonywanych ręcznie z panelu admina.
CREATE TABLE IF NOT EXISTS backup_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  include_db TINYINT(1) NOT NULL DEFAULT 0,
  include_files TINYINT(1) NOT NULL DEFAULT 0,
  size_bytes BIGINT DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  error_message TEXT DEFAULT NULL,
  created_by INT DEFAULT NULL,
  started_at INT NOT NULL,
  finished_at INT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
