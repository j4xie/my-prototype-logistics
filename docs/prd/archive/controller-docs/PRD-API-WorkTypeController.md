# PRD-API-WorkTypeController

**控制器**: WorkTypeController
**基础路径**: `/api/mobile/{factoryId}/work-types`
**功能**: 工作类型管理
**端点数量**: 10个
**文档版本**: v1.0.0
**最后更新**: 2025-01-20

---

## 📋 目录

- [控制器概览](#控制器概览)
- [API端点列表](#api端点列表)
- [详细API文档](#详细api文档)
  - [1. 基础CRUD操作](#1-基础crud操作)
  - [2. 状态管理](#2-状态管理)
  - [3. 统计与查询](#3-统计与查询)
  - [4. 批量操作](#4-批量操作)
- [前端集成指南](#前端集成指南)
- [业务规则](#业务规则)
- [错误处理](#错误处理)

---

## 控制器概览

### 核心功能
WorkTypeController提供**工作类型管理功能**，用于定义和管理不同的工作类型(如生产操作、质检、维护等)，支持不同的计费模式(时薪、计件、日薪、月薪)、费率倍数(加班、假期、夜班)、危险等级等配置。

### 技术特点
- **多种计费模式**: 时薪(HOURLY)、计件(PIECE)、日薪(DAILY)、月薪(MONTHLY)
- **费率倍数**: 加班、假期、夜班等不同倍数
- **危险等级**: 0-5级危险等级，影响津贴
- **技能要求**: 支持设置所需技能和证书要求
- **显示顺序**: 可自定义显示顺序
- **活跃状态**: 支持启用/停用工作类型
- **统计分析**: 提供工作类型使用情况统计
- **默认初始化**: 可一键初始化默认工作类型

### 业务价值
- 规范工作类型分类和管理
- 支持灵活的薪资计算规则
- 提供危险作业津贴机制
- 便于工作分配和人员调度
- 支持数据分析和优化

---

## API端点列表

### 1. 基础CRUD操作 (5个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| POST | `/` | 创建工作类型 | ADMIN / MANAGER |
| GET | `/` | 获取工作类型列表(分页) | 所有用户 |
| GET | `/{id}` | 获取工作类型详情 | 所有用户 |
| PUT | `/{id}` | 更新工作类型 | ADMIN / MANAGER |
| DELETE | `/{id}` | 删除工作类型 | ADMIN |

### 2. 状态管理 (2个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| GET | `/active` | 获取所有活跃的工作类型 | 所有用户 |
| PUT | `/{id}/toggle-status` | 切换工作类型状态 | ADMIN / MANAGER |

### 3. 统计与查询 (1个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| GET | `/stats` | 获取工作类型统计信息 | 所有用户 |

### 4. 批量操作 (2个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| POST | `/initialize-defaults` | 初始化默认工作类型 | ADMIN |
| PUT | `/display-order` | 更新显示顺序 | ADMIN / MANAGER |

---

## 详细API文档

## 1. 基础CRUD操作

### 1.1 创建工作类型

**接口定义**
```
POST /api/mobile/{factoryId}/work-types
```

**功能描述**
创建新的工作类型，定义工作的计费模式、费率、危险等级等属性。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |

**请求Body**
```typescript
interface WorkTypeDTO {
  name: string;               // 工作类型名称(必填, ≤50字符)
  code?: string;              // 工作类型代码(可选, ≤20字符)
  description?: string;       // 描述(可选, ≤500字符)
  department?: string;        // 部门(可选, ≤50字符)
  billingType: string;        // 计费类型(必填): HOURLY/PIECE/DAILY/MONTHLY
  baseRate: number;           // 基础费率(必填, >0, ≤999999.99)
  overtimeRateMultiplier?: number;    // 加班倍率(可选, ≥1.0, ≤9.99)
  holidayRateMultiplier?: number;     // 假期倍率(可选, ≥1.0, ≤9.99)
  nightShiftRateMultiplier?: number;  // 夜班倍率(可选, ≥1.0, ≤9.99)
  hazardLevel?: number;       // 危险等级(可选, 0-5)
  certificationRequired?: boolean;    // 是否需要证书(可选)
  requiredSkills?: string;    // 所需技能(可选)
  isActive?: boolean;         // 是否活跃(可选, 默认true)
  isDefault?: boolean;        // 是否默认(可选, 默认false)
  displayOrder?: number;      // 显示顺序(可选, ≥0)
  color?: string;             // 颜色(可选, 格式:#RRGGBB)
  icon?: string;              // 图标(可选, ≤50字符)
}
```

**请求示例**
```json
{
  "name": "生产操作",
  "code": "PROD_OP",
  "description": "生产线操作工作",
  "department": "生产部",
  "billingType": "HOURLY",
  "baseRate": 25.00,
  "overtimeRateMultiplier": 1.5,
  "holidayRateMultiplier": 2.0,
  "nightShiftRateMultiplier": 1.3,
  "hazardLevel": 2,
  "certificationRequired": false,
  "requiredSkills": "基础操作培训",
  "isActive": true,
  "isDefault": false,
  "displayOrder": 1,
  "color": "#4caf50",
  "icon": "factory"
}
```

**响应数据结构**
```typescript
interface WorkTypeDTO {
  id: string;
  factoryId: string;
  name: string;
  code?: string;
  description?: string;
  department?: string;
  billingType: string;
  baseRate: number;
  overtimeRateMultiplier?: number;
  holidayRateMultiplier?: number;
  nightShiftRateMultiplier?: number;
  hazardLevel?: number;
  certificationRequired?: boolean;
  requiredSkills?: string;
  isActive: boolean;
  isDefault: boolean;
  displayOrder: number;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;

  // 计算字段
  activeEmployeeCount?: number;    // 活跃员工数
  totalWorkHours?: number;         // 总工作时长
  averageWorkHours?: number;       // 平均工作时长
}
```

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "WT_001",
    "factoryId": "CRETAS_2024_001",
    "name": "生产操作",
    "code": "PROD_OP",
    "description": "生产线操作工作",
    "department": "生产部",
    "billingType": "HOURLY",
    "baseRate": 25.00,
    "overtimeRateMultiplier": 1.5,
    "holidayRateMultiplier": 2.0,
    "nightShiftRateMultiplier": 1.3,
    "hazardLevel": 2,
    "certificationRequired": false,
    "requiredSkills": "基础操作培训",
    "isActive": true,
    "isDefault": false,
    "displayOrder": 1,
    "color": "#4caf50",
    "icon": "factory",
    "createdAt": "2025-01-20T10:30:00",
    "updatedAt": "2025-01-20T10:30:00"
  }
}
```

**业务规则**
- name必须唯一(同一工厂内)
- billingType必须是: HOURLY、PIECE、DAILY、MONTHLY之一
- baseRate必须大于0
- 费率倍数默认值: 加班1.5倍、假期2.0倍、夜班1.3倍
- hazardLevel范围: 0-5，0表示无危险，5表示高危
- color格式: #RRGGBB (6位十六进制)
- 同一工厂最多只能有一个isDefault=true的工作类型

---

### 1.2 获取工作类型列表

**接口定义**
```
GET /api/mobile/{factoryId}/work-types?page={page}&size={size}&sortBy={sortBy}&sortDirection={sortDirection}
```

**功能描述**
分页获取工作类型列表。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| page | Integer | Query | 否 | 页码，默认0(前端使用1-based，后端自动转换) |
| size | Integer | Query | 否 | 每页大小，默认20 |
| sortBy | String | Query | 否 | 排序字段，默认displayOrder |
| sortDirection | String | Query | 否 | 排序方向: ASC/DESC，默认ASC |

**响应数据结构**
```typescript
interface PageResponse<WorkTypeDTO> {
  items: WorkTypeDTO[];
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
        "id": "WT_001",
        "name": "生产操作",
        "billingType": "HOURLY",
        "baseRate": 25.00,
        "displayOrder": 1,
        "isActive": true,
        "activeEmployeeCount": 50,
        ...
      }
    ],
    "total": 10,
    "page": 1,
    "size": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false
  }
}
```

**业务规则**
- 默认按displayOrder升序排列
- 包含isActive=true和false的工作类型
- 支持的排序字段: displayOrder, name, createdAt, baseRate

---

### 1.3 获取工作类型详情

**接口定义**
```
GET /api/mobile/{factoryId}/work-types/{id}
```

**功能描述**
根据ID获取单个工作类型的详细信息。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| id | String | Path | 是 | 工作类型ID |

**响应**
返回单个WorkTypeDTO对象。

---

### 1.4 更新工作类型

**接口定义**
```
PUT /api/mobile/{factoryId}/work-types/{id}
```

**功能描述**
更新工作类型信息。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| id | String | Path | 是 | 工作类型ID |

**请求Body**
与创建时相同，所有字段可选。

**响应**
返回更新后的WorkTypeDTO对象。

**业务规则**
- 不能修改id和factoryId
- 修改isDefault=true时，自动将其他工作类型的isDefault设为false

---

### 1.5 删除工作类型

**接口定义**
```
DELETE /api/mobile/{factoryId}/work-types/{id}
```

**功能描述**
删除工作类型。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| id | String | Path | 是 | 工作类型ID |

**响应**
```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

**业务规则**
- 仅ADMIN角色可删除
- 如果工作类型正在使用(有关联的员工或工时记录)，不允许删除，需先解除关联
- 删除后不可恢复
- 建议使用"停用"(isActive=false)而非删除

---

## 2. 状态管理

### 2.1 获取所有活跃的工作类型

**接口定义**
```
GET /api/mobile/{factoryId}/work-types/active
```

**功能描述**
获取所有isActive=true的工作类型列表，用于下拉选择等场景。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |

**响应**
返回WorkTypeDTO[]数组。

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "WT_001",
      "name": "生产操作",
      "billingType": "HOURLY",
      "baseRate": 25.00,
      "displayOrder": 1,
      ...
    },
    {
      "id": "WT_002",
      "name": "质检",
      "billingType": "HOURLY",
      "baseRate": 28.00,
      "displayOrder": 2,
      ...
    }
  ]
}
```

**业务规则**
- 仅返回isActive=true的工作类型
- 按displayOrder升序排列
- 不分页，返回所有活跃记录

---

### 2.2 切换工作类型状态

**接口定义**
```
PUT /api/mobile/{factoryId}/work-types/{id}/toggle-status
```

**功能描述**
切换工作类型的活跃状态(isActive: true ↔ false)。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| id | String | Path | 是 | 工作类型ID |

**响应**
返回更新后的WorkTypeDTO对象。

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "WT_001",
    "isActive": false,  // 已切换为停用
    ...
  }
}
```

**业务规则**
- 如果isActive=true，切换为false
- 如果isActive=false，切换为true
- 停用的工作类型不会在下拉选择中显示
- 已有关联数据的工作类型也可以停用(不影响历史数据)

---

## 3. 统计与查询

### 3.1 获取工作类型统计信息

**接口定义**
```
GET /api/mobile/{factoryId}/work-types/stats
```

**功能描述**
获取工作类型的全面统计信息，包括总数、分布、使用情况等。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |

**响应数据结构**
```typescript
interface WorkTypeStats {
  // 基础统计
  totalTypes: number;         // 总工作类型数
  activeTypes: number;        // 活跃数
  inactiveTypes: number;      // 停用数

  // 分布统计
  typesByDepartment: {
    [department: string]: number;
  };
  typesByBillingType: {
    [billingType: string]: number;  // HOURLY/PIECE/DAILY/MONTHLY
  };
  typesByHazardLevel: {
    [level: number]: number;        // 0-5
  };

  // 证书要求
  typesRequiringCertification: number;

  // 使用情况
  mostUsedTypes: Array<{
    workTypeId: number;
    workTypeName: string;
    usageCount: number;           // 使用次数
    totalHours: number;           // 总工时
    employeeCount: number;        // 员工数
    totalPaid: number;            // 总支付
  }>;
  leastUsedTypes: Array<{
    // 同上
  }>;

  // 元信息
  lastUpdated: string;
}
```

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "totalTypes": 10,
    "activeTypes": 8,
    "inactiveTypes": 2,
    "typesByDepartment": {
      "生产部": 4,
      "质检部": 2,
      "仓储部": 2,
      "维护部": 2
    },
    "typesByBillingType": {
      "HOURLY": 7,
      "PIECE": 2,
      "DAILY": 1,
      "MONTHLY": 0
    },
    "typesByHazardLevel": {
      "0": 3,
      "1": 2,
      "2": 3,
      "3": 1,
      "4": 1,
      "5": 0
    },
    "typesRequiringCertification": 3,
    "mostUsedTypes": [
      {
        "workTypeId": 1,
        "workTypeName": "生产操作",
        "usageCount": 500,
        "totalHours": 4000.0,
        "employeeCount": 50,
        "totalPaid": 100000.00
      },
      {
        "workTypeId": 2,
        "workTypeName": "质检",
        "usageCount": 300,
        "totalHours": 2400.0,
        "employeeCount": 30,
        "totalPaid": 67200.00
      }
    ],
    "leastUsedTypes": [
      {
        "workTypeId": 10,
        "workTypeName": "临时维修",
        "usageCount": 5,
        "totalHours": 40.0,
        "employeeCount": 2,
        "totalPaid": 1200.00
      }
    ],
    "lastUpdated": "2025-01-20T10:30:00"
  }
}
```

**业务规则**
- 统计数据实时计算
- mostUsedTypes: 返回前5名
- leastUsedTypes: 返回后5名
- 按使用次数排序

---

## 4. 批量操作

### 4.1 初始化默认工作类型

**接口定义**
```
POST /api/mobile/{factoryId}/work-types/initialize-defaults
```

**功能描述**
一键初始化预定义的默认工作类型，适用于新工厂快速设置。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |

**响应**
```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

