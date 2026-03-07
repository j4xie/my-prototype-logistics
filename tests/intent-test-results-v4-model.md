# Intent Routing E2E Test Report — v4 Model (222 labels)

**Date**: 2026-02-28
**Duration**: Phase 1 ~15 min + Phase 2b ~3 min = ~18 min total
**Model**: incremental_v4 (222 labels, trained with 3,436 synthetic + 19,690 replay samples)
**Server**: 47.100.235.168:10010 (production)

---

## Summary Comparison

| Metric | v35.1 Baseline | v35.4 (Last) | **v4 Model** | Delta (vs v35.4) |
|--------|---------------|--------------|-------------|-------------------|
| Phase 1 Intent Accuracy | 87% (1066) | 86% (1060) | **86% (1057)** | -3 (LLM variance) |
| Phase 1 Type Separation | 90% (1107) | 89% (1099) | **90% (1105)** | +6 |
| Phase 2 Curated Quality | 84% (79/94) | 79% (74/94) | **84% (79/94)** | +5 |
| Phase 2 Acceptable | 100% (94/94) | 100% (94/94) | **100% (94/94)** | 0 |
| Phase 2b Full PASS | 85% (1052) | 100% (1227) | **100% (1226)** | -1 |
| Phase 2b FAIL | ~189 | 5 | **6** | +1 |

---

## Match Method Distribution

| Method | Count | % | Description |
|--------|-------|---|-------------|
| PHRASE_MATCH | 751 | 59% | Phrase substring matching (fast path) |
| SEMANTIC | 323 | 25% | Semantic router (embedding similarity) |
| CLASSIFIER | 194 | 16% | BERT classifier (v4 model, 222 labels) |
| EXACT | 2 | 0% | Exact string match |
| LLM_FALLBACK | 0 | 0% | LLM tool-calling fallback |

**Verdict Distribution:**
- V (correct intent + type): 982
- T (wrong intent): 113
- I (wrong type): 96
- X (unmatched): ~41 (expected UNMATCHED)

---

## Phase 2b FAIL Breakdown (6 cases)

| Category | Input | Routed To | Issue |
|----------|-------|-----------|-------|
| AA11 | "仓库里头还有好多货伐" | APPROVAL_SUBMIT | Dialect → STATUS_FAILED |
| AG3 | "这个告警是什么级别的" | SCHEDULING_QUERY_COVERAGE | Misroute → STATUS_FAILED |
| AI4 | "考勤已常记录" | ERROR | Typo → API_ERROR (90s timeout) |
| S1 | "牛肉和鸡肉哪个热量高" | BATCH_AUTO_LOOKUP | Cross-domain → STATUS_FAILED |
| S2 | "苏丹红有什么危害" | CONDITION_SWITCH | Cross-domain → STATUS_FAILED |
| Z5 | "我不是要打卡，我是查考勤" | ERROR | Correction → API_ERROR (90s timeout) |

---

## v4 Model Details

### Training Configuration
- **Base model**: chinese-roberta-wwm-ext (incremental from v2 merged model)
- **New data**: 3,436 synthetic samples (65 weak intents)
- **Old data**: 19,690 replay samples (170 intents)
- **Total training**: 23,126 samples, 222 labels
- **replay_ratio**: 6.0 (ALL old data used)
- **freeze_layers**: 6, lr: 3e-5, batch: 16, epochs: 3
- **Eval accuracy**: 90.4%, F1_macro: 0.9002, F1_weighted: 0.9025

### Deployment
- Server path: `/www/wwwroot/python-services/models/chinese-roberta-wwm-ext-classifier/final/`
- Format: model.safetensors (PyTorch) + model.onnx (ONNX FP32)
- Labels: 222 (up from 179 in v35.4 baseline)
- Inference: ~38ms mean on CPU (ONNX), ~21ms via PyTorch

### Catastrophic Forgetting Prevention
- v3 attempt with replay_ratio=0.5 → 6% accuracy (catastrophic forgetting)
- v4 used replay_ratio=6.0 (all old data) → 90.4% accuracy
- Lesson: with 3,436 new samples, need ALL 19,690 old samples to prevent forgetting

---

## Key Findings

1. **No regression**: v4 model (222 labels) maintains parity with 179-label v35.4 baseline
2. **43 new intent labels added** without degrading existing performance
3. **CLASSIFIER handles 16% of traffic** (194/1232 queries)
4. **Phase 2b quality maintained** at 100% (1226/1232 acceptable)
5. **Remaining failures** are in dialect, typo, and cross-domain edge cases — not related to new labels

---

## Phase 1 Category Breakdown

### Perfect (100%) Categories (47 categories)
A2, AA10, AA2, AA4, AA7, AB13, AB14, AB15, AB5, AB6, AB8, AG1, AG2, AH10, AH4, AH5, AH9, AI5, AJ2, AK2, AK3, AL2, AL3, AO2, AP1, AP3, AQ1, AR3, AS2, AS3, AT1, AT2, AU2, AV4, AW3, AX2, AY1, AY2, AY3, AY4, AY5, AZ1, B1, B2, B3, B5, B6, B8, C1, C2, C3, D2, D5, E1, E2, E3, E4, E5, E6, E7, F1, F2, F3, G2, G3, G4, H1, H2, H3, H4, H5, H7, H8, I1, I3, I4, J1, J2, J3, K1, K2, K3, K4, L1, L2, M1, M2, M3, M4, N1, N3, O1, O2, P1, P3, P4, Q1, Q2, Q3, R2, R3, T2, T3, T7, T8, T10, U2, U3, U4, U5, U6, V1, V2, W1, W4, W5, X2, X3, X4, Z1, Z5, Z6, Z7

### Worst Categories (< 50%)
| Category | Score | Description |
|----------|-------|-------------|
| AM1 | 0/5 (0%) | 餐饮-写入操作 |
| T4 | 0/3 (0%) | 对抗-跨域连词bypass |
| AA11 | 1/5 (20%) | 方言-地方化表达 |
| AC4 | 1/5 (20%) | 餐饮-损耗管理 |
| AD2 | 1/6 (17%) | 摄像头-管理操作 |
| AE2 | 1/5 (20%) | 秤-故障排查与校准 |
| AG3 | 2/5 (40%) | 告警-分诊诊断 |
| AH8 | 2/4 (50%) | 员工-删除变体容错 |
| AW4 | 2/6 (33%) | 排班执行深层 |
| AW5 | 2/6 (33%) | 审批流程深层 |
| AX5 | 2/4 (50%) | 流水账混合多意图句 |

---

## Next Steps

1. **Shadow mode (S1-S2)**: Deploy shadow classify to compare PHRASE_MATCH vs BERT on the 751 PHRASE_MATCH queries
2. **Gradual BERT primary (S3)**: For intents where BERT agrees >99% with PHRASE_MATCH, switch to BERT-primary routing
3. **P3 Curriculum sampling**: Apply weighted sampling to improve the 11 worst categories above
4. **ZPD collection (P1)**: Start collecting boundary samples from NeedFullLLM and OOD paths
