FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /data /app/data

COPY package.json package-lock.json* pnpm-lock.yaml* ./ 

# Prefer npm for simpler Docker builds; lockfile optional
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
COPY public ./public

RUN npm install --include=dev typescript tsx @types/node @types/better-sqlite3 \
  && npm run build \
  && mkdir -p dist/public \
  && cp -r public/* dist/public/ \
  && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/bot.sqlite

EXPOSE 3000

CMD ["node", "dist/index.js"]
