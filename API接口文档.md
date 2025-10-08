# Cretas 食品溯源系统 - API接口文档（完整版）

**服务地址**: `http://localhost:3001`
**数据库**: MySQL 8.0.42
**认证方式**: JWT Token (放在 Header: `Authorization: Bearer <token>`)

**接口总数**: **约 200 个**
- 移动端接口：150+ 个
- 工厂用户接口：23 个
- 平台管理接口：30 个

---

## 📱 移动端基础接口 (`/api/mobile`)

### 1. 登录注册

#### 1.1 统一登录（推荐）
```
POST /api/mobile/auth/unified-login
```
**请求**:
```json
{
  "username": "用户名",
  "password": "密码",
  "deviceInfo": {
    "deviceId": "设备ID",
    "deviceModel": "设备型号",
    "platform": "android/ios"
  }
}
```

#### 1.2 发送验证码
```
POST /api/mobile/auth/send-verification
```

#### 1.3 注册第一步 - 手机验证
```
POST /api/mobile/auth/register-phase-one
```

#### 1.4 注册第二步 - 完整信息
```
POST /api/mobile/auth/register-phase-two
```

#### 1.5 刷新Token
```
POST /api/mobile/auth/refresh-token
```

#### 1.6 登出
```
POST /api/mobile/auth/logout
```

#### 1.7 获取用户信息
```
GET /api/mobile/auth/profile
```

---

### 2. 设备管理

#### 2.1 绑定设备
```
POST /api/mobile/auth/bind-device
```

#### 2.2 设备登录
```
POST /api/mobile/auth/device-login
```

#### 2.3 查询绑定设备列表
```
GET /api/mobile/auth/devices
```

---

### 3. 应用激活

#### 3.1 激活应用
```
POST /api/mobile/activation/activate
```

#### 3.2 验证激活状态
```
POST /api/mobile/activation/validate
```

---

### 4. 文件上传

#### 4.1 移动端文件上传
```
POST /api/mobile/upload/mobile
```
**支持**: JPG, PNG, WebP，最大10MB

---

### 5. AI分析

#### 5.1 DeepSeek智能分析
```
POST /api/mobile/analysis/deepseek
```

---

### 6. 权限管理

#### 6.1 批量权限检查
```
POST /api/mobile/permissions/batch-check
```

---

### 7. 健康检查
```
GET /api/mobile/health
```

---

## 🏭 加工模块接口 (`/api/mobile/processing`)

**所有接口需要认证**

### 1. 原材料管理

#### 1.1 创建原材料接收记录
```
POST /api/mobile/processing/material-receipt
```

#### 1.2 获取原材料列表
```
GET /api/mobile/processing/materials
```

#### 1.3 更新原材料信息
```
PUT /api/mobile/processing/material-receipt/:batchId
```

---

### 2. 批次管理（CRUD）

#### 2.1 创建新批次
```
POST /api/mobile/processing/batches
```

#### 2.2 获取批次列表（支持分页、过滤）
```
GET /api/mobile/processing/batches
```
**查询参数**: `page`, `limit`, `status`, `startDate`, `endDate`

#### 2.3 获取批次详情
```
GET /api/mobile/processing/batches/:id
```

#### 2.4 更新批次信息
```
PUT /api/mobile/processing/batches/:id
```

#### 2.5 删除批次
```
DELETE /api/mobile/processing/batches/:id
```

---

### 3. 生产流程控制

#### 3.1 开始生产
```
POST /api/mobile/processing/batches/:id/start
```

#### 3.2 完成生产
```
POST /api/mobile/processing/batches/:id/complete
```

#### 3.3 暂停生产
```
POST /api/mobile/processing/batches/:id/pause
```

#### 3.4 获取批次时间线
```
GET /api/mobile/processing/batches/:id/timeline
```

---

### 4. 员工工作时段管理

#### 4.1 员工上班打卡
```
POST /api/mobile/processing/work-session/clock-in
```
**请求**:
```json
{
  "workType": "工作类型",
  "location": "打卡位置（可选）"
}
```

#### 4.2 员工下班打卡
```
POST /api/mobile/processing/work-session/clock-out
```

#### 4.3 获取工作时段列表
```
GET /api/mobile/processing/work-sessions
```

#### 4.4 获取当前活动工作时段
```
GET /api/mobile/processing/work-session/active
```

---

### 5. 设备使用管理

#### 5.1 开始设备使用
```
POST /api/mobile/processing/equipment-usage/start
```

#### 5.2 结束设备使用
```
POST /api/mobile/processing/equipment-usage/end
```

#### 5.3 获取设备使用记录
```
GET /api/mobile/processing/equipment-usage
```

