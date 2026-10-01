# ---- bağımlılıklar ----
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update -qq && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ---- derleme ----
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- çalışma zamanı ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PRONTO_DATA_DIR=/app/data
ENV PORT=3000
RUN groupadd --system --gid 1001 pronto && useradd --system --uid 1001 --gid pronto pronto

COPY --from=builder /app/public ./public
COPY --from=builder --chown=pronto:pronto /app/.next/standalone ./
COPY --from=builder --chown=pronto:pronto /app/.next/static ./.next/static
# native modülü garantiye al
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

RUN mkdir -p /app/data && chown pronto:pronto /app/data
USER pronto
EXPOSE 3000
VOLUME ["/app/data"]

CMD ["node", "server.js"]
