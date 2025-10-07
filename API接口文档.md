# 白垩纪食品溯源系统 - API接口文档（完整版）

**服务地址**: `http://localhost:3001`
**数据库**: MySQL 8.0.42
**认证方式**: JWT Token (放在 Header: `Authorization: Bearer <token>`)

**接口总数**: 约 **120+ 个**

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

### 1. 认证

#### 1.1 工厂用户登录
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

#### 1.2 平台管理员登录
```
POST /api/auth/platform-login
```

#### 1.3 修改密码
```
PUT /api/auth/password
```

#### 1.4 获取当前用户信息
```
GET /api/auth/user
```

#### 1.5 登出
```
POST /api/auth/logout
```

#### 1.6 认证状态检查
```
GET /api/auth/status
```

---

### 2. 白名单管理

#### 2.1 获取白名单列表
```
GET /api/whitelist
```

#### 2.2 添加白名单
```
POST /api/whitelist
```

#### 2.3 删除白名单
```
DELETE /api/whitelist/:id
```

---

### 3. 用户管理

#### 3.1 获取用户列表
```
GET /api/users
```

#### 3.2 获取待激活用户
```
GET /api/users/pending
```

#### 3.3 激活用户
```
PUT /api/users/:id/activate
```

#### 3.4 更新用户信息
```
PUT /api/users/:id
```

#### 3.5 重置用户密码
```
PUT /api/users/:id/reset-password
```

---

### 4. 平台管理

#### 4.1 获取工厂列表
```
GET /api/platform/factories
```

#### 4.2 创建工厂
```
POST /api/platform/factories
```

#### 4.3 创建工厂超级管理员
```
POST /api/platform/factories/:factoryId/admin
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
- `HEINIU_MOBILE_2024`
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

### 1. 移动端登录流程
```
1. POST /api/mobile/auth/unified-login
   → 获取 token 和 refreshToken
2. 后续请求带上 Header: Authorization: Bearer <token>
3. Token过期时用 POST /api/mobile/auth/refresh-token 刷新
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

---

## 📊 接口统计概览

| 模块 | 接口数量 |
|------|---------|
| 移动端基础（登录、设备、权限） | 15个 |
| 加工模块（批次、质检、设备、仪表板） | 50+个 |
| 打卡模块 | 6个 |
| 时间统计 | 5个 |
| 工作类型管理 | 6个 |
| 报表模块 | 5个 |
| 系统监控 | 7个 |
| 激活码管理 | 6个 |
| 工厂用户（认证、白名单、用户、平台） | 20+个 |
| **总计** | **约 120+ 个** |

---

**最后更新**: 2025-10-05
**API版本**: v1.0
**文档状态**: ✅ 完整版
