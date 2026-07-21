#!/usr/bin/env bash
set -euo pipefail

startup_output=$(mktemp /tmp/smalllawfirm-startup.XXXXXX)
trap 'rm -f "$startup_output"' EXIT
if env -u DATABASE_URL -u NEXTAUTH_SECRET ./start.sh >"$startup_output" 2>&1; then
  echo "start.sh unexpectedly accepted absent configuration" >&2
  exit 1
fi
grep -q 'DATABASE_URL is required' "$startup_output"

if DATABASE_URL='postgresql://unused@127.0.0.1:1/unused' NEXTAUTH_SECRET='short' ./start.sh >"$startup_output" 2>&1; then
  echo "start.sh unexpectedly accepted a weak secret" >&2
  exit 1
fi
grep -q 'at least 32 characters' "$startup_output"

if grep -Eq 'kill -9|force-reset|^[[:space:]]*(npx[[:space:]]+prisma|npm[[:space:]]+(install|ci)|createdb|kill[[:space:]])' start.sh; then
  echo "start.sh contains a mutating or destructive operation" >&2
  exit 1
fi

echo "startup safety checks passed"
