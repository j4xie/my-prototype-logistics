# v2 conv memory vs S3 baseline — quantitative deltas

Generated: 2026-04-26T17:38:03.879Z
Baseline file: tests/e2e-comprehensive/results/depth-aiq-2026-04-26/qa-results.json
v2 file: tests/e2e-comprehensive/results/depth-aiq-2026-04-26/qa-results.v2-conv-memory.json

## Followup buckets (baseline → v2)

| Tenant | total | cache % | empty % | timeout % | avg ms |
|---|---|---|---|---|---|
| **qhj** | 90→90 | 24.4→22.2 | 20→2.2 | 3.3→3.3 | 8920→10677 |
| **gml** | 90→90 | 4.4→4.4 | 4.4→4.4 | 4.4→6.7 | 13850→14213 |
| **xmx** | 90→90 | 7.8→3.3 | 8.9→1.1 | 11.1→1.1 | 15384→12551 |
| **All** | 270→270 | 12.2→10 | 11.1→2.6 | 6.3→3.7 | 12718→12480 |

**Targets** (per handoff §3): cache % approximately stable, empty % drop, timeout % 11.5 → <5, avg ms ideally lower.

## Spotlight: 6 critical handoff cases

| ID | type | baseline | v2 | answer cmp |
|---|---|---|---|---|
| qhj-fu-15-1 | 为什么 | 1362ms cache_aggregate (246c) | 1728ms cache_aggregate (246c) | 🔴 366ms slower |
| qhj-fu-13-1 | 为什么 | 26467ms llm_cold (0c) | 21788ms llm_cold (183c) | 🟢 4679ms faster |
| qhj-fu-09-2 | 对比 | 767ms template_fast_path (485c) | 799ms template_fast_path (485c) | 🔴 32ms slower |
| gml-fu-01-2 | 假设 | 28628ms llm_cold (240c) | 11143ms llm_cold (192c) | 🟢 17485ms faster |
| gml-fu-09-2 | 对比 | 8897ms llm_warm (240c) | 7852ms llm_warm (189c) | 🟢 1045ms faster |
| xmx-fu-15-1 | 为什么 | 30113ms timeout_or_slow (0c) | 15852ms llm_cold (282c) | 🟢 14261ms faster |

## Bucket distribution (followup, both runs)

| Bucket | baseline | v2 | Δ |
|---|---|---|---|
| llm_cold | 152 | 160 | +8 |
| llm_warm | 53 | 73 | +20 |
| template_fast_path | 21 | 21 | +0 |
| cache_aggregate | 27 | 6 | -21 |
| timeout_or_slow | 17 | 10 | -7 |

## 解读

- timeout_or_slow 是核心指标 — handoff §3 期望 11.5% → <5%。
- empty % 同样关键 — 没数据答案的 follow-up 应当大幅减少。
- cache % 应保持/提高 (Phase 6 P1 reject mismatch 后会让一小撮 false positive 重新走 LLM,但 LLM 现在有 parent context, 总体质量应升).
- 量化 bucket 只反映速度+空答率,不反映 1-5 评分。需要 agent-team 审计 qa-results.v2-conv-memory.json 才能算 综合分 vs 3.21 baseline.
