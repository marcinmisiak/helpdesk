-- Konfigurowalna karta LDAP w widoku zgłoszenia
ALTER TABLE ustawienia
  ADD COLUMN ldap_card_enabled tinyint(1) NOT NULL DEFAULT 1,
  ADD COLUMN ldap_labels text DEFAULT NULL;

-- Przepisanie obecnych hardkodowanych etykiet do konfiguracji
UPDATE ustawienia SET
  ldap_card_enabled = 1,
  ldap_labels = '[{"label":"Student","icon":"🎓","condition_field":"ldap_ou","condition_value":"studenci","link_template":"https://lan.lipinski.edu.pl/stud/{studid}","link_label":"Kartoteka studenta"},{"label":"Wykładowca","icon":"👨‍🏫","condition_field":"ldap_ou","condition_value":"wykladowcy","link_template":"https://lan.lipinski.edu.pl/prowadzacy/{prow_id}","link_label":"Kartoteka wykładowcy"}]'
WHERE id = 1;
