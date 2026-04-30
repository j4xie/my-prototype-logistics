-- V20260430_02__phase2a_F999_alert_trip_rows.sql
-- Phase 2A: deliberate trip-rows for F999 so /alerts emits non-empty goldens.
-- Without these rows, F999 (= F001 clone) data does not trip any threshold:
--   - smart_bi_finance_data has no AR rows (aging_days NULL, receivable_amount NULL)
--   - smart_bi_department_data April query returns 0 rows (existing 6 rows are 12-31)
-- See docs/adr/2026-04-29-phase2a-synthetic-test-factory-f999.md "Negative consequences"
-- for context — chat 3 (this migration) implements option (a) "F999-specific trip-rows".
--
-- Hardcoded record_date = '2026-04-15' (current-month deterministic snapshot).
-- Goldens recorded against this state will go stale on 2026-05-01 → re-record then.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Finance: 3 AR rows trip aging + large-receivable thresholds
-- ─────────────────────────────────────────────────────────────────────────────
-- Threshold structure (from alert_thresholds.json):
--   aging_days: red=90, yellow=60
--   receivable_amount sum: red=1,000,000, yellow=500,000
-- Trip-row design:
--   逾期客户A: aging=95 > 90  → RED "应收账款严重逾期"
--   逾期客户B: aging=100 > 90 → RED "应收账款严重逾期"
--   大额客户C: aging=75 between 60-90 → YELLOW "应收账款即将逾期"
--   Sum receivable = 200K + 800K + 1500K = 2,500,000 > 1,000,000 → RED "应收账款总额过高"
-- Total finance alerts: 4 (2 RED aging + 1 YELLOW aging + 1 RED total)
INSERT INTO smart_bi_finance_data
    (factory_id, record_date, record_type, customer_name, receivable_amount, aging_days, created_at, updated_at)
SELECT 'F999', DATE '2026-04-15', 'AR', '逾期客户A', 200000, 95, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_finance_data
    WHERE factory_id = 'F999' AND record_date = DATE '2026-04-15' AND customer_name = '逾期客户A'
);

INSERT INTO smart_bi_finance_data
    (factory_id, record_date, record_type, customer_name, receivable_amount, aging_days, created_at, updated_at)
SELECT 'F999', DATE '2026-04-15', 'AR', '逾期客户B', 800000, 100, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_finance_data
    WHERE factory_id = 'F999' AND record_date = DATE '2026-04-15' AND customer_name = '逾期客户B'
);

INSERT INTO smart_bi_finance_data
    (factory_id, record_date, record_type, customer_name, receivable_amount, aging_days, created_at, updated_at)
SELECT 'F999', DATE '2026-04-15', 'AR', '大额客户C', 1500000, 75, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_finance_data
    WHERE factory_id = 'F999' AND record_date = DATE '2026-04-15' AND customer_name = '大额客户C'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Department: 3 rows trip per-capita + verify TreeMap sort
-- ─────────────────────────────────────────────────────────────────────────────
-- Threshold: per_capita = sales_amount / headcount, red=50000, yellow=80000
-- Trip-row design (all RED, reverse-alphabetical insertion order to verify
-- Java TreeMap sort fix from V20260430_01 sister fix in RecommendationServiceImpl):
--   研发部: 100K / 5 = 20K per_capita → RED (Unicode 研=30740)
--   销售部: 150K / 5 = 30K per_capita → RED (Unicode 销=38144)
--   行政部:  50K / 5 = 10K per_capita → RED (Unicode 行=34892)
-- After Java sort fix: alerts emitted in Unicode order 研 < 行 < 销
INSERT INTO smart_bi_department_data
    (factory_id, record_date, department, headcount, sales_amount, created_at, updated_at)
SELECT 'F999', DATE '2026-04-15', '研发部', 5, 100000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_department_data
    WHERE factory_id = 'F999' AND record_date = DATE '2026-04-15' AND department = '研发部'
);

INSERT INTO smart_bi_department_data
    (factory_id, record_date, department, headcount, sales_amount, created_at, updated_at)
SELECT 'F999', DATE '2026-04-15', '销售部', 5, 150000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_department_data
    WHERE factory_id = 'F999' AND record_date = DATE '2026-04-15' AND department = '销售部'
);

INSERT INTO smart_bi_department_data
    (factory_id, record_date, department, headcount, sales_amount, created_at, updated_at)
SELECT 'F999', DATE '2026-04-15', '行政部', 5, 50000, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM smart_bi_department_data
    WHERE factory_id = 'F999' AND record_date = DATE '2026-04-15' AND department = '行政部'
);
