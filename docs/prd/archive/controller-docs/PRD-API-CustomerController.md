# PRD-API-CustomerController

**文档版本**: v1.0
**创建日期**: 2025-11-20
**Controller**: CustomerController
**端点数量**: 26个
**E2E测试覆盖**: 未覆盖
**文档类型**: Controller分文档（中等详细5维度分析）

---

## 📋 目录

- [概述](#概述)
- [客户管理端点](#客户管理端点)
  - [1. CRUD操作](#1-crud操作)
  - [2. 查询与搜索](#2-查询与搜索)
  - [3. 状态与评级管理](#3-状态与评级管理)
  - [4. 财务管理](#4-财务管理)
  - [5. 统计与报告](#5-统计与报告)
  - [6. 批量操作](#6-批量操作)
  - [7. 客户分析](#7-客户分析)
- [核心业务逻辑](#核心业务逻辑)
- [数据模型](#数据模型)

---

## 概述

### Controller信息

| 属性 | 值 |
|-----|-----|
| **Controller类** | `CustomerController.java` |
| **基础路径** | `/api/mobile/{factoryId}/customers` |
| **认证要求** | JWT Bearer Token |
| **主要功能** | 客户全生命周期管理、客户关系管理(CRM) |
| **业务模块** | 客户管理 |

### 功能分类

**客户管理** (26端点):
- CRUD操作 (5个): 创建、更新、删除、查询详情、分页列表
- 查询与搜索 (4个): 活跃客户、搜索、按类型、按行业
- 状态与评级管理 (2个): 切换状态、更新评级
- 财务管理 (2个): 更新信用额度、更新余额
- 统计与报告 (4个): 客户统计、购买历史、评级分布、总体统计
- 批量操作 (4个): Excel导入、导出、下载模板、JSON导入
- 客户分析 (5个): 类型分布、行业分布、有欠款客户、VIP客户、检查客户代码

---

## 客户管理端点

### 1. CRUD操作

#### 1.1 创建客户

**端点**: `POST /api/mobile/{factoryId}/customers`
**功能**: 创建新客户
**权限**: 工厂管理员、销售管理员

##### 请求参数

**Headers**:
```typescript
{
  "Authorization": "Bearer <access_token>"
}
```

**Body** (`CreateCustomerRequest`):
```typescript
{
  name: string,              // 客户名称（必填，1-100字符）
  customerCode: string,      // 客户代码（必填，工厂内唯一）
  type: string,              // 客户类型（必填: "企业" / "个人" / "经销商" / "零售"）
  industry?: string,         // 所属行业（可选）
  contactPerson: string,     // 联系人（必填）
  phoneNumber: string,       // 联系电话（必填，手机号格式）
  email?: string,            // 邮箱（可选）
  address?: string,          // 地址（可选）
  creditLimit?: number,      // 信用额度（可选，默认0）
  paymentTerms?: number,     // 付款期限（天，可选，默认30）
  taxNumber?: string,        // 税号（可选）
  rating?: number,           // 初始评级（1-5，可选，默认3）
  notes?: string             // 备注（可选）
}
```

**参数验证**:
- `name`: 1-100字符
- `customerCode`: 1-50字符，工厂内唯一
- `type`: 枚举值（企业/个人/经销商/零售）
- `phoneNumber`: 11位手机号或固话格式
- `creditLimit`: ≥0
- `rating`: 1-5

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "客户创建成功",
  "data": {
    "id": "CUST-001",
    "customerCode": "C-20251120-001",
    "name": "上海餐饮有限公司",
    "type": "企业",
    "industry": "餐饮",
    "contactPerson": "张经理",
    "phoneNumber": "13800138000",
    "email": "zhangmgr@example.com",
    "address": "上海市浦东新区",
    "creditLimit": 100000,
    "currentBalance": 0,
    "paymentTerms": 30,
    "rating": 3,
    "isActive": true,
    "createdAt": "2025-11-20T10:00:00",
    "createdBy": 1
  }
}
```

**错误响应**:
- `400`: 参数验证失败、客户代码已存在
- `401`: 认证失败
- `403`: 权限不足

##### 业务逻辑核心

1. **验证输入**: 检查必填字段、格式、客户代码唯一性
2. **设置初始值**:
   - currentBalance = 0
   - isActive = true
   - rating = 3 (如未指定)
3. **保存客户记录**: 插入customers表
4. **返回客户DTO**: 完整的客户信息

##### 代码示例

**TypeScript (React Native)**:
```typescript
import { apiClient } from '@/services/api/apiClient';

const createCustomer = async (factoryId: string, data: CreateCustomerRequest) => {
  const response = await apiClient.post<ApiResponse<CustomerDTO>>(
    `/api/mobile/${factoryId}/customers`,
    data
  );
  return response.data;
};

// 使用示例
const newCustomer = await createCustomer('CRETAS_2024_001', {
  name: '上海餐饮有限公司',
  customerCode: 'C-20251120-001',
  type: '企业',
  industry: '餐饮',
  contactPerson: '张经理',
  phoneNumber: '13800138000',
  email: 'zhangmgr@example.com',
  address: '上海市浦东新区',
  creditLimit: 100000,
  paymentTerms: 30,
  rating: 4,
  notes: 'VIP大客户'
});
```

---

#### 1.2 更新客户

**端点**: `PUT /api/mobile/{factoryId}/customers/{customerId}`
**功能**: 更新客户信息
**权限**: 工厂管理员、销售管理员

##### 请求参数

**Path Parameters**:
- `factoryId`: string (工厂ID)
- `customerId`: string (客户ID)

**Body**: 同创建客户的 `CreateCustomerRequest`

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "客户更新成功",
  "data": { /* CustomerDTO */ }
}
```

##### 业务逻辑核心

1. **验证客户存在**: 根据factoryId和customerId查询
2. **更新字段**: 仅更新请求中提供的字段
3. **保持系统字段**: 不修改currentBalance、createdAt等
4. **记录更新时间**: updatedAt = now()

---

#### 1.3 删除客户

**端点**: `DELETE /api/mobile/{factoryId}/customers/{customerId}`
**功能**: 删除客户
**权限**: 工厂管理员
**注意**: 软删除（逻辑删除）

##### 请求参数

**Path Parameters**:
- `factoryId`: string
- `customerId`: string

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "客户删除成功",
  "data": null
}
```

##### 业务逻辑核心

1. **验证客户存在**: 检查客户是否属于该工厂
2. **检查业务关联**:
   - 如果有未完成订单，拒绝删除
   - 如果有欠款，拒绝删除
3. **软删除**: 设置deleted=true, deletedAt=now()
4. **保留历史**: 订单历史、交易记录仍可查询

---

#### 1.4 获取客户详情

**端点**: `GET /api/mobile/{factoryId}/customers/{customerId}`
**功能**: 获取单个客户详细信息
**权限**: 工厂所有角色

##### 请求参数

**Path Parameters**:
- `factoryId`: string
- `customerId`: string

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "id": "CUST-001",
    "customerCode": "C-20251120-001",
    "name": "上海餐饮有限公司",
    "type": "企业",
    "industry": "餐饮",
    "contactPerson": "张经理",
    "phoneNumber": "13800138000",
    "email": "zhangmgr@example.com",
    "address": "上海市浦东新区",
    "creditLimit": 100000,
    "currentBalance": -15000,      // 负数表示欠款
    "availableCredit": 85000,      // creditLimit - abs(currentBalance)
    "paymentTerms": 30,
    "taxNumber": "91310000MA1234567",
    "rating": 4,
    "isActive": true,
    "totalOrders": 56,             // 历史订单数
    "totalRevenue": 850000,        // 历史总营收
    "lastOrderDate": "2025-11-18",
    "createdAt": "2024-06-01T09:00:00",
    "updatedAt": "2025-11-15T14:30:00"
  }
}
```

##### 业务逻辑核心

1. **查询客户**: 根据factoryId和customerId查询
2. **计算字段**:
   - availableCredit = creditLimit - abs(currentBalance)
   - totalOrders: COUNT(orders)
   - totalRevenue: SUM(order.totalAmount)
   - lastOrderDate: MAX(order.orderDate)
3. **返回完整信息**: 包括计算字段

---

#### 1.5 获取客户列表（分页）

**端点**: `GET /api/mobile/{factoryId}/customers`
**功能**: 分页获取工厂所有客户
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
      { /* CustomerDTO */ },
      { /* CustomerDTO */ }
    ],
    "totalElements": 156,
    "totalPages": 16,
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
const getCustomerList = async (
  factoryId: string,
  params: { page?: number; size?: number }
) => {
  const response = await apiClient.get<ApiResponse<PageResponse<CustomerDTO>>>(
    `/api/mobile/${factoryId}/customers`,
    { params }
  );
  return response.data;
};
```

---

### 2. 查询与搜索

#### 2.1 获取活跃客户列表

**端点**: `GET /api/mobile/{factoryId}/customers/active`
**功能**: 获取所有活跃客户（isActive=true）
**权限**: 工厂所有角色

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": [
    {
      "id": "CUST-001",
      "name": "上海餐饮有限公司",
      "customerCode": "C-20251120-001",
      "isActive": true,
      "rating": 4
    }
  ]
}
```

##### 业务逻辑核心

1. **活跃客户过滤**: WHERE isActive = true
2. **工厂过滤**: AND factoryId = ?
3. **排序**: ORDER BY name ASC
4. **返回列表**: 不分页，返回全部活跃客户

---

#### 2.2 搜索客户

**端点**: `GET /api/mobile/{factoryId}/customers/search`
**功能**: 按关键词搜索客户（名称、客户代码、联系人）
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
    { /* CustomerDTO */ }
  ]
}
```

##### 业务逻辑核心

1. **模糊搜索**: WHERE (name LIKE %keyword% OR customerCode LIKE %keyword% OR contactPerson LIKE %keyword%)
2. **工厂过滤**: AND factoryId = ?
3. **软删除过滤**: AND deleted = false
4. **相关性排序**: 名称精确匹配优先

##### 代码示例

```typescript
const searchCustomers = async (factoryId: string, keyword: string) => {
  const response = await apiClient.get<ApiResponse<CustomerDTO[]>>(
    `/api/mobile/${factoryId}/customers/search`,
    { params: { keyword } }
  );
  return response.data;
};
```

---

#### 2.3 按客户类型获取客户

**端点**: `GET /api/mobile/{factoryId}/customers/by-type`
**功能**: 获取指定类型的所有客户
**权限**: 工厂所有角色

##### 请求参数

**Query Parameters**:
```typescript
{
  type: string  // 客户类型（必填: "企业" / "个人" / "经销商" / "零售"）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": [
    { /* CustomerDTO */ }
  ]
}
```

##### 业务逻辑核心

1. **类型过滤**: WHERE type = ?
2. **工厂过滤**: AND factoryId = ?
3. **排序**: ORDER BY name ASC

---

#### 2.4 按行业获取客户

**端点**: `GET /api/mobile/{factoryId}/customers/by-industry`
**功能**: 获取指定行业的所有客户
**权限**: 工厂所有角色

##### 请求参数

**Query Parameters**:
```typescript
{
  industry: string  // 行业（必填，如"餐饮"、"零售"、"批发"）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": [
    { /* CustomerDTO */ }
  ]
}
```

##### 业务逻辑核心

1. **行业过滤**: WHERE industry = ?
2. **工厂过滤**: AND factoryId = ?
3. **排序**: ORDER BY name ASC

---

### 3. 状态与评级管理

#### 3.1 切换客户状态

**端点**: `PUT /api/mobile/{factoryId}/customers/{customerId}/status`
**功能**: 切换客户激活状态（启用/停用）
**权限**: 工厂管理员、销售管理员

##### 请求参数

**Path Parameters**:
- `customerId`: string

**Query Parameters**:
```typescript
{
  isActive: boolean  // 激活状态（必填）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "客户状态更新成功",
  "data": {
    "id": "CUST-001",
    "isActive": false,  // 已停用
    "updatedAt": "2025-11-20T14:30:00"
  }
}
```

##### 业务逻辑核心

1. **验证客户存在**: 根据factoryId和customerId查询
2. **更新状态**: isActive = 参数值
3. **记录变更**: updatedAt = now()
4. **业务影响**:
   - 停用后不能创建新订单
   - 已有订单不受影响

##### 代码示例

```typescript
const toggleCustomerStatus = async (
  factoryId: string,
  customerId: string,
  isActive: boolean
) => {
  const response = await apiClient.put<ApiResponse<CustomerDTO>>(
    `/api/mobile/${factoryId}/customers/${customerId}/status`,
    null,
    { params: { isActive } }
  );
  return response.data;
};
```

---

#### 3.2 更新客户评级

**端点**: `PUT /api/mobile/{factoryId}/customers/{customerId}/rating`
**功能**: 更新客户评级（1-5星）
**权限**: 工厂管理员、销售管理员

##### 请求参数

**Query Parameters**:
```typescript
{
  rating: number,    // 评级（1-5，必填）
  notes?: string     // 评级说明（可选）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "客户评级更新成功",
  "data": {
    "id": "CUST-001",
    "rating": 5,
    "ratingNotes": "优质客户，按时付款，订单量大",
    "updatedAt": "2025-11-20T14:30:00"
  }
}
```

##### 业务逻辑核心

1. **评级验证**: rating必须在1-5之间
2. **更新评级**: rating = 参数值, ratingNotes = notes
3. **评级历史**: 记录评级变更历史（rating_history表）
4. **影响分析**:
   - 5星: VIP客户，优先服务
   - 4星: 优质客户
   - 3星: 普通客户
   - 1-2星: 需关注客户

##### 代码示例

```typescript
const updateCustomerRating = async (
  factoryId: string,
  customerId: string,
  rating: number,
  notes?: string
) => {
  const response = await apiClient.put<ApiResponse<CustomerDTO>>(
    `/api/mobile/${factoryId}/customers/${customerId}/rating`,
    null,
    { params: { rating, notes } }
  );
  return response.data;
};
```

---

### 4. 财务管理

#### 4.1 更新客户信用额度

**端点**: `PUT /api/mobile/{factoryId}/customers/{customerId}/credit-limit`
**功能**: 更新客户信用额度（授信额度）
**权限**: 工厂管理员、财务管理员

##### 请求参数

**Query Parameters**:
```typescript
{
  creditLimit: number  // 信用额度（必填，≥0）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "信用额度更新成功",
  "data": {
    "id": "CUST-001",
    "creditLimit": 200000,      // 新信用额度
    "currentBalance": -15000,   // 当前欠款
    "availableCredit": 185000,  // 可用额度
    "updatedAt": "2025-11-20T14:30:00"
  }
}
```

##### 业务逻辑核心

1. **额度验证**: creditLimit ≥ 0
2. **更新额度**: creditLimit = 参数值
3. **计算可用额度**: availableCredit = creditLimit - abs(currentBalance)
4. **记录变更**: 审计日志记录额度变更
5. **风险控制**: 如果currentBalance < -creditLimit，触发预警

##### 代码示例

```typescript
const updateCreditLimit = async (
  factoryId: string,
  customerId: string,
  creditLimit: number
) => {
  const response = await apiClient.put<ApiResponse<CustomerDTO>>(
    `/api/mobile/${factoryId}/customers/${customerId}/credit-limit`,
    null,
    { params: { creditLimit } }
  );
  return response.data;
};
```

---

#### 4.2 更新客户当前余额

**端点**: `PUT /api/mobile/{factoryId}/customers/{customerId}/balance`
**功能**: 更新客户账户余额（应收账款）
**权限**: 工厂管理员、财务管理员

##### 请求参数

**Query Parameters**:
```typescript
{
  balance: number  // 当前余额（必填，负数表示欠款）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "客户余额更新成功",
  "data": {
    "id": "CUST-001",
    "currentBalance": -25000,   // 欠款25000元
    "creditLimit": 100000,
    "availableCredit": 75000,   // 剩余可用额度
    "isOverdue": true,          // 是否超期
    "updatedAt": "2025-11-20T14:30:00"
  }
}
```

##### 业务逻辑核心

1. **更新余额**: currentBalance = 参数值
2. **计算可用额度**: availableCredit = creditLimit - abs(currentBalance)
3. **超期判断**: isOverdue = (currentBalance < 0 && 超过paymentTerms天)
4. **风险预警**:
   - 如果abs(currentBalance) > creditLimit，发送预警
   - 如果isOverdue，限制新订单创建
5. **记录交易**: 在balance_transactions表记录余额变动

##### 代码示例

```typescript
const updateCurrentBalance = async (
  factoryId: string,
  customerId: string,
  balance: number
) => {
  const response = await apiClient.put<ApiResponse<CustomerDTO>>(
    `/api/mobile/${factoryId}/customers/${customerId}/balance`,
    null,
    { params: { balance } }
  );
  return response.data;
};
```

---

### 5. 统计与报告

#### 5.1 获取客户统计信息

**端点**: `GET /api/mobile/{factoryId}/customers/{customerId}/statistics`
**功能**: 获取单个客户的统计信息
**权限**: 工厂所有角色

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "customerId": "CUST-001",
    "totalOrders": 56,
    "totalRevenue": 850000,
    "avgOrderAmount": 15178.57,
    "lastOrderDate": "2025-11-18",
    "firstOrderDate": "2024-06-15",
    "daysSinceFirstOrder": 523,
    "orderFrequency": 9.3,          // 订单频率（次/月）
    "totalProducts": 128,           // 购买产品种类数
    "topProducts": [
      {
        "productName": "冻品猪肉",
        "quantity": 3500,
        "revenue": 350000
      }
    ],
    "paymentStats": {
      "onTimePaymentRate": 95.2,    // 按时付款率 (%)
      "avgPaymentDays": 28,         // 平均付款天数
      "maxOverdueDays": 15          // 最大逾期天数
    },
    "creditUtilization": 25,        // 信用额度使用率 (%)
    "customerLifetimeValue": 950000 // 客户生命周期价值（预估）
  }
}
```

##### 业务逻辑核心

1. **订单统计**: COUNT(*), SUM(totalAmount), AVG(totalAmount)
2. **时间分析**: 首单日期、末单日期、订单频率
3. **产品分析**: TOP 5畅销产品
4. **付款分析**: 按时付款率、平均付款天数
5. **信用分析**: creditUtilization = abs(currentBalance) / creditLimit × 100
6. **生命周期价值**: 基于历史数据预测未来价值

---

#### 5.2 获取客户购买历史

**端点**: `GET /api/mobile/{factoryId}/customers/{customerId}/purchase-history`
**功能**: 获取客户的所有订单历史
**权限**: 工厂所有角色

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": [
    {
      "orderId": "ORDER-001",
      "orderDate": "2025-11-18",
      "totalAmount": 25000,
      "status": "COMPLETED",
      "paymentStatus": "PAID",
      "products": [
        {
          "productName": "冻品猪肉",
          "quantity": 200,
          "unitPrice": 100,
          "subtotal": 20000
        }
      ]
    }
  ]
}
```

##### 业务逻辑核心

1. **查询订单**: FROM orders WHERE customerId = ?
2. **关联产品**: JOIN order_items表
3. **排序**: ORDER BY orderDate DESC
4. **返回列表**: 完整的订单历史

---

#### 5.3 获取客户评级分布

**端点**: `GET /api/mobile/{factoryId}/customers/rating-distribution`
**功能**: 获取所有客户的评级分布统计
**权限**: 工厂管理员、销售管理员

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "1": 5,    // 1星客户: 5个
    "2": 12,   // 2星客户: 12个
    "3": 68,   // 3星客户: 68个
    "4": 45,   // 4星客户: 45个
    "5": 26    // 5星客户: 26个
  }
}
```

##### 业务逻辑核心

1. **评级聚合**: GROUP BY rating
2. **统计数量**: COUNT(*) for each rating
3. **工厂过滤**: WHERE factoryId = ?

---

#### 5.4 获取客户总体统计

**端点**: `GET /api/mobile/{factoryId}/customers/overall-statistics`
**功能**: 获取工厂所有客户的汇总统计
**权限**: 工厂管理员、销售管理员

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "totalCustomers": 156,
    "activeCustomers": 142,
    "inactiveCustomers": 14,
    "newCustomersThisMonth": 8,
    "typeDistribution": {
      "企业": 95,
      "个人": 32,
      "经销商": 18,
      "零售": 11
    },
    "industryDistribution": {
      "餐饮": 68,
      "零售": 45,
      "批发": 28,
      "其他": 15
    },
    "ratingDistribution": {
      "5": 26,
      "4": 45,
      "3": 68,
      "2": 12,
      "1": 5
    },
    "financialSummary": {
      "totalCreditLimit": 15600000,
      "totalCurrentBalance": -1250000,  // 总欠款
      "totalAvailableCredit": 14350000,
      "customersWithOutstanding": 45,   // 有欠款客户数
      "avgCreditUtilization": 8.0       // 平均信用额度使用率 (%)
    },
    "vipCustomers": 26,                  // VIP客户数（5星）
    "atRiskCustomers": 17                // 风险客户数（1-2星或超期欠款）
  }
}
```

##### 业务逻辑核心

1. **客户总数**: COUNT(*) WHERE factoryId = ?
2. **类型分布**: GROUP BY type
3. **行业分布**: GROUP BY industry
4. **评级分布**: GROUP BY rating
5. **财务汇总**:
   - totalCreditLimit: SUM(creditLimit)
   - totalCurrentBalance: SUM(currentBalance)
   - customersWithOutstanding: COUNT(*) WHERE currentBalance < 0
6. **风险客户**: 1-2星客户 + 超期欠款客户

---

### 6. 批量操作

#### 6.1 从Excel文件批量导入客户

**端点**: `POST /api/mobile/{factoryId}/customers/import`
**功能**: 批量导入客户（Excel格式）
**权限**: 工厂管理员、销售管理员

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
      { /* CustomerDTO */ }
    ],
    "failureRecords": [
      {
        "rowNumber": 15,
        "data": { /* 原始数据 */ },
        "errorMessage": "客户代码已存在: C-001"
      }
    ]
  }
}
```

