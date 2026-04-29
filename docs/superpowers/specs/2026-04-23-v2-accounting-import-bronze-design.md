# v2 unblocker — accounting_import Bronze adapter design

**Status**: SPEC DRAFT. Not implementable without customer-format alignment.
**Last updated**: 2026-04-23
**Unblocks**: 成本分析 module Gold flip

---

## Problem

`fact_cost_line` Silver table + `dim_cost_category` exist (migration `2026_05_20_silver_cost.sql`) but **Bronze has no adapter to feed them**. 成本分析 page today has no Gold data because ingestion layer is missing.

## Open questions

1. **What is the client's actual cost-reporting workflow?** Monthly Excel from their accountant? ERP export? Manual data entry? Bank statement + invoice reconciliation?
2. **Which cost categories matter?** Silver CHECK constraint allows `material / labor / overhead / other`. Is 4 enough? Or do we need 租金 / 水电 / 人力 / 食材 / 其他 as a 5-way breakdown matching restaurant industry norms?
3. **Granularity?** Per month / per store / per category is typical. Silver supports per-transaction too but restaurants aggregate at month level.
4. **Who enters the data?** Store manager weekly? Accountant monthly? Automatic reconciliation from bank feeds (far future)?
5. **Retroactive history?** Does the customer have 12 months of historical cost data to backfill, or only go-forward?

## Design options

### Option A: Manual Excel import (MVP)

Add a new UI page `/smart-bi/cost-import` where the user uploads a standard-format Excel ("月度成本表") with columns:

```
| 月份 (YYYY-MM) | 门店 | 类别 | 金额 | 备注 |
```

Python Bronze adapter (`smartbi/ingestion/cost_adapter.py`) parses → Silver upsert. Simple, low-risk, requires user education.

### Option B: Extend restaurant_monthly_purchases (reuse)

Already live in the RestaurantV2 BOM ingestion flow. Add 2 more columns (`labor_cost`, `rent`, `overhead`) and let that single Excel drive both material cost (existing) and full cost analysis (new).

### Option C: Wait for bank feed / ERP integration

Defer indefinitely until a customer has a real ERP.

## Recommendation

**Option A** when client workflow is confirmed. 1-2 day of engineering.

```python
# smartbi/ingestion/cost_adapter.py
class CostBronzeAdapter(BronzeAdapter):
    source_name = "accounting_manual_excel"

    async def ingest(self, upload_id: int, df: pd.DataFrame) -> int:
        # Normalize 月份/门店/类别/金额 columns.
        # For each row, call silver_normalizer.write_cost_line.
        # Validate: category in {material, labor, overhead, other}; amount > 0; month format YYYY-MM.
        ...
```

Vue page `CostImport.vue`: upload button + download template button + history list.

Gold aggregation: `agg_monthly_cost` table (factory_id, month, category, store_sk, total). 成本分析 page reads it.

## Why not buildable today

Need customer alignment on:
- Standard template columns (must match their accountant's export)
- Frequency commitment (monthly? Weekly?)
- Category definitions (Chinese labels + English keys map)

These are 1-hour product conversations, not engineering effort. Without them, any schema choice is a guess that might not match the real Excel.

## Effort (if greenlit)

- Schema: already exists, 0 days
- Bronze adapter: 2 days (parse + validate + upsert)
- Gold agg table + materializer: 1 day
- Vue upload page + template download: 2 days
- 成本分析 Vue Gold view: 2 days
- **Total**: ~7 days from alignment to prod

## Alternative framing

If customer ingestion is really a multi-month negotiation, consider making 成本分析 an **empty-state page** today with a clear "成本数据需先由财务录入" guidance card pointing to a future upload flow. Document the gap, don't ship half-baked ingestion.
