# MaterialBatchController API文档

> **Controller**: MaterialBatchController
> **基础路径**: `/api/mobile/{factoryId}/material-batches`
> **端点数量**: 25个
> **核心功能**: 原材料批次创建、冻品转换、FIFO管理、库存统计、过期预警
> **文档详细程度**: ⭐⭐ 中等详细（5个维度）
> **E2E测试**: ⭐⭐⭐⭐⭐ 转冻品/撤销功能已完整验证

---

## 📊 端点总览

### 按功能分组

| 功能组 | 端点数 | 说明 |
|--------|--------|------|
| **批次基础管理** | 5 | 创建、更新、删除、查询批次 |
| **冻品转换** ⭐E2E测试 | 2 | 转为冻品、撤销转冻品（10分钟窗口） |
| **批次查询** | 5 | 按类型、状态、FIFO查询，过期预警 |
| **批次操作** | 6 | 使用、调整、预留、释放、消耗 |
| **库存管理** | 4 | 库存统计、价值评估、预警 |
| **状态管理** | 1 | 更新批次状态 |
| **批量导入导出** | 2 | 批量导入、批量导出 |

### 快速查找表

| 序号 | HTTP方法 | 端点路径 | 功能 | 权限要求 | E2E测试 |
|------|---------|---------|------|---------|---------|
| 1 | POST | `/` | 创建原材料批次 | 仓库管理员 | - |
| 2 | PUT | `/{batchId}` | 更新原材料批次 | 仓库管理员 | - |
| 3 | DELETE | `/{batchId}` | 删除原材料批次 | 仓库管理员 | - |
| 4 | GET | `/{batchId}` | 获取批次详情 | 工厂用户 | - |
| 5 | GET | `/` | 获取批次列表（分页） | 工厂用户 | - |
| 6 | POST | `/{batchId}/convert-to-frozen` | **转为冻品** | 仓库管理员/质检员 | ✅ 已验证 |
| 7 | POST | `/{batchId}/undo-frozen` | **撤销转冻品（10分钟窗口）** | 仓库管理员/质检员 | ✅ 已验证 |
| 8 | GET | `/material-type/{materialTypeId}` | 按材料类型获取批次 | 工厂用户 | - |
| 9 | GET | `/status/{status}` | 按状态获取批次 | 工厂用户 | - |
| 10 | GET | `/fifo/{materialTypeId}` | 获取FIFO批次（先进先出） | 工厂用户 | - |
| 11 | GET | `/expiring` | 获取即将过期的批次 | 工厂用户 | - |
| 12 | GET | `/expired` | 获取已过期的批次 | 工厂用户 | - |
| 13 | POST | `/{batchId}/use` | 使用批次材料 | 生产管理员 | - |
| 14 | POST | `/{batchId}/adjust` | 调整批次数量 | 仓库管理员 | - |
| 15 | PUT | `/{batchId}/status` | 更新批次状态 | 仓库管理员 | - |
| 16 | POST | `/{batchId}/reserve` | 预留批次材料 | 生产管理员 | - |
| 17 | POST | `/{batchId}/release` | 释放预留材料 | 生产管理员 | - |
| 18 | POST | `/{batchId}/consume` | 消耗批次材料 | 生产管理员 | - |
| 19 | GET | `/inventory/statistics` | 获取库存统计 | 工厂用户 | - |
| 20 | GET | `/inventory/valuation` | 获取库存价值 | 工厂管理员/财务 | - |
| 21 | GET | `/inventory/alerts` | 获取库存预警 | 仓库管理员 | - |
| 22 | GET | `/inventory/low-stock` | 获取低库存批次 | 仓库管理员 | - |
| 23 | POST | `/batch-import` | 批量导入批次 | 仓库管理员 | - |
| 24 | POST | `/batch-export` | 批量导出批次 | 仓库管理员 | - |
| 25 | GET | `/audit-log/{batchId}` | 获取批次审计日志 | 工厂管理员 | - |

---

## 📑 API详细文档

### 1. 创建原材料批次

**端点**: `POST /api/mobile/{factoryId}/material-batches`

**功能**: 创建新的原材料批次，记录入库信息

**权限**: 仓库管理员

