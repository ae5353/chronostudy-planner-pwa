# ChronoStudy v2.0 — Self-Hosted Multi-Platform PWA + Sync & WebCal Server
FROM node:22-alpine

WORKDIR /app

# Copy application source, PWA assets, CLI, and Sync Server
COPY package.json ./
COPY index.html manifest.webmanifest sw.js ./
COPY src ./src
COPY cli ./cli
COPY server ./server
COPY capacitor.config.json ./

ENV NODE_ENV=production
ENV PORT=4173
ENV HOST=0.0.0.0

EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4173/api/health || exit 1

CMD ["node", "server/sync-server.mjs"]
