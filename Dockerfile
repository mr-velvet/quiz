FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html ./
COPY src ./src
COPY public/manifest.json ./public/manifest.json
COPY public/sw.js ./public/sw.js
RUN npx vite build
# Copia assets estáticos extras pro dist final (PWA + sons)
COPY public/sounds ./dist/sounds
COPY public/assets/icon-192.png public/assets/icon-512.png public/assets/icon-192-maskable.png public/assets/icon-512-maskable.png public/assets/apple-touch-icon.png ./dist/assets/
COPY public/manifest.json ./dist/manifest.json
COPY public/sw.js ./dist/sw.js

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.js ./
COPY server ./server
COPY migrations ./migrations
COPY --from=build /app/dist ./public
EXPOSE 5034
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -q -O /dev/null http://127.0.0.1:5034/api/health || exit 1
CMD ["node", "server.js"]
