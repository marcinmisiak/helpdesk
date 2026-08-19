-- Synchronizacja "poza biurem" z Microsoft (Odpowiedzi automatyczne / Teams "Zaplanuj nieobecność").
-- Opt-in, oddzielny od ms_graph_enabled bo wymaga dodatkowego uprawnienia aplikacyjnego
-- (MailboxSettings.Read) — admin musi je jawnie włączyć po dodaniu i zatwierdzeniu uprawnienia.
ALTER TABLE ustawienia ADD COLUMN ms_graph_sync_ooo TINYINT(1) NOT NULL DEFAULT 0;

-- 'reczne' = ustawione przez pracownika w UI (self-service), 'microsoft' = wpisane przez sync.
-- Sync nigdy nie nadpisuje wiersza z 'reczne' — ręczna edycja ma pierwszeństwo, dopóki użytkownik
-- jej nie wyczyści (co odblokowuje ponowne uzupełnienie z Microsoft przy następnym cyklu).
ALTER TABLE user ADD COLUMN poza_biurem_zrodlo VARCHAR(20) DEFAULT NULL;