#### 5.4 记录设备维修
```
POST /api/mobile/processing/equipment-maintenance
```

---

### 6. 成本分析

#### 6.1 获取批次成本分析
```
GET /api/mobile/processing/batches/:batchId/cost-analysis
```

#### 6.2 重新计算批次成本
```
POST /api/mobile/processing/batches/:batchId/recalculate-cost
```

#### 6.3 AI成本分析（DeepSeek）
```
POST /api/mobile/processing/ai-cost-analysis
```

---

### 7. 质检管理

#### 7.1 提交质检记录
```
POST /api/mobile/processing/quality/inspections
```

#### 7.2 获取质检记录列表
```
GET /api/mobile/processing/quality/inspections
```

#### 7.3 获取质检详情
```
GET /api/mobile/processing/quality/inspections/:id
```

#### 7.4 更新质检结果
```
PUT /api/mobile/processing/quality/inspections/:id
```

#### 7.5 质检统计数据
```
GET /api/mobile/processing/quality/statistics
```

#### 7.6 质量趋势分析
```
GET /api/mobile/processing/quality/trends
```

---

### 8. 设备监控

#### 8.1 获取设备实时状态列表
```
GET /api/mobile/processing/equipment/monitoring
```

#### 8.2 获取设备指标历史数据
```
GET /api/mobile/processing/equipment/:id/metrics
```

#### 8.3 上报设备监控数据
```
POST /api/mobile/processing/equipment/:id/data
```

#### 8.4 获取设备告警列表
```
GET /api/mobile/processing/equipment/alerts
```

#### 8.5 获取单个设备状态
```
GET /api/mobile/processing/equipment/:id/status
```

---

### 9. 仪表板数据

#### 9.1 生产概览
```
GET /api/mobile/processing/dashboard/overview
```

#### 9.2 生产统计（今日/本周/本月）
```
GET /api/mobile/processing/dashboard/production
```

#### 9.3 质量统计和趋势
```
GET /api/mobile/processing/dashboard/quality
```

#### 9.4 设备状态统计
```
GET /api/mobile/processing/dashboard/equipment
```

#### 9.5 告警统计和分布
```
GET /api/mobile/processing/dashboard/alerts
```

#### 9.6 关键指标趋势分析
```
GET /api/mobile/processing/dashboard/trends
```

---

### 10. 告警管理

#### 10.1 获取告警列表（支持分页、过滤、排序）
```
GET /api/mobile/processing/alerts
```

#### 10.2 确认告警
```
POST /api/mobile/processing/alerts/:id/acknowledge
```

#### 10.3 解决告警
```
POST /api/mobile/processing/alerts/:id/resolve
```

#### 10.4 告警统计数据
```
GET /api/mobile/processing/alerts/statistics
```

#### 10.5 告警摘要（按严重级别）
```
GET /api/mobile/processing/alerts/summary
```

---

## ⏰ 打卡模块接口 (`/api/mobile/timeclock`)

**所有接口需要认证**

### 1. 打卡操作

#### 1.1 上班打卡
```
POST /api/mobile/timeclock/clock-in
```
**请求**:
```json
{
  "workTypeId": "工作类型ID",
  "location": "打卡位置（可选）"
}
```

#### 1.2 下班打卡
```
POST /api/mobile/timeclock/clock-out
```

#### 1.3 开始休息
```
POST /api/mobile/timeclock/break-start
```

#### 1.4 结束休息
```
POST /api/mobile/timeclock/break-end
```

---

### 2. 打卡查询

#### 2.1 获取当前打卡状态
```
GET /api/mobile/timeclock/status
```

#### 2.2 获取打卡历史记录
```
GET /api/mobile/timeclock/history
```
**查询参数**: `startDate`, `endDate`, `page`, `limit`

---

## 📊 时间统计接口 (`/api/mobile/time-stats`)

**所有接口需要认证**

#### 1. 每日统计
```
GET /api/mobile/time-stats/daily
```
**查询参数**: `date` (默认今天)

#### 2. 每周统计
```
GET /api/mobile/time-stats/weekly
```

#### 3. 每月统计
```
GET /api/mobile/time-stats/monthly
```

#### 4. 按工作类型统计
```
GET /api/mobile/time-stats/by-type
```

#### 5. 生产力分析
```
GET /api/mobile/time-stats/productivity
```

---

## 🔧 工作类型管理 (`/api/mobile/work-types`)

**所有接口需要认证**

#### 1. 获取工作类型列表
```
GET /api/mobile/work-types
```

#### 2. 创建工作类型
```
POST /api/mobile/work-types
```

#### 3. 获取单个工作类型
```
GET /api/mobile/work-types/:id
```

