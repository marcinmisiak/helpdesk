# Helpdesk

System obsługi zgłoszeń zbudowany na Node.js + React. Umożliwia zarządzanie ticketami, komunikację z użytkownikami przez e-mail (IMAP/SMTP), logowanie przez Microsoft/Google OAuth oraz integrację z LDAP i AI (Groq).

## Stos technologiczny

| Warstwa | Technologia |
|---|---|
| Backend | Node.js, Express, mysql2 |
| Frontend | React 19, Vite, Tailwind CSS |
| Baza danych | MariaDB 11 (Docker) / MySQL 8 (natywny) |
| Auth | JWT, OAuth 2.0 (Microsoft Entra ID, Google) |
| E-mail | Nodemailer (SMTP), IMAP polling |

## Funkcje

- Zarządzanie zgłoszeniami (ticketami) z priorytetami i SLA
- Korespondencja e-mail zintegrowana z ticketami (odbieranie przez IMAP, wysyłanie przez SMTP)
- Logowanie przez konto Microsoft lub Google (OAuth 2.0)
- Logowanie przez LDAP / Active Directory
- Klasyfikacja zgłoszeń przez AI (Groq)
- Powiadomienia push (Web Push API)
- Role: `admin`, `pracownik`
- Publiczny formularz zgłoszeniowy (bez logowania)
- Panel statystyk i alertów

## Szybki start (Docker)

**Wymagania:** Docker, Docker Compose

```bash
git clone https://github.com/twoj-uzytkownik/helpdesk.git
cd helpdesk
cp .env.example .env
```

Edytuj `.env` — ustaw co najmniej `JWT_SECRET` oraz hasła bazy danych, potem:

```bash
docker compose up --build
```

Aplikacja dostępna pod `http://localhost`.

### Pierwsze logowanie

Po uruchomieniu baza jest pusta — utwórz pierwszego administratora za pomocą dołączonego skryptu:

**Docker:**
```bash
docker compose exec backend node src/scripts/create-admin.js
```

**Natywny:**
```bash
cd /var/www/html/helpdesk/backend
node src/scripts/create-admin.js
```

Skrypt pyta interaktywnie o e-mail, imię, nazwisko i hasło. Hasło nie jest wyświetlane na ekranie.

## Konfiguracja

Skopiuj `.env.example` → `.env` i uzupełnij:

| Zmienna | Opis | Wymagana |
|---|---|---|
| `JWT_SECRET` | Losowy klucz JWT (`openssl rand -hex 32`) | ✅ |
| `DB_NAME` / `DB_USER` / `DB_PASS` | Dane bazy danych | ✅ |
| `FRONTEND_URL` | URL aplikacji (np. `https://helpdesk.firma.pl`) | ✅ |
| `MICROSOFT_CLIENT_ID` / `SECRET` / `TENANT_ID` | OAuth Microsoft | ☑️ opcjonalna |
| `GOOGLE_CLIENT_ID` / `SECRET` | OAuth Google | ☑️ opcjonalna |
| `VAPID_*` | Web Push (generuj: `npx web-push generate-vapid-keys`) | ☑️ opcjonalna |
| `GROQ_API_KEY` | Klasyfikacja AI (groq.com) | ☑️ opcjonalna |

Ustawienia SMTP, IMAP i LDAP konfiguruje się z poziomu panelu admina (Ustawienia).

## OAuth Microsoft

1. [portal.azure.com](https://portal.azure.com) → Azure Active Directory → App registrations → New registration
2. Redirect URI: `https://twojadomena.pl/api/auth/microsoft/callback` (typ: Web)
3. Certificates & secrets → New client secret → skopiuj wartość
4. Uzupełnij `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` w `.env`

Logowanie przez Microsoft działa tylko dla użytkowników z istniejącym kontem (ten sam e-mail).

## Migracje bazy danych

Przy starcie backend automatycznie stosuje pliki SQL z `db/migrations/`.

Aby dodać zmianę schematu:

```bash
# Utwórz plik migracji
echo "ALTER TABLE ticket ADD COLUMN priorytet_niestandardowy tinyint DEFAULT 0;" \
  > db/migrations/0001_priorytet_niestandardowy.sql

# Zastosuj (restart backendu)
docker compose restart backend
# lub natywnie:
systemctl restart helpdesk
```

## Instalacja natywna (Linux + Apache)

```bash
npm run install:all          # instalacja zależności
npm run frontend:build       # build frontendu → frontend/dist/

# Skonfiguruj Apache jako reverse proxy dla /api → localhost:3001
# Ustaw zmienne w backend/.env
# Uruchom jako usługę systemd
```

Szczegóły konfiguracji Apache i systemd zależą od środowiska serwera.

## Rozwój lokalny

```bash
npm run install:all
# Uzupełnij backend/.env (DB_HOST=localhost itd.)
npm run backend:dev    # backend z nodemon na :3001
npm run frontend       # Vite dev server na :5173
```

## Struktura projektu

```
helpdesk/
├── backend/          # Express API
│   └── src/
│       ├── routes/   # Endpointy API
│       ├── middleware/
│       └── utils/
├── frontend/         # React SPA
│   └── src/
│       ├── pages/
│       └── components/
├── db/
│   ├── schema.sql        # Schemat początkowy (MariaDB init)
│   └── migrations/       # Przyrostowe zmiany SQL
└── docker-compose.yml
```

## Licencja

MIT
