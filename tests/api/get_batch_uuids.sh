#!/bin/bash

# 从数据库直接获取批次UUID（更可靠）

echo "获取测试批次UUID..."

MB_001_ID=$(mysql -u root cretas_db -N -e "SELECT id FROM material_batches WHERE batch_number='MB-001' LIMIT 1;")
MB_002_ID=$(mysql -u root cretas_db -N -e "SELECT id FROM material_batches WHERE batch_number='MB-002' LIMIT 1;")
MB_003_ID=$(mysql -u root cretas_db -N -e "SELECT id FROM material_batches WHERE batch_number='MB-003' LIMIT 1;")
MB_009_ID=$(mysql -u root cretas_db -N -e "SELECT id FROM material_batches WHERE batch_number='MB-009' LIMIT 1;")

echo "export MB_001_ID='$MB_001_ID'"
echo "export MB_002_ID='$MB_002_ID'"
echo "export MB_003_ID='$MB_003_ID'"
echo "export MB_009_ID='$MB_009_ID'"

# 也输出可以source的格式
cat > /tmp/batch_uuids.env << EOF
export MB_001_ID='$MB_001_ID'
export MB_002_ID='$MB_002_ID'
export MB_003_ID='$MB_003_ID'
export MB_009_ID='$MB_009_ID'
EOF

echo ""
echo "UUID已保存到 /tmp/batch_uuids.env"
echo "可以使用: source /tmp/batch_uuids.env"
