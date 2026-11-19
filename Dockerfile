# ChronoStudy — Zero-Dependency Static PWA Container
FROM node:22-alpine

WORKDIR /app

COPY package.json server.mjs index.html manifest.json sw.js icon.svg ./
COPY src ./src

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/manifest.json || exit 1

CMD ["node", "server.mjs"]
