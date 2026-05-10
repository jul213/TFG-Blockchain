#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
POSTGRES_USER="${POSTGRES_USER:-julio_admin}"
POSTGRES_DB="${POSTGRES_DB:-erp_universitario}"
CONTAINER="${POSTGRES_CONTAINER:-tfg_db}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"
docker exec "$CONTAINER" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_DIR/postgres-$STAMP.sql"
printf '%s\n' "$BACKUP_DIR/postgres-$STAMP.sql"
