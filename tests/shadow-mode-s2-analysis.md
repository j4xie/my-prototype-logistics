# S2 Shadow Mode Analysis Report

**Date**: 2026-03-01
**Traffic Source**: E2E test suite (1232 queries) against production (10010)

## Overall Stats

| Metric | Value |
|--------|-------|
| Total PHRASE_MATCH records | 707 |
| Shadow agreed | 275 (38.9%) |
| Shadow disagreed | 432 (61.1%) |
| Avg classifier entropy | 2.12 |

## S3 Candidate Intents (100% agreement, ≥3 samples)

| Intent | Samples | Entropy | Note |
|--------|---------|---------|------|
| MATERIAL_BATCH_CREATE | 11 | 1.17 | ❌ Failed live test — BERT confuses with PROCESSING_BATCH_CREATE |
| CLOCK_IN | 9 | 0.59 | Low entropy, likely safe |
| PROCESSING_BATCH_CREATE | 7 | 1.42 | |
| REPORT_FINANCE | 6 | 0.69 | Low entropy |
| ORDER_DELETE | 5 | 1.50 | |
| CONTEXT_CONTINUE | 5 | 0.67 | Low entropy |
| COST_TREND_ANALYSIS | 4 | 0.73 | |
| ISAPI_CONFIG_LINE_DETECTION | 4 | 0.62 | |
| CLOCK_OUT | 3 | 0.65 | |
| ORDER_FILTER | 3 | 1.98 | Higher entropy |
| INVENTORY_CLEAR | 3 | 0.79 | |
| PRODUCT_TYPE_QUERY | 3 | 2.36 | Higher entropy |

### S3 Attempt Result

Enabled BERT primary for all 12 intents. Test query "创建物料批次":
- PHRASE_MATCH → MATERIAL_BATCH_CREATE ✅ (correct)
- BERT → PROCESSING_BATCH_CREATE (69.8%) → Semantic → QUALITY_CHECK_CREATE ❌ (wrong)

**Conclusion**: 100% shadow agreement on small samples (n=3-11) is insufficient.
BERT confuses semantically similar intents (物料批次 vs 加工批次).
S3 must wait until after P2 (training data improvement).

## Intents BERT Never Recognizes (0% agreement, top by volume)

| Intent | Samples | Entropy | BERT Guesses |
|--------|---------|---------|-------------|
| FOOD_KNOWLEDGE_QUERY | 54 | 3.67 | Scattered across 13 intents |
| REPORT_INVENTORY | 20 | 1.25 | MATERIAL_BATCH_QUERY, REPORT_PRODUCTION |
| EQUIPMENT_ALERT_LIST | 16 | 2.00 | ALERT_* variants |
| SHIPMENT_QUERY | 15 | 2.01 | SHIPMENT_* variants |
| MATERIAL_BATCH_QUERY | 14 | 1.89 | MATERIAL_BATCH_CREATE confusion |
| PROCESSING_BATCH_LIST | 12 | 2.63 | PROCESSING_* variants |
| ORDER_LIST | 11 | 2.45 | Scattered |
| QUALITY_CHECK_QUERY | 11 | 2.88 | QUALITY_* variants |
| ATTENDANCE_STATS | 11 | 2.03 | ATTENDANCE_* variants |

### Training Data Gap Patterns

1. **Cross-intent confusion**: BERT can't distinguish _CREATE vs _QUERY vs _LIST within same domain
2. **Missing intents**: FOOD_KNOWLEDGE_QUERY, REPORT_INVENTORY, REPORT_KPI not in training set
3. **Alias confusion**: EQUIPMENT_ALERT_LIST vs ALERT_LIST vs ALERT_ACTIVE (same concept, different codes)
4. **High entropy = OOD**: Intents with avg entropy >3.0 are effectively OOD for BERT

## Recommended Next Steps

1. **P2.1**: Identify weak intents from this analysis (47 intents at 0%)
2. **P2.2**: Generate synthetic training data for top-20 weak intents
3. **P2.3**: Incremental fine-tune BERT
4. **Re-run S2**: After training, repeat shadow analysis
5. **S3**: Only enable when ≥50 samples AND ≥95% agreement AND entropy <1.5
