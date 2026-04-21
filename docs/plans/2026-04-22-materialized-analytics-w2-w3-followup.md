# Materialized Analytics W2 / W3 — Follow-up Plan (Stub)

> This stub will be filled in after W1 ships to prod and soaks for approximately one week.
> W1 delivery report: `2026-04-22-materialized-analytics-w1-delivery.md`

---

## W2 — LLM Integration + Remaining Templates

Estimated scope: 2–3 weeks after W1 prod soak.

### LLM context injection

- [ ] `chat.py` reads `smart_bi_pg_analysis_results` for the active upload and injects template summaries into the LLM system prompt (e.g., "TopN shows 产品A accounts for 43% of revenue")
- [ ] Preset analysis buttons in AIQuery bypass LLM entirely — button click → direct template code lookup → return cached `TemplateResult` → render existing `MaterializedAnalysisCard`; no token spend for preset queries

### Additional templates (5 more)

- [ ] `YoYComparison` — year-over-year delta per category/product
- [ ] `MoMComparison` — month-over-month delta, highlight reversals
- [ ] `DistributionStats` — min/p25/median/p75/max/stddev per numeric column
- [ ] `CorrelationMatrix` — pairwise Pearson correlation for numeric columns (polars `pearson_corr`)
- [ ] `CustomerRanking` — revenue/order-count rank for CRM-style data (requires SalesRuleDetector)

### Domain detector expansion

- [ ] Narrow `RestaurantRuleDetector` keyword list — "产品"/"商品"/"成本" overlap with manufacturing; add negative keyword guards
- [ ] `FinanceRuleDetector` — detects 科目/借/贷/凭证 columns
- [ ] `ProductionRuleDetector` — detects 工单/工序/产量/良品率 columns
- [ ] `SalesRuleDetector` — detects 客户/订单/销售额/回款 columns

### Infrastructure (W2)

- [ ] Move hook from `asyncio.create_task` to a durable task queue (Celery with Redis broker, or a pg-backed queue using `smart_bi_pg_task_queue` table) — survives service restarts
- [ ] Add 4 GB swap to 47.100.235.168, or provision a dedicated memory pool for Python test process (8084) so 200K-row stress test can complete

---

## W3 — Semantic Search + UI Polish

Estimated scope: 4–6 weeks after W1 prod soak.

### Semantic search over cached results

- [ ] Install `pgvector` extension on smartbi_db and smartbi_prod_db
- [ ] At materialization time: embed each `TemplateResult.summary` string via the existing embedding service (gRPC port 9090), store vector in `smart_bi_pg_analysis_results.embedding` column
- [ ] New API: `POST /analytics/search` — embed user question → nearest-neighbor vector search → return matching cached template results → stream to FE without LLM
- [ ] Fallback: if cosine similarity < 0.75, fall back to current LLM path

### Dedicated dashboard page

- [ ] New route `/smart-bi/dashboard` — `MaterializedDashboard.vue`
- [ ] Left rail: file picker (existing uploads with cached results)
- [ ] Main area: grid of `MaterializedAnalysisCard` instances, collapsible by template group
- [ ] Export: download all KPIs + charts as PDF (use existing `pdf-creator` skill pattern)

### Drill-down interactions

- [ ] Click a chart bar/pie segment → `GET /analytics/cached/{upload_id}?filter=column:value` → re-render filtered card
- [ ] Back button clears filter, returns to overview

### Per-card contextual Q&A

- [ ] Each `MaterializedAnalysisCard` has a collapsible "追问" (follow-up) text input
- [ ] Submit → LLM prompt = card KPIs + chart data as context + user question
- [ ] Response renders as chat bubble inside the card, not in global chat

---

## Open Questions (to resolve before W2 kickoff)

1. **Durable queue choice**: Celery (heavyweight, needs worker process) vs pg-backed queue (zero new infra, fits existing systemd model). Lean toward pg-queue given single-server deployment.
2. **Embedding cost**: gRPC embedding service at 9090 is synchronous. Embedding 5 template summaries per upload adds ~50 ms at materialization time. Acceptable, but measure before committing to W3 semantic search.
3. **pgvector availability**: confirm extension is available on the current Alibaba Cloud PostgreSQL version (47 server runs self-managed PG via systemd — should be installable; 139 mall PG may need separate install).
4. **W2 template priority**: YoY/MoM require time-dimension data. If most real uploads are non-time-series, prioritize `DistributionStats` + `CustomerRanking` first.
