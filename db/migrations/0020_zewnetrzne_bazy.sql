-- Konfiguracja połączeń do zewnętrznych baz danych (systemy szkolne/dziekanatowe itp.)
-- używanych do wyszukiwania danych zgłaszającego (imię, nazwisko, email, ...) po adresie e-mail,
-- wyświetlanych w widoku ticketu w tym samym miejscu co karta LDAP.
CREATE TABLE IF NOT EXISTS zewnetrzna_baza (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nazwa VARCHAR(150) NOT NULL,
  silnik VARCHAR(20) NOT NULL DEFAULT 'mysql',      -- 'mysql' | 'firebird'
  host VARCHAR(255) DEFAULT NULL,
  port INT DEFAULT NULL,
  baza VARCHAR(255) DEFAULT NULL,                   -- mysql: nazwa schematu; firebird: ścieżka/alias .fdb
  login VARCHAR(255) DEFAULT NULL,
  haslo VARCHAR(255) DEFAULT NULL,
  tabela VARCHAR(128) NOT NULL,                     -- nazwa tabeli do przeszukania (walidowana regexem przed użyciem w SQL)
  kolumna_email VARCHAR(128) NOT NULL,              -- kolumna z adresem e-mail, do dopasowania ticket.message_from
  mapowanie_pol TEXT DEFAULT NULL,                  -- JSON: [{"column":"imie","label":"Imię"}, ...]
  aktywna TINYINT(1) NOT NULL DEFAULT 1,
  created_at INT,
  updated_at INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cache wyników wyszukiwania per-ticket, per-źródło (JSON obiekt keyowany id źródła z zewnetrzna_baza,
-- bo w odróżnieniu od LDAP może istnieć N skonfigurowanych źródeł naraz).
ALTER TABLE ticket ADD COLUMN external_db_data TEXT DEFAULT NULL;
