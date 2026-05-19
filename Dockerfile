FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html ./
COPY src ./src
RUN npx vite build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache ca-certificates && update-ca-certificates
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.js ./
COPY server ./server
COPY --from=build /app/dist ./public
EXPOSE 5034
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -q -O /dev/null http://127.0.0.1:5034/api/health || exit 1
CMD ["node", "server.js"]