**请求参数**:
```typescript
// 路径参数
factoryId: string  // 工厂ID

// Headers
Authorization: Bearer <token>

// Body参数
{
  materialTypeId: string,      // 材料类型ID（必填）
  batchNumber?: string,        // 批次编号（可选，不填自动生成）
  quantity: number,            // 数量（必填，>0）
  unit: string,                // 单位（必填，如kg/个/箱）
  supplierId: string,          // 供应商ID（必填）
  purchasePrice: number,       // 采购价格（必填，>0）
  receiveDate: string,         // 接收日期（必填，YYYY-MM-DD）
  expiryDate: string,          // 过期日期（必填，YYYY-MM-DD）
  productionDate?: string,     // 生产日期（可选）
  storageLocation: string,     // 存储位置（必填）
  qualityGrade?: string,       // 质量等级（可选，A/B/C）
  notes?: string               // 备注（可选）
}
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  message: "原材料批次创建成功",
  data: {
    id: string,                // UUID
    factoryId: string,
    batchNumber: string,       // 自动生成如MAT-20251120-001
    materialTypeId: string,
    materialTypeName: string,
    quantity: number,
    unit: string,
    supplierId: string,
    supplierName: string,
    purchasePrice: number,
    receiveDate: string,
    expiryDate: string,
    status: "FRESH",           // 初始状态
    storageLocation: string,
    qualityGrade: string,
    createdAt: string,
    createdBy: number
  }
}

// 错误响应
400: 材料类型不存在 / 数量必须大于0 / 日期格式错误
403: 无权限创建批次
409: 批次编号已存在
```

**业务逻辑核心**:
1. 验证材料类型、供应商存在性
2. 生成批次编号（如未提供）：`MAT-YYYYMMDD-XXX`
3. 设置初始状态为`FRESH`
4. 验证过期日期在接收日期之后
5. 记录创建人和创建时间

**代码示例**:
```typescript
const createMaterialBatch = async (data: CreateMaterialBatchRequest) => {
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/material-batches`,
    data
  );
  return response.data;
};
```

---

### 2. 更新原材料批次

**端点**: `PUT /api/mobile/{factoryId}/material-batches/{batchId}`

**功能**: 更新原材料批次信息

**权限**: 仓库管理员

**请求参数**:
```typescript
// 路径参数
factoryId: string
batchId: string

// Body参数（与创建相同，但都是可选的）
{
  materialTypeId?: string,
  quantity?: number,
  unit?: string,
  supplierId?: string,
  purchasePrice?: number,
  expiryDate?: string,
  storageLocation?: string,
  qualityGrade?: string,
  notes?: string
}
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  message: "原材料批次更新成功",
  data: MaterialBatchDTO  // 更新后的批次信息
}
```

**业务逻辑核心**:
- 只更新提供的字段
- 验证新值的合法性
- 记录更新时间和更新人

---

### 3. 删除原材料批次

**端点**: `DELETE /api/mobile/{factoryId}/material-batches/{batchId}`

**功能**: 删除原材料批次（软删除）

**权限**: 仓库管理员

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
  message: "原材料批次删除成功",
  data: null
}

// 错误响应
400: 批次已被使用，无法删除
404: 批次不存在
```

**业务逻辑核心**:
- 检查批次是否已被使用（status=USED）
- 软删除：设置deleted_at字段
- 不物理删除数据（保留审计追踪）

---

### 4. 获取批次详情

**端点**: `GET /api/mobile/{factoryId}/material-batches/{batchId}`

**功能**: 获取原材料批次详细信息

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
    factoryId: string,
    batchNumber: string,
    materialTypeId: string,
    materialTypeName: string,
    quantity: number,
    remainingQuantity: number,    // 剩余数量
    unit: string,
    supplierId: string,
    supplierName: string,
    supplierContact: string,
    purchasePrice: number,
    receiveDate: string,
    expiryDate: string,
    productionDate: string,
    status: string,               // FRESH/FROZEN/USED/EXPIRED
    storageLocation: string,
    qualityGrade: string,
    notes: string,
    daysUntilExpiry: number,      // 距离过期天数
    createdAt: string,
    updatedAt: string,
    createdBy: number,
    updatedBy: number
  }
}
```

**业务逻辑核心**:
- 关联材料类型、供应商信息
- 计算剩余数量
- 计算距离过期天数

---

### 5. 获取批次列表（分页）

**端点**: `GET /api/mobile/{factoryId}/material-batches`

**功能**: 分页获取原材料批次列表

**权限**: 工厂用户

**请求参数**:
```typescript
// Query参数
page?: number        // 页码（默认1）
size?: number        // 每页大小（默认20）
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: {
    content: MaterialBatchDTO[],
    page: number,
    size: number,
    totalElements: number,
    totalPages: number,
    currentPage: number
  }
}
```

**业务逻辑核心**:
- 按工厂ID筛选
- 按接收日期倒序排列
- 分页查询

---

### 6. 转为冻品 ⭐E2E测试验证

**端点**: `POST /api/mobile/{factoryId}/material-batches/{batchId}/convert-to-frozen`

**功能**: 将新鲜原材料批次转换为冻品，记录转换信息

**权限**: 仓库管理员、质检员

**重要性**: ⭐⭐⭐⭐⭐ E2E测试重点验证

**请求参数**:
```typescript
// 路径参数
factoryId: string
batchId: string

