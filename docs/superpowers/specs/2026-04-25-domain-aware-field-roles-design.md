# Domain-Aware Field Role Classification — Design Spec

**Date**: 2026-04-25 (drafted Apr 24 late session)
**Branch target**: `e2e/v1-framework` (or new branch)
**Status**: Spec, awaiting impl in next session
**Predecessor**: `19df49af6` + `feb3703d4` stop-gap fixes (this session)
**Owner**: Steve / next session execution

---

## 1. Background & motivation

### 1.1 What's broken today (post stop-gap)

Apr 24 2026 we shipped 2 stop-gap commits to prod:
- `19df49af6`: Python `quick_summary` suppresses sum for ID + rating cols (heuristic: name endswith `ID` or `分`)
- `feb3703d4`: FE `getSmartKPIs` displays rating means as `平均X = 4.83 分` (precision=2)

These work for the qhj review xlsx case but are **brittle**:

1. **Heuristic-based detection** — col name must end with literal "ID" / "id" / "分". Variants miss:
   - 美团 stores might use `店铺号` (number) instead of `门店ID` → not suppressed → summed as 亿
   - Custom rating columns named `综合评估` / `客户满意度评分` → not detected → summed
2. **No domain awareness** — same FE logic runs for POS / inventory / finance / review xlsx. POS legitimate measures (营业额, 折扣额) work fine, but adding new domains (e.g. inventory: 库存量, 进货量) might pick up wrong agg strategy.
3. **Per-template hardcoding scattered** — `reviews_sentiment_summary.py` knows it's a review template via `applies()` checking 星级 col. But there's no `restaurant_pos_template` / `inventory_template` discriminator at the data layer.
4. **Stop-gap doesn't fix dropdown switch staleness** — verified Apr 24 night that switching SmartBIAnalysis dropdown POS→review→POS still shows mixed/stale KPI titles. Root cause likely in batch-grouping logic but not fully traced.

### 1.2 What this spec proposes

Replace heuristics with **explicit domain detection + per-domain field role rules**:

1. **Bronze → Silver Domain detection**: at upload time, classify the xlsx into one of: `review`, `pos`, `inventory`, `finance_pl`, `finance_cashflow`, `customer`, `staff`, `unknown`. Stored on `smart_bi_pg_excel_uploads.domain` column.
2. **Per-domain field role registry**: per-domain Python module declares the canonical set of field semantic_types and their preferred aggregation. Field detector consults the domain registry before defaulting.
3. **Explicit `agg_strategy` column** on `smart_bi_pg_field_definitions`: `sum` / `mean` / `count_distinct` / `count` / `none`. KPI generator (FE getSmartKPIs + Python quick_summary) reads from DB, never re-derives.
4. **FE refresh on dropdown switch** + **review xlsx empty-state** as bundled UX polish.

---

## 2. Scope

### 2.1 In scope (~1.5-2 days)

**Backend (Python)**:
- New module `backend/python/smartbi/services/domain_detector.py` — detect xlsx domain via column signature
- New module `backend/python/smartbi/services/domain_rules/` — one file per domain (`review_rules.py`, `pos_rules.py`, etc.) declaring semantic types + agg strategies
- Modify `field_classifier.py` (or `unified_analyzer.py` / `semantic_mapper.py`) to consult `domain_rules` after baseline classification
- Modify `quick_summary` in `insight.py` to read `agg_strategy` from field_definitions instead of heuristic detection

**Backend (Java)**:
- DB migration `Vxxx_add_domain_and_agg_strategy.sql`:
  - `ALTER TABLE smart_bi_pg_excel_uploads ADD COLUMN domain VARCHAR(32) DEFAULT 'unknown';`
  - `ALTER TABLE smart_bi_pg_field_definitions ADD COLUMN agg_strategy VARCHAR(32) DEFAULT 'sum';`
- Update `SmartBiPgExcelUpload` + `SmartBiPgFieldDefinition` JPA entities
- Modify `DynamicDataPersistenceServiceImpl` to populate domain + agg_strategy from Python response

