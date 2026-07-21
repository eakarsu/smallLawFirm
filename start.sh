#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")" && pwd)"
source_dir="${RUNTIME_PROJECT_SOURCE:-$project_dir}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required; startup will not create or select a database." >&2
  exit 1
fi
if [[ -z "${NEXTAUTH_SECRET:-}" || ${#NEXTAUTH_SECRET} -lt 32 ]]; then
  echo "NEXTAUTH_SECRET must be set and contain at least 32 characters." >&2
  exit 1
fi
: "${PORT:?PORT is required; choose an unused port explicitly}"
app_port="$PORT"
if [[ ! "$app_port" =~ ^[0-9]+$ ]] || (( app_port < 1024 || app_port > 65535 )); then
  echo "PORT must be an integer from 1024 to 65535." >&2
  exit 1
fi
if [[ ! -d "$source_dir/node_modules" ]]; then
  echo "Dependencies are absent. Run 'npm ci' explicitly before startup." >&2
  exit 1
fi
if command -v pg_isready >/dev/null 2>&1 && ! pg_isready --dbname "$DATABASE_URL" >/dev/null 2>&1; then
  echo "The configured database is not reachable. No database changes were attempted." >&2
  exit 1
fi
if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$app_port" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "PORT $app_port is already in use; startup will not terminate another process." >&2
  exit 1
fi

if [[ ! -f "$source_dir/.next/BUILD_ID" ]]; then
  echo "Production build is absent. Run 'npm run build' explicitly before startup." >&2
  exit 1
fi

cd "$source_dir"
export NODE_ENV=production
exec npm run start -- --hostname 127.0.0.1 --port "$app_port"
