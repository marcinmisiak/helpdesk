-- "Poza biurem" — self-service okres nieobecności pracownika (urlop/przerwa). Unix epoch
-- (sekundy), jak inne timestampy w projekcie. Oba NULL = użytkownik dostępny.
ALTER TABLE user ADD COLUMN poza_biurem_od INT DEFAULT NULL;
ALTER TABLE user ADD COLUMN poza_biurem_do INT DEFAULT NULL;
ALTER TABLE user ADD COLUMN poza_biurem_powod VARCHAR(255) DEFAULT NULL;