**Frontend (Vue)**:
- `getSmartKPIs` (analysis.ts) reads `aggStrategy` from ColumnSummary as authoritative — no client-side heuristic
- AIQuery / SmartBIAnalysis dropdown switch → `forceRefresh=true` for enrichSheet (with proper poll-completion handling)
- Empty-state component: when domain='review' AND no rating cols rendered → display "本表为评价数据,详细分析请用 AI 问答" with quick-link

**Migration**:
- One-off script to backfill `domain` + `agg_strategy` for all existing prod uploads (re-classify via new code)
- Re-materialize all uploads to ensure cache coherence (use the analysis-cache DELETE endpoint for each)

### 2.2 Out of scope (defer to v2 / separate spec)

- LLM-based domain detection (current scope = column signature heuristic only; LLM can be a fallback for `unknown` later)
- Per-tenant custom domain rules (all tenants share same rules in v1)
- KPI displayMode upgrade (sparkline / gauge / progress) for ratings — keeping default 平均X display
- Cross-upload joint analysis (separate Slice 3 spec)
- `agg_strategy='count'` for non-numeric dimensions (only numeric cols get agg_strategy in v1)

---

## 3. Architecture

### 3.1 Data flow with new layer

```
Excel upload
  ↓
Java upload-batch-stream → Python excel_async parses xlsx
  ↓
Python field_classifier — baseline classification (data_type / semantic_type)
  ↓
NEW: domain_detector.detect(columns + sample_values) → returns domain ∈ {review, pos, inventory, finance_pl, finance_cashflow, customer, staff, unknown}
  ↓
NEW: domain_rules[domain].apply(field_def) — overrides agg_strategy + chart_role per domain
  ↓
Java DynamicDataPersistence saves: + smart_bi_pg_excel_uploads.domain + smart_bi_pg_field_definitions.agg_strategy
  ↓
FE enrichSheet → quick_summary (uses agg_strategy from DB) → returns ColumnSummary with aggStrategy
  ↓
FE getSmartKPIs reads aggStrategy → builds KPI cards (sum / mean / count / none dispatcher)
```

### 3.2 Key files

| File | Action | LoC |
|---|---|---|
| `backend/python/smartbi/services/domain_detector.py` | NEW | ~180 |
| `backend/python/smartbi/services/domain_rules/__init__.py` | NEW | ~30 |
| `backend/python/smartbi/services/domain_rules/review.py` | NEW | ~80 |
| `backend/python/smartbi/services/domain_rules/pos.py` | NEW | ~120 |
| `backend/python/smartbi/services/domain_rules/finance_pl.py` | NEW | ~60 |
| `backend/python/smartbi/services/domain_rules/inventory.py` | NEW | ~60 |
| `backend/python/smartbi/services/domain_rules/unknown.py` | NEW | ~30 (passthrough defaults) |
| `backend/python/smartbi/services/field_classifier.py` | MODIFY | +30 (domain_rules invocation) |
| `backend/python/smartbi/api/insight.py` (`quick_summary`) | MODIFY | -30 +20 (drop heuristic, read agg_strategy from DB) |
| `backend/java/.../entity/.../SmartBiPgFieldDefinition.java` | MODIFY | +6 (aggStrategy field) |
| `backend/java/.../entity/.../SmartBiPgExcelUpload.java` | MODIFY | +6 (domain field) |
| `backend/java/.../service/.../DynamicDataPersistenceServiceImpl.java` | MODIFY | +20 (populate from Python response) |
| `backend/java/.../resources/db/migration/Vxxx__add_domain_and_agg_strategy.sql` | NEW | ~10 |
| `web-admin/src/api/smartbi/analysis.ts` (`getSmartKPIs`) | MODIFY | -20 +10 (drop FE heuristic, pure aggStrategy dispatch) |
| `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` | MODIFY | +30 (empty-state for review domain + dropdown forceRefresh fix) |

Total: ~10 new files, ~5 modify, ~600 LoC net change.

### 3.3 Domain rules schema

Each `domain_rules/<domain>.py` exports:

