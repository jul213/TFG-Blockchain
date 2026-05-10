#!/usr/bin/env sh
set -eu

SNAPSHOT_DIR="${SNAPSHOT_DIR:-./artifacts/contracts}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="$SNAPSHOT_DIR/$STAMP"

mkdir -p "$TARGET"
cp -R blockchain/build/contracts "$TARGET/"
cp blockchain/contract_info.json "$TARGET/" 2>/dev/null || true
printf '%s\n' "$TARGET"