**默认工作类型**
系统会自动创建以下默认工作类型:

1. **生产操作** (HOURLY, ¥25/小时, 危险等级1)
2. **质检** (HOURLY, ¥28/小时, 危险等级0)
3. **维护** (HOURLY, ¥30/小时, 危险等级3)
4. **仓储** (HOURLY, ¥22/小时, 危险等级1)
5. **包装** (PIECE, ¥0.5/件, 危险等级0)
6. **搬运** (HOURLY, ¥20/小时, 危险等级2)
7. **清洁** (DAILY, ¥200/天, 危险等级0)
8. **管理** (MONTHLY, ¥8000/月, 危险等级0)

**业务规则**
- 仅ADMIN角色可执行
- 如果工厂已有工作类型，不会重复创建
- 初始化的工作类型isDefault=false
- 可以在初始化后修改或删除默认工作类型

---

### 4.2 更新显示顺序

**接口定义**
```
PUT /api/mobile/{factoryId}/work-types/display-order
```

**功能描述**
批量更新工作类型的显示顺序。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |

**请求Body**
```typescript
type DisplayOrderUpdate = Array<{
  id: string;               // 工作类型ID(必填)
  displayOrder: number;     // 新的显示顺序(必填, ≥0)
}>;
```

**请求示例**
```json
[
  { "id": "WT_001", "displayOrder": 1 },
  { "id": "WT_002", "displayOrder": 2 },
  { "id": "WT_003", "displayOrder": 3 },
  { "id": "WT_004", "displayOrder": 4 }
]
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
- 可以批量更新多个工作类型的显示顺序
- displayOrder可以重复(多个工作类型可以有相同的显示顺序)
- 建议使用1, 2, 3...或10, 20, 30...等间隔数字
- 更新后，列表会按新的displayOrder排序

---

## 前端集成指南

### API客户端封装

```typescript
// workTypeApiClient.ts
import { apiClient } from './apiClient';
import type {
  WorkTypeDTO,
  WorkTypeStats,
  DisplayOrderUpdate,
} from '../types/workType';
import type { PageResponse } from '../types/common';

