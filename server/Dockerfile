# Build aşaması
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Çalışma aşaması — yalnızca standalone çıktısı
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/data ./data
VOLUME /app/data
EXPOSE 3000
CMD ["node", "server.js"]
