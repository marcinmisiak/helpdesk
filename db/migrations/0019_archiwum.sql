-- Archiwizacja starych folderów załączników (YYYY-MM): ścieżka docelowa archiwum
-- oraz rejestr zarchiwizowanych miesięcy (źródło prawdy dla flagi "archived").
ALTER TABLE ustawienia ADD COLUMN archive_path VARCHAR(512) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS plik_archiwum (
  id INT AUTO_INCREMENT PRIMARY KEY,
  month VARCHAR(7) NOT NULL,
  archive_filename VARCHAR(255) NOT NULL,
  size_bytes BIGINT DEFAULT NULL,
  file_count INT DEFAULT NULL,
  archived_by INT DEFAULT NULL,
  archived_at INT NOT NULL,
  UNIQUE KEY uniq_month (month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