#### 4. 更新工作类型
```
PUT /api/mobile/work-types/:id
```

#### 5. 删除工作类型
```
DELETE /api/mobile/work-types/:id
```

#### 6. 初始化默认工作类型
```
GET /api/mobile/work-types/init-defaults
```

---

## 🏭 生产计划管理系统

### 📦 原料类型管理 (`/api/mobile/materials`)

**所有接口需要认证**

#### 1. 获取原料类型列表
```
GET /api/mobile/materials/types
```

#### 2. 创建原料类型
```
POST /api/mobile/materials/types
```
**请求**:
```json
{
  "name": "原料名称",
  "category": "原料分类",
  "unit": "单位（如：kg, 箱）",
  "description": "描述（可选）"
}
```

---

### 🍖 产品类型管理 (`/api/mobile/products`)

**所有接口需要认证**

#### 1. 获取产品类型列表
```
GET /api/mobile/products/types
```

#### 2. 获取产品类型详情
```
GET /api/mobile/products/types/:id
```

#### 3. 创建产品类型
```
POST /api/mobile/products/types
```
**请求**:
```json
{
  "name": "产品名称",
  "category": "产品分类",
  "unit": "单位（如：kg, 箱）",
  "description": "描述（可选）"
}
```

#### 4. 更新产品类型
```
PUT /api/mobile/products/types/:id
```

#### 5. 删除产品类型
```
DELETE /api/mobile/products/types/:id
```

---

### 🔄 转换率管理 (`/api/mobile/conversions`)

**所有接口需要认证**

#### 1. 获取转换率列表
```
GET /api/mobile/conversions
```

#### 2. 获取转换率矩阵
```
GET /api/mobile/conversions/matrix
```

#### 3. 创建/更新转换率
```
POST /api/mobile/conversions
```
**请求**:
```json
{
  "materialTypeId": 1,
  "productTypeId": 1,
  "conversionRate": 0.75,
  "description": "转换率说明（可选）"
}
```

#### 4. 删除转换率
```
DELETE /api/mobile/conversions/:id
```

#### 5. 预估原料用量
```
POST /api/mobile/conversions/estimate
```
**请求**:
```json
{
  "productTypeId": 1,
  "targetQuantity": 100
}
```

---

### 🏢 供应商管理 (`/api/mobile/suppliers`)

**所有接口需要认证**

#### 1. 获取供应商列表
```
GET /api/mobile/suppliers
```

#### 2. 获取供应商详情
```
GET /api/mobile/suppliers/:id
```

#### 3. 获取供应商统计信息
```
GET /api/mobile/suppliers/:id/stats
```

#### 4. 创建供应商
```
POST /api/mobile/suppliers
```
**请求**:
```json
{
  "name": "供应商名称",
  "contactPerson": "联系人",
  "contactPhone": "联系电话",
  "address": "地址（可选）",
  "email": "邮箱（可选）"
}
```

#### 5. 更新供应商
```
PUT /api/mobile/suppliers/:id
```

#### 6. 删除供应商（软删除）
```
DELETE /api/mobile/suppliers/:id
```

---

### 👥 客户管理 (`/api/mobile/customers`)

**所有接口需要认证**

#### 1. 获取客户列表
```
GET /api/mobile/customers
```

#### 2. 获取客户详情
```
GET /api/mobile/customers/:id
```

#### 3. 获取客户统计信息
```
GET /api/mobile/customers/:id/stats
```

#### 4. 创建客户
```
POST /api/mobile/customers
```
**请求**:
```json
{
  "name": "客户名称",
  "contactPerson": "联系人",
  "contactPhone": "联系电话",
  "address": "地址（可选）",
  "email": "邮箱（可选）"
}
```

#### 5. 更新客户
```
PUT /api/mobile/customers/:id
```

#### 6. 删除客户（软删除）
```
DELETE /api/mobile/customers/:id
```

---

### 📊 原材料批次管理 (`/api/mobile/material-batches`)

**所有接口需要认证**

#### 1. 创建批次（入库）
```
POST /api/mobile/material-batches
```
**请求**:
```json
{
  "materialTypeId": 1,
  "supplierId": 1,
  "quantity": 100,
  "unit": "kg",
  "expirationDate": "2024-12-31",
  "purchasePrice": 50.00,
  "notes": "备注（可选）"
}
```

#### 2. 获取批次列表
```
GET /api/mobile/material-batches
```
**查询参数**: `page`, `limit`, `status`, `materialTypeId`

#### 3. 获取可用批次（含智能推荐）
```
GET /api/mobile/material-batches/available
```
**查询参数**: `materialTypeId` (必需)

