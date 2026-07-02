-- Kanał e-mail: opcja automatycznego zamykania ticketu od razu po utworzeniu z pobranej wiadomości.
ALTER TABLE kanal_czatu ADD COLUMN auto_close_ticket TINYINT(1) DEFAULT 0;
