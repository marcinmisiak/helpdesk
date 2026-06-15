#!/bin/bash
set -e

echo "=== Helpdesk React + Node.js ==="
echo ""

# Zabij istniejące procesy
pkill -f "node src/app.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

sleep 1

echo "Uruchamianie backendu (port 3001)..."
cd /var/www/html/helpdesk/backend
node src/app.js &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

sleep 2

echo "Uruchamianie frontendu React (port 5173)..."
cd /var/www/html/helpdesk/frontend
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "==================================="
echo "Backend API:  http://localhost:3001"
echo "Frontend:     http://localhost:5173"
echo "==================================="
echo ""
echo "Naciśnij CTRL+C aby zatrzymać"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
