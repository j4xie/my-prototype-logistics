# PRD-API-ProductTypeController（产品类型管理控制器）

**文档版本**: v1.0.0
**创建日期**: 2025-11-20
**Controller路径**: `/api/mobile/{factoryId}/product-types`
**所属模块**: 产品管理模块
**Controller文件**: `ProductTypeController.java` (201行)

---

## 📋 目录 (Table of Contents)

1. [Controller概述](#controller概述)
2. [端点清单](#端点清单)
3. [详细API文档](#详细api文档)
   - [3.1 创建产品类型](#31-创建产品类型)
   - [3.2 更新产品类型](#32-更新产品类型)
   - [3.3 删除产品类型](#33-删除产品类型)
   - [3.4 获取产品类型详情](#34-获取产品类型详情)
   - [3.5 获取产品类型列表](#35-获取产品类型列表)
   - [3.6 获取激活的产品类型](#36-获取激活的产品类型)
   - [3.7 根据类别获取产品类型](#37-根据类别获取产品类型)
   - [3.8 搜索产品类型](#38-搜索产品类型)
   - [3.9 获取产品类别列表](#39-获取产品类别列表)
   - [3.10 批量更新状态](#310-批量更新状态)
   - [3.11 检查产品编码是否存在](#311-检查产品编码是否存在)
   - [3.12 初始化默认产品类型](#312-初始化默认产品类型)
4. [数据模型](#数据模型)
5. [业务规则](#业务规则)
6. [错误处理](#错误处理)
7. [前端集成指南](#前端集成指南)

---

## Controller概述

### 功能描述

**ProductTypeController** 负责管理工厂的产品类型（成品）信息，是生产计划和批次管理的基础。

**核心功能**:
- ✅ **产品类型管理**: CRUD操作（创建、查询、更新、删除）
- ✅ **产品分类**: 按类别组织产品（如肉制品、调理食品、速冻食品）
- ✅ **产品属性**: 单价、单位、生产时间、保质期、包装规格
- ✅ **产品搜索**: 关键词搜索、类别筛选
- ✅ **批量操作**: 批量激活/停用产品类型
- ✅ **编码验证**: 产品编码唯一性检查
- ✅ **快速初始化**: 一键初始化常见产品类型

**业务价值**:
- 📦 **产品标准化**: 统一产品定义，规范生产流程
- 💰 **成本核算**: 单价信息支持成本分析
- ⏱️ **生产排程**: 生产时间用于计划排期
- 📅 **库存管理**: 保质期支持库存预警
- 🏷️ **产品分类**: 类别管理便于统计分析

**使用场景**:
1. 工厂初始化时创建产品类型（如火腿肠、肉丸、香肠）
2. 创建生产计划时选择产品类型
3. 根据产品类别查看不同系列产品
4. 更新产品单价，重新核算成本
5. 停用过时产品，保持产品列表整洁

---

## 端点清单

| # | HTTP方法 | 端点路径 | 功能描述 | 权限要求 | E2E验证 |
|---|----------|----------|----------|----------|---------|
| 1 | POST | `/product-types` | 创建产品类型 | factory_*, workshop_manager | ⚪ 未验证 |
| 2 | PUT | `/product-types/{id}` | 更新产品类型 | factory_*, workshop_manager | ⚪ 未验证 |
| 3 | DELETE | `/product-types/{id}` | 删除产品类型（软删除） | factory_super_admin, factory_admin | ⚪ 未验证 |
| 4 | GET | `/product-types/{id}` | 获取产品类型详情 | factory_* | ⚪ 未验证 |
| 5 | GET | `/product-types` | 获取产品类型列表（分页） | factory_* | ⚪ 未验证 |
| 6 | GET | `/product-types/active` | 获取激活的产品类型 | factory_* | ⚪ 未验证 |
| 7 | GET | `/product-types/category/{category}` | 根据类别获取产品类型 | factory_* | ⚪ 未验证 |
| 8 | GET | `/product-types/search` | 搜索产品类型（关键词） | factory_* | ⚪ 未验证 |
| 9 | GET | `/product-types/categories` | 获取产品类别列表 | factory_* | ⚪ 未验证 |
| 10 | PUT | `/product-types/batch/status` | 批量更新状态（激活/停用） | factory_super_admin, factory_admin | ⚪ 未验证 |
| 11 | GET | `/product-types/check-code` | 检查产品编码是否存在 | factory_* | ⚪ 未验证 |
| 12 | POST | `/product-types/init-defaults` | 初始化默认产品类型 | factory_super_admin, factory_admin | ⚪ 未验证 |

**图例**:
- ✅ E2E已验证 (100%通过)
- ⚠️ E2E部分验证
- ⚪ 未验证（需要添加测试）

**端点统计**:
- **总计**: 12个端点
- **CRUD**: 4个（创建、查询、更新、删除）
- **查询端点**: 6个（列表、详情、激活、类别、搜索、分类列表）
- **管理端点**: 2个（批量状态、编码检查、初始化）

---

## 详细API文档

### 3.1 创建产品类型

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `POST /api/mobile/{factoryId}/product-types` |
| **功能** | 创建新的产品类型 |
| **权限** | `factory_super_admin`, `factory_admin`, `workshop_manager` |
| **限流** | 60次/分钟 |

#### 请求参数

**路径参数**:
```typescript
interface PathParams {
  factoryId: string;  // 工厂ID，例如 "CRETAS_2024_001"
}
```

**请求体**:
```typescript
interface CreateProductTypeRequest {
  code: string;                    // 必填，产品编码（工厂内唯一），1-50字符
  name: string;                    // 必填，产品名称，1-200字符
  category?: string;               // 可选，产品类别，1-50字符
  unit: string;                    // 必填，单位（如"kg", "箱", "件"）
  unitPrice?: number;              // 可选，单价（元）
  productionTimeMinutes?: number;  // 可选，生产时间（分钟）
  shelfLifeDays?: number;          // 可选，保质期（天）
  packageSpec?: string;            // 可选，包装规格（如"500g/袋"）
  isActive?: boolean;              // 可选，是否激活（默认true）
  notes?: string;                  // 可选，备注
}
```

**参数验证**:
- `code`: 必填，1-50字符，工厂内唯一
- `name`: 必填，1-200字符
- `unit`: 必填，1-20字符
- `unitPrice`: 可选，≥0
- `productionTimeMinutes`: 可选，≥0
- `shelfLifeDays`: 可选，≥0
- `packageSpec`: 可选，1-100字符

#### 响应结构

**成功响应** (200 OK):
```typescript
interface Response {
  code: 200;
  message: "操作成功";
  success: true;
  data: ProductTypeDTO;
}

interface ProductTypeDTO {
  id: string;                      // 产品类型ID（UUID）
  factoryId: string;               // 工厂ID
  code: string;                    // 产品编码
  name: string;                    // 产品名称
  category?: string;               // 产品类别
  unit: string;                    // 单位
  unitPrice?: number;              // 单价
  productionTimeMinutes?: number;  // 生产时间（分钟）
  shelfLifeDays?: number;          // 保质期（天）
  packageSpec?: string;            // 包装规格
  isActive: boolean;               // 是否激活
  notes?: string;                  // 备注
  createdBy: number;               // 创建者ID
  createdAt: string;               // 创建时间
  updatedAt: string;               // 更新时间
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "factoryId": "CRETAS_2024_001",
    "code": "P001",
    "name": "经典火腿肠",
    "category": "肉制品",
    "unit": "kg",
    "unitPrice": 28.50,
    "productionTimeMinutes": 120,
    "shelfLifeDays": 180,
    "packageSpec": "500g/袋，20袋/箱",
    "isActive": true,
    "notes": "主打产品",
    "createdBy": 1,
    "createdAt": "2025-01-16T10:00:00",
    "updatedAt": "2025-01-16T10:00:00"
  }
}
```

#### 核心业务逻辑

**创建流程**:
```
1. 验证请求参数（必填字段、格式、长度）
2. 检查产品编码code是否在工厂内唯一
3. 自动生成UUID作为产品类型ID
4. 设置createdBy为当前用户ID
5. 设置默认值:
   - isActive: true（默认激活）
   - unitPrice: 0（如未提供）
6. 保存到数据库
7. 返回创建的产品类型信息
```

**唯一性约束**:
- `code` 在同一工厂内必须唯一
- 数据库约束: `UNIQUE(factory_id, code)`

#### TypeScript代码示例

**API调用**:
```typescript
import { apiClient } from '@/services/api/apiClient';

interface CreateProductTypeRequest {
  code: string;
  name: string;
  category?: string;
  unit: string;
  unitPrice?: number;
  productionTimeMinutes?: number;
  shelfLifeDays?: number;
  packageSpec?: string;
  isActive?: boolean;
  notes?: string;
}

/**
 * 创建产品类型
 */
export const createProductType = async (
  factoryId: string,
  productType: CreateProductTypeRequest
): Promise<ApiResponse<ProductTypeDTO>> => {
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/product-types`,
    productType
  );

  return response.data;
};
```

**React Native表单组件**:
```typescript
import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { createProductType } from '@/services/api/productTypeApiClient';

const CreateProductTypeScreen: React.FC = () => {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
    unit: 'kg',
    unitPrice: '',
    productionTimeMinutes: '',
    shelfLifeDays: '',
    packageSpec: '',
    notes: '',
  });

  const handleSubmit = async () => {
    try {
      // 前端验证
      if (!formData.code || !formData.name || !formData.unit) {
        Alert.alert('验证失败', '请填写必填字段');
        return;
      }

      // 调用API
      const result = await createProductType('CRETAS_2024_001', {
        code: formData.code,
        name: formData.name,
        category: formData.category || undefined,
        unit: formData.unit,
        unitPrice: formData.unitPrice ? parseFloat(formData.unitPrice) : undefined,
        productionTimeMinutes: formData.productionTimeMinutes ? parseInt(formData.productionTimeMinutes) : undefined,
        shelfLifeDays: formData.shelfLifeDays ? parseInt(formData.shelfLifeDays) : undefined,
        packageSpec: formData.packageSpec || undefined,
        notes: formData.notes || undefined,
      });

      if (result.success) {
        Alert.alert('成功', '产品类型创建成功', [
          {
            text: '确定',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (error) {
      console.error('创建产品类型失败:', error);
      Alert.alert('错误', '创建产品类型失败，请重试');
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <TextInput
        placeholder="产品编码 *"
        value={formData.code}
        onChangeText={(text) => setFormData({ ...formData, code: text })}
      />
      <TextInput
        placeholder="产品名称 *"
        value={formData.name}
        onChangeText={(text) => setFormData({ ...formData, name: text })}
      />
      <TextInput
        placeholder="产品类别"
        value={formData.category}
        onChangeText={(text) => setFormData({ ...formData, category: text })}
      />
      <TextInput
        placeholder="单位 *"
        value={formData.unit}
        onChangeText={(text) => setFormData({ ...formData, unit: text })}
      />
      <TextInput
        placeholder="单价（元）"
        keyboardType="numeric"
        value={formData.unitPrice}
        onChangeText={(text) => setFormData({ ...formData, unitPrice: text })}
      />
      <TextInput
        placeholder="生产时间（分钟）"
        keyboardType="numeric"
        value={formData.productionTimeMinutes}
        onChangeText={(text) => setFormData({ ...formData, productionTimeMinutes: text })}
      />
      <TextInput
        placeholder="保质期（天）"
        keyboardType="numeric"
        value={formData.shelfLifeDays}
        onChangeText={(text) => setFormData({ ...formData, shelfLifeDays: text })}
      />
      <TextInput
        placeholder="包装规格"
        value={formData.packageSpec}
        onChangeText={(text) => setFormData({ ...formData, packageSpec: text })}
      />
      <Button title="创建产品类型" onPress={handleSubmit} />
    </View>
  );
};
```

---

### 3.2 更新产品类型

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/product-types/{id}` |
| **功能** | 更新现有产品类型信息 |
| **权限** | `factory_super_admin`, `factory_admin`, `workshop_manager` |
| **限流** | 60次/分钟 |

#### 请求参数

**路径参数**:
```typescript
interface PathParams {
  factoryId: string;   // 工厂ID
  id: string;          // 产品类型ID
}
```

**请求体**: 同创建接口（所有字段可选，部分更新）

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "经典火腿肠（已更新）",
    "unitPrice": 30.00,
    "updatedAt": "2025-01-16T14:30:00"
  }
}
```

---

### 3.3 删除产品类型

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `DELETE /api/mobile/{factoryId}/product-types/{id}` |
| **功能** | 删除产品类型（软删除） |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 30次/分钟 |

#### 核心业务逻辑

**删除流程**:
```
1. 验证产品类型存在
2. 验证用户权限（仅super_admin和admin）
3. 检查是否有关联的生产计划或批次
4. 如果有关联数据，提示不能删除或软删除
5. 设置deletedAt时间戳（软删除）
6. 返回成功消息
```

---

### 3.4 获取产品类型详情

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/product-types/{id}` |
| **功能** | 根据ID获取单个产品类型的详细信息 |
| **权限** | `factory_*` |
| **限流** | 200次/分钟 |

---

### 3.5 获取产品类型列表

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/product-types` |
| **功能** | 分页获取产品类型列表 |
| **权限** | `factory_*` |
| **限流** | 100次/分钟 |

#### 请求参数

**查询参数**:
```typescript
interface QueryParams {
  page?: number;   // 页码，默认1
  size?: number;   // 每页大小，默认20
}
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": {
    "content": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "code": "P001",
        "name": "经典火腿肠",
        "category": "肉制品",
        "unit": "kg",
        "unitPrice": 28.50,
        "isActive": true
      }
    ],
    "totalElements": 25,
    "totalPages": 2,
    "currentPage": 1,
    "size": 20,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

---

### 3.6 获取激活的产品类型

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/product-types/active` |
| **功能** | 获取所有激活状态的产品类型（不分页） |
| **权限** | `factory_*` |
| **限流** | 100次/分钟 |

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "code": "P001",
      "name": "经典火腿肠",
      "category": "肉制品",
      "unit": "kg",
      "unitPrice": 28.50,
      "isActive": true
    }
  ]
}
```

#### 核心业务逻辑

**查询条件**:
```sql
SELECT * FROM product_types
WHERE factory_id = ? AND is_active = true AND deleted_at IS NULL
ORDER BY category ASC, name ASC
```

**使用场景**:
- 创建生产计划时选择产品类型
- 下拉列表显示可用产品

---

### 3.7 根据类别获取产品类型

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/product-types/category/{category}` |
| **功能** | 获取指定类别的产品类型 |
| **权限** | `factory_*` |
| **限流** | 100次/分钟 |

#### 请求参数

**路径参数**:
```typescript
interface PathParams {
  factoryId: string;
  category: string;  // 产品类别，如"肉制品"
}
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "code": "P001",
      "name": "经典火腿肠",
      "category": "肉制品",
      "unitPrice": 28.50
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "code": "P002",
      "name": "香肠",
      "category": "肉制品",
      "unitPrice": 32.00
    }
  ]
}
```

---

### 3.8 搜索产品类型

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/product-types/search` |
| **功能** | 根据关键词搜索产品类型（名称或编码模糊匹配） |
| **权限** | `factory_*` |
| **限流** | 100次/分钟 |

#### 请求参数

**查询参数**:
```typescript
interface QueryParams {
  keyword: string;  // 必填，搜索关键词
  page?: number;    // 页码，默认1
  size?: number;    // 每页大小，默认20
}
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": {
    "content": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "code": "P001",
        "name": "经典火腿肠",
        "category": "肉制品"
      }
    ],
    "totalElements": 1,
    "totalPages": 1,
    "currentPage": 1,
    "size": 20
  }
}
```

#### 核心业务逻辑

**搜索规则**:
```sql
SELECT * FROM product_types
WHERE factory_id = ?
  AND deleted_at IS NULL
  AND (name LIKE CONCAT('%', ?, '%') OR code LIKE CONCAT('%', ?, '%'))
ORDER BY name ASC
LIMIT ? OFFSET ?
```

---

### 3.9 获取产品类别列表

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/product-types/categories` |
| **功能** | 获取所有产品类别（去重） |
| **权限** | `factory_*` |
| **限流** | 100次/分钟 |

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": [
    "肉制品",
    "调理食品",
    "速冻食品",
    "腌制品",
    "熏制品"
  ]
}
```

#### 核心业务逻辑

**查询规则**:
```sql
SELECT DISTINCT category FROM product_types
WHERE factory_id = ? AND deleted_at IS NULL AND category IS NOT NULL
ORDER BY category ASC
```

**使用场景**:
- 产品分类筛选器
- 创建产品时选择类别

---

### 3.10 批量更新状态

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/product-types/batch/status` |
| **功能** | 批量更新产品类型的激活状态 |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 30次/分钟 |

#### 请求参数

**请求体**:
```typescript
interface BatchUpdateStatusRequest {
  ids: string[];       // 必填，产品类型ID列表
  isActive: boolean;   // 必填，激活状态
}
```

**查询参数**:
```typescript
interface QueryParams {
  isActive: boolean;  // 必填，true=激活，false=停用
}
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": null
}
```

#### TypeScript代码示例

```typescript
/**
 * 批量更新产品类型状态
 */
export const batchUpdateProductTypeStatus = async (
  factoryId: string,
  ids: string[],
  isActive: boolean
): Promise<ApiResponse<void>> => {
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/product-types/batch/status`,
    ids,
    {
      params: { isActive },
    }
  );

  return response.data;
};

// 使用示例：批量停用过时产品
const selectedIds = ['id1', 'id2', 'id3'];
await batchUpdateProductTypeStatus('CRETAS_2024_001', selectedIds, false);
```

---

### 3.11 检查产品编码是否存在

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/product-types/check-code` |
| **功能** | 检查产品编码是否已存在（用于前端验证） |
| **权限** | `factory_*` |
| **限流** | 200次/分钟 |

#### 请求参数

**查询参数**:
```typescript
interface QueryParams {
  code: string;         // 必填，产品编码
  excludeId?: string;   // 可选，排除的产品ID（更新时使用）
}
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": true  // true=存在，false=不存在
}
```

#### TypeScript代码示例

```typescript
/**
 * 检查产品编码是否存在
 */
export const checkProductTypeCode = async (
  factoryId: string,
  code: string,
  excludeId?: string
): Promise<boolean> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/product-types/check-code`,
    {
      params: { code, excludeId },
    }
  );

  return response.data.data;
};

// 使用示例：前端实时验证
const [codeExists, setCodeExists] = useState(false);

const handleCodeChange = async (code: string) => {
  if (code.length >= 2) {
    const exists = await checkProductTypeCode('CRETAS_2024_001', code);
    setCodeExists(exists);
  }
};
```

---

### 3.12 初始化默认产品类型

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `POST /api/mobile/{factoryId}/product-types/init-defaults` |
| **功能** | 为工厂初始化默认的产品类型 |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 10次/分钟 |

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": null
}
```

#### 核心业务逻辑

**默认产品类型**:
```typescript
const defaultProductTypes = [
  {
    code: "P001",
    name: "经典火腿肠",
    category: "肉制品",
    unit: "kg",
    unitPrice: 28.50,
    productionTimeMinutes: 120,
    shelfLifeDays: 180,
    packageSpec: "500g/袋，20袋/箱"
  },
  {
    code: "P002",
    name: "香肠",
    category: "肉制品",
    unit: "kg",
    unitPrice: 32.00,
    productionTimeMinutes: 90,
    shelfLifeDays: 120,
    packageSpec: "250g/袋，40袋/箱"
  },
  {
    code: "P003",
    name: "肉丸",
    category: "肉制品",
    unit: "kg",
    unitPrice: 35.00,
    productionTimeMinutes: 60,
    shelfLifeDays: 90,
    packageSpec: "1kg/袋，10袋/箱"
  },
  {
    code: "P004",
    name: "培根",
    category: "腌制品",
    unit: "kg",
    unitPrice: 45.00,
    productionTimeMinutes: 1440,
    shelfLifeDays: 60,
    packageSpec: "200g/袋，50袋/箱"
  },
  {
    code: "P005",
    name: "烤肠",
    category: "速冻食品",
    unit: "kg",
    unitPrice: 38.00,
    productionTimeMinutes: 150,
    shelfLifeDays: 365,
    packageSpec: "400g/袋，25袋/箱"
  }
];
```

**初始化流程**:
```
1. 检查工厂是否已有产品类型
2. 如果已有，提示是否覆盖
3. 批量创建默认产品类型
4. 返回创建结果
```

**使用场景**:
- 工厂首次使用系统，快速初始化产品
- 演示环境快速准备数据

---

## 数据模型

### ProductType（产品类型）

```typescript
/**
 * 产品类型实体
 */
interface ProductType {
  // 主键
  id: string;                      // 产品类型ID（UUID）

  // 关联字段
  factoryId: string;               // 工厂ID

  // 基本信息
  code: string;                    // 产品编码（工厂内唯一）
  name: string;                    // 产品名称
  category?: string;               // 产品类别

  // 单位和价格
  unit: string;                    // 单位（kg, 箱, 件）
  unitPrice?: number;              // 单价（元）

  // 生产属性
  productionTimeMinutes?: number;  // 生产时间（分钟）
  shelfLifeDays?: number;          // 保质期（天）
  packageSpec?: string;            // 包装规格

  // 状态
  isActive: boolean;               // 是否激活

  // 其他
  notes?: string;                  // 备注

  // 审计字段
  createdBy: number;               // 创建者ID
  createdAt: string;               // 创建时间
  updatedAt: string;               // 更新时间
  deletedAt?: string;              // 删除时间（软删除）
}
```

### 数据库表结构

```sql
CREATE TABLE product_types (
  id VARCHAR(191) PRIMARY KEY,
  factory_id VARCHAR(191) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50),
  unit VARCHAR(20) NOT NULL,
  unit_price DECIMAL(10,2),
  production_time_minutes INT,
  shelf_life_days INT,
  package_spec VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,

  UNIQUE KEY unique_product_code (factory_id, code),
  INDEX idx_product_factory (factory_id),
  INDEX idx_product_is_active (is_active),

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

---

## 业务规则

### 1. 唯一性规则

**产品编码唯一性**:
- `code` 在同一工厂内必须唯一
- 数据库约束: `UNIQUE(factory_id, code)`

### 2. 产品分类规则

**常见产品类别**:
- 肉制品: 火腿肠、香肠、肉丸、培根
- 调理食品: 速冻水饺、速冻包子、速冻馄饨
- 速冻食品: 烤肠、鸡米花、鸡排
- 腌制品: 培根、腊肉、咸肉
- 熏制品: 熏鸡、熏鱼、熏肠

### 3. 单位规范

**常用单位**:
- `kg`: 千克（适用于大部分肉制品）
- `g`: 克（小包装产品）
- `箱`: 箱（批量销售）
- `件`: 件（单品计数）
- `袋`: 袋（包装单位）

### 4. 价格管理

**单价规则**:
- 单价为出厂价（不含税）
- 单价可为0（未定价产品）
- 单价更新后，历史生产批次不受影响

### 5. 生产时间规则

**生产时间计算**:
```typescript
// 生产时间用于生产排期
const estimatedCompletionTime = new Date(
  startTime.getTime() + productionTimeMinutes * 60 * 1000
);

// 多批次并行生产
const totalProductionTime = Math.max(
  ...batches.map(b => b.productType.productionTimeMinutes)
);
```

### 6. 保质期管理

**保质期预警**:
```typescript
// 计算过期日期
const expiryDate = new Date(
  productionDate.getTime() + shelfLifeDays * 24 * 60 * 60 * 1000
);

// 预警规则
const daysUntilExpiry = Math.floor(
  (expiryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
);

if (daysUntilExpiry <= 0) {
  status = '已过期';
} else if (daysUntilExpiry <= 7) {
  status = '即将过期';
} else if (daysUntilExpiry <= 30) {
  status = '临期';
} else {
  status = '正常';
}
```

---

## 错误处理

### 错误码列表

| HTTP状态码 | 错误码 | 错误信息 | 说明 |
|-----------|-------|---------|------|
| 400 | INVALID_PARAMETER | 参数验证失败 | 请求参数不符合规则 |
| 404 | PRODUCT_TYPE_NOT_FOUND | 产品类型不存在 | id无效 |
| 409 | DUPLICATE_CODE | 产品编码已存在 | code重复 |
| 409 | PRODUCT_TYPE_IN_USE | 产品类型已关联生产计划，无法删除 | 存在关联数据 |
| 403 | PERMISSION_DENIED | 权限不足 | 无权执行此操作 |

### 错误响应示例

**产品编码重复** (409):
```json
{
  "code": 409,
  "message": "产品编码已存在",
  "success": false,
  "error": {
    "type": "DUPLICATE_CODE",
    "details": {
      "code": "P001",
      "existingProductTypeId": "550e8400-e29b-41d4-a716-446655440001"
    }
  }
}
```

---

## 前端集成指南

### 完整API客户端实现

创建 `src/services/api/productTypeApiClient.ts`:

```typescript
import { apiClient } from './apiClient';
import type { ApiResponse, PageResponse } from '@/types/apiResponses';

/**
 * 产品类型API客户端
 */

// ============ 类型定义 ============

export interface ProductTypeDTO {
  id: string;
  factoryId: string;
  code: string;
  name: string;
  category?: string;
  unit: string;
  unitPrice?: number;
  productionTimeMinutes?: number;
  shelfLifeDays?: number;
  packageSpec?: string;
  isActive: boolean;
  notes?: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductTypeRequest {
  code: string;
  name: string;
  category?: string;
  unit: string;
  unitPrice?: number;
  productionTimeMinutes?: number;
  shelfLifeDays?: number;
  packageSpec?: string;
  isActive?: boolean;
  notes?: string;
}

// ============ API函数 ============

/**
 * 创建产品类型
 */
export const createProductType = async (
  factoryId: string,
  productType: CreateProductTypeRequest
): Promise<ApiResponse<ProductTypeDTO>> => {
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/product-types`,
    productType
  );

  return response.data;
};

/**
 * 更新产品类型
 */
export const updateProductType = async (
  factoryId: string,
  id: string,
  updates: Partial<CreateProductTypeRequest>
): Promise<ApiResponse<ProductTypeDTO>> => {
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/product-types/${id}`,
    updates
  );

  return response.data;
};

/**
 * 删除产品类型
 */
export const deleteProductType = async (
  factoryId: string,
  id: string
): Promise<ApiResponse<void>> => {
  const response = await apiClient.delete(
    `/api/mobile/${factoryId}/product-types/${id}`
  );

  return response.data;
};

/**
 * 获取产品类型详情
 */
export const getProductTypeById = async (
  factoryId: string,
  id: string
): Promise<ApiResponse<ProductTypeDTO>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/product-types/${id}`
  );

  return response.data;
};

/**
 * 获取产品类型列表（分页）
 */
export const getProductTypeList = async (
  factoryId: string,
  page: number = 1,
  size: number = 20
): Promise<ApiResponse<PageResponse<ProductTypeDTO>>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/product-types`,
    {
      params: { page, size },
    }
  );

  return response.data;
};

/**
 * 获取激活的产品类型
 */
export const getActiveProductTypes = async (
  factoryId: string
): Promise<ApiResponse<ProductTypeDTO[]>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/product-types/active`
  );

  return response.data;
};

/**
 * 根据类别获取产品类型
 */
export const getProductTypesByCategory = async (
  factoryId: string,
  category: string
): Promise<ApiResponse<ProductTypeDTO[]>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/product-types/category/${category}`
  );

  return response.data;
};

/**
 * 搜索产品类型
 */
export const searchProductTypes = async (
  factoryId: string,
  keyword: string,
  page: number = 1,
  size: number = 20
): Promise<ApiResponse<PageResponse<ProductTypeDTO>>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/product-types/search`,
    {
      params: { keyword, page, size },
    }
  );

  return response.data;
};

/**
 * 获取产品类别列表
 */
export const getProductCategories = async (
  factoryId: string
): Promise<ApiResponse<string[]>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/product-types/categories`
  );

  return response.data;
};

/**
 * 批量更新产品类型状态
 */
export const batchUpdateProductTypeStatus = async (
  factoryId: string,
  ids: string[],
  isActive: boolean
): Promise<ApiResponse<void>> => {
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/product-types/batch/status`,
    ids,
    {
      params: { isActive },
    }
  );

  return response.data;
};

/**
 * 检查产品编码是否存在
 */
export const checkProductTypeCode = async (
  factoryId: string,
  code: string,
  excludeId?: string
): Promise<boolean> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/product-types/check-code`,
    {
      params: { code, excludeId },
    }
  );

  return response.data.data;
};

/**
 * 初始化默认产品类型
 */
export const initializeDefaultProductTypes = async (
  factoryId: string
): Promise<ApiResponse<void>> => {
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/product-types/init-defaults`
  );

  return response.data;
};

// ============ 辅助函数 ============

/**
 * 格式化单价显示
 */
export const formatPrice = (price?: number): string => {
  if (price === undefined || price === null) return '未定价';
  return `¥${price.toFixed(2)}`;
};

/**
 * 计算过期日期
 */
export const calculateExpiryDate = (
  productionDate: Date,
  shelfLifeDays?: number
): Date | null => {
  if (!shelfLifeDays) return null;
  return new Date(
    productionDate.getTime() + shelfLifeDays * 24 * 60 * 60 * 1000
  );
};

/**
 * 获取过期状态
 */
export const getExpiryStatus = (
  expiryDate: Date | null
): 'expired' | 'expiring_soon' | 'near_expiry' | 'normal' => {
  if (!expiryDate) return 'normal';

  const daysUntilExpiry = Math.floor(
    (expiryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );

  if (daysUntilExpiry <= 0) return 'expired';
  if (daysUntilExpiry <= 7) return 'expiring_soon';
  if (daysUntilExpiry <= 30) return 'near_expiry';
  return 'normal';
};
```

---

## 总结

### 关键特性

1. **完整的CRUD操作**: 创建、查询、更新、删除产品类型
2. **产品分类管理**: 按类别组织和筛选产品
3. **灵活的搜索**: 关键词搜索、类别筛选
4. **批量操作**: 批量激活/停用产品
5. **编码验证**: 前端实时检查编码唯一性
6. **快速初始化**: 一键创建默认产品

### 使用建议

1. **编码规范**: 使用统一的编码规则（如P001, P002...）
2. **类别管理**: 合理规划产品类别，便于统计分析
3. **单价更新**: 定期更新单价，保持成本核算准确
4. **保质期设置**: 准确设置保质期，支持库存预警
5. **批量操作**: 使用批量停用功能管理过时产品

### 待实现功能

- 产品图片上传
- 产品配方管理（原材料配比）
- 产品营养成分表
- 产品条形码管理
- 产品成本模拟器

---

**文档结束**
