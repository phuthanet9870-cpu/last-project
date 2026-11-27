#!/usr/bin/env bash
# Scheduled PostgreSQL backup (custom format) with retention. Example cron (daily 03:41 Asia/Bangkok):
#   41 3 * * * DATABASE_URL=... BACKUP_DIR=/var/backups/hearthbound RETENTION_DAYS=14 /app/scripts/db-backup.sh >> /var/log/hb-backup.log 2>&1
# Copy BACKUP_DIR off-host (object storage) — a backup on the same disk as the database is not a backup.
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
out="$BACKUP_DIR/hearthbound_$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --no-privileges --file="$out" "$DATABASE_URL"
pg_restore --list "$out" > /dev/null   # fail loudly if the archive is unreadable
echo "backup ok: $out ($(du -h "$out" | cut -f1))"
find "$BACKUP_DIR" -maxdepth 1 -name 'hearthbound_*.dump' -mtime +"$RETENTION_DAYS" -print -delete
