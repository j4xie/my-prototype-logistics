#!/bin/bash
# Query SmartBI data on server

echo "==> Querying SmartBI Upload Records..."
echo "============================================================"

mysql cretas_food_trace << 'EOF'
SELECT
    id,
    factory_id,
    file_name,
    sheet_name,
    data_type,
    row_count,
    recommended_chart_type,
    status,
    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as upload_time
FROM smart_bi_upload
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 10;
EOF

echo ""
echo "==> Finance Data by Upload ID..."
echo "============================================================"

mysql cretas_food_trace << 'EOF'
SELECT
    upload_id,
    COUNT(*) as row_count
FROM smart_bi_finance_data
WHERE deleted_at IS NULL
GROUP BY upload_id
ORDER BY upload_id DESC;
EOF

echo ""
echo "==> Sales Data by Upload ID..."
echo "============================================================"

mysql cretas_food_trace << 'EOF'
SELECT
    upload_id,
    COUNT(*) as row_count
FROM smart_bi_sales_data
WHERE deleted_at IS NULL
GROUP BY upload_id
ORDER BY upload_id DESC;
EOF

echo ""
echo "==> AI Analysis (latest 3 uploads)..."
echo "============================================================"

mysql cretas_food_trace << 'EOF'
SELECT
    id,
    sheet_name,
    LEFT(ai_analysis, 300) as ai_preview
FROM smart_bi_upload
WHERE deleted_at IS NULL
    AND ai_analysis IS NOT NULL
ORDER BY created_at DESC
LIMIT 3;
EOF

echo ""
echo "==> Query complete"
