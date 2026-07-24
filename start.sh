#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")" && pwd)"
source_dir="${RUNTIME_PROJECT_SOURCE:-$project_dir}"
if [[ "${NODE_ENV:-}" != "test" && -f "$project_dir/.env" ]]; then set -a; source "$project_dir/.env"; set +a; fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required; startup will not create or select a database." >&2
  exit 1
fi
if [[ -z "${NEXTAUTH_SECRET:-}" || ${#NEXTAUTH_SECRET} -lt 32 ]]; then
  echo "NEXTAUTH_SECRET must be set and contain at least 32 characters." >&2
  exit 1
fi
: "${BACKEND_PORT:?BACKEND_PORT is required; choose an unused port explicitly}"
: "${FRONTEND_PORT:?FRONTEND_PORT is required; choose an unused port explicitly}"
[[ "$BACKEND_PORT" != "$FRONTEND_PORT" ]] || { echo 'API and UI ports must be distinct' >&2; exit 1; }
[[ "$BACKEND_PORT" == 30974 && "$FRONTEND_PORT" == 30975 ]] || { echo 'Expected assigned ports 30974/30975' >&2; exit 1; }
if [[ ! -d "$source_dir/node_modules" ]]; then
  echo "Dependencies are absent. Run 'npm ci' explicitly before startup." >&2
  exit 1
fi
if command -v pg_isready >/dev/null 2>&1 && ! pg_isready --dbname "$DATABASE_URL" >/dev/null 2>&1; then
  echo "The configured database is not reachable. No database changes were attempted." >&2
  exit 1
fi
for app_port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  if [[ ! "$app_port" =~ ^[0-9]+$ ]] || (( app_port < 1024 || app_port > 65535 )); then echo 'Runtime port is invalid' >&2; exit 1; fi
  if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$app_port" -sTCP:LISTEN >/dev/null 2>&1; then echo "PORT $app_port is already in use; startup will not terminate another process." >&2; exit 1; fi
done

if [[ ! -f "$source_dir/.next/BUILD_ID" ]]; then
  echo "Production build is absent. Run 'npm run build' explicitly before startup." >&2
  exit 1
fi

cd "$source_dir"
export NODE_ENV=production
npm run start -- --hostname 127.0.0.1 --port "$FRONTEND_PORT" & app_pid=$!
node scripts/api-proxy.mjs & proxy_pid=$!
cleanup() {
  trap - EXIT INT TERM HUP
  command kill -TERM "${app_pid:-}" "${proxy_pid:-}" 2>/dev/null || true
  wait "${app_pid:-}" "${proxy_pid:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM HUP
while :; do
  command kill -0 "$app_pid" 2>/dev/null || { wait "$app_pid"; exit $?; }
  command kill -0 "$proxy_pid" 2>/dev/null || { wait "$proxy_pid"; exit $?; }
  sleep 1
done
