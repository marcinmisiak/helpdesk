-- Kierownik zespołu — flaga per-członkostwo, nadawana wyłącznie przez admina
-- (POST/PUT /api/zespoly), nigdy przez samoobsługowy /join.
ALTER TABLE zespol_user ADD COLUMN is_kierownik TINYINT(1) NOT NULL DEFAULT 0;
