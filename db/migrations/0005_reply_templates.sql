-- Szablony szybkich odpowiedzi
CREATE TABLE IF NOT EXISTS szablon_odpowiedzi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nazwa VARCHAR(150) NOT NULL,
  tresc TEXT NOT NULL,
  kolejnosc INT DEFAULT 0,
  aktywny TINYINT(1) DEFAULT 1,
  created_at INT,
  updated_at INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
