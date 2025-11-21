# ProcessingController API文档

> **Controller**: ProcessingController
> **基础路径**: `/api/mobile/{factoryId}/processing`
> **端点数量**: 23个
> **核心功能**: 生产批次管理、原材料消耗、质量检验、成本分析、仪表盘数据
> **文档详细程度**: ⭐⭐ 中等详细（5个维度）

---

## 📊 端点总览

### 按功能分组

| 功能组 | 端点数 | 说明 |
|--------|--------|------|
| 批次管理 | 8 | 创建、开始、暂停、完成、取消、查询批次 |
| 原材料管理 | 3 | 接收、查询、消耗记录 |
| 质量检验 | 4 | 提交、查询质检记录，统计与趋势 |
| 成本分析 | 2 | 批次成本分析、重算成本 |
| 仪表盘 | 2 | 生产概览、关键指标 |
| 设备监控 | 2 | 设备使用记录、设备监控数据 |
| 工作会话 | 2 | 开始/结束工作会话 |

### 快速查找

| 序号 | HTTP方法 | 端点路径 | 功能 | 权限要求 |
|------|---------|---------|------|---------|
| 1 | POST | `/batches` | 创建生产批次 | 工厂管理员/生产管理员 |
| 2 | POST | `/batches/{batchId}/start` | 开始生产 | 生产管理员/负责人 |
| 3 | POST | `/batches/{batchId}/pause` | 暂停生产 | 生产管理员/负责人 |
| 4 | POST | `/batches/{batchId}/complete` | 完成生产 | 生产管理员/负责人 |
| 5 | POST | `/batches/{batchId}/cancel` | 取消生产 | 工厂管理员/生产管理员 |
| 6 | GET | `/batches/{batchId}` | 获取批次详情 | 工厂用户 |
| 7 | GET | `/batches` | 获取批次列表（分页） | 工厂用户 |
| 8 | GET | `/batches/{batchId}/timeline` | 获取批次时间线 | 工厂用户 |
| 9 | POST | `/material-receipt` | 创建原材料接收记录 | 仓库管理员 |
| 10 | GET | `/materials` | 获取原材料列表 | 工厂用户 |
| 11 | POST | `/batches/{batchId}/material-consumption` | 记录原材料消耗 | 生产管理员 |
| 12 | POST | `/quality/inspections` | 提交质检记录 | 质检员 |
| 13 | GET | `/quality/inspections` | 获取质检记录 | 工厂用户 |
| 14 | GET | `/quality/statistics` | 质量统计 | 工厂管理员 |
| 15 | GET | `/quality/trends` | 质量趋势 | 工厂管理员 |
| 16 | GET | `/batches/{batchId}/cost-analysis` | 批次成本分析 | 工厂管理员/财务 |
| 17 | POST | `/batches/{batchId}/recalculate-cost` | 重算成本 | 工厂管理员 |
| 18 | GET | `/dashboard/overview` | 生产概览 | 工厂用户 |
| 19 | GET | `/dashboard/metrics` | 关键指标 | 工厂用户 |
| 20 | POST | `/equipment/{equipmentId}/record-usage` | 记录设备使用 | 生产管理员 |
| 21 | GET | `/equipment/monitoring` | 设备监控数据 | 工厂用户 |
| 22 | POST | `/work-session/start` | 开始工作会话 | 生产员工 |
| 23 | POST | `/work-session/end` | 结束工作会话 | 生产员工 |

---

## 📑 API详细文档

### 1. 创建生产批次

**端点**: `POST /api/mobile/{factoryId}/processing/batches`

**功能**: 创建新的生产批次，启动生产流程

**权限**: 工厂管理员、生产管理员

