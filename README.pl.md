# Helpdesk

System obsługi zgłoszeń zbudowany na Node.js + React. Zarządzanie ticketami, komunikacja przez e-mail (IMAP/SMTP), logowanie Microsoft/Google OAuth, integracja z LDAP i AI (Groq). Interfejs w języku polskim, angielskim i ukraińskim.

🇬🇧 [English version](README.md)

[![Docker](https://github.com/marcinmisiak/helpdesk/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/marcinmisiak/helpdesk/actions/workflows/docker-publish.yml)

---

## Szybki start — bez pobierania kodu

Najszybszy sposób uruchomienia aplikacji. Potrzebny jest tylko **Docker** i **Docker Compose v2**.

### Krok 1 — Zainstaluj Docker Compose v2 (jeśli potrzebne)

> Pomiń ten krok jeśli `docker compose version` pokazuje już `v2.x.x`.

Stary `docker-compose` (v1, oparty na Pythonie) **nie działa** na Pythonie 3.12+. Zainstaluj plugin v2:

**Ubuntu / Debian (oficjalne repo Dockera):**
```bash
sudo apt install docker-compose-plugin
```

**Jeśli pakiet nie zostanie znaleziony** (Docker zainstalowany z repozytoriów systemowych, nie z docker.com):
```bash
mkdir -p ~/.docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/download/v2.29.1/docker-compose-linux-x86_64 \
  -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose
```

Weryfikacja: `docker compose version` → powinno wyświetlić `Docker Compose version v2.x.x`

---

### Krok 2 — Pobierz pliki konfiguracyjne

```bash
curl -O https://raw.githubusercontent.com/marcinmisiak/helpdesk/main/docker-compose.hub.yml
curl -O https://raw.githubusercontent.com/marcinmisiak/helpdesk/main/.env.example
cp .env.example .env
nano .env
```

### Krok 3 — Skonfiguruj `.env`

Minimalne wymagane wartości:

```env
JWT_SECRET=          # losowy klucz — wygeneruj: openssl rand -hex 32
DB_PASS=             # dowolne hasło do bazy danych
FRONTEND_URL=        # adres aplikacji, np. http://192.168.1.10
```

**Powiadomienia push (opcjonalne, ale zalecane):**

Wygeneruj klucze VAPID — możesz do tego użyć samego Dockera:
```bash
docker run --rm node:22-alpine sh -c \
  "npm install -g web-push --silent 2>/dev/null && web-push generate-vapid-keys"
```

Dopisz wynik do `.env`:
```env
VAPID_EMAIL=mailto:admin@twojadomena.pl
VAPID_PUBLIC_KEY=<wklej Public Key>
VAPID_PRIVATE_KEY=<wklej Private Key>
```

> Jeśli pominiesz klucze VAPID, powiadomienia push będą wyłączone, ale aplikacja działa normalnie.

---

### Krok 4 — Uruchom

```bash
docker compose -f docker-compose.hub.yml up -d
```

Docker automatycznie pobiera gotowe obrazy (~200 MB). Poczekaj aż wszystkie trzy kontenery pokażą `Up`:

```bash
docker ps
# helpdesk-db-1        Up (healthy)
# helpdesk-backend-1   Up
# helpdesk-frontend-1  Up
```

> **Jeśli frontend ciągle się restartuje** podczas gdy backend dopiero startuje, zrestartuj go raz ręcznie:
> ```bash
> docker restart helpdesk-frontend-1
> ```
> Dzieje się tak dlatego, że nginx startuje przed backendem i nie może rozwiązać nazwy hosta `backend`.

---

### Krok 5 — Utwórz pierwsze konto administratora

```bash
docker compose -f docker-compose.hub.yml exec backend node src/scripts/create-admin.js
```

Skrypt pyta o e-mail, imię, nazwisko i hasło. Następnie otwórz `http://localhost` i zaloguj się.

---

### Aktualizacja do najnowszej wersji

```bash
docker compose -f docker-compose.hub.yml pull
docker compose -f docker-compose.hub.yml up -d
```

---

## Stos technologiczny

| Warstwa | Technologia |
|---|---|
| Backend | Node.js, Express, mysql2 |
| Frontend | React 19, Vite, Tailwind CSS |
| Baza danych | MariaDB 11 (Docker) / MySQL 8 (natywny) |
| Auth | JWT, OAuth 2.0 (Microsoft Entra ID, Google) |
| E-mail | Nodemailer (SMTP), IMAP polling, Microsoft Graph |

## Funkcje

- Zarządzanie zgłoszeniami (ticketami) z priorytetami i SLA
- Integracja e-mail — odbiór przez IMAP, wysyłka przez SMTP lub Microsoft Graph (M365)
- Logowanie przez konto Microsoft lub Google (OAuth 2.0)
- Integracja z LDAP / Active Directory — karta użytkownika w zgłoszeniu z konfigurowalnymi etykietami
- Klasyfikacja zgłoszeń przez AI (Groq)
- Powiadomienia push (Web Push API)
- Wielojęzyczny interfejs: polski, angielski, ukraiński (ustawienie per użytkownik + wykrywanie języka przeglądarki)
- Role: `admin`, `pracownik`
- Publiczny formularz zgłoszeniowy (bez logowania) z przełącznikiem języka PL / EN / UA
- Automatyczne potwierdzenie przyjęcia zgłoszenia e-mailem (opcja do włączenia)
- Panel statystyk i alertów
- Automatyczne migracje schematu przy każdym starcie (`db/migrations/`)
- Wszystkie ustawienia konfigurowane z panelu admina

---

## Konfiguracja

Wszystkie wartości wpisuje się do `.env` (skopiuj z `.env.example`):

| Zmienna | Opis | Wymagana |
|---|---|---|
| `JWT_SECRET` | Losowy klucz JWT (`openssl rand -hex 32`) | ✅ |
| `DB_NAME` / `DB_USER` / `DB_PASS` | Dane bazy danych | ✅ |
| `FRONTEND_URL` | URL aplikacji (np. `https://helpdesk.firma.pl`) | ✅ |
| `MICROSOFT_CLIENT_ID` / `SECRET` / `TENANT_ID` | OAuth Microsoft | ☑️ opcjonalna |
| `GOOGLE_CLIENT_ID` / `SECRET` | OAuth Google | ☑️ opcjonalna |
| `VAPID_*` | Web Push (generuj: `npx web-push generate-vapid-keys`) | ☑️ opcjonalna |
| `GROQ_API_KEY` | Klasyfikacja AI (groq.com) | ☑️ opcjonalna |

Ustawienia SMTP, IMAP, Microsoft Graph i LDAP konfiguruje się z poziomu panelu admina (Ustawienia) — bez restartu.

---

## Budowanie ze źródeł (Docker)

Dla developerów, którzy chcą modyfikować kod:

```bash
git clone https://github.com/marcinmisiak/helpdesk.git
cd helpdesk
cp .env.example .env
# edytuj .env
docker compose up --build
```

---

## Instalacja natywna (Linux + Apache)

```bash
npm run install:all          # instalacja zależności
npm run frontend:build       # build frontendu → frontend/dist/

# Skonfiguruj Apache jako reverse proxy dla /api → localhost:3001
# Ustaw zmienne w backend/.env
# Uruchom jako usługę systemd
```

## Rozwój lokalny

```bash
npm run install:all
# Uzupełnij backend/.env (DB_HOST=localhost itd.)
npm run backend:dev    # backend z nodemon na :3001
npm run frontend       # Vite dev server na :5173
```

---

## OAuth Microsoft

1. [portal.azure.com](https://portal.azure.com) → Azure Active Directory → App registrations → New registration
2. Redirect URI: `https://twojadomena.pl/api/auth/microsoft/callback` (typ: Web)
3. Certificates & secrets → New client secret → skopiuj wartość
4. Uzupełnij `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` w `.env`

Logowanie przez Microsoft działa tylko dla użytkowników z istniejącym kontem (ten sam e-mail).

---

## LDAP / Active Directory

Gdy LDAP jest włączony, na każdym zgłoszeniu wyświetla się **karta użytkownika** z danymi z katalogu. Konfiguracja z panelu admina (Ustawienia → LDAP):

- Włącz / wyłącz kartę globalnie
- Zdefiniuj etykiety dla typów użytkowników (np. Student, Pracownik, Wykładowca)
- Każda etykieta ma warunek (atrybut LDAP + oczekiwana wartość)
- Opcjonalny link zewnętrzny z szablonem URL używającym `{nazwaAtrybutu}`

```
https://erp.firma.pl/pracownik/{employeeNumber}
https://dziekanat.uczelnia.pl/student/{uid}
```

---

## Migracje bazy danych

Przy każdym starcie backend automatycznie stosuje pliki SQL z `db/migrations/`. Działa bezpiecznie na MariaDB i MySQL 8 — błędy „kolumna już istnieje" są pomijane.

---

## Struktura projektu

```
helpdesk/
├── backend/              # Express API
│   └── src/
│       ├── routes/       # Endpointy API
│       ├── middleware/
│       ├── i18n/         # Tłumaczenia e-maili (pl / en / uk)
│       └── utils/
├── frontend/             # React SPA
│   └── src/
│       ├── pages/
│       ├── components/
│       └── i18n/         # Tłumaczenia interfejsu (pl / en / uk)
├── db/
│   ├── schema.sql            # Schemat początkowy (MariaDB init)
│   └── migrations/           # Przyrostowe zmiany SQL
├── docker-compose.yml        # Budowanie ze źródeł
└── docker-compose.hub.yml    # Uruchomienie z gotowych obrazów (użytkownicy końcowi)
```

## Licencja

MIT