export const workTypeApiClient = {
  // 1. 基础CRUD
  create: async (
    factoryId: string,
    workType: Partial<WorkTypeDTO>
  ): Promise<WorkTypeDTO> => {
    return apiClient.post(`/api/mobile/${factoryId}/work-types`, workType);
  },

  getList: async (
    factoryId: string,
    params?: {
      page?: number;
      size?: number;
      sortBy?: string;
      sortDirection?: string;
    }
  ): Promise<PageResponse<WorkTypeDTO>> => {
    return apiClient.get(`/api/mobile/${factoryId}/work-types`, { params });
  },

  getById: async (
    factoryId: string,
    id: string
  ): Promise<WorkTypeDTO> => {
    return apiClient.get(`/api/mobile/${factoryId}/work-types/${id}`);
  },

  update: async (
    factoryId: string,
    id: string,
    workType: Partial<WorkTypeDTO>
  ): Promise<WorkTypeDTO> => {
    return apiClient.put(`/api/mobile/${factoryId}/work-types/${id}`, workType);
  },

  delete: async (factoryId: string, id: string): Promise<void> => {
    return apiClient.delete(`/api/mobile/${factoryId}/work-types/${id}`);
  },

  // 2. 状态管理
  getActive: async (factoryId: string): Promise<WorkTypeDTO[]> => {
    return apiClient.get(`/api/mobile/${factoryId}/work-types/active`);
  },

  toggleStatus: async (
    factoryId: string,
    id: string
  ): Promise<WorkTypeDTO> => {
    return apiClient.put(`/api/mobile/${factoryId}/work-types/${id}/toggle-status`);
  },

  // 3. 统计
  getStats: async (factoryId: string): Promise<WorkTypeStats> => {
    return apiClient.get(`/api/mobile/${factoryId}/work-types/stats`);
  },

  // 4. 批量操作
  initializeDefaults: async (factoryId: string): Promise<void> => {
    return apiClient.post(`/api/mobile/${factoryId}/work-types/initialize-defaults`);
  },

  updateDisplayOrder: async (
    factoryId: string,
    updates: DisplayOrderUpdate[]
  ): Promise<void> => {
    return apiClient.put(`/api/mobile/${factoryId}/work-types/display-order`, updates);
  },
};
```

### React Native使用示例

#### 1. 工作类型选择器

```typescript
// WorkTypeSelector.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { List, RadioButton, ActivityIndicator } from 'react-native-paper';
import { workTypeApiClient } from '../services/api/workTypeApiClient';
import type { WorkTypeDTO } from '../types/workType';

