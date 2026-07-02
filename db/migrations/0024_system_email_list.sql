-- Lista adresów e-mail traktowanych jako "systemowe" (np. automatyczne skrzynki
-- monitoringu) — zgłoszenia z tych adresów nie otrzymują żadnej automatycznej
-- korespondencji zwrotnej (ani potwierdzenia rejestracji, ani odpowiedzi, ani
-- ankiety CSAT, ani przypomnień). Jeden adres na linię.
ALTER TABLE ustawienia ADD COLUMN system_email_list TEXT NULL;
