---
name: field-consistency-check
description: 检查前后端字段名一致性。自动比较后端 Entity 与前端 Interface 的所有字段，发现缺失或不一致的字段。使用此 Skill 确保数据模型统一。
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# 字段一致性检查 Skill

自动比较后端 Entity 与前端 Interface 的**所有字段**，发现缺失或命名不一致问题。

## 核心检查逻辑

### 检查流程

```
后端 Entity (Java)  ←→  前端 Interface (TypeScript)  ←→  Screen 使用
      ↓                        ↓                           ↓
  提取所有字段            提取所有字段               验证字段使用
      ↓                        ↓                           ↓
                    对比差异 → 生成报告
```

## 完整检查命令

### 1. 列出所有需要检查的模块

```bash
# 列出后端所有 Entity
ls backend-java/src/main/java/com/cretas/aims/entity/*.java | xargs -n1 basename | sed 's/.java//'

# 列出前端所有 ApiClient
ls frontend/CretasFoodTrace/src/services/api/*ApiClient.ts | xargs -n1 basename | sed 's/ApiClient.ts//'
```

### 2. 单个模块检查（以 Customer 为例）

```bash
echo "=========================================="
echo "模块: Customer"
echo "=========================================="

echo ""
echo "【后端 Entity 字段】"
echo "文件: backend-java/.../entity/Customer.java"
grep -E "private (String|Long|Boolean|Integer|BigDecimal|LocalDateTime)" \
  backend-java/src/main/java/com/cretas/aims/entity/Customer.java | \
  grep -v "//" | \
  awk '{print $3}' | sed 's/;//'

echo ""
echo "【前端 Interface 字段】"
echo "文件: frontend/.../api/customerApiClient.ts"
awk '/export interface Customer \{/,/^\}/' \
  frontend/CretasFoodTrace/src/services/api/customerApiClient.ts | \
  grep -E "^\s+\w+[\?:]" | \
  awk '{print $1}' | sed 's/[?:]//'

echo ""
echo "【对比结果】"
# 后端字段
grep -E "private (String|Long|Boolean|Integer)" \
  backend-java/src/main/java/com/cretas/aims/entity/Customer.java | \
  grep -v "//" | awk '{print $3}' | sed 's/;//' | sort > /tmp/be_customer.txt

# 前端字段
awk '/export interface Customer \{/,/^\}/' \
  frontend/CretasFoodTrace/src/services/api/customerApiClient.ts | \
  grep -E "^\s+\w+[\?:]" | awk '{print $1}' | sed 's/[?:]//' | sort > /tmp/fe_customer.txt

echo "只在后端存在的字段:"
comm -23 /tmp/be_customer.txt /tmp/fe_customer.txt | sed 's/^/  - /'

echo ""
echo "只在前端存在的字段:"
comm -13 /tmp/be_customer.txt /tmp/fe_customer.txt | sed 's/^/  - /'
```

### 3. 批量检查所有模块（macOS兼容版）

**重要**: 前端 Interface 名称与后端 Entity 名称可能不同！

#### 名称映射表

| 后端 Entity | 前端 ApiClient 文件 | 前端 Interface 名 |
|-------------|--------------------|--------------------|
| `Customer` | customerApiClient.ts | `Customer` |
| `Supplier` | supplierApiClient.ts | `Supplier` |
| `User` | userApiClient.ts | `UserDTO` |
| `Factory` | platformApiClient.ts | `FactoryDTO` |
| `FactoryEquipment` | equipmentApiClient.ts | `Equipment` |
| `MaterialBatch` | materialBatchApiClient.ts | `MaterialBatch` |
| `ProductionBatch` | processingApiClient.ts | N/A (无直接对应) |
| `RawMaterialType` | materialTypeApiClient.ts | `MaterialType` |
| `ProductType` | productTypeApiClient.ts | `ProductType` |
| `QualityInspection` | qualityInspectionApiClient.ts | `QualityInspection` |
| `TimeClockRecord` | timeclockApiClient.ts | N/A (使用 DTO) |
| `ShipmentRecord` | shipmentApiClient.ts | `ShipmentRecord` |
| `DisposalRecord` | disposalRecordApiClient.ts | `DisposalRecord` |

