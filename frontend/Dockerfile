# Kontekst budowania: katalog główny repozytorium (docker-compose: context: .)
FROM node:22-alpine AS builder
WORKDIR /app/frontend

ARG VITE_API_URL=/api
ARG VITE_VAPID_PUBLIC_KEY=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY

# Root package.json (potrzebny do odczytu wersji przez vite.config.js)
COPY package.json /app/package.json

COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
