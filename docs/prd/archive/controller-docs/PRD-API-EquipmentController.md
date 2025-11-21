# PRD-API-EquipmentController

**文档版本**: v1.0
**创建日期**: 2025-11-20
**Controller**: EquipmentController + Equipment Alerts (MobileController)
**端点数量**: 25个设备管理端点 + 5个设备告警端点
**E2E测试覆盖**: ✅ 20/20测试通过 (Equipment Alerts E2E)
**文档类型**: Controller分文档（中等详细5维度分析）

---

## 📋 目录

- [概述](#概述)
- [设备管理端点](#设备管理端点)
  - [1. CRUD操作](#1-crud操作)
  - [2. 查询与搜索](#2-查询与搜索)
  - [3. 状态管理](#3-状态管理)
  - [4. 维护管理](#4-维护管理)
  - [5. 统计与报告](#5-统计与报告)
  - [6. 批量操作](#6-批量操作)
- [设备告警端点](#设备告警端点)
  - [7. 告警管理 (E2E验证)](#7-告警管理-e2e验证)
- [E2E测试验证](#e2e测试验证)
- [核心业务逻辑](#核心业务逻辑)
- [状态机与流程图](#状态机与流程图)
- [数据模型](#数据模型)

---

## 概述

### Controller信息

| 属性 | 值 |
|-----|-----|
| **Controller类** | `EquipmentController.java` + `MobileController.java`(告警部分) |
| **基础路径** | `/api/mobile/{factoryId}/equipment` |
| **告警路径** | `/api/mobile/{factoryId}/equipment-alerts` |
| **认证要求** | JWT Bearer Token |
| **主要功能** | 设备全生命周期管理、设备告警管理 |
| **业务模块** | 设备管理 + 告警监控 |

### 功能分类

**设备管理** (25端点):
- CRUD操作 (4个): 创建、更新、删除、查询详情
- 查询与搜索 (5个): 列表分页、按状态、按类型、搜索、总体统计
- 状态管理 (4个): 更新状态、启动、停止、报废
- 维护管理 (4个): 记录维护、需要维护列表、保修到期、维护历史
- 统计与报告 (5个): 设备统计、使用历史、效率报告、OEE计算、折旧价值
- 批量操作 (3个): Excel导入、导出、下载模板

**设备告警** (5端点, E2E验证✅):
- 告警查询 (2个): 获取列表(支持状态筛选)、告警统计
- 告警处理 (3个): 确认告警、解决告警、忽略告警

### E2E测试状态

| 测试套件 | 状态 | 通过率 | 修复内容 |
|---------|------|--------|---------|
| Equipment Alerts E2E | ✅ 完美通过 | 20/20 (100%) | P3-1: currentPage字段, Fix 8: ACTIVE状态筛选 |

---

## 设备管理端点

### 1. CRUD操作

#### 1.1 创建设备

**端点**: `POST /api/mobile/{factoryId}/equipment`
**功能**: 创建新设备
**权限**: 工厂管理员
**超详细版本**: 主文档暂无 (待添加)

##### 请求参数

**Headers**:
```typescript
{
  "Authorization": "Bearer <access_token>"
}
```

**Body** (`CreateEquipmentRequest`):
```typescript
{
  name: string,                    // 设备名称（必填）
  equipmentNumber: string,         // 设备编号（必填，工厂内唯一）
  type: string,                    // 设备类型（必填）
  model?: string,                  // 设备型号
  manufacturer?: string,           // 制造商
  purchaseDate?: string,           // 购买日期 (ISO 8601)
  purchasePrice?: number,          // 购买价格
  warrantyExpiry?: string,         // 保修到期日期
  maintenanceInterval?: number,    // 维护间隔（天）
  depreciationRate?: number,       // 折旧率（年化百分比）
  location?: string,               // 位置
  specifications?: string,         // 技术规格（JSON字符串）
  notes?: string                   // 备注
}
```

**参数验证**:
- `name`: 1-100字符
- `equipmentNumber`: 1-50字符，工厂内唯一
- `purchasePrice`: ≥0
- `depreciationRate`: 0-100

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "设备创建成功",
  "data": {
    "id": "EQ-001",
    "name": "包装机A1",
    "equipmentNumber": "PKG-A1-2024-001",
    "type": "包装设备",
    "status": "idle",              // 初始状态: idle
    "purchaseDate": "2024-01-15",
    "totalRunningHours": 0,
    "lastMaintenanceDate": null,
    "createdAt": "2025-11-20T10:00:00",
    "createdBy": 1
  }
}
```

**错误响应**:
- `400`: 参数验证失败、设备编号已存在
- `401`: 认证失败
- `403`: 权限不足

##### 业务逻辑核心

1. **验证输入**: 检查必填字段、格式、工厂内设备编号唯一性
2. **设置初始状态**: status = "idle", totalRunningHours = 0
3. **保存设备记录**: 插入数据库，记录创建人和时间
4. **返回设备DTO**: 完整的设备信息

##### 代码示例

**TypeScript (React Native)**:
```typescript
import { apiClient } from '@/services/api/apiClient';

const createEquipment = async (factoryId: string, data: CreateEquipmentRequest) => {
  const response = await apiClient.post<ApiResponse<EquipmentDTO>>(
    `/api/mobile/${factoryId}/equipment`,
    data
  );
  return response.data;
};

// 使用示例
const newEquipment = await createEquipment('CRETAS_2024_001', {
  name: '包装机A1',
  equipmentNumber: 'PKG-A1-2024-001',
  type: '包装设备',
  purchaseDate: '2024-01-15',
  purchasePrice: 150000,
  warrantyExpiry: '2027-01-15',
  maintenanceInterval: 90,
  depreciationRate: 15
});
```

---

#### 1.2 更新设备

**端点**: `PUT /api/mobile/{factoryId}/equipment/{equipmentId}`
**功能**: 更新设备信息
**权限**: 工厂管理员

##### 请求参数

**Path Parameters**:
- `factoryId`: string (工厂ID)
- `equipmentId`: string (设备ID)

**Body**: 同创建设备的 `CreateEquipmentRequest`

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "设备更新成功",
  "data": { /* EquipmentDTO */ }
}
```

##### 业务逻辑核心

1. **验证设备存在**: 根据factoryId和equipmentId查询
2. **更新字段**: 仅更新请求中提供的字段
3. **保持状态字段**: 不修改status、totalRunningHours等运行时字段
4. **记录更新时间**: updatedAt = now()

##### 代码示例

```typescript
const updateEquipment = async (
  factoryId: string,
  equipmentId: string,
  data: CreateEquipmentRequest
) => {
  const response = await apiClient.put<ApiResponse<EquipmentDTO>>(
    `/api/mobile/${factoryId}/equipment/${equipmentId}`,
    data
  );
  return response.data;
};
```

---

#### 1.3 删除设备

**端点**: `DELETE /api/mobile/{factoryId}/equipment/{equipmentId}`
**功能**: 删除设备
**权限**: 工厂管理员
**注意**: 软删除（逻辑删除）

##### 请求参数

**Path Parameters**:
- `factoryId`: string
- `equipmentId`: string

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "设备删除成功",
  "data": null
}
```

##### 业务逻辑核心

1. **验证设备存在**: 检查设备是否属于该工厂
2. **检查使用状态**: 如果设备status=running，拒绝删除
3. **软删除**: 设置deleted=true, deletedAt=now()
4. **保留历史记录**: 维护历史、使用历史仍可查询

##### 代码示例

```typescript
const deleteEquipment = async (factoryId: string, equipmentId: string) => {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/api/mobile/${factoryId}/equipment/${equipmentId}`
  );
  return response.data;
};
```

---

#### 1.4 获取设备详情

**端点**: `GET /api/mobile/{factoryId}/equipment/{equipmentId}`
**功能**: 获取单个设备详细信息
**权限**: 工厂所有角色

##### 请求参数

**Path Parameters**:
- `factoryId`: string
- `equipmentId`: string

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "id": "EQ-001",
    "name": "包装机A1",
    "equipmentNumber": "PKG-A1-2024-001",
    "type": "包装设备",
    "status": "running",
    "purchaseDate": "2024-01-15",
    "purchasePrice": 150000,
    "totalRunningHours": 1250,
    "lastMaintenanceDate": "2025-10-15",
    "nextMaintenanceDate": "2026-01-13",  // 基于maintenanceInterval计算
    "depreciatedValue": 127500,           // 基于折旧率计算
    "createdAt": "2024-01-20T09:00:00",
    "updatedAt": "2025-11-15T14:30:00"
  }
}
```

##### 业务逻辑核心

1. **查询设备**: 根据factoryId和equipmentId查询
2. **计算字段**: nextMaintenanceDate, depreciatedValue
3. **返回完整信息**: 包括计算字段

---

### 2. 查询与搜索

#### 2.1 获取设备列表（分页）

**端点**: `GET /api/mobile/{factoryId}/equipment`
**功能**: 分页获取工厂所有设备
**权限**: 工厂所有角色

##### 请求参数

**Query Parameters**:
```typescript
{
  page?: number,        // 页码（从1开始，默认1）
  size?: number,        // 每页数量（默认10）
  sortBy?: string,      // 排序字段（默认createdAt）
  sortOrder?: string    // 排序方向（asc/desc，默认desc）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "content": [
      { /* EquipmentDTO */ },
      { /* EquipmentDTO */ }
    ],
    "totalElements": 48,
    "totalPages": 5,
    "currentPage": 1,
    "pageSize": 10,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

##### 业务逻辑核心

1. **构建分页查询**: PageRequest(page-1, size, Sort)
2. **工厂过滤**: WHERE factoryId = ?
3. **软删除过滤**: WHERE deleted = false
4. **分页返回**: PageResponse包含完整分页信息

##### 代码示例

```typescript
const getEquipmentList = async (
  factoryId: string,
  params: { page?: number; size?: number }
) => {
  const response = await apiClient.get<ApiResponse<PageResponse<EquipmentDTO>>>(
    `/api/mobile/${factoryId}/equipment`,
    { params }
  );
  return response.data;
};
```

---

#### 2.2 按状态获取设备

**端点**: `GET /api/mobile/{factoryId}/equipment/status/{status}`
**功能**: 获取指定状态的所有设备
**权限**: 工厂所有角色

##### 请求参数

**Path Parameters**:
- `status`: string (设备状态: idle / running / maintenance / scrapped)

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": [
    {
      "id": "EQ-001",
      "name": "包装机A1",
      "status": "running",
      "totalRunningHours": 1250
    },
    {
      "id": "EQ-003",
      "name": "切割机B2",
      "status": "running",
      "totalRunningHours": 890
    }
  ]
}
```

##### 业务逻辑核心

1. **状态验证**: 检查status是否为有效值 (idle/running/maintenance/scrapped)
2. **查询过滤**: WHERE factoryId = ? AND status = ? AND deleted = false
3. **返回列表**: 不分页，返回全部匹配设备

##### 代码示例

```typescript
const getEquipmentByStatus = async (factoryId: string, status: string) => {
  const response = await apiClient.get<ApiResponse<EquipmentDTO[]>>(
    `/api/mobile/${factoryId}/equipment/status/${status}`
  );
  return response.data;
};

// 使用示例
const runningEquipment = await getEquipmentByStatus('CRETAS_2024_001', 'running');
```

---

#### 2.3 按类型获取设备

**端点**: `GET /api/mobile/{factoryId}/equipment/type/{type}`
**功能**: 获取指定类型的所有设备
**权限**: 工厂所有角色

##### 请求参数

**Path Parameters**:
- `type`: string (设备类型，如"包装设备"、"切割设备")

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": [
    { /* EquipmentDTO */ },
    { /* EquipmentDTO */ }
  ]
}
```

##### 业务逻辑核心

1. **类型过滤**: WHERE factoryId = ? AND type = ?
2. **排序**: ORDER BY equipmentNumber ASC
3. **返回列表**: 同类型所有设备

---

#### 2.4 搜索设备

**端点**: `GET /api/mobile/{factoryId}/equipment/search`
**功能**: 按关键词搜索设备（名称、编号、型号）
**权限**: 工厂所有角色

##### 请求参数

**Query Parameters**:
```typescript
{
  keyword: string  // 搜索关键词（必填）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": [
    { /* EquipmentDTO */ }
  ]
}
```

##### 业务逻辑核心

1. **模糊搜索**: WHERE (name LIKE %keyword% OR equipmentNumber LIKE %keyword% OR model LIKE %keyword%)
2. **工厂过滤**: AND factoryId = ?
3. **软删除过滤**: AND deleted = false
4. **相关性排序**: 名称精确匹配优先

##### 代码示例

```typescript
const searchEquipment = async (factoryId: string, keyword: string) => {
  const response = await apiClient.get<ApiResponse<EquipmentDTO[]>>(
    `/api/mobile/${factoryId}/equipment/search`,
    { params: { keyword } }
  );
  return response.data;
};
```

---

#### 2.5 获取工厂设备总体统计

**端点**: `GET /api/mobile/{factoryId}/equipment/overall-statistics`
**功能**: 获取工厂所有设备的汇总统计
**权限**: 工厂管理员、生产管理员

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "totalEquipment": 48,
    "statusBreakdown": {
      "idle": 12,
      "running": 28,
      "maintenance": 6,
      "scrapped": 2
    },
    "typeBreakdown": {
      "包装设备": 15,
      "切割设备": 10,
      "清洗设备": 8,
      "其他": 15
    },
    "totalRunningHours": 45680,
    "averageUtilization": 72.5,     // 平均利用率 (%)
    "equipmentNeedingMaintenance": 4,
    "warrantyExpiringSoon": 3,       // 30天内到期
    "totalValue": 8500000,           // 总购买价值
    "totalDepreciatedValue": 6800000 // 总折旧后价值
  }
}
```

##### 业务逻辑核心

1. **聚合查询**: 统计设备总数、按状态分组、按类型分组
2. **计算指标**: 总运行时长、平均利用率
3. **预警统计**: 需要维护设备数、保修即将到期数
4. **价值计算**: 总购买价值、总折旧后价值

---

### 3. 状态管理

#### 3.1 更新设备状态

**端点**: `PUT /api/mobile/{factoryId}/equipment/{equipmentId}/status`
**功能**: 手动更新设备状态
**权限**: 工厂管理员、生产管理员

##### 请求参数

**Path Parameters**:
- `equipmentId`: string

**Query Parameters**:
```typescript
{
  status: string  // 目标状态 (idle / running / maintenance / scrapped)
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "设备状态更新成功",
  "data": {
    "id": "EQ-001",
    "status": "maintenance",
    "updatedAt": "2025-11-20T14:30:00"
  }
}
```

##### 业务逻辑核心

1. **状态验证**: 检查目标状态有效性
2. **状态转换验证**: 检查状态转换是否合法（如scrapped不可恢复）
3. **更新状态**: status = 新状态, updatedAt = now()
4. **记录日志**: 状态变更历史

---

#### 3.2 启动设备

**端点**: `POST /api/mobile/{factoryId}/equipment/{equipmentId}/start`
**功能**: 启动设备（idle → running）
**权限**: 工厂管理员、生产管理员、操作员

##### 请求参数

**Path Parameters**:
- `equipmentId`: string

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "设备启动成功",
  "data": {
    "id": "EQ-001",
    "status": "running",
    "lastStartedAt": "2025-11-20T08:00:00"
  }
}
```

##### 业务逻辑核心

1. **状态检查**: 当前status必须为idle
2. **更新状态**: status = "running"
3. **记录启动时间**: lastStartedAt = now()
4. **更新使用历史**: 插入使用记录(startedAt, operatorId)

##### 代码示例

```typescript
const startEquipment = async (factoryId: string, equipmentId: string) => {
  const response = await apiClient.post<ApiResponse<EquipmentDTO>>(
    `/api/mobile/${factoryId}/equipment/${equipmentId}/start`
  );
  return response.data;
};
```

---

#### 3.3 停止设备

**端点**: `POST /api/mobile/{factoryId}/equipment/{equipmentId}/stop`
**功能**: 停止设备（running → idle）
**权限**: 工厂管理员、生产管理员、操作员

##### 请求参数

**Path Parameters**:
- `equipmentId`: string

**Query Parameters**:
```typescript
{
  runningHours?: number  // 本次运行小时数（可选，用于累加）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "设备停止成功",
  "data": {
    "id": "EQ-001",
    "status": "idle",
    "totalRunningHours": 1258,  // 累加后的总运行时长
    "lastStoppedAt": "2025-11-20T17:00:00"
  }
}
```

##### 业务逻辑核心

1. **状态检查**: 当前status必须为running
2. **更新状态**: status = "idle"
3. **累加运行时长**: totalRunningHours += runningHours (如果提供)
4. **更新使用历史**: 更新使用记录(stoppedAt, duration)
5. **维护提醒**: 如果距上次维护超过maintenanceInterval天，生成提醒

##### 代码示例

```typescript
const stopEquipment = async (
  factoryId: string,
  equipmentId: string,
  runningHours?: number
) => {
  const response = await apiClient.post<ApiResponse<EquipmentDTO>>(
    `/api/mobile/${factoryId}/equipment/${equipmentId}/stop`,
    null,
    { params: { runningHours } }
  );
  return response.data;
};
```

---

#### 3.4 报废设备

**端点**: `POST /api/mobile/{factoryId}/equipment/{equipmentId}/scrap`
**功能**: 报废设备（任意状态 → scrapped，不可逆）
**权限**: 工厂管理员

##### 请求参数

**Path Parameters**:
- `equipmentId`: string

**Query Parameters**:
```typescript
{
  reason: string  // 报废原因（必填）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "设备报废成功",
  "data": {
    "id": "EQ-001",
    "status": "scrapped",
    "scrappedAt": "2025-11-20T15:00:00",
    "scrappedReason": "设备严重故障，维修成本过高",
    "depreciatedValue": 0  // 报废后价值为0
  }
}
```

##### 业务逻辑核心

1. **状态检查**: 当前status不能已经是scrapped
2. **更新状态**: status = "scrapped", scrappedAt = now()
3. **记录原因**: scrappedReason = reason
4. **价值清零**: depreciatedValue = 0
5. **不可逆**: 报废后不能恢复到其他状态

##### 代码示例

```typescript
const scrapEquipment = async (
  factoryId: string,
  equipmentId: string,
  reason: string
) => {
  const response = await apiClient.post<ApiResponse<EquipmentDTO>>(
    `/api/mobile/${factoryId}/equipment/${equipmentId}/scrap`,
    null,
    { params: { reason } }
  );
  return response.data;
};
```

---

### 4. 维护管理

#### 4.1 记录设备维护

**端点**: `POST /api/mobile/{factoryId}/equipment/{equipmentId}/maintenance`
**功能**: 记录设备维护操作
**权限**: 工厂管理员、设备管理员

##### 请求参数

**Path Parameters**:
- `equipmentId`: string

**Query Parameters**:
```typescript
{
  maintenanceDate: string,  // 维护日期 (ISO 8601, 必填)
  cost?: number,            // 维护费用
  description?: string      // 维护描述
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "维护记录成功",
  "data": {
    "id": "EQ-001",
    "lastMaintenanceDate": "2025-11-20",
    "nextMaintenanceDate": "2026-02-18",  // 基于maintenanceInterval计算
    "totalMaintenanceCost": 15800,        // 累计维护费用
    "maintenanceCount": 12                // 维护次数
  }
}
```

##### 业务逻辑核心

1. **验证设备存在**: 检查设备是否属于该工厂
2. **插入维护记录**: equipment_maintenance表 (date, cost, description)
3. **更新设备**: lastMaintenanceDate = maintenanceDate
4. **计算下次维护**: nextMaintenanceDate = maintenanceDate + maintenanceInterval天
5. **累计费用**: totalMaintenanceCost += cost

##### 代码示例

```typescript
const recordMaintenance = async (
  factoryId: string,
  equipmentId: string,
  data: {
    maintenanceDate: string;
    cost?: number;
    description?: string;
  }
) => {
  const response = await apiClient.post<ApiResponse<EquipmentDTO>>(
    `/api/mobile/${factoryId}/equipment/${equipmentId}/maintenance`,
    null,
    { params: data }
  );
  return response.data;
};
```

---

#### 4.2 获取需要维护的设备

**端点**: `GET /api/mobile/{factoryId}/equipment/needing-maintenance`
**功能**: 获取已到维护周期的设备列表
**权限**: 工厂管理员、设备管理员

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": [
    {
      "id": "EQ-003",
      "name": "切割机B2",
      "lastMaintenanceDate": "2025-08-15",
      "nextMaintenanceDate": "2025-11-13",  // 已过期7天
      "daysOverdue": 7
    },
    {
      "id": "EQ-007",
      "name": "清洗机C1",
      "lastMaintenanceDate": "2025-09-01",
      "nextMaintenanceDate": "2025-11-20",  // 今天到期
      "daysOverdue": 0
    }
  ]
}
```

##### 业务逻辑核心

1. **计算到期设备**: WHERE nextMaintenanceDate <= today()
2. **工厂过滤**: AND factoryId = ?
3. **排序**: ORDER BY daysOverdue DESC (最紧急的排前面)
4. **计算逾期天数**: daysOverdue = today() - nextMaintenanceDate

---

#### 4.3 获取保修即将到期的设备

**端点**: `GET /api/mobile/{factoryId}/equipment/expiring-warranty`
**功能**: 获取保修即将到期的设备（默认30天内）
**权限**: 工厂管理员、设备管理员

##### 请求参数

**Query Parameters**:
```typescript
{
  daysAhead?: number  // 提前天数（默认30）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": [
    {
      "id": "EQ-005",
      "name": "包装机A3",
      "warrantyExpiry": "2025-12-15",
      "daysUntilExpiry": 25,
      "manufacturer": "XYZ Corp"
    }
  ]
}
```

##### 业务逻辑核心

1. **计算即将到期**: WHERE warrantyExpiry BETWEEN today() AND today() + daysAhead
2. **工厂过滤**: AND factoryId = ?
3. **排序**: ORDER BY warrantyExpiry ASC
4. **计算剩余天数**: daysUntilExpiry = warrantyExpiry - today()

---

#### 4.4 获取设备维护历史

**端点**: `GET /api/mobile/{factoryId}/equipment/{equipmentId}/maintenance-history`
**功能**: 获取设备的所有维护记录
**权限**: 工厂所有角色

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": [
    {
      "id": 1,
      "equipmentId": "EQ-001",
      "maintenanceDate": "2025-11-15",
      "cost": 1200,
      "description": "更换传送带，清洁内部部件",
      "performedBy": 5,
      "performedByName": "张工程师"
    },
    {
      "id": 2,
      "equipmentId": "EQ-001",
      "maintenanceDate": "2025-08-20",
      "cost": 800,
      "description": "常规保养，润滑轴承",
      "performedBy": 5,
      "performedByName": "张工程师"
    }
  ]
}
```

##### 业务逻辑核心

1. **查询维护记录**: 从equipment_maintenance表查询
2. **设备过滤**: WHERE equipmentId = ?
3. **关联用户**: JOIN users表获取执行人姓名
4. **排序**: ORDER BY maintenanceDate DESC (最新的在前)

---

### 5. 统计与报告

#### 5.1 获取设备统计信息

**端点**: `GET /api/mobile/{factoryId}/equipment/{equipmentId}/statistics`
**功能**: 获取单个设备的统计信息
**权限**: 工厂所有角色

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "equipmentId": "EQ-001",
    "totalRunningHours": 1250,
    "averageDailyUsage": 8.5,        // 小时/天
    "utilizationRate": 72.5,          // 利用率 (%)
    "maintenanceCount": 12,
    "totalMaintenanceCost": 15800,
    "averageMaintenanceCost": 1316.67,
    "daysSincePurchase": 305,
    "daysUntilWarrantyExpiry": 425,
    "currentDepreciatedValue": 127500
  }
}
```

##### 业务逻辑核心

1. **基础统计**: totalRunningHours, maintenanceCount
2. **计算指标**:
   - `averageDailyUsage = totalRunningHours / daysSincePurchase`
   - `utilizationRate = (totalRunningHours / (daysSincePurchase * 24)) * 100`
3. **维护统计**: totalMaintenanceCost, averageMaintenanceCost
4. **时间计算**: daysSincePurchase, daysUntilWarrantyExpiry

---

#### 5.2 获取设备使用历史

**端点**: `GET /api/mobile/{factoryId}/equipment/{equipmentId}/usage-history`
**功能**: 获取设备的使用记录（启动/停止历史）
**权限**: 工厂所有角色

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": [
    {
      "id": 1,
      "equipmentId": "EQ-001",
      "startedAt": "2025-11-20T08:00:00",
      "stoppedAt": "2025-11-20T17:00:00",
      "duration": 9,                  // 小时
      "operatorId": 10,
      "operatorName": "李操作员"
    },
    {
      "id": 2,
      "equipmentId": "EQ-001",
      "startedAt": "2025-11-19T09:00:00",
      "stoppedAt": "2025-11-19T16:30:00",
      "duration": 7.5,
      "operatorId": 10,
      "operatorName": "李操作员"
    }
  ]
}
```

##### 业务逻辑核心

1. **查询使用记录**: 从equipment_usage表查询
2. **设备过滤**: WHERE equipmentId = ?
3. **关联用户**: JOIN users表获取操作员姓名
4. **计算时长**: duration = stoppedAt - startedAt (小时)
5. **排序**: ORDER BY startedAt DESC

---

#### 5.3 获取设备效率报告

**端点**: `GET /api/mobile/{factoryId}/equipment/{equipmentId}/efficiency-report`
**功能**: 获取指定时间范围内的设备效率报告
**权限**: 工厂管理员、生产管理员

##### 请求参数

**Query Parameters**:
```typescript
{
  startDate: string,  // 开始日期 (ISO 8601, 必填)
  endDate: string     // 结束日期 (ISO 8601, 必填)
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "equipmentId": "EQ-001",
    "period": {
      "startDate": "2025-11-01",
      "endDate": "2025-11-20",
      "totalDays": 20
    },
    "usage": {
      "totalRunningHours": 145,
      "averageDailyHours": 7.25,
      "utilizationRate": 60.4,     // (145 / (20*12)) * 100, 假设每天12小时工作
      "peakUsageDays": ["2025-11-05", "2025-11-12"]  // 使用时长最高的日期
    },
    "maintenance": {
      "maintenanceEvents": 1,
      "totalDowntime": 4,          // 维护导致的停机时间（小时）
      "downtimeRate": 2.76         // (4 / 145) * 100
    },
    "productivity": {
      "plannedProductionTime": 240,  // 计划生产时间（小时）
      "actualRunningTime": 145,
      "availability": 60.4,           // (145 / 240) * 100
      "performance": 92.5,            // 实际产出 / 理论产出 * 100
      "quality": 98.2,                // 合格品 / 总产出 * 100
      "oee": 54.8                     // Availability * Performance * Quality
    }
  }
}
```

##### 业务逻辑核心

1. **查询使用记录**: 时间范围内的所有usage记录
2. **统计运行时长**: SUM(duration)
3. **计算利用率**: totalRunningHours / (totalDays * 工作小时)
4. **查询维护记录**: 时间范围内的maintenance事件
5. **计算OEE**: Availability × Performance × Quality

---

#### 5.4 计算设备OEE（整体设备效率）

**端点**: `GET /api/mobile/{factoryId}/equipment/{equipmentId}/oee`
**功能**: 计算设备的OEE（Overall Equipment Effectiveness）
**权限**: 工厂管理员、生产管理员

##### 请求参数

**Query Parameters**:
```typescript
{
  startDate: string,  // 开始日期 (ISO 8601)
  endDate: string     // 结束日期 (ISO 8601)
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": 54.8  // OEE百分比
}
```

##### 业务逻辑核心

**OEE计算公式**:
```
OEE = Availability × Performance × Quality

其中:
- Availability (可用率) = (运行时间 / 计划生产时间) × 100%
- Performance (表现率) = (实际产量 / 理论产量) × 100%
- Quality (质量率) = (合格品数量 / 总产量) × 100%
```

**计算步骤**:
1. **可用率**:
   - 计划生产时间 = endDate - startDate (排除非工作时间)
   - 运行时间 = SUM(usage.duration) (时间范围内)
   - Availability = (运行时间 / 计划生产时间) × 100

2. **表现率**:
   - 理论产量 = 运行时间 × 理论产能 (从设备规格获取)
   - 实际产量 = SUM(processing_batches.actualQuantity) (使用该设备的批次)
   - Performance = (实际产量 / 理论产量) × 100

3. **质量率**:
   - 合格品数量 = SUM(processing_batches.passedQuantity)
   - Quality = (合格品数量 / 实际产量) × 100

4. **OEE**: Availability × Performance × Quality

##### 代码示例

```typescript
const calculateOEE = async (
  factoryId: string,
  equipmentId: string,
  startDate: string,
  endDate: string
) => {
  const response = await apiClient.get<ApiResponse<number>>(
    `/api/mobile/${factoryId}/equipment/${equipmentId}/oee`,
    { params: { startDate, endDate } }
  );
  return response.data;
};

// 使用示例
const oee = await calculateOEE(
  'CRETAS_2024_001',
  'EQ-001',
  '2025-11-01',
  '2025-11-20'
);
console.log(`设备OEE: ${oee}%`);
```

---

#### 5.5 计算设备折旧后价值

**端点**: `GET /api/mobile/{factoryId}/equipment/{equipmentId}/depreciated-value`
**功能**: 计算设备当前折旧后价值
**权限**: 工厂管理员、财务

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": 127500  // 折旧后价值（元）
}
```

##### 业务逻辑核心

**折旧计算公式** (直线折旧法):
```
折旧后价值 = 购买价格 × (1 - 折旧率 × 使用年数)

其中:
- 购买价格: purchasePrice
- 折旧率: depreciationRate (年化百分比, 如15%)
- 使用年数: (today() - purchaseDate) / 365
```

**计算步骤**:
1. **计算使用年数**: yearsUsed = (today() - purchaseDate) / 365
2. **应用折旧率**: depreciatedValue = purchasePrice × (1 - depreciationRate × yearsUsed)
3. **边界处理**: 如果depreciatedValue < 0，则返回0
4. **报废设备**: 如果status = "scrapped"，直接返回0

##### 代码示例

```typescript
const getDepreciatedValue = async (factoryId: string, equipmentId: string) => {
  const response = await apiClient.get<ApiResponse<number>>(
    `/api/mobile/${factoryId}/equipment/${equipmentId}/depreciated-value`
  );
  return response.data;
};
```

---

### 6. 批量操作

#### 6.1 从Excel文件批量导入设备

**端点**: `POST /api/mobile/{factoryId}/equipment/import`
**功能**: 批量导入设备（Excel格式）
**权限**: 工厂管理员

##### 请求参数

**Headers**:
```typescript
{
  "Content-Type": "multipart/form-data"
}
```

**Body** (FormData):
```typescript
{
  file: File  // Excel文件 (.xlsx, 最大10MB)
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "导入成功",
  "data": {
    "totalRows": 50,
    "successCount": 48,
    "failureCount": 2,
    "isFullSuccess": false,
    "successRecords": [
      { /* EquipmentDTO */ }
    ],
    "failureRecords": [
      {
        "rowNumber": 15,
        "data": { /* 原始数据 */ },
        "errorMessage": "设备编号已存在: PKG-A1-2024-001"
      },
      {
        "rowNumber": 32,
        "data": { /* 原始数据 */ },
        "errorMessage": "购买价格必须大于0"
      }
    ]
  }
}
```

##### 业务逻辑核心

1. **验证文件**: 检查格式(.xlsx)、大小(≤10MB)
2. **解析Excel**: 使用Apache POI解析
3. **验证数据**: 每行数据进行验证（必填字段、格式、唯一性）
4. **批量插入**: 成功的记录批量插入
5. **事务处理**: 每行独立事务，失败不影响其他行
6. **返回结果**: 成功和失败记录分别列出

**Excel格式要求**:
| 设备名称 | 设备编号 | 设备类型 | 型号 | 制造商 | 购买日期 | 购买价格 | 保修到期 | 维护间隔(天) | 折旧率(%) | 位置 |
|---------|---------|---------|------|--------|---------|---------|---------|------------|----------|------|
| 包装机A1 | PKG-A1-001 | 包装设备 | PM-300 | XYZ Corp | 2024-01-15 | 150000 | 2027-01-15 | 90 | 15 | 车间A |

##### 代码示例

```typescript
const importEquipment = async (factoryId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<ApiResponse<ImportResult<EquipmentDTO>>>(
    `/api/mobile/${factoryId}/equipment/import`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};
```

---

#### 6.2 导出设备列表

**端点**: `GET /api/mobile/{factoryId}/equipment/export`
**功能**: 导出工厂所有设备为Excel文件
**权限**: 工厂管理员

##### 响应结构

**成功响应** (200):
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="设备列表_20251120_143000.xlsx"

[Binary Excel file]
```

##### 业务逻辑核心

1. **查询所有设备**: WHERE factoryId = ? AND deleted = false
2. **生成Excel**: 使用Apache POI
3. **包含计算字段**: depreciatedValue, nextMaintenanceDate
4. **设置响应头**: Content-Type, Content-Disposition
5. **返回文件流**: byte[]

**导出字段**:
- 基础信息: name, equipmentNumber, type, model, manufacturer
- 购买信息: purchaseDate, purchasePrice, warrantyExpiry
- 状态信息: status, totalRunningHours
- 维护信息: lastMaintenanceDate, nextMaintenanceDate, maintenanceInterval
- 价值信息: purchasePrice, depreciatedValue, depreciationRate

##### 代码示例

```typescript
const exportEquipment = async (factoryId: string) => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/equipment/export`,
    {
      responseType: 'blob',  // 重要: 接收二进制数据
    }
  );

  // 触发下载
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `设备列表_${Date.now()}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};
```

---

#### 6.3 下载设备导入模板

**端点**: `GET /api/mobile/{factoryId}/equipment/export/template`
**功能**: 下载设备导入模板（空Excel，带表头和示例）
**权限**: 工厂管理员

##### 响应结构

**成功响应** (200):
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="设备导入模板.xlsx"

[Binary Excel file with headers and sample rows]
```

##### 业务逻辑核心

1. **生成模板Excel**: 表头 + 2行示例数据
2. **添加数据验证**: 下拉列表（设备类型、状态）
3. **添加说明Sheet**: 字段说明、填写规范
4. **返回文件流**: byte[]

**模板包含**:
- Sheet 1: 数据录入表（带表头和示例）
- Sheet 2: 填写说明（字段说明、格式要求）

---

## 设备告警端点

### 7. 告警管理 (E2E验证)

#### 7.1 获取设备告警列表 ✅ E2E验证

**端点**: `GET /api/mobile/{factoryId}/equipment-alerts`
**功能**: 分页获取设备告警列表，支持按状态筛选
**权限**: 工厂所有角色
**E2E测试**: ✅ 20/20通过 (Equipment Alerts E2E)
**超详细版本**: 主文档暂无 (待添加)

##### 请求参数

**Query Parameters**:
```typescript
{
  page?: number,        // 页码（从1开始，默认1）
  size?: number,        // 每页数量（默认10）
  status?: string,      // 告警状态筛选（可选: ACTIVE / ACKNOWLEDGED / RESOLVED / IGNORED）
  level?: string,       // 告警级别筛选（可选: INFO / WARNING / ERROR / CRITICAL）
  sortBy?: string,      // 排序字段（默认triggeredAt）
  sortOrder?: string    // 排序方向（asc/desc，默认desc）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "content": [
      {
        "id": 1,
        "factoryId": "CRETAS_2024_001",
        "equipmentId": "EQ-003",
        "equipmentName": "切割机B2",
        "alertType": "高温告警",
        "level": "WARNING",
        "status": "ACTIVE",
        "message": "设备温度超过安全阈值",
        "details": "当前温度: 85°C, 阈值: 80°C",
        "triggeredAt": "2025-11-20T14:30:00",
        "acknowledgedAt": null,
        "acknowledgedBy": null,
        "resolvedAt": null,
        "resolvedBy": null
      }
    ],
    "totalElements": 48,
    "totalPages": 5,
    "currentPage": 1,       // ✅ P3-1修复: currentPage字段正常返回
    "pageSize": 10,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

##### 业务逻辑核心

1. **构建分页查询**: PageRequest(page-1, size, Sort)
2. **工厂过滤**: WHERE factoryId = ?
3. **状态筛选** (E2E验证✅):
   - 如果提供status参数: WHERE status = ?
   - E2E测试验证: ACTIVE状态筛选正常工作
4. **级别筛选**: 如果提供level参数: WHERE level = ?
5. **关联设备**: JOIN equipment表获取设备名称
6. **分页返回**: PageResponse包含currentPage字段 (P3-1修复✅)

##### E2E测试验证点

| 测试场景 | 状态 | 验证点 |
|---------|------|--------|
| 获取告警列表 | ✅ 通过 | API路径正确 (/equipment-alerts) |
| 响应码200 | ✅ 通过 | code字段返回200 |
| 分页字段 | ✅ 通过 | totalElements, content字段存在 |
| **currentPage字段** | ✅ 通过 | **P3-1修复: currentPage正常返回1** |
| **ACTIVE状态筛选** | ✅ 通过 | **Fix 8: 准备ACTIVE数据，筛选正常** |

##### 代码示例

**TypeScript (React Native)**:
```typescript
import { apiClient } from '@/services/api/apiClient';

const getEquipmentAlerts = async (
  factoryId: string,
  params?: {
    page?: number;
    size?: number;
    status?: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'IGNORED';
    level?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  }
) => {
  const response = await apiClient.get<ApiResponse<PageResponse<AlertDTO>>>(
    `/api/mobile/${factoryId}/equipment-alerts`,
    { params }
  );
  return response.data;
};

// 使用示例
const activeAlerts = await getEquipmentAlerts('CRETAS_2024_001', {
  page: 1,
  size: 10,
  status: 'ACTIVE',  // ✅ E2E验证: ACTIVE状态筛选正常
  level: 'WARNING'
});
```

---

#### 7.2 确认设备告警 ✅ E2E验证

**端点**: `POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/acknowledge`
**功能**: 确认告警（ACTIVE → ACKNOWLEDGED）
**权限**: 工厂管理员、生产管理员、设备管理员
**E2E测试**: ✅ 验证通过

##### 请求参数

**Path Parameters**:
- `alertId`: string (告警ID)

**Body**:
```typescript
{
  notes?: string  // 确认备注（可选）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "告警确认成功",
  "data": {
    "id": 1,
    "status": "ACKNOWLEDGED",
    "acknowledgedAt": "2025-11-20T15:00:00",
    "acknowledgedBy": 5,
    "acknowledgedByName": "张管理员",
    "notes": "已通知维护部门"
  }
}
```

##### 业务逻辑核心

1. **验证告警存在**: 根据factoryId和alertId查询
2. **状态检查**: 当前status必须为ACTIVE
3. **更新状态**:
   - status = "ACKNOWLEDGED"
   - acknowledgedAt = now()
   - acknowledgedBy = userId (从Token获取)
   - notes = 请求中的notes
4. **返回更新后的告警**: AlertResponse DTO

##### E2E测试验证点

| 测试场景 | 状态 | 验证点 |
|---------|------|--------|
| 确认ACTIVE告警 | ✅ 通过 | 状态变更为ACKNOWLEDGED |
| 响应码200 | ✅ 通过 | 操作成功 |
| 时间戳记录 | ✅ 通过 | acknowledgedAt正确记录 |

##### 代码示例

```typescript
const acknowledgeAlert = async (
  factoryId: string,
  alertId: string,
  notes?: string
) => {
  const response = await apiClient.post<ApiResponse<AlertDTO>>(
    `/api/mobile/${factoryId}/equipment/alerts/${alertId}/acknowledge`,
    { notes }
  );
  return response.data;
};
```

---

#### 7.3 解决设备告警 ✅ E2E验证

**端点**: `POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/resolve`
**功能**: 解决告警（ACKNOWLEDGED → RESOLVED）
**权限**: 工厂管理员、设备管理员
**E2E测试**: ✅ 验证通过

##### 请求参数

**Body**:
```typescript
{
  solution: string  // 解决方案（必填）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "告警解决成功",
  "data": {
    "id": 1,
    "status": "RESOLVED",
    "resolvedAt": "2025-11-20T16:30:00",
    "resolvedBy": 5,
    "resolvedByName": "张管理员",
    "solution": "更换过热的冷却风扇，温度恢复正常"
  }
}
```

##### 业务逻辑核心

1. **验证告警存在**: 根据factoryId和alertId查询
2. **状态检查**: 当前status必须为ACKNOWLEDGED（已确认）
3. **更新状态**:
   - status = "RESOLVED"
   - resolvedAt = now()
   - resolvedBy = userId
   - solution = 请求中的解决方案
4. **返回更新后的告警**: AlertResponse DTO

##### E2E测试验证点

| 测试场景 | 状态 | 验证点 |
|---------|------|--------|
| 解决ACKNOWLEDGED告警 | ✅ 通过 | 状态变更为RESOLVED |
| 响应码200 | ✅ 通过 | 操作成功 |
| 解决方案记录 | ✅ 通过 | solution字段正确保存 |

##### 代码示例

```typescript
const resolveAlert = async (
  factoryId: string,
  alertId: string,
  solution: string
) => {
  const response = await apiClient.post<ApiResponse<AlertDTO>>(
    `/api/mobile/${factoryId}/equipment/alerts/${alertId}/resolve`,
    { solution }
  );
  return response.data;
};
```

---

#### 7.4 忽略设备告警 ✅ E2E验证

**端点**: `POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/ignore`
**功能**: 忽略告警（任意状态 → IGNORED）
**权限**: 工厂管理员
**E2E测试**: ✅ 验证通过

##### 请求参数

**Body**:
```typescript
{
  reason: string  // 忽略原因（必填）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "告警已忽略",
  "data": {
    "id": 1,
    "status": "IGNORED",
    "ignoredAt": "2025-11-20T17:00:00",
    "ignoredBy": 1,
    "ignoredByName": "系统管理员",
    "ignoreReason": "误报，传感器故障导致"
  }
}
```

##### 业务逻辑核心

1. **验证告警存在**: 根据factoryId和alertId查询
2. **更新状态**:
   - status = "IGNORED"
   - ignoredAt = now()
   - ignoredBy = userId
   - ignoreReason = 请求中的原因
3. **返回更新后的告警**: AlertResponse DTO

##### E2E测试验证点

| 测试场景 | 状态 | 验证点 |
|---------|------|--------|
| 忽略告警 | ✅ 通过 | 状态变更为IGNORED |
| 响应码200 | ✅ 通过 | 操作成功 |
| 原因记录 | ✅ 通过 | ignoreReason字段正确保存 |

##### 代码示例

```typescript
const ignoreAlert = async (
  factoryId: string,
  alertId: string,
  reason: string
) => {
  const response = await apiClient.post<ApiResponse<AlertDTO>>(
    `/api/mobile/${factoryId}/equipment/alerts/${alertId}/ignore`,
    { reason }
  );
  return response.data;
};
```

---

#### 7.5 获取告警统计 ✅ E2E验证

**端点**: `GET /api/mobile/{factoryId}/equipment-alerts/statistics`
**功能**: 获取设备告警的统计信息
**权限**: 工厂管理员、生产管理员
**E2E测试**: ✅ 验证通过

##### 请求参数

**Query Parameters**:
```typescript
{
  startDate?: string,  // 开始日期 (ISO 8601, 可选)
  endDate?: string     // 结束日期 (ISO 8601, 可选)
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "totalAlerts": 128,
    "statusBreakdown": {
      "ACTIVE": 12,
      "ACKNOWLEDGED": 8,
      "RESOLVED": 105,
      "IGNORED": 3
    },
    "levelBreakdown": {
      "INFO": 45,
      "WARNING": 56,
      "ERROR": 22,
      "CRITICAL": 5
    },
    "averageResolutionTime": 4.5,  // 小时
    "topEquipmentAlerts": [
      {
        "equipmentId": "EQ-003",
        "equipmentName": "切割机B2",
        "alertCount": 18
      },
      {
        "equipmentId": "EQ-007",
        "equipmentName": "清洗机C1",
        "alertCount": 15
      }
    ],
    "recentTrends": {
      "last7Days": 24,
      "last30Days": 89,
      "increaseRate": 12.5  // 相比上月增长率 (%)
    }
  }
}
```

##### 业务逻辑核心

1. **时间范围筛选**: 如果提供startDate/endDate，筛选triggeredAt
2. **聚合统计**:
   - 总告警数: COUNT(*)
   - 按状态分组: GROUP BY status
   - 按级别分组: GROUP BY level
3. **计算指标**:
   - 平均解决时间: AVG(resolvedAt - triggeredAt)
   - 设备告警排名: GROUP BY equipmentId ORDER BY COUNT(*) DESC
4. **趋势分析**: 最近7天、30天的告警数量

##### E2E测试验证点

| 测试场景 | 状态 | 验证点 |
|---------|------|--------|
| 获取统计数据 | ✅ 通过 | 响应码200 |
| 状态分组统计 | ✅ 通过 | statusBreakdown字段存在 |
| 级别分组统计 | ✅ 通过 | levelBreakdown字段存在 |

---

## E2E测试验证

### Equipment Alerts E2E测试总结

**测试时间**: 2025-11-20
**测试环境**: http://localhost:10010
**测试套件**: Equipment Alerts E2E
**通过率**: 20/20 (100%) ✅

#### 测试覆盖

| 测试步骤 | API端点 | 验证点 | 状态 |
|---------|---------|--------|------|
| 1.1 获取告警列表 | GET /equipment-alerts | 路径正确、响应码200 | ✅ |
| 1.2 验证分页字段 | - | totalElements, content字段存在 | ✅ |
| 1.3 验证currentPage | - | **P3-1修复: currentPage=1** | ✅ |
| 2.0 准备测试数据 | - | **Fix 8: 插入ACTIVE状态告警** | ✅ |
| 2.1 状态筛选ACTIVE | GET /equipment-alerts?status=ACTIVE | **筛选正常工作** | ✅ |
| 2.2 提取ACTIVE告警ID | - | ACTIVE_ALERT_ID提取成功 | ✅ |
| 3.1 确认告警 | POST /alerts/{id}/acknowledge | 状态变更为ACKNOWLEDGED | ✅ |
| 3.2 验证确认时间 | - | acknowledgedAt正确记录 | ✅ |
| 4.1 解决告警 | POST /alerts/{id}/resolve | 状态变更为RESOLVED | ✅ |
| 4.2 验证解决方案 | - | solution字段正确保存 | ✅ |
| 5.1 忽略告警 | POST /alerts/{id}/ignore | 状态变更为IGNORED | ✅ |
| 5.2 验证忽略原因 | - | ignoreReason字段正确保存 | ✅ |
| 6.1 获取告警统计 | GET /equipment-alerts/statistics | 响应码200 | ✅ |
| 6.2 验证统计字段 | - | statusBreakdown, levelBreakdown存在 | ✅ |

#### E2E修复内容

**修复1: P3-1 - currentPage字段** (已完成✅)

**问题描述**: PageResponse的currentPage字段总是返回null

**根本原因**: MobileServiceImpl在构建PageResponse时，忘记调用setCurrentPage()

**修复代码** (`MobileServiceImpl.java` line 1410):
```java
response.setCurrentPage(pageRequest.getPage()); // ✅ P3-1修复
```

**验证结果**:
```json
{
  "code": 200,
  "data": {
    "currentPage": 1,  // ✅ 正常返回
    "totalPages": 5,
    "content": [...]
  }
}
```

---

**修复2: Fix 8 - ACTIVE状态筛选** (已完成✅)

**问题描述**: status=ACTIVE筛选返回空数组

**根本原因**: 测试数据问题。所有告警在步骤1中被获取后，后续操作将它们确认/解决/忽略，导致步骤2筛选时没有ACTIVE状态的告警。

**修复内容** (`test_e2e_equipment_alerts_flow.sh` lines 140-147):
```bash
# 步骤2.0: 准备ACTIVE状态数据
mysql -u root cretas_db << EOF
INSERT INTO equipment_alerts (factory_id, equipment_id, alert_type, level, status, message, details, triggered_at)
VALUES ('${FACTORY_ID}', '1', '测试告警-筛选用', 'INFO', 'ACTIVE', 'E2E测试-ACTIVE状态告警', '用于测试状态筛选功能', NOW())
ON DUPLICATE KEY UPDATE status='ACTIVE';
EOF
```

**验证结果**:
```json
{
  "code": 200,
  "data": {
    "content": [{
      "status": "ACTIVE",  // ✅ ACTIVE状态筛选成功
      "message": "E2E测试-ACTIVE状态告警"
    }]
  }
}
```

---

#### 测试脚本关键代码

**验证currentPage字段**:
```bash
CURRENT_PAGE=$(echo "$LIST_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('currentPage', 'N/A'))" 2>/dev/null || echo "N/A")
verify_result "页码从1开始" "1" "$CURRENT_PAGE"
# ✅ 输出: ✅ PASS: 页码从1开始, 预期: 1, 实际: 1
```

**验证ACTIVE状态筛选**:
```bash
FILTER_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment-alerts?status=ACTIVE&page=1&size=10" \
  -H "Authorization: Bearer ${TOKEN}")

verify_api_response "$FILTER_RESPONSE" "200"
# ✅ 输出: ✅ PASS: API响应码, 预期: 200, 实际: 200

ACTIVE_COUNT=$(echo "$FILTER_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data['data']['content']))" 2>/dev/null || echo "0")
if [ "$ACTIVE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: ACTIVE状态筛选成功，找到${ACTIVE_COUNT}条记录"
fi
```

---

## 核心业务逻辑

### 设备生命周期管理

**完整流程**:
1. **采购阶段**: 创建设备记录 → 设置购买信息、保修期
2. **部署阶段**: 设置位置、关联工厂、初始状态idle
3. **运行阶段**: 启动设备 → 累计运行时长 → 停止设备
4. **维护阶段**: 定期维护 → 记录维护历史 → 更新下次维护日期
5. **监控阶段**: 实时告警 → 确认告警 → 解决告警
6. **报废阶段**: 设备老化 → 报废操作 → 状态变更为scrapped

### OEE计算详解

**OEE (Overall Equipment Effectiveness)** = 整体设备效率

**三要素**:
1. **Availability (可用率)**: 设备实际运行时间占计划生产时间的比例
2. **Performance (表现率)**: 实际产量占理论产量的比例
3. **Quality (质量率)**: 合格品占总产量的比例

**计算公式**:
```
OEE = Availability × Performance × Quality

示例:
- Availability = 145小时 / 240小时 = 60.4%
- Performance = 2800件 / 3000件 = 93.3%
- Quality = 2750件 / 2800件 = 98.2%
- OEE = 0.604 × 0.933 × 0.982 = 0.553 = 55.3%
```

**世界级OEE标准**:
- **优秀**: OEE ≥ 85%
- **良好**: 60% ≤ OEE < 85%
- **需改进**: OEE < 60%

### 设备告警处理流程

**状态流转**:
```
告警触发
   ↓
[ACTIVE]  ←── 初始状态，活跃告警
   ↓ acknowledge()
[ACKNOWLEDGED]  ←── 已确认，待处理
   ↓ resolve()
[RESOLVED]  ←── 已解决，完成

或：
[ACTIVE/ACKNOWLEDGED]
   ↓ ignore()
[IGNORED]  ←── 已忽略（误报等）
```

**处理时效要求**:
- **CRITICAL**: 15分钟内确认，2小时内解决
- **ERROR**: 1小时内确认，8小时内解决
- **WARNING**: 4小时内确认，24小时内解决
- **INFO**: 24小时内确认，无严格解决时限

---

## 状态机与流程图

### 设备状态机

```
        创建设备
           ↓
        [idle]  ←── 空闲状态
           ↓ start()
      [running]  ←── 运行中
           ↓ stop()
        [idle]
           ↓ maintenance()
    [maintenance]  ←── 维护中
           ↓ complete_maintenance()
        [idle]
           ↓ scrap() (不可逆)
      [scrapped]  ←── 已报废
```

**状态转换规则**:
- `idle → running`: 调用start()
- `running → idle`: 调用stop()
- `idle → maintenance`: 调用maintenance()
- `maintenance → idle`: 维护完成
- `任意状态 → scrapped`: 调用scrap()（不可逆）

**状态字段**: `status` (idle / running / maintenance / scrapped)

### 告警状态机

```
   告警触发
      ↓
   [ACTIVE]  ←── 活跃告警
      ↓ acknowledge()
[ACKNOWLEDGED]  ←── 已确认
      ↓ resolve()
  [RESOLVED]  ←── 已解决

或：
   [ACTIVE]
      ↓ ignore()
  [IGNORED]  ←── 已忽略
```

**状态字段**: `status` (ACTIVE / ACKNOWLEDGED / RESOLVED / IGNORED)

---

## 数据模型

### Equipment实体

**表名**: `equipment`

**字段**:
```java
public class Equipment {
    private String id;                    // 设备ID (主键)
    private String factoryId;             // 工厂ID (外键)
    private String name;                  // 设备名称
    private String equipmentNumber;       // 设备编号（工厂内唯一）
    private String type;                  // 设备类型
    private String model;                 // 设备型号
    private String manufacturer;          // 制造商
    private String status;                // 设备状态 (idle/running/maintenance/scrapped)
    private LocalDate purchaseDate;       // 购买日期
    private BigDecimal purchasePrice;     // 购买价格
    private LocalDate warrantyExpiry;     // 保修到期日期
    private Integer totalRunningHours;    // 总运行时长（小时）
    private LocalDate lastMaintenanceDate;// 上次维护日期
    private LocalDate nextMaintenanceDate;// 下次维护日期
    private Integer maintenanceInterval;  // 维护间隔（天）
    private BigDecimal depreciationRate;  // 折旧率（年化百分比）
    private String location;              // 位置
    private String specifications;        // 技术规格（JSON）
    private String notes;                 // 备注
    private Boolean deleted;              // 软删除标记
    private LocalDateTime createdAt;      // 创建时间
    private Integer createdBy;            // 创建人ID
    private LocalDateTime updatedAt;      // 更新时间
}
```

**索引**:
- `idx_factory_id`: factoryId
- `idx_equipment_number`: (factoryId, equipmentNumber) UNIQUE
- `idx_status`: status
- `idx_type`: type
- `idx_next_maintenance`: nextMaintenanceDate

### EquipmentAlert实体

**表名**: `equipment_alerts`

**字段**:
```java
public class EquipmentAlert {
    private Integer id;                   // 告警ID (主键, 自增)
    private String factoryId;             // 工厂ID
    private String equipmentId;           // 设备ID (外键)
    private String alertType;             // 告警类型
    private String level;                 // 告警级别 (INFO/WARNING/ERROR/CRITICAL)
    private String status;                // 告警状态 (ACTIVE/ACKNOWLEDGED/RESOLVED/IGNORED)
    private String message;               // 告警消息
    private String details;               // 告警详情
    private LocalDateTime triggeredAt;    // 触发时间
    private LocalDateTime acknowledgedAt; // 确认时间
    private Integer acknowledgedBy;       // 确认人ID
    private LocalDateTime resolvedAt;     // 解决时间
    private Integer resolvedBy;           // 解决人ID
    private String solution;              // 解决方案
    private LocalDateTime ignoredAt;      // 忽略时间
    private Integer ignoredBy;            // 忽略人ID
    private String ignoreReason;          // 忽略原因
}
```

**索引**:
- `idx_factory_id`: factoryId
- `idx_equipment_id`: equipmentId
- `idx_alert_status`: status
- `idx_alert_triggered_at`: triggeredAt

---

## 总结

### 端点概览

**设备管理** (25端点):
- CRUD: 4个
- 查询搜索: 5个
- 状态管理: 4个
- 维护管理: 4个
- 统计报告: 5个
- 批量操作: 3个

**设备告警** (5端点):
- 告警查询: 2个
- 告警处理: 3个

**E2E测试覆盖**: ✅ 20/20 (100%)

### 关键业务价值

1. **设备全生命周期管理**: 从采购到报废的完整跟踪
2. **OEE性能监控**: 科学的设备效率评估
3. **智能维护提醒**: 基于运行时长和时间间隔的自动提醒
4. **实时告警系统**: 及时发现和处理设备异常
5. **成本控制**: 折旧计算、维护费用统计
6. **数据驱动决策**: 丰富的统计报告支持设备管理决策

### 文档链接

- **主文档**: [PRD-API端点完整文档-v3.0.md](./PRD-API端点完整文档-v3.0.md) (超详细8维度)
- **API索引**: [PRD-API索引文档-v1.0.md](./PRD-API索引文档-v1.0.md) (导航中心)
- **其他Controller**:
  - [ProcessingController](./PRD-API-ProcessingController.md) (23端点)
  - [MaterialBatchController](./PRD-API-MaterialBatchController.md) (25端点)

---

**文档生成时间**: 2025-11-20
**生成者**: Claude Code
**版本**: v1.0
**总字数**: ~12,000字
