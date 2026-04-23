# v2 unblocker — fact_inventory_movement design

**Status**: SPEC DRAFT. Not implementable without stock data source.
**Last updated**: 2026-04-23
**Unblocks**: 进销存 (inventory movement) + 成品库存 (finished goods stock) module Gold flips

---

## Problem

Both 进销存 and 成品库存 want stock-level analytics. Silver today only tracks **consumer sales** (`fact_pos_transaction` / `fact_pos_item`) — the POS side of the coin. Stock level = "how much raw material / finished product sits in warehouse on each date" — an entirely different data domain.

## Two conceptually distinct concerns

### 进销存 (Purchase → Sell → Stock)

Inventory movement ledger: every IN/OUT event per SKU per date.

- Restaurant analog: daily produce/meat/veg receipt + kitchen consumption + waste write-offs.
- Current data state: ~zero. qhj Excel dumps we've seen are POS bills, not 采购入库 / 消耗 / 报损 events.

### 成品库存 (Finished-goods stock)

Snapshot of on-hand stock per SKU.

- Restaurant analog: weak — restaurants don't stock "finished meals". They stock ingredients. Menu items are made-to-order.
- Makes sense for manufacturing tenants only.

**Conclusion**: 成品库存 is **almost certainly DROP permanently** for restaurants (same as 出货). 进销存 is the one worth considering, but only if raw-material tracking data exists.

## Open questions

1. **Does any qhj-style customer track ingredient purchase + consumption in a structured way?** Paper ledger? Excel with columns (日期/食材/进价/用量)? BOM system?
2. **What decision would an owner make from the Gold view?** "Food cost ratio climbing" already comes from existing BOM Layer 2+3 (`sku_forms` + `monthly_purchases` fed via RestaurantV2 UI). That's close to 进销存 lite. Do we even need a new Silver schema, or extend the existing BOM path?
3. **Platform source (美团 / 饿了么 enterprise dashboards)?** Some delivery platforms expose ingredient-cost estimation. Not authoritative.

## Design alternatives

### Alt A: Drop 成品库存 permanently; extend existing BOM for 进销存

Instead of new Silver schema, **promote existing RestaurantV2 BOM Layer 2+3 data** (already persisted in PostgreSQL: `restaurant_sku_forms` + `restaurant_monthly_purchases`) to Gold via a `agg_monthly_material_cost` table. Then 进销存 page shows material cost trends per month.

**Pros**: zero new ingestion, reuses existing user-input pathway, useful immediately if any tenant has entered BOM data.
**Cons**: "进销存" is a bad name for this — it's really "food cost overview". Consider renaming the menu item.

### Alt B: Build real fact_inventory_movement

```sql
CREATE TABLE fact_inventory_movement (
  movement_sk         BIGSERIAL PRIMARY KEY,
  factory_id          VARCHAR(50) NOT NULL,
  store_sk            BIGINT NOT NULL,
  material_sk         BIGINT NOT NULL,  -- dim_material (new, needed)
  movement_date       DATE NOT NULL,
  movement_type       VARCHAR(20) NOT NULL,  -- 'RECEIVE' / 'CONSUME' / 'WASTE' / 'TRANSFER'
  quantity            NUMERIC(18,3) NOT NULL,  -- signed (negative = out)
  unit_cost           NUMERIC(18,4),
  total_cost          NUMERIC(18,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  reference_doc       VARCHAR(100),  -- PO number / 报损单 number etc
  ...
);
```

Requires **dim_material** (new dim, not currently in Silver), **Bronze adapter** for inventory events (Excel? ERP API? manual?), and **user training** because most restaurants don't have this data today.

**Pros**: true Silver coverage.
**Cons**: large uplift (~10 engineer-days including training + UX), uncertain ROI if customers don't track this data.

## Recommendation

**Alt A**: drop 成品库存 permanent, rename 进销存 menu item to 食材成本, and Gold-back it with existing BOM persistence. No new Silver schema. Small Vue refactor.

Effort:
- 0.5 day rename + menu label
- 2 days Vue 食材成本 page pulling from existing `restaurant_monthly_purchases` + `restaurant_sku_forms` tables
- 1 day Gold agg query (Python route reading those tables)
- **Total**: ~3-4 days, no Silver migration

**DEFER Alt B** indefinitely unless a customer actively asks for true inventory-movement tracking.

## Why not buildable today (without Alt A acceptance)

Need product decision:
- Is 成品库存 confirmed DROP for restaurants?
- Is 进销存 acceptable to rename 食材成本 and wire to existing BOM tables?

These are 30-minute stakeholder conversations, not engineering work.