##### 业务逻辑核心

1. **验证文件**: 格式(.xlsx)、大小(≤10MB)
2. **解析Excel**: Apache POI
3. **验证数据**: 每行数据验证（必填、格式、唯一性）
4. **批量插入**: 成功记录批量插入
5. **事务处理**: 每行独立事务
6. **返回结果**: 成功和失败记录分别列出

**Excel格式要求**:
| 客户名称 | 客户代码 | 客户类型 | 联系人 | 联系电话 | 邮箱 | 地址 | 信用额度 | 付款期限 | 评级 |
|---------|---------|---------|--------|---------|------|------|---------|---------|------|
| 上海餐饮 | C-001 | 企业 | 张经理 | 13800138000 | zhang@example.com | 上海 | 100000 | 30 | 4 |

##### 代码示例

```typescript
const importCustomers = async (factoryId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<ApiResponse<ImportResult<CustomerDTO>>>(
    `/api/mobile/${factoryId}/customers/import`,
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

#### 6.2 导出客户列表

**端点**: `GET /api/mobile/{factoryId}/customers/export`
**功能**: 导出工厂所有客户为Excel文件
**权限**: 工厂管理员、销售管理员

##### 响应结构

**成功响应** (200):
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="客户列表_20251120_143000.xlsx"

[Binary Excel file]
```

