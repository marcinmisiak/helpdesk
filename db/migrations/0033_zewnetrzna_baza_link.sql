-- Opcjonalny link budowany z danych zwróconych z zewnętrznej bazy (np. link do karty
-- studenta w innym systemie). link_url_wzor/link_tekst_wzor to szablony z placeholderami
-- {NAZWA_KOLUMNY} podstawianymi wartościami z wiersza wyniku; link_warunek_pole to nazwa
-- kolumny, która musi być niepusta, żeby link w ogóle był zbudowany (np. "STUDIA_ID").
ALTER TABLE zewnetrzna_baza ADD COLUMN link_url_wzor VARCHAR(500) DEFAULT NULL;
ALTER TABLE zewnetrzna_baza ADD COLUMN link_tekst_wzor VARCHAR(255) DEFAULT NULL;
ALTER TABLE zewnetrzna_baza ADD COLUMN link_warunek_pole VARCHAR(128) DEFAULT NULL;
