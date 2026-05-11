-- T6.6 Phase B — Q-DEC-6 F1: extend fact_pos_item with return_qty column.
--
-- Spec:     docs/superpowers/specs/2026-05-12-t6-6-restaurant-semantics-decision.md §6
-- Ratified: PR #330 (2026-05-12 verbal sign-off — Q-DEC-6 = F1)
-- PR:       this PR (Sub-ETL-1 follow-up — modular split + profit/purchase + return_qty)
--
-- Drift note (audit doc §3):
--   PR #326 §6 line 522 spec text says BOTH columns + DEFAULT 0:
--     "ALTER TABLE fact_pos_item ADD COLUMN return_qty NUMERIC(18,3) DEFAULT 0,
--      ADD COLUMN return_amount NUMERIC(18,2) DEFAULT 0;"
--   This pilot migration narrows scope per organizer marching order:
--     - return_qty only (return_amount deferred to follow-up if/when needed)
--     - DEFAULT NULL (preserves "unknown" semantics for legacy rows pre-ETL;
--       contrast DEFAULT 0 which would falsely claim "we know it's zero")
--   Organizer to decide if return_amount + DEFAULT 0 should be applied in a
--   follow-up migration (V20260511_04 or later) — see audit doc §3.
--
-- Apply via:    ./scripts/deploy/deploy-smartbi-python.sh --env <env>
--               (auto-applied by Step 3.5 → apply-smartbi-migrations.sh runner)
-- DO NOT       run manually via psql unless emergency hotfix per
--              .claude/rules/server-operations.md § "Smartbi 数据库 schema 变更"

BEGIN;

ALTER TABLE fact_pos_item
    ADD COLUMN IF NOT EXISTS return_qty NUMERIC(18, 3) DEFAULT NULL;

COMMENT ON COLUMN fact_pos_item.return_qty IS
    'Q-DEC-6 F1: per-line return quantity from product_sales canonical CSV `qty_refund` col. '
    'NULL = legacy row (pre-ETL extension) — distinct from 0 (zero returns observed). '
    'Source: 大众点评 商品销量报表 「退货数量(不含套餐子商品)」 column.';

COMMIT;