interface Props {
  factoryId: string;
  selectedId?: string;
  onSelect: (workType: WorkTypeDTO) => void;
}

export const WorkTypeSelector: React.FC<Props> = ({
  factoryId,
  selectedId,
  onSelect,
}) => {
  const [workTypes, setWorkTypes] = useState<WorkTypeDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkTypes();
  }, [factoryId]);

  const loadWorkTypes = async () => {
    try {
      const data = await workTypeApiClient.getActive(factoryId);
      setWorkTypes(data);
    } catch (error) {
      console.error('加载工作类型失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator />;
  }

  return (
    <View style={styles.container}>
      <RadioButton.Group
        onValueChange={(value) => {
          const selected = workTypes.find((wt) => wt.id === value);
          if (selected) onSelect(selected);
        }}
        value={selectedId || ''}
      >
        {workTypes.map((workType) => (
          <List.Item
            key={workType.id}
            title={workType.name}
            description={`¥${workType.baseRate}/${getBillingTypeLabel(workType.billingType)}`}
            left={() => <RadioButton value={workType.id} />}
            right={() => (
              <View style={styles.badge}>
                {workType.hazardLevel > 0 && (
                  <Text style={styles.hazardBadge}>
                    危险等级{workType.hazardLevel}
                  </Text>
                )}
              </View>
            )}
          />
        ))}
      </RadioButton.Group>
    </View>
  );
};

const getBillingTypeLabel = (type: string) => {
  switch (type) {
    case 'HOURLY':
      return '小时';
    case 'PIECE':
      return '件';
    case 'DAILY':
      return '天';
    case 'MONTHLY':
      return '月';
    default:
      return '';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hazardBadge: {
    backgroundColor: '#ff9800',
    color: '#fff',
    padding: 4,
    borderRadius: 4,
    fontSize: 12,
  },
});
```

#### 2. 工作类型管理页面

```typescript
// WorkTypeManagementScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  FAB,
  IconButton,
} from 'react-native-paper';
import { workTypeApiClient } from '../services/api/workTypeApiClient';
import type { WorkTypeDTO } from '../types/workType';

