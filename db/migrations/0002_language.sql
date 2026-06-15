-- Język aplikacji i preferencje językowe użytkowników
ALTER TABLE ustawienia ADD COLUMN app_language varchar(5) NOT NULL DEFAULT 'pl';
ALTER TABLE user ADD COLUMN language varchar(5) DEFAULT NULL;
