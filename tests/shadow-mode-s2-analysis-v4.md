# Shadow Mode S2 Analysis — v4 Model (222 labels)

**Date**: 2026-02-28 (server: 2026-03-01)
**Model**: v4 (222 labels, 90.4% eval accuracy)
**Shadow data**: 2,467 PHRASE_MATCH records with shadow BERT comparison

---

## Overall Shadow Agreement

| Metric | Value |
|--------|-------|
| Total shadow records | 2,467 |
| Agreed (BERT = PHRASE_MATCH) | 1,112 |
| Agreement rate | **45.1%** |

## Match Method Distribution (6h window)

| Method | Count | % |
|--------|-------|---|
| PHRASE_MATCH | 2,485 | 65.5% |
| SEMANTIC | 663 | 17.5% |
| CLASSIFIER | 625 | 16.5% |
| LLM | 14 | 0.4% |
| NONE | 4 | 0.1% |

---

## S3 Candidates: 100% Agreement Rate (14 intents)

These intents have perfect BERT/PHRASE_MATCH agreement and are safe for BERT-primary routing:

| Intent | Samples | Agreement | Confidence |
|--------|---------|-----------|------------|
| CLOCK_IN | 28 | 100% | Safe |
| COST_TREND_ANALYSIS | 19 | 100% | Safe |
| ORDER_DELETE | 18 | 100% | Safe |
| ISAPI_CONFIG_LINE_DETECTION | 15 | 100% | Safe |
| INVENTORY_CLEAR | 12 | 100% | Safe |
| USER_CREATE | 9 | 100% | Medium (low N) |
| QUALITY_CHECK_EXECUTE | 7 | 100% | Medium (low N) |
| MATERIAL_EXPIRING_ALERT | 6 | 100% | Medium (low N) |
| MATERIAL_BATCH_RESERVE | 5 | 100% | Medium (low N) |
| QUERY_FINANCE_ROE | 5 | 100% | Medium (low N) |
| QUERY_FINANCE_ROA | 5 | 100% | Medium (low N) |
| SHIPMENT_STATS | 5 | 100% | Medium (low N) |
| MATERIAL_FIFO_RECOMMEND | 5 | 100% | Medium (low N) |
| PROCESSING_BATCH_CANCEL | 5 | 100% | Medium (low N) |

**Recommendation**: Start S3 with the top 5 (N >= 12) for confidence.

## Near-Safe: 80-90% Agreement (10 intents)

| Intent | Samples | Agreement |
|--------|---------|-----------|
| ATTENDANCE_TODAY | 20 | 90.0% |
| EQUIPMENT_STOP | 7 | 85.7% |
| REPORT_FINANCE | 27 | 85.2% |
| QUALITY_DISPOSITION_EXECUTE | 20 | 85.0% |
| PROCESSING_BATCH_CREATE | 31 | 83.9% |
| PROCESSING_BATCH_DETAIL | 10 | 80.0% |
| CLOCK_OUT | 10 | 80.0% |
| TASK_ASSIGN_WORKER | 5 | 80.0% |
| PROCESSING_BATCH_PAUSE | 5 | 80.0% |
| CUSTOMER_ACTIVE | 5 | 80.0% |

## Problem Intents: 0% Agreement (27 intents)

These intents have zero BERT agreement — BERT never predicts the same as PHRASE_MATCH:

| Intent | Samples | BERT Prediction Instead |
|--------|---------|------------------------|
| QUALITY_BATCH_MARK_AS_INSPECTED | 21 | Likely confused with QUALITY_CHECK_* |
| PROFIT_TREND_ANALYSIS | 21 | Likely goes to REPORT_TRENDS |
| INVENTORY_OUTBOUND | 18 | Likely goes to MATERIAL_BATCH_* |
| QUERY_APPROVAL_RECORD | 18 | New v4 intent, needs more training data |
| ORDER_APPROVAL | 17 | Likely goes to ORDER_* |
| EQUIPMENT_CAMERA_START | 15 | Likely goes to EQUIPMENT_* |
| ... and 21 more | 5-12 | Various confusions |

---

## Key Insights

1. **45.1% overall agreement** is lower than the 90% expected in the plan. This is because:
   - PHRASE_MATCH uses ~4,435 specific substring rules (high precision for its domain)
   - BERT was trained on general intent patterns, not on PHRASE_MATCH-specific behavior
   - Many PHRASE_MATCH rules trigger on domain-specific substrings BERT hasn't seen

2. **The 14 intents with 100% agreement** represent the "easy wins" for S3 — BERT has learned these well

3. **The 27 intents with 0% agreement** are mostly specialized/rare intents where:
   - BERT labels were added in v4 but have insufficient training data
   - PHRASE_MATCH rules match very specific substrings that don't appear in training

4. **Next training focus**: Collect disagreement samples (1,355 cases) as additional training data for v5 fine-tuning

---

## Next Steps

1. **S3-Phase1**: Enable BERT-primary for 5 high-confidence intents (CLOCK_IN, COST_TREND_ANALYSIS, ORDER_DELETE, ISAPI_CONFIG_LINE_DETECTION, INVENTORY_CLEAR)
2. **P2.5**: Use 1,355 disagreement samples as training data for v5 fine-tuning
3. **Continue shadow accumulation**: Keep shadow mode running for 1-2 weeks for more data
4. **Monitor**: Track agreement rate trend as more data accumulates
