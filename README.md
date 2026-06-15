# Helpdesk

A helpdesk and ticket management system built with Node.js + React. Supports e-mail integration (IMAP/SMTP), Microsoft/Google OAuth login, LDAP/Active Directory, and AI-powered ticket classification (Groq).

🇵🇱 [Polish version / Wersja polska](README.pl.md)

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, mysql2 |
| Frontend | React 19, Vite, Tailwind CSS |
| Database | MariaDB 11 (Docker) / MySQL 8 (native) |
| Auth | JWT, OAuth 2.0 (Microsoft Entra ID, Google) |
| E-mail | Nodemailer (SMTP), IMAP polling |

## Features

- Ticket management with priorities and SLA tracking
- E-mail integration — receive via IMAP, send via SMTP or Microsoft Graph (M365), threads linked to tickets
- Microsoft and Google OAuth 2.0 login (buttons shown automatically when credentials are set)
- LDAP / Active Directory user lookup with configurable user-type cards and external system links
- AI ticket classification (Groq)
- Web Push notifications
- Roles: `admin`, `pracownik` (agent)
- Public submission form (no login required)
- Statistics and alerts dashboard
- Automatic schema migrations on every startup (`db/migrations/`)
- All settings configurable from the admin panel — app name, branding, SMTP, LDAP, reminders

## Quick Start (Docker)

**Requirements:** Docker, Docker Compose

```bash
git clone https://github.com/your-username/helpdesk.git
cd helpdesk
cp .env.example .env
```

Edit `.env` — set at minimum `JWT_SECRET` and database passwords, then:

```bash
docker compose up --build
```

The app will be available at `http://localhost`.

### Creating the first admin account

The database starts empty — use the bundled script to create the first admin:

**Docker:**
```bash
docker compose exec backend node src/scripts/create-admin.js
```

**Native:**
```bash
cd /var/www/html/helpdesk/backend
node src/scripts/create-admin.js
```

The script asks for e-mail, first name, last name, and password interactively. The password is never shown on screen.

## Configuration

Copy `.env.example` → `.env` and fill in the values:

| Variable | Description | Required |
|---|---|---|
| `JWT_SECRET` | Random secret key (`openssl rand -hex 32`) | ✅ |
| `DB_NAME` / `DB_USER` / `DB_PASS` | Database credentials | ✅ |
| `FRONTEND_URL` | Public app URL (e.g. `https://helpdesk.company.com`) | ✅ |
| `MICROSOFT_CLIENT_ID` / `SECRET` / `TENANT_ID` | Microsoft OAuth | ☑️ optional |
| `GOOGLE_CLIENT_ID` / `SECRET` | Google OAuth | ☑️ optional |
| `VAPID_*` | Web Push (generate: `npx web-push generate-vapid-keys`) | ☑️ optional |
| `GROQ_API_KEY` | AI classification (groq.com) | ☑️ optional |

SMTP, IMAP, Microsoft Graph, and LDAP settings are configured from the admin panel (Settings).

### App name in e-mail subjects

The **app name** set in Settings (admin panel → General) is used as a prefix in every outgoing e-mail subject:

```
[YourAppName] New ticket #42
[YourAppName] Reminder: 3 tickets waiting for a reply
```

Changing the name takes effect immediately for all subsequent messages.

## Microsoft OAuth Setup

1. Go to [portal.azure.com](https://portal.azure.com) → Azure Active Directory → App registrations → New registration
2. Set Redirect URI: `https://yourdomain.com/api/auth/microsoft/callback` (type: Web)
3. Go to Certificates & secrets → New client secret → copy the **Value**
4. Fill in `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` in `.env`

> Microsoft login only works for users who already have an account in the system with the same e-mail address.

## LDAP User Card

When LDAP is enabled, each ticket shows a **user card** with information fetched from the directory. The card is fully configurable from the admin panel (Settings → LDAP → Card in ticket view):

- **Enable / disable** the card globally
- Define **labels** for different user types (e.g. Student, Employee, Lecturer)
- Each label has a **condition** (LDAP attribute + expected value) that determines when it matches
- Optional **external link** with a URL template — use `{attrName}` placeholders for LDAP attributes:

```
https://erp.company.com/users/{employeeNumber}
https://portal.university.edu/student/{uid}
```

Labels are checked in order; the first matching one is displayed.

## Database Migrations

On every startup the backend automatically applies any pending SQL files from `db/migrations/`.

To add a schema change:

```bash
echo "ALTER TABLE ticket ADD COLUMN custom_priority tinyint DEFAULT 0;" \
  > db/migrations/0001_custom_priority.sql

# Apply by restarting the backend
docker compose restart backend
```

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

## Project Structure

```
helpdesk/
├── backend/              # Express API
│   └── src/
│       ├── routes/       # API endpoints
│       ├── middleware/
│       └── utils/
├── frontend/             # React SPA
│   └── src/
│       ├── pages/
│       └── components/
├── db/
│   ├── schema.sql        # Initial schema (MariaDB init on first boot)
│   └── migrations/       # Incremental SQL changes
└── docker-compose.yml
```

## License

MIT