**请求参数**:
```typescript
// 路径参数
factoryId: string  // 工厂ID

// Body参数
{
  batchNumber?: string,        // 批次编号（可选，不填自动生成）
  productTypeId: string,       // 产品类型ID（必填）
  productionPlanId?: string,   // 生产计划ID（可选）
  plannedQuantity: number,     // 计划产量（必填，>0）
  supervisorId: number,        // 负责人ID（必填）
  productionDate?: string,     // 生产日期（可选，默认今天）
  notes?: string               // 备注（可选，最多500字符）
}
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  message: "生产批次创建成功",
  data: {
    id: string,              // UUID
    batchNumber: string,     // 批次编号（如BATCH-20251120-001）
    productTypeId: string,
    plannedQuantity: number,
    status: "PENDING",       // 初始状态
    supervisorId: number,
    productionDate: string,
    createdAt: string,
    // ... 其他字段
  }
}

// 错误响应
400: 产品类型不存在 / 计划产量必须大于0
403: 无权限创建批次
409: 批次编号已存在
```

**业务逻辑核心**:
1. 验证产品类型、负责人存在性
2. 生成批次编号（如未提供）：`BATCH-YYYYMMDD-XXX`
3. 设置初始状态为`PENDING`
4. 记录创建信息

**代码示例**:
```typescript
// TypeScript调用示例
const createBatch = async () => {
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/processing/batches`,
    {
      productTypeId: 'TEST_PROD_001',
      plannedQuantity: 200,
      supervisorId: 1,
      productionDate: '2025-11-20',
    }
  );
  return response.data;
};
```

**详细文档**: [主文档 §2.1](./PRD-API端点完整文档-v3.0.md#21-创建生产批次-create-production-batch)

---

### 2. 开始生产

**端点**: `POST /api/mobile/{factoryId}/processing/batches/{batchId}/start`

**功能**: 启动生产批次，记录开始时间，状态变更为进行中

**权限**: 生产管理员、负责人

**请求参数**:
```typescript
// 路径参数
factoryId: string
batchId: string

// Query参数
supervisorId: number  // 负责人ID（可与创建时不同）
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  message: "生产已开始",
  data: {
    id: string,
    status: "IN_PROGRESS",     // 状态已变更
    startTime: string,          // 记录开始时间
    supervisorId: number,
    // ... 其他字段
  }
}

