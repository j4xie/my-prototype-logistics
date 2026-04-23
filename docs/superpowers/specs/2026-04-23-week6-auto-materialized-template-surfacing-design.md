# Week 6 Design — Auto-Materialized Template Surfacing

**Date**: 2026-04-23
**Branch**: `e2e/v1-framework`
**Related specs**: `2026-04-22-unified-data-layer-v1-design.md` (§4.2, §4.3)
**Prior shipped work**: Week 5 Agent Layer (commits `72790521a`..`7bf12b7e2` on origin); Week 6 A1+B1 (`5626b8830`, unpushed)

---

## 1. Problem

Every Excel upload triggers `schedule_materialization()` in `backend/python/smartbi/api/excel_async.py:481`. The pipeline evaluates 37 registered templates (`backend/python/smartbi/services/materialized_analytics/templates/`), runs `applies()` on each, and persists successful results to `smart_bi_pg_analysis_results`. **Upload 4169 (qhj, 200K POS rows) produced 28 template rows; uploads 4170/4171 produced 4 each**. The data is there.

The Vue pages don't read it. FinanceAnalysis.vue, Dashboard.vue, the trend page, and the cost page call `/api/smartbi/analysis/dynamic` which reads only the single coarse-grained `analysis_type="dashboard_finance"` row — not the 28 fine-grained template rows (`template_code="profit_loss_statement"`, etc).

User request:
> 上传以后 ui 自动去分析然后存到后端就这样持久化, 关于模板的话, 我们应该 ai 那边有很多做好的, 可以按一下

Translation of intent after clarification: the auto-analyze-persist cycle already works (the 37 templates). What's missing is the UI surface — users can't see the rich template output.

## 2. Goals

1. Surface the materialized template results on 4 existing pages (Dashboard / Finance / Trend / RestaurantV2 KPI) via a shared `TemplateCard.vue` component.
2. Handle the "this upload doesn't contain the required fields" case with a useful empty state, not a 404.
3. Let the frontend ask for many templates in one call (not N serial HTTP roundtrips per page load).
4. Keep pinning out of backend scope — localStorage-only if users actually want it.