#### 批量检查脚本（macOS兼容）

```bash
#!/bin/bash
# macOS 兼容版本 - 不使用 declare -A

cd /Users/jietaoxie/my-prototype-logistics

BACKEND_PATH="backend-java/src/main/java/com/cretas/aims/entity"
FRONTEND_PATH="frontend/CretasFoodTrace/src/services/api"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           前后端字段一致性检查报告                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

TOTAL_ISSUES=0

# 检查函数
check_module() {
  local ENTITY=$1
  local FRONTEND_FILE=$2
  local INTERFACE_NAME=$3
  local ENTITY_FILE="$BACKEND_PATH/${ENTITY}.java"

  if [ ! -f "$ENTITY_FILE" ]; then
    return
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 $ENTITY → $INTERFACE_NAME"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # 提取后端字段（包含更多类型）
  grep -E "private (String|Long|Boolean|Integer|BigDecimal|LocalDateTime|LocalDate|Double)" "$ENTITY_FILE" 2>/dev/null | \
    grep -v "//" | awk '{print $3}' | sed 's/;//' | sort -u > /tmp/be_fields.txt

  BE_COUNT=$(wc -l < /tmp/be_fields.txt | tr -d ' ')
  echo "后端 Entity: $BE_COUNT 个字段"

  # 提取前端字段
  if [ -f "$FRONTEND_PATH/$FRONTEND_FILE" ]; then
    awk "/export interface ${INTERFACE_NAME} \{/,/^\}/" "$FRONTEND_PATH/$FRONTEND_FILE" 2>/dev/null | \
      grep -E "^[[:space:]]+[a-zA-Z_][a-zA-Z0-9_]*[\?:]" | \
      awk '{print $1}' | sed 's/[?:].*//' | sort -u > /tmp/fe_fields.txt

    FE_COUNT=$(wc -l < /tmp/fe_fields.txt | tr -d ' ')
    echo "前端 Interface: $FE_COUNT 个字段"

    # 对比差异
    ONLY_BE=$(comm -23 /tmp/be_fields.txt /tmp/fe_fields.txt 2>/dev/null | wc -l | tr -d ' ')
    ONLY_FE=$(comm -13 /tmp/be_fields.txt /tmp/fe_fields.txt 2>/dev/null | wc -l | tr -d ' ')

    if [ "$ONLY_BE" -gt 0 ] || [ "$ONLY_FE" -gt 0 ]; then
      echo ""
      echo "⚠️  发现差异:"

      if [ "$ONLY_BE" -gt 0 ]; then
        echo "  只在后端存在 ($ONLY_BE 个):"
        comm -23 /tmp/be_fields.txt /tmp/fe_fields.txt 2>/dev/null | sed 's/^/    - /'
        TOTAL_ISSUES=$((TOTAL_ISSUES + ONLY_BE))
      fi

      if [ "$ONLY_FE" -gt 0 ]; then
        echo "  只在前端存在 ($ONLY_FE 个):"
        comm -13 /tmp/be_fields.txt /tmp/fe_fields.txt 2>/dev/null | sed 's/^/    - /'
        TOTAL_ISSUES=$((TOTAL_ISSUES + ONLY_FE))
      fi
    else
      echo "✅ 字段完全一致"
    fi
  else
    echo "⚠️  未找到前端文件: $FRONTEND_FILE"
  fi

  echo ""
}

# 调用检查函数（使用正确的 Interface 名称映射）
check_module "Customer" "customerApiClient.ts" "Customer"
check_module "Supplier" "supplierApiClient.ts" "Supplier"
check_module "User" "userApiClient.ts" "UserDTO"
check_module "Factory" "platformApiClient.ts" "FactoryDTO"
check_module "FactoryEquipment" "equipmentApiClient.ts" "Equipment"
check_module "MaterialBatch" "materialBatchApiClient.ts" "MaterialBatch"
check_module "RawMaterialType" "materialTypeApiClient.ts" "MaterialType"
check_module "ProductType" "productTypeApiClient.ts" "ProductType"
check_module "QualityInspection" "qualityInspectionApiClient.ts" "QualityInspection"
check_module "ShipmentRecord" "shipmentApiClient.ts" "ShipmentRecord"
check_module "DisposalRecord" "disposalRecordApiClient.ts" "DisposalRecord"

echo "════════════════════════════════════════════════════════════════"
echo "检查完成: 共发现 $TOTAL_ISSUES 个字段差异"
echo "════════════════════════════════════════════════════════════════"
```

