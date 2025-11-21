#!/bin/bash

# 设备告警API测试脚本
# 功能：测试设备告警确认和解决API
# 创建时间：2025-11-19

BASE_URL="http://localhost:10010"
FACTORY_ID="CRETAS_2024_001"
TOKEN="YOUR_ACCESS_TOKEN"  # 请替换为实际的访问令牌

echo "=========================================="
echo "设备告警API测试"
echo "=========================================="
echo ""

# 1. 测试告警确认API
echo "📝 测试1: 确认告警（告警ID: 1）"
curl -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment/alerts/1/acknowledge" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"notes": "已知晓，安排维护"}' \
  | python3 -c "import sys, json; data=json.load(sys.stdin); print(json.dumps(data, indent=2, ensure_ascii=False))"
echo ""
echo ""

# 2. 测试告警解决API
echo "📝 测试2: 解决告警（告警ID: 2）"
curl -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment/alerts/2/resolve" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"resolutionNotes": "已完成设备维护，更换了润滑油"}' \
  | python3 -c "import sys, json; data=json.load(sys.stdin); print(json.dumps(data, indent=2, ensure_ascii=False))"
echo ""
echo ""

# 3. 测试动态ID - 维护告警（假设设备ID为1）
echo "📝 测试3: 确认动态维护告警（MAINT_1）"
curl -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment/alerts/MAINT_1/acknowledge" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  | python3 -c "import sys, json; data=json.load(sys.stdin); print(json.dumps(data, indent=2, ensure_ascii=False))"
echo ""
echo ""

# 4. 测试动态ID - 保修告警（假设设备ID为1）
echo "📝 测试4: 解决动态保修告警（WARRANTY_1）"
curl -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment/alerts/WARRANTY_1/resolve" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"resolutionNotes": "已联系厂商续保"}' \
  | python3 -c "import sys, json; data=json.load(sys.stdin); print(json.dumps(data, indent=2, ensure_ascii=False))"
echo ""
echo ""

# 5. 测试错误情况 - 重复确认
echo "📝 测试5: 重复确认（应该失败）"
curl -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment/alerts/1/acknowledge" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  | python3 -c "import sys, json; data=json.load(sys.stdin); print(json.dumps(data, indent=2, ensure_ascii=False))"
echo ""
echo ""

# 6. 测试错误情况 - 不存在的告警
echo "📝 测试6: 不存在的告警（应该失败）"
curl -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment/alerts/9999/acknowledge" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  | python3 -c "import sys, json; data=json.load(sys.stdin); print(json.dumps(data, indent=2, ensure_ascii=False))"
echo ""

echo "=========================================="
echo "测试完成！"
echo "=========================================="
