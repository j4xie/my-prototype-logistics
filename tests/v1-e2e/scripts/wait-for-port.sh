#!/usr/bin/env bash
# Poll a TCP port until it's open or timeout
set -e

HOST="${1:-localhost}"
PORT="${2:-5173}"
TIMEOUT="${3:-60}"
INTERVAL=1

echo "[wait-for-port] 等待 $HOST:$PORT (超时 ${TIMEOUT}s)"

START=$(date +%s)
while true; do
  if (exec 3<>/dev/tcp/$HOST/$PORT) 2>/dev/null; then
    exec 3>&- 3<&-
    echo "[wait-for-port] ✓ open"
    exit 0
  fi
  NOW=$(date +%s)
  ELAPSED=$((NOW - START))
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo "[wait-for-port] ✗ 超时 after ${TIMEOUT}s" >&2
    exit 1
  fi
  sleep "$INTERVAL"
done
