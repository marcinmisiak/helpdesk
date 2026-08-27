-- Zaufane domeny nadawców — nadawcy z tych domen (i subdomen) nigdy nie są
-- traktowani jako spam (ani przez lokalną czarną listę/StopForumSpam, ani przez
-- klasyfikator AI), niezależnie od wyniku innych sprawdzeń. Jedna domena na linię.
-- Zasiane wartością, która wcześniej była zaszyta na sztywno w kodzie
-- (spamBlocklist.js), żeby przejście na ustawienie z bazy nic nie zmieniło.
ALTER TABLE ustawienia ADD COLUMN trusted_domains TEXT NULL;
UPDATE ustawienia SET trusted_domains = 'lipinski.edu.pl' WHERE id = 1 AND (trusted_domains IS NULL OR trusted_domains = '');
