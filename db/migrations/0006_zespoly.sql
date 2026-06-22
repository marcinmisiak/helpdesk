-- Zespoły (grupy użytkowników) i przydział zgłoszeń do zespołu
CREATE TABLE IF NOT EXISTS zespol (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nazwa VARCHAR(150) NOT NULL,
  opis VARCHAR(255) DEFAULT NULL,
  created_at INT,
  updated_at INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS zespol_user (
  id INT AUTO_INCREMENT PRIMARY KEY,
  zespol_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at INT,
  UNIQUE KEY uniq_zespol_user (zespol_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS zespol_has_ticket (
  id INT AUTO_INCREMENT PRIMARY KEY,
  zespol_id INT NOT NULL,
  ticket_id INT NOT NULL,
  created_at INT,
  created_by INT,
  UNIQUE KEY uniq_zespol_ticket (zespol_id, ticket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
