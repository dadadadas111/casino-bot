#!/usr/bin/env bash
# Nightly SQLite snapshot. VACUUM INTO takes a consistent copy even while the
# bot is writing, unlike a plain file copy of a WAL database.
set -euo pipefail
DB=/opt/casino-bot/data/casino.db
DEST=/opt/casino-bot/backups
KEEP_DAYS=14

mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)
docker exec casino-bot node -e "
const Database = require('better-sqlite3');
const db = new Database('/app/data/casino.db', { readonly: true });
db.exec(\"VACUUM INTO '/app/data/backup-tmp.db'\");
db.close();
"
mv "$(dirname "$DB")/backup-tmp.db" "$DEST/casino-$STAMP.db"
gzip -f "$DEST/casino-$STAMP.db"
find "$DEST" -name 'casino-*.db.gz' -mtime +$KEEP_DAYS -delete
echo "[backup] $DEST/casino-$STAMP.db.gz ($(du -h "$DEST/casino-$STAMP.db.gz" | cut -f1))"