// Body参数
{
  convertedBy: number,           // 操作人员ID（必填）
  convertedDate: string,         // 转换日期（必填，YYYY-MM-DD）
  storageLocation: string,       // 存储位置（必填，建议：冷冻库-X区）
  notes?: string                 // 备注（可选，最多500字符）
}
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  message: "转冻品成功",
  data: {
    id: string,
    batchNumber: string,
    status: "FROZEN",              // ✅ 状态已变更：FRESH → FROZEN
    storageLocation: string,        // ✅ 存储位置已更新
    notes: string,                  // ✅ 包含转换记录和原存储位置
    updatedAt: string
  }
}

// 错误响应
400: 批次状态不正确（不是FRESH）
400: 操作人员不存在
400: 存储位置不能为空
403: 无权限转换
404: 批次不存在
409: 批次已被转换
```

**业务逻辑核心**（E2E测试验证过）:
1. **状态验证**: 当前status必须是FRESH
2. **数据备份**: 记录原始storage_location到notes（用于撤销）
3. **原子更新**:
   - status = FROZEN
   - storage_location = 新位置
   - notes += 转换记录（含时间戳、操作人、原位置）
4. **时间窗口**: 转换后10分钟内可撤销
5. **审计追踪**: 记录操作日志

**转换记录格式**（保存到notes）:
```
[2025-11-20T10:30:00] 转冻品操作 - 操作人ID:1, 转换日期:2025-11-20, 原存储位置:A区-01货架, 备注: 原料质量良好
```

**E2E测试覆盖**:
- ✅ 转冻品成功（storage_location正确更新）
- ✅ notes字段正确追加转换记录
- ✅ 原存储位置正确保存（用于撤销）
- ✅ 状态正确变更（FRESH → FROZEN）

**代码示例**:
```typescript
const convertToFrozen = async (batchId: string) => {
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/material-batches/${batchId}/convert-to-frozen`,
    {
      convertedBy: currentUser.id,
      convertedDate: new Date().toISOString().split('T')[0],
      storageLocation: '冷冻库-F区',
      notes: '原料质量良好，转冻保存',
    }
  );
  return response.data;
};
```

**详细文档**: [主文档 §3.1](./PRD-API端点完整文档-v3.0.md#31-转为冻品-convert-to-frozen) - 超详细8维度分析

---

### 7. 撤销转冻品 ⭐E2E测试验证

**端点**: `POST /api/mobile/{factoryId}/material-batches/{batchId}/undo-frozen`

**功能**: 撤销转冻品操作，恢复原状态（10分钟时间窗口保护）

**权限**: 仓库管理员、质检员

**重要性**: ⭐⭐⭐⭐⭐ E2E测试重点验证，包含时间窗口保护逻辑

**请求参数**:
```typescript
// 路径参数
factoryId: string
batchId: string

// Body参数
{
  operatorId: number,            // 操作人员ID（必填）
  reason: string                 // 撤销原因（必填，2-200字符）
}
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  message: "撤销成功",
  data: {
    id: string,
    batchNumber: string,
    status: "FRESH",               // ✅ 状态已恢复：FROZEN → FRESH
    storageLocation: string,        // ✅ 存储位置已恢复到原位置
    notes: string,                  // ✅ 包含撤销记录
    updatedAt: string
  }
}

// 错误响应
400: 批次状态不正确（不是FROZEN）
400: 转换已超过10分钟，无法撤销
400: 转换时间异常（时间戳在未来），无法撤销
400: 无法解析转换时间
403: 无权限撤销
404: 批次不存在
```

**业务逻辑核心**（E2E测试验证过，包含2个重要修复）:

1. **状态验证**: status必须是FROZEN

2. **时间窗口验证**（⭐核心逻辑，E2E测试重点）:
   - 从notes字段解析转换时间戳
   - 计算时间差：`minutesPassed = now - convertedTime`
   - ⭐**修复1**: 如果`minutesPassed < 0`（时区问题） → 返回400错误
   - ⭐**修复2**: 如果`minutesPassed > 10` → 返回400错误
   - 如果`minutesPassed ≤ 10` → 允许撤销

3. **数据恢复**:
   - 从notes解析原存储位置
   - status = FRESH
   - storage_location = 原位置
   - notes += 撤销记录

4. **审计追踪**: 记录撤销原因和时间差

**时间窗口保护逻辑**（E2E测试发现并修复的问题）:
```java
// ⭐ 关键修复：防御性检查负数时间（时区问题）
if (minutesPassed < 0) {
    throw new BusinessException(
        "转换时间异常（时间戳在未来），无法撤销。请检查系统时间设置。"
    );
}

// ⭐ 时间窗口保护：10分钟限制
if (minutesPassed > 10) {
    throw new BusinessException(
        String.format("转换已超过10分钟（已过%d分钟），无法撤销", minutesPassed)
    );
}
```

**E2E测试覆盖**:
- ✅ 10分钟内撤销成功（status和storage_location正确恢复）
- ✅ 超过10分钟撤销失败（返回400错误）
- ✅ 超时后状态保持FROZEN（未被修改）
- ✅ 时区兼容性（修复UTC vs 本地时间问题）
- ✅ 负数时间检查（修复时间戳在未来的异常）

**代码示例**:
```typescript
const undoFrozen = async (batchId: string, reason: string) => {
  try {
    const response = await apiClient.post(
      `/api/mobile/${factoryId}/material-batches/${batchId}/undo-frozen`,
      {
        operatorId: currentUser.id,
        reason,
      }
    );
    Alert.alert('成功', '已撤销转冻品操作');
    return response.data;
  } catch (error) {
    if (error.code === 400 && error.message.includes('超过10分钟')) {
      Alert.alert(
        '超过时间限制',
        '转冻品操作已超过10分钟，无法撤销。请联系管理员手动调整。'
      );
    }
    throw error;
  }
};
```

**详细文档**: [主文档 §3.2](./PRD-API端点完整文档-v3.0.md#32-撤销转冻品-undo-frozen) - 超详细8维度分析

---

### 8. 按材料类型获取批次

**端点**: `GET /api/mobile/{factoryId}/material-batches/material-type/{materialTypeId}`

**功能**: 获取指定材料类型的所有批次

**权限**: 工厂用户

**请求参数**:
```typescript
// 路径参数
factoryId: string
materialTypeId: string
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: MaterialBatchDTO[]  // 批次列表（按接收日期排序）
}
```

**业务逻辑核心**:
- 按材料类型ID筛选
- 只返回未删除的批次
- 按接收日期升序（先进先出）

---

### 9. 按状态获取批次

**端点**: `GET /api/mobile/{factoryId}/material-batches/status/{status}`

**功能**: 获取指定状态的批次

**权限**: 工厂用户

**请求参数**:
```typescript
// 路径参数
factoryId: string
status: "FRESH" | "FROZEN" | "USED" | "EXPIRED"
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: MaterialBatchDTO[]
}
```

**业务逻辑核心**:
- 按状态筛选
- 支持的状态：FRESH（新鲜）、FROZEN（冻品）、USED（已使用）、EXPIRED（已过期）

---

### 10. 获取FIFO批次（先进先出）⭐重要

**端点**: `GET /api/mobile/{factoryId}/material-batches/fifo/{materialTypeId}`

**功能**: 根据FIFO原则获取指定材料类型的批次（用于生产消耗）

**权限**: 工厂用户

**请求参数**:
```typescript
// 路径参数
factoryId: string
materialTypeId: string

// Query参数
requiredQuantity: number  // 需求数量（必填）
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: [
    {
      id: string,
      batchNumber: string,
      materialTypeName: string,
      remainingQuantity: number,
      toUseQuantity: number,     // 本批次应使用的数量
      storageLocation: string,
      expiryDate: string,
      receiveDate: string
    }
    // ... 可能多个批次（按接收日期排序）
  ]
}
```

**业务逻辑核心**（先进先出算法）:
1. 查询指定材料类型的所有可用批次（status=FRESH或FROZEN）
2. 按接收日期升序排列（最早的优先）
3. 从第一个批次开始分配，直到满足需求数量
4. 返回需要使用的批次列表及每个批次的使用量

**示例**:
- 需求：200kg猪肉
- 批次A（最早）：剩余150kg → 使用150kg
- 批次B（次早）：剩余100kg → 使用50kg
- 返回：[批次A(150kg), 批次B(50kg)]

**代码示例**:
```typescript
const getFIFOBatches = async (materialTypeId: string, requiredQuantity: number) => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/material-batches/fifo/${materialTypeId}`,
    { params: { requiredQuantity } }
  );
  return response.data;
};
```

---

### 11. 获取即将过期的批次

**端点**: `GET /api/mobile/{factoryId}/material-batches/expiring`

**功能**: 获取即将过期的批次列表（预警）

**权限**: 工厂用户

**请求参数**:
```typescript
// Query参数
days?: number  // 提前天数（默认3天）
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: [
    {
      id: string,
      batchNumber: string,
      materialTypeName: string,
      quantity: number,
      remainingQuantity: number,
      expiryDate: string,
      daysUntilExpiry: number,    // 距离过期天数
      storageLocation: string,
      status: string
    }
  ]
}
```

**业务逻辑核心**:
- 计算：`expiryDate - today ≤ days`
- 只返回未过期且未用完的批次
- 按到期日期升序排列

---

### 12. 获取已过期的批次

**端点**: `GET /api/mobile/{factoryId}/material-batches/expired`

**功能**: 获取已过期的批次列表

**权限**: 工厂用户

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: MaterialBatchDTO[]  // 已过期批次列表
}
```

