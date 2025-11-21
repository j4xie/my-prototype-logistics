# PRD-API-PlatformController

## 文档信息

| 项目 | 内容 |
|------|------|
| 文档标题 | PlatformController API详细设计文档 |
| 控制器名称 | PlatformController |
| 业务域 | 平台管理 (Platform Management) |
| 接口路径 | `/api/platform` |
| 文档版本 | v1.0.0 |
| 创建日期 | 2025-11-20 |
| 最后更新 | 2025-11-20 |
| 作者 | Cretas Team |

---

## 目录

- [1. 概述](#1-概述)
- [2. 核心功能](#2-核心功能)
- [3. API端点详细设计](#3-api端点详细设计)
  - [3.1 AI配额管理](#31-ai配额管理)
  - [3.2 工厂管理](#32-工厂管理)
  - [3.3 平台统计](#33-平台统计)
- [4. 数据结构](#4-数据结构)
- [5. 业务规则](#5-业务规则)
- [6. 错误处理](#6-错误处理)
- [7. 前端集成示例](#7-前端集成示例)

---

## 1. 概述

### 1.1 业务背景

**PlatformController**是白垩纪食品溯源系统的**平台管理核心控制器**，专门为平台管理员（super_admin、platform_admin）提供**工厂管理、AI配额管理和平台级统计**功能。

本控制器实现了**多租户SaaS平台**的核心管理能力：
- 🏭 **工厂生命周期管理**：创建、更新、激活/停用、删除工厂
- 🤖 **AI配额中央管理**：统一分配和监控各工厂的AI使用量
- 📊 **平台级数据汇总**：全平台工厂、用户、批次、产量统计
- 💼 **订阅计划管理**：支持BASIC、STANDARD、PREMIUM、ENTERPRISE四种计划

### 1.2 核心价值

1. **成本控制**：通过AI配额管理控制DeepSeek API调用成本
2. **资源监控**：实时监控各工厂的AI使用情况和资源占用
3. **租户管理**：统一管理多工厂租户的生命周期和权限
4. **数据洞察**：平台级数据汇总为运营决策提供支持

### 1.3 权限模型

所有接口均需要**平台管理员权限**：
```java
@PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
```

---

## 2. 核心功能

### 2.1 功能模块

**PlatformController**包含**11个API端点**，分为3大模块：

| 模块 | 端点数量 | 主要功能 |
|------|---------|---------|
| AI配额管理 | 3 | 查看配额、更新配额、使用统计 |
| 工厂管理 | 7 | CRUD、激活/停用、分页列表 |
| 平台统计 | 1 | 全平台数据汇总 |

### 2.2 技术栈

- **框架**：Spring Boot 2.7.15
- **认证**：JWT + Spring Security + @PreAuthorize
- **校验**：JSR-303 Bean Validation
- **文档**：Swagger/OpenAPI 3.0
- **数据库**：MySQL + Spring Data JPA

---

## 3. API端点详细设计

### 3.1 AI配额管理

#### 3.1.1 获取所有工厂AI配额

**基本信息**

| 项目 | 内容 |
|------|------|
| 接口路径 | `GET /api/platform/ai-quota` |
| 接口描述 | 获取所有工厂的AI配额设置和历史调用统计 |
| 权限要求 | super_admin, platform_admin |
| 请求参数 | 无 |

**响应数据结构**

```json
{
  "success": true,
  "message": "操作成功",
  "data": [
    {
      "id": "FISH_2025_001",
      "name": "白垩纪水产品工厂",
      "aiWeeklyQuota": 50,
      "_count": {
        "aiUsageLogs": 1250
      }
    },
    {
      "id": "FRUIT_2025_002",
      "name": "鲜果加工工厂",
      "aiWeeklyQuota": 100,
      "_count": {
        "aiUsageLogs": 3420
      }
    }
  ]
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 工厂ID |
| name | String | 工厂名称 |
| aiWeeklyQuota | Integer | 每周AI调用配额（次数） |
| _count.aiUsageLogs | Long | 历史总调用次数 |

**业务规则**

1. **排序规则**：默认按工厂创建时间排序
2. **历史统计**：`aiUsageLogs`包含所有时间段的调用记录
3. **配额范围**：0-1000次/周

**使用场景**

- 平台管理员查看所有工厂的配额分配情况
- 分析各工厂的AI使用历史
- 在配额调整前了解当前设置

---

#### 3.1.2 更新工厂AI配额

**基本信息**

| 项目 | 内容 |
|------|------|
| 接口路径 | `PUT /api/platform/ai-quota/{factoryId}` |
| 接口描述 | 更新指定工厂的AI每周配额 |
| 权限要求 | super_admin, platform_admin |

**请求参数**

**路径参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| factoryId | String | 是 | 工厂ID，如"FISH_2025_001" |

**请求体**：
```json
{
  "weeklyQuota": 120
}
```

**字段校验**：
| 字段 | 类型 | 必填 | 校验规则 |
|------|------|------|----------|
| weeklyQuota | Integer | 是 | @NotNull, @Min(0), @Max(1000) |

**响应数据结构**

```json
{
  "success": true,
  "message": "配额已更新",
  "data": {
    "factoryId": "FISH_2025_001",
    "weeklyQuota": 120
  }
}
```

**业务规则**

1. **配额范围**：0-1000次/周
2. **即时生效**：配额更新后立即生效
3. **不影响历史**：不清除已有的使用记录
4. **工厂必须存在**：factoryId不存在时返回404错误

**错误码**

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| FACTORY_NOT_FOUND | 404 | 工厂不存在 |
| INVALID_QUOTA | 400 | 配额值不在0-1000范围内 |

**使用场景**

- 升级工厂订阅计划时增加配额
- 工厂AI使用量超标时临时提升配额
- 降级订阅计划时减少配额

---

#### 3.1.3 获取平台AI使用统计

**基本信息**

| 项目 | 内容 |
|------|------|
| 接口路径 | `GET /api/platform/ai-usage-stats` |
| 接口描述 | 获取平台级别的AI使用统计数据（本周汇总） |
| 权限要求 | super_admin, platform_admin |
| 请求参数 | 无 |

**响应数据结构**

```json
{
  "success": true,
  "message": "操作成功",
  "data": {
    "currentWeek": "2025-W47",
    "totalUsed": 1850,
    "factories": [
      {
        "factoryId": "FISH_2025_001",
        "factoryName": "白垩纪水产品工厂",
        "weeklyQuota": 50,
        "used": 45,
        "remaining": 5,
        "utilization": "90.00"
      },
      {
        "factoryId": "FRUIT_2025_002",
        "factoryName": "鲜果加工工厂",
        "weeklyQuota": 100,
        "used": 78,
        "remaining": 22,
        "utilization": "78.00"
      }
    ]
  }
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| currentWeek | String | 当前周次，ISO 8601格式（YYYY-Www） |
| totalUsed | Long | 本周平台总使用量（所有工厂合计） |
| factories | Array | 各工厂使用情况列表 |
| factories[].factoryId | String | 工厂ID |
| factories[].factoryName | String | 工厂名称 |
| factories[].weeklyQuota | Integer | 每周配额 |
| factories[].used | Long | 本周已使用次数 |
| factories[].remaining | Long | 剩余次数 |
| factories[].utilization | String | 使用率（百分比，保留2位小数） |

**业务规则**

1. **统计周期**：ISO周（周一00:00 - 周日23:59）
2. **自动重置**：每周一00:00自动重置使用量
3. **排序规则**：按使用率降序排列
4. **包含禁用工厂**：统计包括已停用的工厂

**使用场景**

- 平台管理员监控本周AI使用情况
- 识别使用率高的工厂进行预警
- 分析不同工厂的AI需求差异
- 评估配额分配的合理性

---

### 3.2 工厂管理

#### 3.2.1 获取所有工厂列表

**基本信息**

| 项目 | 内容 |
|------|------|
| 接口路径 | `GET /api/platform/factories` |
| 接口描述 | 获取所有工厂的详细信息（支持可选分页） |
| 权限要求 | super_admin, platform_admin |

**请求参数**

**查询参数**：
| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| page | Integer | 否 | - | 页码（从0开始），不传则不分页 |
| size | Integer | 否 | - | 每页数量，不传则不分页 |

**请求示例**

```
GET /api/platform/factories
GET /api/platform/factories?page=0&size=10
GET /api/platform/factories?page=1&size=20
```

**响应数据结构**

```json
{
  "success": true,
  "message": "操作成功",
  "data": [
    {
      "id": "FISH_2025_001",
      "name": "白垩纪水产品工厂",
      "industryCode": "FISH",
      "regionCode": "2025",
      "address": "北京市朝阳区",
      "contactName": "张三",
      "contactPhone": "13800138000",
      "contactEmail": "contact@factory.com",
      "subscriptionPlan": "PREMIUM",
      "aiWeeklyQuota": 50,
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00",
      "updatedAt": "2025-11-20T14:20:00"
    }
  ]
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 工厂ID（格式：{INDUSTRY}_{REGION}_{序号}） |
| name | String | 工厂名称 |
| industryCode | String | 行业代码（2-10位大写字母） |
| regionCode | String | 地区代码（4位数字） |
| address | String | 工厂地址 |
| contactName | String | 联系人姓名 |
| contactPhone | String | 联系电话（11位手机号） |
| contactEmail | String | 联系邮箱 |
| subscriptionPlan | String | 订阅计划（BASIC/STANDARD/PREMIUM/ENTERPRISE） |
| aiWeeklyQuota | Integer | AI每周配额 |
| isActive | Boolean | 是否激活 |
| createdAt | LocalDateTime | 创建时间 |
| updatedAt | LocalDateTime | 更新时间 |

**业务规则**

1. **分页逻辑**：
   - 如果同时提供`page`和`size`，进行分页
   - 如果只提供其中一个参数，忽略分页
   - 如果都不提供，返回所有工厂

2. **排序规则**：默认按创建时间降序（最新的在前）

3. **包含已停用工厂**：返回所有工厂（包括`isActive=false`）

**使用场景**

- 平台管理员查看所有工厂列表
- 分页浏览工厂信息
- 导出所有工厂数据

---

#### 3.2.2 获取工厂详情

**基本信息**

| 项目 | 内容 |
|------|------|
| 接口路径 | `GET /api/platform/factories/{factoryId}` |
| 接口描述 | 根据ID获取工厂详细信息 |
| 权限要求 | super_admin, platform_admin |

**请求参数**

**路径参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| factoryId | String | 是 | 工厂ID |

**请求示例**

```
GET /api/platform/factories/FISH_2025_001
```

**响应数据结构**

```json
{
  "success": true,
  "message": "操作成功",
  "data": {
    "id": "FISH_2025_001",
    "name": "白垩纪水产品工厂",
    "industryCode": "FISH",
    "regionCode": "2025",
    "address": "北京市朝阳区",
    "contactName": "张三",
    "contactPhone": "13800138000",
    "contactEmail": "contact@factory.com",
    "subscriptionPlan": "PREMIUM",
    "aiWeeklyQuota": 50,
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00",
    "updatedAt": "2025-11-20T14:20:00"
  }
}
```

**错误码**

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| FACTORY_NOT_FOUND | 404 | 工厂不存在 |

**使用场景**

- 查看单个工厂的详细信息
- 工厂编辑前获取现有数据
- 核对工厂配置信息

---

#### 3.2.3 创建新工厂

**基本信息**

| 项目 | 内容 |
|------|------|
| 接口路径 | `POST /api/platform/factories` |
| 接口描述 | 创建新的工厂 |
| 权限要求 | super_admin, platform_admin |

**请求体**

```json
{
  "name": "白垩纪水产品工厂",
  "industryCode": "FISH",
  "regionCode": "2025",
  "address": "北京市朝阳区",
  "contactName": "张三",
  "contactPhone": "13800138000",
  "contactEmail": "contact@factory.com",
  "subscriptionPlan": "PREMIUM",
  "aiWeeklyQuota": 50,
  "isActive": true
}
```

**字段校验**

| 字段 | 类型 | 必填 | 校验规则 |
|------|------|------|----------|
| name | String | 是 | @NotBlank, @Size(2-100) |
| industryCode | String | 是 | @NotBlank, @Pattern("^[A-Z]{2,10}$") |
| regionCode | String | 是 | @NotBlank, @Pattern("^[0-9]{4}$") |
| address | String | 否 | @Size(max=255) |
| contactName | String | 否 | @Size(max=50) |
| contactPhone | String | 否 | @Pattern("^1[3-9]\\d{9}$") |
| contactEmail | String | 否 | @Email, @Size(max=100) |
| subscriptionPlan | String | 否 | BASIC/STANDARD/PREMIUM/ENTERPRISE |
| aiWeeklyQuota | Integer | 否 | @Min(0), @Max(1000) |
| isActive | Boolean | 否 | 默认true |

**响应数据结构**

```json
{
  "success": true,
  "message": "工厂创建成功",
  "data": {
    "id": "FISH_2025_003",
    "name": "白垩纪水产品工厂",
    "industryCode": "FISH",
    "regionCode": "2025",
    "address": "北京市朝阳区",
    "contactName": "张三",
    "contactPhone": "13800138000",
    "contactEmail": "contact@factory.com",
    "subscriptionPlan": "PREMIUM",
    "aiWeeklyQuota": 50,
    "isActive": true,
    "createdAt": "2025-11-20T15:30:00",
    "updatedAt": "2025-11-20T15:30:00"
  }
}
```

**业务规则**

1. **工厂ID生成**：
   - 格式：`{industryCode}_{regionCode}_{序号}`
   - 示例：`FISH_2025_001`
   - 序号自动递增（每个行业+地区组合独立计数）

2. **默认值**：
   - `subscriptionPlan`：默认"BASIC"
   - `aiWeeklyQuota`：默认根据订阅计划自动设置
     - BASIC: 10次/周
     - STANDARD: 30次/周
     - PREMIUM: 50次/周
     - ENTERPRISE: 100次/周
   - `isActive`：默认true

3. **自动初始化**：
   - 创建默认超级管理员账号（用户名：工厂ID，密码：随机生成）
   - 初始化基础配置数据（部门、工作类型等）

**错误码**

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| INVALID_INDUSTRY_CODE | 400 | 行业代码格式错误 |
| INVALID_REGION_CODE | 400 | 地区代码格式错误 |
| INVALID_PHONE | 400 | 手机号格式错误 |
| INVALID_EMAIL | 400 | 邮箱格式错误 |
| INVALID_SUBSCRIPTION | 400 | 订阅计划值错误 |

**使用场景**

- 平台管理员为新客户创建工厂租户
- 批量导入工厂数据
- 测试环境快速创建工厂

---

#### 3.2.4 更新工厂信息

**基本信息**

| 项目 | 内容 |
|------|------|
| 接口路径 | `PUT /api/platform/factories/{factoryId}` |
| 接口描述 | 更新指定工厂的信息 |
| 权限要求 | super_admin, platform_admin |

**请求参数**

**路径参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| factoryId | String | 是 | 工厂ID |

**请求体**（所有字段均可选）

```json
{
  "name": "白垩纪水产品加工厂",
  "address": "北京市朝阳区新地址123号",
  "contactName": "李四",
  "contactPhone": "13900139000",
  "contactEmail": "newcontact@factory.com",
  "subscriptionPlan": "ENTERPRISE",
  "aiWeeklyQuota": 100,
  "isActive": true
}
```

**字段校验**

| 字段 | 类型 | 必填 | 校验规则 |
|------|------|------|----------|
| name | String | 否 | @Size(2-100) |
| address | String | 否 | @Size(max=255) |
| contactName | String | 否 | @Size(max=50) |
| contactPhone | String | 否 | @Pattern("^1[3-9]\\d{9}$") |
| contactEmail | String | 否 | @Email, @Size(max=100) |
| subscriptionPlan | String | 否 | BASIC/STANDARD/PREMIUM/ENTERPRISE |
| aiWeeklyQuota | Integer | 否 | @Min(0), @Max(1000) |
| isActive | Boolean | 否 | - |

**响应数据结构**

```json
{
  "success": true,
  "message": "工厂更新成功",
  "data": {
    "id": "FISH_2025_001",
    "name": "白垩纪水产品加工厂",
    "industryCode": "FISH",
    "regionCode": "2025",
    "address": "北京市朝阳区新地址123号",
    "contactName": "李四",
    "contactPhone": "13900139000",
    "contactEmail": "newcontact@factory.com",
    "subscriptionPlan": "ENTERPRISE",
    "aiWeeklyQuota": 100,
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00",
    "updatedAt": "2025-11-20T16:45:00"
  }
}
```

**业务规则**

1. **部分更新**：仅更新请求体中提供的字段
2. **不可更新字段**：`id`、`industryCode`、`regionCode`、`createdAt`不可更新
3. **订阅升级/降级**：修改`subscriptionPlan`时建议同步调整`aiWeeklyQuota`

**错误码**

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| FACTORY_NOT_FOUND | 404 | 工厂不存在 |
| INVALID_PHONE | 400 | 手机号格式错误 |
| INVALID_EMAIL | 400 | 邮箱格式错误 |
| INVALID_SUBSCRIPTION | 400 | 订阅计划值错误 |

**使用场景**

- 更新工厂联系方式
- 升级/降级订阅计划
- 调整AI配额
- 修改工厂基本信息

---

#### 3.2.5 删除工厂（软删除）

**基本信息**

| 项目 | 内容 |
|------|------|
| 接口路径 | `DELETE /api/platform/factories/{factoryId}` |
| 接口描述 | 删除指定工厂（软删除，设置isActive=false） |
| 权限要求 | super_admin, platform_admin |

**请求参数**

**路径参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| factoryId | String | 是 | 工厂ID |

**请求示例**

```
DELETE /api/platform/factories/FISH_2025_001
```

**响应数据结构**

```json
{
  "success": true,
  "message": "工厂已删除",
  "data": "FISH_2025_001"
}
```

**业务规则**

1. **软删除**：不真正删除数据库记录，只设置`isActive=false`
2. **关联影响**：
   - 该工厂下的所有用户自动禁用
   - 工厂管理员无法登录
   - 新批次、用户创建被阻止
   - 现有批次和数据保留可查询
3. **可恢复**：通过`激活工厂`接口可重新激活

**错误码**

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| FACTORY_NOT_FOUND | 404 | 工厂不存在 |
| FACTORY_ALREADY_INACTIVE | 400 | 工厂已经是禁用状态 |

**使用场景**

- 客户订阅到期停用工厂
- 工厂违规临时禁用
- 测试工厂的清理

---

#### 3.2.6 激活工厂

**基本信息**

| 项目 | 内容 |
|------|------|
| 接口路径 | `POST /api/platform/factories/{factoryId}/activate` |
| 接口描述 | 激活指定工厂（设置isActive=true） |
| 权限要求 | super_admin, platform_admin |

**请求参数**

**路径参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| factoryId | String | 是 | 工厂ID |

**请求示例**

```
POST /api/platform/factories/FISH_2025_001/activate
```

**响应数据结构**

```json
{
  "success": true,
  "message": "工厂已激活",
  "data": {
    "id": "FISH_2025_001",
    "name": "白垩纪水产品工厂",
    "industryCode": "FISH",
    "regionCode": "2025",
    "isActive": true,
    "updatedAt": "2025-11-20T17:00:00"
  }
}
```

**业务规则**

1. **恢复访问**：工厂下的用户可以重新登录
2. **恢复功能**：所有功能模块恢复正常使用
3. **不影响数据**：停用期间的数据完整保留

**错误码**

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| FACTORY_NOT_FOUND | 404 | 工厂不存在 |
| FACTORY_ALREADY_ACTIVE | 400 | 工厂已经是激活状态 |

**使用场景**

- 客户续费后重新激活工厂
- 误操作停用后的恢复
- 测试环境工厂的重新启用

---

#### 3.2.7 停用工厂

**基本信息**

| 项目 | 内容 |
|------|------|
| 接口路径 | `POST /api/platform/factories/{factoryId}/deactivate` |
| 接口描述 | 停用指定工厂（设置isActive=false） |
| 权限要求 | super_admin, platform_admin |

**请求参数**

**路径参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| factoryId | String | 是 | 工厂ID |

**请求示例**

```
POST /api/platform/factories/FISH_2025_001/deactivate
```

**响应数据结构**

```json
{
  "success": true,
  "message": "工厂已停用",
  "data": {
    "id": "FISH_2025_001",
    "name": "白垩纪水产品工厂",
    "industryCode": "FISH",
    "regionCode": "2025",
    "isActive": false,
    "updatedAt": "2025-11-20T17:15:00"
  }
}
```

**业务规则**

1. **立即生效**：工厂用户立即无法登录
2. **保留数据**：所有历史数据完整保留
3. **可重新激活**：通过`激活工厂`接口恢复

**错误码**

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| FACTORY_NOT_FOUND | 404 | 工厂不存在 |
| FACTORY_ALREADY_INACTIVE | 400 | 工厂已经是停用状态 |

**使用场景**

- 订阅到期临时停用
- 欠费工厂的服务暂停
- 违规工厂的临时封禁

---

### 3.3 平台统计

#### 3.3.1 获取平台统计数据

**基本信息**

| 项目 | 内容 |
|------|------|
| 接口路径 | `GET /api/platform/dashboard/statistics` |
| 接口描述 | 获取所有工厂的汇总统计（平台级Dashboard） |
| 权限要求 | super_admin, platform_admin |
| 请求参数 | 无 |

**响应数据结构**

```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "totalFactories": 15,
    "activeFactories": 12,
    "inactiveFactories": 3,
    "totalUsers": 450,
    "activeUsers": 420,
    "totalBatches": 1250,
    "completedBatches": 1100,
    "totalProductionToday": 15000.5,
    "totalAIQuotaUsed": 1200,
    "totalAIQuotaLimit": 10000,
    "systemHealth": "healthy"
  }
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| totalFactories | Integer | 工厂总数（包括已停用） |
| activeFactories | Integer | 活跃工厂数（isActive=true） |
| inactiveFactories | Integer | 不活跃工厂数（isActive=false） |
| totalUsers | Integer | 用户总数（所有工厂合计） |
| activeUsers | Integer | 活跃用户数（isActive=true） |
| totalBatches | Long | 批次总数（所有工厂合计） |
| completedBatches | Long | 已完成批次数（status=completed） |
| totalProductionToday | Double | 今日总产量（kg，所有工厂合计） |
| totalAIQuotaUsed | Integer | AI配额已使用量（本周合计） |
| totalAIQuotaLimit | Integer | AI配额总限制（所有工厂配额合计） |
| systemHealth | String | 系统健康状态（healthy/warning/critical） |

**业务规则**

1. **统计范围**：
   - **工厂**：包括所有工厂（活跃+停用）
   - **用户**：包括所有工厂的所有用户
   - **批次**：包括所有工厂的所有批次
   - **产量**：仅统计今日（00:00-23:59）
   - **AI配额**：仅统计本周（周一-周日）

2. **系统健康状态**：
   - **healthy**：所有指标正常
   - **warning**：
     - 平台AI配额使用率 > 80%
     - 停用工厂比例 > 20%
   - **critical**：
     - 平台AI配额使用率 > 95%
     - 停用工厂比例 > 50%
     - 今日产量为0

3. **实时更新**：所有数据实时计算，不使用缓存

**使用场景**

- 平台管理员查看Dashboard首页
- 平台运营数据日报
- 系统健康度监控
- 资源使用趋势分析

---

## 4. 数据结构

### 4.1 核心实体

#### 4.1.1 Factory（工厂）

```typescript
interface Factory {
  id: string;                    // 工厂ID（格式：{INDUSTRY}_{REGION}_{序号}）
  name: string;                  // 工厂名称
  industryCode: string;          // 行业代码（2-10位大写字母）
  regionCode: string;            // 地区代码（4位数字）
  address?: string;              // 工厂地址
  contactName?: string;          // 联系人姓名
  contactPhone?: string;         // 联系电话（11位手机号）
  contactEmail?: string;         // 联系邮箱
  subscriptionPlan: SubscriptionPlan; // 订阅计划
  aiWeeklyQuota: number;         // AI每周配额（0-1000）
  isActive: boolean;             // 是否激活
  createdAt: string;             // 创建时间（ISO 8601）
  updatedAt: string;             // 更新时间（ISO 8601）
}
```

#### 4.1.2 SubscriptionPlan（订阅计划）

```typescript
enum SubscriptionPlan {
  BASIC = 'BASIC',           // 基础版（10次AI/周）
  STANDARD = 'STANDARD',     // 标准版（30次AI/周）
  PREMIUM = 'PREMIUM',       // 专业版（50次AI/周）
  ENTERPRISE = 'ENTERPRISE'  // 企业版（100次AI/周）
}
```

#### 4.1.3 FactoryAIQuota（工厂AI配额）

```typescript
interface FactoryAIQuota {
  id: string;                    // 工厂ID
  name: string;                  // 工厂名称
  aiWeeklyQuota: number;         // 每周AI调用配额
  _count: {
    aiUsageLogs: number;         // 历史总调用次数
  };
}
```

#### 4.1.4 PlatformAIUsageStats（平台AI使用统计）

```typescript
interface PlatformAIUsageStats {
  currentWeek: string;           // 当前周次（YYYY-Www）
  totalUsed: number;             // 本周平台总使用量
  factories: FactoryUsageInfo[]; // 各工厂使用情况
}

interface FactoryUsageInfo {
  factoryId: string;             // 工厂ID
  factoryName: string;           // 工厂名称
  weeklyQuota: number;           // 每周配额
  used: number;                  // 本周已使用次数
  remaining: number;             // 剩余次数
  utilization: string;           // 使用率（%，保留2位小数）
}
```

#### 4.1.5 PlatformStatistics（平台统计）

```typescript
interface PlatformStatistics {
  totalFactories: number;        // 工厂总数
  activeFactories: number;       // 活跃工厂数
  inactiveFactories: number;     // 不活跃工厂数
  totalUsers: number;            // 用户总数
  activeUsers: number;           // 活跃用户数
  totalBatches: number;          // 批次总数
  completedBatches: number;      // 已完成批次数
  totalProductionToday: number;  // 今日总产量（kg）
  totalAIQuotaUsed: number;      // AI配额已使用量
  totalAIQuotaLimit: number;     // AI配额总限制
  systemHealth: SystemHealth;    // 系统健康状态
}

enum SystemHealth {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical'
}
```

### 4.2 请求DTO

#### 4.2.1 CreateFactoryRequest

```typescript
interface CreateFactoryRequest {
  name: string;                  // 必填，2-100字符
  industryCode: string;          // 必填，2-10位大写字母
  regionCode: string;            // 必填，4位数字
  address?: string;              // 可选，最长255字符
  contactName?: string;          // 可选，最长50字符
  contactPhone?: string;         // 可选，11位手机号
  contactEmail?: string;         // 可选，有效邮箱
  subscriptionPlan?: SubscriptionPlan; // 可选，默认BASIC
  aiWeeklyQuota?: number;        // 可选，0-1000
  isActive?: boolean;            // 可选，默认true
}
```

#### 4.2.2 UpdateFactoryRequest

```typescript
interface UpdateFactoryRequest {
  name?: string;                 // 可选，2-100字符
  address?: string;              // 可选，最长255字符
  contactName?: string;          // 可选，最长50字符
  contactPhone?: string;         // 可选，11位手机号
  contactEmail?: string;         // 可选，有效邮箱
  subscriptionPlan?: SubscriptionPlan; // 可选
  aiWeeklyQuota?: number;        // 可选，0-1000
  isActive?: boolean;            // 可选
}
```

#### 4.2.3 UpdateAIQuotaRequest

```typescript
interface UpdateAIQuotaRequest {
  weeklyQuota: number;           // 必填，0-1000
}
```

---

## 5. 业务规则

### 5.1 工厂ID生成规则

**格式**：`{industryCode}_{regionCode}_{序号}`

**示例**：
- `FISH_2025_001` - 第1个水产行业、2025地区的工厂
- `FRUIT_2025_002` - 第2个水果行业、2025地区的工厂
- `MEAT_2026_001` - 第1个肉类行业、2026地区的工厂

**序号规则**：
- 每个`{industryCode}_{regionCode}`组合独立计数
- 从001开始，自动递增
- 删除的工厂序号不重复使用

### 5.2 订阅计划与AI配额

| 订阅计划 | 默认AI配额（次/周） | 推荐使用场景 |
|---------|-------------------|-------------|
| BASIC | 10 | 小型工厂、试用阶段 |
| STANDARD | 30 | 中小型工厂、基本使用 |
| PREMIUM | 50 | 大型工厂、频繁使用 |
| ENTERPRISE | 100 | 超大型工厂、高频使用 |

**配额调整策略**：
- 创建工厂时可手动指定配额（优先级高于订阅计划默认值）
- 升级订阅计划时建议同步提升配额
- 降级订阅计划时可选择保持现有配额或降低

### 5.3 工厂状态管理

#### 5.3.1 工厂生命周期

```
创建 (isActive=true)
  ↓
正常运营
  ↓
停用 (isActive=false) ←→ 激活 (isActive=true)
  ↓
删除（软删除，isActive=false）
  ↓
激活（可恢复）
```

#### 5.3.2 状态变更影响

| 操作 | 用户登录 | 新建批次 | 查询数据 | AI调用 |
|------|---------|---------|---------|--------|
| 激活状态 | ✅ | ✅ | ✅ | ✅ |
| 停用状态 | ❌ | ❌ | ✅ | ❌ |
| 删除状态 | ❌ | ❌ | ✅ | ❌ |

### 5.4 AI配额管理规则

#### 5.4.1 配额统计周期

- **统计周期**：ISO周（周一00:00 - 周日23:59）
- **自动重置**：每周一00:00自动重置使用量为0
- **跨周不累积**：未使用的配额不结转到下周

#### 5.4.2 配额预警机制

| 使用率 | 状态 | 操作建议 |
|--------|------|---------|
| < 70% | 正常 | 无需处理 |
| 70-85% | 提醒 | 建议关注使用情况 |
| 85-95% | 警告 | 考虑提升配额 |
| ≥ 95% | 紧急 | 立即提升配额或限制使用 |

#### 5.4.3 超配额处理

- **达到100%**：拒绝新的AI调用请求
- **返回错误码**：`QUOTA_EXCEEDED`
- **用户提示**："本周AI配额已用完，请联系平台管理员或等待下周重置"
- **平台操作**：
  1. 发送邮件通知工厂管理员
  2. 平台管理员可临时提升配额
  3. 建议升级订阅计划

### 5.5 系统健康度评估

#### 5.5.1 健康度指标

| 指标 | 权重 | 计算公式 |
|------|------|---------|
| 工厂活跃率 | 30% | activeFactories / totalFactories |
| 用户活跃率 | 20% | activeUsers / totalUsers |
| AI配额使用率 | 30% | totalAIQuotaUsed / totalAIQuotaLimit |
| 批次完成率 | 20% | completedBatches / totalBatches |

#### 5.5.2 健康度等级

```typescript
function calculateSystemHealth(stats: PlatformStatistics): SystemHealth {
  const factoryActiveRate = stats.activeFactories / stats.totalFactories;
  const aiQuotaUtilization = stats.totalAIQuotaUsed / stats.totalAIQuotaLimit;
  const batchCompletionRate = stats.completedBatches / stats.totalBatches;

  // Critical条件
  if (
    factoryActiveRate < 0.5 ||           // 工厂活跃率 < 50%
    aiQuotaUtilization > 0.95 ||         // AI配额使用率 > 95%
    stats.totalProductionToday === 0     // 今日无产量
  ) {
    return 'critical';
  }

  // Warning条件
  if (
    factoryActiveRate < 0.8 ||           // 工厂活跃率 < 80%
    aiQuotaUtilization > 0.8 ||          // AI配额使用率 > 80%
    batchCompletionRate < 0.7            // 批次完成率 < 70%
  ) {
    return 'warning';
  }

  return 'healthy';
}
```

---

## 6. 错误处理

### 6.1 错误码列表

| 错误码 | HTTP状态 | 说明 | 解决方案 |
|--------|----------|------|---------|
| FACTORY_NOT_FOUND | 404 | 工厂不存在 | 检查工厂ID是否正确 |
| FACTORY_ALREADY_ACTIVE | 400 | 工厂已经是激活状态 | 无需重复激活 |
| FACTORY_ALREADY_INACTIVE | 400 | 工厂已经是停用状态 | 无需重复停用 |
| INVALID_INDUSTRY_CODE | 400 | 行业代码格式错误 | 使用2-10位大写字母 |
| INVALID_REGION_CODE | 400 | 地区代码格式错误 | 使用4位数字 |
| INVALID_PHONE | 400 | 手机号格式错误 | 使用11位1开头的手机号 |
| INVALID_EMAIL | 400 | 邮箱格式错误 | 检查邮箱格式是否正确 |
| INVALID_SUBSCRIPTION | 400 | 订阅计划值错误 | 使用BASIC/STANDARD/PREMIUM/ENTERPRISE |
| INVALID_QUOTA | 400 | 配额值不在0-1000范围内 | 配额必须在0-1000之间 |
| UNAUTHORIZED | 401 | 未登录或Token过期 | 重新登录获取新Token |
| FORBIDDEN | 403 | 权限不足 | 需要platform_admin或super_admin权限 |
| INTERNAL_SERVER_ERROR | 500 | 服务器内部错误 | 联系技术支持 |

### 6.2 错误响应格式

```json
{
  "success": false,
  "message": "工厂不存在",
  "errorCode": "FACTORY_NOT_FOUND",
  "data": null
}
```

### 6.3 校验错误响应

```json
{
  "success": false,
  "message": "请求参数校验失败",
  "errorCode": "VALIDATION_ERROR",
  "data": {
    "field": "industryCode",
    "rejectedValue": "abc",
    "message": "行业代码必须为2-10位大写字母"
  }
}
```

---

## 7. 前端集成示例

### 7.1 API Client封装

**platformApiClient.ts**

```typescript
import { apiClient } from './apiClient';

// ==================== 类型定义 ====================

export interface Factory {
  id: string;
  name: string;
  industryCode: string;
  regionCode: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  subscriptionPlan: SubscriptionPlan;
  aiWeeklyQuota: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum SubscriptionPlan {
  BASIC = 'BASIC',
  STANDARD = 'STANDARD',
  PREMIUM = 'PREMIUM',
  ENTERPRISE = 'ENTERPRISE'
}

export interface FactoryAIQuota {
  id: string;
  name: string;
  aiWeeklyQuota: number;
  _count: {
    aiUsageLogs: number;
  };
}

export interface PlatformAIUsageStats {
  currentWeek: string;
  totalUsed: number;
  factories: FactoryUsageInfo[];
}

export interface FactoryUsageInfo {
  factoryId: string;
  factoryName: string;
  weeklyQuota: number;
  used: number;
  remaining: number;
  utilization: string;
}

export interface PlatformStatistics {
  totalFactories: number;
  activeFactories: number;
  inactiveFactories: number;
  totalUsers: number;
  activeUsers: number;
  totalBatches: number;
  completedBatches: number;
  totalProductionToday: number;
  totalAIQuotaUsed: number;
  totalAIQuotaLimit: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

export interface CreateFactoryRequest {
  name: string;
  industryCode: string;
  regionCode: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  subscriptionPlan?: SubscriptionPlan;
  aiWeeklyQuota?: number;
  isActive?: boolean;
}

export interface UpdateFactoryRequest {
  name?: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  subscriptionPlan?: SubscriptionPlan;
  aiWeeklyQuota?: number;
  isActive?: boolean;
}

export interface UpdateAIQuotaRequest {
  weeklyQuota: number;
}

// ==================== AI配额管理 ====================

/**
 * 获取所有工厂AI配额
 */
export const getFactoryAIQuotas = async (): Promise<FactoryAIQuota[]> => {
  const response = await apiClient.get<FactoryAIQuota[]>(
    '/api/platform/ai-quota'
  );
  return response.data;
};

/**
 * 更新工厂AI配额
 */
export const updateFactoryAIQuota = async (
  factoryId: string,
  request: UpdateAIQuotaRequest
): Promise<{ factoryId: string; weeklyQuota: number }> => {
  const response = await apiClient.put(
    `/api/platform/ai-quota/${factoryId}`,
    request
  );
  return response.data;
};

/**
 * 获取平台AI使用统计
 */
export const getPlatformAIUsageStats = async (): Promise<PlatformAIUsageStats> => {
  const response = await apiClient.get<PlatformAIUsageStats>(
    '/api/platform/ai-usage-stats'
  );
  return response.data;
};

// ==================== 工厂管理 ====================

/**
 * 获取所有工厂列表
 */
export const getAllFactories = async (
  page?: number,
  size?: number
): Promise<Factory[]> => {
  const params: Record<string, number> = {};
  if (page !== undefined) params.page = page;
  if (size !== undefined) params.size = size;

  const response = await apiClient.get<Factory[]>(
    '/api/platform/factories',
    { params }
  );
  return response.data;
};

/**
 * 获取工厂详情
 */
export const getFactoryById = async (factoryId: string): Promise<Factory> => {
  const response = await apiClient.get<Factory>(
    `/api/platform/factories/${factoryId}`
  );
  return response.data;
};

/**
 * 创建新工厂
 */
export const createFactory = async (
  request: CreateFactoryRequest
): Promise<Factory> => {
  const response = await apiClient.post<Factory>(
    '/api/platform/factories',
    request
  );
  return response.data;
};

/**
 * 更新工厂信息
 */
export const updateFactory = async (
  factoryId: string,
  request: UpdateFactoryRequest
): Promise<Factory> => {
  const response = await apiClient.put<Factory>(
    `/api/platform/factories/${factoryId}`,
    request
  );
  return response.data;
};

/**
 * 删除工厂（软删除）
 */
export const deleteFactory = async (factoryId: string): Promise<string> => {
  const response = await apiClient.delete<string>(
    `/api/platform/factories/${factoryId}`
  );
  return response.data;
};

/**
 * 激活工厂
 */
export const activateFactory = async (factoryId: string): Promise<Factory> => {
  const response = await apiClient.post<Factory>(
    `/api/platform/factories/${factoryId}/activate`
  );
  return response.data;
};

/**
 * 停用工厂
 */
export const deactivateFactory = async (factoryId: string): Promise<Factory> => {
  const response = await apiClient.post<Factory>(
    `/api/platform/factories/${factoryId}/deactivate`
  );
  return response.data;
};

// ==================== 平台统计 ====================

/**
 * 获取平台统计数据
 */
export const getPlatformStatistics = async (): Promise<PlatformStatistics> => {
  const response = await apiClient.get<PlatformStatistics>(
    '/api/platform/dashboard/statistics'
  );
  return response.data;
};

export default {
  // AI配额管理
  getFactoryAIQuotas,
  updateFactoryAIQuota,
  getPlatformAIUsageStats,
  // 工厂管理
  getAllFactories,
  getFactoryById,
  createFactory,
  updateFactory,
  deleteFactory,
  activateFactory,
  deactivateFactory,
  // 平台统计
  getPlatformStatistics,
};
```

---

### 7.2 React Native页面示例

#### 7.2.1 平台Dashboard页面

**PlatformDashboardScreen.tsx**

```typescript
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { Card, Title, Paragraph, ProgressBar } from 'react-native-paper';
import * as platformApi from '../services/api/platformApiClient';

export const PlatformDashboardScreen: React.FC = () => {
  const [stats, setStats] = useState<platformApi.PlatformStatistics | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const data = await platformApi.getPlatformStatistics();
      setStats(data);
    } catch (error: any) {
      Alert.alert('错误', error.message || '加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, []);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return '#4CAF50';
      case 'warning': return '#FF9800';
      case 'critical': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getHealthText = (health: string) => {
    switch (health) {
      case 'healthy': return '健康';
      case 'warning': return '警告';
      case 'critical': return '严重';
      default: return '未知';
    }
  };

  if (!stats) {
    return (
      <View style={styles.container}>
        <Text>加载中...</Text>
      </View>
    );
  }

  const aiQuotaUtilization = stats.totalAIQuotaLimit > 0
    ? stats.totalAIQuotaUsed / stats.totalAIQuotaLimit
    : 0;

  const factoryActiveRate = stats.totalFactories > 0
    ? stats.activeFactories / stats.totalFactories
    : 0;

  const batchCompletionRate = stats.totalBatches > 0
    ? stats.completedBatches / stats.totalBatches
    : 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadStatistics} />
      }
    >
      {/* 系统健康状态 */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>系统健康状态</Title>
          <View style={styles.healthStatus}>
            <View
              style={[
                styles.healthDot,
                { backgroundColor: getHealthColor(stats.systemHealth) }
              ]}
            />
            <Text style={[
              styles.healthText,
              { color: getHealthColor(stats.systemHealth) }
            ]}>
              {getHealthText(stats.systemHealth)}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* 工厂统计 */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>工厂统计</Title>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalFactories}</Text>
              <Text style={styles.statLabel}>工厂总数</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                {stats.activeFactories}
              </Text>
              <Text style={styles.statLabel}>活跃工厂</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#F44336' }]}>
                {stats.inactiveFactories}
              </Text>
              <Text style={styles.statLabel}>停用工厂</Text>
            </View>
          </View>
          <ProgressBar
            progress={factoryActiveRate}
            color="#4CAF50"
            style={styles.progressBar}
          />
          <Text style={styles.progressLabel}>
            工厂活跃率: {(factoryActiveRate * 100).toFixed(1)}%
          </Text>
        </Card.Content>
      </Card>

      {/* 用户统计 */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>用户统计</Title>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalUsers}</Text>
              <Text style={styles.statLabel}>用户总数</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                {stats.activeUsers}
              </Text>
              <Text style={styles.statLabel}>活跃用户</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* 生产统计 */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>生产统计</Title>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalBatches}</Text>
              <Text style={styles.statLabel}>批次总数</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                {stats.completedBatches}
              </Text>
              <Text style={styles.statLabel}>已完成</Text>
            </View>
          </View>
          <ProgressBar
            progress={batchCompletionRate}
            color="#2196F3"
            style={styles.progressBar}
          />
          <Text style={styles.progressLabel}>
            批次完成率: {(batchCompletionRate * 100).toFixed(1)}%
          </Text>
          <Paragraph style={styles.todayProduction}>
            今日总产量: {stats.totalProductionToday.toFixed(2)} kg
          </Paragraph>
        </Card.Content>
      </Card>

      {/* AI配额使用 */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>AI配额使用</Title>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalAIQuotaUsed}</Text>
              <Text style={styles.statLabel}>已使用</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalAIQuotaLimit}</Text>
              <Text style={styles.statLabel}>总配额</Text>
            </View>
          </View>
          <ProgressBar
            progress={aiQuotaUtilization}
            color={
              aiQuotaUtilization > 0.9 ? '#F44336' :
              aiQuotaUtilization > 0.7 ? '#FF9800' :
              '#4CAF50'
            }
            style={styles.progressBar}
          />
          <Text style={styles.progressLabel}>
            使用率: {(aiQuotaUtilization * 100).toFixed(1)}%
          </Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 12,
    elevation: 2,
  },
  healthStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  healthDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  healthText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginTop: 12,
  },
  progressLabel: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
    textAlign: 'right',
  },
  todayProduction: {
    marginTop: 8,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
});
```

---

#### 7.2.2 工厂管理页面

**FactoryManagementScreen.tsx**

```typescript
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  FAB,
  Searchbar,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import * as platformApi from '../services/api/platformApiClient';

export const FactoryManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const [factories, setFactories] = useState<platformApi.Factory[]>([]);
  const [filteredFactories, setFilteredFactories] = useState<platformApi.Factory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const loadFactories = async () => {
    try {
      setLoading(true);
      const data = await platformApi.getAllFactories();
      setFactories(data);
      setFilteredFactories(data);
    } catch (error: any) {
      Alert.alert('错误', error.message || '加载工厂列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFactories();
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredFactories(factories);
    } else {
      const filtered = factories.filter(
        f =>
          f.name.toLowerCase().includes(query.toLowerCase()) ||
          f.id.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredFactories(filtered);
    }
  };

  const handleActivate = async (factoryId: string) => {
    try {
      await platformApi.activateFactory(factoryId);
      Alert.alert('成功', '工厂已激活');
      loadFactories();
    } catch (error: any) {
      Alert.alert('错误', error.message || '激活工厂失败');
    }
  };

  const handleDeactivate = async (factoryId: string) => {
    Alert.alert(
      '确认停用',
      '停用工厂后，该工厂下的所有用户将无法登录。确定要继续吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              await platformApi.deactivateFactory(factoryId);
              Alert.alert('成功', '工厂已停用');
              loadFactories();
            } catch (error: any) {
              Alert.alert('错误', error.message || '停用工厂失败');
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (factoryId: string) => {
    Alert.alert(
      '确认删除',
      '删除工厂是软删除操作，可以通过激活恢复。确定要继续吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              await platformApi.deleteFactory(factoryId);
              Alert.alert('成功', '工厂已删除');
              loadFactories();
            } catch (error: any) {
              Alert.alert('错误', error.message || '删除工厂失败');
            }
          },
        },
      ]
    );
  };

  const renderFactoryItem = ({ item }: { item: platformApi.Factory }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Title>{item.name}</Title>
            <Chip
              mode="flat"
              style={[
                styles.statusChip,
                { backgroundColor: item.isActive ? '#4CAF50' : '#F44336' }
              ]}
              textStyle={{ color: '#fff' }}
            >
              {item.isActive ? '激活' : '停用'}
            </Chip>
          </View>
          <Text style={styles.factoryId}>{item.id}</Text>
        </View>

        <Paragraph style={styles.info}>
          行业: {item.industryCode} | 地区: {item.regionCode}
        </Paragraph>
        <Paragraph style={styles.info}>
          订阅: {item.subscriptionPlan} | AI配额: {item.aiWeeklyQuota}次/周
        </Paragraph>
        {item.contactName && (
          <Paragraph style={styles.info}>
            联系人: {item.contactName} {item.contactPhone}
          </Paragraph>
        )}
      </Card.Content>

      <Card.Actions>
        <Button
          mode="text"
          onPress={() => navigation.navigate('FactoryDetail', { factoryId: item.id })}
        >
          详情
        </Button>
        <Button
          mode="text"
          onPress={() => navigation.navigate('EditFactory', { factoryId: item.id })}
        >
          编辑
        </Button>
        {item.isActive ? (
          <Button
            mode="text"
            textColor="#FF9800"
            onPress={() => handleDeactivate(item.id)}
          >
            停用
          </Button>
        ) : (
          <Button
            mode="text"
            textColor="#4CAF50"
            onPress={() => handleActivate(item.id)}
          >
            激活
          </Button>
        )}
        <Button
          mode="text"
          textColor="#F44336"
          onPress={() => handleDelete(item.id)}
        >
          删除
        </Button>
      </Card.Actions>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="搜索工厂名称或ID"
        onChangeText={handleSearch}
        value={searchQuery}
        style={styles.searchBar}
      />

      <FlatList
        data={filteredFactories}
        renderItem={renderFactoryItem}
        keyExtractor={item => item.id}
        refreshing={loading}
        onRefresh={loadFactories}
        contentContainerStyle={styles.listContent}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('CreateFactory')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchBar: {
    margin: 12,
  },
  listContent: {
    paddingBottom: 80,
  },
  card: {
    margin: 12,
    marginTop: 6,
    marginBottom: 6,
  },
  header: {
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factoryId: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  statusChip: {
    height: 24,
  },
  info: {
    fontSize: 13,
    color: '#424242',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
  },
});
```

---

#### 7.2.3 AI配额管理页面

**AIQuotaManagementScreen.tsx**

```typescript
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  ProgressBar,
  Dialog,
  Portal,
} from 'react-native-paper';
import * as platformApi from '../services/api/platformApiClient';

export const AIQuotaManagementScreen: React.FC = () => {
  const [quotas, setQuotas] = useState<platformApi.FactoryAIQuota[]>([]);
  const [stats, setStats] = useState<platformApi.PlatformAIUsageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [selectedFactory, setSelectedFactory] = useState<string | null>(null);
  const [newQuota, setNewQuota] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [quotaData, statsData] = await Promise.all([
        platformApi.getFactoryAIQuotas(),
        platformApi.getPlatformAIUsageStats(),
      ]);
      setQuotas(quotaData);
      setStats(statsData);
    } catch (error: any) {
      Alert.alert('错误', error.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEditQuota = (factoryId: string, currentQuota: number) => {
    setSelectedFactory(factoryId);
    setNewQuota(currentQuota.toString());
    setEditDialogVisible(true);
  };

  const handleSaveQuota = async () => {
    if (!selectedFactory) return;

    const quota = parseInt(newQuota, 10);
    if (isNaN(quota) || quota < 0 || quota > 1000) {
      Alert.alert('错误', '配额必须在0-1000之间');
      return;
    }

    try {
      await platformApi.updateFactoryAIQuota(selectedFactory, {
        weeklyQuota: quota,
      });
      Alert.alert('成功', '配额已更新');
      setEditDialogVisible(false);
      loadData();
    } catch (error: any) {
      Alert.alert('错误', error.message || '更新配额失败');
    }
  };

  const getFactoryUsage = (factoryId: string) => {
    return stats?.factories.find(f => f.factoryId === factoryId);
  };

  const renderQuotaItem = ({ item }: { item: platformApi.FactoryAIQuota }) => {
    const usage = getFactoryUsage(item.id);
    const utilizationRate = usage
      ? parseFloat(usage.utilization) / 100
      : 0;

    return (
      <Card style={styles.card}>
        <Card.Content>
          <Title>{item.name}</Title>
          <Text style={styles.factoryId}>{item.id}</Text>

          <View style={styles.quotaInfo}>
            <Text style={styles.label}>每周配额:</Text>
            <Text style={styles.value}>{item.aiWeeklyQuota} 次</Text>
          </View>

          <View style={styles.quotaInfo}>
            <Text style={styles.label}>历史总调用:</Text>
            <Text style={styles.value}>{item._count.aiUsageLogs} 次</Text>
          </View>

          {usage && (
            <>
              <View style={styles.usageRow}>
                <Text style={styles.label}>本周使用:</Text>
                <Text style={styles.value}>
                  {usage.used} / {usage.weeklyQuota} 次
                </Text>
              </View>

              <ProgressBar
                progress={utilizationRate}
                color={
                  utilizationRate > 0.9 ? '#F44336' :
                  utilizationRate > 0.7 ? '#FF9800' :
                  '#4CAF50'
                }
                style={styles.progressBar}
              />

              <Text style={[
                styles.utilization,
                {
                  color:
                    utilizationRate > 0.9 ? '#F44336' :
                    utilizationRate > 0.7 ? '#FF9800' :
                    '#4CAF50'
                }
              ]}>
                使用率: {usage.utilization}%
                {utilizationRate > 0.9 && ' ⚠️ 即将超额'}
              </Text>
            </>
          )}
        </Card.Content>

        <Card.Actions>
          <Button
            mode="text"
            onPress={() => handleEditQuota(item.id, item.aiWeeklyQuota)}
          >
            调整配额
          </Button>
        </Card.Actions>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {stats && (
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Title>本周平台总览</Title>
            <Paragraph>当前周次: {stats.currentWeek}</Paragraph>
            <Paragraph>平台总使用: {stats.totalUsed} 次</Paragraph>
          </Card.Content>
        </Card>
      )}

      <FlatList
        data={quotas}
        renderItem={renderQuotaItem}
        keyExtractor={item => item.id}
        refreshing={loading}
        onRefresh={loadData}
        contentContainerStyle={styles.listContent}
      />

      <Portal>
        <Dialog
          visible={editDialogVisible}
          onDismiss={() => setEditDialogVisible(false)}
        >
          <Dialog.Title>调整AI配额</Dialog.Title>
          <Dialog.Content>
            <TextInput
              style={styles.input}
              placeholder="请输入新配额（0-1000）"
              keyboardType="numeric"
              value={newQuota}
              onChangeText={setNewQuota}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditDialogVisible(false)}>取消</Button>
            <Button onPress={handleSaveQuota}>确定</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  summaryCard: {
    margin: 12,
  },
  listContent: {
    paddingBottom: 16,
  },
  card: {
    margin: 12,
    marginTop: 6,
    marginBottom: 6,
  },
  factoryId: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 12,
  },
  quotaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  label: {
    fontSize: 14,
    color: '#424242',
  },
  value: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  utilization: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 12,
    fontSize: 16,
  },
});
```

---

## 8. 总结

### 8.1 文档覆盖范围

本文档完整覆盖了**PlatformController**的**11个API端点**：

**AI配额管理**（3个）：
- 获取所有工厂AI配额
- 更新工厂AI配额
- 获取平台AI使用统计

**工厂管理**（7个）：
- 获取所有工厂列表（支持分页）
- 获取工厂详情
- 创建新工厂
- 更新工厂信息
- 删除工厂（软删除）
- 激活工厂
- 停用工厂

**平台统计**（1个）：
- 获取平台统计数据

### 8.2 核心特性

1. **多租户管理**：完整的工厂生命周期管理
2. **成本控制**：AI配额中央管理机制
3. **实时监控**：平台级数据汇总和健康度评估
4. **权限隔离**：平台管理员专用API
5. **订阅计划**：BASIC/STANDARD/PREMIUM/ENTERPRISE四种计划
6. **软删除机制**：工厂停用后可恢复

### 8.3 技术亮点

- **Spring Security集成**：@PreAuthorize权限控制
- **JSR-303校验**：完整的请求参数验证
- **Swagger文档**：自动生成API文档
- **软删除设计**：isActive字段管理工厂状态
- **分页支持**：可选的分页查询
- **实时统计**：动态计算平台级数据

---

## 附录

### A. 订阅计划对比表

| 特性 | BASIC | STANDARD | PREMIUM | ENTERPRISE |
|------|-------|----------|---------|------------|
| AI配额（次/周） | 10 | 30 | 50 | 100 |
| 适用工厂规模 | 小型 | 中型 | 大型 | 超大型 |
| 用户数限制 | 10 | 50 | 100 | 无限制 |
| 批次数/月 | 100 | 500 | 1000 | 无限制 |
| 技术支持 | 邮件 | 邮件+电话 | 7×12 | 7×24 |
| 定制开发 | ❌ | ❌ | ✅ | ✅ |
| 专属客户经理 | ❌ | ❌ | ❌ | ✅ |

### B. 工厂ID示例

| 行业代码 | 地区代码 | 序号 | 工厂ID | 说明 |
|---------|---------|-----|--------|------|
| FISH | 2025 | 001 | FISH_2025_001 | 水产行业，2025地区，第1个 |
| FRUIT | 2025 | 002 | FRUIT_2025_002 | 水果行业，2025地区，第2个 |
| MEAT | 2026 | 001 | MEAT_2026_001 | 肉类行业，2026地区，第1个 |
| VEGETABLE | 2025 | 003 | VEGETABLE_2025_003 | 蔬菜行业，2025地区，第3个 |

### C. 系统健康状态评估规则

```typescript
// 健康度评估算法
function evaluateSystemHealth(stats: PlatformStatistics): SystemHealth {
  const factoryActiveRate = stats.activeFactories / stats.totalFactories;
  const aiQuotaUtilization = stats.totalAIQuotaUsed / stats.totalAIQuotaLimit;
  const batchCompletionRate = stats.completedBatches / stats.totalBatches;

  // Critical: 严重问题
  if (
    factoryActiveRate < 0.5 ||           // 工厂活跃率 < 50%
    aiQuotaUtilization > 0.95 ||         // AI配额使用率 > 95%
    stats.totalProductionToday === 0     // 今日无产量
  ) {
    return 'critical';
  }

  // Warning: 需要关注
  if (
    factoryActiveRate < 0.8 ||           // 工厂活跃率 < 80%
    aiQuotaUtilization > 0.8 ||          // AI配额使用率 > 80%
    batchCompletionRate < 0.7            // 批次完成率 < 70%
  ) {
    return 'warning';
  }

  // Healthy: 一切正常
  return 'healthy';
}
```

---

**文档结束**

如需查看其他Controller的API文档，请参考：
- [PRD-API-索引文档](./PRD-API-索引文档.md)
- [PRD-API-ProcessingController](./PRD-API-ProcessingController.md)
- [PRD-API-MaterialBatchController](./PRD-API-MaterialBatchController.md)
- [PRD-API-AuthController](./PRD-API-AuthController.md)
