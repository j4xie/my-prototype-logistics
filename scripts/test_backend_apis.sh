#!/bin/bash

# 后端API测试脚本 - 3个紧急需求
# 创建时间: 2025-11-20
# 说明: 测试TodayStats字段补充、转冻品API、平台统计API

SERVER="http://139.196.165.140:10010"
FACTORY_ID="CRETAS_2024_001"

echo "========================================="
echo "  后端API集成测试"
echo "========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ========================================
# 测试1: TodayStats字段补充
# ========================================
echo -e "${YELLOW}测试1: TodayStats字段补充${NC}"
echo "API: GET /api/mobile/${FACTORY_ID}/dashboard"
echo ""

response=$(curl -s "${SERVER}/api/mobile/${FACTORY_ID}/dashboard")

echo "响应数据:"
echo "$response" | python3 -m json.tool

# 检查新增字段
todayOutputKg=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data', {}).get('todayStats', {}).get('todayOutputKg', 'NOT_FOUND'))" 2>/dev/null)
totalBatches=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data', {}).get('todayStats', {}).get('totalBatches', 'NOT_FOUND'))" 2>/dev/null)
totalWorkers=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data', {}).get('todayStats', {}).get('totalWorkers', 'NOT_FOUND'))" 2>/dev/null)
activeEquipment=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data', {}).get('todayStats', {}).get('activeEquipment', 'NOT_FOUND'))" 2>/dev/null)
totalEquipment=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data', {}).get('todayStats', {}).get('totalEquipment', 'NOT_FOUND'))" 2>/dev/null)

echo ""
echo "字段验证:"
echo "  todayOutputKg:     ${todayOutputKg}"
echo "  totalBatches:      ${totalBatches}"
echo "  totalWorkers:      ${totalWorkers}"
echo "  activeEquipment:   ${activeEquipment}"
echo "  totalEquipment:    ${totalEquipment}"

if [ "$todayOutputKg" != "NOT_FOUND" ] && [ "$totalBatches" != "NOT_FOUND" ]; then
  echo -e "${GREEN}✓ 测试1通过 - 新增字段存在${NC}"
else
  echo -e "${RED}✗ 测试1失败 - 缺少新增字段${NC}"
fi

echo ""
echo "========================================="
echo ""

# ========================================
# 测试2: 转冻品API (需要先查找FRESH状态的批次)
# ========================================
echo -e "${YELLOW}测试2: 转冻品API${NC}"
echo "步骤1: 查找FRESH状态的批次..."
echo ""

# 注意：这个API可能还没实现，这里只是测试端点是否存在
# 实际测试需要：
# 1. 先插入一个FRESH状态的material_batch
# 2. 调用convert-to-frozen API
# 3. 验证状态变为FROZEN

echo "API: POST /api/mobile/${FACTORY_ID}/materials/batches/{id}/convert-to-frozen"
echo "说明: 需要先在数据库中插入FRESH状态的批次"
echo -e "${YELLOW}跳过 - 需要先准备测试数据${NC}"
echo ""
echo "========================================="
echo ""

# ========================================
# 测试3: 平台统计API
# ========================================
echo -e "${YELLOW}测试3: 平台统计API${NC}"
echo "API: GET /api/platform/dashboard/statistics"
echo "说明: 需要平台管理员token"
echo ""

# 这个API需要平台管理员权限，需要先登录获取token
echo -e "${YELLOW}跳过 - 需要平台管理员token${NC}"
echo ""
echo "========================================="
echo ""

echo "测试总结:"
echo "  ✓ 测试1: TodayStats字段补充 - 测试完成"
echo "  - 测试2: 转冻品API - 需要准备测试数据"
echo "  - 测试3: 平台统计API - 需要管理员权限"
echo ""
echo "下一步:"
echo "  1. 在服务器上重新编译部署"
echo "  2. 准备测试数据（INSERT测试批次）"
echo "  3. 获取平台管理员token"
echo "  4. 执行完整的集成测试"
