# PRD-API-SupplierController（供应商管理控制器）

**文档版本**: v1.0.0
**创建日期**: 2025-11-20
**Controller路径**: `/api/mobile/{factoryId}/suppliers`
**所属模块**: 供应链管理模块
**Controller文件**: `SupplierController.java` (399行)

---

## 📋 目录 (Table of Contents)

1. [Controller概述](#controller概述)
2. [端点清单](#端点清单)
3. [详细API文档](#详细api文档)
   - [3.1 创建供应商](#31-创建供应商)
   - [3.2 更新供应商](#32-更新供应商)
   - [3.3 删除供应商](#33-删除供应商)
   - [3.4 获取供应商详情](#34-获取供应商详情)
   - [3.5 获取供应商列表（分页）](#35-获取供应商列表分页)
   - [3.6 获取活跃供应商列表](#36-获取活跃供应商列表)
   - [3.7 搜索供应商](#37-搜索供应商)
   - [3.8 按材料类型获取供应商](#38-按材料类型获取供应商)
   - [3.9 切换供应商状态](#39-切换供应商状态)
   - [3.10 更新供应商评级](#310-更新供应商评级)
   - [3.11 更新供应商信用额度](#311-更新供应商信用额度)
   - [3.12 获取供应商统计信息](#312-获取供应商统计信息)
   - [3.13 获取供应商供货历史](#313-获取供应商供货历史)
   - [3.14 检查供应商代码是否存在](#314-检查供应商代码是否存在)
   - [3.15 导出供应商列表](#315-导出供应商列表)
   - [3.16 下载供应商导入模板](#316-下载供应商导入模板)
   - [3.17 批量导入供应商](#317-批量导入供应商)
   - [3.18 获取供应商评级分布](#318-获取供应商评级分布)
   - [3.19 获取有欠款的供应商](#319-获取有欠款的供应商)
4. [数据模型](#数据模型)
5. [业务规则](#业务规则)
6. [错误处理](#错误处理)
7. [前端集成指南](#前端集成指南)

---

## Controller概述

### 功能描述

**SupplierController** 负责管理食品生产企业的供应商信息，是供应链管理系统的核心模块。

**核心功能**:
- ✅ **供应商基础管理**: CRUD操作（创建、查询、更新、删除）
- ✅ **供应商筛选**: 活跃供应商、材料类型筛选、关键词搜索
- ✅ **供应商评级系统**: 1-5星评级，支持评级说明
- ✅ **信用管理**: 信用额度、当前余额、欠款追踪
- ✅ **供货统计**: 供货历史、统计信息、评级分布
- ✅ **批量操作**: Excel导入/导出、模板下载
- ✅ **代码唯一性**: 供应商代码验证

**业务价值**:
- 🔗 **供应链追溯**: 完整记录供应商信息，支持食品安全追溯
- 💰 **财务管理**: 信用额度控制，欠款预警
- ⭐ **质量保障**: 供应商评级体系，优选供应商
- 📊 **数据分析**: 供货历史统计，优化采购决策

**使用场景**:
1. 新增供应商时，录入完整信息（联系人、资质、银行账户）
2. 根据材料类型快速查找可用供应商
3. 定期评估供应商质量，更新评级
4. 监控供应商信用额度，预防财务风险
5. 批量导入供应商数据，快速系统迁移

---

## 端点清单

| # | HTTP方法 | 端点路径 | 功能描述 | 权限要求 | E2E验证 |
|---|----------|----------|----------|----------|---------|
| 1 | POST | `/suppliers` | 创建供应商 | factory_*, workshop_manager | ⚪ 未验证 |
| 2 | PUT | `/suppliers/{supplierId}` | 更新供应商 | factory_*, workshop_manager | ⚪ 未验证 |
| 3 | DELETE | `/suppliers/{supplierId}` | 删除供应商（软删除） | factory_super_admin, factory_admin | ⚪ 未验证 |
| 4 | GET | `/suppliers/{supplierId}` | 获取供应商详情 | factory_* | ⚪ 未验证 |
| 5 | GET | `/suppliers` | 获取供应商列表（分页） | factory_* | ⚪ 未验证 |
| 6 | GET | `/suppliers/active` | 获取活跃供应商列表 | factory_* | ⚪ 未验证 |
| 7 | GET | `/suppliers/search` | 搜索供应商（关键词） | factory_* | ⚪ 未验证 |
| 8 | GET | `/suppliers/by-material` | 按材料类型获取供应商 | factory_* | ⚪ 未验证 |
| 9 | PUT | `/suppliers/{supplierId}/status` | 切换供应商状态（激活/停用） | factory_super_admin, factory_admin | ⚪ 未验证 |
| 10 | PUT | `/suppliers/{supplierId}/rating` | 更新供应商评级（1-5星） | factory_super_admin, factory_admin | ⚪ 未验证 |
| 11 | PUT | `/suppliers/{supplierId}/credit-limit` | 更新供应商信用额度 | factory_super_admin, factory_admin | ⚪ 未验证 |
| 12 | GET | `/suppliers/{supplierId}/statistics` | 获取供应商统计信息 | factory_* | ⚪ 未验证 |
| 13 | GET | `/suppliers/{supplierId}/history` | 获取供应商供货历史 | factory_* | ⚪ 未验证 |
| 14 | GET | `/suppliers/check-code` | 检查供应商代码是否存在 | factory_* | ⚪ 未验证 |
| 15 | GET | `/suppliers/export` | 导出供应商列表（Excel） | factory_super_admin, factory_admin | ⚪ 未验证 |
| 16 | GET | `/suppliers/export/template` | 下载供应商导入模板 | factory_* | ⚪ 未验证 |
| 17 | POST | `/suppliers/import` | 批量导入供应商（Excel） | factory_super_admin, factory_admin | ⚪ 未验证 |
| 18 | GET | `/suppliers/rating-distribution` | 获取供应商评级分布 | factory_* | ⚪ 未验证 |
| 19 | GET | `/suppliers/outstanding-balance` | 获取有欠款的供应商 | factory_super_admin, factory_admin | ⚪ 未验证 |

**图例**:
- ✅ E2E已验证 (100%通过)
- ⚠️ E2E部分验证
- ⚪ 未验证（需要添加测试）

**端点统计**:
- **总计**: 19个端点
- **CRUD**: 4个（创建、查询、更新、删除）
- **查询端点**: 9个（列表、详情、活跃、搜索、材料类型、统计、历史、评级分布、欠款）
- **写操作端点**: 7个（创建、更新、删除、状态、评级、信用额度、导入）
- **批量操作**: 3个（导出、导入、模板下载）

---

## 详细API文档

### 3.1 创建供应商

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `POST /api/mobile/{factoryId}/suppliers` |
| **功能** | 创建新的供应商记录 |
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
interface CreateSupplierRequest {
  // 基本信息
  code: string;              // 必填，供应商内部代码（工厂内唯一）
  supplierCode: string;      // 必填，供应商编号（外部代码）
  name: string;              // 必填，供应商名称

  // 联系信息
  contactPerson?: string;    // 可选，联系人姓名
  contactPhone?: string;     // 可选，联系人电话
  contactEmail?: string;     // 可选，联系人邮箱
  address?: string;          // 可选，地址

  // 企业资质
  businessLicense?: string;  // 可选，营业执照号
  taxNumber?: string;        // 可选，税号
  qualityCertificates?: string;  // 可选，质量证书（逗号分隔）

  // 银行信息
  bankName?: string;         // 可选，开户银行
  bankAccount?: string;      // 可选，银行账号

  // 业务信息
  suppliedMaterials?: string;  // 可选，供应材料类型（逗号分隔）
  paymentTerms?: string;       // 可选，付款条款（如"30天账期"）
  deliveryDays?: number;       // 可选，交货天数

  // 财务信息
  creditLimit?: number;        // 可选，信用额度（默认0）
  currentBalance?: number;     // 可选，当前余额（默认0，负数表示欠款）

  // 评级信息
  rating?: number;             // 可选，评级1-5星
  ratingNotes?: string;        // 可选，评级说明

  // 其他
  isActive?: boolean;          // 可选，是否激活（默认true）
  notes?: string;              // 可选，备注
}
```

**参数验证**:
- `code`: 必填，工厂内唯一，1-50字符
- `supplierCode`: 必填，1-50字符
- `name`: 必填，1-200字符
- `rating`: 可选，1-5之间的整数
- `creditLimit`: 可选，≥0
- `deliveryDays`: 可选，≥0

#### 响应结构

**成功响应** (200 OK):
```typescript
interface Response {
  code: 200;
  message: "供应商创建成功";
  success: true;
  data: SupplierDTO;  // 创建的供应商信息
}

interface SupplierDTO {
  id: string;                 // 供应商ID（UUID）
  factoryId: string;          // 工厂ID
  code: string;               // 供应商内部代码
  supplierCode: string;       // 供应商编号
  name: string;               // 供应商名称
  contactPerson?: string;     // 联系人
  contactPhone?: string;      // 联系电话
  contactEmail?: string;      // 联系邮箱
  address?: string;           // 地址
  businessLicense?: string;   // 营业执照号
  taxNumber?: string;         // 税号
  bankName?: string;          // 开户银行
  bankAccount?: string;       // 银行账号
  suppliedMaterials?: string; // 供应材料
  paymentTerms?: string;      // 付款条款
  deliveryDays?: number;      // 交货天数
  creditLimit: number;        // 信用额度
  currentBalance: number;     // 当前余额
  rating?: number;            // 评级
  ratingNotes?: string;       // 评级说明
  qualityCertificates?: string;  // 质量证书
  isActive: boolean;          // 是否激活
  notes?: string;             // 备注
  createdBy: number;          // 创建者ID
  createdAt: string;          // 创建时间
  updatedAt: string;          // 更新时间
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "供应商创建成功",
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "factoryId": "CRETAS_2024_001",
    "code": "SUP001",
    "supplierCode": "GYS-2025-001",
    "name": "上海优质食材供应有限公司",
    "contactPerson": "张经理",
    "contactPhone": "13800138000",
    "contactEmail": "zhang@supplier.com",
    "address": "上海市浦东新区食品工业园区88号",
    "businessLicense": "91310115MA1K12345",
    "taxNumber": "91310115MA1K12345",
    "bankName": "中国工商银行上海分行",
    "bankAccount": "1234567890123456",
    "suppliedMaterials": "猪肉,牛肉,鸡肉",
    "paymentTerms": "30天账期",
    "deliveryDays": 2,
    "creditLimit": 500000,
    "currentBalance": 0,
    "rating": 5,
    "ratingNotes": "优质供应商，长期合作伙伴",
    "qualityCertificates": "ISO9001,HACCP",
    "isActive": true,
    "notes": "VIP供应商",
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
2. 检查供应商代码code是否在工厂内唯一
3. 自动生成UUID作为供应商ID
4. 设置createdBy为当前用户ID
5. 设置默认值:
   - isActive: true（默认激活）
   - creditLimit: 0（默认无信用额度）
   - currentBalance: 0（默认无余额）
6. 保存到数据库
7. 返回创建的供应商信息
```

**唯一性约束**:
- `code` 在同一工厂内必须唯一
- 数据库约束: `UNIQUE(factory_id, code)`

#### TypeScript代码示例

**API调用**:
```typescript
import { apiClient } from '@/services/api/apiClient';

interface CreateSupplierRequest {
  code: string;
  supplierCode: string;
  name: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  businessLicense?: string;
  taxNumber?: string;
  bankName?: string;
  bankAccount?: string;
  suppliedMaterials?: string;
  paymentTerms?: string;
  deliveryDays?: number;
  creditLimit?: number;
  currentBalance?: number;
  rating?: number;
  ratingNotes?: string;
  qualityCertificates?: string;
  isActive?: boolean;
  notes?: string;
}

/**
 * 创建供应商
 */
export const createSupplier = async (
  factoryId: string,
  supplier: CreateSupplierRequest
): Promise<ApiResponse<SupplierDTO>> => {
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/suppliers`,
    supplier
  );

  return response.data;
};
```

**React Native表单组件**:
```typescript
import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { createSupplier } from '@/services/api/supplierApiClient';

const CreateSupplierScreen: React.FC = () => {
  const [formData, setFormData] = useState({
    code: '',
    supplierCode: '',
    name: '',
    contactPerson: '',
    contactPhone: '',
    address: '',
    suppliedMaterials: '',
    creditLimit: '',
  });

  const handleSubmit = async () => {
    try {
      // 前端验证
      if (!formData.code || !formData.supplierCode || !formData.name) {
        Alert.alert('验证失败', '请填写必填字段');
        return;
      }

      // 调用API
      const result = await createSupplier('CRETAS_2024_001', {
        code: formData.code,
        supplierCode: formData.supplierCode,
        name: formData.name,
        contactPerson: formData.contactPerson || undefined,
        contactPhone: formData.contactPhone || undefined,
        address: formData.address || undefined,
        suppliedMaterials: formData.suppliedMaterials || undefined,
        creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : undefined,
      });

      if (result.success) {
        Alert.alert('成功', '供应商创建成功', [
          {
            text: '确定',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (error) {
      console.error('创建供应商失败:', error);
      Alert.alert('错误', '创建供应商失败，请重试');
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <TextInput
        placeholder="供应商代码 *"
        value={formData.code}
        onChangeText={(text) => setFormData({ ...formData, code: text })}
      />
      <TextInput
        placeholder="供应商编号 *"
        value={formData.supplierCode}
        onChangeText={(text) => setFormData({ ...formData, supplierCode: text })}
      />
      <TextInput
        placeholder="供应商名称 *"
        value={formData.name}
        onChangeText={(text) => setFormData({ ...formData, name: text })}
      />
      <TextInput
        placeholder="联系人"
        value={formData.contactPerson}
        onChangeText={(text) => setFormData({ ...formData, contactPerson: text })}
      />
      <TextInput
        placeholder="联系电话"
        keyboardType="phone-pad"
        value={formData.contactPhone}
        onChangeText={(text) => setFormData({ ...formData, contactPhone: text })}
      />
      <TextInput
        placeholder="供应材料（逗号分隔）"
        value={formData.suppliedMaterials}
        onChangeText={(text) => setFormData({ ...formData, suppliedMaterials: text })}
      />
      <TextInput
        placeholder="信用额度"
        keyboardType="numeric"
        value={formData.creditLimit}
        onChangeText={(text) => setFormData({ ...formData, creditLimit: text })}
      />
      <Button title="创建供应商" onPress={handleSubmit} />
    </View>
  );
};
```

---

### 3.2 更新供应商

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/suppliers/{supplierId}` |
| **功能** | 更新现有供应商信息 |
| **权限** | `factory_super_admin`, `factory_admin`, `workshop_manager` |
| **限流** | 60次/分钟 |

#### 请求参数

**路径参数**:
```typescript
interface PathParams {
  factoryId: string;   // 工厂ID
  supplierId: string;  // 供应商ID
}
```

**请求体**: 同创建接口（所有字段可选，部分更新）

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "供应商更新成功",
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "上海优质食材供应有限公司（已更新）",
    "contactPhone": "13900139000",
    "updatedAt": "2025-01-16T14:30:00"
  }
}
```

#### 核心业务逻辑

**更新流程**:
```
1. 验证供应商存在且属于同一工厂
2. 验证用户权限
3. 部分更新允许的字段
4. 如果更新code，检查新code是否唯一
5. 更新updatedAt时间戳
6. 保存到数据库
7. 返回更新后的供应商信息
```

---

### 3.3 删除供应商

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `DELETE /api/mobile/{factoryId}/suppliers/{supplierId}` |
| **功能** | 删除供应商（软删除） |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 30次/分钟 |

#### 请求参数

**路径参数**:
```typescript
interface PathParams {
  factoryId: string;   // 工厂ID
  supplierId: string;  // 供应商ID
}
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "供应商删除成功",
  "success": true,
  "data": null
}
```

#### 核心业务逻辑

**删除流程**:
```
1. 验证供应商存在
2. 验证用户权限（仅super_admin和admin）
3. 检查供应商是否有关联的材料批次
4. 如果有关联数据，提示不能删除或软删除
5. 设置deletedAt时间戳（软删除）
6. 返回成功消息
```

**软删除**:
- 不是物理删除，而是设置 `deleted_at` 字段
- 软删除后的供应商不再出现在列表查询中

---

### 3.4 获取供应商详情

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/suppliers/{supplierId}` |
| **功能** | 根据ID获取单个供应商的详细信息 |
| **权限** | `factory_*` |
| **限流** | 200次/分钟 |

#### 请求参数

**路径参数**:
```typescript
interface PathParams {
  factoryId: string;   // 工厂ID
  supplierId: string;  // 供应商ID
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
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "factoryId": "CRETAS_2024_001",
    "code": "SUP001",
    "name": "上海优质食材供应有限公司",
    "contactPerson": "张经理",
    "contactPhone": "13800138000",
    "creditLimit": 500000,
    "currentBalance": -15000,
    "rating": 5,
    "isActive": true
  }
}
```

---

### 3.5 获取供应商列表（分页）

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/suppliers` |
| **功能** | 分页获取供应商列表 |
| **权限** | `factory_*` |
| **限流** | 100次/分钟 |

#### 请求参数

**路径参数**:
```typescript
interface PathParams {
  factoryId: string;  // 工厂ID
}
```

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
        "code": "SUP001",
        "name": "上海优质食材供应有限公司",
        "rating": 5,
        "isActive": true
      }
    ],
    "totalElements": 45,
    "totalPages": 3,
    "currentPage": 1,
    "size": 20,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

---

### 3.6 获取活跃供应商列表

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/suppliers/active` |
| **功能** | 获取所有激活状态的供应商（不分页） |
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
      "code": "SUP001",
      "name": "上海优质食材供应有限公司",
      "suppliedMaterials": "猪肉,牛肉,鸡肉",
      "isActive": true
    }
  ]
}
```

#### 核心业务逻辑

**查询条件**:
```sql
SELECT * FROM suppliers
WHERE factory_id = ? AND is_active = true AND deleted_at IS NULL
ORDER BY name ASC
```

---

### 3.7 搜索供应商

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/suppliers/search` |
| **功能** | 根据关键词搜索供应商（名称模糊匹配） |
| **权限** | `factory_*` |
| **限流** | 100次/分钟 |

#### 请求参数

**查询参数**:
```typescript
interface QueryParams {
  keyword: string;  // 必填，搜索关键词
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
      "name": "上海优质食材供应有限公司",
      "contactPhone": "13800138000"
    }
  ]
}
```

#### 核心业务逻辑

**搜索规则**:
```sql
SELECT * FROM suppliers
WHERE factory_id = ?
  AND deleted_at IS NULL
  AND (name LIKE CONCAT('%', ?, '%') OR code LIKE CONCAT('%', ?, '%'))
ORDER BY name ASC
LIMIT 50
```

---

### 3.8 按材料类型获取供应商

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/suppliers/by-material` |
| **功能** | 根据材料类型筛选供应商 |
| **权限** | `factory_*` |
| **限流** | 100次/分钟 |

#### 请求参数

**查询参数**:
```typescript
interface QueryParams {
  materialType: string;  // 必填，材料类型（如"猪肉"）
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
      "name": "上海优质食材供应有限公司",
      "suppliedMaterials": "猪肉,牛肉,鸡肉"
    }
  ]
}
```

#### 核心业务逻辑

**筛选规则**:
```sql
SELECT * FROM suppliers
WHERE factory_id = ?
  AND deleted_at IS NULL
  AND FIND_IN_SET(?, supplied_materials) > 0
ORDER BY name ASC
```

**前端使用**:
```typescript
// 获取能供应"猪肉"的供应商
const suppliers = await getSuppliersByMaterialType('CRETAS_2024_001', '猪肉');
```

---

### 3.9 切换供应商状态

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/suppliers/{supplierId}/status` |
| **功能** | 激活或停用供应商 |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 60次/分钟 |

#### 请求参数

**路径参数**:
```typescript
interface PathParams {
  factoryId: string;   // 工厂ID
  supplierId: string;  // 供应商ID
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
  "message": "供应商状态更新成功",
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "上海优质食材供应有限公司",
    "isActive": false,
    "updatedAt": "2025-01-16T15:00:00"
  }
}
```

#### 核心业务逻辑

**停用供应商**:
```
1. 验证供应商存在
2. 设置 isActive = false
3. 停用后的供应商不出现在活跃列表中
4. 但仍可查看历史记录和详情
```

---

### 3.10 更新供应商评级

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/suppliers/{supplierId}/rating` |
| **功能** | 更新供应商评级（1-5星） |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 60次/分钟 |

#### 请求参数

**路径参数**:
```typescript
interface PathParams {
  factoryId: string;   // 工厂ID
  supplierId: string;  // 供应商ID
}
```

**查询参数**:
```typescript
interface QueryParams {
  rating: number;      // 必填，评级1-5
  notes?: string;      // 可选，评级说明
}
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "供应商评级更新成功",
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "上海优质食材供应有限公司",
    "rating": 5,
    "ratingNotes": "优质供应商，产品质量稳定",
    "updatedAt": "2025-01-16T15:30:00"
  }
}
```

#### 核心业务逻辑

**评级标准**（建议）:
- ⭐ 1星: 不合格，考虑更换
- ⭐⭐ 2星: 较差，需要改进
- ⭐⭐⭐ 3星: 合格，可以合作
- ⭐⭐⭐⭐ 4星: 良好，优先合作
- ⭐⭐⭐⭐⭐ 5星: 优秀，战略合作伙伴

---

### 3.11 更新供应商信用额度

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/suppliers/{supplierId}/credit-limit` |
| **功能** | 更新供应商信用额度 |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 60次/分钟 |

#### 请求参数

**查询参数**:
```typescript
interface QueryParams {
  creditLimit: number;  // 必填，信用额度（≥0）
}
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "信用额度更新成功",
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "上海优质食材供应有限公司",
    "creditLimit": 800000,
    "currentBalance": -15000,
    "availableCredit": 785000
  }
}
```

#### 核心业务逻辑

**信用管理**:
```typescript
interface CreditManagement {
  creditLimit: number;        // 授信额度
  currentBalance: number;     // 当前余额（负数=欠款）
  availableCredit: number;    // 可用额度 = creditLimit - abs(currentBalance)
}

// 风险等级
if (abs(currentBalance) > creditLimit) {
  // 超额欠款，高风险
  triggerAlert();
} else if (creditUtilization > 80) {
  // 额度使用率>80%，预警
  sendWarning();
}
```

---

### 3.12 获取供应商统计信息

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/suppliers/{supplierId}/statistics` |
| **功能** | 获取供应商统计信息（供货次数、总金额等） |
| **权限** | `factory_*` |
| **限流** | 100次/分钟 |

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": {
    "supplierId": "550e8400-e29b-41d4-a716-446655440001",
    "supplierName": "上海优质食材供应有限公司",
    "totalOrders": 156,
    "totalAmount": 2850000,
    "averageOrderAmount": 18269.23,
    "onTimeDeliveryRate": 98.5,
    "qualityPassRate": 99.2,
    "lastOrderDate": "2025-01-15"
  }
}
```

---

### 3.13 获取供应商供货历史

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/suppliers/{supplierId}/history` |
| **功能** | 获取供应商供货历史记录 |
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
      "materialBatchId": "MAT-20250115-001",
      "materialType": "猪肉",
      "quantity": 500,
      "unitPrice": 25.5,
      "totalAmount": 12750,
      "receivedDate": "2025-01-15",
      "qualityStatus": "合格"
    }
  ]
}
```

---

### 3.14 检查供应商代码是否存在

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/suppliers/check-code` |
| **功能** | 检查供应商代码是否已存在（用于前端验证） |
| **权限** | `factory_*` |
| **限流** | 200次/分钟 |

#### 请求参数

**查询参数**:
```typescript
interface QueryParams {
  supplierCode: string;  // 必填，供应商代码
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
 * 检查供应商代码是否存在
 */
export const checkSupplierCode = async (
  factoryId: string,
  supplierCode: string
): Promise<boolean> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/suppliers/check-code`,
    {
      params: { supplierCode },
    }
  );

  return response.data.data;
};

// 使用示例：前端实时验证
const [codeExists, setCodeExists] = useState(false);

const handleCodeChange = async (code: string) => {
  if (code.length >= 3) {
    const exists = await checkSupplierCode('CRETAS_2024_001', code);
    setCodeExists(exists);
  }
};
```

---

### 3.15 导出供应商列表

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/suppliers/export` |
| **功能** | 导出供应商列表为Excel文件 |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 10次/分钟 |

#### 响应结构

**成功响应** (200 OK):
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="供应商列表_20250116_153000.xlsx"
Content-Length: 15360

[Binary Excel file content]
```

#### 核心业务逻辑

**Excel格式**:
| 供应商代码 | 供应商名称 | 联系人 | 联系电话 | 供应材料 | 信用额度 | 当前余额 | 评级 | 状态 |
|-----------|----------|-------|---------|---------|---------|---------|------|------|
| SUP001 | 上海优质食材... | 张经理 | 138... | 猪肉,牛肉 | 500000 | -15000 | 5 | 激活 |

---

### 3.16 下载供应商导入模板

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/suppliers/export/template` |
| **功能** | 下载供应商批量导入模板（Excel） |
| **权限** | `factory_*` |
| **限流** | 30次/分钟 |

#### 响应结构

**成功响应** (200 OK):
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="供应商导入模板.xlsx"

[Binary Excel template file]
```

#### 核心业务逻辑

**模板结构**:
- Sheet1: 供应商信息（带示例数据）
- Sheet2: 填写说明

**必填字段**:
- 供应商代码（code）
- 供应商编号（supplierCode）
- 供应商名称（name）

---

### 3.17 批量导入供应商

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `POST /api/mobile/{factoryId}/suppliers/import` |
| **功能** | 从Excel文件批量导入供应商 |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 5次/分钟 |

#### 请求参数

**表单数据**:
```typescript
interface FormData {
  file: File;  // Excel文件（.xlsx格式，最大10MB）
}
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "导入完成：成功15条，失败2条",
  "success": true,
  "data": {
    "isFullSuccess": false,
    "successCount": 15,
    "failureCount": 2,
    "successRecords": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "code": "SUP001",
        "name": "上海优质食材供应有限公司"
      }
    ],
    "failureRecords": [
      {
        "rowNumber": 3,
        "supplierCode": "SUP003",
        "errorMessage": "供应商代码已存在"
      },
      {
        "rowNumber": 5,
        "supplierCode": "SUP005",
        "errorMessage": "联系电话格式错误"
      }
    ]
  }
}
```

#### 核心业务逻辑

**导入流程**:
```
1. 验证文件格式（仅支持.xlsx）
2. 验证文件大小（≤10MB）
3. 读取Excel数据
4. 逐行验证数据：
   - 必填字段检查
   - 格式验证（电话、邮箱）
   - 代码唯一性检查
5. 分批插入数据库（事务处理）
6. 收集成功和失败记录
7. 返回导入结果
```

**错误处理**:
- 部分导入成功，部分失败时，返回详细错误信息
- 失败记录包含行号和错误原因

---

### 3.18 获取供应商评级分布

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/suppliers/rating-distribution` |
| **功能** | 获取供应商评级分布统计（1-5星各有多少家） |
| **权限** | `factory_*` |
| **限流** | 100次/分钟 |

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": {
    "1": 2,
    "2": 5,
    "3": 12,
    "4": 18,
    "5": 8
  }
}
```

#### TypeScript代码示例

```typescript
/**
 * 获取供应商评级分布
 */
export const getSupplierRatingDistribution = async (
  factoryId: string
): Promise<Record<number, number>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/suppliers/rating-distribution`
  );

  return response.data.data;
};

// 使用示例：绘制图表
const distribution = await getSupplierRatingDistribution('CRETAS_2024_001');

// 饼图数据
const chartData = [
  { label: '5星', value: distribution[5] || 0, color: '#4CAF50' },
  { label: '4星', value: distribution[4] || 0, color: '#8BC34A' },
  { label: '3星', value: distribution[3] || 0, color: '#FFC107' },
  { label: '2星', value: distribution[2] || 0, color: '#FF9800' },
  { label: '1星', value: distribution[1] || 0, color: '#F44336' },
];
```

---

### 3.19 获取有欠款的供应商

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/suppliers/outstanding-balance` |
| **功能** | 获取有欠款的供应商列表（currentBalance < 0） |
| **权限** | `factory_super_admin`, `factory_admin` |
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
      "code": "SUP001",
      "name": "上海优质食材供应有限公司",
      "currentBalance": -15000,
      "creditLimit": 500000,
      "overdueAmount": 5000,
      "overdueDays": 15
    }
  ]
}
```

#### 核心业务逻辑

**查询条件**:
```sql
SELECT * FROM suppliers
WHERE factory_id = ?
  AND current_balance < 0
  AND deleted_at IS NULL
ORDER BY current_balance ASC
```

**使用场景**:
- 财务对账
- 欠款催收
- 风险预警

---

## 数据模型

### Supplier（供应商）

```typescript
/**
 * 供应商实体
 */
interface Supplier {
  // 主键
  id: string;                      // 供应商ID（UUID）

  // 关联字段
  factoryId: string;               // 工厂ID

  // 基本信息
  code: string;                    // 供应商内部代码（工厂内唯一）
  supplierCode: string;            // 供应商编号（外部代码）
  name: string;                    // 供应商名称

  // 联系信息
  contactPerson?: string;          // 联系人姓名
  contactPhone?: string;           // 联系人电话
  contactEmail?: string;           // 联系人邮箱
  address?: string;                // 地址

  // 企业资质
  businessLicense?: string;        // 营业执照号
  taxNumber?: string;              // 税号
  qualityCertificates?: string;    // 质量证书（逗号分隔）

  // 银行信息
  bankName?: string;               // 开户银行
  bankAccount?: string;            // 银行账号

  // 业务信息
  suppliedMaterials?: string;      // 供应材料类型（逗号分隔）
  paymentTerms?: string;           // 付款条款（如"30天账期"）
  deliveryDays?: number;           // 交货天数

  // 财务信息
  creditLimit: number;             // 信用额度
  currentBalance: number;          // 当前余额（负数表示欠款）

  // 评级信息
  rating?: number;                 // 评级（1-5星）
  ratingNotes?: string;            // 评级说明

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
CREATE TABLE suppliers (
  id VARCHAR(191) PRIMARY KEY,
  factory_id VARCHAR(191) NOT NULL,
  code VARCHAR(50) NOT NULL,
  supplier_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(100),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(100),
  address TEXT,
  business_license VARCHAR(100),
  tax_number VARCHAR(50),
  bank_name VARCHAR(100),
  bank_account VARCHAR(50),
  supplied_materials TEXT,
  payment_terms VARCHAR(200),
  delivery_days INT,
  credit_limit DECIMAL(12,2) DEFAULT 0,
  current_balance DECIMAL(12,2) DEFAULT 0,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  rating_notes TEXT,
  quality_certificates TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,

  UNIQUE KEY unique_supplier_code (factory_id, code),
  INDEX idx_supplier_factory (factory_id),
  INDEX idx_supplier_is_active (is_active),

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

---

## 业务规则

### 1. 唯一性规则

**供应商代码唯一性**:
- `code` 在同一工厂内必须唯一
- 数据库约束: `UNIQUE(factory_id, code)`

### 2. 评级规则

**评级范围**: 1-5星

**评级含义**（建议）:
- ⭐ 1星: 不合格，考虑更换
- ⭐⭐ 2星: 较差，需要改进
- ⭐⭐⭐ 3星: 合格，可以合作
- ⭐⭐⭐⭐ 4星: 良好，优先合作
- ⭐⭐⭐⭐⭐ 5星: 优秀，战略合作伙伴

### 3. 信用管理规则

**信用额度**:
```typescript
interface CreditManagement {
  creditLimit: number;        // 授信额度
  currentBalance: number;     // 当前余额（负数=欠款）
  availableCredit: number;    // 可用额度
}

// 可用额度计算
availableCredit = creditLimit - abs(currentBalance)

// 风险等级
const creditUtilization = abs(currentBalance) / creditLimit

if (creditUtilization > 100) {
  // 超额欠款，高风险
  level = 'CRITICAL'
} else if (creditUtilization > 80) {
  // 额度使用率>80%，预警
  level = 'WARNING'
} else {
  // 正常
  level = 'NORMAL'
}
```

### 4. 状态管理规则

**激活状态**:
- `isActive = true`: 正常合作中，出现在活跃列表
- `isActive = false`: 已停用，不出现在活跃列表，但可查看历史

**软删除**:
- `deletedAt != null`: 已删除，不出现在任何列表
- 软删除后仍可恢复

### 5. 批量导入规则

**文件限制**:
- 仅支持 `.xlsx` 格式
- 文件大小 ≤ 10MB
- 最多导入1000条记录

**数据验证**:
- 必填字段: `code`, `supplierCode`, `name`
- 格式验证: 电话号码、邮箱
- 唯一性验证: `code` 不能重复

**导入策略**:
- 部分成功: 继续导入其他记录
- 返回详细错误: 行号 + 错误原因

---

## 错误处理

### 错误码列表

| HTTP状态码 | 错误码 | 错误信息 | 说明 |
|-----------|-------|---------|------|
| 400 | INVALID_PARAMETER | 参数验证失败 | 请求参数不符合规则 |
| 400 | INVALID_FILE_FORMAT | 只支持.xlsx格式的Excel文件 | 文件格式错误 |
| 400 | FILE_TOO_LARGE | 文件大小不能超过10MB | 文件过大 |
| 404 | SUPPLIER_NOT_FOUND | 供应商不存在 | supplierId无效 |
| 409 | DUPLICATE_CODE | 供应商代码已存在 | code重复 |
| 409 | SUPPLIER_HAS_MATERIALS | 供应商有关联材料批次，无法删除 | 存在关联数据 |
| 403 | PERMISSION_DENIED | 权限不足 | 无权执行此操作 |

### 错误响应示例

**供应商代码重复** (409):
```json
{
  "code": 409,
  "message": "供应商代码已存在",
  "success": false,
  "error": {
    "type": "DUPLICATE_CODE",
    "details": {
      "code": "SUP001",
      "existingSupplierId": "550e8400-e29b-41d4-a716-446655440001"
    }
  }
}
```

**批量导入部分失败** (200):
```json
{
  "code": 200,
  "message": "导入完成：成功15条，失败2条",
  "success": true,
  "data": {
    "isFullSuccess": false,
    "successCount": 15,
    "failureCount": 2,
    "failureRecords": [
      {
        "rowNumber": 3,
        "supplierCode": "SUP003",
        "errorMessage": "供应商代码已存在"
      }
    ]
  }
}
```

---

## 前端集成指南

### 完整API客户端实现

创建 `src/services/api/supplierApiClient.ts`:

```typescript
import { apiClient } from './apiClient';
import type { ApiResponse, PageResponse } from '@/types/apiResponses';

/**
 * 供应商API客户端
 */

// ============ 类型定义 ============

export interface SupplierDTO {
  id: string;
  factoryId: string;
  code: string;
  supplierCode: string;
  name: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  businessLicense?: string;
  taxNumber?: string;
  bankName?: string;
  bankAccount?: string;
  suppliedMaterials?: string;
  paymentTerms?: string;
  deliveryDays?: number;
  creditLimit: number;
  currentBalance: number;
  rating?: number;
  ratingNotes?: string;
  qualityCertificates?: string;
  isActive: boolean;
  notes?: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierRequest {
  code: string;
  supplierCode: string;
  name: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  businessLicense?: string;
  taxNumber?: string;
  bankName?: string;
  bankAccount?: string;
  suppliedMaterials?: string;
  paymentTerms?: string;
  deliveryDays?: number;
  creditLimit?: number;
  currentBalance?: number;
  rating?: number;
  ratingNotes?: string;
  qualityCertificates?: string;
  isActive?: boolean;
  notes?: string;
}

// ============ API函数 ============

/**
 * 创建供应商
 */
export const createSupplier = async (
  factoryId: string,
  supplier: CreateSupplierRequest
): Promise<ApiResponse<SupplierDTO>> => {
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/suppliers`,
    supplier
  );

  return response.data;
};

/**
 * 更新供应商
 */
export const updateSupplier = async (
  factoryId: string,
  supplierId: string,
  updates: Partial<CreateSupplierRequest>
): Promise<ApiResponse<SupplierDTO>> => {
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/suppliers/${supplierId}`,
    updates
  );

  return response.data;
};

/**
 * 删除供应商
 */
export const deleteSupplier = async (
  factoryId: string,
  supplierId: string
): Promise<ApiResponse<void>> => {
  const response = await apiClient.delete(
    `/api/mobile/${factoryId}/suppliers/${supplierId}`
  );

  return response.data;
};

/**
 * 获取供应商详情
 */
export const getSupplierById = async (
  factoryId: string,
  supplierId: string
): Promise<ApiResponse<SupplierDTO>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/suppliers/${supplierId}`
  );

  return response.data;
};

/**
 * 获取供应商列表（分页）
 */
export const getSupplierList = async (
  factoryId: string,
  page: number = 1,
  size: number = 20
): Promise<ApiResponse<PageResponse<SupplierDTO>>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/suppliers`,
    {
      params: { page, size },
    }
  );

  return response.data;
};

/**
 * 获取活跃供应商列表
 */
export const getActiveSuppliers = async (
  factoryId: string
): Promise<ApiResponse<SupplierDTO[]>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/suppliers/active`
  );

  return response.data;
};

/**
 * 搜索供应商
 */
export const searchSuppliers = async (
  factoryId: string,
  keyword: string
): Promise<ApiResponse<SupplierDTO[]>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/suppliers/search`,
    {
      params: { keyword },
    }
  );

  return response.data;
};

/**
 * 按材料类型获取供应商
 */
export const getSuppliersByMaterialType = async (
  factoryId: string,
  materialType: string
): Promise<ApiResponse<SupplierDTO[]>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/suppliers/by-material`,
    {
      params: { materialType },
    }
  );

  return response.data;
};

/**
 * 切换供应商状态
 */
export const toggleSupplierStatus = async (
  factoryId: string,
  supplierId: string,
  isActive: boolean
): Promise<ApiResponse<SupplierDTO>> => {
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/suppliers/${supplierId}/status`,
    null,
    {
      params: { isActive },
    }
  );

  return response.data;
};

/**
 * 更新供应商评级
 */
export const updateSupplierRating = async (
  factoryId: string,
  supplierId: string,
  rating: number,
  notes?: string
): Promise<ApiResponse<SupplierDTO>> => {
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/suppliers/${supplierId}/rating`,
    null,
    {
      params: { rating, notes },
    }
  );

  return response.data;
};

/**
 * 更新供应商信用额度
 */
export const updateSupplierCreditLimit = async (
  factoryId: string,
  supplierId: string,
  creditLimit: number
): Promise<ApiResponse<SupplierDTO>> => {
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/suppliers/${supplierId}/credit-limit`,
    null,
    {
      params: { creditLimit },
    }
  );

  return response.data;
};

/**
 * 获取供应商统计信息
 */
export const getSupplierStatistics = async (
  factoryId: string,
  supplierId: string
): Promise<ApiResponse<Record<string, any>>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/suppliers/${supplierId}/statistics`
  );

  return response.data;
};

/**
 * 获取供应商供货历史
 */
export const getSupplierHistory = async (
  factoryId: string,
  supplierId: string
): Promise<ApiResponse<any[]>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/suppliers/${supplierId}/history`
  );

  return response.data;
};