**业务逻辑核心**:
- 查询：`expiryDate < today`
- 可能自动更新status为EXPIRED

---

### 13. 使用批次材料

**端点**: `POST /api/mobile/{factoryId}/material-batches/{batchId}/use`

**功能**: 使用批次材料（扣减库存）

**权限**: 生产管理员

**请求参数**:
```typescript
// 路径参数
factoryId: string
batchId: string

// Query参数
quantity: number             // 使用数量（必填，>0）
productionPlanId?: string    // 生产计划ID（可选）
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  message: "材料使用成功",
  data: {
    id: string,
    batchNumber: string,
    quantity: number,
    remainingQuantity: number,  // 剩余数量
    status: string              // 可能变为USED（如果用完）
  }
}

// 错误响应
400: 使用数量超过剩余数量
400: 批次已过期
```

**业务逻辑核心**:
1. 验证剩余数量充足
2. 扣减库存：`remainingQuantity -= quantity`
3. 如果用完（remainingQuantity = 0），更新status为USED
4. 记录使用流水

---

### 14. 调整批次数量

**端点**: `POST /api/mobile/{factoryId}/material-batches/{batchId}/adjust`

**功能**: 调整批次数量（盘点、损耗等）

**权限**: 仓库管理员

**请求参数**:
```typescript
// 路径参数
factoryId: string
batchId: string

// Query参数
newQuantity: number    // 新数量（必填，≥0）
reason: string         // 调整原因（必填）
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  message: "批次数量调整成功",
  data: {
    id: string,
    quantity: number,          // 原数量
    newQuantity: number,       // 新数量
    adjustmentAmount: number,  // 调整量（+或-）
    reason: string
  }
}
```

