# Phase 1b Ship Report

**Date**: 2026-04-29  
**Branch**: `e2e/v1-framework`  
**Status**: SHIPPED ✅

---

## Deliverables

- **24 chapters complete**: Tier 1 production-grade × 3 (§1 智能数据分析, §2 财务PBI看板, §3 Excel上传), Tier 2-5 skeleton × 21
- **4 training paths**: A1 (前台/收银), A2 (中台/财务文员), B (店长首月), C (老板月度回顾)
- **6 §B decision synthesis chunks**: 客单价/食材成本率/翻台率/复购流失/多门店扩张/员工绩效联动
- **Demo data**: `docs/plans/demo-data/demo_restaurant_sales.csv` (30 rows, 3 stores, 10 days)

## KB Metrics

| Env | Source | subcategory | Chunks |
|-----|--------|-------------|--------|
| test (cretas_db) | restaurant-product-manual.html | restaurant | 228 |
| prod (cretas_prod_db) | restaurant-product-manual.html | restaurant | 228 |
| both | factory-operation-manual.html | factory | 243 |
| both | restaurant-metrics-glossary.html | restaurant | 168 |

Total KB: 683 chunks across all sources.

## Counter-Test Results (test env)

**19/20 queries hit restaurant-product-manual.html in top-3 sources** (threshold: ≥15/20)

| Category | Queries | Pass | Fail |
|----------|---------|------|------|
| Module-specific | 10 | 9 | 1 |
| Cross-chapter (§B synthesis) | 6 | 6 | 0 |
| Neutral baseline | 4 | 4 | 0 |
| **Total** | **20** | **19** | **1** |

Single fail: "供应商对账流程" → routes to factory-operation-manual.html (correct behavior — supply chain operations are factory domain; restaurant §9 covers ordering but not full audit trail).

## Phase 0 Foundation (completed prior session)

- DDL: `food_knowledge_documents.subcategory VARCHAR(64)` + 2 indexes
- Retriever: `subcategories` param → `WHERE subcategory = ANY(...)` routing
- Domain detection: `_RESTAURANT_KEYWORDS` frozenset (43 keywords) in `manual_chat.py`
- Counter-test Phase 0: 10/10 routing correct

## Commits (Phase 1b)

| Commit | Content |
|--------|---------|
| `05f7b922e` | HTML skeleton — 24 chapters + TOC + appendix anchors |
| `b7c52e0bf` | §1 智能数据分析 (Tier 1 重模板) |
| `2bce304a9` | §2 财务PBI看板 (Tier 1 重模板) |
| `a38900ae1` | §3 Excel上传 (Tier 1 重模板) + demo CSV |
| `324d85015` | Batch 1: §4-§8 (Tier 2, 5章) |
| `5d2d5b9b9` | Batch 2: §9-§12 (Tier 3前半, 4章) |
| `ba5614101` | Batch 3: §13-§15 (Tier 3后半, 3章) |
| `3b39b89f1` | Batch 4: §16-§20 (Tier 4+5, 5章) |
| `060441793` | Batch 5: §21-§24 + 4培训路径 + §B 6决策合成 |
| `4289fe7d0` | Fix: §B synthesis restructure to ol steps |

## What's Next (Phase 2 — Drift防腐 CI)

- `scripts/ci/check-kb-meta-freshness.py` — CI lint: §1/§2/§11 last-verified meta 6-week fail
- `scripts/ci/check-kb-anchor-consistency.py` — CI lint: §B synthesis anchor consistency
- `.github/workflows/kb-drift-check.yml` — GitHub Actions workflow
- `.github/CODEOWNERS` + `.github/pull_request_template.md` — PR-checklist gate

Phase 2 can be executed independently (~3-4 hr). Not blocking for customer use.
