#!/bin/bash
# 在服务器上验证 SmartBI 真实数据

echo "==> Verifying SmartBI Real Data on Server..."
echo ""

# Test 1: Check if tables exist and have data
echo "[1] Checking database tables..."
mysql cretas_food_trace -e "
SELECT
    'smart_bi_upload' as table_name,
    COUNT(*) as row_count,
    MAX(created_at) as last_update
FROM smart_bi_upload
WHERE deleted_at IS NULL
UNION ALL
SELECT
    'smart_bi_finance_data' as table_name,
    COUNT(*) as row_count,
    MAX(created_at) as last_update
FROM smart_bi_finance_data
WHERE deleted_at IS NULL
UNION ALL
SELECT
    'smart_bi_sales_data' as table_name,
    COUNT(*) as row_count,
    MAX(created_at) as last_update
FROM smart_bi_sales_data
WHERE deleted_at IS NULL;
"

echo ""
echo "[2] Sample data from finance table (first 5 rows)..."
mysql cretas_food_trace -e "
SELECT
    id,
    upload_id,
    period,
    department,
    revenue,
    cost,
    profit
FROM smart_bi_finance_data
WHERE deleted_at IS NULL
LIMIT 5;
"

echo ""
echo "[3] Sample data from sales table (first 5 rows)..."
mysql cretas_food_trace -e "
SELECT
    id,
    upload_id,
    date,
    customer,
    amount
FROM smart_bi_sales_data
WHERE deleted_at IS NULL
LIMIT 5;
"

echo ""
echo "==> Verification complete. If you see data above, it's REAL, not mock!"