##### 业务逻辑核心

1. **查询所有客户**: WHERE factoryId = ? AND deleted = false
2. **生成Excel**: Apache POI
3. **包含计算字段**: availableCredit, totalOrders, totalRevenue
4. **设置响应头**: Content-Type, Content-Disposition
5. **返回文件流**: byte[]

**导出字段**:
- 基础信息: name, customerCode, type, industry
- 联系信息: contactPerson, phoneNumber, email, address
- 财务信息: creditLimit, currentBalance, availableCredit
- 其他: rating, isActive, totalOrders, totalRevenue

##### 代码示例

```typescript
const exportCustomers = async (factoryId: string) => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/customers/export`,
    {
      responseType: 'blob',  // 接收二进制数据
    }
  );

  // 触发下载
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `客户列表_${Date.now()}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};
```

---

#### 6.3 下载客户导入模板

**端点**: `GET /api/mobile/{factoryId}/customers/export/template`
**功能**: 下载客户导入模板（空Excel，带表头和示例）
**权限**: 工厂管理员、销售管理员

##### 响应结构

**成功响应** (200):
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="客户导入模板.xlsx"

[Binary Excel file with headers and sample rows]
```

##### 业务逻辑核心

1. **生成模板Excel**: 表头 + 2行示例数据
2. **添加数据验证**: 下拉列表（客户类型、行业）
3. **添加说明Sheet**: 字段说明、填写规范
4. **返回文件流**: byte[]

---

#### 6.4 批量导入客户（JSON格式）

**端点**: `POST /api/mobile/{factoryId}/customers/import/json`
**功能**: 批量导入客户（JSON格式）
**权限**: 工厂管理员、销售管理员

##### 请求参数

**Body**:
```typescript
[
  {
    name: string,
    customerCode: string,
    type: string,
    contactPerson: string,
    phoneNumber: string,
    // ... 其他字段
  },
  // ... 更多客户
]
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "成功导入8个客户",
  "data": [
    { /* CustomerDTO */ }
  ]
}
```

##### 业务逻辑核心

1. **验证数组**: 每个对象验证
2. **批量插入**: 使用事务
3. **返回成功列表**: 所有成功创建的客户

---

### 7. 客户分析

#### 7.1 检查客户代码是否存在

**端点**: `GET /api/mobile/{factoryId}/customers/check-code`
**功能**: 检查客户代码是否已存在（用于前端实时验证）
**权限**: 工厂所有角色

##### 请求参数

**Query Parameters**:
```typescript
{
  customerCode: string  // 客户代码（必填）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": true  // true表示已存在，false表示可用
}
```

##### 业务逻辑核心

1. **查询客户代码**: WHERE factoryId = ? AND customerCode = ?
2. **返回存在性**: EXISTS() 结果

##### 代码示例

```typescript
const checkCustomerCode = async (factoryId: string, customerCode: string) => {
  const response = await apiClient.get<ApiResponse<boolean>>(
    `/api/mobile/${factoryId}/customers/check-code`,
    { params: { customerCode } }
  );
  return response.data.data;  // true/false
};

