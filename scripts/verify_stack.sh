#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

docker compose -f "$ROOT_DIR/docker-compose.yml" config >/dev/null

cd "$ROOT_DIR/blockchain"
npm test

TOKEN="$(curl -sk -H 'Content-Type: application/json' -d '{"user":"rector@uni.edu","pass":"admin123"}' https://localhost/api/login | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
curl -sk https://localhost/api/health-check >/dev/null
curl -sk -H "Authorization: Bearer $TOKEN" https://localhost/api/rector/informes >/dev/null
curl -sk -H "Authorization: Bearer $TOKEN" https://localhost/api/analytics/insights >/dev/null

echo "stack-ok"