```python
from typing import Dict, List, Tuple

# Map: column-name regex pattern → (semantic_type, agg_strategy)
# First match wins. Fallback in unknown.py for unclassified cols.
RULES: List[Tuple[str, str, str]] = [
    # (pattern, semantic_type, agg_strategy)
    (r'.*(评分|星级|口味|环境|服务).*分$', 'rating', 'mean'),
    (r'.*(评价ID|评论ID|评价编号)$', 'review_id', 'none'),
    (r'.*(团购ID|代金券ID).*$', 'product_id', 'none'),
    (r'.*(门店ID|店铺ID|分店ID|美团ID).*', 'store_id', 'none'),
    (r'.*(具体门店|评价门店|分店|店铺名称).*', 'store_name', 'count_distinct'),
    (r'.*(投诉状态|审核状态)$', 'status', 'count'),
    # ... etc
]

# Optional: required column signatures to confirm this domain
SIGNATURE_COLS: List[str] = ['星级分', '评价时间', '具体门店']  # all required for high-confidence
```

### 3.4 Domain detector signature

```python
def detect(columns: List[str], sample_values: Dict[str, List]) -> Tuple[str, float]:
    """Return (domain, confidence ∈ [0,1])."""
    scores: Dict[str, float] = {}
    for domain in ALL_DOMAINS:
        rules_module = importlib.import_module(f"smartbi.services.domain_rules.{domain}")
        sig_cols = getattr(rules_module, 'SIGNATURE_COLS', [])
        present = sum(1 for s in sig_cols if any(re.search(s, c) for c in columns))
        scores[domain] = present / max(len(sig_cols), 1)
    best = max(scores.items(), key=lambda x: x[1])
    return best if best[1] >= 0.5 else ('unknown', best[1])
```

---

## 4. Per-domain rule sets (initial v1)

### 4.1 review

- SIGNATURE_COLS: 星级分, 评价时间, (具体门店 OR 评价门店)
- RULES:
  - 评价ID / 评论ID / 评价编号 → semantic_type='review_id', agg='none'
  - 团购ID / 代金券ID → semantic_type='product_id', agg='none'
  - 门店ID / 店铺ID / 分店ID / 美团ID → semantic_type='store_id', agg='none'
  - 星级分 / 口味分 / 环境分 / 服务分 / 评分 → semantic_type='rating', agg='mean'
  - 投诉状态 → semantic_type='status', agg='count' (count by value)
  - 是否vip → semantic_type='boolean_flag', agg='count_true_pct'

### 4.2 pos

- SIGNATURE_COLS: 营业额 OR 销售金额, (订单类型 OR 桌位 OR 账单号), 营业日期 OR 交易日期
- RULES:
  - 应收金额 / 营业额 / 销售金额 / 收款金额 → semantic_type='gross_revenue', agg='sum'
  - 实收额 / 实收金额 / 实收 → semantic_type='net_revenue', agg='sum'
  - 折扣额 / 优惠额 / 优惠折扣 / 分摊优惠 → semantic_type='discount', agg='sum'
  - 客流量 / 客数 / 客单人数 / 用餐人数 → semantic_type='customer_count', agg='sum'
  - 商品结账总数 → semantic_type='item_count', agg='sum'
  - 订单ID / 账单号 / 流水号 / 外部单号 / 关联单号 → semantic_type='order_id', agg='none'
  - 桌位 / 桌号 → semantic_type='table_id', agg='count_distinct'
  - 服务员 / 销售员 / 收银员 → semantic_type='staff', agg='count_distinct'

### 4.3 finance_pl

- SIGNATURE_COLS: (营业收入 OR 主营业务收入), (营业成本 OR 主营业务成本), 净利润 OR 毛利润
- RULES:
  - 营业收入 / 主营业务收入 / 收入 → semantic_type='revenue', agg='sum'
  - 营业成本 / 主营业务成本 / 成本 → semantic_type='cost', agg='sum'
  - 毛利润 / 净利润 → semantic_type='profit', agg='sum'
  - 毛利率 / 净利率 → semantic_type='ratio', agg='mean'

### 4.4 inventory

