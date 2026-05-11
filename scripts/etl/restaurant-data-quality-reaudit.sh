#!/usr/bin/env bash
# restaurant-data-quality-reaudit.sh
#
# Reusable re-audit driver for the Day-7 / Day-30 / post-Sub-ETL-2c cadence
# called out in audit doc 2026-05-11-restaurant-data-readiness-audit.md §3.4.
#
# What it does:
#   1. SSH to server 47, run validate-restaurant-data-quality.py (PR #367) on
#      smartbi_prod_db for two factory sets:
#        - the 14 V20260511_02 catalog R_*_REAL chains
#        - the 19 actual cretas_prod_db.factories RESTAURANT tenants
#      Write JSON outputs to /tmp/ on the server, fetch to local under
#      reports/restaurant-data-quality/<timestamp>/.
#   2. Compute a JSON diff vs the most recent prior run in the same dir:
#        - per-factory overall status delta (READY <-> PARTIAL <-> EMPTY <-> SCHEMA_GAP)
#        - per-metric N2/N3/N4 status delta
#        - new chains that became READY (N3 unblock highlight)
#        - chains that regressed (READY → EMPTY etc.)
#   3. Append a one-line summary row to a running log
#      docs/qa-audits/restaurant-data-quality-runlog.md so the audit doc has
#      a chronological trail without hand-editing.
#
# Usage:
#   ./scripts/etl/restaurant-data-quality-reaudit.sh                  # default — both factory sets
#   ./scripts/etl/restaurant-data-quality-reaudit.sh --catalog-only   # only 14 R_*_REAL
#   ./scripts/etl/restaurant-data-quality-reaudit.sh --tenants-only   # only 19 cretas_db RESTAURANT
#   ./scripts/etl/restaurant-data-quality-reaudit.sh --no-fetch       # run on server, don't copy JSON back
#   ./scripts/etl/restaurant-data-quality-reaudit.sh --dry-run        # show what would run, don't SSH
#
# Required env / files on server 47:
#   /www/wwwroot/cretas/.env.prod with SMARTBI_DB_PASSWORD=... line
#   /www/wwwroot/cretas/code/backend/python/venv38/bin/python (asyncpg installed)
#   /www/wwwroot/cretas/code/scripts/etl/validate-restaurant-data-quality.py
#     (post-PR-#367 merge; pre-merge requires SCP — see §3 of audit doc)
#
# Per .claude/rules/concurrent-edit-safety.md §5b — if the script ever lands
# alongside concurrent doc edits, ship with safe-commit + explicit path list.

set -euo pipefail

# ============================================================
# Config
# ============================================================

SSH_TARGET="${REAUDIT_SSH_TARGET:-root@47.100.235.168}"
REMOTE_REPO_DIR="${REAUDIT_REMOTE_REPO:-/www/wwwroot/cretas/code}"
REMOTE_PYTHON_VENV="${REAUDIT_REMOTE_VENV:-${REMOTE_REPO_DIR}/backend/python/venv38/bin/python}"
REMOTE_SCRIPT="${REAUDIT_REMOTE_SCRIPT:-${REMOTE_REPO_DIR}/scripts/etl/validate-restaurant-data-quality.py}"
REMOTE_ENV_FILE="${REAUDIT_REMOTE_ENV_FILE:-/www/wwwroot/cretas/.env.prod}"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOCAL_REPORTS_DIR="${REPO_ROOT}/reports/restaurant-data-quality"
RUNLOG_PATH="${REPO_ROOT}/docs/qa-audits/restaurant-data-quality-runlog.md"

# The two factory sets — kept in sync with audit doc §1.2 and §3.1.
CATALOG_FACTORIES="R_ILTEATRO_REAL,R_SHANGMA_HG_REAL,R_JINCHUAN_HG_REAL,R_XIMAXIANG_REAL,R_YUJIUJING_REAL,R_YONGHE_REAL,R_XINBASHU_REAL,R_QINGHUAJIAO_REAL,R_DONGMENKOU_REAL,R_HONGDEJI_REAL,R_JINRINIUSHI_REAL,R_YOUZIYOUWEI_REAL,R_LINJIAYAN_REAL,R_HUOGUO_GENERIC_REAL"
TENANT_FACTORIES="F002,R001,RES_3101_001,RES_3101_002,RES_3101_003,RES_3101_004,RES_3101_005,RES_3101_006,RES_3101_007,RES_3101_008,RES_3101_009,RES_GML_001,R_GML_DEMO,R_XMX_CHAIN,R_XMX_FRESH,R_XMX_FRESH2,R_XMX_FRESH3,R_YHDJ_DEMO,R_YJJ_DEMO"

