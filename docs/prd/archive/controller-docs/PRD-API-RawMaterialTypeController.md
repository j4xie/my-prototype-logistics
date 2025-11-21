# PRD-API-RawMaterialTypeController

**控制器**: RawMaterialTypeController
**基础路径**: `/api/mobile/{factoryId}/raw-material-types`
**功能**: 原材料类型管理
**端点数量**: 14个
**文档版本**: v1.0.0
**最后更新**: 2025-01-20

---

## 📋 目录

- [控制器概览](#控制器概览)
- [API端点列表](#api端点列表)
- [详细API文档](#详细api文档)
- [前端集成指南](#前端集成指南)
- [业务规则](#业务规则)
- [错误处理](#错误处理)

---

## 控制器概览

### 核心功能
RawMaterialTypeController提供**原材料类型管理功能**，用于定义和管理食品生产中使用的各种原材料类型，包括原材料的基本信息、存储要求、库存阈值、保质期等关键信息。

### 技术特点
- **完整的CRUD**: 创建、读取、更新、删除原材料类型
- **多维度查询**: 按类别、存储类型、激活状态等查询
- **库存管理**: 支持最小/最大库存阈值设置
- **保质期管理**: 支持设置不同原材料的保质期
- **存储类型**: 支持冷藏(fresh)、冷冻(frozen)、干燥(dry)等存储类型
- **价格管理**: 记录单位价格，便于成本计算
- **批量操作**: 支持批量更新状态
- **库存预警**: 自动检测低于最小库存的原材料

### 业务价值
- 规范原材料分类和管理
- 支持精确的库存管理
- 保障食品安全(保质期管理)
- 优化采购计划(库存阈值)
- 成本核算基础数据
- 质量追溯的起点

---

## API端点列表

### 1. 基础CRUD操作 (5个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| POST | `/` | 创建原材料类型 | 认证用户 |
| GET | `/{id}` | 获取原材料类型详情 | 认证用户 |
| GET | `/` | 获取原材料类型列表(分页) | 认证用户 |
| PUT | `/{id}` | 更新原材料类型 | 认证用户 |
| DELETE | `/{id}` | 删除原材料类型 | 认证用户 |

### 2. 查询操作 (7个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| GET | `/active` | 获取所有激活的原材料类型 | 认证用户 |
| GET | `/category/{category}` | 根据类别获取原材料类型 | 认证用户 |
| GET | `/storage-type/{storageType}` | 根据存储类型获取原材料类型 | 认证用户 |
| GET | `/search` | 搜索原材料类型 | 认证用户 |
| GET | `/categories` | 获取所有原材料类别 | 认证用户 |
| GET | `/low-stock` | 获取库存预警的原材料 | 认证用户 |
| GET | `/check-code` | 检查原材料编码是否存在 | 认证用户 |

### 3. 批量操作 (1个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| PUT | `/batch/status` | 批量更新状态 | 认证用户 |

---

## 详细API文档

## 1. 基础CRUD操作

### 1.1 创建原材料类型

**接口定义**
```
POST /api/mobile/{factoryId}/raw-material-types
```

**功能描述**
创建新的原材料类型，定义原材料的基本属性、存储要求、库存阈值等信息。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| Authorization | String | Header | 否 | 访问令牌(Bearer token) |

**请求Body**
```typescript
interface RawMaterialTypeDTO {
  code: string;               // 原材料编码(必填, 唯一)
  name: string;               // 原材料名称(必填)
  category?: string;          // 类别(可选)
  unit: string;               // 单位(必填): kg/g/L/ml/件/箱等
  unitPrice?: number;         // 单位价格(可选)
  storageType?: string;       // 存储类型(可选): fresh/frozen/dry
  shelfLifeDays?: number;     // 保质期天数(可选)
  minStock?: number;          // 最小库存(可选)
  maxStock?: number;          // 最大库存(可选)
  isActive?: boolean;         // 是否激活(可选, 默认true)
  notes?: string;             // 备注(可选)
}
```

**请求示例**
```json
{
  "code": "RAW_MEAT_PORK_001",
  "name": "猪肉(五花肉)",
  "category": "肉类",
  "unit": "kg",
  "unitPrice": 38.50,
  "storageType": "fresh",
  "shelfLifeDays": 3,
  "minStock": 100.0,
  "maxStock": 500.0,
  "isActive": true,
  "notes": "需冷藏保存，温度0-4℃"
}
```

**响应数据结构**
```typescript
interface RawMaterialTypeDTO {
  id: string;
  factoryId: string;
  code: string;
  name: string;
  category?: string;
  unit: string;
  unitPrice?: number;
  storageType?: string;       // fresh/frozen/dry
  shelfLifeDays?: number;
  minStock?: number;
  maxStock?: number;
  isActive: boolean;
  notes?: string;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;

  // 关联信息
  factoryName?: string;
  createdByName?: string;

  // 统计信息
  totalBatches?: number;      // 总批次数
  currentStock?: number;      // 当前库存
  totalValue?: number;        // 库存总价值
}
```

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "RMT_001",
    "factoryId": "CRETAS_2024_001",
    "code": "RAW_MEAT_PORK_001",
    "name": "猪肉(五花肉)",
    "category": "肉类",
    "unit": "kg",
    "unitPrice": 38.50,
    "storageType": "fresh",
    "shelfLifeDays": 3,
    "minStock": 100.0,
    "maxStock": 500.0,
    "isActive": true,
    "notes": "需冷藏保存，温度0-4℃",
    "createdBy": 1,
    "createdAt": "2025-01-20T10:30:00",
    "updatedAt": "2025-01-20T10:30:00",
    "factoryName": "白垩纪食品厂",
    "createdByName": "管理员",
    "totalBatches": 0,
    "currentStock": 0.0,
    "totalValue": 0.00
  }
}
```

**业务规则**
- code必须唯一(同一工厂内)
- storageType可选值: fresh(冷藏), frozen(冷冻), dry(干燥常温)
- shelfLifeDays: 保质期天数，用于计算过期日期
- minStock/maxStock: 用于库存预警和采购建议
- 系统自动记录创建人(从Authorization token获取)

---

### 1.2 获取原材料类型详情

**接口定义**
```
GET /api/mobile/{factoryId}/raw-material-types/{id}
```

**功能描述**
根据ID获取单个原材料类型的详细信息，包含统计数据。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| id | String | Path | 是 | 原材料类型ID |

**响应**
返回单个RawMaterialTypeDTO对象(包含统计信息)。

---

### 1.3 获取原材料类型列表

**接口定义**
```
GET /api/mobile/{factoryId}/raw-material-types?page={page}&size={size}
```

**功能描述**
分页获取原材料类型列表。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| page | Integer | Query | 否 | 页码，默认1 |
| size | Integer | Query | 否 | 每页大小，默认20 |

**响应数据结构**
```typescript
interface PageResponse<RawMaterialTypeDTO> {
  items: RawMaterialTypeDTO[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
```

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "RMT_001",
        "code": "RAW_MEAT_PORK_001",
        "name": "猪肉(五花肉)",
        "category": "肉类",
        "unit": "kg",
        "unitPrice": 38.50,
        "storageType": "fresh",
        "currentStock": 250.0,
        "totalValue": 9625.00,
        "isActive": true,
        ...
      }
    ],
    "total": 50,
    "page": 1,
    "size": 20,
    "totalPages": 3,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

---

### 1.4 更新原材料类型

**接口定义**
```
PUT /api/mobile/{factoryId}/raw-material-types/{id}
```

**功能描述**
更新原材料类型信息。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| id | String | Path | 是 | 原材料类型ID |

**请求Body**
与创建时相同，所有字段可选(除code外)。

**响应**
返回更新后的RawMaterialTypeDTO对象。

**业务规则**
- 不能修改code(原材料编码)
- 不能修改id和factoryId

---

### 1.5 删除原材料类型

**接口定义**
```
DELETE /api/mobile/{factoryId}/raw-material-types/{id}
```

**功能描述**
删除原材料类型。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| id | String | Path | 是 | 原材料类型ID |

**响应**
```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

**业务规则**
- 如果原材料类型有关联的批次记录，不允许删除
- 建议使用"停用"(isActive=false)而非删除
- 删除后不可恢复

---

## 2. 查询操作

### 2.1 获取所有激活的原材料类型

**接口定义**
```
GET /api/mobile/{factoryId}/raw-material-types/active
```

**功能描述**
获取所有isActive=true的原材料类型，用于下拉选择等场景。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |

**响应**
返回RawMaterialTypeDTO[]数组(所有激活的原材料)。

---

### 2.2 根据类别获取原材料类型

**接口定义**
```
GET /api/mobile/{factoryId}/raw-material-types/category/{category}
```

**功能描述**
获取指定类别的所有原材料类型。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| category | String | Path | 是 | 原材料类别 |

**响应**
返回RawMaterialTypeDTO[]数组。

**示例**
```
GET /api/mobile/CRETAS_2024_001/raw-material-types/category/肉类
```

---

### 2.3 根据存储类型获取原材料类型

**接口定义**
```
GET /api/mobile/{factoryId}/raw-material-types/storage-type/{storageType}
```

**功能描述**
获取指定存储类型的所有原材料类型，用于分区管理。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| storageType | String | Path | 是 | 存储类型: fresh/frozen/dry |

**响应**
返回RawMaterialTypeDTO[]数组。

**示例**
```
GET /api/mobile/CRETAS_2024_001/raw-material-types/storage-type/frozen
```

---

### 2.4 搜索原材料类型

**接口定义**
```
GET /api/mobile/{factoryId}/raw-material-types/search?keyword={keyword}&page={page}&size={size}
```

**功能描述**
根据关键字搜索原材料类型(支持按名称、编码、类别搜索)。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| keyword | String | Query | 是 | 搜索关键字 |
| page | Integer | Query | 否 | 页码，默认1 |
| size | Integer | Query | 否 | 每页大小，默认20 |

**响应**
返回PageResponse<RawMaterialTypeDTO>。

**业务规则**
- 搜索字段: name, code, category
- 模糊匹配
- 按相关度排序

---

### 2.5 获取所有原材料类别

**接口定义**
```
GET /api/mobile/{factoryId}/raw-material-types/categories
```

**功能描述**
获取当前工厂所有原材料的类别列表，用于类别筛选。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |

**响应**
```json
{
  "code": 200,
  "message": "success",
  "data": [
    "肉类",
    "蔬菜",
    "调料",
    "包装材料",
    "添加剂"
  ]
}
```

**业务规则**
- 返回所有不重复的category值
- 按字母顺序排列
- 不包含null或空字符串

---

### 2.6 获取库存预警的原材料

**接口定义**
```
GET /api/mobile/{factoryId}/raw-material-types/low-stock
```

**功能描述**
获取当前库存低于最小库存阈值的原材料类型，用于采购预警。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |

**响应**
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "RMT_001",
      "code": "RAW_MEAT_PORK_001",
      "name": "猪肉(五花肉)",
      "currentStock": 80.0,
      "minStock": 100.0,
      "maxStock": 500.0,
      "deficit": 20.0,          // 缺口
      "unit": "kg",
      "unitPrice": 38.50,
      "suggestedPurchase": 420.0  // 建议采购量(max - current)
    }
  ]
}
```

**业务规则**
- 筛选条件: currentStock < minStock
- 按缺口(minStock - currentStock)降序排列
- 建议采购量 = maxStock - currentStock

---

### 2.7 检查原材料编码是否存在

**接口定义**
```
GET /api/mobile/{factoryId}/raw-material-types/check-code?code={code}&excludeId={excludeId}
```

**功能描述**
检查原材料编码是否已存在，用于创建/编辑时的唯一性验证。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| code | String | Query | 是 | 原材料编码 |
| excludeId | String | Query | 否 | 排除的ID(编辑时使用) |

**响应**
```json
{
  "code": 200,
  "message": "success",
  "data": true  // true表示已存在，false表示不存在
}
```

**使用场景**
- 创建时: 不传excludeId，检查code是否已存在
- 编辑时: 传excludeId，排除自身检查其他是否重复

---

## 3. 批量操作

### 3.1 批量更新状态

**接口定义**
```
PUT /api/mobile/{factoryId}/raw-material-types/batch/status?isActive={isActive}
```

**功能描述**
批量更新多个原材料类型的激活状态。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| isActive | Boolean | Query | 是 | 激活状态: true/false |

**请求Body**
```json
["RMT_001", "RMT_002", "RMT_003"]  // 原材料类型ID列表
```

**响应**
```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

**业务规则**
- 单次批量操作限制: 最多100个
- 不存在的ID会被忽略
- 部分成功也返回成功

---

## 前端集成指南

### API客户端封装

```typescript
// rawMaterialTypeApiClient.ts
import { apiClient } from './apiClient';
import type { RawMaterialTypeDTO } from '../types/material';
import type { PageResponse } from '../types/common';

export const rawMaterialTypeApiClient = {
  // 1. 基础CRUD
  create: async (
    factoryId: string,
    data: Partial<RawMaterialTypeDTO>
  ): Promise<RawMaterialTypeDTO> => {
    return apiClient.post(`/api/mobile/${factoryId}/raw-material-types`, data);
  },

  getById: async (
    factoryId: string,
    id: string
  ): Promise<RawMaterialTypeDTO> => {
    return apiClient.get(`/api/mobile/${factoryId}/raw-material-types/${id}`);
  },

  getList: async (
    factoryId: string,
    page: number = 1,
    size: number = 20
  ): Promise<PageResponse<RawMaterialTypeDTO>> => {
    return apiClient.get(`/api/mobile/${factoryId}/raw-material-types`, {
      params: { page, size },
    });
  },

  update: async (
    factoryId: string,
    id: string,
    data: Partial<RawMaterialTypeDTO>
  ): Promise<RawMaterialTypeDTO> => {
    return apiClient.put(`/api/mobile/${factoryId}/raw-material-types/${id}`, data);
  },

  delete: async (factoryId: string, id: string): Promise<void> => {
    return apiClient.delete(`/api/mobile/${factoryId}/raw-material-types/${id}`);
  },

  // 2. 查询操作
  getActive: async (factoryId: string): Promise<RawMaterialTypeDTO[]> => {
    return apiClient.get(`/api/mobile/${factoryId}/raw-material-types/active`);
  },

  getByCategory: async (
    factoryId: string,
    category: string
  ): Promise<RawMaterialTypeDTO[]> => {
    return apiClient.get(`/api/mobile/${factoryId}/raw-material-types/category/${category}`);
  },

  getByStorageType: async (
    factoryId: string,
    storageType: string
  ): Promise<RawMaterialTypeDTO[]> => {
    return apiClient.get(`/api/mobile/${factoryId}/raw-material-types/storage-type/${storageType}`);
  },

  search: async (
    factoryId: string,
    keyword: string,
    page: number = 1,
    size: number = 20
  ): Promise<PageResponse<RawMaterialTypeDTO>> => {
    return apiClient.get(`/api/mobile/${factoryId}/raw-material-types/search`, {
      params: { keyword, page, size },
    });
  },

  getCategories: async (factoryId: string): Promise<string[]> => {
    return apiClient.get(`/api/mobile/${factoryId}/raw-material-types/categories`);
  },

  getLowStock: async (factoryId: string): Promise<RawMaterialTypeDTO[]> => {
    return apiClient.get(`/api/mobile/${factoryId}/raw-material-types/low-stock`);
  },

  checkCode: async (
    factoryId: string,
    code: string,
    excludeId?: string
  ): Promise<boolean> => {
    return apiClient.get(`/api/mobile/${factoryId}/raw-material-types/check-code`, {
      params: { code, excludeId },
    });
  },

  // 3. 批量操作
  updateBatchStatus: async (
    factoryId: string,
    ids: string[],
    isActive: boolean
  ): Promise<void> => {
    return apiClient.put(
      `/api/mobile/${factoryId}/raw-material-types/batch/status`,
      ids,
      { params: { isActive } }
    );
  },
};
```

### React Native使用示例

```typescript
// RawMaterialTypeSelector.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { List, RadioButton, ActivityIndicator, Chip } from 'react-native-paper';
import { rawMaterialTypeApiClient } from '../services/api/rawMaterialTypeApiClient';
import type { RawMaterialTypeDTO } from '../types/material';

interface Props {
  factoryId: string;
  selectedId?: string;
  onSelect: (material: RawMaterialTypeDTO) => void;
}

export const RawMaterialTypeSelector: React.FC<Props> = ({
  factoryId,
  selectedId,
  onSelect,
}) => {
  const [materials, setMaterials] = useState<RawMaterialTypeDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaterials();
  }, [factoryId]);

  const loadMaterials = async () => {
    try {
      const data = await rawMaterialTypeApiClient.getActive(factoryId);
      setMaterials(data);
    } catch (error) {
      console.error('加载原材料类型失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator />;
  }

  const getStorageTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      fresh: '冷藏',
      frozen: '冷冻',
      dry: '常温',
    };
    return labels[type] || type;
  };

  return (
    <View style={styles.container}>
      <RadioButton.Group
        onValueChange={(value) => {
          const selected = materials.find((m) => m.id === value);
          if (selected) onSelect(selected);
        }}
        value={selectedId || ''}
      >
        {materials.map((material) => (
          <List.Item
            key={material.id}
            title={material.name}
            description={`${material.code} | ¥${material.unitPrice}/${material.unit}`}
            left={() => <RadioButton value={material.id} />}
            right={() => (
              <Chip style={styles.chip}>
                {getStorageTypeLabel(material.storageType)}
              </Chip>
            )}
          />
        ))}
      </RadioButton.Group>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chip: {
    alignSelf: 'center',
  },
});
```

---

## 业务规则

### 1. 存储类型(storageType)
- **fresh**(冷藏): 0-4℃冷藏，用于新鲜肉类、蔬菜等
- **frozen**(冷冻): -18℃以下冷冻，用于冷冻食品
- **dry**(常温): 常温干燥存储，用于调料、包装材料等

### 2. 保质期管理
- shelfLifeDays: 保质期天数
- 入库时自动计算过期日期 = 入库日期 + shelfLifeDays
- 用于库存过期预警

### 3. 库存阈值
- **minStock**: 最小库存，低于此值触发预警
- **maxStock**: 最大库存，建议采购量 = maxStock - currentStock
- 用于自动化采购建议

### 4. 价格管理
- unitPrice: 单位价格，用于成本计算
- 可定期更新反映市场价格变化
- 库存总价值 = currentStock × unitPrice

### 5. 编码规则
- code必须唯一(同一工厂内)
- 建议格式: RAW_{类别}_{名称}_{序号}
- 示例: RAW_MEAT_PORK_001

---

## 错误处理

### 错误码定义

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| 4001 | 原材料编码重复 | 修改编码 |
| 4002 | 原材料类型不存在 | 检查ID |
| 4003 | 原材料类型正在使用 | 不能删除，建议停用 |
| 4004 | storageType无效 | 使用fresh/frozen/dry |
| 4005 | 必填字段缺失 | 检查code/name/unit |
| 5001 | 服务器错误 | 稍后重试 |

### 错误处理示例

```typescript
try {
  // 创建前检查编码是否存在
  const exists = await rawMaterialTypeApiClient.checkCode(factoryId, code);
  if (exists) {
    Alert.alert('错误', '原材料编码已存在，请使用其他编码');
    return;
  }

  const material = await rawMaterialTypeApiClient.create(factoryId, data);
  Alert.alert('成功', '原材料类型创建成功');
} catch (error: any) {
  if (error.code === 4001) {
    Alert.alert('错误', '原材料编码已存在');
  } else {
    Alert.alert('错误', error.message || '创建失败');
  }
}
```

---

## 总结

RawMaterialTypeController提供了**完整的原材料类型管理功能**，包含:

✅ **14个API端点**: 覆盖CRUD、查询、批量操作
✅ **多维度管理**: 类别、存储类型、库存阈值、保质期
✅ **智能预警**: 库存预警、过期预警
✅ **灵活查询**: 按类别、存储类型、关键字搜索
✅ **成本核算**: 单位价格管理，库存价值计算
✅ **食品安全**: 保质期管理，存储要求规范
✅ **采购支持**: 库存阈值，自动采购建议

这套系统为食品生产提供了**全面的原材料管理基础**，支持质量追溯和成本控制。
