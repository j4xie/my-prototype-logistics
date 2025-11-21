# PRD-API-MaterialTypeController.md

## 文档信息

- **文档标题**: MaterialTypeController API 端点文档
- **Controller**: `MaterialTypeController.java`
- **模块**: 原材料类型管理模块 (Raw Material Type Management)
- **端点数量**: 16个
- **文档版本**: v1.0.0
- **创建时间**: 2025-01-20
- **维护团队**: Cretas Backend Team

---

## 📋 目录

1. [控制器概述](#1-控制器概述)
2. [端点清单](#2-端点清单)
3. [端点详细文档](#3-端点详细文档)
   - [3.1 CRUD操作](#31-crud操作)
   - [3.2 查询操作](#32-查询操作)
   - [3.3 批量操作与导入导出](#33-批量操作与导入导出)
4. [数据模型](#4-数据模型)
5. [业务规则](#5-业务规则)
6. [前端集成建议](#6-前端集成建议)

---

## 1. 控制器概述

### 1.1 功能描述

**MaterialTypeController** 负责原材料类型的全生命周期管理，包括：

- ✅ **基础CRUD**: 创建、查询、更新、删除原材料类型
- ✅ **分类管理**: 按类别、存储方式分类管理
- ✅ **搜索功能**: 按名称、编码模糊搜索
- ✅ **库存预警**: 识别低库存原材料
- ✅ **批量操作**: 批量更新激活状态
- ✅ **数据导入导出**: Excel批量导入导出
- ✅ **唯一性验证**: 原材料编码和名称唯一性检查

### 1.2 关键特性

| 特性 | 说明 | 实现方式 |
|------|------|----------|
| **UUID主键** | 使用UUID作为主键 | `UUID.randomUUID()` |
| **双重唯一性** | 同一工厂下编码和名称唯一 | 数据库约束 |
| **分类管理** | 支持原材料类别分类 | `category` 字段 |
| **存储方式** | 支持不同存储方式 | `storageType`（冷冻/冷藏/常温） |
| **激活状态** | 软删除机制 | `isActive` 字段 |
| **库存预警** | 低库存原材料提醒 | 库存阈值判断 |
| **审计日志** | 记录创建者 | `createdBy` 字段 |

### 1.3 技术栈

- **Framework**: Spring Boot 2.7.15
- **ORM**: Spring Data JPA + Hibernate
- **Database**: MySQL with unique constraints and indexes
- **Excel**: Apache POI
- **UUID**: `java.util.UUID`

---

## 2. 端点清单

| # | 方法 | 路径 | 功能 | 状态 |
|---|------|------|------|------|
| 1 | GET | `/api/mobile/{factoryId}/materials/types` | 获取原材料类型列表（分页） | ✅ |
| 2 | POST | `/api/mobile/{factoryId}/materials/types` | 创建原材料类型 | ✅ |
| 3 | GET | `/api/mobile/{factoryId}/materials/types/{id}` | 获取原材料类型详情 | ✅ |
| 4 | PUT | `/api/mobile/{factoryId}/materials/types/{id}` | 更新原材料类型 | ✅ |
| 5 | DELETE | `/api/mobile/{factoryId}/materials/types/{id}` | 删除原材料类型 | ✅ |
| 6 | GET | `/api/mobile/{factoryId}/materials/types/active` | 获取激活的原材料类型 | ✅ |
| 7 | GET | `/api/mobile/{factoryId}/materials/types/category/{category}` | 按类别获取原材料类型 | ✅ |
| 8 | GET | `/api/mobile/{factoryId}/materials/types/storage-type/{storageType}` | 按存储方式获取 | ✅ |
| 9 | GET | `/api/mobile/{factoryId}/materials/types/search` | 搜索原材料类型 | ✅ |
| 10 | GET | `/api/mobile/{factoryId}/materials/types/check-code` | 检查编码是否存在 | ✅ |
| 11 | GET | `/api/mobile/{factoryId}/materials/types/categories` | 获取所有类别列表 | ✅ |
| 12 | GET | `/api/mobile/{factoryId}/materials/types/low-stock` | 获取低库存原材料 | ✅ |
| 13 | PUT | `/api/mobile/{factoryId}/materials/types/batch/status` | 批量更新状态 | ✅ |
| 14 | GET | `/api/mobile/{factoryId}/materials/types/export` | 导出原材料列表 | ✅ |
| 15 | POST | `/api/mobile/{factoryId}/materials/types/import` | 批量导入原材料 | ✅ |
| 16 | GET | `/api/mobile/{factoryId}/materials/types/export/template` | 下载导入模板 | ✅ |

---

## 3. 端点详细文档

### 3.1 CRUD操作

#### 3.1.1 获取原材料类型列表（分页）

##### 端点基本信息

```http
GET /api/mobile/{factoryId}/materials/types?isActive=true&page=0&size=20&sortBy=createdAt&sortDirection=DESC
Authorization: Bearer {accessToken}
```

**功能**: 获取原材料类型列表，支持分页、激活状态筛选和排序。

##### 请求参数详解

**Path Parameters**:
- `factoryId` (String, required): 工厂ID，如 "CRETAS_2024_001"

**Query Parameters**:
```typescript
interface GetMaterialTypesRequest {
  isActive?: boolean;        // 激活状态筛选（可选，true=仅激活，false=仅停用，null=全部）
  page?: number;             // 页码（默认0，从0开始）
  size?: number;             // 每页大小（默认20）
  sortBy?: string;           // 排序字段（默认createdAt）
  sortDirection?: 'ASC' | 'DESC';  // 排序方向（默认DESC）
}
```

**支持的排序字段**:
- `createdAt`: 创建时间（默认）
- `updatedAt`: 更新时间
- `name`: 名称
- `materialCode`: 编码
- `category`: 类别

##### 响应数据结构

**Success Response (200)**:
```typescript
interface ApiResponse<Page<MaterialType>> {
  success: true;
  code: 200;
  message: "获取成功";
  data: {
    content: MaterialType[];       // 当前页数据
    totalElements: number;         // 总记录数
    totalPages: number;            // 总页数
    number: number;                // 当前页码（从0开始）
    size: number;                  // 每页大小
    first: boolean;                // 是否第一页
    last: boolean;                 // 是否最后一页
    empty: boolean;                // 是否为空
  };
  timestamp: string;
}

interface MaterialType {
  id: string;                      // UUID主键
  factoryId: string;               // 工厂ID
  materialCode: string;            // 原材料编码
  name: string;                    // 原材料名称
  category: string | null;         // 原材料类别（如：海水鱼、淡水鱼）
  unit: string;                    // 计量单位（默认kg）
  storageType: string | null;      // 存储方式（冷冻/冷藏/常温）
  description: string | null;      // 原材料描述
  isActive: boolean;               // 是否激活
  createdAt: string;               // 创建时间
  updatedAt: string;               // 更新时间
  createdBy: number | null;        // 创建者ID
}
```

##### 前端集成建议

```typescript
// services/api/materialTypeApiClient.ts
export const materialTypeApiClient = {
  /**
   * 获取原材料类型列表
   */
  async getMaterialTypes(
    factoryId: string,
    params: {
      isActive?: boolean;
      page?: number;
      size?: number;
      sortBy?: string;
      sortDirection?: 'ASC' | 'DESC';
    } = {}
  ): Promise<Page<MaterialType>> {
    const response = await apiClient.get<ApiResponse<Page<MaterialType>>>(
      `/api/mobile/${factoryId}/materials/types`,
      {
        params: {
          isActive: params.isActive,
          page: params.page ?? 0,
          size: params.size ?? 20,
          sortBy: params.sortBy ?? 'createdAt',
          sortDirection: params.sortDirection ?? 'DESC',
        },
      }
    );
    return response.data.data;
  },
};
```

---

#### 3.1.2 创建原材料类型

##### 端点基本信息

```http
POST /api/mobile/{factoryId}/materials/types
Content-Type: application/json
Authorization: Bearer {accessToken}
```

**功能**: 创建新的原材料类型。

##### 请求参数详解

**Path Parameters**:
- `factoryId` (String, required): 工厂ID

**Request Body**:
```typescript
interface CreateMaterialTypeRequest {
  name: string;                 // 原材料名称（必填，同工厂下唯一）
  materialCode: string;         // 原材料编码（必填，同工厂下唯一）
  category?: string;            // 原材料类别（可选，如：海水鱼）
  unit?: string;                // 计量单位（可选，默认kg）
  storageType?: string;         // 存储方式（可选，如：冷冻）
  description?: string;         // 原材料描述（可选）
}
```

**示例请求**:
```json
{
  "name": "三文鱼",
  "materialCode": "SWY",
  "category": "海水鱼",
  "unit": "kg",
  "storageType": "冷冻",
  "description": "挪威进口三文鱼，肉质鲜美"
}
```

##### 响应数据结构

**Success Response (201)**:
```typescript
interface ApiResponse<MaterialType> {
  success: true;
  code: 201;
  message: "创建成功";
  data: MaterialType;  // 完整的原材料类型信息（含自动生成的UUID）
  timestamp: string;
}
```

**Error Responses**:
```typescript
// 编码已存在
{
  success: false,
  code: 400,
  message: "原材料编码已存在: SWY",
  data: null
}

// 名称已存在
{
  success: false,
  code: 400,
  message: "原材料名称已存在: 三文鱼",
  data: null
}
```

##### 业务逻辑说明

**创建流程**:
```typescript
const createMaterialType = async (
  factoryId: string,
  request: CreateMaterialTypeRequest
): Promise<MaterialType> => {
  // 1. 验证唯一性（编码）
  const codeExists = await checkCodeExists(factoryId, request.materialCode);
  if (codeExists) {
    throw new Error(`原材料编码已存在: ${request.materialCode}`);
  }

  // 2. 验证唯一性（名称）
  const nameExists = await checkNameExists(factoryId, request.name);
  if (nameExists) {
    throw new Error(`原材料名称已存在: ${request.name}`);
  }

  // 3. 创建实体
  const materialType = new MaterialType();
  materialType.id = UUID.randomUUID().toString();
  materialType.factoryId = factoryId;
  materialType.name = request.name;
  materialType.materialCode = request.materialCode;
  materialType.category = request.category;
  materialType.unit = request.unit || 'kg';
  materialType.storageType = request.storageType;
  materialType.description = request.description;
  materialType.isActive = true;
  materialType.createdAt = new Date();
  materialType.updatedAt = new Date();

  // 4. 保存到数据库
  const saved = await materialTypeRepository.save(materialType);

  return saved;
};
```

---

#### 3.1.3 获取原材料类型详情

##### 端点基本信息

```http
GET /api/mobile/{factoryId}/materials/types/{id}
Authorization: Bearer {accessToken}
```

**功能**: 获取指定ID的原材料类型详细信息。

##### 请求参数详解

**Path Parameters**:
- `factoryId` (String, required): 工厂ID
- `id` (String, required): 原材料类型ID（UUID）

##### 响应数据结构

**Success Response (200)**:
```typescript
interface ApiResponse<MaterialType> {
  success: true;
  code: 200;
  message: "获取成功";
  data: MaterialType;
  timestamp: string;
}
```

**Error Response (404)**:
```typescript
{
  success: false,
  code: 404,
  message: "原材料类型不存在: {id}",
  data: null
}
```

---

#### 3.1.4 更新原材料类型

##### 端点基本信息

```http
PUT /api/mobile/{factoryId}/materials/types/{id}
Content-Type: application/json
Authorization: Bearer {accessToken}
```

**功能**: 更新原材料类型信息。

##### 请求参数详解

**Path Parameters**:
- `factoryId` (String, required): 工厂ID
- `id` (String, required): 原材料类型ID

**Request Body**:
```typescript
interface UpdateMaterialTypeRequest {
  name?: string;                // 原材料名称（可选）
  materialCode?: string;        // 原材料编码（可选）
  category?: string;            // 原材料类别（可选）
  unit?: string;                // 计量单位（可选）
  storageType?: string;         // 存储方式（可选）
  description?: string;         // 原材料描述（可选）
}
```

##### 响应数据结构

**Success Response (200)**:
```typescript
interface ApiResponse<MaterialType> {
  success: true;
  code: 200;
  message: "更新成功";
  data: MaterialType;  // 更新后的完整信息
  timestamp: string;
}
```

##### 业务逻辑说明

**更新流程**:
```typescript
const updateMaterialType = async (
  factoryId: string,
  id: string,
  updates: UpdateMaterialTypeRequest
): Promise<MaterialType> => {
  // 1. 获取现有记录
  const existing = await materialTypeRepository.findOne({
    where: { id, factoryId }
  });

  if (!existing) {
    throw new EntityNotFoundException(`原材料类型不存在: ${id}`);
  }

  // 2. 如果更新编码，检查唯一性（排除当前记录）
  if (updates.materialCode && updates.materialCode !== existing.materialCode) {
    const codeExists = await checkCodeExists(factoryId, updates.materialCode, id);
    if (codeExists) {
      throw new Error(`原材料编码已存在: ${updates.materialCode}`);
    }
  }

  // 3. 如果更新名称，检查唯一性（排除当前记录）
  if (updates.name && updates.name !== existing.name) {
    const nameExists = await checkNameExists(factoryId, updates.name, id);
    if (nameExists) {
      throw new Error(`原材料名称已存在: ${updates.name}`);
    }
  }

  // 4. 应用更新
  Object.assign(existing, updates, { updatedAt: new Date() });

  // 5. 保存
  const saved = await materialTypeRepository.save(existing);

  return saved;
};
```

---

#### 3.1.5 删除原材料类型

##### 端点基本信息

```http
DELETE /api/mobile/{factoryId}/materials/types/{id}
Authorization: Bearer {accessToken}
```

**功能**: 删除原材料类型（软删除，设置 `isActive = false`）。

##### 请求参数详解

**Path Parameters**:
- `factoryId` (String, required): 工厂ID
- `id` (String, required): 原材料类型ID

##### 响应数据结构

**Success Response (200)**:
```typescript
interface ApiResponse<void> {
  success: true;
  code: 200;
  message: "删除成功";
  data: null;
  timestamp: string;
}
```

##### 业务逻辑说明

**软删除策略**:
```typescript
const deleteMaterialType = async (
  factoryId: string,
  id: string
): Promise<void> => {
  const materialType = await materialTypeRepository.findOne({
    where: { id, factoryId }
  });

  if (!materialType) {
    throw new EntityNotFoundException(`原材料类型不存在: ${id}`);
  }

  // 软删除：设置为非激活状态
  materialType.isActive = false;
  materialType.updatedAt = new Date();

  await materialTypeRepository.save(materialType);
};
```

---

### 3.2 查询操作

#### 3.2.1 获取激活的原材料类型

##### 端点基本信息

```http
GET /api/mobile/{factoryId}/materials/types/active
Authorization: Bearer {accessToken}
```

**功能**: 获取所有激活状态的原材料类型（不分页，用于下拉选择）。

##### 响应数据结构

**Success Response (200)**:
```typescript
interface ApiResponse<MaterialType[]> {
  success: true;
  code: 200;
  message: "获取成功";
  data: MaterialType[];  // 所有激活的原材料类型
  timestamp: string;
}
```

##### 查询逻辑

```sql
SELECT * FROM raw_material_types
WHERE factory_id = ?
  AND is_active = true
ORDER BY name ASC
```

---

#### 3.2.2 按类别获取原材料类型

##### 端点基本信息

```http
GET /api/mobile/{factoryId}/materials/types/category/{category}
Authorization: Bearer {accessToken}
```

**功能**: 获取指定类别的所有原材料类型。

##### 请求参数详解

**Path Parameters**:
- `factoryId` (String, required): 工厂ID
- `category` (String, required): 原材料类别（如："海水鱼"）

##### 响应数据结构

**Success Response (200)**:
```typescript
interface ApiResponse<MaterialType[]> {
  success: true;
  code: 200;
  message: "获取成功";
  data: MaterialType[];  // 该类别的所有原材料类型
  timestamp: string;
}
```

##### 查询逻辑

```sql
SELECT * FROM raw_material_types
WHERE factory_id = ?
  AND category = ?
  AND is_active = true
ORDER BY name ASC
```

---

#### 3.2.3 按存储方式获取原材料类型

##### 端点基本信息

```http
GET /api/mobile/{factoryId}/materials/types/storage-type/{storageType}
Authorization: Bearer {accessToken}
```

**功能**: 获取指定存储方式的所有原材料类型。

##### 请求参数详解

**Path Parameters**:
- `factoryId` (String, required): 工厂ID
- `storageType` (String, required): 存储方式（如："冷冻"）

**存储方式枚举**:
- `冷冻`: 冷冻存储（-18°C及以下）
- `冷藏`: 冷藏存储（0°C - 7°C）
- `常温`: 常温存储（室温）

##### 响应数据结构

**Success Response (200)**:
```typescript
interface ApiResponse<MaterialType[]> {
  success: true;
  code: 200;
  message: "获取成功";
  data: MaterialType[];  // 该存储方式的所有原材料类型
  timestamp: string;
}
```

---

#### 3.2.4 搜索原材料类型

##### 端点基本信息

```http
GET /api/mobile/{factoryId}/materials/types/search?keyword=鱼&page=0&size=20
Authorization: Bearer {accessToken}
```

**功能**: 根据关键词搜索原材料类型（按名称或编码模糊匹配）。

##### 请求参数详解

**Path Parameters**:
- `factoryId` (String, required): 工厂ID

**Query Parameters**:
```typescript
interface SearchRequest {
  keyword: string;         // 搜索关键词（必填，最少2个字符）
  page?: number;           // 页码（默认0）
  size?: number;           // 每页大小（默认20）
}
```

##### 响应数据结构

**Success Response (200)**:
```typescript
interface ApiResponse<Page<MaterialType>> {
  success: true;
  code: 200;
  message: "搜索成功";
  data: Page<MaterialType>;  // 分页搜索结果
  timestamp: string;
}
```

##### 查询逻辑

```sql
SELECT * FROM raw_material_types
WHERE factory_id = ?
  AND is_active = true
  AND (
    name LIKE CONCAT('%', ?, '%')
    OR material_code LIKE CONCAT('%', ?, '%')
  )
ORDER BY name ASC
LIMIT ? OFFSET ?
```

---

#### 3.2.5 检查原材料编码是否存在

##### 端点基本信息

```http
GET /api/mobile/{factoryId}/materials/types/check-code?materialCode=SWY
Authorization: Bearer {accessToken}
```

**功能**: 验证原材料编码是否已存在（用于表单实时验证）。

##### 请求参数详解

**Path Parameters**:
- `factoryId` (String, required): 工厂ID

**Query Parameters**:
```typescript
interface CheckCodeRequest {
  materialCode: string;    // 待验证的编码（必填）
}
```

##### 响应数据结构

**Success Response (200)**:
```typescript
interface ApiResponse<{ exists: boolean }> {
  success: true;
  code: 200;
  message: "检查完成";
  data: {
    exists: boolean;       // true = 已存在, false = 可用
  };
  timestamp: string;
}
```

##### 查询逻辑

```sql
SELECT COUNT(*) FROM raw_material_types
WHERE factory_id = ?
  AND material_code = ?
```

---

#### 3.2.6 获取所有类别列表

##### 端点基本信息

```http
GET /api/mobile/{factoryId}/materials/types/categories
Authorization: Bearer {accessToken}
```

**功能**: 获取所有唯一的原材料类别列表（用于类别筛选）。

##### 响应数据结构

**Success Response (200)**:
```typescript
interface ApiResponse<string[]> {
  success: true;
  code: 200;
  message: "获取成功";
  data: string[];  // 唯一类别列表，如：["海水鱼", "淡水鱼", "贝类", "虾类"]
  timestamp: string;
}
```

##### 查询逻辑

```sql
SELECT DISTINCT category FROM raw_material_types
WHERE factory_id = ?
  AND is_active = true
  AND category IS NOT NULL
ORDER BY category ASC
```

---

#### 3.2.7 获取低库存原材料

##### 端点基本信息

```http
GET /api/mobile/{factoryId}/materials/types/low-stock
Authorization: Bearer {accessToken}
```

**功能**: 获取库存低于最小值的原材料类型列表（库存预警）。

##### 响应数据结构

**Success Response (200)**:
```typescript
interface ApiResponse<MaterialType[]> {
  success: true;
  code: 200;
  message: "获取成功";
  data: MaterialType[];  // 低库存的原材料类型
  timestamp: string;
}
```

##### 业务逻辑说明

**库存预警判定**:
```typescript
const getLowStockMaterials = async (factoryId: string): Promise<MaterialType[]> => {
  // 1. 获取所有激活的原材料类型
  const materialTypes = await materialTypeRepository.find({
    where: { factoryId, isActive: true }
  });

  // 2. 对每个原材料类型查询当前库存
  const lowStockMaterials: MaterialType[] = [];

  for (const materialType of materialTypes) {
    // 查询该原材料的当前库存总量
    const currentStock = await materialBatchRepository
      .createQueryBuilder('batch')
      .select('SUM(batch.currentQuantity)', 'total')
      .where('batch.factoryId = :factoryId', { factoryId })
      .andWhere('batch.materialTypeId = :materialTypeId', { materialTypeId: materialType.id })
      .andWhere('batch.status IN (:...statuses)', { statuses: ['AVAILABLE', 'FROZEN'] })
      .getRawOne();

    const totalStock = parseFloat(currentStock?.total || '0');

    // 假设最小库存阈值为100kg
    const minStockThreshold = 100;

    if (totalStock < minStockThreshold) {
      lowStockMaterials.push(materialType);
    }
  }

  return lowStockMaterials;
};
```

---

### 3.3 批量操作与导入导出

#### 3.3.1 批量更新状态

##### 端点基本信息

```http
PUT /api/mobile/{factoryId}/materials/types/batch/status
Content-Type: application/json
Authorization: Bearer {accessToken}
```

**功能**: 批量更新原材料类型的激活状态。

##### 请求参数详解

**Path Parameters**:
- `factoryId` (String, required): 工厂ID

**Request Body**:
```typescript
interface BatchStatusRequest {
  ids: string[];          // 原材料类型ID列表（必填）
  isActive: boolean;      // 目标激活状态（必填）
}
```

**示例请求**:
```json
{
  "ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001"
  ],
  "isActive": false
}
```

##### 响应数据结构

**Success Response (200)**:
```typescript
interface ApiResponse<{ count: number }> {
  success: true;
  code: 200;
  message: "批量更新成功，共更新 2 条记录";
  data: {
    count: number;  // 实际更新的记录数
  };
  timestamp: string;
}
```

##### 业务逻辑说明

**批量更新流程**:
```typescript
const batchUpdateStatus = async (
  factoryId: string,
  ids: string[],
  isActive: boolean
): Promise<number> => {
  // 1. 查询所有匹配的记录
  const materialTypes = await materialTypeRepository.find({
    where: {
      id: In(ids),
      factoryId
    }
  });

  // 2. 更新状态
  materialTypes.forEach(mt => {
    mt.isActive = isActive;
    mt.updatedAt = new Date();
  });

  // 3. 批量保存
  await materialTypeRepository.save(materialTypes);

  return materialTypes.length;
};
```

---

#### 3.3.2 导出原材料列表

##### 端点基本信息

```http
GET /api/mobile/{factoryId}/materials/types/export
Authorization: Bearer {accessToken}
```

**功能**: 导出工厂所有原材料类型为Excel文件。

##### 响应数据结构

**Success Response (200)**:
```http
HTTP/1.1 200 OK
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="原材料类型列表_20250120_143025.xlsx"
Content-Length: 8192

[Binary Excel Data]
```

**Excel文件格式**:
| ID | 编码 | 名称 | 类别 | 单位 | 存储方式 | 描述 | 状态 | 创建时间 |
|----|------|------|------|------|----------|------|------|----------|
| uuid-1 | SWY | 三文鱼 | 海水鱼 | kg | 冷冻 | 挪威进口三文鱼 | 激活 | 2025-01-20 |
| uuid-2 | DY | 带鱼 | 海水鱼 | kg | 冷冻 | 东海带鱼 | 激活 | 2025-01-20 |

---

#### 3.3.3 批量导入原材料

##### 端点基本信息

```http
POST /api/mobile/{factoryId}/materials/types/import
Content-Type: multipart/form-data
Authorization: Bearer {accessToken}
```

**功能**: 从Excel文件批量导入原材料类型。

##### 请求参数详解

**Path Parameters**:
- `factoryId` (String, required): 工厂ID

**Form Data**:
- `file` (File, required): Excel文件（.xlsx格式，最大10MB）

**Excel文件格式要求**:
| 编码* | 名称* | 类别 | 单位 | 存储方式 | 描述 |
|-------|-------|------|------|----------|------|
| SWY | 三文鱼 | 海水鱼 | kg | 冷冻 | 挪威进口三文鱼 |
| DY | 带鱼 | 海水鱼 | kg | 冷冻 | 东海带鱼 |

**必填字段** (*标记):
- `编码`: 原材料编码（同工厂下唯一）
- `名称`: 原材料名称（同工厂下唯一）

##### 响应数据结构

**Success Response (200)**:
```typescript
interface ImportResult<MaterialType> {
  isFullSuccess: boolean;      // 是否全部成功
  successCount: number;        // 成功数量
  failureCount: number;        // 失败数量
  successRecords: MaterialType[];   // 成功创建的记录
  failureRecords: {            // 失败的记录
    row: number;               // 行号
    data: Record<string, any>; // 原始数据
    error: string;             // 错误原因
  }[];
}

interface ApiResponse<ImportResult<MaterialType>> {
  success: true;
  code: 200;
  message: "导入完成：成功10条，失败2条";
  data: ImportResult<MaterialType>;
  timestamp: string;
}
```

##### 业务逻辑说明

**导入流程**:
```typescript
const importMaterialTypesFromExcel = async (
  factoryId: string,
  fileStream: InputStream
): Promise<ImportResult<MaterialType>> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.read(fileStream);
  const worksheet = workbook.getWorksheet(1);

  const successRecords: MaterialType[] = [];
  const failureRecords: FailureRecord[] = [];

  // 跳过表头，从第2行开始
  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
    const row = worksheet.getRow(rowIndex);

    try {
      // 1. 提取数据
      const data = {
        materialCode: row.getCell(1).value as string,
        name: row.getCell(2).value as string,
        category: row.getCell(3).value as string || null,
        unit: row.getCell(4).value as string || 'kg',
        storageType: row.getCell(5).value as string || null,
        description: row.getCell(6).value as string || null,
      };

      // 2. 验证必填字段
      if (!data.materialCode || !data.name) {
        throw new Error('缺少必填字段（编码或名称）');
      }

      // 3. 验证唯一性
      const codeExists = await checkCodeExists(factoryId, data.materialCode);
      if (codeExists) {
        throw new Error(`编码已存在: ${data.materialCode}`);
      }

      const nameExists = await checkNameExists(factoryId, data.name);
      if (nameExists) {
        throw new Error(`名称已存在: ${data.name}`);
      }

      // 4. 创建记录
      const newMaterial = await createMaterialType(factoryId, data);
      successRecords.push(newMaterial);

    } catch (error) {
      failureRecords.push({
        row: rowIndex,
        data: row.values,
        error: error.message,
      });
    }
  }

  return {
    isFullSuccess: failureRecords.length === 0,
    successCount: successRecords.length,
    failureCount: failureRecords.length,
    successRecords,
    failureRecords,
  };
};
```

---

#### 3.3.4 下载导入模板

##### 端点基本信息

```http
GET /api/mobile/{factoryId}/materials/types/export/template
Authorization: Bearer {accessToken}
```

**功能**: 下载原材料类型导入的Excel模板文件。

##### 响应数据结构

**Success Response (200)**:
```http
HTTP/1.1 200 OK
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="原材料类型导入模板.xlsx"
Content-Length: 4096

[Binary Excel Template Data]
```

##### 业务逻辑说明

**模板生成逻辑**:
```typescript
const generateImportTemplate = (): Buffer => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('原材料类型导入模板');

  // 1. 设置表头（带验证标识）
  worksheet.columns = [
    { header: '编码*', key: 'materialCode', width: 15 },
    { header: '名称*', key: 'name', width: 20 },
    { header: '类别', key: 'category', width: 15 },
    { header: '单位', key: 'unit', width: 10 },
    { header: '存储方式', key: 'storageType', width: 15 },
    { header: '描述', key: 'description', width: 30 },
  ];

  // 2. 添加示例数据
  worksheet.addRow({
    materialCode: 'SWY',
    name: '三文鱼',
    category: '海水鱼',
    unit: 'kg',
    storageType: '冷冻',
    description: '挪威进口三文鱼，肉质鲜美',
  });

  worksheet.addRow({
    materialCode: 'DY',
    name: '带鱼',
    category: '海水鱼',
    unit: 'kg',
    storageType: '冷冻',
    description: '东海带鱼',
  });

  // 3. 表头样式
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };

  // 4. 添加说明sheet
  const instructionSheet = workbook.addWorksheet('填写说明');
  instructionSheet.addRow(['字段说明']);
  instructionSheet.addRow(['']);
  instructionSheet.addRow(['带*的字段为必填项']);
  instructionSheet.addRow(['']);
  instructionSheet.addRow(['字段', '说明', '示例']);
  instructionSheet.addRow(['编码*', '原材料编码，同工厂下唯一', 'SWY']);
  instructionSheet.addRow(['名称*', '原材料名称，同工厂下唯一', '三文鱼']);
  instructionSheet.addRow(['类别', '原材料类别', '海水鱼']);
  instructionSheet.addRow(['单位', '计量单位，默认kg', 'kg']);
  instructionSheet.addRow(['存储方式', '冷冻/冷藏/常温', '冷冻']);
  instructionSheet.addRow(['描述', '原材料描述', '挪威进口三文鱼']);

  return workbook.xlsx.writeBuffer();
};
```

---

## 4. 数据模型

### 4.1 MaterialType实体

```typescript
interface MaterialType {
  // 主键和基础信息
  id: string;                      // UUID主键
  factoryId: string;               // 工厂ID（外键）

  // 标识信息
  materialCode: string;            // 原材料编码（同工厂下唯一）
  name: string;                    // 原材料名称（同工厂下唯一）

  // 分类信息
  category: string | null;         // 原材料类别（如：海水鱼、淡水鱼、贝类）
  storageType: string | null;      // 存储方式（冷冻/冷藏/常温）

  // 计量信息
  unit: string;                    // 计量单位（默认kg）

  // 描述信息
  description: string | null;      // 原材料描述

  // 状态信息
  isActive: boolean;               // 是否激活（默认true）

  // 时间戳
  createdAt: Date;                 // 创建时间（自动设置）
  updatedAt: Date;                 // 更新时间（自动更新）

  // 审计信息
  createdBy: number | null;        // 创建者用户ID
}
```

### 4.2 数据库约束

```sql
CREATE TABLE raw_material_types (
  id VARCHAR(191) PRIMARY KEY,
  factory_id VARCHAR(191) NOT NULL,
  material_code VARCHAR(191),
  name VARCHAR(191) NOT NULL,
  category VARCHAR(191),
  unit VARCHAR(191) NOT NULL DEFAULT 'kg',
  storage_type VARCHAR(191),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by INT,

  -- 唯一性约束
  UNIQUE KEY uk_factory_code (factory_id, material_code),
  UNIQUE KEY uk_factory_name (factory_id, name),

  -- 索引
  INDEX idx_factory_id (factory_id),
  INDEX idx_category (category),

  -- 外键
  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

---

## 5. 业务规则

### 5.1 唯一性约束

#### 原材料编码唯一性

**规则**: 同一工厂下，原材料编码必须唯一。

```typescript
// 验证逻辑
const checkCodeExists = async (
  factoryId: string,
  materialCode: string,
  excludeId?: string
): Promise<boolean> => {
  const query = materialTypeRepository.createQueryBuilder('mt')
    .where('mt.factoryId = :factoryId', { factoryId })
    .andWhere('mt.materialCode = :materialCode', { materialCode });

  // 更新时排除当前记录
  if (excludeId) {
    query.andWhere('mt.id != :excludeId', { excludeId });
  }

  const count = await query.getCount();
  return count > 0;
};
```

#### 原材料名称唯一性

**规则**: 同一工厂下，原材料名称必须唯一。

```typescript
const checkNameExists = async (
  factoryId: string,
  name: string,
  excludeId?: string
): Promise<boolean> => {
  const query = materialTypeRepository.createQueryBuilder('mt')
    .where('mt.factoryId = :factoryId', { factoryId })
    .andWhere('mt.name = :name', { name });

  if (excludeId) {
    query.andWhere('mt.id != :excludeId', { excludeId });
  }

  const count = await query.getCount();
  return count > 0;
};
```

### 5.2 分类规范

#### 原材料类别

**常见类别**:
- 海水鱼: 三文鱼、带鱼、金枪鱼等
- 淡水鱼: 鲈鱼、鲫鱼、草鱼等
- 贝类: 扇贝、蛤蜊、牡蛎等
- 虾类: 对虾、基围虾、龙虾等
- 蟹类: 梭子蟹、大闸蟹等
- 其他: 其他水产品

#### 存储方式

**存储方式枚举**:
```typescript
enum StorageType {
  FROZEN = '冷冻',      // -18°C及以下
  CHILLED = '冷藏',     // 0°C - 7°C
  ROOM_TEMP = '常温'    // 室温
}
```

**存储温度要求**:
| 存储方式 | 温度范围 | 适用场景 |
|---------|---------|---------|
| 冷冻 | ≤ -18°C | 长期保存，如海鲜、肉类 |
| 冷藏 | 0°C ~ 7°C | 短期保存，如鲜鱼、蔬菜 |
| 常温 | 15°C ~ 25°C | 干货、罐头、调料等 |

### 5.3 计量单位规范

**常用单位**:
- `kg`: 千克（默认，适用于大部分原材料）
- `g`: 克（适用于香料、调料）
- `L`: 升（适用于液体）
- `mL`: 毫升（适用于少量液体）
- `个`: 个（适用于整个计量的商品）
- `箱`: 箱（适用于批量包装）

---

## 6. 前端集成建议

### 6.1 完整的API Client

```typescript
// services/api/materialTypeApiClient.ts
import apiClient from './apiClient';
import {
  ApiResponse,
  Page,
  MaterialType,
  ImportResult,
} from '@/types';

export const materialTypeApiClient = {
  /**
   * 获取原材料类型列表
   */
  async getMaterialTypes(
    factoryId: string,
    params: {
      isActive?: boolean;
      page?: number;
      size?: number;
      sortBy?: string;
      sortDirection?: 'ASC' | 'DESC';
    } = {}
  ): Promise<Page<MaterialType>> {
    const response = await apiClient.get<ApiResponse<Page<MaterialType>>>(
      `/api/mobile/${factoryId}/materials/types`,
      { params }
    );
    return response.data.data;
  },

  /**
   * 创建原材料类型
   */
  async createMaterialType(
    factoryId: string,
    data: Partial<MaterialType>
  ): Promise<MaterialType> {
    const response = await apiClient.post<ApiResponse<MaterialType>>(
      `/api/mobile/${factoryId}/materials/types`,
      data
    );
    return response.data.data;
  },

  /**
   * 获取原材料类型详情
   */
  async getMaterialTypeById(
    factoryId: string,
    id: string
  ): Promise<MaterialType> {
    const response = await apiClient.get<ApiResponse<MaterialType>>(
      `/api/mobile/${factoryId}/materials/types/${id}`
    );
    return response.data.data;
  },

  /**
   * 更新原材料类型
   */
  async updateMaterialType(
    factoryId: string,
    id: string,
    data: Partial<MaterialType>
  ): Promise<MaterialType> {
    const response = await apiClient.put<ApiResponse<MaterialType>>(
      `/api/mobile/${factoryId}/materials/types/${id}`,
      data
    );
    return response.data.data;
  },

  /**
   * 删除原材料类型
   */
  async deleteMaterialType(
    factoryId: string,
    id: string
  ): Promise<void> {
    await apiClient.delete(
      `/api/mobile/${factoryId}/materials/types/${id}`
    );
  },

  /**
   * 获取激活的原材料类型
   */
  async getActiveMaterialTypes(
    factoryId: string
  ): Promise<MaterialType[]> {
    const response = await apiClient.get<ApiResponse<MaterialType[]>>(
      `/api/mobile/${factoryId}/materials/types/active`
    );
    return response.data.data;
  },

  /**
   * 按类别获取原材料类型
   */
  async getMaterialTypesByCategory(
    factoryId: string,
    category: string
  ): Promise<MaterialType[]> {
    const response = await apiClient.get<ApiResponse<MaterialType[]>>(
      `/api/mobile/${factoryId}/materials/types/category/${category}`
    );
    return response.data.data;
  },

  /**
   * 按存储方式获取原材料类型
   */
  async getMaterialTypesByStorageType(
    factoryId: string,
    storageType: string
  ): Promise<MaterialType[]> {
    const response = await apiClient.get<ApiResponse<MaterialType[]>>(
      `/api/mobile/${factoryId}/materials/types/storage-type/${storageType}`
    );
    return response.data.data;
  },

  /**
   * 搜索原材料类型
   */
  async searchMaterialTypes(
    factoryId: string,
    keyword: string,
    page: number = 0,
    size: number = 20
  ): Promise<Page<MaterialType>> {
    const response = await apiClient.get<ApiResponse<Page<MaterialType>>>(
      `/api/mobile/${factoryId}/materials/types/search`,
      {
        params: { keyword, page, size },
      }
    );
    return response.data.data;
  },

  /**
   * 检查编码是否存在
   */
  async checkCodeExists(
    factoryId: string,
    materialCode: string
  ): Promise<boolean> {
    const response = await apiClient.get<ApiResponse<{ exists: boolean }>>(
      `/api/mobile/${factoryId}/materials/types/check-code`,
      {
        params: { materialCode },
      }
    );
    return response.data.data.exists;
  },

  /**
   * 获取所有类别
   */
  async getCategories(factoryId: string): Promise<string[]> {
    const response = await apiClient.get<ApiResponse<string[]>>(
      `/api/mobile/${factoryId}/materials/types/categories`
    );
    return response.data.data;
  },

  /**
   * 获取低库存原材料
   */
  async getLowStockMaterials(factoryId: string): Promise<MaterialType[]> {
    const response = await apiClient.get<ApiResponse<MaterialType[]>>(
      `/api/mobile/${factoryId}/materials/types/low-stock`
    );
    return response.data.data;
  },

  /**
   * 批量更新状态
   */
  async batchUpdateStatus(
    factoryId: string,
    ids: string[],
    isActive: boolean
  ): Promise<number> {
    const response = await apiClient.put<ApiResponse<{ count: number }>>(
      `/api/mobile/${factoryId}/materials/types/batch/status`,
      { ids, isActive }
    );
    return response.data.data.count;
  },

  /**
   * 导出原材料列表
   */
  async exportMaterialTypes(factoryId: string): Promise<Blob> {
    const response = await apiClient.get(
      `/api/mobile/${factoryId}/materials/types/export`,
      {
        responseType: 'blob',
      }
    );
    return response.data;
  },

  /**
   * 批量导入原材料
   */
  async importMaterialTypes(
    factoryId: string,
    file: File
  ): Promise<ImportResult<MaterialType>> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<ApiResponse<ImportResult<MaterialType>>>(
      `/api/mobile/${factoryId}/materials/types/import`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.data;
  },

  /**
   * 下载导入模板
   */
  async downloadTemplate(factoryId: string): Promise<Blob> {
    const response = await apiClient.get(
      `/api/mobile/${factoryId}/materials/types/export/template`,
      {
        responseType: 'blob',
      }
    );
    return response.data;
  },
};

export default materialTypeApiClient;
```

---

## 📊 总结

### 端点覆盖

- **CRUD操作**: 5个端点（列表、创建、详情、更新、删除）
- **查询操作**: 7个端点（激活、按类别、按存储方式、搜索、检查编码、类别列表、低库存）
- **批量操作与导入导出**: 4个端点（批量更新、导出、导入、模板下载）

**总计**: 16个端点，100%完整覆盖原材料类型管理功能。

### 核心业务逻辑

1. **UUID主键**: 使用UUID作为主键，避免ID冲突
2. **双重唯一性**: 编码和名称同工厂下唯一
3. **分类管理**: 支持类别和存储方式分类
4. **库存预警**: 自动识别低库存原材料
5. **批量操作**: 支持批量状态更新和Excel导入导出
6. **软删除**: 使用 `isActive` 字段实现软删除

### 前端集成要点

- ✅ 完整的TypeScript类型定义
- ✅ UUID主键处理
- ✅ 实时编码验证（防抖）
- ✅ 分类和存储方式下拉选择
- ✅ Excel导入导出支持
- ✅ 低库存预警提醒

---

**文档状态**: ✅ 已完成
**最后更新**: 2025-01-20
**维护者**: Cretas Backend Team