# ============================================================
# Arg parsing
# ============================================================

RUN_CATALOG=true
RUN_TENANTS=true
FETCH=true
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --catalog-only)  RUN_TENANTS=false ; shift ;;
        --tenants-only)  RUN_CATALOG=false ; shift ;;
        --no-fetch)      FETCH=false       ; shift ;;
        --dry-run)       DRY_RUN=true      ; shift ;;
        -h|--help)
            sed -n '2,30p' "$0"
            exit 0
            ;;
        *)
            echo "[reaudit] unknown arg: $1" >&2
            exit 2
            ;;
    esac
done

TS="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="${LOCAL_REPORTS_DIR}/${TS}"

log() { echo "[reaudit][$(date +%T)] $*"; }

# ============================================================
# Helper — remote command runner
# ============================================================

run_remote() {
    local description="$1"; shift
    local cmd="$*"
    if $DRY_RUN; then
        log "DRY: would run on ${SSH_TARGET}: ${description}"
        log "DRY: cmd: ${cmd}"
        return 0
    fi
    log "remote: ${description}"
    ssh "$SSH_TARGET" "$cmd"
}

fetch_remote() {
    local remote_path="$1"
    local local_path="$2"
    if ! $FETCH; then
        log "skip fetch (--no-fetch): ${remote_path}"
        return 0
    fi
    if $DRY_RUN; then
        log "DRY: would scp ${SSH_TARGET}:${remote_path} → ${local_path}"
        return 0
    fi
    log "fetch: ${remote_path} → ${local_path}"
    scp "${SSH_TARGET}:${remote_path}" "${local_path}"
}

# ============================================================
# Step 1 — verify remote prereqs
# ============================================================

log "Checking remote prereqs on ${SSH_TARGET}..."
if ! $DRY_RUN; then
    ssh "$SSH_TARGET" "
        set -e
        [ -f '${REMOTE_PYTHON_VENV}' ] || { echo 'MISSING: ${REMOTE_PYTHON_VENV}' >&2 ; exit 10; }
        [ -f '${REMOTE_SCRIPT}' ] || { echo 'MISSING: ${REMOTE_SCRIPT} (PR #367 not yet deployed?)' >&2 ; exit 11; }
        [ -f '${REMOTE_ENV_FILE}' ] || { echo 'MISSING: ${REMOTE_ENV_FILE}' >&2 ; exit 12; }
        echo 'prereqs ok'
    " || {
        # Friendly hint if script isn't on server
        if ssh "$SSH_TARGET" "[ ! -f '${REMOTE_SCRIPT}' ]"; then
            log "Script not on server. If PR #367 hasn't merged yet, SCP it manually:"
            log "  scp scripts/etl/validate-restaurant-data-quality.py ${SSH_TARGET}:/tmp/"
            log "  Then re-run with REAUDIT_REMOTE_SCRIPT=/tmp/validate-restaurant-data-quality.py $0"
        fi
        exit 1
    }
fi

# ============================================================
# Step 2 — run audits
# ============================================================

mkdir -p "${RUN_DIR}"
log "Local run dir: ${RUN_DIR}"

if $RUN_CATALOG; then
    log "Running catalog audit (14 R_*_REAL chains)..."
    REMOTE_OUT="/tmp/reaudit-catalog-${TS}.json"
    run_remote "catalog 14-chain audit" \
        "cd ${REMOTE_REPO_DIR}/backend/python && \
         SMARTBI_PG_PASSWORD=\$(grep '^SMARTBI_DB_PASSWORD=' ${REMOTE_ENV_FILE} | cut -d= -f2) \
         ${REMOTE_PYTHON_VENV} ${REMOTE_SCRIPT} \
             --env prod \
             --output ${REMOTE_OUT}"
    fetch_remote "${REMOTE_OUT}" "${RUN_DIR}/catalog.json"
fi

if $RUN_TENANTS; then
    log "Running tenant audit (19 cretas_db.factories RESTAURANT)..."
    REMOTE_OUT="/tmp/reaudit-tenants-${TS}.json"
    run_remote "tenant 19-restaurant audit" \
        "cd ${REMOTE_REPO_DIR}/backend/python && \
         SMARTBI_PG_PASSWORD=\$(grep '^SMARTBI_DB_PASSWORD=' ${REMOTE_ENV_FILE} | cut -d= -f2) \
         ${REMOTE_PYTHON_VENV} ${REMOTE_SCRIPT} \
             --env prod \
             --factories '${TENANT_FACTORIES}' \
             --output ${REMOTE_OUT}"
    fetch_remote "${REMOTE_OUT}" "${RUN_DIR}/tenants.json"