// 使用示例：实时验证
const CustomerCodeInput = () => {
  const [code, setCode] = useState('');
  const [exists, setExists] = useState(false);

  const handleBlur = async () => {
    if (code) {
      const isExists = await checkCustomerCode('CRETAS_2024_001', code);
      setExists(isExists);
    }
  };

  return (
    <TextInput
      value={code}
      onChangeText={setCode}
      onBlur={handleBlur}
      placeholder="客户代码"
    />
    {exists && <Text style={{color: 'red'}}>该客户代码已存在</Text>}
  );
};
```

---

#### 7.2 获取有欠款的客户

**端点**: `GET /api/mobile/{factoryId}/customers/outstanding-balance`
**功能**: 获取所有有欠款的客户（currentBalance < 0）
**权限**: 工厂管理员、财务管理员

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": [
    {
      "id": "CUST-001",
      "name": "上海餐饮有限公司",
      "currentBalance": -15000,
      "creditLimit": 100000,
      "overdueAmount": 8000,        // 逾期金额
      "overdueDays": 15,            // 逾期天数
      "lastPaymentDate": "2025-10-20",
      "contactPerson": "张经理",
      "phoneNumber": "13800138000"
    }
  ]
}
```

##### 业务逻辑核心

1. **欠款过滤**: WHERE currentBalance < 0
2. **工厂过滤**: AND factoryId = ?
3. **计算逾期**:
   - overdueAmount: 超过paymentTerms天的未付金额
   - overdueDays: today() - (lastOrderDate + paymentTerms)
