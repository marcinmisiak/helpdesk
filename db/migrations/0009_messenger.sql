-- Integracja Facebook Messenger (Graph API)
ALTER TABLE ustawienia ADD COLUMN messenger_enabled TINYINT(1) DEFAULT 0;
ALTER TABLE ustawienia ADD COLUMN messenger_page_id VARCHAR(32) DEFAULT NULL;
ALTER TABLE ustawienia ADD COLUMN messenger_page_access_token VARCHAR(512) DEFAULT NULL;
ALTER TABLE ustawienia ADD COLUMN messenger_app_secret VARCHAR(128) DEFAULT NULL;
ALTER TABLE ustawienia ADD COLUMN messenger_verify_token VARCHAR(64) DEFAULT NULL;
ALTER TABLE ustawienia ADD COLUMN messenger_zespol_id INT DEFAULT NULL;
ALTER TABLE ticket ADD COLUMN messenger_psid VARCHAR(64) DEFAULT NULL;
ALTER TABLE ticket ADD KEY idx_messenger_psid (messenger_psid);
ALTER TABLE ticket ADD COLUMN messenger_last_user_message_at INT DEFAULT NULL;