fi

if $DRY_RUN; then
    log "DRY-RUN complete. No further actions."
    exit 0
fi

# ============================================================
# Step 3 — diff vs prior run
# ============================================================

# Find the most recent prior run dir (any timestamp directory under
# LOCAL_REPORTS_DIR/ that's NOT the one we just created).
PRIOR_RUN_DIR=""
if [ -d "${LOCAL_REPORTS_DIR}" ]; then
    PRIOR_RUN_DIR=$(find "${LOCAL_REPORTS_DIR}" -maxdepth 1 -mindepth 1 -type d \
        ! -name "${TS}" 2>/dev/null \
        | sort -r | head -1 || true)
fi

if [ -n "${PRIOR_RUN_DIR}" ] && [ -f "${PRIOR_RUN_DIR}/$(basename ${RUN_DIR}/*.json | head -1)" 2>/dev/null ]; then
    log "Prior run: ${PRIOR_RUN_DIR}"
else
    log "No prior run found — this is baseline. Diff section will note 'baseline'."
    PRIOR_RUN_DIR=""
fi

DIFF_REPORT="${RUN_DIR}/diff-vs-prior.txt"
{
    echo "Re-audit diff report"
    echo "===================="
    echo "Current run:  ${RUN_DIR}"
    echo "Prior run:    ${PRIOR_RUN_DIR:-<baseline — no prior>}"
    echo "Timestamp:    ${TS}"
    echo ""
} > "${DIFF_REPORT}"

# Python helper for JSON diff. Keep inline to avoid deps.
python3 - "${RUN_DIR}" "${PRIOR_RUN_DIR}" "${DIFF_REPORT}" <<'PYEOF'
import json
import sys
from pathlib import Path

run_dir = Path(sys.argv[1])
prior_dir = Path(sys.argv[2]) if sys.argv[2] else None
diff_report = Path(sys.argv[3])


def load_factories(path: Path) -> dict:
    if not path.exists():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {f["factory_id"]: f for f in payload.get("factories", [])}


def diff_one(label: str, current: dict, prior: dict, out) -> None:
    out.write(f"\n## {label}\n")
    if not current:
        out.write("  (no current data — file missing)\n")
        return
    if not prior:
        out.write("  baseline — no prior to diff against\n")
        out.write(f"  factory_count={len(current)}\n")
        by_overall = {}
        for fid, f in current.items():
            by_overall.setdefault(f.get("overall", "?"), []).append(fid)
        for status, fids in sorted(by_overall.items()):
            out.write(f"  {status}: {len(fids)} → {', '.join(sorted(fids))}\n")
        return

    transitions = []  # (fid, prior_overall, curr_overall)
    metric_unblocks = []  # (fid, metric, prior_status, curr_status)
    new_factories = []
    removed_factories = []

    all_fids = set(current.keys()) | set(prior.keys())
    for fid in sorted(all_fids):
        c = current.get(fid)
        p = prior.get(fid)
        if c and not p:
            new_factories.append(fid)
            continue
        if p and not c:
            removed_factories.append(fid)
            continue
        c_overall = c.get("overall", "?")
        p_overall = p.get("overall", "?")
        if c_overall != p_overall:
            transitions.append((fid, p_overall, c_overall))
        for metric_key in ("n2_complaints", "n3_returns", "n4_wastage"):
            c_status = (c.get(metric_key) or {}).get("status")
            p_status = (p.get(metric_key) or {}).get("status")
            if c_status != p_status:
                metric_unblocks.append((fid, metric_key, p_status, c_status))

    if not (transitions or metric_unblocks or new_factories or removed_factories):
        out.write("  ✅ no changes vs prior run\n")
        return

    if new_factories:
        out.write(f"  + {len(new_factories)} new factory(ies) in this run: {', '.join(new_factories)}\n")
    if removed_factories:
        out.write(f"  - {len(removed_factories)} factory(ies) absent from this run: {', '.join(removed_factories)}\n")
    if transitions:
        out.write(f"  overall status transitions: {len(transitions)}\n")
        for fid, prev, curr in transitions:
            marker = "🟢" if prev == "EMPTY" and curr in ("PARTIAL", "READY") else \
                     "🔴" if prev == "READY" and curr != "READY" else "🔄"
            out.write(f"    {marker} {fid}: {prev} → {curr}\n")
    if metric_unblocks:
        out.write(f"  per-metric transitions: {len(metric_unblocks)}\n")
        for fid, metric, prev, curr in metric_unblocks:
            marker = "🟢" if prev == "EMPTY" and curr == "READY" else \
                     "🔴" if prev == "READY" and curr == "EMPTY" else "🔄"
            out.write(f"    {marker} {fid} {metric}: {prev} → {curr}\n")


