FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Persistent data dir (Railway volume should mount here)
RUN mkdir -p /data

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
COPY public ./public

RUN npm run build \
  && mkdir -p dist/public \
  && cp -r public/* dist/public/

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/bot.sqlite

EXPOSE 3000

CMD ["node", "dist/index.js"]
