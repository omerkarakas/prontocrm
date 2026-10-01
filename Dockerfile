# ── Bağımlılık aşaması ──
FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci

# ── Build aşaması ──
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Çalışma aşaması — yalnızca standalone çıktısı ──
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app

# better-sqlite3 native modülü için gerekli
RUN apk add --no-cache libstdc++

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# data dizini volume olarak mount edilecek; yoksa boş oluştur
RUN mkdir -p /app/data
VOLUME /app/data
EXPOSE 3000
CMD ["node", "server.js"]
