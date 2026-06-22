-- Kanały czatu na żywo (widget embedowalny, routing rozmów do zespołów)
CREATE TABLE IF NOT EXISTS kanal_czatu (
  id INT AUTO_INCREMENT PRIMARY KEY,
  channel_key VARCHAR(64) NOT NULL UNIQUE,
  nazwa VARCHAR(150) NOT NULL,
  zespol_id INT NOT NULL,
  dozwolone_domeny TEXT DEFAULT NULL,
  powitanie TEXT DEFAULT NULL,
  aktywny TINYINT(1) DEFAULT 1,
  created_at INT,
  updated_at INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
