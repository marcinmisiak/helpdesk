-- Kanały e-mail: opcjonalne połączenie przez Microsoft Graph (współdzielona aplikacja
-- Azure skonfigurowana w ustawienia.ms_graph_client_id/secret/tenant_id) zamiast IMAP.
ALTER TABLE kanal_czatu ADD COLUMN ms_graph_enabled TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE kanal_czatu ADD COLUMN ms_graph_mailbox VARCHAR(255) DEFAULT NULL;