export const WorkTypeManagementScreen: React.FC = () => {
  const [workTypes, setWorkTypes] = useState<WorkTypeDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const loadWorkTypes = async () => {
    setLoading(true);
    try {
      const factoryId = 'CRETAS_2024_001';
      const response = await workTypeApiClient.getList(factoryId);
      setWorkTypes(response.items);
    } catch (error) {
      console.error('加载工作类型失败:', error);
      Alert.alert('错误', '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkTypes();
  }, []);

  const handleToggleStatus = async (id: string) => {
    try {
      const factoryId = 'CRETAS_2024_001';
      await workTypeApiClient.toggleStatus(factoryId, id);
      Alert.alert('成功', '状态已更新');
      loadWorkTypes();
    } catch (error) {
      Alert.alert('错误', '状态更新失败');
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('确认删除', '确定要删除该工作类型吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            const factoryId = 'CRETAS_2024_001';
            await workTypeApiClient.delete(factoryId, id);
            Alert.alert('成功', '删除成功');
            loadWorkTypes();
          } catch (error) {
            Alert.alert('错误', '删除失败，可能该工作类型正在使用中');
          }
        },
      },
    ]);
  };

  const handleInitializeDefaults = async () => {
    Alert.alert('初始化默认工作类型', '将创建8个默认工作类型，继续吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: async () => {
          try {
            const factoryId = 'CRETAS_2024_001';
            await workTypeApiClient.initializeDefaults(factoryId);
            Alert.alert('成功', '默认工作类型已创建');
            loadWorkTypes();
          } catch (error) {
            Alert.alert('错误', '初始化失败');
          }
        },
      },
    ]);
  };

  const getBillingTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      HOURLY: '时薪',
      PIECE: '计件',
      DAILY: '日薪',
      MONTHLY: '月薪',
    };
    return labels[type] || type;
  };

  const renderItem = ({ item }: { item: WorkTypeDTO }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Title>{item.name}</Title>
            {item.code && <Paragraph>代码: {item.code}</Paragraph>}
          </View>
          <Chip
            style={{
              backgroundColor: item.isActive ? '#4caf50' : '#9e9e9e',
            }}
            textStyle={{ color: '#fff' }}
          >
            {item.isActive ? '活跃' : '停用'}
          </Chip>
        </View>

        {item.description && (
          <Paragraph style={styles.description}>{item.description}</Paragraph>
        )}

        <View style={styles.details}>
          <Paragraph>
            计费: {getBillingTypeLabel(item.billingType)} | 费率: ¥
            {item.baseRate}
          </Paragraph>
          {item.department && <Paragraph>部门: {item.department}</Paragraph>}
          {item.hazardLevel > 0 && (
            <Chip
              style={styles.hazardChip}
              textStyle={{ color: '#fff' }}
            >
              危险等级 {item.hazardLevel}
            </Chip>
          )}
        </View>

        <View style={styles.multipliers}>
          {item.overtimeRateMultiplier && (
            <Chip style={styles.chip}>
              加班 {item.overtimeRateMultiplier}x
            </Chip>
          )}
          {item.holidayRateMultiplier && (
            <Chip style={styles.chip}>
              假期 {item.holidayRateMultiplier}x
            </Chip>
          )}
          {item.nightShiftRateMultiplier && (
            <Chip style={styles.chip}>
              夜班 {item.nightShiftRateMultiplier}x
            </Chip>
          )}
        </View>
      </Card.Content>

      <Card.Actions>
        <Button onPress={() => handleToggleStatus(item.id)}>
          {item.isActive ? '停用' : '启用'}
        </Button>
        <Button onPress={() => {/* 导航到编辑页面 */}}>编辑</Button>
        <Button onPress={() => handleDelete(item.id)} color="#f44336">
          删除
        </Button>
      </Card.Actions>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={workTypes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadWorkTypes}
        ListHeaderComponent={
          <Button
            mode="outlined"
            onPress={handleInitializeDefaults}
            style={styles.initButton}
          >
            初始化默认工作类型
          </Button>
        }
      />

      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => {
          // 导航到创建页面
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  initButton: {
    margin: 16,
  },
  card: {
    margin: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
  },
  description: {
    color: '#666',
    marginBottom: 8,
  },
  details: {
    marginTop: 8,
  },
  multipliers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    marginRight: 4,
    marginTop: 4,
  },
  hazardChip: {
    backgroundColor: '#ff9800',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
```

---

## 业务规则

### 1. 计费类型(billingType)
- **HOURLY**(时薪): 按小时计费，baseRate表示每小时费率
- **PIECE**(计件): 按件数计费，baseRate表示每件费率
- **DAILY**(日薪): 按天计费，baseRate表示每天费率
- **MONTHLY**(月薪): 按月计费，baseRate表示每月费率

### 2. 费率倍数
- **加班倍数**(overtimeRateMultiplier): 默认1.5倍
- **假期倍数**(holidayRateMultiplier): 默认2.0倍
- **夜班倍数**(nightShiftRateMultiplier): 默认1.3倍
- 最终费率 = baseRate × 倍数

### 3. 危险等级(hazardLevel)
- 0: 无危险
- 1-2: 低危险
- 3-4: 中等危险
- 5: 高危险
- 危险等级影响津贴计算

### 4. 显示顺序(displayOrder)
- 用于前端显示排序
- 数字越小越靠前
- 可以重复
- 建议使用10的倍数(10, 20, 30...)便于插入

### 5. 状态管理
- isActive=true: 活跃，可在下拉选择中使用
- isActive=false: 停用，不显示在下拉选择中
- 停用不影响历史数据

### 6. 默认工作类型
- 每个工厂最多一个isDefault=true的工作类型
- 用于快速选择常用工作类型

---

## 错误处理

### 错误码定义

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| 4001 | 工作类型名称重复 | 修改名称 |
| 4002 | 工作类型不存在 | 检查ID |
| 4003 | 工作类型正在使用中 | 不能删除，建议停用 |
| 4004 | billingType无效 | 使用HOURLY/PIECE/DAILY/MONTHLY |
| 4005 | 费率超出范围 | 检查baseRate和倍数 |
| 4006 | 无权限操作 | 检查用户角色 |
| 5001 | 服务器错误 | 稍后重试 |

### 错误处理示例

```typescript
try {
  const workType = await workTypeApiClient.create(factoryId, data);
  Alert.alert('成功', '工作类型创建成功');
} catch (error: any) {
  if (error.code === 4001) {
    Alert.alert('错误', '工作类型名称已存在，请使用其他名称');
  } else if (error.code === 4004) {
    Alert.alert('错误', '计费类型无效');
  } else {
    Alert.alert('错误', error.message || '创建失败');
  }
}
```

---

## 总结

WorkTypeController提供了**完整的工作类型管理功能**，包含:

✅ **10个API端点**: 覆盖CRUD、状态管理、统计、批量操作
✅ **4种计费模式**: 时薪、计件、日薪、月薪
✅ **灵活的费率体系**: 基础费率 + 加班/假期/夜班倍数
✅ **危险等级管理**: 0-5级危险等级，影响津贴
✅ **技能和证书**: 支持设置所需技能和证书要求
✅ **显示顺序**: 可自定义排序
✅ **统计分析**: 提供丰富的使用情况统计
✅ **快速初始化**: 一键创建8种默认工作类型

这套系统为工厂提供了**灵活的工作分类和薪资计算基础**，支持多样化的用工模式。
