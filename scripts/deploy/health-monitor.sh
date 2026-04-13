#!/usr/bin/env bash
# Blue-Green Health Monitor
# Checks both Blue (10010) and Green (10020) health endpoints every 5 minutes.
# If the active service is down, attempts one restart and logs the outcome.
#
# Install on 47.100.235.168:
#   cp health-monitor.sh /www/wwwroot/cretas/health-monitor.sh
#   chmod +x /www/wwwroot/cretas/health-monitor.sh
#   crontab -e
#   # Add the line below:
#   */5 * * * * /www/wwwroot/cretas/health-monitor.sh

set -euo pipefail

LOG_DIR="/www/wwwroot/cretas/logs"
LOG="$LOG_DIR/health-monitor.log"
BLUE_PORT=10010
GREEN_PORT=10020
HEALTH_PATH="/api/mobile/health"
RESTART_WAIT=10   # seconds to wait after restart before re-checking

# Rotate log if it exceeds 10 MB to prevent unbounded growth
rotate_log() {
  if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 10485760 ]; then
    mv "$LOG" "${LOG}.$(date '+%Y%m%d_%H%M%S').bak"
  fi
}

log() {
  mkdir -p "$LOG_DIR"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"
}

# Returns 0 if the endpoint responds with HTTP 200, 1 otherwise.
is_healthy() {
  local port=$1
  local http_code
  http_code=$(curl -sf -o /dev/null -w "%{http_code}" \
    --max-time 5 \
    "http://localhost:${port}${HEALTH_PATH}" 2>/dev/null) || true
  [ "$http_code" = "200" ]
}

# Checks one colour. Restarts its systemd service if unhealthy.
# Arguments: port  display_name  systemd_service_name
check_and_recover() {
  local port=$1
  local name=$2
  local service=$3

  if is_healthy "$port"; then
    return 0
  fi

  log "ALERT: $name (port $port) is DOWN — attempting restart of $service"

  if systemctl restart "$service" 2>/dev/null; then
    sleep "$RESTART_WAIT"

    if is_healthy "$port"; then
      log "RECOVERED: $name restarted successfully (port $port)"
    else
      log "CRITICAL: $name (port $port) still DOWN after restart — manual intervention needed"
      log "CRITICAL:   Run: ssh root@47.100.235.168 'journalctl -u $service --since \"5 min ago\" --no-pager'"
    fi
  else
    log "CRITICAL: systemctl restart $service failed — check service unit file"
  fi
}

rotate_log

log "--- health check start ---"
check_and_recover "$BLUE_PORT"  "Blue"  "cretas-backend"
check_and_recover "$GREEN_PORT" "Green" "cretas-backend-green"
log "--- health check end ---"
