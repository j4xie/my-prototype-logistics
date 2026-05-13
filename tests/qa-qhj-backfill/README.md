# QHJ Revenue Report — Backfill attempt for R_QINGHUAJIAO_REAL

**Outcome: HALTED at pre-check (no source data to aggregate).**

**Date:** 2026-05-13
**Server:** 47.100.235.168 (prod)
**Source DB:** smartbi_prod_db
**Target table:** agg_daily_order_type_meal
**Script:** `scripts/backfill_agg_order_type_meal.py`

---

## Summary

Customer `R_QINGHUAJIAO_REAL` (青花椒) is registered in `cretas_prod_db.factories` but has uploaded **zero rows** to `smartbi_prod_db.fact_pos_transaction` across all dates (not only the 2025 target window). The backfill aggregator therefore has nothing to aggregate — it would emit `INSERT 0 0` with no error.

Per the dispatch brief, the correct action on 0 source rows is to halt and ping organizer.

## Factory tenants currently in fact_pos_transaction (smartbi_prod_db)

| factory_id     | rows    | earliest    | latest      |
|----------------|---------|-------------|-------------|
| F001           | 140,541 | 2025-01-01  | 2025-12-31  |
| RES_3101_009   | 140,541 | 2025-01-01  | 2025-12-31  |
| R_GML_DEMO     | 16,213  | 2026-01-15  | 2026-01-15  |
| R_XMX_CHAIN    | 141     | 2026-02-15  | 2026-02-15  |
| R_QINGHUAJIAO_REAL | **0** | —         | —           |

## Next step (for product/customer-success, not engineering)

Customer 青花椒 must upload Excel via the live `/smart-bi/revenue-report` uploader (deployed under Phase F PR #502). After the first upload lands in `fact_pos_transaction`, the dual_write hook (Task D2) materializes `agg_daily_order_type_meal` automatically — **this backfill script is no longer needed for ongoing operation**.

The script remains useful for the rare case of pre-existing historic data needing one-shot Gold materialization (e.g. if a different tenant arrives with bulk POS history already in fact rows).

## Idempotency note

The aggregator uses `INSERT ... ON CONFLICT (factory_id, date, store_id, order_type, meal_period) DO UPDATE SET ... version = a.version + 1, computed_at = NOW();` — fully idempotent. Re-running this task once the customer uploads will succeed without conflict.

## Evidence files

- `pre-check.txt` — full SQL output for Steps 1a–1e
- `backfill-output.txt` — halt reason
- `post-verify.txt` — N/A explanation
- `sample-rows.txt` — N/A explanation
