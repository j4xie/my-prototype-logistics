# Phase 1a Smoke Test Results — Tier 1 Chapters Ingested

**Date**: 2026-04-29  
**Branch**: e2e/v1-framework  
**Source file**: `docs/plans/restaurant-product-manual.html`

---

## Chunk Counts

| DB | Source | Subcategory | Chunks |
|----|--------|-------------|--------|
| cretas_db (test) | restaurant-product-manual.html | restaurant | **63** |
| cretas_prod_db (prod) | restaurant-product-manual.html | restaurant | **63** |

Ingester parsed **50 sections → 63 chunks** (exceeded expected 24-36 due to long-form content in 3 Tier 1 chapters).

Note: ingester emitted a budget warning `avg 1.3 chunks/chapter` — this reflects Tier 2-5 stub chapters (thin by design). The 3 Tier 1 chapters (§1, §2, §3) each produced 15-25 chunks as expected.

---

## Smoke Test Results (test env port 8084)

All 5 queries posted to `POST http://localhost:8084/api/food-kb/manual-chat`.

| # | Query | Manual hits | Result |
|---|-------|-------------|--------|
| 1 | 智能数据分析怎么用 | 4 chunks from restaurant-product-manual.html | PASS |
| 2 | 财务看板营业额怎么看 | 7 chunks from restaurant-product-manual.html | PASS |
| 3 | Excel 上传字段识别错了怎么办 | 8 chunks from restaurant-product-manual.html | PASS |
| 4 | 食材成本率超标如何分析 | 5 chunks from restaurant-product-manual.html | PASS |
| 5 | 翻台率低了怎么办 | 2 chunks from restaurant-product-manual.html | PASS |

**5/5 queries returned at least 1 chunk from restaurant-product-manual.html** (threshold was ≥3/5).

---

## Overall Result

**PASS** — Phase 1a ingestion complete on both test and prod. All Tier 1 chapters (§1 智能数据分析, §2 财务PBI看板, §3 Excel上传) are retrievable via semantic search.

### Next Steps
- Phase 1b: Write Tier 1 §4-§6 chapters (预测趋势, 异常检测, AI对话)
- Phase 2: Write Tier 2 chapter content (餐厅运营指标, 门店管理)
- Prod live verification on port 8083 (cretas_prod_db confirmed 63 chunks)
