-- Ankieta satysfakcji (CSAT) po zamknięciu zgłoszenia
ALTER TABLE ticket ADD COLUMN csat_token VARCHAR(64) DEFAULT NULL;
ALTER TABLE ticket ADD KEY idx_csat_token (csat_token);
ALTER TABLE ticket ADD COLUMN csat_sent_at INT DEFAULT NULL;
ALTER TABLE ticket ADD COLUMN csat_rating TINYINT DEFAULT NULL;
ALTER TABLE ticket ADD COLUMN csat_comment TEXT DEFAULT NULL;
ALTER TABLE ticket ADD COLUMN csat_submitted_at INT DEFAULT NULL;
ALTER TABLE ustawienia ADD COLUMN csat_survey_enabled TINYINT(1) DEFAULT 1;
