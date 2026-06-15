# AGENTS.md

Instrukcje dla agentów AI pracujących w repozytorium Helpdesk.

## 1. Szybki start

- Instalacja zależności (root): `npm run install:all`
- Dev backend (root): `npm run backend:dev`
- Dev frontend (root): `npm run frontend`
- Start obu usług (root): `npm start`
- Build frontend (root): `npm run frontend:build`

Szczegóły uruchamiania produkcyjnego:
- [start.sh](start.sh) — uruchamia backend i frontend równolegle (dev)
- Docker: `docker compose up --build`

## 2. Mapa architektury

- Backend: Express + MySQL w [backend/src/app.js](backend/src/app.js)
- Trasy API: [backend/src/routes](backend/src/routes)
- Middleware auth/role: [backend/src/middleware/auth.js](backend/src/middleware/auth.js)
- Połączenie DB: [backend/src/config/db.js](backend/src/config/db.js)
- Frontend: React + Vite w [frontend/src/App.jsx](frontend/src/App.jsx)
- Auth context: [frontend/src/context/AuthContext.jsx](frontend/src/context/AuthContext.jsx)
- HTTP client: [frontend/src/api/client.js](frontend/src/api/client.js)

## 3. Konwencje projektu

- Backend:
  - Trzymaj logikę endpointu blisko trasy w plikach `backend/src/routes/*.js` (obecny styl projektu).
  - Używaj middleware `authenticate` oraz `requireAdmin`/`requireWorker` do kontroli dostępu.
  - Odpowiedzi błędów zwracaj jako JSON z polem `error`.
- Frontend:
  - Komponenty i strony: PascalCase (`*.jsx`).
  - Uwierzytelnienie i przekierowania opieraj na `AuthContext` i `ProtectedRoute`.
  - Zapytania HTTP prowadź przez wspólnego klienta Axios w `frontend/src/api/client.js`.

## 4. Role i routing

- Role używane w projekcie: `admin`, `pracownik`.
- Routing i ograniczenia ról frontend: [frontend/src/App.jsx](frontend/src/App.jsx)
- Weryfikacja ról backend: [backend/src/middleware/auth.js](backend/src/middleware/auth.js)

Przy zmianach uprawnień aktualizuj jednocześnie frontend i backend.

## 5. Walidacja zmian

- Frontend lint: `cd frontend && npm run lint`
- Frontend build: `cd frontend && npm run build`
- Brak testów automatycznych w repozytorium: wykonuj walidację manualną endpointów i ścieżek UI.

Minimalna walidacja po zmianach backend API:
- sprawdź `GET /api/health`
- sprawdź scenariusz bez tokenu (401)
- sprawdź scenariusz z niewłaściwą rolą (403)

## 6. Pułapki środowiskowe

- CORS zależy od `FRONTEND_URL` (fallback localhost) w [backend/src/app.js](backend/src/app.js).
- Statyczne załączniki są serwowane z `UPLOAD_DIR` (domyślnie ścieżka poza repo) w [backend/src/app.js](backend/src/app.js).
- `install.sh` wymaga uruchomienia jako root i zakłada obecność Apache/systemd/certbot.

## 7. Zakres dokumentacji

- [frontend/README.md](frontend/README.md) opisuje ogólny szablon Vite i nie dokumentuje domeny Helpdesk.
- Jeśli dodajesz nowy obszar funkcjonalny, dopisz krótki opis do tego pliku i link do kluczowych plików implementacji.