/**
 * 检查供应商代码是否存在
 */
export const checkSupplierCode = async (
  factoryId: string,
  supplierCode: string
): Promise<boolean> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/suppliers/check-code`,
    {
      params: { supplierCode },
    }
  );

  return response.data.data;
};

/**
 * 导出供应商列表
 */
export const exportSupplierList = async (
  factoryId: string
): Promise<Blob> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/suppliers/export`,
    {
      responseType: 'blob',
    }
  );

  return response.data;
};

/**
 * 下载供应商导入模板
 */
export const downloadSupplierTemplate = async (
  factoryId: string
): Promise<Blob> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/suppliers/export/template`,
    {
      responseType: 'blob',
    }
  );

  return response.data;
};

/**
 * 批量导入供应商
 */
export const importSuppliers = async (
  factoryId: string,
  file: File
): Promise<ApiResponse<ImportResult<SupplierDTO>>> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post(
    `/api/mobile/${factoryId}/suppliers/import`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data;
};

/**
 * 获取供应商评级分布
 */
export const getSupplierRatingDistribution = async (
  factoryId: string
): Promise<ApiResponse<Record<number, number>>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/suppliers/rating-distribution`
  );

  return response.data;
};

/**
 * 获取有欠款的供应商
 */
export const getSuppliersWithOutstandingBalance = async (
  factoryId: string
): Promise<ApiResponse<SupplierDTO[]>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/suppliers/outstanding-balance`
  );

  return response.data;
};

// ============ 辅助函数 ============

/**
 * 获取评级星星显示
 */
export const getRatingStars = (rating?: number): string => {
  if (!rating) return '未评级';
  return '⭐'.repeat(rating);
};

/**
 * 获取信用风险等级
 */
export const getCreditRiskLevel = (
  creditLimit: number,
  currentBalance: number
): 'NORMAL' | 'WARNING' | 'CRITICAL' => {
  const creditUtilization = Math.abs(currentBalance) / creditLimit;

  if (creditUtilization > 1) return 'CRITICAL';
  if (creditUtilization > 0.8) return 'WARNING';
  return 'NORMAL';
};
```

---

## 总结

### 关键特性

1. **完整的CRUD操作**: 创建、查询、更新、删除供应商
2. **多维度筛选**: 活跃状态、材料类型、关键词搜索
3. **评级系统**: 1-5星评级，支持评级说明
4. **信用管理**: 额度控制、余额追踪、欠款预警
5. **批量操作**: Excel导入/导出、模板下载
6. **统计分析**: 供货历史、评级分布、欠款供应商

### 使用建议

1. **代码唯一性**: 创建前使用check-code接口验证
2. **评级管理**: 定期评估供应商，更新评级
3. **信用监控**: 监控欠款供应商，及时预警
4. **批量导入**: 系统迁移时使用Excel批量导入
5. **材料筛选**: 创建原材料批次时按材料类型筛选供应商

### 待实现功能

- 供应商考核评分系统
- 供应商合同管理
- 供应商准入审批流程
- 供应商年度报告
- 供应商风险预警系统

---

**文档结束**
