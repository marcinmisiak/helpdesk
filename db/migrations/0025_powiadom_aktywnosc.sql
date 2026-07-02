-- Przełącznik: pokazuj w aplikacji powiadomienie toast, gdy użytkownik loguje się
-- lub opuszcza system (Layout.jsx#onUserOnline/onUserOffline). Domyślnie włączony —
-- zachowuje dotychczasowe, bezwarunkowe zachowanie.
ALTER TABLE ustawienia ADD COLUMN powiadom_aktywnosc TINYINT(1) NOT NULL DEFAULT 1;