#### 4. 获取即将过期的批次
```
GET /api/mobile/material-batches/expiring
```
**查询参数**: `days` (默认30天内)

#### 5. 获取库存汇总
```
GET /api/mobile/material-batches/summary
```

#### 6. 获取批次详情
```
GET /api/mobile/material-batches/:id
```

#### 7. 预留批次
```
POST /api/mobile/material-batches/reserve
```
**请求**:
```json
{
  "batchId": 1,
  "quantity": 10,
  "productionPlanId": 1
}
```

#### 8. 释放批次
```
POST /api/mobile/material-batches/release
```

#### 9. 消耗批次
```
POST /api/mobile/material-batches/consume
```

---

### 📅 生产计划管理 (`/api/mobile/production-plans`)

**所有接口需要认证**

#### 1. 获取生产计划列表
```
GET /api/mobile/production-plans
```
**查询参数**: `page`, `limit`, `status`, `startDate`, `endDate`

#### 2. 获取可用库存
```
GET /api/mobile/production-plans/available-stock
```

#### 3. 获取生产计划详情
```
GET /api/mobile/production-plans/:id
```

#### 4. 创建生产计划
```
POST /api/mobile/production-plans
```
**请求**:
```json
{
  "productTypeId": 1,
  "customerId": 1,
  "targetQuantity": 100,
  "plannedDate": "2024-12-01",
  "notes": "备注（可选）"
}
```

#### 5. 更新生产计划
```
PUT /api/mobile/production-plans/:id
```

#### 6. 开始生产
```
POST /api/mobile/production-plans/:id/start
```

#### 7. 完成生产
```
POST /api/mobile/production-plans/:id/complete
```
**请求**:
```json
{
  "actualQuantity": 98,
  "notes": "生产完成备注"
}
```

#### 8. 记录原料消耗
```
POST /api/mobile/production-plans/:id/consume-material
```
**请求**:
```json
{
  "materialBatchId": 1,
  "quantity": 75
}
```

#### 9. 记录成品出库
```
POST /api/mobile/production-plans/:id/ship
```
**请求**:
```json
{
  "quantity": 50,
  "destination": "客户地址",
  "notes": "出库备注"
}
```

#### 10. 获取出库记录列表
```
GET /api/mobile/production-plans/shipments/list
```

---

### ⚙️ 工厂设置管理 (`/api/mobile/factory-settings`)

**所有接口需要工厂超级管理员权限**

#### 1. 获取AI设置
```
GET /api/mobile/factory-settings/ai
```
**返回**:
```json
{
  "settings": {
    "enabled": true,
    "tone": "professional",
    "goal": "cost_optimization",
    "detailLevel": "standard",
    "industryStandards": {
      "laborCostPercentage": 30,
      "equipmentUtilization": 80,
      "profitMargin": 20
    },
    "customPrompt": ""
  },
  "weeklyQuota": 20,
  "quotaEditable": false
}
```

#### 2. 更新AI设置
```
PUT /api/mobile/factory-settings/ai
```
**请求**:
```json
{
  "enabled": true,
  "tone": "professional",
  "goal": "cost_optimization",
  "detailLevel": "standard",
  "industryStandards": {
    "laborCostPercentage": 30,
    "equipmentUtilization": 80,
    "profitMargin": 20
  },
  "customPrompt": "自定义提示词（可选）"
}
```
**注意**: 不能修改 `weeklyQuota`（由平台管理员统一设置）

#### 3. 获取AI使用统计
```
GET /api/mobile/factory-settings/ai/usage-stats
```
**查询参数**: `period` (默认 `week`，可选 `all`)
**返回**:
```json
{
  "period": "2024-W40",
  "totalCalls": 15,
  "byType": {
    "analysis": 10,
    "question": 5
  },
  "byUser": {
    "张三": 8,
    "李四": 7
  },
  "recentLogs": []
}
```

---

### 👨‍🔧 员工管理 (`/api/mobile`)

**所有接口需要认证**

#### 1. 获取员工列表
```
GET /api/mobile/employees
```

---

## 📄 报表模块接口 (`/api/mobile/reports`)

**所有接口需要认证**

### 1. 报表模板管理

#### 1.1 获取报表模板列表
```
GET /api/mobile/reports/templates
```

#### 1.2 创建自定义报表模板
```
POST /api/mobile/reports/templates
```

---

### 2. 报表生成

#### 2.1 生成Excel报表
```
POST /api/mobile/reports/generate/excel
```
**请求**:
```json
{
  "templateId": "模板ID",
  "startDate": "开始日期",
  "endDate": "结束日期",
  "filters": {}
}
```

#### 2.2 生成PDF报表
```
POST /api/mobile/reports/generate/pdf
```

---

