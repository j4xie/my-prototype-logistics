# Cretas食品溯源系统 - 完整API参考文档

**系统名称**: 白垩纪食品溯源系统 API 文档
**版本**: 1.0.0
**描述**: Cretas Food Traceability System - RESTful API Documentation
**服务器地址**: http://47.251.121.76:10010/
**文档生成时间**: 2025-01-XX

---

## 目录

1. [供应商管理](#供应商管理)
2. [时间统计管理](#时间统计管理)
3. [客户管理](#客户管理)
4. [生产加工管理](#生产加工管理)
5. [原材料类型管理](#原材料类型管理)
6. [转换率管理](#转换率管理)
7. [系统管理](#系统管理)
8. [白名单管理](#白名单管理)
9. [工作类型管理](#工作类型管理)
10. [工厂设置管理](#工厂设置管理)
11. [原材料批次管理](#原材料批次管理)
12. [考勤打卡管理](#考勤打卡管理)
13. [认证管理](#认证管理)
14. [产品类型管理](#产品类型管理)
15. [用户管理](#用户管理)
16. [报表统计管理](#报表统计管理)
17. [生产计划管理](#生产计划管理)
18. [设备管理](#设备管理)
19. [测试接口](#测试接口)
20. [移动端接口](#移动端接口)

---

## API统计概览

| 模块名称 | API数量 | 说明 |
|---------|--------|------|
| 供应商管理 | 18 | 供应商管理相关接口 |
| 时间统计管理 | 17 | 工时统计和考勤分析相关接口 |
| 客户管理 | 24 | 客户管理相关接口 |
| 生产加工管理 | 21 | Processing Controller |
| 原材料类型管理 | 13 | Raw Material Type Controller |
| 转换率管理 | 15 | 原材料到产品转换率管理相关接口 |
| 系统管理 | 9 | System Controller |
| 白名单管理 | 20 | 白名单管理相关接口 |
| 工作类型管理 | 10 | 工作类型管理相关接口 |
| 工厂设置管理 | 22 | 工厂配置和设置管理接口 |
| 原材料批次管理 | 22 | 原材料批次管理相关接口 |
| 考勤打卡管理 | 11 | Time Clock Controller |
| 认证管理 | 11 | 用户认证相关接口 |
| 产品类型管理 | 12 | Product Type Controller |
| 用户管理 | 14 | 用户管理相关接口 |
| 报表统计管理 | 19 | Report Controller |
| 生产计划管理 | 20 | 生产计划管理相关接口 |
| 设备管理 | 24 | 设备管理相关接口 |
| 测试接口 | 2 | Test Controller |
| 移动端接口 | 21 | 移动端专用接口 |

**总计**: 325 个API

---

## API详细列表

### 供应商管理

**说明**: 供应商管理相关接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/{factoryId}/suppliers` | 获取供应商列表（分页） |
| `POST` | `/api/mobile/{factoryId}/suppliers` | 创建供应商 |
| `GET` | `/api/mobile/{factoryId}/suppliers/active` | 获取活跃供应商列表 |
| `GET` | `/api/mobile/{factoryId}/suppliers/by-material` | 按材料类型获取供应商 |
| `GET` | `/api/mobile/{factoryId}/suppliers/check-code` | 检查供应商代码是否存在 |
| `GET` | `/api/mobile/{factoryId}/suppliers/export` | 导出供应商列表 |
| `POST` | `/api/mobile/{factoryId}/suppliers/import` | 批量导入供应商 |
| `GET` | `/api/mobile/{factoryId}/suppliers/outstanding-balance` | 获取有欠款的供应商 |
| `GET` | `/api/mobile/{factoryId}/suppliers/rating-distribution` | 获取供应商评级分布 |
| `GET` | `/api/mobile/{factoryId}/suppliers/search` | 搜索供应商 |
| `GET` | `/api/mobile/{factoryId}/suppliers/{supplierId}` | 获取供应商详情 |
| `PUT` | `/api/mobile/{factoryId}/suppliers/{supplierId}` | 更新供应商 |
| `DELETE` | `/api/mobile/{factoryId}/suppliers/{supplierId}` | 删除供应商 |
| `PUT` | `/api/mobile/{factoryId}/suppliers/{supplierId}/credit-limit` | 更新供应商信用额度 |
| `GET` | `/api/mobile/{factoryId}/suppliers/{supplierId}/history` | 获取供应商供货历史 |
| `PUT` | `/api/mobile/{factoryId}/suppliers/{supplierId}/rating` | 更新供应商评级 |
| `GET` | `/api/mobile/{factoryId}/suppliers/{supplierId}/statistics` | 获取供应商统计信息 |
| `PUT` | `/api/mobile/{factoryId}/suppliers/{supplierId}/status` | 切换供应商状态 |

<details>
<summary>展开查看 供应商管理 API详情</summary>

#### GET /api/mobile/{factoryId}/suppliers

**摘要**: 获取供应商列表（分页）

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小
- `sortBy` (query) **[可选]**: string
  - 排序字段
- `sortDirection` (query) **[可选]**: string
  - 排序方向 (ASC/DESC)
- `keyword` (query) **[可选]**: string
  - 搜索关键词

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«SupplierDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/suppliers

**摘要**: 创建供应商

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `Authorization` (header) **[必填]**: string
  - 访问令牌
- `request` (body) **[必填]**: CreateSupplierRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«SupplierDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/suppliers/active

**摘要**: 获取活跃供应商列表

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«SupplierDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/suppliers/by-material

**摘要**: 按材料类型获取供应商

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `materialType` (query) **[必填]**: string
  - 材料类型

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«SupplierDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/suppliers/check-code

**摘要**: 检查供应商代码是否存在

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `supplierCode` (query) **[必填]**: string
  - 供应商代码

**响应**:

- `200`: OK - 返回类型: `ApiResponse«boolean»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/suppliers/export

**摘要**: 导出供应商列表

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/suppliers/import

**摘要**: 批量导入供应商

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `Authorization` (header) **[必填]**: string
  - 访问令牌

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«SupplierDTO»»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/suppliers/outstanding-balance

**摘要**: 获取有欠款的供应商

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«SupplierDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/suppliers/rating-distribution

**摘要**: 获取供应商评级分布

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«int,long»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/suppliers/search

**摘要**: 搜索供应商

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `keyword` (query) **[必填]**: string
  - 搜索关键词

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«SupplierDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/suppliers/{supplierId}

**摘要**: 获取供应商详情

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `supplierId` (path) **[必填]**: integer
  - 供应商ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«SupplierDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/suppliers/{supplierId}

**摘要**: 更新供应商

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `supplierId` (path) **[必填]**: integer
  - 供应商ID
- `request` (body) **[必填]**: CreateSupplierRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«SupplierDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### DELETE /api/mobile/{factoryId}/suppliers/{supplierId}

**摘要**: 删除供应商

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `supplierId` (path) **[必填]**: integer
  - 供应商ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `204`: No Content
- `401`: Unauthorized
- `403`: Forbidden

---

#### PUT /api/mobile/{factoryId}/suppliers/{supplierId}/credit-limit

**摘要**: 更新供应商信用额度

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `supplierId` (path) **[必填]**: integer
  - 供应商ID
- `creditLimit` (query) **[必填]**: number
  - 信用额度

**响应**:

- `200`: OK - 返回类型: `ApiResponse«SupplierDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/suppliers/{supplierId}/history

**摘要**: 获取供应商供货历史

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `supplierId` (path) **[必填]**: integer
  - 供应商ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«Map«string,object»»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/suppliers/{supplierId}/rating

**摘要**: 更新供应商评级

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `supplierId` (path) **[必填]**: integer
  - 供应商ID
- `rating` (query) **[必填]**: integer
  - 评级(1-5)
- `notes` (query) **[可选]**: string
  - 评级说明

**响应**:

- `200`: OK - 返回类型: `ApiResponse«SupplierDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/suppliers/{supplierId}/statistics

**摘要**: 获取供应商统计信息

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `supplierId` (path) **[必填]**: integer
  - 供应商ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/suppliers/{supplierId}/status

**摘要**: 切换供应商状态

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `supplierId` (path) **[必填]**: integer
  - 供应商ID
- `isActive` (query) **[必填]**: boolean
  - 激活状态

**响应**:

- `200`: OK - 返回类型: `ApiResponse«SupplierDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


### 时间统计管理

**说明**: 工时统计和考勤分析相关接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/{factoryId}/time-stats/anomaly` | 获取异常统计 |
| `GET` | `/api/mobile/{factoryId}/time-stats/by-department` | 按部门统计 |
| `GET` | `/api/mobile/{factoryId}/time-stats/by-work-type` | 按工作类型统计 |
| `DELETE` | `/api/mobile/{factoryId}/time-stats/cleanup` | 清理过期统计数据 |
| `GET` | `/api/mobile/{factoryId}/time-stats/comparative` | 获取对比分析 |
| `GET` | `/api/mobile/{factoryId}/time-stats/daily` | 获取日统计 |
| `GET` | `/api/mobile/{factoryId}/time-stats/daily/range` | 获取日期范围统计 |
| `POST` | `/api/mobile/{factoryId}/time-stats/export` | 导出统计报告 |
| `GET` | `/api/mobile/{factoryId}/time-stats/monthly` | 获取月统计 |
| `GET` | `/api/mobile/{factoryId}/time-stats/productivity` | 获取生产力分析 |
| `GET` | `/api/mobile/{factoryId}/time-stats/realtime` | 获取实时统计 |
| `POST` | `/api/mobile/{factoryId}/time-stats/recalculate` | 重新计算统计 |
| `GET` | `/api/mobile/{factoryId}/time-stats/trend` | 获取统计趋势 |
| `GET` | `/api/mobile/{factoryId}/time-stats/weekly` | 获取周统计 |
| `GET` | `/api/mobile/{factoryId}/time-stats/workers` | 获取员工时间统计 |
| `GET` | `/api/mobile/{factoryId}/time-stats/workers/{workerId}` | 获取员工个人时间统计 |
| `GET` | `/api/mobile/{factoryId}/time-stats/yearly` | 获取年统计 |

<details>
<summary>展开查看 时间统计管理 API详情</summary>

#### GET /api/mobile/{factoryId}/time-stats/anomaly

**摘要**: 获取异常统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«TimeStatsDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/time-stats/by-department

**摘要**: 按部门统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«TimeStatsDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/time-stats/by-work-type

**摘要**: 按工作类型统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«TimeStatsDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### DELETE /api/mobile/{factoryId}/time-stats/cleanup

**摘要**: 清理过期统计数据

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `retentionDays` (query) **[可选]**: integer
  - 保留天数

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `204`: No Content
- `401`: Unauthorized
- `403`: Forbidden

---

#### GET /api/mobile/{factoryId}/time-stats/comparative

**摘要**: 获取对比分析

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `period1Start` (query) **[可选]**: string
  - 期间1开始日期
- `period1End` (query) **[可选]**: string
  - 期间1结束日期
- `period2Start` (query) **[可选]**: string
  - 期间2开始日期
- `period2End` (query) **[可选]**: string
  - 期间2结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«TimeStatsDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/time-stats/daily

**摘要**: 获取日统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `date` (query) **[可选]**: string
  - 日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«TimeStatsDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/time-stats/daily/range

**摘要**: 获取日期范围统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«TimeStatsDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/time-stats/export

**摘要**: 导出统计报告

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期
- `format` (query) **[可选]**: string
  - 导出格式

**响应**:

- `200`: OK - 返回类型: `ApiResponse«string»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/time-stats/monthly

**摘要**: 获取月统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `year` (query) **[可选]**: integer
  - 年份
- `month` (query) **[可选]**: integer
  - 月份

**响应**:

- `200`: OK - 返回类型: `ApiResponse«TimeStatsDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/time-stats/productivity

**摘要**: 获取生产力分析

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductivityAnalysis»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/time-stats/realtime

**摘要**: 获取实时统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«TimeStatsDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/time-stats/recalculate

**摘要**: 重新计算统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `date` (query) **[可选]**: string
  - 日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/time-stats/trend

**摘要**: 获取统计趋势

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«DailyStats»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/time-stats/weekly

**摘要**: 获取周统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `year` (query) **[可选]**: integer
  - 年份
- `week` (query) **[可选]**: integer
  - 周数

**响应**:

- `200`: OK - 返回类型: `ApiResponse«TimeStatsDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/time-stats/workers

**摘要**: 获取员工时间统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期
- `topN` (query) **[可选]**: integer
  - 排名前N

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«WorkerTimeStats»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/time-stats/workers/{workerId}

**摘要**: 获取员工个人时间统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `workerId` (path) **[可选]**: integer
  - 员工ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«WorkerTimeStats»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/time-stats/yearly

**摘要**: 获取年统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `year` (query) **[可选]**: integer
  - 年份

**响应**:

- `200`: OK - 返回类型: `ApiResponse«TimeStatsDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


### 客户管理

**说明**: 客户管理相关接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/{factoryId}/customers` | 获取客户列表（分页） |
| `POST` | `/api/mobile/{factoryId}/customers` | 创建客户 |
| `GET` | `/api/mobile/{factoryId}/customers/active` | 获取活跃客户列表 |
| `GET` | `/api/mobile/{factoryId}/customers/by-industry` | 按行业获取客户 |
| `GET` | `/api/mobile/{factoryId}/customers/by-type` | 按客户类型获取客户 |
| `GET` | `/api/mobile/{factoryId}/customers/check-code` | 检查客户代码是否存在 |
| `GET` | `/api/mobile/{factoryId}/customers/export` | 导出客户列表 |
| `POST` | `/api/mobile/{factoryId}/customers/import` | 批量导入客户 |
| `GET` | `/api/mobile/{factoryId}/customers/industry-distribution` | 获取客户行业分布 |
| `GET` | `/api/mobile/{factoryId}/customers/outstanding-balance` | 获取有欠款的客户 |
| `GET` | `/api/mobile/{factoryId}/customers/overall-statistics` | 获取客户总体统计 |
| `GET` | `/api/mobile/{factoryId}/customers/rating-distribution` | 获取客户评级分布 |
| `GET` | `/api/mobile/{factoryId}/customers/search` | 搜索客户 |
| `GET` | `/api/mobile/{factoryId}/customers/type-distribution` | 获取客户类型分布 |
| `GET` | `/api/mobile/{factoryId}/customers/vip` | 获取VIP客户 |
| `GET` | `/api/mobile/{factoryId}/customers/{customerId}` | 获取客户详情 |
| `PUT` | `/api/mobile/{factoryId}/customers/{customerId}` | 更新客户 |
| `DELETE` | `/api/mobile/{factoryId}/customers/{customerId}` | 删除客户 |
| `PUT` | `/api/mobile/{factoryId}/customers/{customerId}/balance` | 更新客户当前余额 |
| `PUT` | `/api/mobile/{factoryId}/customers/{customerId}/credit-limit` | 更新客户信用额度 |
| `GET` | `/api/mobile/{factoryId}/customers/{customerId}/purchase-history` | 获取客户购买历史 |
| `PUT` | `/api/mobile/{factoryId}/customers/{customerId}/rating` | 更新客户评级 |
| `GET` | `/api/mobile/{factoryId}/customers/{customerId}/statistics` | 获取客户统计信息 |
| `PUT` | `/api/mobile/{factoryId}/customers/{customerId}/status` | 切换客户状态 |

<details>
<summary>展开查看 客户管理 API详情</summary>

#### GET /api/mobile/{factoryId}/customers

**摘要**: 获取客户列表（分页）

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小
- `sortBy` (query) **[可选]**: string
  - 排序字段
- `sortDirection` (query) **[可选]**: string
  - 排序方向 (ASC/DESC)
- `keyword` (query) **[可选]**: string
  - 搜索关键词

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«CustomerDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/customers

**摘要**: 创建客户

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `Authorization` (header) **[必填]**: string
  - 访问令牌
- `request` (body) **[必填]**: CreateCustomerRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«CustomerDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/customers/active

**摘要**: 获取活跃客户列表

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«CustomerDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/customers/by-industry

**摘要**: 按行业获取客户

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `industry` (query) **[必填]**: string
  - 行业

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«CustomerDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/customers/by-type

**摘要**: 按客户类型获取客户

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `type` (query) **[必填]**: string
  - 客户类型

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«CustomerDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/customers/check-code

**摘要**: 检查客户代码是否存在

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `customerCode` (query) **[必填]**: string
  - 客户代码

**响应**:

- `200`: OK - 返回类型: `ApiResponse«boolean»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/customers/export

**摘要**: 导出客户列表

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/customers/import

**摘要**: 批量导入客户

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `Authorization` (header) **[必填]**: string
  - 访问令牌

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«CustomerDTO»»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/customers/industry-distribution

**摘要**: 获取客户行业分布

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,long»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/customers/outstanding-balance

**摘要**: 获取有欠款的客户

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«CustomerDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/customers/overall-statistics

**摘要**: 获取客户总体统计

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/customers/rating-distribution

**摘要**: 获取客户评级分布

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«int,long»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/customers/search

**摘要**: 搜索客户

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `keyword` (query) **[必填]**: string
  - 搜索关键词

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«CustomerDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/customers/type-distribution

**摘要**: 获取客户类型分布

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,long»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/customers/vip

**摘要**: 获取VIP客户

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `limit` (query) **[必填]**: integer
  - 数量限制

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«CustomerDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/customers/{customerId}

**摘要**: 获取客户详情

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `customerId` (path) **[必填]**: integer
  - 客户ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«CustomerDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/customers/{customerId}

**摘要**: 更新客户

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `customerId` (path) **[必填]**: integer
  - 客户ID
- `request` (body) **[必填]**: CreateCustomerRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«CustomerDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### DELETE /api/mobile/{factoryId}/customers/{customerId}

**摘要**: 删除客户

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `customerId` (path) **[必填]**: integer
  - 客户ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `204`: No Content
- `401`: Unauthorized
- `403`: Forbidden

---

#### PUT /api/mobile/{factoryId}/customers/{customerId}/balance

**摘要**: 更新客户当前余额

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `customerId` (path) **[必填]**: integer
  - 客户ID
- `balance` (query) **[必填]**: number
  - 当前余额

**响应**:

- `200`: OK - 返回类型: `ApiResponse«CustomerDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/customers/{customerId}/credit-limit

**摘要**: 更新客户信用额度

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `customerId` (path) **[必填]**: integer
  - 客户ID
- `creditLimit` (query) **[必填]**: number
  - 信用额度

**响应**:

- `200`: OK - 返回类型: `ApiResponse«CustomerDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/customers/{customerId}/purchase-history

**摘要**: 获取客户购买历史

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `customerId` (path) **[必填]**: integer
  - 客户ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«Map«string,object»»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/customers/{customerId}/rating

**摘要**: 更新客户评级

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `customerId` (path) **[必填]**: integer
  - 客户ID
- `rating` (query) **[必填]**: integer
  - 评级(1-5)
- `notes` (query) **[可选]**: string
  - 评级说明

**响应**:

- `200`: OK - 返回类型: `ApiResponse«CustomerDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/customers/{customerId}/statistics

**摘要**: 获取客户统计信息

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `customerId` (path) **[必填]**: integer
  - 客户ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/customers/{customerId}/status

**摘要**: 切换客户状态

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `customerId` (path) **[必填]**: integer
  - 客户ID
- `isActive` (query) **[必填]**: boolean
  - 激活状态

**响应**:

- `200`: OK - 返回类型: `ApiResponse«CustomerDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


### 生产加工管理

**说明**: Processing Controller

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/{factoryId}/processing/batches` | 获取批次列表 |
| `POST` | `/api/mobile/{factoryId}/processing/batches` | 创建生产批次 |
| `GET` | `/api/mobile/{factoryId}/processing/batches/{batchId}` | 获取批次详情 |
| `POST` | `/api/mobile/{factoryId}/processing/batches/{batchId}/cancel` | 取消生产 |
| `POST` | `/api/mobile/{factoryId}/processing/batches/{batchId}/complete` | 完成生产 |
| `GET` | `/api/mobile/{factoryId}/processing/batches/{batchId}/cost-analysis` | 批次成本分析 |
| `POST` | `/api/mobile/{factoryId}/processing/batches/{batchId}/material-consumption` | 记录原材料消耗 |
| `POST` | `/api/mobile/{factoryId}/processing/batches/{batchId}/pause` | 暂停生产 |
| `POST` | `/api/mobile/{factoryId}/processing/batches/{batchId}/recalculate-cost` | 重算成本 |
| `POST` | `/api/mobile/{factoryId}/processing/batches/{batchId}/start` | 开始生产 |
| `GET` | `/api/mobile/{factoryId}/processing/batches/{batchId}/timeline` | 获取批次时间线 |
| `GET` | `/api/mobile/{factoryId}/processing/dashboard/equipment` | 设备仪表盘 |
| `GET` | `/api/mobile/{factoryId}/processing/dashboard/overview` | 生产概览 |
| `GET` | `/api/mobile/{factoryId}/processing/dashboard/production` | 生产统计 |
| `GET` | `/api/mobile/{factoryId}/processing/dashboard/quality` | 质量仪表盘 |
| `POST` | `/api/mobile/{factoryId}/processing/material-receipt` | 原材料接收 |
| `GET` | `/api/mobile/{factoryId}/processing/materials` | 获取原材料列表 |
| `GET` | `/api/mobile/{factoryId}/processing/quality/inspections` | 获取质检记录 |
| `POST` | `/api/mobile/{factoryId}/processing/quality/inspections` | 提交质检记录 |
| `GET` | `/api/mobile/{factoryId}/processing/quality/statistics` | 质量统计 |
| `GET` | `/api/mobile/{factoryId}/processing/quality/trends` | 质量趋势 |

<details>
<summary>展开查看 生产加工管理 API详情</summary>

#### GET /api/mobile/{factoryId}/processing/batches

**摘要**: 获取批次列表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `status` (query) **[可选]**: string
  - 状态
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«ProductionBatch»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/processing/batches

**摘要**: 创建生产批次

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `batch` (body) **[可选]**: ProductionBatch
  - 批次信息

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionBatch»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/processing/batches/{batchId}

**摘要**: 获取批次详情

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `batchId` (path) **[可选]**: integer
  - 批次ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionBatch»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/processing/batches/{batchId}/cancel

**摘要**: 取消生产

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `batchId` (path) **[可选]**: integer
  - 批次ID
- `reason` (query) **[可选]**: string
  - 取消原因

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionBatch»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/processing/batches/{batchId}/complete

**摘要**: 完成生产

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `batchId` (path) **[可选]**: integer
  - 批次ID
- `actualQuantity` (query) **[可选]**: number
  - 实际产量
- `goodQuantity` (query) **[可选]**: number
  - 良品数量
- `defectQuantity` (query) **[可选]**: number
  - 不良品数量

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionBatch»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/processing/batches/{batchId}/cost-analysis

**摘要**: 批次成本分析

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `batchId` (path) **[可选]**: integer
  - 批次ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/processing/batches/{batchId}/material-consumption

**摘要**: 记录原材料消耗

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `batchId` (path) **[可选]**: integer
  - 批次ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/processing/batches/{batchId}/pause

**摘要**: 暂停生产

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `batchId` (path) **[可选]**: integer
  - 批次ID
- `reason` (query) **[可选]**: string
  - 暂停原因

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionBatch»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/processing/batches/{batchId}/recalculate-cost

**摘要**: 重算成本

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `batchId` (path) **[可选]**: integer
  - 批次ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionBatch»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/processing/batches/{batchId}/start

**摘要**: 开始生产

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `batchId` (path) **[可选]**: integer
  - 批次ID
- `supervisorId` (query) **[可选]**: integer
  - 负责人ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionBatch»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/processing/batches/{batchId}/timeline

**摘要**: 获取批次时间线

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `batchId` (path) **[可选]**: integer
  - 批次ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«Map«string,object»»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/processing/dashboard/equipment

**摘要**: 设备仪表盘

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/processing/dashboard/overview

**摘要**: 生产概览

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/processing/dashboard/production

**摘要**: 生产统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `period` (query) **[可选]**: string
  - 时间周期: today, week, month

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/processing/dashboard/quality

**摘要**: 质量仪表盘

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/processing/material-receipt

**摘要**: 原材料接收

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `materialBatch` (body) **[可选]**: MaterialBatch
  - 原材料批次信息

**响应**:

- `200`: OK - 返回类型: `ApiResponse«MaterialBatch»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/processing/materials

**摘要**: 获取原材料列表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«MaterialBatch»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/processing/quality/inspections

**摘要**: 获取质检记录

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `batchId` (query) **[可选]**: integer
  - 批次ID
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«Map«string,object»»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/processing/quality/inspections

**摘要**: 提交质检记录

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `batchId` (query) **[可选]**: integer
  - 批次ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/processing/quality/statistics

**摘要**: 质量统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/processing/quality/trends

**摘要**: 质量趋势

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `days` (query) **[可选]**: integer
  - 天数

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«Map«string,object»»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


### 原材料类型管理

**说明**: Raw Material Type Controller

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/{factoryId}/materials/types` | 获取原材料类型列表 |
| `POST` | `/api/mobile/{factoryId}/materials/types` | 创建原材料类型 |
| `GET` | `/api/mobile/{factoryId}/materials/types/active` | 获取激活的原材料类型 |
| `PUT` | `/api/mobile/{factoryId}/materials/types/batch/status` | 批量更新状态 |
| `GET` | `/api/mobile/{factoryId}/materials/types/categories` | 获取原材料类别列表 |
| `GET` | `/api/mobile/{factoryId}/materials/types/category/{category}` | 根据类别获取原材料类型 |
| `GET` | `/api/mobile/{factoryId}/materials/types/check-code` | 检查原材料编码 |
| `GET` | `/api/mobile/{factoryId}/materials/types/low-stock` | 获取库存预警 |
| `GET` | `/api/mobile/{factoryId}/materials/types/search` | 搜索原材料类型 |
| `GET` | `/api/mobile/{factoryId}/materials/types/storage-type/{storageType}` | 根据存储类型获取原材料类型 |
| `GET` | `/api/mobile/{factoryId}/materials/types/{id}` | 获取原材料类型详情 |
| `PUT` | `/api/mobile/{factoryId}/materials/types/{id}` | 更新原材料类型 |
| `DELETE` | `/api/mobile/{factoryId}/materials/types/{id}` | 删除原材料类型 |

<details>
<summary>展开查看 原材料类型管理 API详情</summary>

#### GET /api/mobile/{factoryId}/materials/types

**摘要**: 获取原材料类型列表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«RawMaterialTypeDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/materials/types

**摘要**: 创建原材料类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `dto` (body) **[可选]**: RawMaterialTypeDTO
  - 原材料类型信息

**响应**:

- `200`: OK - 返回类型: `ApiResponse«RawMaterialTypeDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/materials/types/active

**摘要**: 获取激活的原材料类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«RawMaterialTypeDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/materials/types/batch/status

**摘要**: 批量更新状态

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `isActive` (query) **[可选]**: boolean
  - 激活状态

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/materials/types/categories

**摘要**: 获取原材料类别列表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«string»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/materials/types/category/{category}

**摘要**: 根据类别获取原材料类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `category` (path) **[可选]**: string
  - 原材料类别

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«RawMaterialTypeDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/materials/types/check-code

**摘要**: 检查原材料编码

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `code` (query) **[可选]**: string
  - 原材料编码
- `excludeId` (query) **[可选]**: integer
  - 排除的原材料ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«boolean»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/materials/types/low-stock

**摘要**: 获取库存预警

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«RawMaterialTypeDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/materials/types/search

**摘要**: 搜索原材料类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `keyword` (query) **[可选]**: string
  - 搜索关键字
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«RawMaterialTypeDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/materials/types/storage-type/{storageType}

**摘要**: 根据存储类型获取原材料类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `storageType` (path) **[可选]**: string
  - 存储类型

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«RawMaterialTypeDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/materials/types/{id}

**摘要**: 获取原材料类型详情

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 原材料类型ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«RawMaterialTypeDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/materials/types/{id}

**摘要**: 更新原材料类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 原材料类型ID
- `dto` (body) **[可选]**: RawMaterialTypeDTO
  - 原材料类型信息

**响应**:

- `200`: OK - 返回类型: `ApiResponse«RawMaterialTypeDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### DELETE /api/mobile/{factoryId}/materials/types/{id}

**摘要**: 删除原材料类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 原材料类型ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `204`: No Content
- `401`: Unauthorized
- `403`: Forbidden

---

</details>


### 转换率管理

**说明**: 原材料到产品转换率管理相关接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/{factoryId}/conversions` | 分页查询转换率配置 |
| `POST` | `/api/mobile/{factoryId}/conversions` | 创建转换率配置 |
| `PUT` | `/api/mobile/{factoryId}/conversions/batch/activate` | 批量激活/停用转换率配置 |
| `POST` | `/api/mobile/{factoryId}/conversions/calculate/material-requirement` | 计算原材料需求量 |
| `POST` | `/api/mobile/{factoryId}/conversions/calculate/product-output` | 计算产品产出量 |
| `GET` | `/api/mobile/{factoryId}/conversions/export` | 导出转换率配置 |
| `POST` | `/api/mobile/{factoryId}/conversions/import` | 批量导入转换率配置 |
| `GET` | `/api/mobile/{factoryId}/conversions/material/{materialTypeId}` | 根据原材料类型查询转换率 |
| `GET` | `/api/mobile/{factoryId}/conversions/product/{productTypeId}` | 根据产品类型查询转换率 |
| `GET` | `/api/mobile/{factoryId}/conversions/rate` | 获取特定原材料和产品的转换率 |
| `GET` | `/api/mobile/{factoryId}/conversions/statistics` | 获取转换率统计信息 |
| `POST` | `/api/mobile/{factoryId}/conversions/validate` | 验证转换率配置 |
| `GET` | `/api/mobile/{factoryId}/conversions/{id}` | 获取转换率详情 |
| `PUT` | `/api/mobile/{factoryId}/conversions/{id}` | 更新转换率配置 |
| `DELETE` | `/api/mobile/{factoryId}/conversions/{id}` | 删除转换率配置 |

<details>
<summary>展开查看 转换率管理 API详情</summary>

#### GET /api/mobile/{factoryId}/conversions

**摘要**: 分页查询转换率配置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `isActive` (query) **[可选]**: boolean
  - 是否激活
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小
- `sort` (query) **[可选]**: string
  - 排序字段
- `direction` (query) **[可选]**: string
  - 排序方向

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«ConversionDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/conversions

**摘要**: 创建转换率配置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `dto` (body) **[必填]**: ConversionDTO
  - dto

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ConversionDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/conversions/batch/activate

**摘要**: 批量激活/停用转换率配置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `isActive` (query) **[可选]**: boolean
  - 激活状态

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/conversions/calculate/material-requirement

**摘要**: 计算原材料需求量

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `productTypeId` (query) **[可选]**: integer
  - 产品类型ID
- `productQuantity` (query) **[可选]**: number
  - 产品数量

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«MaterialRequirement»»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/conversions/calculate/product-output

**摘要**: 计算产品产出量

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `materialTypeId` (query) **[可选]**: integer
  - 原材料类型ID
- `materialQuantity` (query) **[可选]**: number
  - 原材料数量

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«ProductOutput»»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/conversions/export

**摘要**: 导出转换率配置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«ConversionDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/conversions/import

**摘要**: 批量导入转换率配置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«ConversionDTO»»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/conversions/material/{materialTypeId}

**摘要**: 根据原材料类型查询转换率

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `materialTypeId` (path) **[可选]**: integer
  - 原材料类型ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«ConversionDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/conversions/product/{productTypeId}

**摘要**: 根据产品类型查询转换率

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `productTypeId` (path) **[可选]**: integer
  - 产品类型ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«ConversionDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/conversions/rate

**摘要**: 获取特定原材料和产品的转换率

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `materialTypeId` (query) **[可选]**: integer
  - 原材料类型ID
- `productTypeId` (query) **[可选]**: integer
  - 产品类型ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ConversionDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/conversions/statistics

**摘要**: 获取转换率统计信息

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ConversionStatistics»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/conversions/validate

**摘要**: 验证转换率配置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `dto` (body) **[必填]**: ConversionDTO
  - dto

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ValidationResult»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/conversions/{id}

**摘要**: 获取转换率详情

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 转换率ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ConversionDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/conversions/{id}

**摘要**: 更新转换率配置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 转换率ID
- `dto` (body) **[必填]**: ConversionDTO
  - dto

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ConversionDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### DELETE /api/mobile/{factoryId}/conversions/{id}

**摘要**: 删除转换率配置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 转换率ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `204`: No Content
- `401`: Unauthorized
- `403`: Forbidden

---

</details>


### 系统管理

**说明**: System Controller

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/system/api-logs` | 获取API访问日志 |
| `POST` | `/api/mobile/system/cleanup-logs` | 清理过期日志 |
| `GET` | `/api/mobile/system/configuration` | 获取系统配置 |
| `GET` | `/api/mobile/system/database/status` | 数据库状态 |
| `GET` | `/api/mobile/system/health` | 系统健康检查 |
| `GET` | `/api/mobile/system/logs` | 获取系统日志 |
| `POST` | `/api/mobile/system/logs` | 记录系统日志 |
| `GET` | `/api/mobile/system/performance` | 系统性能监控 |
| `GET` | `/api/mobile/system/statistics` | 系统统计 |

<details>
<summary>展开查看 系统管理 API详情</summary>

#### GET /api/mobile/system/api-logs

**摘要**: 获取API访问日志

**请求参数**:

- `factoryId` (query) **[可选]**: string
  - 工厂ID
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«SystemLog»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/system/cleanup-logs

**摘要**: 清理过期日志

**请求参数**:

- `beforeDate` (query) **[可选]**: string
  - 清理此日期之前的日志

**响应**:

- `200`: OK - 返回类型: `ApiResponse«int»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/system/configuration

**摘要**: 获取系统配置

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/system/database/status

**摘要**: 数据库状态

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/system/health

**摘要**: 系统健康检查

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/system/logs

**摘要**: 获取系统日志

**请求参数**:

- `factoryId` (query) **[可选]**: string
  - 工厂ID
- `logType` (query) **[可选]**: string
  - 日志类型
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«SystemLog»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/system/logs

**摘要**: 记录系统日志

**请求参数**:

- `systemLog` (body) **[可选]**: SystemLog
  - 日志信息

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/system/performance

**摘要**: 系统性能监控

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/system/statistics

**摘要**: 系统统计

**请求参数**:

- `factoryId` (query) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


### 白名单管理

**说明**: 白名单管理相关接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/{factoryId}/whitelist` | 获取白名单列表 |
| `POST` | `/api/{factoryId}/whitelist/batch` | 批量添加白名单 |
| `DELETE` | `/api/{factoryId}/whitelist/batch` | 批量删除白名单 |
| `DELETE` | `/api/{factoryId}/whitelist/cleanup` | 清理已删除的记录 |
| `PUT` | `/api/{factoryId}/whitelist/expired` | 更新过期的白名单状态 |
| `GET` | `/api/{factoryId}/whitelist/expiring` | 获取即将过期的白名单 |
| `GET` | `/api/{factoryId}/whitelist/export` | 导出白名单 |
| `POST` | `/api/{factoryId}/whitelist/import` | 导入白名单 |
| `PUT` | `/api/{factoryId}/whitelist/limit-reached` | 更新达到使用上限的白名单状态 |
| `GET` | `/api/{factoryId}/whitelist/most-active` | 获取最活跃的白名单用户 |
| `GET` | `/api/{factoryId}/whitelist/recently-used` | 获取最近使用的白名单 |
| `GET` | `/api/{factoryId}/whitelist/search` | 搜索白名单 |
| `GET` | `/api/{factoryId}/whitelist/stats` | 获取白名单统计信息 |
| `PUT` | `/api/{factoryId}/whitelist/usage/{phoneNumber}` | 增加白名单使用次数 |
| `GET` | `/api/{factoryId}/whitelist/validate/{phoneNumber}` | 验证手机号是否在白名单中 |
| `GET` | `/api/{factoryId}/whitelist/{id}` | 获取白名单详情 |
| `PUT` | `/api/{factoryId}/whitelist/{id}` | 更新白名单 |
| `DELETE` | `/api/{factoryId}/whitelist/{id}` | 删除白名单 |
| `PUT` | `/api/{factoryId}/whitelist/{id}/extend` | 延长有效期 |
| `PUT` | `/api/{factoryId}/whitelist/{id}/reset-usage` | 重置使用次数 |

<details>
<summary>展开查看 白名单管理 API详情</summary>

#### GET /api/{factoryId}/whitelist

**摘要**: 获取白名单列表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `status` (query) **[可选]**: string
  - 状态
- `department` (query) **[可选]**: string
  - 部门
- `role` (query) **[可选]**: string
  - 角色
- `keyword` (query) **[可选]**: string
  - 搜索关键词
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小
- `sortBy` (query) **[可选]**: string
  - 排序字段
- `sortDirection` (query) **[可选]**: string
  - 排序方向

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«WhitelistDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/{factoryId}/whitelist/batch

**摘要**: 批量添加白名单

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `request` (body) **[必填]**: BatchAddRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«BatchResult»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### DELETE /api/{factoryId}/whitelist/batch

**摘要**: 批量删除白名单

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«int»`
- `204`: No Content
- `401`: Unauthorized
- `403`: Forbidden

---

#### DELETE /api/{factoryId}/whitelist/cleanup

**摘要**: 清理已删除的记录

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `daysOld` (query) **[可选]**: integer
  - 多少天前的记录

**响应**:

- `200`: OK - 返回类型: `ApiResponse«int»`
- `204`: No Content
- `401`: Unauthorized
- `403`: Forbidden

---

#### PUT /api/{factoryId}/whitelist/expired

**摘要**: 更新过期的白名单状态

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«int»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/{factoryId}/whitelist/expiring

**摘要**: 获取即将过期的白名单

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `days` (query) **[可选]**: integer
  - 天数

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«WhitelistDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/{factoryId}/whitelist/export

**摘要**: 导出白名单

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `status` (query) **[可选]**: string
  - 状态筛选

**响应**:

- `200`: OK - 返回类型: `ApiResponse«string»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/{factoryId}/whitelist/import

**摘要**: 导入白名单

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«BatchResult»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/{factoryId}/whitelist/limit-reached

**摘要**: 更新达到使用上限的白名单状态

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«int»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/{factoryId}/whitelist/most-active

**摘要**: 获取最活跃的白名单用户

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `limit` (query) **[可选]**: integer
  - 限制数量

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«WhitelistDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/{factoryId}/whitelist/recently-used

**摘要**: 获取最近使用的白名单

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `limit` (query) **[可选]**: integer
  - 限制数量

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«WhitelistDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/{factoryId}/whitelist/search

**摘要**: 搜索白名单

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `keyword` (query) **[可选]**: string
  - 搜索关键词
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«WhitelistDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/{factoryId}/whitelist/stats

**摘要**: 获取白名单统计信息

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«WhitelistStats»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/{factoryId}/whitelist/usage/{phoneNumber}

**摘要**: 增加白名单使用次数

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `phoneNumber` (path) **[可选]**: string
  - 手机号

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/{factoryId}/whitelist/validate/{phoneNumber}

**摘要**: 验证手机号是否在白名单中

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `phoneNumber` (path) **[可选]**: string
  - 手机号

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ValidationResponse»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/{factoryId}/whitelist/{id}

**摘要**: 获取白名单详情

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 白名单ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«WhitelistDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/{factoryId}/whitelist/{id}

**摘要**: 更新白名单

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 白名单ID
- `request` (body) **[必填]**: UpdateRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«WhitelistDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### DELETE /api/{factoryId}/whitelist/{id}

**摘要**: 删除白名单

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 白名单ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `204`: No Content
- `401`: Unauthorized
- `403`: Forbidden

---

#### PUT /api/{factoryId}/whitelist/{id}/extend

**摘要**: 延长有效期

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 白名单ID
- `days` (query) **[可选]**: integer
  - 延长天数

**响应**:

- `200`: OK - 返回类型: `ApiResponse«WhitelistDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/{factoryId}/whitelist/{id}/reset-usage

**摘要**: 重置使用次数

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 白名单ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


### 工作类型管理

**说明**: 工作类型管理相关接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/{factoryId}/work-types` | 获取工作类型列表 |
| `POST` | `/api/mobile/{factoryId}/work-types` | 创建工作类型 |
| `GET` | `/api/mobile/{factoryId}/work-types/active` | 获取所有活跃的工作类型 |
| `PUT` | `/api/mobile/{factoryId}/work-types/display-order` | 更新显示顺序 |
| `POST` | `/api/mobile/{factoryId}/work-types/initialize-defaults` | 初始化默认工作类型 |
| `GET` | `/api/mobile/{factoryId}/work-types/stats` | 获取工作类型统计信息 |
| `GET` | `/api/mobile/{factoryId}/work-types/{id}` | 获取工作类型详情 |
| `PUT` | `/api/mobile/{factoryId}/work-types/{id}` | 更新工作类型 |
| `DELETE` | `/api/mobile/{factoryId}/work-types/{id}` | 删除工作类型 |
| `PUT` | `/api/mobile/{factoryId}/work-types/{id}/toggle-status` | 切换工作类型状态 |

<details>
<summary>展开查看 工作类型管理 API详情</summary>

#### GET /api/mobile/{factoryId}/work-types

**摘要**: 获取工作类型列表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小
- `sortBy` (query) **[可选]**: string
  - 排序字段
- `sortDirection` (query) **[可选]**: string
  - 排序方向

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«WorkTypeDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/work-types

**摘要**: 创建工作类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `dto` (body) **[必填]**: WorkTypeDTO
  - dto

**响应**:

- `200`: OK - 返回类型: `ApiResponse«WorkTypeDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/work-types/active

**摘要**: 获取所有活跃的工作类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«WorkTypeDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/work-types/display-order

**摘要**: 更新显示顺序

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/work-types/initialize-defaults

**摘要**: 初始化默认工作类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/work-types/stats

**摘要**: 获取工作类型统计信息

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«WorkTypeStats»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/work-types/{id}

**摘要**: 获取工作类型详情

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 工作类型ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«WorkTypeDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/work-types/{id}

**摘要**: 更新工作类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 工作类型ID
- `dto` (body) **[必填]**: WorkTypeDTO
  - dto

**响应**:

- `200`: OK - 返回类型: `ApiResponse«WorkTypeDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### DELETE /api/mobile/{factoryId}/work-types/{id}

**摘要**: 删除工作类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 工作类型ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `204`: No Content
- `401`: Unauthorized
- `403`: Forbidden

---

#### PUT /api/mobile/{factoryId}/work-types/{id}/toggle-status

**摘要**: 切换工作类型状态

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 工作类型ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«WorkTypeDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


### 工厂设置管理

**说明**: 工厂配置和设置管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/{factoryId}/settings` | 获取工厂设置 |
| `PUT` | `/api/mobile/{factoryId}/settings` | 更新工厂设置 |
| `GET` | `/api/mobile/{factoryId}/settings/ai` | 获取AI设置 |
| `PUT` | `/api/mobile/{factoryId}/settings/ai` | 更新AI设置 |
| `GET` | `/api/mobile/{factoryId}/settings/ai/usage-stats` | 获取AI使用统计 |
| `GET` | `/api/mobile/{factoryId}/settings/data-retention` | 获取数据保留设置 |
| `PUT` | `/api/mobile/{factoryId}/settings/data-retention` | 更新数据保留设置 |
| `GET` | `/api/mobile/{factoryId}/settings/display` | 获取显示设置 |
| `PUT` | `/api/mobile/{factoryId}/settings/display` | 更新显示设置 |
| `GET` | `/api/mobile/{factoryId}/settings/export` | 导出设置 |
| `GET` | `/api/mobile/{factoryId}/settings/features` | 获取功能开关 |
| `PUT` | `/api/mobile/{factoryId}/settings/features/{feature}` | 更新功能开关 |
| `POST` | `/api/mobile/{factoryId}/settings/import` | 导入设置 |
| `GET` | `/api/mobile/{factoryId}/settings/inventory` | 获取库存设置 |
| `PUT` | `/api/mobile/{factoryId}/settings/inventory` | 更新库存设置 |
| `GET` | `/api/mobile/{factoryId}/settings/notifications` | 获取通知设置 |
| `PUT` | `/api/mobile/{factoryId}/settings/notifications` | 更新通知设置 |
| `GET` | `/api/mobile/{factoryId}/settings/production` | 获取生产设置 |
| `PUT` | `/api/mobile/{factoryId}/settings/production` | 更新生产设置 |
| `POST` | `/api/mobile/{factoryId}/settings/reset` | 重置为默认设置 |
| `GET` | `/api/mobile/{factoryId}/settings/work-time` | 获取工作时间设置 |
| `PUT` | `/api/mobile/{factoryId}/settings/work-time` | 更新工作时间设置 |

<details>
<summary>展开查看 工厂设置管理 API详情</summary>

#### GET /api/mobile/{factoryId}/settings

**摘要**: 获取工厂设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«FactorySettingsDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/settings

**摘要**: 更新工厂设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `dto` (body) **[必填]**: FactorySettingsDTO
  - dto

**响应**:

- `200`: OK - 返回类型: `ApiResponse«FactorySettingsDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/settings/ai

**摘要**: 获取AI设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«AISettings»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/settings/ai

**摘要**: 更新AI设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `settings` (body) **[必填]**: AISettings
  - settings

**响应**:

- `200`: OK - 返回类型: `ApiResponse«AISettings»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/settings/ai/usage-stats

**摘要**: 获取AI使用统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `period` (query) **[可选]**: string
  - 统计周期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/settings/data-retention

**摘要**: 获取数据保留设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«DataRetentionSettings»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/settings/data-retention

**摘要**: 更新数据保留设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `settings` (body) **[必填]**: DataRetentionSettings
  - settings

**响应**:

- `200`: OK - 返回类型: `ApiResponse«DataRetentionSettings»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/settings/display

**摘要**: 获取显示设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,string»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/settings/display

**摘要**: 更新显示设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `language` (query) **[可选]**: string
  - 语言
- `timezone` (query) **[可选]**: string
  - 时区
- `dateFormat` (query) **[可选]**: string
  - 日期格式
- `currency` (query) **[可选]**: string
  - 货币

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/settings/export

**摘要**: 导出设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«string»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/settings/features

**摘要**: 获取功能开关

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,boolean»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/settings/features/{feature}

**摘要**: 更新功能开关

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `feature` (path) **[可选]**: string
  - 功能名称
- `enabled` (query) **[可选]**: boolean
  - 是否启用

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/settings/import

**摘要**: 导入设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«FactorySettingsDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/settings/inventory

**摘要**: 获取库存设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«InventorySettings»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/settings/inventory

**摘要**: 更新库存设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `settings` (body) **[必填]**: InventorySettings
  - settings

**响应**:

- `200`: OK - 返回类型: `ApiResponse«InventorySettings»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/settings/notifications

**摘要**: 获取通知设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«NotificationSettings»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/settings/notifications

**摘要**: 更新通知设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `settings` (body) **[必填]**: NotificationSettings
  - settings

**响应**:

- `200`: OK - 返回类型: `ApiResponse«NotificationSettings»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/settings/production

**摘要**: 获取生产设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionSettings»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/settings/production

**摘要**: 更新生产设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `settings` (body) **[必填]**: ProductionSettings
  - settings

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionSettings»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/settings/reset

**摘要**: 重置为默认设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«FactorySettingsDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/settings/work-time

**摘要**: 获取工作时间设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«WorkTimeSettings»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/settings/work-time

**摘要**: 更新工作时间设置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `settings` (body) **[必填]**: WorkTimeSettings
  - settings

**响应**:

- `200`: OK - 返回类型: `ApiResponse«WorkTimeSettings»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


### 原材料批次管理

**说明**: 原材料批次管理相关接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/{factoryId}/material-batches` | 获取原材料批次列表（分页） |
| `POST` | `/api/mobile/{factoryId}/material-batches` | 创建原材料批次 |
| `POST` | `/api/mobile/{factoryId}/material-batches/batch` | 批量创建材料批次 |
| `GET` | `/api/mobile/{factoryId}/material-batches/expired` | 获取已过期的批次 |
| `GET` | `/api/mobile/{factoryId}/material-batches/expiring` | 获取即将过期的批次 |
| `GET` | `/api/mobile/{factoryId}/material-batches/export` | 导出库存报表 |
| `GET` | `/api/mobile/{factoryId}/material-batches/fifo/{materialTypeId}` | 获取FIFO批次（先进先出） |
| `POST` | `/api/mobile/{factoryId}/material-batches/handle-expired` | 处理过期批次 |
| `GET` | `/api/mobile/{factoryId}/material-batches/inventory/statistics` | 获取库存统计 |
| `GET` | `/api/mobile/{factoryId}/material-batches/inventory/valuation` | 获取库存价值 |
| `GET` | `/api/mobile/{factoryId}/material-batches/low-stock` | 获取低库存警告 |
| `GET` | `/api/mobile/{factoryId}/material-batches/material-type/{materialTypeId}` | 按材料类型获取批次 |
| `GET` | `/api/mobile/{factoryId}/material-batches/status/{status}` | 按状态获取批次 |
| `GET` | `/api/mobile/{factoryId}/material-batches/{batchId}` | 获取原材料批次详情 |
| `PUT` | `/api/mobile/{factoryId}/material-batches/{batchId}` | 更新原材料批次 |
| `DELETE` | `/api/mobile/{factoryId}/material-batches/{batchId}` | 删除原材料批次 |
| `POST` | `/api/mobile/{factoryId}/material-batches/{batchId}/adjust` | 调整批次数量 |
| `POST` | `/api/mobile/{factoryId}/material-batches/{batchId}/release` | 释放预留材料 |
| `POST` | `/api/mobile/{factoryId}/material-batches/{batchId}/reserve` | 预留批次材料 |
| `PUT` | `/api/mobile/{factoryId}/material-batches/{batchId}/status` | 更新批次状态 |
| `GET` | `/api/mobile/{factoryId}/material-batches/{batchId}/usage-history` | 获取批次使用历史 |
| `POST` | `/api/mobile/{factoryId}/material-batches/{batchId}/use` | 使用批次材料 |

<details>
<summary>展开查看 原材料批次管理 API详情</summary>

#### GET /api/mobile/{factoryId}/material-batches

**摘要**: 获取原材料批次列表（分页）

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小
- `sortBy` (query) **[可选]**: string
  - 排序字段
- `sortDirection` (query) **[可选]**: string
  - 排序方向 (ASC/DESC)
- `keyword` (query) **[可选]**: string
  - 搜索关键词

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«MaterialBatchDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/material-batches

**摘要**: 创建原材料批次

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `Authorization` (header) **[必填]**: string
  - 访问令牌
- `request` (body) **[必填]**: CreateMaterialBatchRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«MaterialBatchDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/material-batches/batch

**摘要**: 批量创建材料批次

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `Authorization` (header) **[必填]**: string
  - 访问令牌

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«MaterialBatchDTO»»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/material-batches/expired

**摘要**: 获取已过期的批次

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«MaterialBatchDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/material-batches/expiring

**摘要**: 获取即将过期的批次

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `days` (query) **[必填]**: integer
  - 天数

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«MaterialBatchDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/material-batches/export

**摘要**: 导出库存报表

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/material-batches/fifo/{materialTypeId}

**摘要**: 获取FIFO批次（先进先出）

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `materialTypeId` (path) **[必填]**: integer
  - 材料类型ID
- `requiredQuantity` (query) **[必填]**: number
  - 需求数量

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«MaterialBatchDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/material-batches/handle-expired

**摘要**: 处理过期批次

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«int»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/material-batches/inventory/statistics

**摘要**: 获取库存统计

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/material-batches/inventory/valuation

**摘要**: 获取库存价值

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«bigdecimal»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/material-batches/low-stock

**摘要**: 获取低库存警告

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«Map«string,object»»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/material-batches/material-type/{materialTypeId}

**摘要**: 按材料类型获取批次

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `materialTypeId` (path) **[必填]**: integer
  - 材料类型ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«MaterialBatchDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/material-batches/status/{status}

**摘要**: 按状态获取批次

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `status` (path) **[必填]**: string
  - 状态

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«MaterialBatchDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/material-batches/{batchId}

**摘要**: 获取原材料批次详情

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `batchId` (path) **[必填]**: integer
  - 批次ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«MaterialBatchDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/material-batches/{batchId}

**摘要**: 更新原材料批次

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `batchId` (path) **[必填]**: integer
  - 批次ID
- `request` (body) **[必填]**: CreateMaterialBatchRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«MaterialBatchDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### DELETE /api/mobile/{factoryId}/material-batches/{batchId}

**摘要**: 删除原材料批次

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `batchId` (path) **[必填]**: integer
  - 批次ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `204`: No Content
- `401`: Unauthorized
- `403`: Forbidden

---

#### POST /api/mobile/{factoryId}/material-batches/{batchId}/adjust

**摘要**: 调整批次数量

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `batchId` (path) **[必填]**: integer
  - 批次ID
- `Authorization` (header) **[必填]**: string
  - 访问令牌
- `newQuantity` (query) **[必填]**: number
  - 新数量
- `reason` (query) **[必填]**: string
  - 调整原因

**响应**:

- `200`: OK - 返回类型: `ApiResponse«MaterialBatchDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/material-batches/{batchId}/release

**摘要**: 释放预留材料

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `batchId` (path) **[必填]**: integer
  - 批次ID
- `quantity` (query) **[必填]**: number
  - 释放数量
- `productionPlanId` (query) **[必填]**: integer
  - 生产计划ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/material-batches/{batchId}/reserve

**摘要**: 预留批次材料

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `batchId` (path) **[必填]**: integer
  - 批次ID
- `quantity` (query) **[必填]**: number
  - 预留数量
- `productionPlanId` (query) **[必填]**: integer
  - 生产计划ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/material-batches/{batchId}/status

**摘要**: 更新批次状态

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `batchId` (path) **[必填]**: integer
  - 批次ID
- `status` (query) **[必填]**: string
  - 新状态

**响应**:

- `200`: OK - 返回类型: `ApiResponse«MaterialBatchDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/material-batches/{batchId}/usage-history

**摘要**: 获取批次使用历史

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `batchId` (path) **[必填]**: integer
  - 批次ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«Map«string,object»»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/material-batches/{batchId}/use

**摘要**: 使用批次材料

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `batchId` (path) **[必填]**: integer
  - 批次ID
- `quantity` (query) **[必填]**: number
  - 使用数量
- `productionPlanId` (query) **[可选]**: integer
  - 生产计划ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«MaterialBatchDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


### 考勤打卡管理

**说明**: Time Clock Controller

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/mobile/{factoryId}/timeclock/break-end` | 结束休息 |
| `POST` | `/api/mobile/{factoryId}/timeclock/break-start` | 开始休息 |
| `POST` | `/api/mobile/{factoryId}/timeclock/clock-in` | 上班打卡 |
| `POST` | `/api/mobile/{factoryId}/timeclock/clock-out` | 下班打卡 |
| `GET` | `/api/mobile/{factoryId}/timeclock/department/{department}` | 部门考勤 |
| `GET` | `/api/mobile/{factoryId}/timeclock/export` | 导出考勤记录 |
| `GET` | `/api/mobile/{factoryId}/timeclock/history` | 获取打卡历史 |
| `PUT` | `/api/mobile/{factoryId}/timeclock/records/{recordId}` | 修改打卡记录 |
| `GET` | `/api/mobile/{factoryId}/timeclock/statistics` | 考勤统计 |
| `GET` | `/api/mobile/{factoryId}/timeclock/status` | 获取打卡状态 |
| `GET` | `/api/mobile/{factoryId}/timeclock/today` | 获取今日打卡 |

<details>
<summary>展开查看 考勤打卡管理 API详情</summary>

#### POST /api/mobile/{factoryId}/timeclock/break-end

**摘要**: 结束休息

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `userId` (query) **[可选]**: integer
  - 用户ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«TimeClockRecord»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/timeclock/break-start

**摘要**: 开始休息

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `userId` (query) **[可选]**: integer
  - 用户ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«TimeClockRecord»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/timeclock/clock-in

**摘要**: 上班打卡

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `userId` (query) **[可选]**: integer
  - 用户ID
- `location` (query) **[可选]**: string
  - 打卡位置
- `device` (query) **[可选]**: string
  - 打卡设备

**响应**:

- `200`: OK - 返回类型: `ApiResponse«TimeClockRecord»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/timeclock/clock-out

**摘要**: 下班打卡

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `userId` (query) **[可选]**: integer
  - 用户ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«TimeClockRecord»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/timeclock/department/{department}

**摘要**: 部门考勤

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `department` (path) **[可选]**: string
  - 部门
- `date` (query) **[可选]**: string
  - 日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/timeclock/export

**摘要**: 导出考勤记录

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/timeclock/history

**摘要**: 获取打卡历史

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `userId` (query) **[可选]**: integer
  - 用户ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«TimeClockRecord»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/timeclock/records/{recordId}

**摘要**: 修改打卡记录

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `recordId` (path) **[可选]**: integer
  - 记录ID
- `record` (body) **[可选]**: TimeClockRecord
  - 修改内容
- `editedBy` (query) **[可选]**: integer
  - 修改人ID
- `reason` (query) **[可选]**: string
  - 修改原因

**响应**:

- `200`: OK - 返回类型: `ApiResponse«TimeClockRecord»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/timeclock/statistics

**摘要**: 考勤统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `userId` (query) **[可选]**: integer
  - 用户ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/timeclock/status

**摘要**: 获取打卡状态

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `userId` (query) **[可选]**: integer
  - 用户ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/timeclock/today

**摘要**: 获取今日打卡

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `userId` (query) **[可选]**: integer
  - 用户ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«TimeClockRecord»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


### 认证管理

**说明**: 用户认证相关接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/change-password` | 修改密码 |
| `POST` | `/api/auth/login` | 用户登录 |
| `POST` | `/api/auth/logout` | 用户登出 |
| `GET` | `/api/auth/me` | 获取当前用户信息 |
| `POST` | `/api/auth/platform-login` | 平台管理员登录 |
| `POST` | `/api/auth/refresh` | 刷新令牌 |
| `POST` | `/api/auth/register` | 用户注册 |
| `POST` | `/api/auth/reset-password` | 重置密码 |
| `POST` | `/api/auth/send-code` | 发送手机验证码 |
| `GET` | `/api/auth/validate` | 验证令牌 |
| `POST` | `/api/auth/verify-phone` | 验证手机号并获取临时令牌 |

<details>
<summary>展开查看 认证管理 API详情</summary>

#### POST /api/auth/change-password

**摘要**: 修改密码

**请求参数**:

- `Authorization` (header) **[必填]**: string
  - 访问令牌
- `oldPassword` (query) **[必填]**: string
  - 原密码
- `newPassword` (query) **[必填]**: string
  - 新密码

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/auth/login

**摘要**: 用户登录

**请求参数**:

- `request` (body) **[必填]**: LoginRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«LoginResponse»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/auth/logout

**摘要**: 用户登出

**请求参数**:

- `Authorization` (header) **[必填]**: string
  - 访问令牌

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/auth/me

**摘要**: 获取当前用户信息

**请求参数**:

- `Authorization` (header) **[必填]**: string
  - 访问令牌

**响应**:

- `200`: OK - 返回类型: `ApiResponse«UserDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/auth/platform-login

**摘要**: 平台管理员登录

**请求参数**:

- `request` (body) **[必填]**: PlatformLoginRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PlatformLoginResponse»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/auth/refresh

**摘要**: 刷新令牌

**请求参数**:

- `request` (body) **[必填]**: 刷新令牌请求
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«LoginResponse»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/auth/register

**摘要**: 用户注册

**请求参数**:

- `request` (body) **[必填]**: RegisterRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«RegisterResponse»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/auth/reset-password

**摘要**: 重置密码

**请求参数**:

- `factoryId` (query) **[必填]**: string
  - 工厂ID
- `username` (query) **[必填]**: string
  - 用户名
- `newPassword` (query) **[必填]**: string
  - 新密码

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/auth/send-code

**摘要**: 发送手机验证码

**请求参数**:

- `request` (body) **[必填]**: 发送验证码请求
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/auth/validate

**摘要**: 验证令牌

**请求参数**:

- `Authorization` (header) **[必填]**: string
  - 访问令牌

**响应**:

- `200`: OK - 返回类型: `ApiResponse«boolean»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/auth/verify-phone

**摘要**: 验证手机号并获取临时令牌

**请求参数**:

- `request` (body) **[必填]**: VerifyPhoneRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«VerifyPhoneResponse»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


### 产品类型管理

**说明**: Product Type Controller

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/{factoryId}/products/types` | 获取产品类型列表 |
| `POST` | `/api/mobile/{factoryId}/products/types` | 创建产品类型 |
| `GET` | `/api/mobile/{factoryId}/products/types/active` | 获取激活的产品类型 |
| `PUT` | `/api/mobile/{factoryId}/products/types/batch/status` | 批量更新状态 |
| `GET` | `/api/mobile/{factoryId}/products/types/categories` | 获取产品类别列表 |
| `GET` | `/api/mobile/{factoryId}/products/types/category/{category}` | 根据类别获取产品类型 |
| `GET` | `/api/mobile/{factoryId}/products/types/check-code` | 检查产品编码 |
| `POST` | `/api/mobile/{factoryId}/products/types/init-defaults` | 初始化默认产品类型 |
| `GET` | `/api/mobile/{factoryId}/products/types/search` | 搜索产品类型 |
| `GET` | `/api/mobile/{factoryId}/products/types/{id}` | 获取产品类型详情 |
| `PUT` | `/api/mobile/{factoryId}/products/types/{id}` | 更新产品类型 |
| `DELETE` | `/api/mobile/{factoryId}/products/types/{id}` | 删除产品类型 |

<details>
<summary>展开查看 产品类型管理 API详情</summary>

#### GET /api/mobile/{factoryId}/products/types

**摘要**: 获取产品类型列表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«ProductTypeDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/products/types

**摘要**: 创建产品类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `dto` (body) **[可选]**: ProductTypeDTO
  - 产品类型信息

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductTypeDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/products/types/active

**摘要**: 获取激活的产品类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«ProductTypeDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/products/types/batch/status

**摘要**: 批量更新状态

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `isActive` (query) **[可选]**: boolean
  - 激活状态

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/products/types/categories

**摘要**: 获取产品类别列表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«string»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/products/types/category/{category}

**摘要**: 根据类别获取产品类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `category` (path) **[可选]**: string
  - 产品类别

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«ProductTypeDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/products/types/check-code

**摘要**: 检查产品编码

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `code` (query) **[可选]**: string
  - 产品编码
- `excludeId` (query) **[可选]**: integer
  - 排除的产品ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«boolean»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/products/types/init-defaults

**摘要**: 初始化默认产品类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/products/types/search

**摘要**: 搜索产品类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `keyword` (query) **[可选]**: string
  - 搜索关键字
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«ProductTypeDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/products/types/{id}

**摘要**: 获取产品类型详情

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 产品类型ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductTypeDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/products/types/{id}

**摘要**: 更新产品类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 产品类型ID
- `dto` (body) **[可选]**: ProductTypeDTO
  - 产品类型信息

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductTypeDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### DELETE /api/mobile/{factoryId}/products/types/{id}

**摘要**: 删除产品类型

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `id` (path) **[可选]**: integer
  - 产品类型ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `204`: No Content
- `401`: Unauthorized
- `403`: Forbidden

---

</details>


### 用户管理

**说明**: 用户管理相关接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/{factoryId}/users` | 获取用户列表（分页） |
| `POST` | `/api/{factoryId}/users` | 创建用户 |
| `GET` | `/api/{factoryId}/users/check/email` | 检查邮箱是否存在 |
| `GET` | `/api/{factoryId}/users/check/username` | 检查用户名是否存在 |
| `GET` | `/api/{factoryId}/users/export` | 导出用户列表 |
| `POST` | `/api/{factoryId}/users/import` | 批量导入用户 |
| `GET` | `/api/{factoryId}/users/role/{roleCode}` | 按角色获取用户列表 |
| `GET` | `/api/{factoryId}/users/search` | 搜索用户 |
| `GET` | `/api/{factoryId}/users/{userId}` | 获取用户详情 |
| `PUT` | `/api/{factoryId}/users/{userId}` | 更新用户信息 |
| `DELETE` | `/api/{factoryId}/users/{userId}` | 删除用户 |
| `POST` | `/api/{factoryId}/users/{userId}/activate` | 激活用户 |
| `POST` | `/api/{factoryId}/users/{userId}/deactivate` | 停用用户 |
| `PUT` | `/api/{factoryId}/users/{userId}/role` | 更新用户角色 |

<details>
<summary>展开查看 用户管理 API详情</summary>

#### GET /api/{factoryId}/users

**摘要**: 获取用户列表（分页）

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小
- `sortBy` (query) **[可选]**: string
  - 排序字段
- `sortDirection` (query) **[可选]**: string
  - 排序方向 (ASC/DESC)
- `keyword` (query) **[可选]**: string
  - 搜索关键词

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«UserDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/{factoryId}/users

**摘要**: 创建用户

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `request` (body) **[必填]**: CreateUserRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«UserDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/{factoryId}/users/check/email

**摘要**: 检查邮箱是否存在

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `email` (query) **[必填]**: string
  - 邮箱

**响应**:

- `200`: OK - 返回类型: `ApiResponse«boolean»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/{factoryId}/users/check/username

**摘要**: 检查用户名是否存在

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `username` (query) **[必填]**: string
  - 用户名

**响应**:

- `200`: OK - 返回类型: `ApiResponse«boolean»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/{factoryId}/users/export

**摘要**: 导出用户列表

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/{factoryId}/users/import

**摘要**: 批量导入用户

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«UserDTO»»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/{factoryId}/users/role/{roleCode}

**摘要**: 按角色获取用户列表

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `roleCode` (path) **[必填]**: string
  - 角色代码

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«UserDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/{factoryId}/users/search

**摘要**: 搜索用户

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `keyword` (query) **[必填]**: string
  - 搜索关键词
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小
- `sortBy` (query) **[可选]**: string
  - 排序字段
- `sortDirection` (query) **[可选]**: string
  - 排序方向 (ASC/DESC)
- `keyword` (query) **[可选]**: string
  - 搜索关键词

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«UserDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/{factoryId}/users/{userId}

**摘要**: 获取用户详情

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `userId` (path) **[必填]**: integer
  - 用户ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«UserDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/{factoryId}/users/{userId}

**摘要**: 更新用户信息

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `userId` (path) **[必填]**: integer
  - 用户ID
- `request` (body) **[必填]**: CreateUserRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«UserDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### DELETE /api/{factoryId}/users/{userId}

**摘要**: 删除用户

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `userId` (path) **[必填]**: integer
  - 用户ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `204`: No Content
- `401`: Unauthorized
- `403`: Forbidden

---

#### POST /api/{factoryId}/users/{userId}/activate

**摘要**: 激活用户

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `userId` (path) **[必填]**: integer
  - 用户ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/{factoryId}/users/{userId}/deactivate

**摘要**: 停用用户

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `userId` (path) **[必填]**: integer
  - 用户ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/{factoryId}/users/{userId}/role

**摘要**: 更新用户角色

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `userId` (path) **[必填]**: integer
  - 用户ID
- `newRole` (query) **[必填]**: string
  - 新角色

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


### 报表统计管理

**说明**: Report Controller

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/{factoryId}/reports/anomalies` | 获取异常报告 |
| `GET` | `/api/mobile/{factoryId}/reports/cost-analysis` | 获取成本分析报表 |
| `POST` | `/api/mobile/{factoryId}/reports/custom` | 获取自定义报表 |
| `GET` | `/api/mobile/{factoryId}/reports/dashboard` | 获取仪表盘统计 |
| `GET` | `/api/mobile/{factoryId}/reports/efficiency-analysis` | 获取效率分析报表 |
| `GET` | `/api/mobile/{factoryId}/reports/equipment` | 获取设备报表 |
| `GET` | `/api/mobile/{factoryId}/reports/export/excel` | 导出Excel报表 |
| `GET` | `/api/mobile/{factoryId}/reports/export/pdf` | 导出PDF报表 |
| `GET` | `/api/mobile/{factoryId}/reports/finance` | 获取财务报表 |
| `GET` | `/api/mobile/{factoryId}/reports/forecast` | 获取预测报表 |
| `GET` | `/api/mobile/{factoryId}/reports/inventory` | 获取库存报表 |
| `GET` | `/api/mobile/{factoryId}/reports/kpi` | 获取KPI指标 |
| `GET` | `/api/mobile/{factoryId}/reports/period-comparison` | 获取周期对比报表 |
| `GET` | `/api/mobile/{factoryId}/reports/personnel` | 获取人员报表 |
| `GET` | `/api/mobile/{factoryId}/reports/production` | 获取生产报表 |
| `GET` | `/api/mobile/{factoryId}/reports/quality` | 获取质量报表 |
| `GET` | `/api/mobile/{factoryId}/reports/realtime` | 获取实时数据 |
| `GET` | `/api/mobile/{factoryId}/reports/sales` | 获取销售报表 |
| `GET` | `/api/mobile/{factoryId}/reports/trend-analysis` | 获取趋势分析报表 |

<details>
<summary>展开查看 报表统计管理 API详情</summary>

#### GET /api/mobile/{factoryId}/reports/anomalies

**摘要**: 获取异常报告

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/cost-analysis

**摘要**: 获取成本分析报表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/reports/custom

**摘要**: 获取自定义报表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/dashboard

**摘要**: 获取仪表盘统计

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«DashboardStatisticsDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/efficiency-analysis

**摘要**: 获取效率分析报表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/equipment

**摘要**: 获取设备报表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `date` (query) **[可选]**: string
  - 报表日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/export/excel

**摘要**: 导出Excel报表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `reportType` (query) **[可选]**: string
  - 报表类型
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/export/pdf

**摘要**: 导出PDF报表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `reportType` (query) **[可选]**: string
  - 报表类型
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/finance

**摘要**: 获取财务报表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/forecast

**摘要**: 获取预测报表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `type` (query) **[可选]**: string
  - 预测类型
- `days` (query) **[可选]**: integer
  - 预测天数

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/inventory

**摘要**: 获取库存报表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `date` (query) **[可选]**: string
  - 报表日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/kpi

**摘要**: 获取KPI指标

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `date` (query) **[可选]**: string
  - 指标日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/period-comparison

**摘要**: 获取周期对比报表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `period1Start` (query) **[可选]**: string
  - 期间1开始日期
- `period1End` (query) **[可选]**: string
  - 期间1结束日期
- `period2Start` (query) **[可选]**: string
  - 期间2开始日期
- `period2End` (query) **[可选]**: string
  - 期间2结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/personnel

**摘要**: 获取人员报表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `date` (query) **[可选]**: string
  - 报表日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/production

**摘要**: 获取生产报表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/quality

**摘要**: 获取质量报表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/realtime

**摘要**: 获取实时数据

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/sales

**摘要**: 获取销售报表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `startDate` (query) **[可选]**: string
  - 开始日期
- `endDate` (query) **[可选]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/reports/trend-analysis

**摘要**: 获取趋势分析报表

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `type` (query) **[可选]**: string
  - 分析类型
- `period` (query) **[可选]**: integer
  - 时间周期(天)

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


### 生产计划管理

**说明**: 生产计划管理相关接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/{factoryId}/production-plans` | 获取生产计划列表（分页） |
| `POST` | `/api/mobile/{factoryId}/production-plans` | 创建生产计划 |
| `POST` | `/api/mobile/{factoryId}/production-plans/batch` | 批量创建生产计划 |
| `GET` | `/api/mobile/{factoryId}/production-plans/date-range` | 按日期范围获取生产计划 |
| `GET` | `/api/mobile/{factoryId}/production-plans/export` | 导出生产计划 |
| `GET` | `/api/mobile/{factoryId}/production-plans/pending-execution` | 获取待执行的计划 |
| `GET` | `/api/mobile/{factoryId}/production-plans/statistics` | 获取生产统计 |
| `GET` | `/api/mobile/{factoryId}/production-plans/status/{status}` | 按状态获取生产计划 |
| `GET` | `/api/mobile/{factoryId}/production-plans/today` | 获取今日生产计划 |
| `GET` | `/api/mobile/{factoryId}/production-plans/{planId}` | 获取生产计划详情 |
| `PUT` | `/api/mobile/{factoryId}/production-plans/{planId}` | 更新生产计划 |
| `DELETE` | `/api/mobile/{factoryId}/production-plans/{planId}` | 删除生产计划 |
| `POST` | `/api/mobile/{factoryId}/production-plans/{planId}/batches` | 分配原材料批次 |
| `POST` | `/api/mobile/{factoryId}/production-plans/{planId}/cancel` | 取消生产计划 |
| `POST` | `/api/mobile/{factoryId}/production-plans/{planId}/complete` | 完成生产 |
| `POST` | `/api/mobile/{factoryId}/production-plans/{planId}/consumption` | 记录材料消耗 |
| `PUT` | `/api/mobile/{factoryId}/production-plans/{planId}/costs` | 更新实际成本 |
| `POST` | `/api/mobile/{factoryId}/production-plans/{planId}/pause` | 暂停生产 |
| `POST` | `/api/mobile/{factoryId}/production-plans/{planId}/resume` | 恢复生产 |
| `POST` | `/api/mobile/{factoryId}/production-plans/{planId}/start` | 开始生产 |

<details>
<summary>展开查看 生产计划管理 API详情</summary>

#### GET /api/mobile/{factoryId}/production-plans

**摘要**: 获取生产计划列表（分页）

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小
- `sortBy` (query) **[可选]**: string
  - 排序字段
- `sortDirection` (query) **[可选]**: string
  - 排序方向 (ASC/DESC)
- `keyword` (query) **[可选]**: string
  - 搜索关键词

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«ProductionPlanDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/production-plans

**摘要**: 创建生产计划

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `Authorization` (header) **[必填]**: string
  - 访问令牌
- `request` (body) **[必填]**: CreateProductionPlanRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionPlanDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/production-plans/batch

**摘要**: 批量创建生产计划

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `Authorization` (header) **[必填]**: string
  - 访问令牌

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«ProductionPlanDTO»»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/production-plans/date-range

**摘要**: 按日期范围获取生产计划

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `startDate` (query) **[必填]**: string
  - 开始日期
- `endDate` (query) **[必填]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«ProductionPlanDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/production-plans/export

**摘要**: 导出生产计划

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `startDate` (query) **[必填]**: string
  - 开始日期
- `endDate` (query) **[必填]**: string
  - 结束日期

**响应**:

- `200`: OK
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/production-plans/pending-execution

**摘要**: 获取待执行的计划

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«ProductionPlanDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/production-plans/statistics

**摘要**: 获取生产统计

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `startDate` (query) **[必填]**: string
  - 开始日期
- `endDate` (query) **[必填]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/production-plans/status/{status}

**摘要**: 按状态获取生产计划

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `status` (path) **[必填]**: string
  - 状态

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«ProductionPlanDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/production-plans/today

**摘要**: 获取今日生产计划

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«ProductionPlanDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/production-plans/{planId}

**摘要**: 获取生产计划详情

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `planId` (path) **[必填]**: integer
  - 计划ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionPlanDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/production-plans/{planId}

**摘要**: 更新生产计划

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `planId` (path) **[必填]**: integer
  - 计划ID
- `request` (body) **[必填]**: CreateProductionPlanRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionPlanDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### DELETE /api/mobile/{factoryId}/production-plans/{planId}

**摘要**: 删除生产计划

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `planId` (path) **[必填]**: integer
  - 计划ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `204`: No Content
- `401`: Unauthorized
- `403`: Forbidden

---

#### POST /api/mobile/{factoryId}/production-plans/{planId}/batches

**摘要**: 分配原材料批次

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `planId` (path) **[必填]**: integer
  - 计划ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/production-plans/{planId}/cancel

**摘要**: 取消生产计划

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `planId` (path) **[必填]**: integer
  - 计划ID
- `reason` (query) **[必填]**: string
  - 取消原因

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/production-plans/{planId}/complete

**摘要**: 完成生产

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `planId` (path) **[必填]**: integer
  - 计划ID
- `actualQuantity` (query) **[必填]**: number
  - 实际产量

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionPlanDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/production-plans/{planId}/consumption

**摘要**: 记录材料消耗

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `planId` (path) **[必填]**: integer
  - 计划ID
- `batchId` (query) **[必填]**: integer
  - 批次ID
- `quantity` (query) **[必填]**: number
  - 消耗数量

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/production-plans/{planId}/costs

**摘要**: 更新实际成本

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `planId` (path) **[必填]**: integer
  - 计划ID
- `materialCost` (query) **[可选]**: number
  - 材料成本
- `laborCost` (query) **[可选]**: number
  - 人工成本
- `equipmentCost` (query) **[可选]**: number
  - 设备成本
- `otherCost` (query) **[可选]**: number
  - 其他成本

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionPlanDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/production-plans/{planId}/pause

**摘要**: 暂停生产

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `planId` (path) **[必填]**: integer
  - 计划ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionPlanDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/production-plans/{planId}/resume

**摘要**: 恢复生产

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `planId` (path) **[必填]**: integer
  - 计划ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionPlanDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/production-plans/{planId}/start

**摘要**: 开始生产

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `planId` (path) **[必填]**: integer
  - 计划ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ProductionPlanDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


### 设备管理

**说明**: 设备管理相关接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/{factoryId}/equipment` | 获取设备列表（分页） |
| `POST` | `/api/mobile/{factoryId}/equipment` | 创建设备 |
| `GET` | `/api/mobile/{factoryId}/equipment/expiring-warranty` | 获取保修即将到期的设备 |
| `GET` | `/api/mobile/{factoryId}/equipment/export` | 导出设备列表 |
| `POST` | `/api/mobile/{factoryId}/equipment/import` | 批量导入设备 |
| `GET` | `/api/mobile/{factoryId}/equipment/needing-maintenance` | 获取需要维护的设备 |
| `GET` | `/api/mobile/{factoryId}/equipment/overall-statistics` | 获取工厂设备总体统计 |
| `GET` | `/api/mobile/{factoryId}/equipment/search` | 搜索设备 |
| `GET` | `/api/mobile/{factoryId}/equipment/status/{status}` | 按状态获取设备 |
| `GET` | `/api/mobile/{factoryId}/equipment/type/{type}` | 按类型获取设备 |
| `GET` | `/api/mobile/{factoryId}/equipment/{equipmentId}` | 获取设备详情 |
| `PUT` | `/api/mobile/{factoryId}/equipment/{equipmentId}` | 更新设备 |
| `DELETE` | `/api/mobile/{factoryId}/equipment/{equipmentId}` | 删除设备 |
| `GET` | `/api/mobile/{factoryId}/equipment/{equipmentId}/depreciated-value` | 计算设备折旧后价值 |
| `GET` | `/api/mobile/{factoryId}/equipment/{equipmentId}/efficiency-report` | 获取设备效率报告 |
| `POST` | `/api/mobile/{factoryId}/equipment/{equipmentId}/maintenance` | 记录设备维护 |
| `GET` | `/api/mobile/{factoryId}/equipment/{equipmentId}/maintenance-history` | 获取设备维护历史 |
| `GET` | `/api/mobile/{factoryId}/equipment/{equipmentId}/oee` | 计算设备OEE |
| `POST` | `/api/mobile/{factoryId}/equipment/{equipmentId}/scrap` | 报废设备 |
| `POST` | `/api/mobile/{factoryId}/equipment/{equipmentId}/start` | 启动设备 |
| `GET` | `/api/mobile/{factoryId}/equipment/{equipmentId}/statistics` | 获取设备统计信息 |
| `PUT` | `/api/mobile/{factoryId}/equipment/{equipmentId}/status` | 更新设备状态 |
| `POST` | `/api/mobile/{factoryId}/equipment/{equipmentId}/stop` | 停止设备 |
| `GET` | `/api/mobile/{factoryId}/equipment/{equipmentId}/usage-history` | 获取设备使用历史 |

<details>
<summary>展开查看 设备管理 API详情</summary>

#### GET /api/mobile/{factoryId}/equipment

**摘要**: 获取设备列表（分页）

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `page` (query) **[可选]**: integer
  - 页码
- `size` (query) **[可选]**: integer
  - 每页大小
- `sortBy` (query) **[可选]**: string
  - 排序字段
- `sortDirection` (query) **[可选]**: string
  - 排序方向 (ASC/DESC)
- `keyword` (query) **[可选]**: string
  - 搜索关键词

**响应**:

- `200`: OK - 返回类型: `ApiResponse«PageResponse«EquipmentDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/equipment

**摘要**: 创建设备

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `Authorization` (header) **[必填]**: string
  - 访问令牌
- `request` (body) **[必填]**: CreateEquipmentRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«EquipmentDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/equipment/expiring-warranty

**摘要**: 获取保修即将到期的设备

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `daysAhead` (query) **[必填]**: integer
  - 提前天数

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«EquipmentDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/equipment/export

**摘要**: 导出设备列表

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/equipment/import

**摘要**: 批量导入设备

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `Authorization` (header) **[必填]**: string
  - 访问令牌

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«EquipmentDTO»»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/equipment/needing-maintenance

**摘要**: 获取需要维护的设备

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«EquipmentDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/equipment/overall-statistics

**摘要**: 获取工厂设备总体统计

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/equipment/search

**摘要**: 搜索设备

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `keyword` (query) **[必填]**: string
  - 搜索关键词

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«EquipmentDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/equipment/status/{status}

**摘要**: 按状态获取设备

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `status` (path) **[必填]**: string
  - 设备状态(idle/running/maintenance/scrapped)

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«EquipmentDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/equipment/type/{type}

**摘要**: 按类型获取设备

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `type` (path) **[必填]**: string
  - 设备类型

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«EquipmentDTO»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/equipment/{equipmentId}

**摘要**: 获取设备详情

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `equipmentId` (path) **[必填]**: integer
  - 设备ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«EquipmentDTO»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/equipment/{equipmentId}

**摘要**: 更新设备

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `equipmentId` (path) **[必填]**: integer
  - 设备ID
- `request` (body) **[必填]**: CreateEquipmentRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«EquipmentDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### DELETE /api/mobile/{factoryId}/equipment/{equipmentId}

**摘要**: 删除设备

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `equipmentId` (path) **[必填]**: integer
  - 设备ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `204`: No Content
- `401`: Unauthorized
- `403`: Forbidden

---

#### GET /api/mobile/{factoryId}/equipment/{equipmentId}/depreciated-value

**摘要**: 计算设备折旧后价值

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `equipmentId` (path) **[必填]**: integer
  - 设备ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«bigdecimal»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/equipment/{equipmentId}/efficiency-report

**摘要**: 获取设备效率报告

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `equipmentId` (path) **[必填]**: integer
  - 设备ID
- `startDate` (query) **[必填]**: string
  - 开始日期
- `endDate` (query) **[必填]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/equipment/{equipmentId}/maintenance

**摘要**: 记录设备维护

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `equipmentId` (path) **[必填]**: integer
  - 设备ID
- `maintenanceDate` (query) **[必填]**: string
  - 维护日期
- `cost` (query) **[可选]**: number
  - 维护费用
- `description` (query) **[可选]**: string
  - 维护描述

**响应**:

- `200`: OK - 返回类型: `ApiResponse«EquipmentDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/equipment/{equipmentId}/maintenance-history

**摘要**: 获取设备维护历史

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `equipmentId` (path) **[必填]**: integer
  - 设备ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«Map«string,object»»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/equipment/{equipmentId}/oee

**摘要**: 计算设备OEE

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `equipmentId` (path) **[必填]**: integer
  - 设备ID
- `startDate` (query) **[必填]**: string
  - 开始日期
- `endDate` (query) **[必填]**: string
  - 结束日期

**响应**:

- `200`: OK - 返回类型: `ApiResponse«double»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/equipment/{equipmentId}/scrap

**摘要**: 报废设备

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `equipmentId` (path) **[必填]**: integer
  - 设备ID
- `reason` (query) **[必填]**: string
  - 报废原因

**响应**:

- `200`: OK - 返回类型: `ApiResponse«EquipmentDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/equipment/{equipmentId}/start

**摘要**: 启动设备

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `equipmentId` (path) **[必填]**: integer
  - 设备ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«EquipmentDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/equipment/{equipmentId}/statistics

**摘要**: 获取设备统计信息

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `equipmentId` (path) **[必填]**: integer
  - 设备ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### PUT /api/mobile/{factoryId}/equipment/{equipmentId}/status

**摘要**: 更新设备状态

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `equipmentId` (path) **[必填]**: integer
  - 设备ID
- `status` (query) **[必填]**: string
  - 设备状态

**响应**:

- `200`: OK - 返回类型: `ApiResponse«EquipmentDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/{factoryId}/equipment/{equipmentId}/stop

**摘要**: 停止设备

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `equipmentId` (path) **[必填]**: integer
  - 设备ID
- `runningHours` (query) **[可选]**: integer
  - 运行小时数

**响应**:

- `200`: OK - 返回类型: `ApiResponse«EquipmentDTO»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/{factoryId}/equipment/{equipmentId}/usage-history

**摘要**: 获取设备使用历史

**请求参数**:

- `factoryId` (path) **[必填]**: string
  - 工厂ID
- `equipmentId` (path) **[必填]**: integer
  - 设备ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«Map«string,object»»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


### 测试接口

**说明**: Test Controller

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/test/encode-password` | 生成BCrypt密码哈希 |
| `GET` | `/api/test/verify-password` | 验证BCrypt密码 |

<details>
<summary>展开查看 测试接口 API详情</summary>

#### GET /api/test/encode-password

**摘要**: 生成BCrypt密码哈希

**请求参数**:

- `password` (query) **[必填]**: string
  - password

**响应**:

- `200`: OK
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/test/verify-password

**摘要**: 验证BCrypt密码

**请求参数**:

- `rawPassword` (query) **[必填]**: string
  - rawPassword
- `encodedPassword` (query) **[必填]**: string
  - encodedPassword

**响应**:

- `200`: OK
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


### 移动端接口

**说明**: 移动端专用接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/mobile/activation/activate` | 设备激活 |
| `POST` | `/api/mobile/auth/logout` | 用户登出 |
| `POST` | `/api/mobile/auth/refresh` | 刷新访问令牌 |
| `POST` | `/api/mobile/auth/register-phase-one` | 移动端注册-第一阶段（验证手机号） |
| `POST` | `/api/mobile/auth/register-phase-two` | 移动端注册-第二阶段（创建账户） |
| `POST` | `/api/mobile/auth/send-code` | 发送验证码 |
| `POST` | `/api/mobile/auth/unified-login` | 统一登录接口 |
| `POST` | `/api/mobile/auth/verify-code` | 验证手机验证码 |
| `GET` | `/api/mobile/config/{factoryId}` | 获取移动端配置 |
| `GET` | `/api/mobile/dashboard/{factoryId}` | 获取仪表盘数据 |
| `GET` | `/api/mobile/devices` | 获取用户设备列表 |
| `DELETE` | `/api/mobile/devices/{deviceId}` | 移除设备 |
| `GET` | `/api/mobile/health` | 健康检查 |
| `GET` | `/api/mobile/offline/{factoryId}` | 获取离线数据包 |
| `POST` | `/api/mobile/push/register` | 注册推送通知 |
| `DELETE` | `/api/mobile/push/unregister` | 取消推送通知注册 |
| `POST` | `/api/mobile/report/crash` | 上报崩溃日志 |
| `POST` | `/api/mobile/report/performance` | 上报性能数据 |
| `POST` | `/api/mobile/sync/{factoryId}` | 数据同步 |
| `POST` | `/api/mobile/upload` | 移动端文件上传 |
| `GET` | `/api/mobile/version/check` | 检查应用版本 |

<details>
<summary>展开查看 移动端接口 API详情</summary>

#### POST /api/mobile/activation/activate

**摘要**: 设备激活

**请求参数**:

- `request` (body) **[必填]**: ActivationRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«ActivationResponse»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/auth/logout

**摘要**: 用户登出

**请求参数**:

- `deviceId` (query) **[可选]**: string
  - 设备ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/auth/refresh

**摘要**: 刷新访问令牌

**请求参数**:

- `refreshToken` (query) **[可选]**: string
  - 刷新令牌

**响应**:

- `200`: OK - 返回类型: `ApiResponse«LoginResponse»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/auth/register-phase-one

**摘要**: 移动端注册-第一阶段（验证手机号）

**请求参数**:

- `request` (body) **[必填]**: RegisterPhaseOneRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«RegisterPhaseOneResponse»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/auth/register-phase-two

**摘要**: 移动端注册-第二阶段（创建账户）

**请求参数**:

- `request` (body) **[必填]**: RegisterPhaseTwoRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«RegisterPhaseTwoResponse»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/auth/send-code

**摘要**: 发送验证码

**请求参数**:

- `phoneNumber` (query) **[可选]**: string
  - 手机号

**响应**:

- `200`: OK - 返回类型: `ApiResponse«boolean»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/auth/unified-login

**摘要**: 统一登录接口

**请求参数**:

- `request` (body) **[必填]**: LoginRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«LoginResponse»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/auth/verify-code

**摘要**: 验证手机验证码

**请求参数**:

- `phoneNumber` (query) **[可选]**: string
  - 手机号
- `code` (query) **[可选]**: string
  - 验证码

**响应**:

- `200`: OK - 返回类型: `ApiResponse«boolean»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/config/{factoryId}

**摘要**: 获取移动端配置

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `platform` (query) **[可选]**: string
  - 平台

**响应**:

- `200`: OK - 返回类型: `ApiResponse«object»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/dashboard/{factoryId}

**摘要**: 获取仪表盘数据

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«DashboardData»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/devices

**摘要**: 获取用户设备列表

**响应**:

- `200`: OK - 返回类型: `ApiResponse«List«DeviceInfo»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### DELETE /api/mobile/devices/{deviceId}

**摘要**: 移除设备

**请求参数**:

- `deviceId` (path) **[可选]**: string
  - 设备ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `204`: No Content
- `401`: Unauthorized
- `403`: Forbidden

---

#### GET /api/mobile/health

**摘要**: 健康检查

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Map«string,object»»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/offline/{factoryId}

**摘要**: 获取离线数据包

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID

**响应**:

- `200`: OK - 返回类型: `ApiResponse«OfflineDataPackage»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/push/register

**摘要**: 注册推送通知

**请求参数**:

- `registration` (body) **[必填]**: PushRegistration
  - registration

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### DELETE /api/mobile/push/unregister

**摘要**: 取消推送通知注册

**请求参数**:

- `deviceToken` (query) **[可选]**: string
  - 设备令牌

**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `204`: No Content
- `401`: Unauthorized
- `403`: Forbidden

---

#### POST /api/mobile/report/crash

**摘要**: 上报崩溃日志

**请求参数**:


**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/report/performance

**摘要**: 上报性能数据

**请求参数**:


**响应**:

- `200`: OK - 返回类型: `ApiResponse«Void»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/sync/{factoryId}

**摘要**: 数据同步

**请求参数**:

- `factoryId` (path) **[可选]**: string
  - 工厂ID
- `request` (body) **[必填]**: SyncRequest
  - request

**响应**:

- `200`: OK - 返回类型: `ApiResponse«SyncResponse»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### POST /api/mobile/upload

**摘要**: 移动端文件上传

**请求参数**:

- `files` (query) **[必填]**: array
  - files
- `category` (query) **[可选]**: string
  - 文件分类
- `metadata` (query) **[可选]**: string
  - 元数据

**响应**:

- `200`: OK - 返回类型: `ApiResponse«UploadResponse»`
- `201`: Created
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

#### GET /api/mobile/version/check

**摘要**: 检查应用版本

**请求参数**:

- `currentVersion` (query) **[可选]**: string
  - 当前版本
- `platform` (query) **[可选]**: string
  - 平台

**响应**:

- `200`: OK - 返回类型: `ApiResponse«VersionCheckResponse»`
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found

---

</details>


---

## 附录

### 使用说明

1. **认证**: 大部分API需要在请求头中包含 `Authorization: Bearer <token>`
2. **Content-Type**: POST/PUT请求通常需要设置 `Content-Type: application/json`
3. **分页**: 支持分页的API通常接受 `page` 和 `size` 参数
4. **错误处理**: 所有API返回统一的错误格式

### 相关文档

- [移动端API专用指南](./mobile-api-guide.md)
- [API数据模型字典](./api-models.md)
- [项目开发指南](../../CLAUDE.md)

---

**文档维护**: 该文档基于Swagger API文档自动生成
**Swagger地址**: http://47.251.121.76:10010/swagger-ui.html
