#!/usr/bin/env bash
# scripts/active-e2e/soak-monitor/start-monitor.sh
#
# Cron / nohup wrapper around 24h-monitor.py. Spawns the monitor in the
# background, redirects stderr to a log file, prints the NDJSON path so the
# operator can `tail -f` it.
#
# Usage:
#   bash scripts/active-e2e/soak-monitor/start-monitor.sh \
#       --phase t6-5-phase-b \
#       [--duration-hours 24] \
#       [--start-ts 2026-05-09T23:33:00+08:00] \
#       [extra args forwarded to 24h-monitor.py]
#
# Tail / inspect:
#   tail -f ./out/soak/<phase>-<ts>.ndjson         # NDJSON event stream
#   tail -f ./out/soak/<phase>-<ts>.stderr.log     # stderr (heartbeat + alerts)
#
# Stop:
#   kill <PID>   # PID printed at launch and saved to ./out/soak/<phase>.pid

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITOR="${SCRIPT_DIR}/24h-monitor.py"

if [[ ! -f "${MONITOR}" ]]; then
    echo "[start-monitor] FATAL: ${MONITOR} not found" >&2
    exit 1
fi

# Pull --phase out (required, also used for filenames).
PHASE=""
ARGS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --phase)  PHASE="$2"; ARGS+=("$1" "$2"); shift 2 ;;
        --phase=*) PHASE="${1#--phase=}"; ARGS+=("$1"); shift ;;
        *) ARGS+=("$1"); shift ;;
    esac
done

if [[ -z "${PHASE}" ]]; then
    echo "[start-monitor] FATAL: --phase <name> is required" >&2
    exit 2
fi

TS="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="./out/soak"
mkdir -p "${OUT_DIR}"
NDJSON="${OUT_DIR}/${PHASE}-${TS}.ndjson"
STDERR="${OUT_DIR}/${PHASE}-${TS}.stderr.log"
PIDFILE="${OUT_DIR}/${PHASE}.pid"

# Append --output if caller did not pass one.
HAS_OUTPUT=0
for a in "${ARGS[@]}"; do
    case "$a" in --output|--output=*) HAS_OUTPUT=1 ;; esac
done
if [[ "${HAS_OUTPUT}" -eq 0 ]]; then
    ARGS+=("--output" "${NDJSON}")
fi

echo "[start-monitor] phase=${PHASE} ndjson=${NDJSON} stderr=${STDERR}"
nohup python3 "${MONITOR}" "${ARGS[@]}" > /dev/null 2>"${STDERR}" &
PID=$!
echo "${PID}" > "${PIDFILE}"
echo "[start-monitor] launched PID=${PID} (saved to ${PIDFILE})"
echo "[start-monitor] tail -f ${NDJSON}"
echo "[start-monitor] tail -f ${STDERR}"
