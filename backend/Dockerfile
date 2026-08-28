# Kontekst budowania: katalog główny repozytorium (docker-compose: context: .)
FROM node:22-alpine AS deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ .
COPY db /db
USER node
EXPOSE 3001
CMD ["node", "src/app.js"]
