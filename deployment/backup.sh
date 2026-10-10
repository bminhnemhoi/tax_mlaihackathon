#!/bin/sh
set -eu
# Offline snapshot covers SQLite WAL, demo databases, and all linked source artifacts.
backup_dir=${1:-backups}
mkdir -p "$backup_dir"
backup_name="tax-referee-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
docker compose stop app
trap 'docker compose start app' EXIT INT TERM
docker compose run --rm --no-deps --user root -v "$(cd "$backup_dir" && pwd):/backup" app tar czf "/backup/$backup_name" -C /app/data runtime
printf '%s\n' "$backup_dir/$backup_name"