4. **排序**: ORDER BY abs(currentBalance) DESC (欠款多的排前面)

##### 代码示例

```typescript
const getCustomersWithOutstandingBalance = async (factoryId: string) => {
  const response = await apiClient.get<ApiResponse<CustomerDTO[]>>(
    `/api/mobile/${factoryId}/customers/outstanding-balance`
  );
  return response.data;
};
```

---

#### 7.3 获取VIP客户

**端点**: `GET /api/mobile/{factoryId}/customers/vip`
**功能**: 获取VIP客户（5星评级或营收Top N）
**权限**: 工厂管理员、销售管理员

##### 请求参数

**Query Parameters**:
```typescript
{
  limit?: number  // 数量限制（默认10）
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
      "id": "CUST-001",
      "name": "上海餐饮有限公司",
      "rating": 5,
      "totalRevenue": 850000,
      "totalOrders": 56,
      "avgOrderAmount": 15178.57,
      "lastOrderDate": "2025-11-18"
    }
  ]
}
```

##### 业务逻辑核心

1. **VIP标准**:
   - rating = 5 (5星客户)
   - OR totalRevenue排名Top N
2. **排序**: ORDER BY totalRevenue DESC
3. **限制数量**: LIMIT N

---

#### 7.4 获取客户类型分布

