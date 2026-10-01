#!/usr/bin/env bash
# VPS deploy: git pull → yeniden build → Traefik arkasında ayağa kaldır
set -euo pipefail
cd "$(dirname "$0")"

echo "🚀 ProntoCRM deploy başlıyor..."

# ── Git pull ──
echo "📥 Güncel kod çekiliyor..."
git pull --ff-only

# ── Docker build & up ──
echo "🐳 Docker imajı build ediliyor ve servis başlatılıyor..."
docker compose up -d --build

# ── Temizlik ──
echo "🧹 Kullanılmayan imajlar temizleniyor..."
docker image prune -f

echo "✅ ProntoCRM deploy tamamlandı!"
echo "   → https://prontocrm.mokadijital.com"
