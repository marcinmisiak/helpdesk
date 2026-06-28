-- Lokalna pamięć decyzji o spamie. typ='spam': email i/lub ip znanego spamera (zasilane
-- ręcznym "oznacz jako spam" lub trafieniem w StopForumSpam). typ='zaufany': WYŁĄCZNIE email
-- (bez ip), zasilane ręcznym "to nie spam" — kolejne zgłoszenia z tego adresu mają
-- ai_tag='normalne' bez odpytywania Groq.
CREATE TABLE IF NOT EXISTS spam_blocklist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  typ ENUM('spam','zaufany') NOT NULL DEFAULT 'spam',
  email VARCHAR(255) DEFAULT NULL,
  ip VARCHAR(45) DEFAULT NULL,
  reason VARCHAR(255) DEFAULT NULL,
  ticket_id INT DEFAULT NULL,
  created_at INT NOT NULL,
  KEY idx_email (email),
  KEY idx_ip (ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- IP zgłaszającego, zapisywane tylko gdy realnie dostępne (czat/formularz WWW).
ALTER TABLE ticket ADD COLUMN zrodlo_ip VARCHAR(45) DEFAULT NULL;