**端点**: `GET /api/mobile/{factoryId}/customers/type-distribution`
**功能**: 获取客户类型分布统计
**权限**: 工厂管理员、销售管理员

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "企业": 95,
    "个人": 32,
    "经销商": 18,
    "零售": 11
  }
}
```

##### 业务逻辑核心

1. **类型聚合**: GROUP BY type
2. **统计数量**: COUNT(*) for each type
3. **工厂过滤**: WHERE factoryId = ?

---

#### 7.5 获取客户行业分布

**端点**: `GET /api/mobile/{factoryId}/customers/industry-distribution`
**功能**: 获取客户行业分布统计
**权限**: 工厂管理员、销售管理员

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "餐饮": 68,
    "零售": 45,
    "批发": 28,
    "其他": 15
  }
}
```

##### 业务逻辑核心

1. **行业聚合**: GROUP BY industry
2. **统计数量**: COUNT(*) for each industry
3. **工厂过滤**: WHERE factoryId = ?

---

## 核心业务逻辑

### 客户生命周期管理

**完整流程**:
1. **新客户阶段**: 创建客户 → 设置信用额度 → 初始评级
2. **活跃阶段**: 接受订单 → 发货 → 收款 → 更新余额
3. **关系维护**: 定期评级 → 调整信用额度 → VIP升级
4. **风险管理**: 监控欠款 → 预警逾期 → 限制订单
5. **流失预防**: 分析购买频率 → 客户回访 → 优惠政策

