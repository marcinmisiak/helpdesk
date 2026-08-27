-- Domyślny zespół dla nowych zgłoszeń z głównej skrzynki e-mail (ustawienia.imap/ms_graph),
-- analogicznie do messenger_zespol_id. NULL = brak automatycznego routingu (zachowanie sprzed
-- tej migracji — zgłoszenie trafia tylko do puli adminów, tak jak np. ticket #5451).
ALTER TABLE ustawienia ADD COLUMN email_zespol_id INT DEFAULT NULL;
