-- Powiadamianie zgłaszającego o zarejestrowaniu ticketu
ALTER TABLE ustawienia ADD COLUMN powiadom_rejestracja tinyint(1) NOT NULL DEFAULT 0;