- SIGNATURE_COLS: (库存量 OR 库存数), (商品名 OR 物料名), 单位 OR 库存单位
- RULES:
  - 库存量 / 库存数 / 现存量 → semantic_type='stock_level', agg='sum'
  - 进货量 / 入库量 → semantic_type='inflow', agg='sum'
  - 出库量 / 销售量 → semantic_type='outflow', agg='sum'
  - 单价 / 进货价 / 售价 → semantic_type='unit_price', agg='mean'
  - 商品ID / SKU → semantic_type='product_id', agg='none'

### 4.5 unknown (fallback)

Default rules:
- Numeric col with name containing `ID/编号/号` → agg='none'
- Numeric col with name endswith `分/率/%` AND mean ∈ [0, 100] → agg='mean'
- All other numeric cols → agg='sum'

---

## 5. Migration plan

### 5.1 Schema migration

```sql
-- Vxxx__add_domain_and_agg_strategy.sql (Flyway)
ALTER TABLE smart_bi_pg_excel_uploads
ADD COLUMN domain VARCHAR(32) DEFAULT 'unknown',
ADD COLUMN domain_confidence NUMERIC(3,2) DEFAULT 0.0;

ALTER TABLE smart_bi_pg_field_definitions
ADD COLUMN agg_strategy VARCHAR(32) DEFAULT 'sum';

CREATE INDEX idx_excel_uploads_domain ON smart_bi_pg_excel_uploads(domain);
```

### 5.2 Backfill script

```python
# scripts/backfill_domain_and_agg_strategy.py
# For each upload: load cols + sample, run domain_detector, run domain_rules, UPDATE rows.
# Estimated runtime: ~5-10s per upload, ~100 prod uploads = 10-15 min.
```

### 5.3 Cutover order

1. Deploy DB migration (Java startup runs Flyway) — LOW RISK (additive columns, no schema breakage)
2. Deploy Python (new domain_detector + rules) — medium risk: enrichment for new uploads uses new path
3. Deploy Java (entity field + persistence path) — co-deploy with #2
4. Run backfill script on prod — populates existing uploads
5. Deploy FE (read aggStrategy from DB, drop heuristic) — co-deploy with #3
6. Smoke test: 94-test suite + dropdown switch + KPI display

### 5.4 Rollback plan

- DB migration is additive — no rollback needed (columns can be ignored)
- Python: `git revert` + redeploy → reverts to heuristic-based suppression (still works for ID/rating)
- FE: same — revert to heuristic-based getSmartKPIs

---

## 6. Test plan

### 6.1 Unit tests

- `tests/test_domain_detector.py`: 5 domain examples + 1 unknown → assert correct classification
- `tests/test_domain_rules_review.py`: known qhj review xlsx cols → assert each gets correct agg_strategy
- `tests/test_domain_rules_pos.py`: known qhj POS cols → assert agg_strategy correct, no false positive on review fields
- `tests/test_field_classifier_with_domains.py`: integration — full classifier path with domain detector

### 6.2 End-to-end (deep, per qa-prompt v2.4)

Per Rule 11 read-after-write roundtrip:

1. Upload qhj Q3 review xlsx to test → assert `smart_bi_pg_excel_uploads.domain='review'` + assert `agg_strategy` for 服务分 = 'mean', for 评价ID = 'none'
2. Upload qhj POS xlsx (via existing path) → assert `domain='pos'` + 营业额 agg_strategy='sum', 账单号 agg_strategy='none'
3. quick_summary on review upload returns aggStrategy correctly
4. FE getSmartKPIs renders 平均X cards for ratings (verify via Playwright)
5. FE dropdown switch from POS → review → POS doesn't leak titles (the bug we couldn't fix tonight)

### 6.3 Regression matrix

