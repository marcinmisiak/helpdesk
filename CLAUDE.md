# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands are run from the repository root unless noted.

```bash
npm run install:all      # install both backend and frontend dependencies
npm run backend:dev      # start backend with nodemon (auto-reload)
npm run frontend         # start Vite dev server (exposed on 0.0.0.0)
npm run frontend:build   # build frontend for production (output: frontend/dist/)
npm start                # start both services (via start.sh)

cd frontend && npm run lint   # ESLint check
```

No automated test suite exists. After backend API changes, validate manually:
- `GET /api/health` → `{ status: 'ok' }`
- Request without token → 401
- Request with wrong role → 403

## Architecture

**Backend** (`backend/src/`): Express.js + MySQL (mysql2 promise pool). All route handlers live directly in route files — no separate controller layer.

- `app.js` — mounts all routes, CORS (origin from `FRONTEND_URL` env), static file serving at `/pliki`
- `config/db.js` — mysql2 connection pool (env vars: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`)
- `middleware/auth.js` — `authenticate` (JWT → DB user lookup), `requireAdmin`, `requireWorker`, `requireRole`
- `routes/` — one file per domain: `tickets`, `korespondencja`, `notatki`, `pliki`, `users`, `ustawienia`, `statystyki`, `alerts`, `auth`
- `utils/mailer.js` — nodemailer; SMTP config loaded from `ustawienia` DB table (id=1) at send time, not from env

**Frontend** (`frontend/src/`): React 19 + Vite + Tailwind CSS.

- `App.jsx` — all routes defined here; role-based redirects on login
- `context/AuthContext.jsx` — stores `user` + `token` in `localStorage`; exposes `isAdmin`, `isWorker`, `login`, `logout`
- `components/ProtectedRoute.jsx` — redirects unauthenticated to `/login`; `adminOnly` prop blocks `pracownik` role
- `api/client.js` — Axios instance (base: `VITE_API_URL`); auto-attaches Bearer token; redirects to `/login` on 401
- `pages/` — one page component per route

## Key Conventions

**Roles**: `admin` and `pracownik`. Roles are stored in `auth_assignment.item_name` (Yii2-compatible schema), joined via user query in `authenticate`. When changing access rules, update both frontend (`ProtectedRoute`/`App.jsx`) and backend middleware simultaneously.

**Timestamps**: Stored as Unix epoch integers (seconds), not SQL DATETIME.

**Ticket status**: `1` = new, `2` = in-progress/assigned, `3` = closed. Closing is soft (status=3).

**Error responses**: Always `{ error: "message" }` JSON. Never throw raw errors to the client.

**Email**: SMTP settings come from the `ustawienia` DB table, not environment variables. The `mailer` module fetches them on each send.

**File uploads**: Attachments are served from `UPLOAD_DIR` (env, default `/var/www/html/pomoc/pliki`) — this path is outside the repo and shared with a legacy Yii2 app.

## Environment

Backend `.env` variables: `PORT`, `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `UPLOAD_DIR`, `FRONTEND_URL`.

Frontend `.env` variable: `VITE_API_URL` (dev default: `http://localhost:3001/api`; production uses `.env.production`).