### 3. 报表下载

#### 3.1 下载报表文件
```
GET /api/mobile/reports/download/:filename
```

---

## 🖥️ 系统监控接口 (`/api/mobile/system`)

### 1. 系统健康检查（无需认证）
```
GET /api/mobile/system/health
```

**以下接口需要认证**

### 2. 系统日志管理

#### 2.1 记录系统日志
```
POST /api/mobile/system/logs
```

#### 2.2 获取系统日志列表
```
GET /api/mobile/system/logs
```

#### 2.3 获取API访问日志
```
GET /api/mobile/system/api-logs
```

---

### 3. 系统监控

#### 3.1 系统性能监控
```
GET /api/mobile/system/performance
```
**返回**: CPU、内存、磁盘使用率等

#### 3.2 系统统计概览
```
GET /api/mobile/system/statistics
```

---

### 4. 系统维护（需要管理员权限）

#### 4.1 清理过期日志
```
POST /api/mobile/system/cleanup-logs
```

---

## 🎫 激活码管理接口 (`/api/mobile/activation`)

### 1. 无需认证的接口

已在上面"移动端基础接口 → 3. 应用激活"部分

---

### 2. 需要认证的接口（管理员功能）

#### 2.1 生成激活码
```
POST /api/mobile/activation/generate
```
**需要管理员权限**

#### 2.2 查询激活记录
```
GET /api/mobile/activation/records
```

#### 2.3 获取激活统计
```
GET /api/mobile/activation/statistics
```

#### 2.4 更新激活码状态
```
PUT /api/mobile/activation/codes/:id/status
```

---

## 🏢 工厂用户接口 (`/api`)

### 1. 认证接口

#### 1.1 手机号验证
```
POST /api/auth/verify-phone
```
**请求**:
```json
{
  "phoneNumber": "+8613800000000"
}
```

#### 1.2 用户注册
```
POST /api/auth/register
```
**请求**:
```json
{
  "phoneNumber": "+8613800000000",
  "username": "user123",
  "password": "secure_password",
  "fullName": "张三",
  "department": "生产部"
}
```

#### 1.3 工厂用户登录
```
POST /api/auth/login
```
**请求**:
```json
{
  "factoryId": "工厂ID",
  "username": "用户名",
  "password": "密码"
}
```

#### 1.4 平台管理员登录
```
POST /api/auth/platform-login
```
**请求**:
```json
{
  "username": "platform_admin",
  "password": "Admin@123456"
}
```

#### 1.5 刷新令牌
```
POST /api/auth/refresh
```
**请求**:
```json
{
  "refreshToken": "refresh_token_here"
}
```

#### 1.6 获取当前用户信息
```
GET /api/auth/me
```

#### 1.7 修改密码
```
PUT /api/auth/password
```
**请求**:
```json
{
  "oldPassword": "旧密码",
  "newPassword": "新密码"
}
```

#### 1.8 登出
```
POST /api/auth/logout
```

#### 1.9 认证状态检查
```
GET /api/auth/status
```

---

### 2. 白名单管理

**所有接口需要管理员权限**

#### 2.1 添加白名单
```
POST /api/whitelist
```
**请求**:
```json
{
  "phoneNumbers": ["+8613800000001", "+8613800000002"],
  "expiresInDays": 30,
  "notes": "备注"
}
```

#### 2.2 获取白名单列表
```
GET /api/whitelist
```
**查询参数**: `page`, `limit`, `status`

#### 2.3 获取白名单统计
```
GET /api/whitelist/stats
```

#### 2.4 更新过期白名单
```
PUT /api/whitelist/expired
```

#### 2.5 批量删除白名单
```
DELETE /api/whitelist/batch
```
**请求**:
```json
{
  "ids": [1, 2, 3]
}
```

#### 2.6 更新白名单状态
```
PUT /api/whitelist/:id
```

#### 2.7 删除白名单记录
```
DELETE /api/whitelist/:id
```

---

### 3. 用户管理

**需要权限管理员或工厂超管权限**

#### 3.1 获取用户列表
```
GET /api/users
```
**查询参数**: `page`, `limit`, `department`, `role`

#### 3.2 获取待审核用户
```
GET /api/users/pending
```

#### 3.3 激活用户
```
PUT /api/users/:id/activate
```

#### 3.4 分配角色
```
PUT /api/users/:id/role
```
**请求**:
```json
{
  "roleCode": "department_admin",
  "department": "生产部"
}
```

#### 3.5 删除用户
```
DELETE /api/users/:id
```

#### 3.6 获取部门用户
```
GET /api/users/department/:department
```

#### 3.7 用户统计信息
```
GET /api/users/stats
```

---