**业务逻辑核心**:
- 记录调整前后数量
- 记录调整原因（审计要求）
- 更新remainingQuantity

---

### 15. 更新批次状态

**端点**: `PUT /api/mobile/{factoryId}/material-batches/{batchId}/status`

**功能**: 手动更新批次状态

**权限**: 仓库管理员

**请求参数**:
```typescript
// 路径参数
factoryId: string
batchId: string

// Query参数
status: "FRESH" | "FROZEN" | "USED" | "EXPIRED"
```

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  message: "批次状态更新成功",
  data: MaterialBatchDTO
}
```

**业务逻辑核心**:
- 验证状态转换合法性
- 记录状态变更日志

---

### 16-18. 预留/释放/消耗批次材料

**端点**:
- `POST /material-batches/{batchId}/reserve` - 预留材料
- `POST /material-batches/{batchId}/release` - 释放预留
- `POST /material-batches/{batchId}/consume` - 消耗材料

**功能**: 生产计划的材料预留机制

**请求参数**:
```typescript
// Query参数
quantity: number             // 数量
productionPlanId: string     // 生产计划ID
```

**业务逻辑核心**:
- **预留**: 标记材料为某个计划预留，减少可用量但不减少总量
- **释放**: 取消预留，恢复可用量
- **消耗**: 实际使用，减少总量

---

### 19. 获取库存统计

**端点**: `GET /api/mobile/{factoryId}/material-batches/inventory/statistics`

**功能**: 获取工厂原材料库存统计

**权限**: 工厂用户

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: {
    totalBatches: number,          // 总批次数
    totalQuantity: number,         // 总数量
    freshBatches: number,          // 新鲜批次数
    frozenBatches: number,         // 冻品批次数
    usedBatches: number,           // 已使用批次数
    expiredBatches: number,        // 已过期批次数
    expiringIn3Days: number,       // 3天内过期批次数
    lowStockItems: number,         // 低库存物料数
    byMaterialType: [
      {
        materialTypeId: string,
        materialTypeName: string,
        totalQuantity: number,
        batchCount: number
      }
    ]
  }
}
```

