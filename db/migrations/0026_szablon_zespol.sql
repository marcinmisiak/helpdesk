-- Przypisanie szablonów odpowiedzi do zespołu. NULL = szablon globalny
-- (widoczny dla wszystkich, edytowalny tylko przez admina).
ALTER TABLE szablon_odpowiedzi ADD COLUMN zespol_id INT DEFAULT NULL;
ALTER TABLE szablon_odpowiedzi ADD KEY idx_szablon_zespol (zespol_id);
