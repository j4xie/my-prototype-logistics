-- validate-factory-silver-schema.sql
--
-- Phase 2D prereq audit: factory-tenant Silver schema state in smartbi_prod_db.
--
-- The Python factory branch of /analysis/production + /analysis/quality
-- (chat-A1 PR #350 / chat-B1 PR #354) is `raise NotImplementedError` per
-- Option B until the Silver tables ship. This script enumerates which
-- tables exist (READY) and which are MISSING, plus per-factory row counts
-- for any tables that DO exist.
--
-- Run via:
--   psql "$SMARTBI_PROD_DSN" -f scripts/etl/validate-factory-silver-schema.sql > reports/factory-silver-audit-$(date +%F).txt
--
-- Spec references:
--   docs/superpowers/specs/2026-05-12-t6-6-sub-a-production-impl-spec.md §2.3
--   docs/superpowers/specs/2026-05-12-t6-6-sub-b-quality-impl-spec.md §2.3
--
-- Sister script: scripts/etl/validate-restaurant-data-quality.py (restaurant
-- side, Python because per-factory RLS context-switch is easier in code).

\pset border 2
\pset format aligned

\echo ''
\echo '============================================================'
\echo 'Phase 2D prereq: factory tenant Silver schema audit'
\echo '============================================================'
\echo ''
\echo 'Generated:'
SELECT NOW() AT TIME ZONE 'UTC' AS generated_at_utc;

-- ============================================================
-- Section 1 — Required tables for /analysis/production factory branch
-- (Sub-A spec §2.3 — fact_production_batch / fact_equipment_event / fact_quality_inspection)
-- ============================================================

\echo ''
\echo '--- Section 1: /analysis/production factory branch tables ---'
\echo ''

WITH required(table_name) AS (
    VALUES
        ('fact_production_batch'),
        ('fact_equipment_event'),
        ('fact_quality_inspection'),
        ('dim_equipment'),
        ('dim_production_line')
)
SELECT
    r.table_name,
    CASE WHEN t.table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
  FROM required r
  LEFT JOIN information_schema.tables t
    ON t.table_schema = 'public'
   AND t.table_name = r.table_name
 ORDER BY r.table_name;

-- ============================================================
-- Section 2 — Required tables for /analysis/quality factory branch
-- (Sub-B spec §2.3 — fact_quality_inspection / fact_quality_defect /
--  fact_rework_record / fact_disposal_record / fact_customer_complaint)
-- ============================================================

\echo ''
\echo '--- Section 2: /analysis/quality factory branch tables ---'
\echo ''

WITH required(table_name) AS (
    VALUES
        ('fact_quality_inspection'),
        ('fact_quality_defect'),
        ('fact_rework_record'),
        ('fact_disposal_record'),
        ('fact_customer_complaint')
)
SELECT
    r.table_name,
    CASE WHEN t.table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
  FROM required r
  LEFT JOIN information_schema.tables t
    ON t.table_schema = 'public'
   AND t.table_name = r.table_name
 ORDER BY r.table_name;

-- ============================================================
-- Section 3 — Restaurant-side tables (sanity check, expected EXISTS)
-- ============================================================

\echo ''
\echo '--- Section 3: Restaurant-side tables (expected EXISTS) ---'
\echo ''

WITH required(table_name) AS (
    VALUES
        ('restaurant_chain_catalog'),
        ('restaurant_reviews'),
        ('fact_pos_transaction'),
        ('fact_pos_item'),
        ('fact_restaurant_wastage'),
        ('fact_restaurant_requisition'),
        ('dim_store'),
        ('dim_product'),
        ('dim_ingredient')
)
SELECT
    r.table_name,
    CASE WHEN t.table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
  FROM required r
  LEFT JOIN information_schema.tables t
    ON t.table_schema = 'public'
   AND t.table_name = r.table_name
 ORDER BY r.table_name;

-- ============================================================
-- Section 4 — V20260511_03 column check (Q-DEC-6 F1 LIVE flag)
-- ============================================================

\echo ''
\echo '--- Section 4: V20260511_03 fact_pos_item.return_qty column ---'
\echo ''

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'fact_pos_item'
   AND column_name = 'return_qty';

-- ============================================================
-- Section 5 — Per-factory row counts (restaurant_chain_catalog)
-- ============================================================

\echo ''
\echo '--- Section 5: restaurant_chain_catalog rows (14 REAL expected) ---'
\echo ''

SELECT
    source_kind,
    COUNT(*) AS chain_count
  FROM restaurant_chain_catalog
 GROUP BY source_kind
 ORDER BY source_kind;

\echo ''
\echo 'REAL chains:'
SELECT
    factory_id,
    chain_name_zh,
    cuisine
  FROM restaurant_chain_catalog
 WHERE source_kind = 'REAL'
 ORDER BY factory_id;

-- ============================================================
-- Section 6 — factories table tenant-type breakdown
-- (Lives in cretas_db, NOT smartbi_prod_db — see comment block below.)
-- ============================================================

\echo ''
\echo '--- Section 6: cretas_db.factories type breakdown ---'
\echo ''
\echo 'NOTE: factories table is in cretas_db, NOT smartbi_prod_db. Connect'
\echo '      to cretas_db separately for this query. Skipping here.'
\echo ''
\echo '  psql cretas_prod_db -c "SELECT type, COUNT(*) FROM factories GROUP BY type ORDER BY type;"'

-- ============================================================
-- Section 7 — Summary recommendation
-- ============================================================

\echo ''
\echo '--- Section 7: Phase 2D dispatch readiness ---'
\echo ''
\echo 'Interpretation guide:'
\echo '  Section 1 all MISSING → Phase 2D needs V_factory_production_silver migration'
\echo '  Section 2 all MISSING → Phase 2D needs V_factory_quality_silver migration'
\echo '  Section 3 missing any → restaurant runtime broken, BLOCKER'
\echo '  Section 4 returns 0 rows → V20260511_03 NOT applied, N3 endpoint broken'
\echo '  Section 5 chain_count < 14 → V20260511_02 seed incomplete'
\echo ''
\echo 'Audit complete.'
