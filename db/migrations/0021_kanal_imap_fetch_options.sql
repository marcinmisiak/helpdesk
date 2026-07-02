-- Per-kanałowe opcje pobierania IMAP: usuwanie wiadomości ze skrzynki po pobraniu
-- oraz pobieranie również wiadomości już oznaczonych jako przeczytane (nie tylko UNSEEN).
ALTER TABLE kanal_czatu ADD COLUMN imap_delete_after_fetch TINYINT(1) DEFAULT 0;
ALTER TABLE kanal_czatu ADD COLUMN imap_fetch_seen TINYINT(1) DEFAULT 0;
