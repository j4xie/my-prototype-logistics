-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_24_01__smart_bi_dictionary_role.sql
-- Conversion date: 2026-01-26 18:49:34
-- ============================================

-- SmartBI Dictionary: Add field role and chart axis configuration
-- Supports automatic chart axis mapping based on field semantics

-- field_role: Semantic role of the field
-- DIMENSION: Categorical/grouping field (e.g., region, department)
-- METRIC: Numeric measurement field (e.g., sales_amount, profit)
-- TIME: Time/date field (e.g., order_date, created_at)
-- IDENTIFIER: Unique identifier field (e.g., order_id, batch_code)
ALTER TABLE smart_bi_dictionary ADD COLUMN field_role VARCHAR(20);

-- chart_axis: Suggested position on chart
-- X_AXIS: Use as X-axis (typically dimensions or time)
-- SERIES: Use as series/legend grouping
-- Y_AXIS: Use as Y-axis values (typically metrics)
-- NONE: Not directly used on chart axes
ALTER TABLE smart_bi_dictionary ADD COLUMN chart_axis VARCHAR(20);

-- axis_priority: Priority when multiple fields compete for same axis
-- Lower value = higher priority (1 = first choice)
ALTER TABLE smart_bi_dictionary ADD COLUMN axis_priority INT DEFAULT 99;

-- aggregation_type: Default aggregation method for this field
-- SUM: Sum values (e.g., total sales)
-- AVG: Average values (e.g., average price)
-- COUNT: Count occurrences (e.g., order count)
-- GROUP_BY: Use for grouping, not aggregation
ALTER TABLE smart_bi_dictionary ADD COLUMN aggregation_type VARCHAR(20);
