-- Adres e-mail kanału (czat/e-mail) na który wysyłane są powiadomienia o nowych ticketach
-- przypisanych do jego zespołu, gdy nikt z tego zespołu nie jest aktualnie zalogowany.
ALTER TABLE kanal_czatu ADD COLUMN notification_email VARCHAR(255) DEFAULT NULL;
