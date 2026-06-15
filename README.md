# Helpdesk

A helpdesk and ticket management system built with Node.js + React. Supports e-mail integration (IMAP/SMTP), Microsoft/Google OAuth login, LDAP/Active Directory, AI-powered ticket classification (Groq), and multilingual interface (Polish / English / Ukrainian).

🇵🇱 [Wersja polska](README.pl.md)

[![Docker](https://github.com/marcinmisiak/helpdesk/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/marcinmisiak/helpdesk/actions/workflows/docker-publish.yml)

---

## Quick Start — no code needed

The fastest way to run the app. Requires only **Docker** and **Docker Compose v2**.

### Step 1 — Install Docker Compose v2 (if needed)

> Skip this if `docker compose version` already shows `v2.x.x`.

The old `docker-compose` (v1, Python-based) does **not** work on Python 3.12+. Install the v2 plugin:

**Ubuntu / Debian (official Docker repo):**
```bash
sudo apt install docker-compose-plugin
```

**If the package is not found** (Docker installed from system repos, not docker.com):
```bash
mkdir -p ~/.docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/download/v2.29.1/docker-compose-linux-x86_64 \
  -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose
```

Verify: `docker compose version` → should print `Docker Compose version v2.x.x`

---

### Step 2 — Download config files

```bash
curl -O https://raw.githubusercontent.com/marcinmisiak/helpdesk/main/docker-compose.hub.yml
curl -O https://raw.githubusercontent.com/marcinmisiak/helpdesk/main/.env.example
cp .env.example .env
nano .env
```

### Step 3 — Configure `.env`

Minimum required values:

```env
JWT_SECRET=          # random key — generate with: openssl rand -hex 32
DB_PASS=             # any database password
FRONTEND_URL=        # URL where the app will run, e.g. http://192.168.1.10
```

**Web Push notifications (optional but recommended):**

Generate VAPID keys — you can use Docker itself for this:
```bash
docker run --rm node:22-alpine sh -c \
  "npm install -g web-push --silent 2>/dev/null && web-push generate-vapid-keys"
```

Add the output to `.env`:
```env
VAPID_EMAIL=mailto:admin@yourdomain.com
VAPID_PUBLIC_KEY=<paste Public Key>
VAPID_PRIVATE_KEY=<paste Private Key>
```

> If you skip VAPID keys, push notifications will be disabled but the app works normally.

---

### Step 4 — Start

```bash
docker compose -f docker-compose.hub.yml up -d
```

Docker downloads the pre-built images automatically (~200 MB). Wait until all three containers show `Up`:

```bash
docker ps
# helpdesk-db-1        Up (healthy)
# helpdesk-backend-1   Up
# helpdesk-frontend-1  Up
```

> **If the frontend keeps restarting** while the backend is starting up, restart it once manually:
> ```bash
> docker restart helpdesk-frontend-1
> ```
> This happens because nginx starts before the backend is ready and can't resolve the `backend` hostname yet.

---

### Step 5 — Create the first admin account

```bash
docker compose -f docker-compose.hub.yml exec backend node src/scripts/create-admin.js
```

The script asks for e-mail, first name, last name, and password. Then open `http://localhost` and log in.

---

### Updating to the latest version

```bash
docker compose -f docker-compose.hub.yml pull
docker compose -f docker-compose.hub.yml up -d
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, mysql2 |
| Frontend | React 19, Vite, Tailwind CSS |
| Database | MariaDB 11 (Docker) / MySQL 8 (native) |
| Auth | JWT, OAuth 2.0 (Microsoft Entra ID, Google) |
| E-mail | Nodemailer (SMTP), IMAP polling, Microsoft Graph |

## Features

- Ticket management with priorities and SLA tracking
- E-mail integration — receive via IMAP, send via SMTP or Microsoft Graph (M365), threads linked to tickets
- Microsoft and Google OAuth 2.0 login
- LDAP / Active Directory user lookup with configurable user-type cards and external system links
- AI ticket classification (Groq)
- Web Push notifications
- Multilingual interface: Polish, English, Ukrainian (per-user setting + browser auto-detection)
- Roles: `admin`, `pracownik` (agent)
- Public submission form (no login required) with language switcher PL / EN / UA
- Automatic registration confirmation email (configurable)
- Statistics and alerts dashboard
- Automatic schema migrations on every startup (`db/migrations/`)
- All settings configurable from the admin panel

---

## Configuration

All values go in `.env` (copy from `.env.example`):

| Variable | Description | Required |
|---|---|---|
| `JWT_SECRET` | Random secret key (`openssl rand -hex 32`) | ✅ |
| `DB_NAME` / `DB_USER` / `DB_PASS` | Database credentials | ✅ |
| `FRONTEND_URL` | Public app URL (e.g. `https://helpdesk.company.com`) | ✅ |
| `MICROSOFT_CLIENT_ID` / `SECRET` / `TENANT_ID` | Microsoft OAuth | ☑️ optional |
| `GOOGLE_CLIENT_ID` / `SECRET` | Google OAuth | ☑️ optional |
| `VAPID_*` | Web Push (generate: `npx web-push generate-vapid-keys`) | ☑️ optional |
| `GROQ_API_KEY` | AI classification (groq.com) | ☑️ optional |

SMTP, IMAP, Microsoft Graph, and LDAP settings are configured from the admin panel (Settings) — no restart required.

---

## Building from Source (Docker)

For developers who want to modify the code:

```bash
git clone https://github.com/marcinmisiak/helpdesk.git
cd helpdesk
cp .env.example .env
# edit .env
docker compose up --build
```

---

## Native Installation (Linux + Apache)

```bash
npm run install:all        # install all dependencies
npm run frontend:build     # build frontend → frontend/dist/

# Configure Apache as reverse proxy: /api → localhost:3001
# Set variables in backend/.env
# Run as a systemd service
```

## Local Development

```bash
npm run install:all
# Fill in backend/.env (DB_HOST=localhost, etc.)
npm run backend:dev    # backend with nodemon on :3001
npm run frontend       # Vite dev server on :5173
```

---

## Microsoft OAuth Setup

1. Go to [portal.azure.com](https://portal.azure.com) → Azure Active Directory → App registrations → New registration
2. Set Redirect URI: `https://yourdomain.com/api/auth/microsoft/callback` (type: Web)
3. Go to Certificates & secrets → New client secret → copy the **Value**
4. Fill in `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` in `.env`

> Microsoft login only works for users who already have an account in the system with the same e-mail address.

---

## LDAP / Active Directory

When LDAP is enabled, each ticket shows a **user card** with information fetched from the directory. Fully configurable from the admin panel (Settings → LDAP):

- Enable / disable the card globally
- Define labels for user types (e.g. Student, Employee, Lecturer)
- Each label has a condition (LDAP attribute + expected value)
- Optional external link with a URL template using `{attrName}` placeholders

```
https://erp.company.com/users/{employeeNumber}
https://portal.university.edu/student/{uid}
```

---

## Database Migrations

On every startup the backend automatically applies any pending SQL files from `db/migrations/`. Safe on both MariaDB and MySQL 8 — "already exists" errors are silently ignored.

---

## Project Structure

```
helpdesk/
├── backend/              # Express API
│   └── src/
│       ├── routes/       # API endpoints
│       ├── middleware/
│       ├── i18n/         # Email translations (pl / en / uk)
│       └── utils/
├── frontend/             # React SPA
│   └── src/
│       ├── pages/
│       ├── components/
│       └── i18n/         # UI translations (pl / en / uk)
├── db/
│   ├── schema.sql        # Initial schema (MariaDB init on first boot)
│   └── migrations/       # Incremental SQL changes
├── docker-compose.yml        # Build from source
└── docker-compose.hub.yml    # Run from pre-built images (end users)
```

## License

MIT