Non-goals:
- Personal pinned dashboard, user-level `user_pinned_templates` table, Java CRUD endpoints (explicitly **dropped** after design audit — user's "按一下" means one-click apply, not personal curation).
- 6 currently-empty pages (开票/收款/销售订单/成品库存/出货/客户) — separate sprint; most have no suitable template anyway.
- Template admin UI (enable/disable/reorder). Hardcoded mapping is sufficient for v1.

## 3. Design

### 3.1 Backend: extend `/api/smartbi/gold/analysis-results`

B1 already shipped a single-template version (`5626b8830`). Extend to batch + cross-upload resolution:

```
GET /api/smartbi/gold/analysis-results
  ?template_codes=profit_loss_statement,revenue_management_report  (required, comma-sep, 1..20)
  &factory_id=                                                      (optional, defaults to JWT tenant)
  &resolve_latest=true                                              (default true)
  &upload_id=<id>                                                   (optional override — pin to one upload)
```

Response:

```json
{
  "items": [
    {
      "template_code": "profit_loss_statement",
      "upload_id": 4169,
      "upload_label": "qhj_order_detail_202503.csv",
      "upload_created_at": "2026-03-12T14:30:00",
      "domain": "restaurant_finance",
      "analysis_result": { ... },
      "chart_configs": [ ... ],
      "kpi_values": { ... },
      "insights": [ ... ]
    }
  ],
  "missing_codes": ["groupon_channel_breakdown"],
  "never_materialized_codes": []
}
```

**Resolution rules**:
- `upload_id=<id>` given → strict match; codes not present in that upload go to `missing_codes[]`.
- `resolve_latest=true` (default, no `upload_id`) → for each requested code, find the most recent `smart_bi_pg_analysis_results` row for (factory_id, template_code). Different codes on one response may come from different uploads (UI labels each card with its source upload).
- A code never seen for this factory → `never_materialized_codes[]`. FE distinguishes "this upload doesn't contain it" from "we've never seen it for this factory".

**Query shape** (Postgres):
```sql
SELECT DISTINCT ON (template_code) *
  FROM smart_bi_pg_analysis_results
 WHERE factory_id = $1
   AND template_code = ANY($2)
 ORDER BY template_code, created_at DESC;
```

Index `idx_analysis_upload_factory_template` already covers this (verified Apr 23).

**Batch limit**: 20 codes per call. Current max in mapping is 5, so 20 is 4× headroom.

**Tenant enforcement**: unchanged from existing endpoint — `_resolve_tenant()` already requires JWT tenant match.

### 3.2 Frontend: `TemplateCard.vue` shared component

Single component, owned by the 4 pages. Reads one item from the response and renders:

| Slot | Source |
|---|---|
| Title | `template_code` humanized (hardcoded i18n map: `profit_loss_statement` → "利润表"). **No free-form AI name** — stable titles. |
| Upload badge | `upload_label` + `upload_created_at` formatted as "截至 2026-03-12" |
| KPI strip | `kpi_values` iterated as { label: value } pairs, 2-4 chips |
| Chart | `chart_configs[0]` fed to ECharts via existing `<ChartRenderer>` |
| Insight text | `insights[]` joined, markdown-rendered via existing renderer |

**Empty state** (code in `missing_codes[]`):
```
📭 该数据集不包含 [利润表] 所需字段
   上传含 [营业收入/成本/毛利] 的财务文件后将自动生成
```

(Required-fields text comes from each template's `description` — add a backend field or hardcode a client-side map. Start with hardcoded map.)

**Never-materialized state** (code in `never_materialized_codes[]`): same UX, slightly different copy ("尚未为该工厂生成过此类分析").

**Loading**: skeleton bars same pattern as Dashboard.vue KPI cards.

### 3.3 Page-Template mapping (hardcoded)

`web-admin/src/views/smart-bi/composables/useTemplateMap.ts`:

```ts
export const PAGE_TEMPLATE_MAP: Record<string, string[]> = {
  dashboard:     ["monthly_trend", "top_n_by_dim", "category_distribution", "anomaly_detection"],
  finance:       ["profit_loss_statement", "revenue_management_report",
                  "stored_value_card_consumption", "groupon_channel_breakdown"],
  trend:         ["monthly_trend", "period_comparison_trend",
                  "weekday_weekend_pattern", "monthly_anomaly"],
  restaurantv2:  ["dish_sales_top_n", "dish_slow_movers", "dish_category_breakdown",
                  "combo_usage_rate", "time_slot_revenue"],
};
```

Each page:
1. On mount + on route change, read its list from the map.
2. Call `/analysis-results?template_codes=<csv>` once.
3. Iterate `items + missing_codes + never_materialized_codes`, render one `<TemplateCard>` per code in a responsive grid (2 col on desktop, 1 on mobile).

**This is additive** — existing page content (KPI header, live-SQL charts, etc.) stays where it is. New section "📊 模板分析" appended below.

### 3.4 Data flow

```
Upload completes
  ↓
schedule_materialization(upload_id)             [existing, unchanged]
  ↓
37 templates evaluated, N succeed               [existing, unchanged]
  ↓
Rows written to smart_bi_pg_analysis_results    [existing, unchanged]
  ↓
User opens Finance page
  ↓
GET /analysis-results?template_codes=profit_loss_statement,revenue_management_report,...
  ↓
SELECT DISTINCT ON (template_code) ...          [NEW resolver]
  ↓
4 TemplateCard.vue instances render             [NEW]
```

No background jobs, no new persistence, no new cron. Pure read-path surface.

## 4. Out of scope (declared)

- C (user pinning) — may ship as localStorage later, no spec commitment now
- 6 empty pages — separate sprint, often need new templates or UX design
- Template admin (enable/reorder/delete) — unnecessary for v1
- Cross-factory / multi-tenant pinning — N/A (C dropped)

## 5. Testing

- **Backend unit test** `test_gold_analysis_results_batch.py`:
  - 3 codes requested, 2 materialized for this factory, 1 never materialized → response has `items=[2 rows]`, `missing_codes=[]`, `never_materialized_codes=[1 code]`
  - `upload_id=X` pin → codes not in that upload go to `missing_codes`, not `never_materialized`
  - Tenant isolation: factory A's templates invisible to factory B (RLS via pool setup callback)
  - Batch limit 20 enforced with 400 response

- **FE smoke test** (real browser via test vhost 8097):
  - Login as qhj user → Finance page → see 4 cards, each with real upload badge + chart + KPI
  - Click Trend page → 4 different cards, same shared component
  - Data pre-upload: only "never_materialized" cards shown, no broken states

## 6. Deployment

- Python endpoint extension: existing gold_reads.py, no new route
- Vue: new composable + `TemplateCard.vue` + 4-page integration
- Test first (8084 + 8097 vhost), then prod on explicit approval

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Cross-upload mix confuses users (card A from Mar upload, card B from Apr upload) | `upload_label` + "截至" date on every card makes the source explicit. |
| Templates with heavy `chart_configs` JSONB (>1MB) balloon response | Batch limit 20 + existing payload is <50KB per row in prod. Monitor. |
| Template renamed upstream → stale pages | Page map is hardcoded and version-controlled with pages. CI would catch a rename via `missing_codes` becoming 100%. |
| User wants to pin → localStorage | FE adds simple `📌` affordance that stores code in `localStorage[factory_id].pinned` and renders those first. No backend. |
| Empty state copy is generic | Add per-template `required_fields` text to the hardcoded client map. Nothing special, just strings. |

## 8. Open items

None — audit cleared all concerns. Proceed to writing-plans.
