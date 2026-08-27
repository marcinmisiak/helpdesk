-- Przypisanie zespołu do kategorii zgłoszenia. NULL = brak automatycznego routingu
-- (zachowanie sprzed tej migracji — zgłoszenie z formularza trafia tylko do puli adminów).
ALTER TABLE kategoria_zgloszenia ADD COLUMN zespol_id INT DEFAULT NULL;
ALTER TABLE kategoria_zgloszenia ADD KEY idx_kategoria_zespol (zespol_id);