**业务逻辑核心**:
- 汇总各状态批次数量
- 按材料类型分组统计
- 计算预警指标

---

### 20. 获取库存价值

**端点**: `GET /api/mobile/{factoryId}/material-batches/inventory/valuation`

**功能**: 计算库存总价值

**权限**: 工厂管理员、财务

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: {
    totalValue: number,            // 总价值
    freshValue: number,            // 新鲜材料价值
    frozenValue: number,           // 冻品价值
    byMaterialType: [
      {
        materialTypeName: string,
        quantity: number,
        avgPrice: number,
        totalValue: number
      }
    ]
  }
}
```

**业务逻辑核心**:
- 计算：`Σ(remainingQuantity × purchasePrice)`
- 按状态、类型分组统计

---

### 21. 获取库存预警

**端点**: `GET /api/mobile/{factoryId}/material-batches/inventory/alerts`

**功能**: 获取库存预警信息

**权限**: 仓库管理员

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: [
    {
      alertType: "LOW_STOCK" | "EXPIRING" | "EXPIRED",
      materialTypeName: string,
      batchNumber: string,
      currentQuantity: number,
      minQuantity: number,         // 最低库存
      expiryDate: string,
      daysUntilExpiry: number,
      severity: "HIGH" | "MEDIUM" | "LOW"
    }
  ]
}
```

**业务逻辑核心**:
- 低库存预警：`remainingQuantity < minQuantity`
- 过期预警：`daysUntilExpiry ≤ 3`
- 已过期预警：`expiryDate < today`

---

### 22. 获取低库存批次

**端点**: `GET /api/mobile/{factoryId}/material-batches/inventory/low-stock`

**功能**: 获取低库存批次列表

**权限**: 仓库管理员

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: MaterialBatchDTO[]
}
```

---

### 23-24. 批量导入/导出

**端点**:
- `POST /material-batches/batch-import` - 批量导入
- `POST /material-batches/batch-export` - 批量导出

**功能**: Excel批量操作

**导入请求参数**:
```typescript
// Body参数 (multipart/form-data)
file: File  // Excel文件(.xlsx)
```

**导出请求参数**:
```typescript
// Query参数
status?: string
startDate?: string
endDate?: string
```

**业务逻辑核心**:
- **导入**: 解析Excel，批量创建批次
- **导出**: 生成Excel文件，包含所有批次信息

---

### 25. 获取批次审计日志

**端点**: `GET /api/mobile/{factoryId}/material-batches/audit-log/{batchId}`

**功能**: 获取批次所有操作历史

**权限**: 工厂管理员

**响应结构**:
```typescript
// 成功 (200 OK)
{
  code: 200,
  data: [
    {
      timestamp: string,
      operation: string,         // CREATED/UPDATED/CONVERTED/USED等
      operator: string,          // 操作人
      details: string,           // 操作详情
      changes: {                 // 变更内容
        field: string,
        oldValue: any,
        newValue: any
      }[]
    }
  ]
}
```

**业务逻辑核心**:
- 记录所有操作（创建、更新、转换、使用等）
- 记录变更前后的值
- 符合食品安全追溯要求

---

## 📊 状态机图

### 原材料批次状态转换

```
      创建批次
         ↓
      [FRESH]  ←─────┐
         ↓            │
    convert()   undoFrozen()
         ↓         (10分钟内)
      [FROZEN] ──────┘
         ↓
      use()
         ↓
      [USED]

      过期检查
         ↓
      [EXPIRED]
