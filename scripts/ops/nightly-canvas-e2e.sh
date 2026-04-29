#!/usr/bin/env bash
#
# Nightly canvas-security-e2e regression check
#
# Per ADR: docs/plans/canvas-e2e-ci-strategy.md (R7 Issue 4, Option C)
#
# Runs the full canvas-security-e2e suite on the test server at 02:00 CST
# and posts a Slack alert on failure. Designed to catch regressions within
# 24 hours without requiring any network bridge or CI secrets.
#
# Installation (DevOps):
#   1. Copy to /opt/cretas/scripts/ops/nightly-canvas-e2e.sh on 47.100.235.168
#   2. chmod +x
#   3. Set SLACK_WEBHOOK_URL in /etc/cron.d/cretas-e2e-env (mode 600)
#   4. Add crontab entry:
#        0 18 * * * /opt/cretas/scripts/ops/nightly-canvas-e2e.sh
#      (18:00 UTC = 02:00 CST next day)
#   5. Create log dir: mkdir -p /var/log/cretas-nightly-canvas-e2e && chmod 755
#   6. Test once manually: ./nightly-canvas-e2e.sh
#
# Exit codes:
#   0 — all tests passed
#   1 — tests failed (Slack alerted)
#   2 — infrastructure error (git pull failed, deps missing, etc.)
#
set -euo pipefail

# --- Config ---
LOG_DIR="${CANVAS_E2E_LOG_DIR:-/var/log/cretas-nightly-canvas-e2e}"
REPO_DIR="${CANVAS_E2E_REPO_DIR:-/www/wwwroot/cretas/code}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
ALERT_MENTION="${CANVAS_E2E_ALERT_MENTION:-@oncall}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOGFILE="$LOG_DIR/$TIMESTAMP.log"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOGFILE") 2>&1

echo "=========================================="
echo "  Canvas E2E Nightly Run"
echo "  Start: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "  Log:   $LOGFILE"
echo "=========================================="

# --- Pre-flight: check test env health ---
echo ""
echo "--- Pre-flight: dependency health ---"
JAVA_HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:10011/api/mobile/health || echo "000")
PYTHON_HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8084/health || echo "000")
echo "Java test backend (10011): HTTP $JAVA_HTTP"
echo "Python test service (8084): HTTP $PYTHON_HTTP"

if [ "$JAVA_HTTP" != "200" ]; then
  echo "ERROR: Java test backend not healthy — aborting to avoid false-positive alerts" >&2
  [ -n "$SLACK_WEBHOOK_URL" ] && curl -sS -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"⚠️ Canvas E2E nightly ABORTED $TIMESTAMP — Java test backend (10011) not responding (HTTP $JAVA_HTTP). Infra issue, NOT a regression. $ALERT_MENTION please investigate.\"}" \
    >/dev/null
  exit 2
fi
if [ "$PYTHON_HTTP" != "200" ]; then
  echo "WARN: Python test service (8084) not healthy — J6 AI journey may fail. Continuing anyway." >&2
fi

# --- Pull latest main ---
echo ""
echo "--- Pull latest main ---"
cd "$REPO_DIR"
git fetch origin main
CURRENT_COMMIT=$(git rev-parse HEAD)
LATEST_COMMIT=$(git rev-parse origin/main)
if [ "$CURRENT_COMMIT" != "$LATEST_COMMIT" ]; then
  git checkout main
  git reset --hard origin/main
  echo "Updated $CURRENT_COMMIT -> $LATEST_COMMIT"
else
  echo "Already at latest commit $CURRENT_COMMIT"
fi

# --- Run E2E suite ---
echo ""
echo "--- Running canvas-security-e2e ---"
cd tests/canvas-security-e2e
set +e  # Allow non-zero exit to be captured
CANVAS_E2E_RUN_ID="nightly_$TIMESTAMP" \
  CANVAS_E2E_SKIP_UI=1 \
  E2E_API_BASE="http://localhost:10011/api/mobile" \
  E2E_WEB_URL="http://localhost:5173" \
  bash run-all.sh
E2E_EXIT=$?
set -e

echo ""
echo "--- Run complete ---"
echo "Exit code: $E2E_EXIT"

# --- Alert on failure ---
if [ "$E2E_EXIT" -ne 0 ]; then
  # Extract summary section (last ~30 lines)
  SUMMARY=$(tail -30 "$LOGFILE" | grep -A 20 "TEST-LEVEL SUMMARY" || tail -20 "$LOGFILE")

  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -sS -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "$(cat <<JSON
{
  "text": "🔴 Canvas E2E FAILED — nightly $TIMESTAMP",
  "blocks": [
    {
      "type": "header",
      "text": {"type": "plain_text", "text": "🔴 Canvas E2E nightly FAILED"}
    },
    {
      "type": "section",
      "text": {"type": "mrkdwn", "text": "*When*: $(date '+%Y-%m-%d %H:%M:%S %Z')\n*Commit*: \`$(git rev-parse --short HEAD)\`\n*Full log*: \`$LOGFILE\`\n$ALERT_MENTION please review."}
    },
    {
      "type": "section",
      "text": {"type": "mrkdwn", "text": "\`\`\`\n$SUMMARY\n\`\`\`"}
    }
  ]
}
JSON
)" >/dev/null
    echo "Slack alert posted"
  else
    echo "SLACK_WEBHOOK_URL not set — skipping alert"
  fi

  exit 1
fi

echo ""
echo "=========================================="
echo "  Nightly run PASSED"
echo "=========================================="
exit 0