### 信用管理系统

**信用额度计算**:
```
可用额度 = 信用额度 - abs(当前余额)

示例:
- creditLimit = 100,000元
- currentBalance = -15,000元 (欠款)
- availableCredit = 100,000 - 15,000 = 85,000元
```

**信用风险等级**:
```
1. 优质客户 (绿色):
   - 5星评级
   - 信用使用率 < 30%
   - 无逾期记录

2. 正常客户 (黄色):
   - 3-4星评级
   - 信用使用率 30%-70%
   - 偶尔逾期但及时还款

3. 风险客户 (橙色):
   - 1-2星评级
   - 信用使用率 > 70%
   - 频繁逾期

4. 高风险客户 (红色):
   - 超过信用额度
   - 逾期超过30天
   - 限制新订单
```

### 客户评级算法

**评级因素权重**:
```
总分 = 订单金额(30%) + 付款及时性(40%) + 订单频率(20%) + 合作年限(10%)

具体计算:
1. 订单金额得分: (totalRevenue / factoryAvgRevenue) × 30
2. 付款及时性得分: onTimePaymentRate × 40
3. 订单频率得分: (orderFrequency / factoryAvgFrequency) × 20
4. 合作年限得分: min(daysSinceFirstOrder / 365, 5) × 2

评级标准:
- 5星: 总分 ≥ 90
- 4星: 总分 70-89
- 3星: 总分 50-69
- 2星: 总分 30-49
- 1星: 总分 < 30
```

