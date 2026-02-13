FROM node:20-slim AS base

# 1. 依賴階段
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

# 2. 建置階段
FROM base AS builder
# 安裝 openssl（Prisma 在 build 時需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=3072"

RUN npm run build

# 3. 運行階段 (custom server: Next.js + MCP on same port)
FROM base AS runner
WORKDIR /app

# 安裝運行時依賴（Prisma 需要 openssl）
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# 複製必要檔案
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
# Custom server + MCP source (tsx compiles at runtime)
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src/mcp ./src/mcp

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Custom server: Next.js API + MCP endpoint on same port
CMD ["node", "--import", "tsx/esm", "server.ts"]
