# Intent Routing E2E Test Report — v2 Incremental Model (222 labels)

**Date**: 2026-02-28
**Environment**: Test (47.100.235.168:10011)
**Model**: v2 incremental (`/www/wwwroot/python-services/models/chinese-roberta-wwm-ext-classifier/incremental_v2/final/`)
**Test Script**: `tests/intent-routing-e2e-150.py` (1232 test cases, Phase 1 only)

---

## Executive Summary

| Metric | v35.3 Baseline (179 labels) | **v2 Model (222 labels)** | Delta |
|--------|---------------------------|--------------------------|-------|
| Phase 1 Intent Accuracy | **87%** (1066/1232) | **85%** (1049/1232) | **-17 (-1.4%)** |
| Phase 1 Type Separation | **90%** (1104/1232) | **90%** (1103/1232) | -1 (0%) |
| Phase 2 Curated Quality | 78% (73/94) | 78% (73/94) | 0 |
| Phase 2 Acceptable | 100% (94/94) | 100% (94/94) | 0 |
| Cross-contamination | ~128 cases | 105 cases | **-23 improved** |

**Verdict**: 1.4% intent regression. Not acceptable for production deployment. Reverted to baseline.

---

## Analysis

### What Improved
- Cross-contamination down from ~128 to 105 cases (18% reduction)
- Type separation unchanged (90%)
- Response quality unchanged

### What Regressed
- 17 fewer correct intent matches
- CLASSIFIER-routed accuracy may have slightly decreased for some edge cases

### Root Cause Analysis
The regression is likely due to:
1. **Label expansion** (179→222): More labels = more confusion for borderline cases
2. **Training data imbalance**: Synthetic data for 65 weak intents may dilute strong intents
3. **Only 3 epochs**: Insufficient to fully learn the expanded label space
4. **replay_ratio=0.5**: Half the training was replay of old data, but old data only covers 179 labels

### Recommendations for v3
1. **Increase replay ratio** to 0.7-0.8 (preserve more old knowledge)
2. **More epochs** (5-8) with early stopping on validation set
3. **Separate validation set** from E2E test cases for proper evaluation
4. **Per-intent F1 comparison**: Track which specific intents regressed
5. **Consider freezing more layers** (10-11 instead of 8) to preserve learned features

---

## Model Locations on Server

| Model | Path | Labels | Status |
|-------|------|--------|--------|
| **Production (current)** | `/www/wwwroot/python-services/models/chinese-roberta-wwm-ext-classifier/final/` | 179 | ACTIVE |
| V1 Incremental | `.../incremental/final/` | 222 | Abandoned (poor - full head reinitialized) |
| V1 Transferred | `.../incremental/final_transferred/` | 222 | Intermediate (weight transfer base) |
| **V2 Incremental** | `.../incremental_v2/final/` | 222 | Staged (85% E2E, 76.4% training acc) |

---

## Training Details (V2)

- **Base model**: V1 transferred (smart weight transfer: 169 overlapping labels restored)
- **Training data**: 19,690 old samples + 3,436 synthetic samples
- **Hyperparameters**: epochs=3, batch=16, lr=2e-5, freeze=8 layers, replay_ratio=0.5
- **Curriculum sampling**: WeightedRandomSampler with weights = 1/(F1+0.1)
- **Pre-training**: Accuracy 48.8%, F1 Macro 0.557
- **Post-training**: Accuracy 76.4%, F1 Macro 0.771, F1 Weighted 0.731
- **Duration**: ~28 minutes on 8C CPU
