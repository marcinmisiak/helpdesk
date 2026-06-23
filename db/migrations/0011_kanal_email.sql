-- Typ kanału (chat/email) i konfiguracja IMAP dla kanałów e-mail przypisanych do zespołu
ALTER TABLE kanal_czatu ADD COLUMN typ VARCHAR(10) NOT NULL DEFAULT 'chat';
ALTER TABLE kanal_czatu ADD COLUMN imap_server VARCHAR(255) DEFAULT NULL;
ALTER TABLE kanal_czatu ADD COLUMN imap_port INT DEFAULT NULL;
ALTER TABLE kanal_czatu ADD COLUMN imap_login VARCHAR(255) DEFAULT NULL;
ALTER TABLE kanal_czatu ADD COLUMN imap_password VARCHAR(255) DEFAULT NULL;
ALTER TABLE kanal_czatu ADD COLUMN imap_path VARCHAR(255) DEFAULT NULL;
ALTER TABLE ticket ADD COLUMN kanal_id INT DEFAULT NULL;
ALTER TABLE ticket ADD KEY idx_kanal_id (kanal_id);
