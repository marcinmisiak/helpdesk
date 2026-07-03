-- Śledzenie przeczytania opinii (CSAT) przez kierownika/admina oraz udostępnienie
-- konkretnej opinii pracownikowi, który odpowiadał na dane zgłoszenie.
ALTER TABLE ticket ADD COLUMN csat_przeczytane TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE ticket ADD COLUMN csat_pokazany_user_id INT DEFAULT NULL;
ALTER TABLE ticket ADD COLUMN csat_pokazany_at INT DEFAULT NULL;