### 4. 平台管理接口

**所有接口需要平台管理员权限**

#### 4.1 平台概览
```
GET /api/platform/overview
```

#### 4.2 获取所有工厂列表
```
GET /api/platform/factories
```
**查询参数**: `page`, `limit`, `status`, `search`

#### 4.3 获取工厂详情
```
GET /api/platform/factories/:id
```

#### 4.4 创建工厂
```
POST /api/platform/factories
```
**请求**:
```json
{
  "name": "工厂名称",
  "code": "FACTORY_001",
  "industry": "食品加工",
  "region": "华东"
}
```

#### 4.5 更新工厂信息
```
PUT /api/platform/factories/:id
```

#### 4.6 暂停工厂
```
PUT /api/platform/factories/:id/suspend
```

#### 4.7 激活工厂
```
PUT /api/platform/factories/:id/activate
```

#### 4.8 切换工厂状态
```
PUT /api/platform/factories/:id/status
```

#### 4.9 删除工厂
```
DELETE /api/platform/factories/:id
```

---

### 5. 平台员工管理

#### 5.1 获取工厂员工列表
```
GET /api/platform/factories/:factoryId/employees
```

#### 5.2 更新员工状态
```
PUT /api/platform/factories/:factoryId/employees/:employeeId/status
```

#### 5.3 删除员工
```
DELETE /api/platform/factories/:factoryId/employees/:employeeId
```

---

### 6. 平台白名单管理

#### 6.1 获取平台白名单列表
```
GET /api/platform/whitelists
```

#### 6.2 批量导入白名单
```
POST /api/platform/whitelists/batch-import
```

#### 6.3 更新白名单状态
```
PUT /api/platform/whitelists/:whitelistId/status
```

#### 6.4 删除白名单记录
```
DELETE /api/platform/whitelists/:whitelistId
```

#### 6.5 批量删除白名单
```
POST /api/platform/whitelists/batch-delete
```

#### 6.6 清理过期白名单
```
POST /api/platform/whitelists/cleanup-expired
```

---

### 7. 平台AI配额管理

#### 7.1 获取所有工厂AI配额
```
GET /api/platform/ai-quota
```

#### 7.2 更新工厂AI配额
```
PUT /api/platform/ai-quota/:factoryId
```
**请求**:
```json
{
  "weeklyQuota": 50
}
```

#### 7.3 获取平台AI使用统计
```
GET /api/platform/ai-usage-stats
```

---

### 8. 平台数据导出

#### 8.1 导出工厂数据
```
GET /api/platform/export/factories
```

#### 8.2 导出用户数据
```
GET /api/platform/export/users
```

#### 8.3 导出概览数据
```
GET /api/platform/export/overview
```

#### 8.4 导出操作日志
```
GET /api/platform/export/logs
```

---

### 9. 平台日志审计

#### 9.1 获取操作日志
```
GET /api/platform/logs
```
**查询参数**: `page`, `limit`, `action`, `factoryId`, `startDate`, `endDate`

#### 9.2 获取审计日志
```
GET /api/platform/audit-logs
```

---

### 10. 平台系统管理

#### 10.1 平台统计分析
```
GET /api/platform/analytics
```

#### 10.2 设置维护模式
```
PUT /api/platform/maintenance
```
**请求**:
```json
{
  "enabled": true,
  "message": "系统维护中，预计2小时后恢复"
}
```

#### 10.3 发送全平台通知
```
POST /api/platform/notifications
```
**请求**:
```json
{
  "title": "通知标题",
  "content": "通知内容",
  "targetFactories": ["FACTORY_001", "FACTORY_002"],
  "priority": "high"
}
```

---

## 🔑 角色权限说明

### 平台角色
- `developer` - 系统开发者（最高权限）
- `platform_admin` - 平台管理员

### 工厂角色（按权限从高到低）
- `factory_super_admin` - 工厂超级管理员
- `permission_admin` - 权限管理员
- `department_admin` - 部门管理员
- `operator` - 操作员
- `viewer` - 查看者
- `unactivated` - 未激活

---

## 📋 测试账号

### 平台管理员
- 用户名: `platform_admin`
- 密码: `Admin@123456`

### 工厂超级管理员
- 用户名: `factory_admin`
- 密码: `SuperAdmin@123`
- 工厂ID: `TEST_2024_001`

### 部门管理员
- 养殖: `farming_admin` / `DeptAdmin@123`
- 加工: `processing_admin` / `DeptAdmin@123`
- 物流: `logistics_admin` / `DeptAdmin@123`

### 激活码
- `DEV_TEST_2024`
- `CRETAS_MOBILE_2024`
- `PROD_ACTIVATION`

---

