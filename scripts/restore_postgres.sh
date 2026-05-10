#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "" ]; then
  echo "Uso: scripts/restore_postgres.sh backups/postgres-YYYYmmddTHHMMSSZ.sql" >&2
  exit 2
fi

POSTGRES_USER="${POSTGRES_USER:-julio_admin}"
POSTGRES_DB="${POSTGRES_DB:-erp_universitario}"
CONTAINER="${POSTGRES_CONTAINER:-tfg_db}"

docker exec -i "$CONTAINER" psql -U "$POSTGRES_USER" "$POSTGRES_DB" < "$1"
