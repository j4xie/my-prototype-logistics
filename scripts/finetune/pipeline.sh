#!/bin/bash
# ============================================================
# Intent Recognition Data Pipeline
# 统一训练管线：裁判→弱意图→合成→导出→训练
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
LOG_FILE="$DATA_DIR/pipeline_$(date +%Y%m%d_%H%M%S).log"

# Default config
SHADOW_DAYS=14
MIN_SAMPLES=5
MIN_F1_THRESHOLD=0.70
DRY_RUN=false

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --days N          Shadow adjudication lookback days (default: 14)"
    echo "  --min-samples N   Min samples per weak intent for synthesis (default: 5)"
    echo "  --min-f1 F        Min F1 threshold for quality gate (default: 0.70)"
    echo "  --dry-run         Print steps without executing"
    echo "  --skip-train      Skip training step (export data only)"
    echo "  -h, --help        Show this help"
    exit 0
}

SKIP_TRAIN=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --days) SHADOW_DAYS="$2"; shift 2 ;;
        --min-samples) MIN_SAMPLES="$2"; shift 2 ;;
        --min-f1) MIN_F1_THRESHOLD="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        --skip-train) SKIP_TRAIN=true; shift ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
run() {
    if [ "$DRY_RUN" = true ]; then
        log "[DRY-RUN] Would execute: $*"
    else
        log ">>> $*"
        "$@" 2>&1 | tee -a "$LOG_FILE"
    fi
}

mkdir -p "$DATA_DIR"
log "=========================================="
log "Intent Recognition Pipeline Started"
log "Shadow days: $SHADOW_DAYS, Min samples: $MIN_SAMPLES"
log "=========================================="

# Step 1: Shadow Adjudication
log ""
log "=== Step 1/5: Shadow Adjudication (last ${SHADOW_DAYS} days) ==="
run python "$SCRIPT_DIR/shadow_adjudicate.py" --days "$SHADOW_DAYS"

ADJUDICATED="$DATA_DIR/shadow_adjudicated.jsonl"
if [ ! -f "$ADJUDICATED" ]; then
    log "WARNING: No adjudicated data produced. Continuing..."
else
    ADJUDICATED_COUNT=$(wc -l < "$ADJUDICATED")
    log "Adjudicated samples: $ADJUDICATED_COUNT"
fi

# Step 2: Identify Weak Intents
log ""
log "=== Step 2/5: Identify Weak Intents ==="
run python "$SCRIPT_DIR/identify_weak_intents.py"

WEAK_FILE="$DATA_DIR/weak_intents.json"
if [ -f "$WEAK_FILE" ]; then
    WEAK_COUNT=$(python -c "import json; print(len(json.load(open('$WEAK_FILE'))))" 2>/dev/null || echo "0")
    log "Weak intents found: $WEAK_COUNT"
    if [ "$WEAK_COUNT" = "0" ]; then
        log "No weak intents — skipping synthesis step"
    fi
else
    WEAK_COUNT=0
    log "No weak intents file — skipping synthesis step"
fi

# Step 3: Synthesize Weak Class Data
log ""
log "=== Step 3/5: Synthesize Weak Class Data ==="
if [ "$WEAK_COUNT" != "0" ]; then
    run python "$SCRIPT_DIR/synthesize_weak_class_data.py" --min-samples "$MIN_SAMPLES"
    SYNTHETIC="$DATA_DIR/synthetic_weak_class.jsonl"
    if [ -f "$SYNTHETIC" ]; then
        SYNTHETIC_COUNT=$(wc -l < "$SYNTHETIC")
        log "Synthetic samples generated: $SYNTHETIC_COUNT"
    fi
else
    log "Skipped (no weak intents)"
fi

# Step 4: Export Merged Training Data
log ""
log "=== Step 4/5: Export Training Data ==="
run python "$SCRIPT_DIR/export_training_data.py"

MERGED="$DATA_DIR/merged_training_data.jsonl"
if [ -f "$MERGED" ]; then
    MERGED_COUNT=$(wc -l < "$MERGED")
    log "Merged training samples: $MERGED_COUNT"

    # Quality gate: check sample count
    if [ "$MERGED_COUNT" -lt 1000 ]; then
        log "ERROR: Training data too small ($MERGED_COUNT < 1000). Aborting."
        exit 1
    fi
else
    log "ERROR: No merged training data produced. Aborting."
    exit 1
fi

# Step 5: Incremental Finetuning
log ""
log "=== Step 5/5: Incremental Finetuning ==="
if [ "$SKIP_TRAIN" = true ]; then
    log "Skipped (--skip-train flag)"
else
    run python "$SCRIPT_DIR/incremental_finetune.py" \
        --new-data "$MERGED" \
        --old-data "$DATA_DIR/merged_training_data.jsonl" \
        --model-path "/www/wwwroot/python-services/models/chinese-roberta-wwm-ext-classifier/final" \
        --output-path "$DATA_DIR/../models/v8" \
        --replay-ratio 5.0 \
        --freeze-layers 8 \
        --epochs 5 \
        --label-mapping "$DATA_DIR/merged_label_mapping.json"

    log "Training complete. Check model output in $SCRIPT_DIR/models/"
fi

# Step 6: E2E Regression Verification (Wave-8)
log ""
log "=== Step 6/6: E2E Regression Verification ==="
E2E_SCRIPT="$(dirname "$SCRIPT_DIR")/tests/intent-routing-e2e-150.py"
MIN_PHASE1_ACCURACY=98

if [ -f "$E2E_SCRIPT" ]; then
    if [ "$DRY_RUN" = true ]; then
        log "[DRY-RUN] Would run: python $E2E_SCRIPT --prod"
    elif [ "$SKIP_TRAIN" = true ]; then
        log "Skipped (--skip-train flag, no model change to verify)"
    else
        log "Running E2E regression test (this may take 10-15 minutes)..."
        E2E_OUTPUT=$(python "$E2E_SCRIPT" --prod 2>&1 | tail -5)
        PHASE1_SCORE=$(echo "$E2E_OUTPUT" | grep -oP 'Phase 1.*?(\d+)/\d+' | grep -oP '\d+(?=/)')
        PHASE1_TOTAL=$(echo "$E2E_OUTPUT" | grep -oP 'Phase 1.*?\d+/(\d+)' | grep -oP '\d+$')

        if [ -n "$PHASE1_SCORE" ] && [ -n "$PHASE1_TOTAL" ]; then
            PHASE1_PCT=$((PHASE1_SCORE * 100 / PHASE1_TOTAL))
            log "E2E Result: Phase 1 = $PHASE1_SCORE/$PHASE1_TOTAL ($PHASE1_PCT%)"

            if [ "$PHASE1_PCT" -lt "$MIN_PHASE1_ACCURACY" ]; then
                log "ERROR: Phase 1 accuracy $PHASE1_PCT% < ${MIN_PHASE1_ACCURACY}% threshold!"
                log "REGRESSION DETECTED — do NOT deploy this model. Investigate failures."
                exit 1
            else
                log "PASS: Phase 1 accuracy $PHASE1_PCT% >= ${MIN_PHASE1_ACCURACY}% threshold"
            fi
        else
            log "WARNING: Could not parse E2E results. Manual verification required."
            log "Raw output: $E2E_OUTPUT"
        fi
    fi
else
    log "WARNING: E2E test script not found at $E2E_SCRIPT — skipping verification"
fi

log ""
log "=========================================="
log "Pipeline Complete!"
log "Log saved to: $LOG_FILE"
log "=========================================="