## ❌ 错误代码说明

| 错误码 | 说明 |
|-------|------|
| `VALIDATION_ERROR` | 数据验证失败 |
| `AUTHENTICATION_ERROR` | 认证失败 |
| `AUTHORIZATION_ERROR` | 权限不足 |
| `NOT_FOUND_ERROR` | 资源不存在 |
| `CONFLICT_ERROR` | 数据冲突 |
| `DATABASE_ERROR` | 数据库操作失败 |

### 错误响应格式
```json
{
  "success": false,
  "message": "错误描述",
  "code": "错误代码",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 🚀 快速开始

### 1. 移动端登录流程（推荐）
```
1. POST /api/mobile/auth/unified-login
   → 获取 token 和 refreshToken
   → 系统自动识别平台用户或工厂用户
2. 后续请求带上 Header: Authorization: Bearer <token>
3. Token过期时用 POST /api/mobile/auth/refresh-token 刷新
```

**统一登录示例**:
```bash
curl -X POST http://localhost:3001/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "processing_admin",
    "password": "DeptAdmin@123",
    "deviceInfo": {
      "deviceId": "TEST_DEVICE_001",
      "deviceModel": "Test Device",
      "platform": "android"
    }
  }'
```

### 2. 新用户注册流程
```
1. POST /api/mobile/auth/register-phase-one
   → 验证手机号并获取 tempToken
2. POST /api/mobile/auth/register-phase-two
   → 用 tempToken 完成注册
3. POST /api/mobile/auth/unified-login
   → 登录获取正式 token
```

### 3. 应用激活流程
```
1. POST /api/mobile/activation/activate
   → 用激活码激活应用
2. POST /api/mobile/activation/validate
   → 验证激活状态（可选）
```

### 4. 生产计划完整流程（新功能）
```
1. 创建原料类型和产品类型
   POST /api/mobile/materials/types
   POST /api/mobile/products/types

2. 配置转换率
   POST /api/mobile/conversions

3. 创建供应商和客户
   POST /api/mobile/suppliers
   POST /api/mobile/customers

4. 原料入库
   POST /api/mobile/material-batches

5. 创建生产计划
   POST /api/mobile/production-plans

6. 开始生产 → 记录消耗 → 完成生产 → 成品出库
   POST /api/mobile/production-plans/:id/start
   POST /api/mobile/production-plans/:id/consume-material
   POST /api/mobile/production-plans/:id/complete
   POST /api/mobile/production-plans/:id/ship
