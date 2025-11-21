# PRD-API-DepartmentController（部门管理控制器）

**文档版本**: v1.0.0
**创建日期**: 2025-11-20
**Controller路径**: `/api/mobile/{factoryId}/departments`
**所属模块**: 组织架构管理模块
**Controller文件**: `DepartmentController.java` (210行)

---

## 📋 目录 (Table of Contents)

1. [Controller概述](#controller概述)
2. [端点清单](#端点清单)
3. [详细API文档](#详细api文档)
   - [3.1 创建部门](#31-创建部门)
   - [3.2 获取部门列表](#32-获取部门列表)
   - [3.3 获取所有活跃部门](#33-获取所有活跃部门)
   - [3.4 获取部门详情](#34-获取部门详情)
   - [3.5 更新部门](#35-更新部门)
   - [3.6 删除部门](#36-删除部门)
   - [3.7 搜索部门](#37-搜索部门)
   - [3.8 获取部门树形结构](#38-获取部门树形结构)
   - [3.9 检查部门编码是否存在](#39-检查部门编码是否存在)
   - [3.10 初始化默认部门](#310-初始化默认部门)
   - [3.11 批量更新部门状态](#311-批量更新部门状态)
4. [数据模型](#数据模型)
5. [业务规则](#业务规则)
6. [错误处理](#错误处理)
7. [前端集成指南](#前端集成指南)

---

## Controller概述

### 功能描述

**DepartmentController** 负责管理工厂的部门组织架构，支持树形层级结构和可视化配置。

**核心功能**:
- ✅ **部门管理**: CRUD操作（创建、查询、更新、删除）
- ✅ **树形结构**: 支持多级部门层级（父子关系）
- ✅ **部门主管**: 指定部门负责人
- ✅ **可视化配置**: 颜色标记、图标配置、显示顺序
- ✅ **部门搜索**: 关键词搜索、活跃筛选
- ✅ **批量操作**: 批量激活/停用部门
- ✅ **编码验证**: 部门编码唯一性检查
- ✅ **快速初始化**: 一键创建默认部门结构

**业务价值**:
- 🏢 **组织架构**: 清晰的组织结构，明确职责分工
- 👤 **权限管理**: 部门级别的权限控制
- 📊 **数据统计**: 按部门统计生产、考勤、绩效数据
- 🎨 **可视化**: 颜色和图标增强用户体验
- 📱 **移动优先**: 适配移动端部门选择

**使用场景**:
1. 工厂初始化时创建组织架构（如生产部、质检部、仓储部）
2. 用户分配到部门，实现部门级别权限控制
3. 考勤打卡时按部门统计数据
4. 生产计划按部门分配任务
5. 可视化展示组织架构树

---

## 端点清单

| # | HTTP方法 | 端点路径 | 功能描述 | 权限要求 | E2E验证 |
|---|----------|----------|----------|----------|---------|
| 1 | POST | `/departments` | 创建部门 | ADMIN, MANAGER | ⚪ 未验证 |
| 2 | GET | `/departments` | 获取部门列表（分页+排序） | factory_* | ⚪ 未验证 |
| 3 | GET | `/departments/active` | 获取所有活跃部门 | factory_* | ⚪ 未验证 |
| 4 | GET | `/departments/{id}` | 获取部门详情 | factory_* | ⚪ 未验证 |
| 5 | PUT | `/departments/{id}` | 更新部门 | ADMIN, MANAGER | ⚪ 未验证 |
| 6 | DELETE | `/departments/{id}` | 删除部门（软删除） | ADMIN, MANAGER | ⚪ 未验证 |
| 7 | GET | `/departments/search` | 搜索部门（关键词） | factory_* | ⚪ 未验证 |
| 8 | GET | `/departments/tree` | 获取部门树形结构 | factory_* | ⚪ 未验证 |
| 9 | GET | `/departments/check-code` | 检查部门编码是否存在 | factory_* | ⚪ 未验证 |
| 10 | POST | `/departments/initialize` | 初始化默认部门 | ADMIN, MANAGER | ⚪ 未验证 |
| 11 | PUT | `/departments/batch-status` | 批量更新部门状态 | ADMIN, MANAGER | ⚪ 未验证 |

**图例**:
- ✅ E2E已验证 (100%通过)
- ⚠️ E2E部分验证
- ⚪ 未验证（需要添加测试）

**端点统计**:
- **总计**: 11个端点
- **CRUD**: 4个（创建、查询、更新、删除）
- **查询端点**: 5个（列表、详情、活跃、搜索、树形）
- **管理端点**: 3个（编码检查、初始化、批量状态）

---

## 详细API文档

### 3.1 创建部门

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `POST /api/mobile/{factoryId}/departments` |
| **功能** | 创建新的部门 |
| **权限** | `ADMIN`, `MANAGER` |
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
interface CreateDepartmentRequest {
  name: string;                 // 必填，部门名称，1-100字符
  code?: string;                // 可选，部门编码（工厂内唯一），1-50字符
  description?: string;         // 可选，部门描述
  managerUserId?: number;       // 可选，部门主管ID
  parentDepartmentId?: number;  // 可选，上级部门ID（支持树形结构）
  isActive?: boolean;           // 可选，是否激活（默认true）
  displayOrder?: number;        // 可选，显示顺序（默认0）
  color?: string;               // 可选，颜色标记（#RRGGBB格式），1-20字符
  icon?: string;                // 可选，图标名称，1-50字符
}
```

**参数验证**:
- `name`: 必填，1-100字符
- `code`: 可选，1-50字符，工厂内唯一
- `managerUserId`: 可选，必须是有效的用户ID
- `parentDepartmentId`: 可选，必须是有效的部门ID
- `displayOrder`: 可选，≥0
- `color`: 可选，十六进制颜色格式（如"#FF5733"）

#### 响应结构

**成功响应** (200 OK):
```typescript
interface Response {
  code: 200;
  message: "操作成功";
  success: true;
  data: DepartmentDTO;
}

interface DepartmentDTO {
  id: number;                   // 部门ID（自增主键）
  factoryId: string;            // 工厂ID
  name: string;                 // 部门名称
  code?: string;                // 部门编码
  description?: string;         // 部门描述
  managerUserId?: number;       // 部门主管ID
  managerName?: string;         // 部门主管姓名（关联查询）
  parentDepartmentId?: number;  // 上级部门ID
  parentDepartmentName?: string;// 上级部门名称（关联查询）
  isActive: boolean;            // 是否激活
  displayOrder: number;         // 显示顺序
  color?: string;               // 颜色标记
  icon?: string;                // 图标名称
  createdAt: string;            // 创建时间
  updatedAt: string;            // 更新时间
  children?: DepartmentDTO[];   // 子部门列表（树形结构时使用）
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": {
    "id": 1,
    "factoryId": "CRETAS_2024_001",
    "name": "生产部",
    "code": "DEPT_PRODUCTION",
    "description": "负责产品生产和加工",
    "managerUserId": 5,
    "managerName": "张经理",
    "parentDepartmentId": null,
    "isActive": true,
    "displayOrder": 1,
    "color": "#4CAF50",
    "icon": "factory",
    "createdAt": "2025-01-16T10:00:00",
    "updatedAt": "2025-01-16T10:00:00"
  }
}
```

#### 核心业务逻辑

**创建流程**:
```
1. 验证请求参数（必填字段、格式、长度）
2. 如果提供code，检查部门编码在工厂内是否唯一
3. 如果提供managerUserId，验证用户存在且属于同一工厂
4. 如果提供parentDepartmentId，验证上级部门存在且不形成循环引用
5. 自动生成部门ID（数据库自增）
6. 设置默认值:
   - isActive: true（默认激活）
   - displayOrder: 0（如未提供）
7. 保存到数据库
8. 返回创建的部门信息
```

**循环引用检测**:
```typescript
// 防止循环引用：A → B → C → A
const detectCircularReference = (
  departmentId: number,
  parentDepartmentId: number,
  maxDepth: number = 10
): boolean => {
  let currentId = parentDepartmentId;
  let depth = 0;

  while (currentId && depth < maxDepth) {
    if (currentId === departmentId) {
      return true;  // 检测到循环引用
    }
    currentId = getParentDepartmentId(currentId);
    depth++;
  }

  return false;
};
```

#### TypeScript代码示例

**API调用**:
```typescript
import { apiClient } from '@/services/api/apiClient';

interface CreateDepartmentRequest {
  name: string;
  code?: string;
  description?: string;
  managerUserId?: number;
  parentDepartmentId?: number;
  isActive?: boolean;
  displayOrder?: number;
  color?: string;
  icon?: string;
}

/**
 * 创建部门
 */
export const createDepartment = async (
  factoryId: string,
  department: CreateDepartmentRequest
): Promise<ApiResponse<DepartmentDTO>> => {
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/departments`,
    department
  );

  return response.data;
};
```

**React Native表单组件**:
```typescript
import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Alert, Picker } from 'react-native';
import { createDepartment, getAllActiveDepartments } from '@/services/api/departmentApiClient';
import { getAllActiveUsers } from '@/services/api/userApiClient';

const CreateDepartmentScreen: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    managerUserId: '',
    parentDepartmentId: '',
    color: '#4CAF50',
    icon: 'business',
  });

  const [departments, setDepartments] = useState<DepartmentDTO[]>([]);
  const [users, setUsers] = useState<UserDTO[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [deptResult, userResult] = await Promise.all([
      getAllActiveDepartments('CRETAS_2024_001'),
      getAllActiveUsers('CRETAS_2024_001'),
    ]);

    if (deptResult.success) setDepartments(deptResult.data);
    if (userResult.success) setUsers(userResult.data);
  };

  const handleSubmit = async () => {
    try {
      // 前端验证
      if (!formData.name) {
        Alert.alert('验证失败', '请填写部门名称');
        return;
      }

      // 调用API
      const result = await createDepartment('CRETAS_2024_001', {
        name: formData.name,
        code: formData.code || undefined,
        description: formData.description || undefined,
        managerUserId: formData.managerUserId ? parseInt(formData.managerUserId) : undefined,
        parentDepartmentId: formData.parentDepartmentId ? parseInt(formData.parentDepartmentId) : undefined,
        color: formData.color,
        icon: formData.icon,
      });

      if (result.success) {
        Alert.alert('成功', '部门创建成功', [
          {
            text: '确定',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (error) {
      console.error('创建部门失败:', error);
      Alert.alert('错误', '创建部门失败，请重试');
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <TextInput
        placeholder="部门名称 *"
        value={formData.name}
        onChangeText={(text) => setFormData({ ...formData, name: text })}
      />
      <TextInput
        placeholder="部门编码"
        value={formData.code}
        onChangeText={(text) => setFormData({ ...formData, code: text })}
      />
      <TextInput
        placeholder="部门描述"
        multiline
        value={formData.description}
        onChangeText={(text) => setFormData({ ...formData, description: text })}
      />

      <Picker
        selectedValue={formData.managerUserId}
        onValueChange={(value) => setFormData({ ...formData, managerUserId: value })}
      >
        <Picker.Item label="选择部门主管" value="" />
        {users.map(user => (
          <Picker.Item key={user.id} label={user.name} value={user.id.toString()} />
        ))}
      </Picker>

      <Picker
        selectedValue={formData.parentDepartmentId}
        onValueChange={(value) => setFormData({ ...formData, parentDepartmentId: value })}
      >
        <Picker.Item label="无上级部门（顶级）" value="" />
        {departments.map(dept => (
          <Picker.Item key={dept.id} label={dept.name} value={dept.id.toString()} />
        ))}
      </Picker>

      <Button title="创建部门" onPress={handleSubmit} />
    </View>
  );
};
```

---

### 3.2 获取部门列表

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/departments` |
| **功能** | 分页获取部门列表，支持排序 |
| **权限** | `factory_*` |
| **限流** | 100次/分钟 |

#### 请求参数

**查询参数**:
```typescript
interface QueryParams {
  page?: number;         // 页码（0-based），默认0
  size?: number;         // 每页大小，默认20
  sortBy?: string;       // 排序字段，默认"displayOrder"
  sortDirection?: string;// 排序方向，默认"ASC"（ASC或DESC）
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
        "id": 1,
        "name": "生产部",
        "code": "DEPT_PRODUCTION",
        "managerName": "张经理",
        "isActive": true,
        "displayOrder": 1,
        "color": "#4CAF50",
        "icon": "factory"
      }
    ],
    "totalElements": 8,
    "totalPages": 1,
    "currentPage": 0,
    "size": 20,
    "hasNext": false,
    "hasPrevious": false
  }
}
```

#### 核心业务逻辑

**排序规则**:
```typescript
// 支持的排序字段
const sortableFields = [
  'displayOrder',  // 显示顺序（默认）
  'name',          // 部门名称
  'createdAt',     // 创建时间
  'code'           // 部门编码
];

// 默认排序
const defaultSort = {
  field: 'displayOrder',
  direction: 'ASC'
};
```

---

### 3.3 获取所有活跃部门

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/departments/active` |
| **功能** | 获取所有激活状态的部门（不分页） |
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
      "id": 1,
      "name": "生产部",
      "code": "DEPT_PRODUCTION",
      "color": "#4CAF50",
      "icon": "factory",
      "isActive": true
    }
  ]
}
```

#### 核心业务逻辑

**查询条件**:
```sql
SELECT * FROM departments
WHERE factory_id = ? AND is_active = true AND deleted_at IS NULL
ORDER BY display_order ASC, name ASC
```

**使用场景**:
- 用户分配部门时选择
- 考勤打卡时选择部门
- 下拉列表显示可用部门

---

### 3.4 获取部门详情

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/departments/{id}` |
| **功能** | 根据ID获取单个部门的详细信息 |
| **权限** | `factory_*` |
| **限流** | 200次/分钟 |

---

### 3.5 更新部门

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/departments/{id}` |
| **功能** | 更新现有部门信息 |
| **权限** | `ADMIN`, `MANAGER` |
| **限流** | 60次/分钟 |

---

### 3.6 删除部门

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `DELETE /api/mobile/{factoryId}/departments/{id}` |
| **功能** | 删除部门（软删除） |
| **权限** | `ADMIN`, `MANAGER` |
| **限流** | 30次/分钟 |

#### 核心业务逻辑

**删除流程**:
```
1. 验证部门存在
2. 验证用户权限（仅ADMIN和MANAGER）
3. 检查是否有子部门
4. 检查是否有关联的用户
5. 如果有关联数据，提示不能删除或软删除
6. 设置deletedAt时间戳（软删除）
7. 返回成功消息
```

**关联数据检查**:
```typescript
// 检查子部门
const hasChildren = await countChildDepartments(departmentId);
if (hasChildren > 0) {
  throw new Error('该部门有子部门，请先删除子部门');
}

// 检查关联用户
const hasUsers = await countDepartmentUsers(departmentId);
if (hasUsers > 0) {
  throw new Error('该部门有员工，请先移除员工');
}
```

---

### 3.7 搜索部门

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/departments/search` |
| **功能** | 根据关键词搜索部门（名称或编码模糊匹配） |
| **权限** | `factory_*` |
| **限流** | 100次/分钟 |

#### 请求参数

**查询参数**:
```typescript
interface QueryParams {
  keyword: string;  // 必填，搜索关键词
  page?: number;    // 页码（0-based），默认0
  size?: number;    // 每页大小，默认20
}
```

#### 核心业务逻辑

**搜索规则**:
```sql
SELECT * FROM departments
WHERE factory_id = ?
  AND deleted_at IS NULL
  AND (name LIKE CONCAT('%', ?, '%') OR code LIKE CONCAT('%', ?, '%'))
ORDER BY display_order ASC
LIMIT ? OFFSET ?
```

---

### 3.8 获取部门树形结构

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/departments/tree` |
| **功能** | 获取部门的树形层级结构 |
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
      "id": 1,
      "name": "生产部",
      "code": "DEPT_PRODUCTION",
      "color": "#4CAF50",
      "icon": "factory",
      "children": [
        {
          "id": 2,
          "name": "一车间",
          "code": "DEPT_WORKSHOP_1",
          "parentDepartmentId": 1,
          "color": "#66BB6A",
          "icon": "build",
          "children": []
        },
        {
          "id": 3,
          "name": "二车间",
          "code": "DEPT_WORKSHOP_2",
          "parentDepartmentId": 1,
          "color": "#81C784",
          "icon": "build",
          "children": []
        }
      ]
    },
    {
      "id": 4,
      "name": "质检部",
      "code": "DEPT_QC",
      "color": "#2196F3",
      "icon": "verified",
      "children": []
    }
  ]
}
```

#### 核心业务逻辑

**树形结构构建**:
```typescript
/**
 * 构建部门树形结构
 */
const buildDepartmentTree = (
  departments: Department[]
): DepartmentDTO[] => {
  // 创建ID映射
  const departmentMap = new Map<number, DepartmentDTO>();
  departments.forEach(dept => {
    departmentMap.set(dept.id, { ...dept, children: [] });
  });

  // 构建树形结构
  const tree: DepartmentDTO[] = [];
  departmentMap.forEach(dept => {
    if (dept.parentDepartmentId) {
      // 有父部门，添加到父部门的children
      const parent = departmentMap.get(dept.parentDepartmentId);
      if (parent) {
        parent.children?.push(dept);
      }
    } else {
      // 没有父部门，顶级部门
      tree.push(dept);
    }
  });

  // 按displayOrder排序
  const sortByDisplayOrder = (nodes: DepartmentDTO[]) => {
    nodes.sort((a, b) => a.displayOrder - b.displayOrder);
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        sortByDisplayOrder(node.children);
      }
    });
  };

  sortByDisplayOrder(tree);
  return tree;
};
```

**使用场景**:
- 组织架构图可视化
- 部门选择器（树形下拉）
- 部门权限配置

---

### 3.9 检查部门编码是否存在

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/departments/check-code` |
| **功能** | 检查部门编码是否已存在（用于前端验证） |
| **权限** | `factory_*` |
| **限流** | 200次/分钟 |

#### 请求参数

**查询参数**:
```typescript
interface QueryParams {
  code: string;         // 必填，部门编码
  excludeId?: number;   // 可选，排除的部门ID（更新时使用）
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
    "exists": true
  }
}
```

#### TypeScript代码示例

```typescript
/**
 * 检查部门编码是否存在
 */
export const checkDepartmentCode = async (
  factoryId: string,
  code: string,
  excludeId?: number
): Promise<boolean> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/departments/check-code`,
    {
      params: { code, excludeId },
    }
  );

  return response.data.data.exists;
};

// 使用示例：前端实时验证
const [codeExists, setCodeExists] = useState(false);

const handleCodeChange = async (code: string) => {
  if (code.length >= 2) {
    const exists = await checkDepartmentCode('CRETAS_2024_001', code);
    setCodeExists(exists);
  }
};
```

---

### 3.10 初始化默认部门

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `POST /api/mobile/{factoryId}/departments/initialize` |
| **功能** | 为工厂初始化默认的部门结构 |
| **权限** | `ADMIN`, `MANAGER` |
| **限流** | 10次/分钟 |

#### 核心业务逻辑

**默认部门结构**:
```typescript
const defaultDepartments = [
  {
    name: "生产部",
    code: "DEPT_PRODUCTION",
    description: "负责产品生产和加工",
    displayOrder: 1,
    color: "#4CAF50",
    icon: "factory",
    children: [
      {
        name: "一车间",
        code: "DEPT_WORKSHOP_1",
        displayOrder: 1,
        color: "#66BB6A",
        icon: "build"
      },
      {
        name: "二车间",
        code: "DEPT_WORKSHOP_2",
        displayOrder: 2,
        color: "#81C784",
        icon: "build"
      }
    ]
  },
  {
    name: "质检部",
    code: "DEPT_QC",
    description: "负责产品质量检验",
    displayOrder: 2,
    color: "#2196F3",
    icon: "verified"
  },
  {
    name: "仓储部",
    code: "DEPT_WAREHOUSE",
    description: "负责原材料和成品仓储管理",
    displayOrder: 3,
    color: "#FF9800",
    icon: "warehouse"
  },
  {
    name: "行政部",
    code: "DEPT_ADMIN",
    description: "负责行政管理和后勤保障",
    displayOrder: 4,
    color: "#9C27B0",
    icon: "business_center"
  },
  {
    name: "财务部",
    code: "DEPT_FINANCE",
    description: "负责财务管理和成本核算",
    displayOrder: 5,
    color: "#F44336",
    icon: "account_balance"
  }
];
```

**初始化流程**:
```
1. 检查工厂是否已有部门
2. 如果已有，提示是否覆盖
3. 批量创建默认部门（包含层级关系）
4. 返回创建结果
```

---

### 3.11 批量更新部门状态

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/departments/batch-status` |
| **功能** | 批量更新部门的激活状态 |
| **权限** | `ADMIN`, `MANAGER` |
| **限流** | 30次/分钟 |

#### 请求参数

**请求体**:
```typescript
interface BatchUpdateStatusRequest {
  ids: number[];       // 必填，部门ID列表
  isActive: boolean;   // 必填，激活状态
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
 * 批量更新部门状态
 */
export const batchUpdateDepartmentStatus = async (
  factoryId: string,
  ids: number[],
  isActive: boolean
): Promise<ApiResponse<void>> => {
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/departments/batch-status`,
    { ids, isActive }
  );

  return response.data;
};

// 使用示例：批量停用部门
const selectedIds = [1, 2, 3];
await batchUpdateDepartmentStatus('CRETAS_2024_001', selectedIds, false);
```

---

## 数据模型

### Department（部门）

```typescript
/**
 * 部门实体
 */
interface Department {
  // 主键
  id: number;                   // 部门ID（自增主键）

  // 关联字段
  factoryId: string;            // 工厂ID

  // 基本信息
  name: string;                 // 部门名称
  code?: string;                // 部门编码（工厂内唯一）
  description?: string;         // 部门描述

  // 管理者
  managerUserId?: number;       // 部门主管ID

  // 层级关系
  parentDepartmentId?: number;  // 上级部门ID（支持树形结构）

  // 状态
  isActive: boolean;            // 是否激活

  // 显示配置
  displayOrder: number;         // 显示顺序
  color?: string;               // 颜色标记（#RRGGBB格式）
  icon?: string;                // 图标名称

  // 审计字段
  createdAt: string;            // 创建时间
  updatedAt: string;            // 更新时间
  deletedAt?: string;           // 删除时间（软删除）

  // 关联信息（查询时返回）
  managerName?: string;         // 部门主管姓名
  parentDepartmentName?: string;// 上级部门名称
  children?: Department[];      // 子部门列表（树形结构）
}
```

### 数据库表结构

```sql
CREATE TABLE departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  factory_id VARCHAR(191) NOT NULL,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  manager_user_id INT,
  parent_department_id INT,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  color VARCHAR(20),
  icon VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,

  INDEX idx_department_factory (factory_id),
  INDEX idx_department_code (factory_id, code),
  INDEX idx_department_active (factory_id, is_active),

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (manager_user_id) REFERENCES users(id),
  FOREIGN KEY (parent_department_id) REFERENCES departments(id)
);
```

---

## 业务规则

### 1. 编码唯一性规则

**部门编码唯一性**:
- `code` 在同一工厂内必须唯一（如果提供）
- 编码不是必填项，可以不设置

### 2. 树形结构规则

**层级限制**:
- 最大层级深度: 5级
- 防止循环引用: A → B → C → A（不允许）

**层级关系**:
```
顶级部门（parentDepartmentId = null）
├── 二级部门（parentDepartmentId = 顶级部门ID）
│   ├── 三级部门
│   └── 三级部门
└── 二级部门
```

### 3. 显示顺序规则

**排序逻辑**:
```typescript
// 先按displayOrder升序，再按name升序
ORDER BY display_order ASC, name ASC
```

**建议值**:
- 生产部: displayOrder = 1
- 质检部: displayOrder = 2
- 仓储部: displayOrder = 3
- 行政部: displayOrder = 4

### 4. 颜色和图标规则

**颜色格式**:
- 十六进制格式: `#RRGGBB`
- 示例: `#4CAF50`（绿色）、`#2196F3`（蓝色）

**常用图标**:
- `factory`: 生产部
- `verified`: 质检部
- `warehouse`: 仓储部
- `business_center`: 行政部
- `account_balance`: 财务部
- `build`: 车间

### 5. 删除规则

**删除前检查**:
- 有子部门 → 提示先删除子部门
- 有员工 → 提示先移除员工
- 有关联数据 → 软删除

### 6. 权限规则

| 角色 | 创建 | 查询 | 更新 | 删除 | 批量操作 |
|------|------|------|------|------|---------|
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ |
| MANAGER | ✅ | ✅ | ✅ | ✅ | ✅ |
| other roles | ❌ | ✅ | ❌ | ❌ | ❌ |

---

## 错误处理

### 错误码列表

| HTTP状态码 | 错误码 | 错误信息 | 说明 |
|-----------|-------|---------|------|
| 400 | INVALID_PARAMETER | 参数验证失败 | 请求参数不符合规则 |
| 404 | DEPARTMENT_NOT_FOUND | 部门不存在 | id无效 |
| 409 | DUPLICATE_CODE | 部门编码已存在 | code重复 |
| 409 | CIRCULAR_REFERENCE | 检测到循环引用 | 父子部门形成循环 |
| 409 | DEPARTMENT_HAS_CHILDREN | 部门有子部门，无法删除 | 存在子部门 |
| 409 | DEPARTMENT_HAS_USERS | 部门有员工，无法删除 | 存在关联用户 |
| 403 | PERMISSION_DENIED | 权限不足 | 无权执行此操作 |

---

## 前端集成指南

### 完整API客户端实现

创建 `src/services/api/departmentApiClient.ts`:

```typescript
import { apiClient } from './apiClient';
import type { ApiResponse, PageResponse } from '@/types/apiResponses';

/**
 * 部门API客户端
 */

// ============ 类型定义 ============

export interface DepartmentDTO {
  id: number;
  factoryId: string;
  name: string;
  code?: string;
  description?: string;
  managerUserId?: number;
  managerName?: string;
  parentDepartmentId?: number;
  parentDepartmentName?: string;
  isActive: boolean;
  displayOrder: number;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
  children?: DepartmentDTO[];
}

export interface CreateDepartmentRequest {
  name: string;
  code?: string;
  description?: string;
  managerUserId?: number;
  parentDepartmentId?: number;
  isActive?: boolean;
  displayOrder?: number;
  color?: string;
  icon?: string;
}

// ============ API函数 ============

/**
 * 创建部门
 */
export const createDepartment = async (
  factoryId: string,
  department: CreateDepartmentRequest
): Promise<ApiResponse<DepartmentDTO>> => {
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/departments`,
    department
  );

  return response.data;
};

/**
 * 获取部门列表（分页）
 */
export const getDepartmentList = async (
  factoryId: string,
  page: number = 0,
  size: number = 20,
  sortBy: string = 'displayOrder',
  sortDirection: string = 'ASC'
): Promise<ApiResponse<PageResponse<DepartmentDTO>>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/departments`,
    {
      params: { page, size, sortBy, sortDirection },
    }
  );

  return response.data;
};

/**
 * 获取所有活跃部门
 */
export const getAllActiveDepartments = async (
  factoryId: string
): Promise<ApiResponse<DepartmentDTO[]>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/departments/active`
  );

  return response.data;
};

/**
 * 获取部门详情
 */
export const getDepartmentById = async (
  factoryId: string,
  id: number
): Promise<ApiResponse<DepartmentDTO>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/departments/${id}`
  );

  return response.data;
};

/**
 * 更新部门
 */
export const updateDepartment = async (
  factoryId: string,
  id: number,
  updates: Partial<CreateDepartmentRequest>
): Promise<ApiResponse<DepartmentDTO>> => {
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/departments/${id}`,
    updates
  );

  return response.data;
};

/**
 * 删除部门
 */
export const deleteDepartment = async (
  factoryId: string,
  id: number
): Promise<ApiResponse<void>> => {
  const response = await apiClient.delete(
    `/api/mobile/${factoryId}/departments/${id}`
  );

  return response.data;
};

/**
 * 搜索部门
 */
export const searchDepartments = async (
  factoryId: string,
  keyword: string,
  page: number = 0,
  size: number = 20
): Promise<ApiResponse<PageResponse<DepartmentDTO>>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/departments/search`,
    {
      params: { keyword, page, size },
    }
  );

  return response.data;
};

/**
 * 获取部门树形结构
 */
export const getDepartmentTree = async (
  factoryId: string
): Promise<ApiResponse<DepartmentDTO[]>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/departments/tree`
  );

  return response.data;
};

/**
 * 检查部门编码是否存在
 */
export const checkDepartmentCode = async (
  factoryId: string,
  code: string,
  excludeId?: number
): Promise<boolean> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/departments/check-code`,
    {
      params: { code, excludeId },
    }
  );

  return response.data.data.exists;
};

/**
 * 初始化默认部门
 */
export const initializeDefaultDepartments = async (
  factoryId: string
): Promise<ApiResponse<void>> => {
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/departments/initialize`
  );

  return response.data;
};

/**
 * 批量更新部门状态
 */
export const batchUpdateDepartmentStatus = async (
  factoryId: string,
  ids: number[],
  isActive: boolean
): Promise<ApiResponse<void>> => {
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/departments/batch-status`,
    { ids, isActive }
  );

  return response.data;
};

// ============ 辅助函数 ============

/**
 * 扁平化部门树
 */
export const flattenDepartmentTree = (
  tree: DepartmentDTO[]
): DepartmentDTO[] => {
  const result: DepartmentDTO[] = [];

  const traverse = (nodes: DepartmentDTO[]) => {
    nodes.forEach(node => {
      result.push(node);
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    });
  };

  traverse(tree);
  return result;
};

/**
 * 查找部门路径
 */
export const findDepartmentPath = (
  tree: DepartmentDTO[],
  targetId: number
): DepartmentDTO[] => {
  const path: DepartmentDTO[] = [];

  const findPath = (nodes: DepartmentDTO[]): boolean => {
    for (const node of nodes) {
      path.push(node);

      if (node.id === targetId) {
        return true;
      }

      if (node.children && findPath(node.children)) {
        return true;
      }

      path.pop();
    }

    return false;
  };

  findPath(tree);
  return path;
};
```

---

## 总结

### 关键特性

1. **树形层级结构**: 支持多级部门层级
2. **可视化配置**: 颜色标记、图标配置
3. **灵活排序**: 自定义显示顺序
4. **部门主管**: 指定部门负责人
5. **批量操作**: 批量激活/停用部门
6. **快速初始化**: 一键创建默认部门

### 使用建议

1. **合理规划层级**: 建议不超过3级
2. **统一编码规范**: 使用 `DEPT_` 前缀
3. **颜色区分**: 使用不同颜色区分部门类型
4. **定期维护**: 及时更新部门主管信息
5. **权限控制**: 基于部门的权限管理

### 待实现功能

- 部门员工统计
- 部门绩效看板
- 部门成本中心
- 部门间协作流程
- 部门合并/拆分

---

**文档结束**