- All current 12 review templates still apply correctly (templates use semantic_type which doesn't change)
- All POS analysis (financial overview, top stores, etc.) still works
- 94-test smoke suite (`p2-guardrail-full.mjs`) maintains 93/94 baseline

### 6.4 Performance

- domain_detector should add < 100ms to upload pipeline (one-time cost per upload)
- quick_summary should not slow down (DB lookup of agg_strategy is one extra query per upload)

---

## 7. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Domain detection mis-classifies (e.g. POS-with-rating-col gets `review`) | Med | Med | Confidence threshold ≥ 0.5 + fallback to `unknown` (uses heuristic) |
| Rule patterns drift across vendors (美团 names differ from 大众点评) | Med | Med | Regular review per merchant onboarding; `unknown` fallback ensures no upload breaks |
| Backfill script crashes mid-run | Low | Low | Idempotent (UPDATE WHERE columns NULL only); safe to re-run |
| Java entity migration breaks existing JPA repository | Low | High | Test on test env first; Flyway runs in transaction |
| Cross-domain field-name collision (e.g. 客户ID in review + customer + pos all should be agg='none') | Med | Low | Common rules in `unknown.py`; domain rules override only when more specific |
| Large prod re-enrichment after deploy | Med | Med | Run during low-traffic window; analysis-cache DELETE per upload |
| Dropdown-switch staleness (the unfixed A1 bug) | High | Med | Spec includes A1 fix as part of Mini-C; if root cause is batch grouping, separate fix |

---

## 8. Success criteria (Definition of Done)

- [ ] DB migration runs cleanly on test + prod
- [ ] All current prod uploads have non-NULL `domain` + `agg_strategy` after backfill
- [ ] Unit tests: 100% PASS for domain_detector + each domain_rules module
- [ ] qhj 4172 review upload: 4 平均X cards rendered (4.83 / 4.83 / 4.82 / 4.82) — same as today
- [ ] qhj 4169 POS upload: legitimate measures render (营业额, 实收额, etc.); IDs (账单号, 外部单号) NOT shown as KPI cards
- [ ] AIQuery review-aware default still works (Mini-C from feb3703d4)
- [ ] Dropdown switch in SmartBIAnalysis: POS→review→POS shows correct KPIs each time, no leak
- [ ] 94-test smoke maintains 93/94 baseline
- [ ] Reviewer audit: 0 P0
- [ ] No client-side heuristic (regex on col name) in `getSmartKPIs` — all dispatch from `aggStrategy`
- [ ] No Python heuristic in `quick_summary` — all from DB `agg_strategy`

---

## 9. Backlog after this spec

- LLM-based domain detection for `unknown` uploads (asks LLM "what kind of business data is this?" — deterministic fallback)
- Per-tenant custom domain rules (override RULES via tenant config)
- More domains: `staff_attendance`, `complaint_log`, `marketing_campaign`
- KPI display upgrade for ratings: sparkline showing 1-5 distribution mini-chart, gauge for ratings near threshold
- Cross-upload joint analysis (Slice 3) — uses domain to decide join keys (review.store_name × pos.store_name)

---

## 10. Implementation sequence (for next session)

Recommended order (each step is a commit):

1. DB migration + Java entity update (~30min, low risk additive)
2. Backfill script — empty implementation that just sets `domain='unknown'` everywhere (test path validation)
3. Python `domain_detector.py` + `unknown.py` rules (~1h)
4. Python `review.py` rules (~30min) + unit test
5. Python `pos.py` rules (~45min) + unit test
6. Python `field_classifier.py` integration with domain_rules (~30min)
7. Python `quick_summary` rewrite to read agg_strategy from DB (~30min)
8. Java DynamicDataPersistence populates domain + agg_strategy (~30min)
9. FE getSmartKPIs simplification (drop heuristic) (~30min)
10. Backfill script for production (~10min)
11. End-to-end test + 94-test smoke + reviewer audit (~1h)
12. Spec for `inventory.py` / `finance_pl.py` rules separately if data available

Total: ~8-10h focused work = 1-1.5 day session.

---

## 11. Spec self-review checklist (run before commit)

- [ ] No "TBD" / "TODO" / "later" placeholders left
- [ ] All file paths use absolute project-relative paths
- [ ] Each domain rule example has at least one concrete pattern
- [ ] Risks table has mitigation for each Med/High risk
- [ ] Test plan covers Rule 11 read-after-write
- [ ] DB migration is additive (not breaking)
- [ ] Rollback plan for each layer (Python, Java, FE)
- [ ] Implementation sequence is bite-sized (each ≤ 1h)
