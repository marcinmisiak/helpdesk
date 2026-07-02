-- Dziennik zdarzeń ticketu (audit log): kto i kiedy przydzielił, otworzył,
-- odpowiedział, zamknął, przekazał itd. zgłoszenie.
CREATE TABLE IF NOT EXISTS ticket_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  typ VARCHAR(40) NOT NULL,
  user_id INT NULL,
  actor_label VARCHAR(150) NULL,
  meta TEXT NULL,
  created_at INT NOT NULL,
  KEY idx_ticket_log_ticket (ticket_id),
  KEY idx_ticket_log_user (user_id)
);

ALTER TABLE ustawienia ADD COLUMN ticket_log_enabled TINYINT(1) NOT NULL DEFAULT 1;