with open(diff_report, "a", encoding="utf-8") as out:
    for label, fname in (("Catalog (14 R_*_REAL)", "catalog.json"),
                         ("Tenants (19 cretas_db RESTAURANT)", "tenants.json")):
        current = load_factories(run_dir / fname)
        prior = load_factories(prior_dir / fname) if prior_dir else {}
        diff_one(label, current, prior, out)
PYEOF

log "Diff report: ${DIFF_REPORT}"
cat "${DIFF_REPORT}"

# ============================================================
# Step 4 — append to running log
# ============================================================

mkdir -p "$(dirname ${RUNLOG_PATH})"

if [ ! -f "${RUNLOG_PATH}" ]; then
    cat > "${RUNLOG_PATH}" <<HEADEREOF
# Restaurant Data Quality — Run Log

Chronological log of \`validate-restaurant-data-quality.py\` executions against \`smartbi_prod_db\`.
One row per run. Diff details in \`reports/restaurant-data-quality/<timestamp>/\`.

Generator: \`scripts/etl/restaurant-data-quality-reaudit.sh\` — see audit doc §3.4
([2026-05-11-restaurant-data-readiness-audit.md](./2026-05-11-restaurant-data-readiness-audit.md)).

| Run timestamp | Catalog 14 — READY/PARTIAL/EMPTY/SCHEMA_GAP | Tenants 19 — READY/PARTIAL/EMPTY/SCHEMA_GAP | N3-ready tenants | Diff vs prior | Notes |
|---|---|---|---|---|---|
HEADEREOF
fi

# Compute the row summary inline with python (json read is faster + safer than jq)
ROW="$(python3 - "${RUN_DIR}" "${TS}" "${DIFF_REPORT}" <<'PYEOF'
import json
import sys
from pathlib import Path

run_dir = Path(sys.argv[1])
ts = sys.argv[2]
diff_path = Path(sys.argv[3])


def summary(path: Path) -> tuple[str, str]:
    if not path.exists():
        return "—", "—"
    payload = json.loads(path.read_text(encoding="utf-8"))
    s = payload.get("summary", {})
    by = s.get("by_overall_status", {})
    fmt = f"{by.get('READY', 0)}/{by.get('PARTIAL', 0)}/{by.get('EMPTY', 0)}/{by.get('SCHEMA_GAP', 0)}"
    n3_ready = []
    for f in payload.get("factories", []):
        if (f.get("n3_returns") or {}).get("status") == "READY":
            n3_ready.append(f["factory_id"])
    n3_label = ", ".join(n3_ready) if n3_ready else "(none)"
    return fmt, n3_label


catalog_fmt, _catalog_n3 = summary(run_dir / "catalog.json")
tenants_fmt, tenants_n3 = summary(run_dir / "tenants.json")

# Quick diff status: "baseline" if no prior section, "no changes" if so, otherwise
# count of transitions.
diff_status = "baseline"
if diff_path.exists():
    text = diff_path.read_text(encoding="utf-8")
    if "baseline — no prior" in text:
        diff_status = "baseline"
    elif "no changes vs prior run" in text and "overall status transitions" not in text:
        diff_status = "no changes"
    else:
        transitions = text.count(": ")  # rough
        diff_status = f"see {diff_path.name}"

# Markdown row — kept on one line for the table.
print(f"| {ts} | {catalog_fmt} | {tenants_fmt} | {tenants_n3} | {diff_status} | |")
PYEOF
)"

echo "${ROW}" >> "${RUNLOG_PATH}"
log "Appended runlog row → ${RUNLOG_PATH}"

# ============================================================
# Step 5 — friendly summary
# ============================================================

log "============================================================"
log "Re-audit complete."
log "JSON outputs:     ${RUN_DIR}/"
log "Diff vs prior:    ${DIFF_REPORT}"
log "Runlog updated:   ${RUNLOG_PATH}"
log ""
log "Next:"
log "  - Read diff report to spot READY transitions (N3 unblock = green flag)"
log "  - If any tenant transitioned EMPTY → READY, ping organizer (Sub-ETL-2c worked)"
log "  - If any READY → EMPTY, P0 — pipe broke"
log "  - Commit runlog amendment: git add ${RUNLOG_PATH#${REPO_ROOT}/}"
log "============================================================"
