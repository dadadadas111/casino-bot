#!/usr/bin/env bash
# Pull the latest images and restart the stack. Invoked ONLY via the
# forced-command CI deploy key (see authorized_keys).
set -euo pipefail
cd /opt/casino-bot
echo "[deploy] $(date -u +%FT%TZ) pulling images..."
docker compose pull
echo "[deploy] restarting stack..."
docker compose up -d
docker image prune -f >/dev/null 2>&1 || true
echo "[deploy] done. status:"
docker compose ps