```

---

## ⭐ E2E测试验证报告

### Material Batch E2E测试结果：12/12通过 ✅

**测试套件**: `test_e2e_material_batch_flow.sh`

**测试覆盖**:

| 测试场景 | 状态 | 验证点 |
|---------|------|--------|
| 1. 创建原材料批次 | ✅ 通过 | 批次创建成功，初始状态为FRESH |
| 2. 转为冻品 | ✅ 通过 | status变更为FROZEN |
| 3. 存储位置更新 | ✅ 通过 | storage_location更新为"冷冻库-F区" |
| 4. notes记录保存 | ✅ 通过 | 包含原存储位置"A区-01货架" |
| 5. 10分钟内撤销成功 | ✅ 通过 | status恢复为FRESH |
| 6. 存储位置恢复 | ✅ 通过 | storage_location恢复为"A区-01货架" |
| 7. 再次转为冻品 | ✅ 通过 | 为超时测试准备 |
| 8. 修改转换时间为11分钟前 | ✅ 通过 | 模拟超时场景 |
| 9. 超时撤销被拒绝 | ✅ 通过 | 返回400错误 |
| 10. 超时后状态未变化 | ✅ 通过 | status保持FROZEN |
| 11. 时区兼容性 | ✅ 通过 | 使用本地时间（非UTC） |
| 12. 负数时间检查 | ✅ 通过 | 防御性验证通过 |

**关键修复点**:

1. **P2-1修复: storage_location恢复逻辑** ✅
   - 问题：撤销转冻品时未恢复原存储位置
   - 修复：从notes字段解析并恢复原位置
   - 验证：E2E测试确认恢复正确

2. **修复7: 超时保护 - 负数时间检查** ✅
   - 问题：时区差异导致时间计算为负数
   - 修复：添加`if (minutesPassed < 0)`防御性检查
   - 验证：E2E测试确认异常被正确捕获

3. **修复7: 测试脚本时间生成** ✅
   - 问题：测试使用UTC时间，后端使用本地时间
   - 修复：移除`date -u`的`-u`参数
   - 验证：E2E测试时间计算正确

**测试日志示例**:
```bash
cd backend-java
./test_e2e_material_batch_flow.sh

# 输出
=========================================
原材料批次管理 E2E测试
=========================================

📋 步骤 1.1: 准备测试数据 - 重置批次为FRESH状态
✅ PASS: 初始状态准备

📋 步骤 2.1: 调用API - 转为冻品
✅ PASS: API响应码 (200)
✅ PASS: 数据库状态验证 (FROZEN)
✅ PASS: 存储位置更新 (冷冻库-F区)
✅ PASS: notes字段包含转冻品记录

📋 步骤 3.1: 10分钟内撤销转冻品（应该成功）
✅ PASS: API响应码 (200)
✅ PASS: 数据库状态恢复 (FRESH)
✅ PASS: 存储位置恢复 (A区-01货架)

📋 步骤 4.3: 尝试撤销（应该失败 - 超过10分钟）
✅ PASS: 超时撤销正确被拒绝 (响应码: 400)
✅ PASS: 超时后状态未变化（仍为FROZEN）

=========================================
测试总结
=========================================
总测试数: 12
通过: 12
失败: 0

🎉 所有测试通过！
```

---

## 🔗 相关文档

- [主文档 §3.1 - 转为冻品（超详细）](./PRD-API端点完整文档-v3.0.md#31-转为冻品-convert-to-frozen)
- [主文档 §3.2 - 撤销转冻品（超详细）](./PRD-API端点完整文档-v3.0.md#32-撤销转冻品-undo-frozen)
- [API索引文档](./PRD-API索引文档-v1.0.md)
- [ProcessingController API](./PRD-API-ProcessingController.md)
- [EquipmentController API](./PRD-API-EquipmentController.md) (待创建)
- [E2E测试完整报告](../backend-java/COMPLETE_FIX_FINAL_REPORT.md)

---

**文档版本**: v1.0
**最后更新**: 2025-11-20
**维护者**: Cretas Development Team
**E2E测试**: ✅ 12/12通过（100%）