```

---

## 📊 接口统计概览

| 模块 | 接口数量 | 路由前缀 |
|------|---------|----------|
| **移动端接口** |||
| 移动端基础（登录、设备、权限） | 20个 | `/api/mobile/auth/*`, `/api/mobile/permissions/*` |
| 加工模块（批次、质检、设备、仪表板） | 50个 | `/api/mobile/processing/*` |
| 打卡模块 | 6个 | `/api/mobile/timeclock/*` |
| 时间统计 | 5个 | `/api/mobile/time-stats/*` |
| 工作类型管理 | 6个 | `/api/mobile/work-types/*` |
| 原料类型管理 | 2个 | `/api/mobile/materials/types` |
| 产品类型管理 | 5个 | `/api/mobile/products/types` |
| 转换率管理 | 5个 | `/api/mobile/conversions/*` |
| 供应商管理 | 6个 | `/api/mobile/suppliers/*` |
| 客户管理 | 6个 | `/api/mobile/customers/*` |
| 原材料批次管理 | 9个 | `/api/mobile/material-batches/*` |
| 生产计划管理 | 10个 | `/api/mobile/production-plans/*` |
| 工厂AI设置管理 | 3个 | `/api/mobile/factory-settings/ai/*` |
| 员工管理 | 1个 | `/api/mobile/employees` |
| 报表模块 | 5个 | `/api/mobile/reports/*` |
| 系统监控 | 7个 | `/api/mobile/system/*` |
| 激活码管理 | 6个 | `/api/mobile/activation/*` |
| **工厂用户接口** |||
| 认证接口 | 9个 | `/api/auth/*` |
| 白名单管理 | 7个 | `/api/whitelist/*` |
| 用户管理 | 7个 | `/api/users/*` |
| **平台管理接口** |||
| 平台管理 | 9个 | `/api/platform/factories/*` |
| 平台员工管理 | 3个 | `/api/platform/factories/:id/employees/*` |
| 平台白名单管理 | 6个 | `/api/platform/whitelists/*` |
| 平台AI配额管理 | 3个 | `/api/platform/ai-quota/*` |
| 平台数据导出 | 4个 | `/api/platform/export/*` |
| 平台日志审计 | 2个 | `/api/platform/logs/*` |
| 平台系统管理 | 3个 | `/api/platform/*` |
| **总计** | **约 200 个** ||

---

---

## 📱 React Native 开发指南

### 环境配置
- **Backend API**: `http://localhost:3001` (开发环境)
- **React Native Dev Server**: `http://localhost:3010` (Expo/Metro)
- **Android Emulator访问**: 使用 `http://10.0.2.2:3001` 访问本地后端

### API 调用建议

#### 1. 认证 Token 管理
```typescript
// 使用 Zustand 存储 token
import { useAuthStore } from '@/store/authStore';

const authStore = useAuthStore();
await authStore.login(username, password, deviceInfo);

// 所有 API 请求自动携带 token
const response = await apiClient.get('/api/mobile/processing/batches');
```

#### 2. 错误处理
```typescript
try {
  const response = await apiClient.post('/api/mobile/processing/batches', data);
} catch (error) {
  if (error.code === 'AUTHENTICATION_ERROR') {
    // 重新登录
    await authStore.refreshToken();
  } else if (error.code === 'AUTHORIZATION_ERROR') {
    // 权限不足提示
    showToast('权限不足');
  }
}
```

#### 3. 权限检查
```typescript
// 批量权限检查
const checkResult = await apiClient.post('/api/mobile/permissions/batch-check', {
  permissionChecks: [
    { type: 'permission', values: ['processing:batch:create'], operator: 'OR' },
    { type: 'role', values: ['factory_super_admin', 'department_admin'] }
  ]
});

if (checkResult.data.hasAccess) {
  // 显示创建按钮
}
```

#### 4. 文件上传（移动端优化）
```typescript
import * as ImagePicker from 'expo-image-picker';

const result = await ImagePicker.launchCameraAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  quality: 0.8, // 压缩质量
});

if (!result.canceled) {
  const formData = new FormData();
  formData.append('files', {
    uri: result.assets[0].uri,
    type: 'image/jpeg',
    name: 'photo.jpg',
  });

  await apiClient.post('/api/mobile/upload/mobile', formData);
}
```

#### 5. DeepSeek AI 分析
```typescript
// AI成本分析（含限流保护）
const aiAnalysis = await apiClient.post('/api/mobile/processing/ai-cost-analysis', {
  batchId: 123,
  analysisType: 'cost_optimization'
});

console.log('AI分析结果:', aiAnalysis.data.analysis);
console.log('成本:', aiAnalysis.data.cost); // 单位：元
```

### 开发注意事项

#### 🔒 安全性
- 所有敏感数据使用 `expo-secure-store` 存储
- Token 自动刷新机制（过期前5分钟自动刷新）
- 设备绑定确保账号安全

#### 📡 网络优化
- 使用请求缓存减少网络请求
- 批量操作接口（如批量权限检查）
- 分页查询避免大数据量加载

#### 🎨 用户体验
- 离线数据缓存和同步
- 加载状态和错误提示
- 权限不足时的友好提示

#### 💰 成本控制（DeepSeek AI）
- 启用智能缓存（5分钟缓存相似查询）
- 月度成本限制（默认 ¥30）
- 实时成本监控和告警

---

**最后更新**: 2025-10-07
**API版本**: v1.2
**文档状态**: ✅ 完整版（含生产计划管理系统 + 平台管理系统）

---

## 📝 更新日志

### v1.2 (2025-10-07)
**新增内容**:
- ✅ 完善工厂AI设置管理接口（3个接口）
- ✅ 新增工厂用户认证接口（9个接口）
- ✅ 新增白名单管理接口（7个接口）
- ✅ 新增用户管理接口（7个接口）
- ✅ 新增平台管理接口（30个接口）
  - 平台概览和工厂管理
  - 平台员工管理
  - 平台白名单管理
  - 平台AI配额管理
  - 平台数据导出
  - 平台日志审计
  - 平台系统管理
- ✅ 接口总数更新：160+ → 200个
- ✅ 新增接口统计概览表（含路由前缀）
- ✅ 新增 React Native 开发指南

### v1.1 (2025-10-07)
**新增内容**:
- ✅ 生产计划管理系统（8个模块，约46个接口）
  - 原料类型管理
  - 产品类型管理
  - 转换率管理
  - 供应商管理
  - 客户管理
  - 原材料批次管理
  - 生产计划管理
  - 员工管理
- ✅ 生产计划完整流程指南
- ✅ 品牌更新：白垩纪 → Cretas

### v1.0 (2025-10-05)
**初始版本**:
- 移动端基础接口
- 加工模块
- 打卡模块
- 时间统计
- 工作类型管理
- 报表模块
- 系统监控
- 激活码管理