### 客户细分策略

**RFM模型**:
- **R (Recency)**: 最近一次购买距今天数
- **F (Frequency)**: 购买频率
- **M (Monetary)**: 购买金额

**客户分类**:
```
1. 重要价值客户 (R:高 F:高 M:高)
   - VIP服务
   - 专属客户经理
   - 优惠政策

2. 重要保持客户 (R:低 F:高 M:高)
   - 定期回访
   - 挽留措施

3. 重要发展客户 (R:高 F:低 M:高)
   - 增加互动
   - 促进复购

4. 一般客户 (R:中 F:中 M:中)
   - 标准服务

5. 流失预警客户 (R:低 F:低 M:低)
   - 流失预防
   - 再激活营销
```

---

## 数据模型

### Customer实体

**表名**: `customers`

**字段**:
```java
public class Customer {
    private String id;                // 客户ID (主键)
    private String factoryId;         // 工厂ID (外键)
    private String customerCode;      // 客户代码（工厂内唯一）
    private String name;              // 客户名称
    private String type;              // 客户类型 (企业/个人/经销商/零售)
    private String industry;          // 所属行业
    private String contactPerson;     // 联系人
    private String phoneNumber;       // 联系电话
    private String email;             // 邮箱
    private String address;           // 地址
    private BigDecimal creditLimit;   // 信用额度
    private BigDecimal currentBalance;// 当前余额（负数表示欠款）
    private Integer paymentTerms;     // 付款期限（天）
    private String taxNumber;         // 税号
    private Integer rating;           // 评级（1-5）
    private String ratingNotes;       // 评级说明
    private Boolean isActive;         // 激活状态
    private String notes;             // 备注
    private Boolean deleted;          // 软删除标记
    private LocalDateTime createdAt;  // 创建时间
    private Integer createdBy;        // 创建人ID
    private LocalDateTime updatedAt;  // 更新时间
}
```

**索引**:
- `idx_factory_id`: factoryId
- `idx_customer_code`: (factoryId, customerCode) UNIQUE
- `idx_is_active`: isActive
- `idx_rating`: rating

**计算字段** (DTO中):
```typescript
interface CustomerDTO extends Customer {
  availableCredit: number;     // creditLimit - abs(currentBalance)
  totalOrders: number;         // 历史订单数
  totalRevenue: number;        // 历史总营收
  lastOrderDate: string;       // 最后订单日期
  isOverdue: boolean;          // 是否逾期
  overdueDays: number;         // 逾期天数
  customerLifetimeValue: number; // 客户生命周期价值
}
```

---

## 总结

### 端点概览

**客户管理** (26端点):
- CRUD: 5个
- 查询搜索: 4个
- 状态评级: 2个
- 财务管理: 2个
- 统计报告: 4个
- 批量操作: 4个
- 客户分析: 5个

### 关键业务价值

1. **完整的客户生命周期管理**: 从新客户到VIP客户的完整跟踪
2. **智能信用管理**: 信用额度控制、风险预警
3. **客户评级系统**: 自动评级、分级服务
4. **RFM客户细分**: 科学的客户分类和营销策略
5. **财务管理**: 应收账款、逾期监控
6. **数据驱动决策**: 丰富的统计报告支持客户管理决策

### 文档链接

- **主文档**: [PRD-API端点完整文档-v3.0.md](./PRD-API端点完整文档-v3.0.md) (超详细8维度)
- **API索引**: [PRD-API索引文档-v1.0.md](./PRD-API索引文档-v1.0.md) (导航中心)
- **其他Controller**:
  - [ProcessingController](./PRD-API-ProcessingController.md) (23端点)
  - [MaterialBatchController](./PRD-API-MaterialBatchController.md) (25端点)
  - [EquipmentController](./PRD-API-EquipmentController.md) (30端点)
  - [MobileController](./PRD-API-MobileController.md) (36端点)

---

**文档生成时间**: 2025-11-20
**生成者**: Claude Code
**版本**: v1.0
**总字数**: ~14,000字
