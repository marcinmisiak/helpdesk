-- Integracja webhook z n8n (automatyzacja odpowiedzi)
ALTER TABLE ustawienia ADD COLUMN webhook_enabled TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE ustawienia ADD COLUMN webhook_url VARCHAR(512) DEFAULT NULL;
ALTER TABLE ustawienia ADD COLUMN webhook_secret VARCHAR(255) DEFAULT NULL;
