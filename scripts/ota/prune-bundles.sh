#!/usr/bin/env bash
# Prune old OTA bundles, keeping the newest N per (runtimeVersion, channel).
#
# Per Q4 resolution (spec §16): rolling-window retention. Default N=10.
# The newest bundle is ALWAYS retained even if N=0.
#
# Usage:
#   ./scripts/ota/prune-bundles.sh <runtimeVersion> <channel> [N=10]
#
# Example:
#   ./scripts/ota/prune-bundles.sh 1.0.0 production 10

set -euo pipefail

RV="${1:?runtimeVersion required}"
CHANNEL="${2:?channel required}"
KEEP="${3:-10}"
SERVER="${OTA_SERVER:-root@47.100.235.168}"
SERVER_BUNDLE_ROOT="${OTA_SERVER_BUNDLE_ROOT:-/www/wwwroot/ota}"

SAFE_COMPONENT='^[A-Za-z0-9][A-Za-z0-9._-]*$'
for v in "$RV" "$CHANNEL"; do
    if [[ ! "$v" =~ $SAFE_COMPONENT ]]; then
        echo "ERROR: '$v' fails $SAFE_COMPONENT" >&2
        exit 2
    fi
done

if [[ ! "$KEEP" =~ ^[0-9]+$ ]]; then
    echo "ERROR: KEEP must be a non-negative integer (got '$KEEP')" >&2
    exit 2
fi

# Make the operator override explicit on dangerous values.
if [[ "$KEEP" == "0" ]]; then
    echo "WARN: KEEP=0 would delete everything; forcing minimum keep=1 (newest)" >&2
    KEEP=1
fi

# shellcheck disable=SC2087 -- heredoc intentionally expands locals
ssh "$SERVER" bash -s <<REMOTE_EOF
set -euo pipefail
DIR="${SERVER_BUNDLE_ROOT}/updates/${RV}/${CHANNEL}"
if [[ ! -d "\$DIR" ]]; then
    echo "[prune] \$DIR does not exist; nothing to do"
    exit 0
fi

mapfile -t ALL < <(ls "\$DIR" 2>/dev/null | sort -nr)
TOTAL=\${#ALL[@]}
echo "[prune] found \$TOTAL bundles for ${RV}/${CHANNEL}; keeping newest ${KEEP}"

if [[ \$TOTAL -le ${KEEP} ]]; then
    echo "[prune] nothing to delete"
    exit 0
fi

DELETED=0
for ((i=${KEEP}; i<TOTAL; i++)); do
    BUNDLE="\$DIR/\${ALL[\$i]}"
    echo "[prune] deleting \$BUNDLE"
    rm -rf "\$BUNDLE"
    DELETED=\$((DELETED + 1))
done

echo "[prune] ✓ kept newest ${KEEP}, removed \$DELETED"
REMOTE_EOF