// 错误响应
400: 批次状态不正确（不是PENDING或PAUSED）
403: 无权限开始生产
404: 批次不存在
409: 批次已在进行中
```

**业务逻辑核心**:
1. 验证批次状态为`PENDING`或`PAUSED`
2. 更新状态为`IN_PROGRESS`
3. 记录`startTime`（仅首次启动）
4. 更新负责人（如提供）

**状态转换**:
```
PENDING → IN_PROGRESS (首次启动)
PAUSED → IN_PROGRESS (恢复生产)
```

**代码示例**:
```typescript
const startProduction = async (batchId: string) => {
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/processing/batches/${batchId}/start`,
    null,
    { params: { supervisorId: 1 } }
  );
  return response.data;
};
```

---

### 3. 暂停生产

**端点**: `POST /api/mobile/{factoryId}/processing/batches/{batchId}/pause`

**功能**: 暂停批次生产，记录暂停原因

**权限**: 生产管理员、负责人

**请求参数**:
```typescript
// 路径参数
factoryId: string
batchId: string

// Query参数
reason: string  // 暂停原因（必填）
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  message: "生产已暂停",
  data: {
    id: string,
    status: "PAUSED",
    // ... 其他字段
  }
}
```

**业务逻辑核心**:
- 验证状态为`IN_PROGRESS`
- 更新为`PAUSED`
- 记录暂停原因

---

### 4. 完成生产

**端点**: `POST /api/mobile/{factoryId}/processing/batches/{batchId}/complete`

**功能**: 完成批次生产，记录实际产量和质量数据

**权限**: 生产管理员、负责人

**请求参数**:
```typescript
// 路径参数
factoryId: string
batchId: string

// Query参数
actualQuantity: number    // 实际产量（必填）
goodQuantity: number      // 良品数量（必填）
defectQuantity: number    // 不良品数量（必填）
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  message: "生产已完成",
  data: {
    id: string,
    status: "COMPLETED",
    actualQuantity: number,
    goodQuantity: number,
    defectQuantity: number,
    endTime: string,        // 完成时间
    // ... 其他字段
  }
}
```

**业务逻辑核心**:
- 验证状态为`IN_PROGRESS`
- 验证数量关系：`actualQuantity = goodQuantity + defectQuantity`
- 记录完成时间
- 计算合格率

---

### 5. 取消生产

**端点**: `POST /api/mobile/{factoryId}/processing/batches/{batchId}/cancel`

**功能**: 取消批次生产，记录取消原因

**权限**: 工厂管理员、生产管理员

**请求参数**:
```typescript
// 路径参数
factoryId: string
batchId: string

// Query参数
reason: string  // 取消原因（必填）
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  message: "生产已取消",
  data: {
    id: string,
    status: "CANCELLED",
    // ... 其他字段
  }
}
```

**业务逻辑核心**:
- 可从任何状态取消（除`COMPLETED`）
- 记录取消原因
- 释放预留的原材料

---

### 6. 获取批次详情

**端点**: `GET /api/mobile/{factoryId}/processing/batches/{batchId}`

**功能**: 获取生产批次详细信息

**权限**: 工厂用户

**请求参数**:
```typescript
// 路径参数
factoryId: string
batchId: string
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: {
    id: string,
    batchNumber: string,
    productTypeId: string,
    productTypeName: string,
    plannedQuantity: number,
    actualQuantity: number,
    status: string,
    supervisorId: number,
    supervisorName: string,
    startTime: string,
    endTime: string,
    totalCost: number,
    materialCost: number,
    laborCost: number,
    // ... 完整字段
  }
}
```

**业务逻辑核心**:
- 查询批次基本信息
- 关联产品类型、负责人信息
- 计算成本数据

---

### 7. 获取批次列表（分页）

**端点**: `GET /api/mobile/{factoryId}/processing/batches`

**功能**: 分页获取生产批次列表，支持状态筛选

**权限**: 工厂用户

**请求参数**:
```typescript
// 路径参数
factoryId: string

// Query参数
status?: string      // 状态筛选（可选）
page?: number        // 页码（默认1）
size?: number        // 每页大小（默认20）
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: {
    content: ProductionBatch[],  // 批次列表
    page: number,
    size: number,
    totalElements: number,
    totalPages: number,
    currentPage: number,
  }
}
```

**业务逻辑核心**:
- 按工厂ID筛选
- 可选状态筛选
- 分页查询
- 按创建时间倒序

---

### 8. 获取批次时间线

**端点**: `GET /api/mobile/{factoryId}/processing/batches/{batchId}/timeline`

**功能**: 获取批次生产时间线，展示关键节点

**权限**: 工厂用户

**请求参数**:
```typescript
// 路径参数
factoryId: string
batchId: string
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: [
    {
      event: "CREATED",
      timestamp: "2025-11-20T08:00:00Z",
      operator: "张三",
      description: "创建批次"
    },
    {
      event: "STARTED",
      timestamp: "2025-11-20T09:00:00Z",
      operator: "张三",
      description: "开始生产"
    },
    {
      event: "PAUSED",
      timestamp: "2025-11-20T12:00:00Z",
      operator: "张三",
      description: "暂停生产 - 设备维护"
    },
    {
      event: "RESUMED",
      timestamp: "2025-11-20T13:00:00Z",
      operator: "张三",
      description: "恢复生产"
    },
    {
      event: "COMPLETED",
      timestamp: "2025-11-20T17:00:00Z",
      operator: "张三",
      description: "完成生产 - 实际产量: 195kg"
    }
  ]
}
```

**业务逻辑核心**:
- 解析批次的状态变更历史
- 提取关键事件节点
- 按时间顺序排列

---

### 9. 创建原材料接收记录

**端点**: `POST /api/mobile/{factoryId}/processing/material-receipt`

**功能**: 创建原材料接收记录

**权限**: 仓库管理员

**请求参数**:
```typescript
// Body参数
{
  materialTypeId: string,
  quantity: number,
  unit: string,
  supplierId: string,
  purchasePrice: number,
  receiveDate: string,
  expiryDate: string,
  storageLocation: string,
  qualityGrade?: string,
  notes?: string
}
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  message: "原材料接收成功",
  data: {
    id: string,
    batchNumber: string,  // 自动生成
    materialTypeId: string,
    quantity: number,
    status: "FRESH",      // 初始状态
    // ... 其他字段
  }
}
```

---

### 10. 获取原材料列表

**端点**: `GET /api/mobile/{factoryId}/processing/materials`

**功能**: 分页获取原材料列表

**权限**: 工厂用户

**请求参数**:
```typescript
// Query参数
page?: number
size?: number
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: {
    content: MaterialBatch[],
    page: number,
    size: number,
    totalElements: number,
    totalPages: number,
  }
}
```

---

### 11. 记录原材料消耗

**端点**: `POST /api/mobile/{factoryId}/processing/batches/{batchId}/material-consumption`

**功能**: 记录生产批次的原材料消耗

**权限**: 生产管理员

**请求参数**:
```typescript
// Body参数
[
  {
    materialBatchId: string,
    quantity: number,
    unit: string
  },
  // ... 可多条记录
]
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  message: "原材料消耗记录成功"
}
```

**业务逻辑核心**:
- 验证原材料批次存在性和库存充足
- 扣减库存
- 记录消耗流水

---

### 12. 提交质检记录

**端点**: `POST /api/mobile/{factoryId}/processing/quality/inspections`

**功能**: 提交产品质量检验记录

**权限**: 质检员

**请求参数**:
```typescript
// Query参数
batchId: string

// Body参数
{
  inspectionDate: string,
  inspectorId: number,
  result: "PASS" | "FAIL",
  sampleSize: number,
  passedCount: number,
  failedCount: number,
  defectTypes?: string[],
  notes?: string
}
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  message: "质检记录提交成功",
  data: {
    id: string,
    batchId: string,
    result: "PASS",
    passRate: 98.5,
    // ... 其他字段
  }
}
```

**业务逻辑核心**:
- 验证批次存在
- 计算合格率：`passedCount / sampleSize`
- 记录不合格项

---

### 13. 获取质检记录

**端点**: `GET /api/mobile/{factoryId}/processing/quality/inspections`

**功能**: 分页获取质检记录

**权限**: 工厂用户

**请求参数**:
```typescript
// Query参数
batchId?: string     // 批次ID筛选（可选）
page?: number
size?: number
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: {
    content: QualityInspection[],
    page: number,
    size: number,
    totalElements: number,
  }
}
```

---

### 14. 质量统计

**端点**: `GET /api/mobile/{factoryId}/processing/quality/statistics`

**功能**: 获取质量统计数据

**权限**: 工厂管理员

**请求参数**:
```typescript
// Query参数
startDate: string    // 开始日期
endDate: string      // 结束日期
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: {
    totalInspections: number,
    passedInspections: number,
    failedInspections: number,
    avgPassRate: number,
    totalSamples: number,
    defectDistribution: {
      "缺陷类型A": number,
      "缺陷类型B": number,
      // ...
    }
  }
}
```

---

### 15. 质量趋势

**端点**: `GET /api/mobile/{factoryId}/processing/quality/trends`

**功能**: 获取质量趋势分析

**权限**: 工厂管理员

**请求参数**:
```typescript
// Query参数
days?: number  // 天数（默认30）
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: [
    {
      date: "2025-11-20",
      inspections: 10,
      passRate: 97.5
    },
    // ... 每日数据
  ]
}
```

---

### 16. 批次成本分析

**端点**: `GET /api/mobile/{factoryId}/processing/batches/{batchId}/cost-analysis`

**功能**: 获取批次成本详细分析

**权限**: 工厂管理员、财务

**请求参数**:
```typescript
// 路径参数
factoryId: string
batchId: string
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: {
    totalCost: number,
    breakdown: {
      materialCost: number,
      materialDetails: [
        {
          materialName: string,
          quantity: number,
          unitPrice: number,
          subtotal: number
        }
      ],
      laborCost: number,
      laborDetails: {
        totalHours: number,
        avgHourlyRate: number
      },
      energyCost: number,
      overheadCost: number
    },
    unitCost: number,       // 单位成本
    profitMargin: number    // 利润率
  }
}
```

**业务逻辑核心**:
- 汇总原材料消耗成本
- 计算人工成本（工作时长 × 时薪）
- 计算能源成本（设备运行时间 × 电费）
- 分摊管理费用

---

### 17. 重新计算批次成本

**端点**: `POST /api/mobile/{factoryId}/processing/batches/{batchId}/recalculate-cost`

**功能**: 重新计算批次成本（数据修正后）

**权限**: 工厂管理员

**请求参数**:
```typescript
// 路径参数
factoryId: string
batchId: string
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  message: "成本已重新计算",
  data: {
    id: string,
    totalCost: number,
    materialCost: number,
    laborCost: number,
    energyCost: number
  }
}
```

---

### 18. 生产概览

**端点**: `GET /api/mobile/{factoryId}/processing/dashboard/overview`

**功能**: 获取生产概览数据，用于仪表盘展示

**权限**: 工厂用户

**请求参数**:
```typescript
// Query参数
period?: string  // 时间周期（默认today）
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: {
    summary: {
      totalBatches: number,
      activeBatches: number,
      completedBatches: number,
      todayOutputKg: number,
      qualityInspections: number,
      activeAlerts: number,
      activeEquipment: number,
      totalEquipment: number,
      onDutyWorkers: number,
      totalWorkers: number,
      avgPassRate: number
    },
    productionTrend: [
      {
        date: string,
        planned: number,
        actual: number,
        passRate: number
      }
    ],
    topProducts: [
      {
        productTypeName: string,
        quantity: number,
        percentage: number
      }
    ]
  }
}
```

**详细文档**: [主文档 §2.3](./PRD-API端点完整文档-v3.0.md#23-获取生产概览-dashboard-overview)（已包含部分内容）

---

### 19. 关键指标

**端点**: `GET /api/mobile/{factoryId}/processing/dashboard/metrics`

**功能**: 获取生产关键指标

**权限**: 工厂用户

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: {
    oee: number,                  // 设备综合效率
    qualityRate: number,          // 质量合格率
    deliveryOnTime: number,       // 准时交付率
    inventoryTurnover: number,    // 库存周转率
    productivityRate: number      // 生产效率
  }
}
```

---

### 20-23. 其他端点

#### 20. 记录设备使用
`POST /processing/equipment/{equipmentId}/record-usage`
- 记录设备运行时间和使用情况

#### 21. 设备监控数据
`GET /processing/equipment/monitoring`
- 获取所有设备实时监控数据

#### 22. 开始工作会话
`POST /processing/work-session/start`
- 员工开始工作打卡

#### 23. 结束工作会话
`POST /processing/work-session/end`
- 员工结束工作打卡

---

## 📊 状态机图

### 生产批次状态转换

```
        创建批次
           ↓
       [PENDING]
           ↓ start()
    [IN_PROGRESS]
           ↓
    ┌──────┴──────┐
    ↓             ↓
[PAUSED]    complete()
    ↓             ↓
resume()    [COMPLETED]
    ↓
[IN_PROGRESS]

    ↓ cancel()
[CANCELLED]
```

---

## 🔗 相关文档

- [主文档 - 核心API超详细分析](./PRD-API端点完整文档-v3.0.md)
- [API索引文档](./PRD-API索引文档-v1.0.md)
- [MaterialBatchController API](./PRD-API-MaterialBatchController.md) (待创建)
- [EquipmentController API](./PRD-API-EquipmentController.md) (待创建)

---

**文档版本**: v1.0
**最后更新**: 2025-11-20
**维护者**: Cretas Development Team
