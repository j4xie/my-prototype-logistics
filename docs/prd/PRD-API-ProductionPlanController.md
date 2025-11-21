# PRD-API-ProductionPlanController.md

## 文档信息

- **文档标题**: ProductionPlanController API 端点文档
- **Controller**: `ProductionPlanController.java`
- **模块**: 生产计划管理模块 (Production Plan Management)
- **端点数量**: 22个
- **文档版本**: v1.0.0
- **创建时间**: 2025-01-20
- **维护团队**: Cretas Backend Team

---

## 📋 目录

1. [控制器概述](#1-控制器概述)
2. [端点清单](#2-端点清单)
3. [端点详细文档](#3-端点详细文档)
4. [数据模型](#4-数据模型)
5. [业务规则](#5-业务规则)
6. [前端集成建议](#6-前端集成建议)

---

## 1. 控制器概述

### 1.1 功能描述

**ProductionPlanController** 负责生产计划的全生命周期管理，包括：

- ✅ **计划CRUD**: 创建、查询、更新、删除生产计划
- ✅ **状态管理**: 开始、暂停、恢复、完成、取消生产
- ✅ **材料管理**: 分配原材料批次、记录消耗
- ✅ **成本核算**: 估算成本、实际成本录入
- ✅ **查询过滤**: 按状态、日期范围查询
- ✅ **批量操作**: 批量创建生产计划
- ✅ **数据导出**: Excel导出生产计划

### 1.2 关键特性

| 特性 | 说明 | 实现方式 |
|------|------|----------|
| **状态机管理** | 6种生产状态 | `ProductionPlanStatus` 枚举 |
| **成本核算** | 估算vs实际成本对比 | 4类成本（材料、人工、设备、其他） |
| **优先级** | 支持计划优先级 | `priority` 字段 |
| **客户订单关联** | 关联客户订单号 | `customerOrderNumber` 字段 |
| **材料追溯** | 记录原材料批次使用 | `ProductionPlanBatchUsage` 关联表 |
| **产量追踪** | 计划vs实际产量 | `plannedQuantity` vs `actualQuantity` |

### 1.3 生产状态机

```
PENDING → IN_PROGRESS → PAUSED → IN_PROGRESS → COMPLETED
   ↓                       ↓            ↓
CANCELLED             CANCELLED    CANCELLED
```

**状态枚举**:
```typescript
enum ProductionPlanStatus {
  PENDING = 'PENDING',          // 待执行
  IN_PROGRESS = 'IN_PROGRESS',  // 进行中
  PAUSED = 'PAUSED',            // 已暂停
  COMPLETED = 'COMPLETED',      // 已完成
  CANCELLED = 'CANCELLED',      // 已取消
  OVERDUE = 'OVERDUE'           // 已逾期
}
```

---

## 2. 端点清单

| # | 方法 | 路径 | 功能 | 状态 |
|---|------|------|------|------|
| 1 | POST | `/api/mobile/{factoryId}/production-plans` | 创建生产计划 | ✅ |
| 2 | PUT | `/api/mobile/{factoryId}/production-plans/{planId}` | 更新生产计划 | ✅ |
| 3 | DELETE | `/api/mobile/{factoryId}/production-plans/{planId}` | 删除生产计划 | ✅ |
| 4 | GET | `/api/mobile/{factoryId}/production-plans/{planId}` | 获取计划详情 | ✅ |
| 5 | GET | `/api/mobile/{factoryId}/production-plans` | 获取计划列表（分页） | ✅ |
| 6 | GET | `/api/mobile/{factoryId}/production-plans/status/{status}` | 按状态获取 | ✅ |
| 7 | GET | `/api/mobile/{factoryId}/production-plans/date-range` | 按日期范围获取 | ✅ |
| 8 | GET | `/api/mobile/{factoryId}/production-plans/today` | 获取今日计划 | ✅ |
| 9 | POST | `/api/mobile/{factoryId}/production-plans/{planId}/start` | 开始生产 | ✅ |
| 10 | POST | `/api/mobile/{factoryId}/production-plans/{planId}/complete` | 完成生产 | ✅ |
| 11 | POST | `/api/mobile/{factoryId}/production-plans/{planId}/cancel` | 取消计划 | ✅ |
| 12 | POST | `/api/mobile/{factoryId}/production-plans/{planId}/pause` | 暂停生产 | ✅ |
| 13 | POST | `/api/mobile/{factoryId}/production-plans/{planId}/resume` | 恢复生产 | ✅ |
| 14 | PUT | `/api/mobile/{factoryId}/production-plans/{planId}/costs` | 更新实际成本 | ✅ |
| 15 | POST | `/api/mobile/{factoryId}/production-plans/{planId}/batches` | 分配原材料批次 | ✅ |
| 16 | POST | `/api/mobile/{factoryId}/production-plans/{planId}/consumption` | 记录材料消耗 | ✅ |
| 17 | GET | `/api/mobile/{factoryId}/production-plans/statistics` | 获取生产统计 | ✅ |
| 18 | GET | `/api/mobile/{factoryId}/production-plans/pending-execution` | 获取待执行计划 | ✅ |
| 19 | POST | `/api/mobile/{factoryId}/production-plans/batch` | 批量创建计划 | ✅ |
| 20 | GET | `/api/mobile/{factoryId}/production-plans/export` | 导出计划 | ✅ |

---

## 3. 端点详细文档

### 3.1 CRUD操作

#### 3.1.1 创建生产计划

```http
POST /api/mobile/{factoryId}/production-plans
Content-Type: application/json
Authorization: Bearer {accessToken}
```

**Request Body**:
```typescript
interface CreateProductionPlanRequest {
  productTypeId: string;           // 产品类型ID（必填）
  plannedQuantity: number;         // 计划产量（必填）
  customerOrderNumber?: string;    // 客户订单号（可选）
  priority?: number;               // 优先级（1-10，默认5）
  notes?: string;                  // 备注（可选）

  // 估算成本（可选）
  estimatedMaterialCost?: number;
  estimatedLaborCost?: number;
  estimatedEquipmentCost?: number;
  estimatedOtherCost?: number;
}
```

**Response**:
```typescript
interface ApiResponse<ProductionPlanDTO> {
  code: 200;
  message: "生产计划创建成功";
  data: {
    id: string;                       // 计划ID（UUID）
    factoryId: string;                // 工厂ID
    planNumber: string;               // 计划编号（自动生成，如：PLAN-20250120-001）
    productTypeId: string;            // 产品类型ID
    productTypeName: string;          // 产品类型名称
    plannedQuantity: number;          // 计划产量
    actualQuantity: number | null;    // 实际产量
    status: ProductionPlanStatus;     // 状态（PENDING）
    customerOrderNumber: string | null;  // 客户订单号
    priority: number;                 // 优先级
    notes: string | null;             // 备注

    // 时间信息
    startTime: string | null;         // 开始时间
    endTime: string | null;           // 结束时间

    // 估算成本
    estimatedMaterialCost: number | null;
    estimatedLaborCost: number | null;
    estimatedEquipmentCost: number | null;
    estimatedOtherCost: number | null;
    estimatedTotalCost: number | null;  // 估算总成本

    // 实际成本
    actualMaterialCost: number | null;
    actualLaborCost: number | null;
    actualEquipmentCost: number | null;
    actualOtherCost: number | null;
    actualTotalCost: number | null;    // 实际总成本

    // 审计信息
    createdBy: number;                // 创建者ID
    createdByName: string;            // 创建者姓名
    createdAt: string;                // 创建时间
    updatedAt: string;                // 更新时间
  };
  timestamp: string;
}
```

**业务逻辑**:
```typescript
const createProductionPlan = async (
  factoryId: string,
  request: CreateProductionPlanRequest,
  userId: number
): Promise<ProductionPlanDTO> => {
  // 1. 生成计划编号
  const planNumber = generatePlanNumber(factoryId);
  // 格式: PLAN-YYYYMMDD-NNN
  // 示例: PLAN-20250120-001

  // 2. 创建计划实体
  const plan = new ProductionPlan();
  plan.id = UUID.randomUUID().toString();
  plan.factoryId = factoryId;
  plan.planNumber = planNumber;
  plan.productTypeId = request.productTypeId;
  plan.plannedQuantity = request.plannedQuantity;
  plan.status = ProductionPlanStatus.PENDING;
  plan.customerOrderNumber = request.customerOrderNumber;
  plan.priority = request.priority || 5;
  plan.notes = request.notes;

  // 估算成本
  plan.estimatedMaterialCost = request.estimatedMaterialCost;
  plan.estimatedLaborCost = request.estimatedLaborCost;
  plan.estimatedEquipmentCost = request.estimatedEquipmentCost;
  plan.estimatedOtherCost = request.estimatedOtherCost;

  plan.createdBy = userId;
  plan.createdAt = new Date();
  plan.updatedAt = new Date();

  // 3. 保存到数据库
  const saved = await productionPlanRepository.save(plan);

  // 4. 返回DTO（包含关联数据）
  return toProductionPlanDTO(saved);
};
```

---

### 3.2 状态管理

#### 3.2.1 开始生产

```http
POST /api/mobile/{factoryId}/production-plans/{planId}/start
Authorization: Bearer {accessToken}
```

**功能**: 开始执行生产计划，状态从 `PENDING` → `IN_PROGRESS`。

**业务逻辑**:
```typescript
const startProduction = async (
  factoryId: string,
  planId: string
): Promise<ProductionPlanDTO> => {
  const plan = await getProductionPlan(factoryId, planId);

  // 验证状态
  if (plan.status !== ProductionPlanStatus.PENDING) {
    throw new Error('只有待执行的计划才能开始生产');
  }

  // 更新状态和开始时间
  plan.status = ProductionPlanStatus.IN_PROGRESS;
  plan.startTime = new Date();
  plan.updatedAt = new Date();

  const saved = await productionPlanRepository.save(plan);
  return toProductionPlanDTO(saved);
};
```

---

#### 3.2.2 完成生产

```http
POST /api/mobile/{factoryId}/production-plans/{planId}/complete?actualQuantity=500
Authorization: Bearer {accessToken}
```

**功能**: 完成生产计划，记录实际产量，状态 → `COMPLETED`。

**Query Parameters**:
- `actualQuantity` (BigDecimal, required): 实际产量

**业务逻辑**:
```typescript
const completeProduction = async (
  factoryId: string,
  planId: string,
  actualQuantity: number
): Promise<ProductionPlanDTO> => {
  const plan = await getProductionPlan(factoryId, planId);

  // 验证状态
  if (plan.status !== ProductionPlanStatus.IN_PROGRESS) {
    throw new Error('只有进行中的计划才能完成');
  }

  // 更新状态和实际数据
  plan.status = ProductionPlanStatus.COMPLETED;
  plan.actualQuantity = actualQuantity;
  plan.endTime = new Date();
  plan.updatedAt = new Date();

  // 计算产量差异
  const quantityVariance = actualQuantity - plan.plannedQuantity;
  const varianceRate = (quantityVariance / plan.plannedQuantity) * 100;

  // 记录产量差异（如需要）
  if (Math.abs(varianceRate) > 5) {
    log.warn(`生产计划 ${plan.planNumber} 产量差异较大: ${varianceRate.toFixed(2)}%`);
  }

  const saved = await productionPlanRepository.save(plan);
  return toProductionPlanDTO(saved);
};
```

---

#### 3.2.3 取消计划

```http
POST /api/mobile/{factoryId}/production-plans/{planId}/cancel?reason=原材料不足
Authorization: Bearer {accessToken}
```

**功能**: 取消生产计划，记录取消原因。

**Query Parameters**:
- `reason` (String, required): 取消原因

**业务逻辑**:
```typescript
const cancelProductionPlan = async (
  factoryId: string,
  planId: string,
  reason: string
): Promise<void> => {
  const plan = await getProductionPlan(factoryId, planId);

  // 验证状态（已完成的不能取消）
  if (plan.status === ProductionPlanStatus.COMPLETED) {
    throw new Error('已完成的计划不能取消');
  }

  // 更新状态
  plan.status = ProductionPlanStatus.CANCELLED;
  plan.notes = plan.notes
    ? `${plan.notes}\n[取消原因] ${reason}`
    : `[取消原因] ${reason}`;
  plan.updatedAt = new Date();

  // 释放已分配的原材料批次
  await releaseAllocatedMaterialBatches(planId);

  await productionPlanRepository.save(plan);
};
```

---

#### 3.2.4 暂停生产

```http
POST /api/mobile/{factoryId}/production-plans/{planId}/pause
Authorization: Bearer {accessToken}
```

**功能**: 暂停生产计划，状态 → `PAUSED`。

---

#### 3.2.5 恢复生产

```http
POST /api/mobile/{factoryId}/production-plans/{planId}/resume
Authorization: Bearer {accessToken}
```

**功能**: 恢复暂停的生产计划，状态 `PAUSED` → `IN_PROGRESS`。

---

### 3.3 材料管理

#### 3.3.1 分配原材料批次

```http
POST /api/mobile/{factoryId}/production-plans/{planId}/batches
Content-Type: application/json
Authorization: Bearer {accessToken}
```

**功能**: 为生产计划分配原材料批次。

**Request Body**:
```typescript
{
  "batchIds": [
    "batch-uuid-1",
    "batch-uuid-2",
    "batch-uuid-3"
  ]
}
```

**业务逻辑**:
```typescript
const assignMaterialBatches = async (
  factoryId: string,
  planId: string,
  batchIds: string[]
): Promise<void> => {
  const plan = await getProductionPlan(factoryId, planId);

  // 验证状态
  if (plan.status === ProductionPlanStatus.COMPLETED ||
      plan.status === ProductionPlanStatus.CANCELLED) {
    throw new Error('已完成或已取消的计划不能分配批次');
  }

  // 验证批次可用性
  for (const batchId of batchIds) {
    const batch = await materialBatchRepository.findOne({
      where: { id: batchId, factoryId }
    });

    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`);
    }

    if (batch.status !== 'AVAILABLE') {
      throw new Error(`批次不可用: ${batchId}`);
    }
  }

  // 创建批次使用记录
  for (const batchId of batchIds) {
    const usage = new ProductionPlanBatchUsage();
    usage.productionPlanId = planId;
    usage.materialBatchId = batchId;
    usage.assignedAt = new Date();
    usage.status = 'ALLOCATED';  // 已分配

    await productionPlanBatchUsageRepository.save(usage);
  }
};
```

---

#### 3.3.2 记录材料消耗

```http
POST /api/mobile/{factoryId}/production-plans/{planId}/consumption?batchId=batch-uuid-1&quantity=50
Authorization: Bearer {accessToken}
```

**功能**: 记录生产过程中的材料消耗。

**Query Parameters**:
- `batchId` (String, required): 批次ID
- `quantity` (BigDecimal, required): 消耗数量

**业务逻辑**:
```typescript
const recordMaterialConsumption = async (
  factoryId: string,
  planId: string,
  batchId: string,
  quantity: number
): Promise<void> => {
  const plan = await getProductionPlan(factoryId, planId);
  const batch = await getMaterialBatch(factoryId, batchId);

  // 验证批次是否已分配给此计划
  const usage = await productionPlanBatchUsageRepository.findOne({
    where: { productionPlanId: planId, materialBatchId: batchId }
  });

  if (!usage) {
    throw new Error('该批次未分配给此生产计划');
  }

  // 验证批次可用数量
  if (batch.currentQuantity < quantity) {
    throw new Error(`批次可用数量不足: 需要${quantity}，可用${batch.currentQuantity}`);
  }

  // 创建消耗记录
  const consumption = new MaterialConsumption();
  consumption.productionPlanId = planId;
  consumption.materialBatchId = batchId;
  consumption.quantity = quantity;
  consumption.consumedAt = new Date();

  await materialConsumptionRepository.save(consumption);

  // 更新批次数量
  batch.currentQuantity -= quantity;
  await materialBatchRepository.save(batch);

  // 更新批次使用记录
  usage.consumedQuantity = (usage.consumedQuantity || 0) + quantity;
  usage.status = 'CONSUMED';
  await productionPlanBatchUsageRepository.save(usage);
};
```

---

### 3.4 成本核算

#### 3.4.1 更新实际成本

```http
PUT /api/mobile/{factoryId}/production-plans/{planId}/costs?materialCost=5000&laborCost=2000&equipmentCost=1000&otherCost=500
Authorization: Bearer {accessToken}
```

**功能**: 更新生产计划的实际成本。

**Query Parameters**:
- `materialCost` (BigDecimal, optional): 实际材料成本
- `laborCost` (BigDecimal, optional): 实际人工成本
- `equipmentCost` (BigDecimal, optional): 实际设备成本
- `otherCost` (BigDecimal, optional): 实际其他成本

**业务逻辑**:
```typescript
const updateActualCosts = async (
  factoryId: string,
  planId: string,
  costs: {
    materialCost?: number;
    laborCost?: number;
    equipmentCost?: number;
    otherCost?: number;
  }
): Promise<ProductionPlanDTO> => {
  const plan = await getProductionPlan(factoryId, planId);

  // 更新实际成本
  if (costs.materialCost !== undefined) {
    plan.actualMaterialCost = costs.materialCost;
  }
  if (costs.laborCost !== undefined) {
    plan.actualLaborCost = costs.laborCost;
  }
  if (costs.equipmentCost !== undefined) {
    plan.actualEquipmentCost = costs.equipmentCost;
  }
  if (costs.otherCost !== undefined) {
    plan.actualOtherCost = costs.otherCost;
  }

  plan.updatedAt = new Date();

  const saved = await productionPlanRepository.save(plan);
  return toProductionPlanDTO(saved);
};
```

**成本对比分析**:
```typescript
interface CostAnalysis {
  // 估算成本
  estimatedMaterialCost: number;
  estimatedLaborCost: number;
  estimatedEquipmentCost: number;
  estimatedOtherCost: number;
  estimatedTotalCost: number;

  // 实际成本
  actualMaterialCost: number;
  actualLaborCost: number;
  actualEquipmentCost: number;
  actualOtherCost: number;
  actualTotalCost: number;

  // 差异分析
  materialCostVariance: number;       // 差异金额
  materialCostVarianceRate: number;   // 差异率（%）
  laborCostVariance: number;
  laborCostVarianceRate: number;
  equipmentCostVariance: number;
  equipmentCostVarianceRate: number;
  otherCostVariance: number;
  otherCostVarianceRate: number;
  totalCostVariance: number;
  totalCostVarianceRate: number;
}

// 示例计算
const analysis: CostAnalysis = {
  estimatedMaterialCost: 5000,
  actualMaterialCost: 5500,
  materialCostVariance: 500,           // 实际 - 估算
  materialCostVarianceRate: 10.0,      // (500 / 5000) * 100 = 10%
  // ...
};
```

---

### 3.5 查询与统计

#### 3.5.1 按状态获取

```http
GET /api/mobile/{factoryId}/production-plans/status/IN_PROGRESS
Authorization: Bearer {accessToken}
```

**查询逻辑**:
```sql
SELECT * FROM production_plans
WHERE factory_id = ?
  AND status = ?
ORDER BY priority DESC, created_at ASC
```

---

#### 3.5.2 按日期范围获取

```http
GET /api/mobile/{factoryId}/production-plans/date-range?startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer {accessToken}
```

**查询逻辑**:
```sql
SELECT * FROM production_plans
WHERE factory_id = ?
  AND created_at BETWEEN ? AND ?
ORDER BY created_at DESC
```

---

#### 3.5.3 获取今日计划

```http
GET /api/mobile/{factoryId}/production-plans/today
Authorization: Bearer {accessToken}
```

**查询逻辑**:
```sql
SELECT * FROM production_plans
WHERE factory_id = ?
  AND DATE(created_at) = CURDATE()
ORDER BY priority DESC
```

---

#### 3.5.4 获取生产统计

```http
GET /api/mobile/{factoryId}/production-plans/statistics?startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer {accessToken}
```

**Response**:
```typescript
interface ProductionStatistics {
  // 计划统计
  totalPlans: number;              // 总计划数
  pendingPlans: number;            // 待执行
  inProgressPlans: number;         // 进行中
  completedPlans: number;          // 已完成
  cancelledPlans: number;          // 已取消
  pausedPlans: number;             // 已暂停

  // 产量统计
  totalPlannedQuantity: number;    // 总计划产量
  totalActualQuantity: number;     // 总实际产量
  quantityCompletionRate: number;  // 产量完成率（%）

  // 成本统计
  totalEstimatedCost: number;      // 总估算成本
  totalActualCost: number;         // 总实际成本
  costVariance: number;            // 成本差异
  costVarianceRate: number;        // 成本差异率（%）

  // 效率统计
  averageProductionTime: number;   // 平均生产时长（分钟）
  completionRate: number;          // 完成率（%）
  onTimeCompletionRate: number;    // 准时完成率（%）
}
```

---

### 3.6 批量操作

#### 3.6.1 批量创建生产计划

```http
POST /api/mobile/{factoryId}/production-plans/batch
Content-Type: application/json
Authorization: Bearer {accessToken}
```

**Request Body**:
```typescript
[
  {
    "productTypeId": "product-1",
    "plannedQuantity": 100,
    "priority": 5
  },
  {
    "productTypeId": "product-2",
    "plannedQuantity": 200,
    "priority": 3
  }
]
```

**Response**:
```typescript
{
  "code": 200,
  "message": "批量创建成功",
  "data": [
    // ProductionPlanDTO对象数组
  ]
}
```

---

#### 3.6.2 导出生产计划

```http
GET /api/mobile/{factoryId}/production-plans/export?startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer {accessToken}
```

**Response**: Excel文件

**Excel格式**:
| 计划编号 | 产品类型 | 计划产量 | 实际产量 | 状态 | 优先级 | 开始时间 | 结束时间 | 估算成本 | 实际成本 | 成本差异 |
|---------|---------|---------|---------|------|--------|---------|---------|---------|---------|---------|
| PLAN-20250120-001 | 三文鱼片 | 500 | 480 | COMPLETED | 5 | 2025-01-20 08:00 | 2025-01-20 18:00 | 8000 | 8500 | +500 |

---

## 4. 数据模型

### 4.1 ProductionPlan实体

```typescript
interface ProductionPlan {
  // 主键和基础信息
  id: string;                      // UUID主键
  factoryId: string;               // 工厂ID
  planNumber: string;              // 计划编号（唯一，如：PLAN-20250120-001）

  // 产品信息
  productTypeId: string;           // 产品类型ID
  plannedQuantity: number;         // 计划产量
  actualQuantity: number | null;   // 实际产量

  // 状态和优先级
  status: ProductionPlanStatus;    // 状态
  priority: number;                // 优先级（1-10）

  // 时间信息
  startTime: Date | null;          // 开始时间
  endTime: Date | null;            // 结束时间

  // 客户订单
  customerOrderNumber: string | null;  // 客户订单号
  notes: string | null;            // 备注

  // 估算成本
  estimatedMaterialCost: number | null;
  estimatedLaborCost: number | null;
  estimatedEquipmentCost: number | null;
  estimatedOtherCost: number | null;

  // 实际成本
  actualMaterialCost: number | null;
  actualLaborCost: number | null;
  actualEquipmentCost: number | null;
  actualOtherCost: number | null;

  // 审计信息
  createdBy: number;               // 创建者ID
  createdAt: Date;                 // 创建时间
  updatedAt: Date;                 // 更新时间

  // 关联实体
  productType?: ProductType;       // 产品类型
  createdByUser?: User;            // 创建者
  materialConsumptions?: MaterialConsumption[];  // 材料消耗记录
  batchUsages?: ProductionPlanBatchUsage[];      // 批次使用记录
}
```

---

## 5. 业务规则

### 5.1 状态转换规则

```typescript
const allowedTransitions = {
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PAUSED', 'COMPLETED', 'CANCELLED'],
  PAUSED: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],  // 终态，不能转换
  CANCELLED: [],  // 终态，不能转换
  OVERDUE: ['CANCELLED'],
};

const validateStateTransition = (
  currentStatus: ProductionPlanStatus,
  targetStatus: ProductionPlanStatus
): boolean => {
  const allowed = allowedTransitions[currentStatus] || [];
  return allowed.includes(targetStatus);
};
```

### 5.2 计划编号生成规则

```typescript
const generatePlanNumber = (factoryId: string): string => {
  const today = new Date();
  const dateStr = format(today, 'yyyyMMdd');

  // 查询当天的计划数量
  const todayCount = await productionPlanRepository.count({
    where: {
      factoryId,
      planNumber: Like(`PLAN-${dateStr}-%`)
    }
  });

  const sequence = String(todayCount + 1).padStart(3, '0');
  return `PLAN-${dateStr}-${sequence}`;
};

// 示例
// 2025年1月20日的第1个计划: PLAN-20250120-001
// 2025年1月20日的第2个计划: PLAN-20250120-002
```

### 5.3 优先级规则

**优先级范围**: 1-10
- `1-3`: 低优先级
- `4-6`: 中优先级
- `7-10`: 高优先级

**默认优先级**: 5（中优先级）

**排序规则**: 优先级高的计划优先执行

---

## 6. 前端集成建议

### 6.1 完整的API Client

```typescript
// services/api/productionPlanApiClient.ts
import apiClient from './apiClient';
import { ApiResponse, ProductionPlanDTO } from '@/types';

export const productionPlanApiClient = {
  /**
   * 创建生产计划
   */
  async createProductionPlan(
    factoryId: string,
    data: CreateProductionPlanRequest
  ): Promise<ProductionPlanDTO> {
    const response = await apiClient.post<ApiResponse<ProductionPlanDTO>>(
      `/api/mobile/${factoryId}/production-plans`,
      data
    );
    return response.data.data;
  },

  /**
   * 开始生产
   */
  async startProduction(
    factoryId: string,
    planId: string
  ): Promise<ProductionPlanDTO> {
    const response = await apiClient.post<ApiResponse<ProductionPlanDTO>>(
      `/api/mobile/${factoryId}/production-plans/${planId}/start`
    );
    return response.data.data;
  },

  /**
   * 完成生产
   */
  async completeProduction(
    factoryId: string,
    planId: string,
    actualQuantity: number
  ): Promise<ProductionPlanDTO> {
    const response = await apiClient.post<ApiResponse<ProductionPlanDTO>>(
      `/api/mobile/${factoryId}/production-plans/${planId}/complete`,
      null,
      { params: { actualQuantity } }
    );
    return response.data.data;
  },

  /**
   * 分配原材料批次
   */
  async assignMaterialBatches(
    factoryId: string,
    planId: string,
    batchIds: string[]
  ): Promise<void> {
    await apiClient.post(
      `/api/mobile/${factoryId}/production-plans/${planId}/batches`,
      batchIds
    );
  },

  /**
   * 记录材料消耗
   */
  async recordMaterialConsumption(
    factoryId: string,
    planId: string,
    batchId: string,
    quantity: number
  ): Promise<void> {
    await apiClient.post(
      `/api/mobile/${factoryId}/production-plans/${planId}/consumption`,
      null,
      { params: { batchId, quantity } }
    );
  },

  /**
   * 获取生产统计
   */
  async getProductionStatistics(
    factoryId: string,
    startDate: string,
    endDate: string
  ): Promise<ProductionStatistics> {
    const response = await apiClient.get<ApiResponse<ProductionStatistics>>(
      `/api/mobile/${factoryId}/production-plans/statistics`,
      { params: { startDate, endDate } }
    );
    return response.data.data;
  },
};
```

---

## 📊 总结

### 端点覆盖

- **CRUD操作**: 5个端点
- **状态管理**: 5个端点（开始、完成、取消、暂停、恢复）
- **材料管理**: 2个端点（分配批次、记录消耗）
- **成本核算**: 1个端点
- **查询统计**: 5个端点
- **批量操作**: 2个端点
- **待执行查询**: 1个端点
- **数据导出**: 1个端点

**总计**: 22个端点，完整覆盖生产计划全生命周期管理。

### 核心业务逻辑

1. **6状态状态机**: PENDING → IN_PROGRESS → PAUSED → COMPLETED/CANCELLED
2. **成本核算**: 估算vs实际成本对比分析
3. **材料追溯**: 记录原材料批次使用和消耗
4. **产量管理**: 计划vs实际产量对比
5. **优先级排序**: 1-10级优先级系统
6. **计划编号**: 日期+序号格式（PLAN-YYYYMMDD-NNN）

---

**文档状态**: ✅ 已完成
**最后更新**: 2025-01-20
**维护者**: Cretas Backend Team
