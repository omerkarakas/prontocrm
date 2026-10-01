#!/usr/bin/env bash
# VPS deploy: git pull → yeniden build → Traefik arkasında ayağa kaldır
set -euo pipefail
cd "$(dirname "$0")"

# Geçiş (tek seferlik): db dosyaları eskiden git'te izleniyordu. İzlemeyi bırakan
# commit'i çekerken git, local'de değişmiş bu dosyaları silmek ister ve pull'u
# reddeder. Canlı db'yi korumak için pull öncesi kenara al, sonra geri koy.
if git ls-files --error-unmatch data/cengaver.db >/dev/null 2>&1; then
  mkdir -p .db-swap
  mv -f data/cengaver.db data/cengaver.db-shm data/cengaver.db-wal .db-swap/ 2>/dev/null || true
  git checkout -- data/cengaver.db data/cengaver.db-shm data/cengaver.db-wal 2>/dev/null || true
fi

git pull --ff-only

if [ -d .db-swap ]; then
  mv -f .db-swap/cengaver.db .db-swap/cengaver.db-shm .db-swap/cengaver.db-wal data/ 2>/dev/null || true
  rmdir .db-swap 2>/dev/null || true
fi
docker compose up -d --build
docker image prune -f
