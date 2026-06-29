-- Dodatkowa autoryzacja kodem e-mail na publicznej stronie statusu zgłoszenia (/status/:token).
ALTER TABLE ticket ADD COLUMN status_otp_code VARCHAR(10) DEFAULT NULL;
ALTER TABLE ticket ADD COLUMN status_otp_expires INT DEFAULT NULL;
ALTER TABLE ticket ADD COLUMN status_otp_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE ustawienia ADD COLUMN status_otp_enabled TINYINT(1) NOT NULL DEFAULT 1;
