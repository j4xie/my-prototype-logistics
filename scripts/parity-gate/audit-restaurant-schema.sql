-- audit-restaurant-schema.sql
--
-- Schema + data audit for T6.6 restaurant parity gate. Run against
-- smartbi_prod_db (prod) and / or smartbi_db (test) to confirm every
-- table + column the restaurant /analysis/production + /analysis/quality
-- endpoints depend on is present, and to count rows per restaurant
-- factory_id so we can predict whether the metric will return a value
-- or fall back to its dataAvailability marker.
--
-- Usage (run from any client that can reach the DB):
--   psql -h <host> -d smartbi_prod_db -f audit-restaurant-schema.sql
--   psql -h <host> -d smartbi_db      -f audit-restaurant-schema.sql
--
-- Output is grouped by metric (N1-N4 quality + M1-M3 production).
-- Each section emits:
--   1. table-existence check
--   2. column-existence check
--   3. row-count per restaurant factory_id
--
-- ``\echo`` lines render as headers; psql output is the actual data.
-- The script is read-only — no DDL, no DML, safe to run on prod.
--
-- Spec refs:
--   docs/superpowers/specs/2026-05-12-t6-6-restaurant-semantics-decision.md (PR #330)
--   docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md
--   docs/superpowers/specs/2026-05-12-t6-6-sub-a-production-impl-spec.md

\timing off
\pset border 2
\pset format aligned
\pset null '<NULL>'

\echo '════════════════════════════════════════════════════════════════════'
\echo '  Restaurant parity-gate schema audit'
\echo '════════════════════════════════════════════════════════════════════'

\echo ''
\echo '── current_database / current_user ─────────────────────────────────'
SELECT current_database() AS db, current_user AS usr, now()::timestamp(0) AS run_at;


-- ════════════════════════════════════════════════════════════════════
-- M1: 厨房工位利用率 — Kitchen Station Utilization (Q-DEC-1 = A1)
-- ════════════════════════════════════════════════════════════════════
\echo ''
\echo '═══ M1 (KITCHEN_STATION_UTILIZATION) — always-null marker ═══════════'
\echo '    Q-DEC-1 = A1 → emits dataAvailability=MISSING_KITCHEN_STATION_DATA'
\echo '    No table/column dependency. Schema audit: N/A.'


-- ════════════════════════════════════════════════════════════════════
-- M2: 备菜时间 — Avg Prep Time (Q-DEC-2 = B1)
-- ════════════════════════════════════════════════════════════════════
\echo ''
\echo '═══ M2 (AVG_PREP_TIME) — always-null marker ═════════════════════════'
\echo '    Q-DEC-2 = B1 → emits dataAvailability=MISSING_ORDER_TIMESTAMP_SPLIT'
\echo '    No table/column dependency. Schema audit: N/A.'


-- ════════════════════════════════════════════════════════════════════
-- M3: 翻台率 — Table Turnover proxy (Q-DEC-3 = C1)
--     fact_pos_transaction aggregates: bill_count / store_count / day_count
-- ════════════════════════════════════════════════════════════════════
\echo ''
\echo '═══ M3 (TABLE_TURNOVER_RATE proxy) — fact_pos_transaction ═══════════'

\echo ''
\echo 'M3.1 — fact_pos_transaction table exists?'
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name = 'fact_pos_transaction'
ORDER BY table_schema;

\echo ''
\echo 'M3.2 — required columns: factory_id / store_id / date'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fact_pos_transaction'
  AND column_name IN ('factory_id', 'store_id', 'date')
ORDER BY column_name;

\echo ''
\echo 'M3.3 — bill counts per restaurant factory (R_% pattern)'
SELECT
    factory_id,
    COUNT(*)                         AS bill_count,
    COUNT(DISTINCT store_id)         AS store_count,
    COUNT(DISTINCT date)             AS day_count,
    MIN(date)                        AS first_date,
    MAX(date)                        AS last_date
FROM fact_pos_transaction
WHERE factory_id LIKE 'R\_%' ESCAPE '\'
GROUP BY factory_id
ORDER BY factory_id;


-- ════════════════════════════════════════════════════════════════════
-- N1: 食安事故率 — Food Safety Incident Rate (Q-DEC-5 = D1)
--     Always-null per PR #330 §2.3 D1. No table dependency.
-- ════════════════════════════════════════════════════════════════════
\echo ''
\echo '═══ N1 (FOOD_SAFETY_INCIDENT_RATE) — always-null marker ═════════════'
\echo '    PR #330 §2.3 D1 → emits dataAvailability=MISSING_FOOD_SAFETY_INCIDENT_LOG'
\echo '    No table/column dependency. Schema audit: N/A.'


-- ════════════════════════════════════════════════════════════════════
-- N2: 投诉率 — Complaint Rate (Q-DEC-5 = E1)
--     restaurant_reviews.rating < 3.0 threshold
-- ════════════════════════════════════════════════════════════════════
\echo ''
\echo '═══ N2 (COMPLAINT_RATE) — restaurant_reviews ════════════════════════'

\echo ''
\echo 'N2.1 — restaurant_reviews table exists?'
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name = 'restaurant_reviews'
ORDER BY table_schema;

\echo ''
\echo 'N2.2 — required columns: factory_id / rating / review_time (or similar)'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'restaurant_reviews'
  AND column_name IN ('factory_id', 'rating', 'review_time', 'review_date', 'content', 'store_id')
ORDER BY column_name;

\echo ''
\echo 'N2.3 — review row count + avg rating per restaurant factory'
SELECT
    factory_id,
    COUNT(*)                                                 AS row_count,
    AVG(rating)::numeric(10,3)                               AS avg_rating,
    COUNT(*) FILTER (WHERE rating < 3.0)                     AS complaint_count,
    ROUND(COUNT(*) FILTER (WHERE rating < 3.0)::numeric * 100
          / NULLIF(COUNT(*), 0), 2)                          AS complaint_pct
FROM restaurant_reviews
WHERE factory_id LIKE 'R\_%' ESCAPE '\'
GROUP BY factory_id
ORDER BY factory_id;


-- ════════════════════════════════════════════════════════════════════
-- N3: 退菜率 — Dish Return Rate (Q-DEC-6 = F1)
--     fact_pos_item.return_qty / qty per V20260511_03 migration
-- ════════════════════════════════════════════════════════════════════
\echo ''
\echo '═══ N3 (DISH_RETURN_RATE) — fact_pos_item.return_qty ═══════════════'

\echo ''
\echo 'N3.1 — fact_pos_item table exists?'
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name = 'fact_pos_item'
ORDER BY table_schema;

\echo ''
\echo 'N3.2 — required columns: factory_id / qty / return_qty (added V20260511_03)'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fact_pos_item'
  AND column_name IN ('factory_id', 'qty', 'amount', 'return_qty', 'return_amount')
ORDER BY column_name;

\echo ''
\echo 'N3.3 — item count + return totals per restaurant factory'
SELECT
    factory_id,
    COUNT(*)                                                 AS item_count,
    SUM(qty)::numeric(18,3)                                  AS total_qty,
    SUM(return_qty)::numeric(18,3)                           AS total_return_qty,
    ROUND(SUM(return_qty)::numeric * 100
          / NULLIF(SUM(qty), 0), 3)                          AS return_pct
FROM fact_pos_item
WHERE factory_id LIKE 'R\_%' ESCAPE '\'
GROUP BY factory_id
ORDER BY factory_id;


-- ════════════════════════════════════════════════════════════════════
-- N4: 损耗率 — Wastage Rate (Q-DEC-7 / Q-DEC-7+)
--     fact_restaurant_wastage / fact_restaurant_requisition
-- ════════════════════════════════════════════════════════════════════
\echo ''
\echo '═══ N4 (WASTAGE_RATE) — fact_restaurant_wastage + _requisition ══════'

\echo ''
\echo 'N4.1 — wastage + requisition tables exist?'
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name IN ('fact_restaurant_wastage', 'fact_restaurant_requisition')
ORDER BY table_name;

\echo ''
\echo 'N4.2 — fact_restaurant_wastage columns: factory_id / wastage_amount / wastage_qty'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fact_restaurant_wastage'
ORDER BY ordinal_position;

\echo ''
\echo 'N4.3 — fact_restaurant_requisition columns'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fact_restaurant_requisition'
ORDER BY ordinal_position;

\echo ''
\echo 'N4.4 — wastage row count per restaurant factory'
SELECT factory_id, COUNT(*) AS row_count
FROM fact_restaurant_wastage
WHERE factory_id LIKE 'R\_%' ESCAPE '\'
GROUP BY factory_id
ORDER BY factory_id;

\echo ''
\echo 'N4.5 — requisition row count per restaurant factory'
SELECT factory_id, COUNT(*) AS row_count
FROM fact_restaurant_requisition
WHERE factory_id LIKE 'R\_%' ESCAPE '\'
GROUP BY factory_id
ORDER BY factory_id;


-- ════════════════════════════════════════════════════════════════════
-- Tenant discriminator: cretas_db.factories.type (cross-DB note)
-- ════════════════════════════════════════════════════════════════════
\echo ''
\echo '═══ tenant discriminator (cretas_db.factories) ══════════════════════'
\echo '    NOT in this DB — switch to cretas_db / cretas_prod_db and run:'
\echo '      SELECT factory_id, type, name FROM factories'
\echo '       WHERE type IN (''RESTAURANT'', ''BRANCH'');'
\echo '    The Python tenant detector reads from there, not smartbi.'


-- ════════════════════════════════════════════════════════════════════
-- Readiness summary at end (no SQL, just guidance for the reader)
-- ════════════════════════════════════════════════════════════════════
\echo ''
\echo '════════════════════════════════════════════════════════════════════'
\echo '  Audit complete. Paste output into:'
\echo '    docs/qa-audits/2026-05-11-restaurant-parity-gate-readiness.md'
\echo '    §3 Schema audit results'
\echo '════════════════════════════════════════════════════════════════════'