## 已确认的实体字段结构

### 不同实体的字段设计（重要！）

| Entity | 电话字段 | 地址字段 | 说明 |
|--------|---------|---------|------|
| **Factory** | `contactPhone` (唯一) | `address` (唯一) | Factory 只有一套 |
| **Supplier** | `contactPhone` + `phone` | `address` (唯一) | 两个电话字段 |
| **Customer** | `contactPhone` + `phone` | `shippingAddress` + `billingAddress` | 最完整 |
| **User** | `phone` (唯一) | - | 用户只有 phone |

### 前端应使用的字段名

| 模块 | 推荐使用 | 不推荐使用 | 原因 |
|------|---------|-----------|------|
| Customer | `phone` | `contactPhone` | 与后端主字段一致 |
| Customer | `shippingAddress` | `address` | Customer 没有 address 字段 |
| Supplier | `phone` | `contactPhone` | 统一用新字段名 |
| Supplier | `address` | - | Supplier 只有 address |
| Factory | `contactPhone` | `phone` | Factory 只有 contactPhone |
| Factory | `address` | - | Factory 只有 address |

## 快速检查命令

### 检查特定模块

```bash
# 检查 Customer
./check-module.sh Customer customer

# 检查 Supplier
./check-module.sh Supplier supplier

# 检查所有模块
./check-all-modules.sh
```

### 查找前端字段使用情况

```bash
# 查找某个字段在前端的使用
grep -rn "\.phone" frontend/CretasFoodTrace/src/screens/ --include="*.tsx" | wc -l
grep -rn "\.contactPhone" frontend/CretasFoodTrace/src/screens/ --include="*.tsx" | wc -l

# 查找同时使用新旧字段的文件（潜在问题）
for file in $(find frontend/CretasFoodTrace/src/screens -name "*.tsx"); do
  if grep -q "\.phone" "$file" && grep -q "\.contactPhone" "$file"; then
    echo "⚠️ 混用字段: $file"
  fi
done
```

### 后端字段详情查看

```bash
# 查看某个 Entity 的完整字段定义（包含注解）
grep -B1 -A1 "private" backend-java/src/main/java/com/cretas/aims/entity/Customer.java | \
  grep -E "@Column|private"
```

## 修复流程

### 1. 确认后端字段

```bash
# 查看后端 Entity 的实际字段
grep -E "@Column|private" backend-java/src/main/java/com/cretas/aims/entity/XXX.java
```

### 2. 更新前端 Interface

```typescript
// 修改 xxxApiClient.ts 中的 interface
export interface XXX {
  // 确保与后端字段名一致
  phone?: string;  // 而不是 contactPhone
  shippingAddress?: string;  // 而不是 address (如果后端是这样)
}
```

### 3. 更新 Screen 组件

```bash
# 批量替换（先预览）
grep -rn "\.contactPhone" frontend/CretasFoodTrace/src/screens/

# 确认后执行替换
find frontend/CretasFoodTrace/src/screens -name "*.tsx" -exec \
  sed -i '' 's/\.contactPhone/.phone/g' {} \;
```

### 4. 验证修改

```bash
# TypeScript 编译检查
cd frontend/CretasFoodTrace
npx tsc --noEmit --skipLibCheck

# 运行测试
npm test
```

## 注意事项

1. **不同实体有不同的字段结构** - 不能一刀切替换
2. **Factory 用 contactPhone 是正确的** - 它没有 phone 字段
3. **先检查后端再改前端** - 以后端为准
4. **保持双字段兼容** - 后端同时支持新旧字段名

## 相关文件路径

- 后端 Entity: `backend-java/src/main/java/com/cretas/aims/entity/`
- 后端 DTO: `backend-java/src/main/java/com/cretas/aims/dto/`
- 前端 API Client: `frontend/CretasFoodTrace/src/services/api/`
- 前端 Screens: `frontend/CretasFoodTrace/src/screens/`
