# 白垩纪食品溯源系统 - API完整参考手册

> **版本**: v2.0
> **生成日期**: 2025-11-20
> **后端框架**: Spring Boot 2.7.15 + Java 11
> **总计**: 25个Controller | 577个API端点

---

## 📑 目录

1. [API概览](#1-api概览)
2. [认证与移动端API](#2-认证与移动端api-mobilecontroller)
3. [生产加工API](#3-生产加工api-processingcontroller)
4. [AI智能分析API](#4-ai智能分析api-aicontroller)
5. [用户管理API](#5-用户管理api-usercontroller)
6. [考勤打卡API](#6-考勤打卡api-timeclockcontroller)
7. [原材料批次API](#7-原材料批次api-materialbatchcontroller)
8. [设备管理API](#8-设备管理api-equipmentcontroller)
9. [质量检验API](#9-质量检验api-qualityinspectioncontroller)
10. [平台管理API](#10-平台管理api-platformcontroller)
11. [其他Controller](#11-其他controller)
12. [错误码参考](#12-错误码参考)
13. [请求示例](#13-请求示例)

---

## 1. API概览

### 1.1 Controller统计

| Controller | 代码行数 | API数量 | 主要功能 | 路径前缀 |
|-----------|---------|---------|---------|----------|
| **MobileController** | 603 | 30+ | 认证、仪表盘、文件上传、设备管理 | `/api/mobile` |
| **ProcessingController** | 577 | 35+ | 批次管理、质检、成本分析 | `/api/mobile/{factoryId}/processing` |
| **AIController** | 409 | 11 | AI成本分析、配额管理 | `/api/mobile/{factoryId}/ai` |
| **MaterialBatchController** | 463 | 18 | 原材料批次管理 | `/api/mobile/{factoryId}/material-batches` |
| **EquipmentController** | 502 | 15 | 设备管理、告警 | `/api/mobile/{factoryId}/equipment` |
| **UserController** | 314 | 14 | 用户CRUD、导入导出 | `/api/mobile/{factoryId}/users` |
| **PlatformController** | 217 | 9 | 工厂管理、AI配额 | `/api/platform` |
| **TimeClockController** | 216 | 8 | 打卡、考勤统计 | `/api/mobile/{factoryId}/timeclock` |
| **QualityInspectionController** | 107 | 4 | 质检记录管理 | `/api/mobile/{factoryId}/quality-inspections` |
| **其他16个Controller** | - | 433+ | 参考数据、报表、配置 | 各自路径 |

### 1.2 认证机制

所有API（除公开端点）都需要JWT认证：

```http
Authorization: Bearer {accessToken}
```

**公开端点** (无需Token):
- `POST /api/mobile/auth/unified-login` - 统一登录
- `POST /api/mobile/auth/refresh` - 刷新Token
- `POST /api/mobile/auth/register-phase-one` - 注册第一阶段
- `POST /api/mobile/auth/register-phase-two` - 注册第二阶段
- `POST /api/mobile/auth/send-verification-code` - 发送验证码
- `POST /api/mobile/auth/forgot-password` - 忘记密码

### 1.3 响应格式

#### 成功响应
```json
{
  "code": 200,
  "message": "成功",
  "data": {
    // 业务数据
  },
  "timestamp": "2025-11-20T14:30:55"
}
```

#### 分页响应
```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "content": [...],           // 当前页数据
    "totalElements": 100,       // 总记录数
    "totalPages": 10,           // 总页数
    "pageNumber": 0,            // 当前页码 (从0开始)
    "pageSize": 10,             // 每页大小
    "first": true,              // 是否第一页
    "last": false               // 是否最后一页
  }
}
```

#### 错误响应
```json
{
  "code": 400,
  "message": "参数错误: 批次号不能为空",
  "error": "BAD_REQUEST",
  "timestamp": "2025-11-20T14:30:55",
  "path": "/api/mobile/F001/processing/batches"
}
```

---

## 2. 认证与移动端API (MobileController)

**路径前缀**: `/api/mobile`
**文件**: `MobileController.java` (603行)

### 2.1 认证相关

#### 统一登录
```http
POST /api/mobile/auth/unified-login
```

**请求体**:
```json
{
  "username": "admin",
  "password": "Admin@123456",
  "deviceId": "UUID-xxx-xxx",
  "deviceInfo": {
    "model": "iPhone 13",
    "os": "iOS 16.0"
  }
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "fullName": "系统管理员",
      "roleCode": "super_admin",
      "factoryId": null
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 1800
    },
    "userType": "platform"  // "platform" | "factory"
  }
}
```

**权限**: 公开接口

---

#### 刷新Token
```http
POST /api/mobile/auth/refresh
```

**请求头**:
```http
Authorization: Bearer {refreshToken}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 1800
  }
}
```

**权限**: 公开接口

---

#### 获取当前用户信息
```http
GET /api/mobile/auth/me
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "id": 1,
    "username": "admin",
    "fullName": "系统管理员",
    "phone": "13800138000",
    "department": "管理部",
    "position": "总经理",
    "roleCode": "factory_super_admin",
    "factoryId": "F-SH-2024-001",
    "monthlySalary": 15000.00,
    "isActive": true
  }
}
```

**权限**: 任何已登录用户

---

#### 修改密码
```http
POST /api/mobile/auth/change-password
```

**请求体**:
```json
{
  "oldPassword": "Admin@123456",
  "newPassword": "NewPass@123456"
}
```

**权限**: 任何已登录用户

---

#### 登出
```http
POST /api/mobile/auth/logout
```

**响应**:
```json
{
  "code": 200,
  "message": "登出成功"
}
```

**权限**: 任何已登录用户

---

### 2.2 注册相关

#### 注册第一阶段（手机验证）
```http
POST /api/mobile/auth/register-phase-one
```

**请求体**:
```json
{
  "phone": "13800138000",
  "verificationCode": "123456"
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "tempToken": "temp-token-xxx",
    "phone": "13800138000",
    "expiresIn": 600  // 10分钟
  }
}
```

**权限**: 公开接口

---

#### 注册第二阶段（创建账户）
```http
POST /api/mobile/auth/register-phase-two
```

**请求头**:
```http
Authorization: Bearer {tempToken}
```

**请求体**:
```json
{
  "username": "newuser",
  "password": "Pass@123456",
  "fullName": "张三",
  "factoryId": "F-SH-2024-001"
}
```

**响应**: 与统一登录相同

**权限**: 需要tempToken

---

### 2.3 忘记密码

#### 发送验证码
```http
POST /api/mobile/auth/send-verification-code
```

**请求体**:
```json
{
  "phone": "13800138000"
}
```

**权限**: 公开接口

---

#### 验证重置码
```http
POST /api/mobile/auth/verify-reset-code
```

**请求体**:
```json
{
  "phone": "13800138000",
  "code": "123456"
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "resetToken": "reset-token-xxx",
    "expiresIn": 600
  }
}
```

**权限**: 公开接口

---

#### 重置密码
```http
POST /api/mobile/auth/forgot-password
```

**请求体**:
```json
{
  "phone": "13800138000",
  "resetToken": "reset-token-xxx",
  "newPassword": "NewPass@123456"
}
```

**权限**: 需要resetToken

---

### 2.4 设备管理

#### 激活设备
```http
POST /api/mobile/activation/activate
```

**请求体**:
```json
{
  "activationCode": "ACT-XXXX-XXXX-XXXX",
  "deviceId": "UUID-xxx-xxx",
  "deviceInfo": {
    "model": "iPhone 13",
    "os": "iOS 16.0"
  }
}
```

**权限**: 任何已登录用户

---

#### 获取用户设备列表
```http
GET /api/mobile/devices
```

**响应**:
```json
{
  "code": 200,
  "data": [
    {
      "id": "dev-001",
      "deviceId": "UUID-xxx-xxx",
      "deviceModel": "iPhone 13",
      "os": "iOS 16.0",
      "lastActiveAt": "2025-11-20T14:30:55",
      "isActive": true
    }
  ]
}
```

**权限**: 任何已登录用户

---

#### 移除设备
```http
DELETE /api/mobile/devices/{deviceId}
```

**权限**: 任何已登录用户

---

### 2.5 仪表盘与数据同步

#### 获取移动端仪表盘
```http
GET /api/mobile/dashboard/{factoryId}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "todayOutput": 1500.5,
    "completedBatches": 12,
    "ongoingBatches": 3,
    "todayAttendance": 45,
    "pendingQualityChecks": 2,
    "lowStockMaterials": 5,
    "activeAlerts": 3,
    "aiQuotaRemaining": 15
  }
}
```

**权限**: `factory_super_admin`, `factory_admin`, `department_admin`

---

#### 数据同步
```http
POST /api/mobile/sync/{factoryId}
```

**请求体**:
```json
{
  "lastSyncTime": "2025-11-20T10:00:00",
  "localChanges": [
    {
      "entity": "TimeClockRecord",
      "action": "CREATE",
      "data": {...}
    }
  ]
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "serverChanges": [...],
    "syncTime": "2025-11-20T14:30:55"
  }
}
```

**权限**: 任何工厂用户

---

#### 获取离线数据包
```http
GET /api/mobile/offline/{factoryId}
```

**查询参数**:
- `dataTypes`: 数据类型列表（逗号分隔）
  - `batches` - 批次数据
  - `materials` - 原材料数据
  - `users` - 用户数据
  - `equipment` - 设备数据

**示例**:
```http
GET /api/mobile/offline/F001?dataTypes=batches,materials,users
```

**响应**: 包含所有请求数据的JSON包

**权限**: 任何工厂用户

---

### 2.6 文件上传

#### 移动端文件上传
```http
POST /api/mobile/upload
Content-Type: multipart/form-data
```

**请求体**:
```
file: (binary)
type: "batch_photo" | "quality_photo" | "avatar"
factoryId: "F-SH-2024-001"
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "url": "https://cdn.example.com/uploads/xxx.jpg",
    "filename": "batch_photo_20251120_143055.jpg",
    "size": 245678,
    "mimeType": "image/jpeg"
  }
}
```

**权限**: 任何已登录用户

---

### 2.7 推送通知

#### 注册推送通知
```http
POST /api/mobile/push/register
```

**请求体**:
```json
{
  "deviceToken": "ExponentPushToken[xxx]",
  "platform": "ios"  // "ios" | "android"
}
```

**权限**: 任何已登录用户

---

#### 取消推送注册
```http
DELETE /api/mobile/push/unregister
```

**权限**: 任何已登录用户

---

### 2.8 版本管理

#### 检查应用版本
```http
GET /api/mobile/version/check
```

**查询参数**:
- `currentVersion`: 当前应用版本号
- `platform`: `ios` | `android`

**响应**:
```json
{
  "code": 200,
  "data": {
    "latestVersion": "1.2.0",
    "updateRequired": false,
    "updateUrl": "https://example.com/app.apk",
    "releaseNotes": "修复若干bug"
  }
}
```

**权限**: 公开接口

---

### 2.9 配置管理

#### 获取移动端配置
```http
GET /api/mobile/config/{factoryId}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "workStartTime": "08:00",
    "workEndTime": "18:00",
    "breakDuration": 60,
    "gpsRequired": true,
    "gpsLocation": {
      "latitude": 31.2304,
      "longitude": 121.4737
    },
    "gpsRadius": 500,
    "aiEnabled": true
  }
}
```

**权限**: 任何工厂用户

---

### 2.10 监控接口

#### 上报崩溃日志
```http
POST /api/mobile/report/crash
```

**请求体**:
```json
{
  "errorMessage": "TypeError: Cannot read property 'id' of undefined",
  "stack": "...",
  "deviceInfo": {...},
  "appVersion": "1.1.0",
  "timestamp": "2025-11-20T14:30:55"
}
```

**权限**: 任何已登录用户

---

#### 上报性能数据
```http
POST /api/mobile/report/performance
```

**请求体**:
```json
{
  "metric": "api_response_time",
  "value": 230,
  "endpoint": "/api/mobile/processing/batches",
  "timestamp": "2025-11-20T14:30:55"
}
```

**权限**: 任何已登录用户

---

### 2.11 人员报表

#### 人员总览统计
```http
GET /api/mobile/{factoryId}/personnel/statistics
```

**查询参数**:
- `startDate`: 开始日期 (yyyy-MM-dd)
- `endDate`: 结束日期 (yyyy-MM-dd)

**响应**:
```json
{
  "code": 200,
  "data": {
    "totalEmployees": 120,
    "activeEmployees": 115,
    "totalWorkHours": 9600,
    "averageWorkHours": 80,
    "overtimeHours": 450
  }
}
```

**权限**: `factory_admin`, `department_admin`及以上

---

#### 工时排行榜
```http
GET /api/mobile/{factoryId}/personnel/work-hours-ranking
```

**查询参数**:
- `period`: `daily` | `weekly` | `monthly`
- `limit`: 排行数量 (默认10)

**响应**:
```json
{
  "code": 200,
  "data": [
    {
      "userId": 5,
      "fullName": "张三",
      "workHours": 180.5,
      "overtimeHours": 20.5,
      "ranking": 1
    }
  ]
}
```

**权限**: `factory_admin`, `department_admin`及以上

---

#### 加班统计
```http
GET /api/mobile/{factoryId}/personnel/overtime-statistics
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "totalOvertimeHours": 450.5,
    "averageOvertimePerEmployee": 3.75,
    "topOvertimeEmployees": [...]
  }
}
```

**权限**: `factory_admin`, `department_admin`及以上

---

#### 人员绩效统计
```http
GET /api/mobile/{factoryId}/personnel/performance
```

**响应**:
```json
{
  "code": 200,
  "data": [
    {
      "userId": 5,
      "fullName": "张三",
      "completedBatches": 25,
      "qualityScore": 98.5,
      "efficiency": 105.2
    }
  ]
}
```

**权限**: `factory_admin`, `department_admin`及以上

---

### 2.12 成本对比

#### 批次成本对比
```http
GET /api/mobile/{factoryId}/processing/cost-comparison
```

**查询参数**:
- `batchIds`: 批次ID列表（逗号分隔，2-5个）

**示例**:
```http
GET /api/mobile/F001/processing/cost-comparison?batchIds=B001,B002,B003
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "batches": [
      {
        "batchId": "B001",
        "batchNumber": "BATCH-20251120-001",
        "totalCost": 15000.00,
        "materialCost": 8000.00,
        "laborCost": 5000.00,
        "equipmentCost": 2000.00,
        "unitCost": 15.00
      }
    ],
    "comparison": {
      "lowestCost": "B001",
      "highestCost": "B003",
      "averageCost": 16500.00
    }
  }
}
```

**权限**: `supervisor`, `factory_admin`及以上

---

### 2.13 设备告警

#### 获取设备告警列表
```http
GET /api/mobile/{factoryId}/equipment-alerts
```

**查询参数**:
- `status`: `ACTIVE` | `ACKNOWLEDGED` | `IN_PROGRESS` | `RESOLVED`
- `severity`: `LOW` | `MEDIUM` | `HIGH` | `CRITICAL`
- `page`: 页码 (从0开始)
- `size`: 每页大小 (默认20)

**响应**: 分页数据

**权限**: `operator`及以上

---

#### 确认告警
```http
POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/acknowledge
```

**权限**: `supervisor`及以上

---

#### 解决告警
```http
POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/resolve
```

**请求体**:
```json
{
  "solution": "更换了温度传感器",
  "preventiveMeasures": "建议每月检查一次传感器"
}
```

**权限**: `supervisor`及以上

---

#### 忽略告警
```http
POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/ignore
```

**请求体**:
```json
{
  "reason": "误报，温度在正常范围内"
}
```

**权限**: `factory_admin`及以上

---

#### 告警统计
```http
GET /api/mobile/{factoryId}/equipment-alerts/statistics
```

**查询参数**:
- `period`: `daily` | `weekly` | `monthly`

**响应**:
```json
{
  "code": 200,
  "data": {
    "totalAlerts": 35,
    "activeAlerts": 10,
    "resolvedAlerts": 25,
    "byType": {
      "TEMPERATURE": 15,
      "FAULT": 8,
      "MAINTENANCE": 12
    },
    "bySeverity": {
      "CRITICAL": 2,
      "HIGH": 8,
      "MEDIUM": 15,
      "LOW": 10
    }
  }
}
```

**权限**: `factory_admin`, `department_admin`及以上

---

### 2.14 用户反馈

#### 提交用户反馈
```http
POST /api/mobile/{factoryId}/feedback
```

**请求体**:
```json
{
  "category": "BUG" | "FEATURE_REQUEST" | "OTHER",
  "title": "批次列表加载缓慢",
  "description": "在批次列表页面，加载时间超过5秒",
  "screenshots": ["url1", "url2"],
  "deviceInfo": {...}
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "feedbackId": "FB-001",
    "status": "SUBMITTED",
    "createdAt": "2025-11-20T14:30:55"
  }
}
```

**权限**: 任何已登录用户

---

## 3. 生产加工API (ProcessingController)

**路径前缀**: `/api/mobile/{factoryId}/processing`
**文件**: `ProcessingController.java` (577行)

### 3.1 批次管理

#### 创建生产批次
```http
POST /api/mobile/{factoryId}/processing/batches
```

**请求体**:
```json
{
  "productName": "冷冻虾仁",
  "quantity": 1000,
  "unit": "kg",
  "supervisorId": 5,
  "materialRequirements": [
    {
      "materialBatchId": "MB-001",
      "quantity": 1200
    }
  ]
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "id": "BATCH-20251120-001",
    "batchNumber": "BATCH-20251120-001",
    "productName": "冷冻虾仁",
    "quantity": 1000,
    "unit": "kg",
    "status": "pending",
    "supervisorId": 5,
    "createdAt": "2025-11-20T14:30:55"
  }
}
```

**权限**: `operator`及以上

---

#### 开始生产
```http
POST /api/mobile/{factoryId}/processing/batches/{batchId}/start
```

**请求体**:
```json
{
  "actualSupervisorId": 5,
  "workersInvolved": [10, 11, 12]
}
```

**权限**: `operator`及以上

---

#### 暂停生产
```http
POST /api/mobile/{factoryId}/processing/batches/{batchId}/pause
```

**请求体**:
```json
{
  "reason": "设备故障，需要维修"
}
```

**权限**: `supervisor`及以上

---

#### 完成生产
```http
POST /api/mobile/{factoryId}/processing/batches/{batchId}/complete
```

**请求体**:
```json
{
  "actualQuantity": 980,
  "goodQuantity": 950,
  "defectQuantity": 30,
  "notes": "部分原料质量问题导致次品增加"
}
```

**响应**: 包含自动计算的成本数据

**权限**: `supervisor`及以上

---

#### 取消生产
```http
POST /api/mobile/{factoryId}/processing/batches/{batchId}/cancel
```

**请求体**:
```json
{
  "reason": "原料短缺，无法继续生产"
}
```

**权限**: `supervisor`及以上

---

#### 获取批次详情
```http
GET /api/mobile/{factoryId}/processing/batches/{batchId}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "id": "BATCH-20251120-001",
    "batchNumber": "BATCH-20251120-001",
    "productName": "冷冻虾仁",
    "quantity": 1000,
    "actualQuantity": 980,
    "unit": "kg",
    "status": "completed",
    "startTime": "2025-11-20T08:00:00",
    "endTime": "2025-11-20T14:00:00",
    "supervisor": {
      "id": 5,
      "fullName": "李主管"
    },
    "cost": {
      "materialCost": 8000.00,
      "laborCost": 5000.00,
      "equipmentCost": 2000.00,
      "totalCost": 15000.00,
      "unitCost": 15.31
    },
    "qualityInspections": [...],
    "workers": [...],
    "equipmentUsage": [...]
  }
}
```

**权限**: `viewer`及以上

---

#### 获取批次列表
```http
GET /api/mobile/{factoryId}/processing/batches
```

**查询参数**:
- `status`: `pending` | `processing` | `completed` | `cancelled`
- `startDate`: 开始日期
- `endDate`: 结束日期
- `supervisorId`: 主管ID
- `page`: 页码
- `size`: 每页大小
- `sort`: 排序字段 (如 `createdAt,desc`)

**响应**: 分页数据

**权限**: `viewer`及以上

---

#### 获取批次时间线
```http
GET /api/mobile/{factoryId}/processing/batches/{batchId}/timeline
```

**响应**:
```json
{
  "code": 200,
  "data": [
    {
      "timestamp": "2025-11-20T08:00:00",
      "event": "BATCH_CREATED",
      "description": "批次创建",
      "operator": "张三"
    },
    {
      "timestamp": "2025-11-20T08:30:00",
      "event": "PRODUCTION_STARTED",
      "description": "开始生产",
      "operator": "李主管"
    },
    {
      "timestamp": "2025-11-20T12:00:00",
      "event": "QUALITY_INSPECTION",
      "description": "质检通过",
      "operator": "王质检"
    },
    {
      "timestamp": "2025-11-20T14:00:00",
      "event": "PRODUCTION_COMPLETED",
      "description": "生产完成",
      "operator": "李主管"
    }
  ]
}
```

**权限**: `viewer`及以上

---

### 3.2 原材料管理

#### 创建原材料接收记录
```http
POST /api/mobile/{factoryId}/processing/material-receipt
```

**请求体**:
```json
{
  "materialTypeId": "MT-001",
  "quantity": 500,
  "unit": "kg",
  "supplierId": "SUP-001",
  "batchNumber": "SUP-BATCH-20251120-001",
  "purchaseDate": "2025-11-19",
  "expiryDate": "2025-12-31",
  "unitPrice": 50.00
}
```

**权限**: `operator`及以上

---

#### 获取原材料列表
```http
GET /api/mobile/{factoryId}/processing/materials
```

**查询参数**:
- `materialTypeId`: 材料类型ID
- `status`: `available` | `low_stock` | `out_of_stock` | `frozen`
- `page`: 页码
- `size`: 每页大小

**响应**: 分页数据

**权限**: `viewer`及以上

---

#### 记录原材料消耗
```http
POST /api/mobile/{factoryId}/processing/batches/{batchId}/material-consumption
```

**请求体**:
```json
{
  "consumptions": [
    {
      "materialBatchId": "MB-001",
      "quantity": 100,
      "consumedBy": 10
    },
    {
      "materialBatchId": "MB-002",
      "quantity": 50,
      "consumedBy": 10
    }
  ]
}
```

**权限**: `operator`及以上

---

### 3.3 质量检验

#### 提交质检记录
```http
POST /api/mobile/{factoryId}/processing/quality/inspections
```

**请求体**:
```json
{
  "productionBatchId": "BATCH-20251120-001",
  "inspectorId": 8,
  "result": "pass",  // "pass" | "fail"
  "temperature": 4.5,
  "weight": 980.5,
  "appearance": "良好",
  "notes": "符合标准",
  "photos": ["url1", "url2"]
}
```

**权限**: `operator`及以上

---

#### 获取质检记录列表
```http
GET /api/mobile/{factoryId}/processing/quality/inspections
```

**查询参数**:
- `batchId`: 批次ID
- `result`: `pass` | `fail` | `pending`
- `startDate`, `endDate`: 日期范围
- `page`, `size`: 分页参数

**响应**: 分页数据

**权限**: `viewer`及以上

---

#### 质量统计
```http
GET /api/mobile/{factoryId}/processing/quality/statistics
```

**查询参数**:
- `period`: `daily` | `weekly` | `monthly`

**响应**:
```json
{
  "code": 200,
  "data": {
    "totalInspections": 120,
    "passCount": 115,
    "failCount": 5,
    "passRate": 95.83,
    "averageTemperature": 4.2,
    "defectReasons": [
      {"reason": "温度超标", "count": 3},
      {"reason": "重量不足", "count": 2}
    ]
  }
}
```

**权限**: `supervisor`及以上

---

#### 质量趋势
```http
GET /api/mobile/{factoryId}/processing/quality/trends
```

**查询参数**:
- `days`: 最近天数 (默认30)

**响应**:
```json
{
  "code": 200,
  "data": [
    {
      "date": "2025-11-20",
      "passRate": 96.5,
      "totalInspections": 15
    }
  ]
}
```

**权限**: `supervisor`及以上

---

### 3.4 成本分析

#### 批次成本分析
```http
GET /api/mobile/{factoryId}/processing/batches/{batchId}/cost-analysis
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "batchId": "BATCH-20251120-001",
    "totalCost": 15000.00,
    "costBreakdown": {
      "material": {
        "amount": 8000.00,
        "percentage": 53.33
      },
      "labor": {
        "amount": 5000.00,
        "percentage": 33.33,
        "details": [
          {
            "workerId": 10,
            "workerName": "张三",
            "workMinutes": 360,
            "cost": 2500.00
          }
        ]
      },
      "equipment": {
        "amount": 2000.00,
        "percentage": 13.33,
        "details": [
          {
            "equipmentId": "EQ-001",
            "equipmentName": "冷冻机A",
            "usageMinutes": 300,
            "cost": 1500.00
          }
        ]
      }
    },
    "unitCost": 15.31,
    "profitMargin": 25.5
  }
}
```

**权限**: `supervisor`及以上

---

#### 重算成本
```http
POST /api/mobile/{factoryId}/processing/batches/{batchId}/recalculate-cost
```

**说明**: 用于修正数据后重新计算成本

**权限**: `factory_admin`及以上

---

### 3.5 仪表盘

#### 生产概览
```http
GET /api/mobile/{factoryId}/processing/dashboard/overview
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "todayOutput": 1500.5,
    "completedBatches": 12,
    "ongoingBatches": 3,
    "pendingBatches": 5,
    "todayCost": 125000.00,
    "todayRevenue": 180000.00
  }
}
```

**权限**: `supervisor`及以上

---

#### 生产统计
```http
GET /api/mobile/{factoryId}/processing/dashboard/production
```

**查询参数**:
- `period`: `daily` | `weekly` | `monthly`

**响应**: 包含产量趋势、批次数量趋势等

**权限**: `supervisor`及以上

---

#### 质量仪表盘
```http
GET /api/mobile/{factoryId}/processing/dashboard/quality
```

**响应**: 质量合格率、不合格原因分布等

**权限**: `supervisor`及以上

---

#### 设备仪表盘
```http
GET /api/mobile/{factoryId}/processing/dashboard/equipment
```

**响应**: 设备使用率、告警统计等

**权限**: `supervisor`及以上

---

#### 告警仪表盘
```http
GET /api/mobile/{factoryId}/processing/dashboard/alerts
```

**响应**: 活动告警、已解决告警统计

**权限**: `supervisor`及以上

---

#### 趋势分析
```http
GET /api/mobile/{factoryId}/processing/dashboard/trends
```

**查询参数**:
- `metric`: `output` | `cost` | `quality` | `efficiency`
- `days`: 天数

**响应**: 趋势数据数组

**权限**: `supervisor`及以上

---

## 4. AI智能分析API (AIController)

**路径前缀**: `/api/mobile/{factoryId}/ai`
**文件**: `AIController.java` (409行)

### 4.1 成本分析

#### AI批次成本分析
```http
POST /api/mobile/{factoryId}/ai/analysis/cost/batch
```

**请求体**:
```json
{
  "batchId": "BATCH-20251120-001",
  "question": "分析这个批次的成本构成，找出可优化的地方",
  "sessionId": null  // 首次分析为null，追问时传sessionId
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "reportId": "AI-REPORT-001",
    "analysis": "根据数据分析，该批次总成本15000元，其中人工成本占比33.33%略高于行业平均水平...",
    "suggestions": [
      "建议优化生产流程，减少人工工时",
      "考虑采用自动化设备降低人工成本",
      "原材料采购价格较高，建议寻找更优质的供应商"
    ],
    "costBreakdown": {
      "material": 8000.00,
      "labor": 5000.00,
      "equipment": 2000.00
    },
    "sessionId": "AI-SESSION-001",
    "quotaConsumed": 1,
    "quotaRemaining": 14,
    "createdAt": "2025-11-20T14:30:55"
  }
}
```

**权限**: `supervisor`及以上

**配额**: 消耗1次AI配额（缓存命中不消耗）

---

#### AI时间范围成本分析
```http
POST /api/mobile/{factoryId}/ai/analysis/cost/time-range
```

**请求体**:
```json
{
  "startDate": "2025-11-01",
  "endDate": "2025-11-20",
  "dimension": "weekly",  // "daily" | "weekly" | "monthly"
  "question": "分析本月成本趋势，找出异常波动原因"
}
```

**响应**: 类似批次分析，但包含时间维度的趋势数据

**权限**: `supervisor`及以上

**配额**: 消耗1次AI配额

---

#### AI批次对比分析
```http
POST /api/mobile/{factoryId}/ai/analysis/cost/compare
```

**请求体**:
```json
{
  "batchIds": ["BATCH-001", "BATCH-002", "BATCH-003"],
  "question": "对比这三个批次的成本效率，找出最佳实践"
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "reportId": "AI-REPORT-002",
    "analysis": "通过对比三个批次，BATCH-001效率最高，单位成本仅15.31元...",
    "bestPractices": [
      "BATCH-001使用了优化后的生产流程",
      "人员配置合理，无冗余工时"
    ],
    "comparison": [
      {
        "batchId": "BATCH-001",
        "unitCost": 15.31,
        "efficiency": 105.2,
        "ranking": 1
      }
    ],
    "sessionId": "AI-SESSION-002",
    "quotaConsumed": 1
  }
}
```

**权限**: `supervisor`及以上

**配额**: 消耗1次AI配额

---

### 4.2 配额管理

#### 查询AI配额
```http
GET /api/mobile/{factoryId}/ai/quota
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "factoryId": "F-SH-2024-001",
    "weeklyQuota": 20,
    "remainingQuota": 14,
    "consumedThisWeek": 6,
    "resetDate": "2025-11-24",
    "usageHistory": [
      {
        "date": "2025-11-20",
        "consumed": 3
      }
    ]
  }
}
```

**权限**: 任何工厂用户

---

#### 更新AI配额（平台管理员）
```http
PUT /api/mobile/{factoryId}/ai/quota
```

**请求体**:
```json
{
  "weeklyQuota": 30
}
```

**权限**: `platform_admin`, `super_admin`

---

### 4.3 对话管理

#### 获取AI对话历史
```http
GET /api/mobile/{factoryId}/ai/conversations/{sessionId}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "sessionId": "AI-SESSION-001",
    "batchId": "BATCH-20251120-001",
    "messages": [
      {
        "role": "user",
        "content": "分析这个批次的成本构成",
        "timestamp": "2025-11-20T14:30:55"
      },
      {
        "role": "assistant",
        "content": "根据数据分析...",
        "timestamp": "2025-11-20T14:31:05"
      },
      {
        "role": "user",
        "content": "如何降低人工成本？",
        "timestamp": "2025-11-20T14:32:00"
      },
      {
        "role": "assistant",
        "content": "建议采用以下措施...",
        "timestamp": "2025-11-20T14:32:10"
      }
    ],
    "totalQuotaConsumed": 1.2
  }
}
```

**权限**: `supervisor`及以上

---

#### 关闭对话会话
```http
DELETE /api/mobile/{factoryId}/ai/conversations/{sessionId}
```

**权限**: `supervisor`及以上

---

### 4.4 报告管理

#### 获取AI报告列表
```http
GET /api/mobile/{factoryId}/ai/reports
```

**查询参数**:
- `type`: `batch` | `time_range` | `comparison`
- `startDate`, `endDate`: 日期范围
- `page`, `size`: 分页参数

**响应**: 分页的报告列表

**权限**: `supervisor`及以上

---

#### 获取AI报告详情
```http
GET /api/mobile/{factoryId}/ai/reports/{reportId}
```

**响应**: 完整的报告内容

**权限**: `supervisor`及以上

---

#### 生成新报告
```http
POST /api/mobile/{factoryId}/ai/reports/generate
```

**请求体**:
```json
{
  "type": "batch" | "time_range" | "comparison",
  "parameters": {...}
}
```

**响应**: 新生成的报告

**权限**: `supervisor`及以上

---

### 4.5 健康检查

#### AI服务健康检查
```http
GET /api/mobile/{factoryId}/ai/health
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "status": "healthy",
    "deepseekApiAvailable": true,
    "responseTime": 230,
    "lastCheckTime": "2025-11-20T14:30:55"
  }
}
```

**权限**: `factory_admin`及以上

---

## 5. 用户管理API (UserController)

**路径前缀**: `/api/mobile/{factoryId}/users`
**文件**: `UserController.java` (314行)

### 5.1 CRUD操作

#### 创建用户
```http
POST /api/mobile/{factoryId}/users
```

**请求体**:
```json
{
  "username": "newuser",
  "password": "Pass@123456",
  "fullName": "张三",
  "phone": "13800138000",
  "department": "生产部",
  "position": "操作员",
  "roleCode": "operator",
  "monthlySalary": 8000.00,
  "expectedWorkMinutes": 9600  // 160小时
}
```

**权限**: `factory_admin`及以上

---

#### 更新用户信息
```http
PUT /api/mobile/{factoryId}/users/{userId}
```

**请求体**: 与创建相同（部分字段可选）

**权限**: `factory_admin`及以上（或用户本人修改非敏感字段）

---

#### 删除用户
```http
DELETE /api/mobile/{factoryId}/users/{userId}
```

**说明**: 软删除，设置 `isActive=false`

**权限**: `factory_admin`及以上

---

#### 获取用户详情
```http
GET /api/mobile/{factoryId}/users/{userId}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "id": 10,
    "username": "operator01",
    "fullName": "张三",
    "phone": "13800138000",
    "department": "生产部",
    "position": "操作员",
    "roleCode": "operator",
    "monthlySalary": 8000.00,
    "expectedWorkMinutes": 9600,
    "isActive": true,
    "createdAt": "2025-11-01T08:00:00"
  }
}
```

**权限**: `viewer`及以上（或用户本人）

---

#### 获取用户列表
```http
GET /api/mobile/{factoryId}/users
```

**查询参数**:
- `department`: 部门筛选
- `roleCode`: 角色筛选
- `isActive`: `true` | `false`
- `keyword`: 关键词搜索（用户名/姓名/手机号）
- `page`, `size`: 分页参数

**响应**: 分页数据

**权限**: `viewer`及以上

---

### 5.2 用户操作

#### 按角色获取用户
```http
GET /api/mobile/{factoryId}/users/role/{roleCode}
```

**示例**:
```http
GET /api/mobile/F001/users/role/operator
```

**权限**: `viewer`及以上

---

#### 激活用户
```http
POST /api/mobile/{factoryId}/users/{userId}/activate
```

**权限**: `factory_admin`及以上

---

#### 停用用户
```http
POST /api/mobile/{factoryId}/users/{userId}/deactivate
```

**权限**: `factory_admin`及以上

---

#### 更新用户角色
```http
PUT /api/mobile/{factoryId}/users/{userId}/role
```

**请求体**:
```json
{
  "roleCode": "supervisor"
}
```

**权限**: `factory_super_admin`及以上

---

#### 检查用户名是否存在
```http
GET /api/mobile/{factoryId}/users/check/username?username=newuser
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "exists": false
  }
}
```

**权限**: 公开接口

---

#### 检查邮箱是否存在
```http
GET /api/mobile/{factoryId}/users/check/email?email=user@example.com
```

**权限**: 公开接口

---

#### 搜索用户
```http
GET /api/mobile/{factoryId}/users/search?q=张三
```

**权限**: `viewer`及以上

---

### 5.3 导入导出

#### 导出用户列表
```http
GET /api/mobile/{factoryId}/users/export
```

**查询参数**: 与列表查询相同

**响应**: Excel文件流 (`application/vnd.ms-excel`)

**文件名**: `用户列表_20251120_143055.xlsx`

**权限**: `factory_admin`及以上

---

#### 批量导入用户
```http
POST /api/mobile/{factoryId}/users/import
Content-Type: multipart/form-data
```

**请求体**:
```
file: (Excel文件)
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "successCount": 10,
    "failureCount": 2,
    "errors": [
      {
        "row": 3,
        "error": "用户名已存在: operator01"
      },
      {
        "row": 5,
        "error": "手机号格式错误"
      }
    ]
  }
}
```

**权限**: `factory_admin`及以上

---

#### 下载导入模板
```http
GET /api/mobile/{factoryId}/users/export/template
```

**响应**: Excel模板文件

**文件名**: `用户导入模板.xlsx`

**模板格式**:
| 用户名* | 密码* | 姓名* | 手机号* | 部门 | 职位 | 角色代码* | 月薪 | 预期工时 |
|---------|-------|------|---------|------|------|-----------|------|----------|
| user01 | Pass@123 | 张三 | 138xxx | 生产部 | 操作员 | operator | 8000 | 9600 |

**权限**: `factory_admin`及以上

---

## 6. 考勤打卡API (TimeClockController)

**路径前缀**: `/api/mobile/{factoryId}/timeclock`
**文件**: `TimeClockController.java` (216行)

### 6.1 打卡操作

#### 上班打卡
```http
POST /api/mobile/{factoryId}/timeclock/clock-in
```

**请求体**:
```json
{
  "location": "31.2304,121.4737",
  "deviceId": "UUID-xxx-xxx"
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "recordId": 1001,
    "userId": 10,
    "clockInTime": "2025-11-20T08:00:00",
    "location": "31.2304,121.4737",
    "status": "clocked_in",
    "isLate": false
  }
}
```

**权限**: 任何已登录用户

---

#### 下班打卡
```http
POST /api/mobile/{factoryId}/timeclock/clock-out
```

**请求体**:
```json
{
  "location": "31.2304,121.4737"
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "recordId": 1001,
    "clockInTime": "2025-11-20T08:00:00",
    "clockOutTime": "2025-11-20T18:00:00",
    "workMinutes": 540,  // 9小时 (扣除1小时休息)
    "overtimeMinutes": 60,  // 加班1小时
    "status": "clocked_out",
    "isEarlyLeave": false
  }
}
```

**权限**: 任何已登录用户

---

#### 开始休息
```http
POST /api/mobile/{factoryId}/timeclock/break-start
```

**权限**: 任何已登录用户

---

#### 结束休息
```http
POST /api/mobile/{factoryId}/timeclock/break-end
```

**权限**: 任何已登录用户

---

### 6.2 打卡记录

#### 获取打卡状态
```http
GET /api/mobile/{factoryId}/timeclock/status
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "todayRecord": {
      "recordId": 1001,
      "clockInTime": "2025-11-20T08:00:00",
      "clockOutTime": null,
      "breakStartTime": "2025-11-20T12:00:00",
      "breakEndTime": "2025-11-20T13:00:00",
      "status": "on_break",
      "currentWorkMinutes": 240
    },
    "canClockIn": false,
    "canClockOut": false,
    "canStartBreak": false,
    "canEndBreak": true
  }
}
```

**权限**: 任何已登录用户

---

#### 获取打卡历史
```http
GET /api/mobile/{factoryId}/timeclock/history
```

**查询参数**:
- `userId`: 用户ID (默认当前用户)
- `startDate`, `endDate`: 日期范围
- `page`, `size`: 分页参数

**响应**: 分页的打卡记录

**权限**: `viewer`及以上（或用户本人）

---

#### 获取今日打卡记录
```http
GET /api/mobile/{factoryId}/timeclock/today
```

**查询参数**:
- `userId`: 用户ID (可选，默认当前用户)

**响应**:
```json
{
  "code": 200,
  "data": {
    "recordId": 1001,
    "userId": 10,
    "clockInTime": "2025-11-20T08:00:00",
    "clockOutTime": null,
    "breakStartTime": "2025-11-20T12:00:00",
    "breakEndTime": "2025-11-20T13:00:00",
    "workMinutes": 0,
    "status": "on_break"
  }
}
```

**权限**: 任何已登录用户

---

#### 修改打卡记录
```http
PUT /api/mobile/{factoryId}/timeclock/records/{recordId}
```

**请求体**:
```json
{
  "clockInTime": "2025-11-20T08:05:00",
  "clockOutTime": "2025-11-20T18:00:00",
  "reason": "忘记打卡，补录"
}
```

**权限**: `department_admin`及以上

---

### 6.3 统计分析

#### 考勤统计
```http
GET /api/mobile/{factoryId}/timeclock/statistics
```

**查询参数**:
- `userId`: 用户ID (可选)
- `department`: 部门 (可选)
- `startDate`, `endDate`: 日期范围

**响应**:
```json
{
  "code": 200,
  "data": {
    "totalWorkDays": 20,
    "actualWorkDays": 19,
    "totalWorkMinutes": 9120,
    "totalOvertimeMinutes": 300,
    "lateCount": 2,
    "earlyLeaveCount": 1,
    "absentCount": 1,
    "attendanceRate": 95.0
  }
}
```

**权限**: `department_admin`及以上（或用户本人）

---

#### 部门考勤
```http
GET /api/mobile/{factoryId}/timeclock/department/{department}
```

**查询参数**:
- `date`: 日期 (默认今天)

**响应**:
```json
{
  "code": 200,
  "data": {
    "department": "生产部",
    "date": "2025-11-20",
    "totalEmployees": 50,
    "presentCount": 48,
    "absentCount": 2,
    "lateCount": 3,
    "attendanceRate": 96.0,
    "employees": [
      {
        "userId": 10,
        "fullName": "张三",
        "clockInTime": "2025-11-20T08:00:00",
        "status": "present"
      }
    ]
  }
}
```

**权限**: `department_admin`及以上

---

#### 导出考勤记录
```http
GET /api/mobile/{factoryId}/timeclock/export
```

**查询参数**: 与历史查询相同

**响应**: Excel文件

**权限**: `department_admin`及以上

---

## 7. 原材料批次API (MaterialBatchController)

**路径前缀**: `/api/mobile/{factoryId}/material-batches`
**文件**: `MaterialBatchController.java` (463行)

### 7.1 CRUD操作

#### 创建原材料批次
```http
POST /api/mobile/{factoryId}/material-batches
```

**请求体**:
```json
{
  "materialTypeId": "MT-001",
  "batchNumber": "SUP-BATCH-20251120-001",
  "quantity": 500,
  "unit": "kg",
  "supplierId": "SUP-001",
  "purchaseDate": "2025-11-19",
  "expiryDate": "2025-12-31",
  "unitPrice": 50.00,
  "storageLocation": "冷库A-001",
  "notes": "优质虾仁"
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "id": "MB-20251120-001",
    "materialTypeId": "MT-001",
    "materialTypeName": "冷冻虾仁",
    "batchNumber": "SUP-BATCH-20251120-001",
    "quantity": 500,
    "availableQuantity": 500,
    "unit": "kg",
    "status": "available",
    "supplier": {...},
    "purchaseDate": "2025-11-19",
    "expiryDate": "2025-12-31",
    "unitPrice": 50.00,
    "createdAt": "2025-11-20T14:30:55"
  }
}
```

**权限**: `operator`及以上

---

#### 更新批次
```http
PUT /api/mobile/{factoryId}/material-batches/{batchId}
```

**权限**: `supervisor`及以上

---

#### 删除批次
```http
DELETE /api/mobile/{factoryId}/material-batches/{batchId}
```

**说明**: 软删除，仅当 `availableQuantity=0` 时允许

**权限**: `factory_admin`及以上

---

#### 获取批次详情
```http
GET /api/mobile/{factoryId}/material-batches/{batchId}
```

**响应**: 包含完整的批次信息、供应商信息、消耗记录

**权限**: `viewer`及以上

---

#### 获取批次列表
```http
GET /api/mobile/{factoryId}/material-batches
```

**查询参数**:
- `materialTypeId`: 材料类型ID
- `status`: `available` | `low_stock` | `out_of_stock` | `frozen` | `expired`
- `supplierId`: 供应商ID
- `expiryDays`: 过期天数筛选 (如 `7` 表示7天内过期)
- `keyword`: 关键词搜索
- `page`, `size`: 分页参数
- `sort`: 排序字段

**响应**: 分页数据

**权限**: `viewer`及以上

---

### 7.2 批次查询

#### 按材料类型获取
```http
GET /api/mobile/{factoryId}/material-batches/material-type/{materialTypeId}
```

**权限**: `viewer`及以上

---

#### 按状态获取批次
```http
GET /api/mobile/{factoryId}/material-batches/status/{status}
```

**权限**: `viewer`及以上

---

#### 搜索批次
```http
GET /api/mobile/{factoryId}/material-batches/search?q=虾仁
```

**权限**: `viewer`及以上

---

#### 获取低库存批次
```http
GET /api/mobile/{factoryId}/material-batches/low-stock
```

**查询参数**:
- `threshold`: 库存阈值 (默认使用材料类型的安全库存值)

**响应**:
```json
{
  "code": 200,
  "data": [
    {
      "batchId": "MB-001",
      "materialTypeName": "冷冻虾仁",
      "availableQuantity": 50,
      "safetyStock": 100,
      "shortfall": 50
    }
  ]
}
```

**权限**: `operator`及以上

---

#### 获取临期批次
```http
GET /api/mobile/{factoryId}/material-batches/near-expiry
```

**查询参数**:
- `days`: 天数 (默认7天)

**响应**:
```json
{
  "code": 200,
  "data": [
    {
      "batchId": "MB-002",
      "materialTypeName": "冷冻虾仁",
      "availableQuantity": 100,
      "expiryDate": "2025-11-27",
      "daysUntilExpiry": 7
    }
  ]
}
```

**权限**: `operator`及以上

---

#### 库存统计
```http
GET /api/mobile/{factoryId}/material-batches/statistics
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "totalValue": 250000.00,
    "totalBatches": 45,
    "lowStockCount": 5,
    "nearExpiryCount": 3,
    "byMaterialType": [
      {
        "materialTypeId": "MT-001",
        "materialTypeName": "冷冻虾仁",
        "totalQuantity": 1500,
        "totalValue": 75000.00,
        "batchCount": 10
      }
    ]
  }
}
```

**权限**: `supervisor`及以上

---

### 7.3 批次操作

#### 调整批次数量
```http
POST /api/mobile/{factoryId}/material-batches/{batchId}/adjust
```

**请求体**:
```json
{
  "adjustmentQuantity": -10,  // 负数为减少，正数为增加
  "reason": "盘点发现损耗",
  "adjustedBy": 5
}
```

**权限**: `supervisor`及以上

---

#### 记录消耗
```http
POST /api/mobile/{factoryId}/material-batches/{batchId}/consume
```

**请求体**:
```json
{
  "quantity": 100,
  "productionBatchId": "BATCH-20251120-001",
  "consumedBy": 10
}
```

**说明**: 通常由生产批次自动调用

**权限**: `operator`及以上

---

#### 退回批次
```http
POST /api/mobile/{factoryId}/material-batches/{batchId}/return
```

**请求体**:
```json
{
  "quantity": 50,
  "reason": "质量问题",
  "returnedBy": 5
}
```

**权限**: `supervisor`及以上

---

#### 冻结批次
```http
POST /api/mobile/{factoryId}/material-batches/{batchId}/freeze
```

**请求体**:
```json
{
  "reason": "质量问题，待检验"
}
```

**权限**: `supervisor`及以上

---

#### 解冻批次
```http
POST /api/mobile/{factoryId}/material-batches/{batchId}/unfreeze
```

**权限**: `supervisor`及以上

---

#### 转为冷冻品
```http
POST /api/mobile/{factoryId}/material-batches/{batchId}/convert-to-frozen
```

**说明**: 用于将鲜品转为冷冻品，更新保质期等信息

**权限**: `operator`及以上

---

### 7.4 导入导出

#### 导出批次列表
```http
GET /api/mobile/{factoryId}/material-batches/export
```

**响应**: Excel文件

**权限**: `supervisor`及以上

---

#### 批量导入
```http
POST /api/mobile/{factoryId}/material-batches/import
```

**响应**: 导入结果统计

**权限**: `supervisor`及以上

---

#### 下载导入模板
```http
GET /api/mobile/{factoryId}/material-batches/export/template
```

**响应**: Excel模板

**权限**: `supervisor`及以上

---

## 8. 设备管理API (EquipmentController)

**路径前缀**: `/api/mobile/{factoryId}/equipment`
**文件**: `EquipmentController.java` (502行)

### 8.1 CRUD操作

#### 创建设备
```http
POST /api/mobile/{factoryId}/equipment
```

**请求体**:
```json
{
  "name": "冷冻机A",
  "type": "FREEZER",  // 设备类型枚举
  "model": "FL-5000",
  "manufacturer": "某制冷设备公司",
  "purchaseDate": "2023-01-15",
  "purchasePrice": 500000.00,
  "lifespanYears": 10,
  "location": "车间A-001"
}
```

**权限**: `factory_admin`及以上

---

#### 更新设备
```http
PUT /api/mobile/{factoryId}/equipment/{equipmentId}
```

**权限**: `factory_admin`及以上

---

#### 删除设备
```http
DELETE /api/mobile/{factoryId}/equipment/{equipmentId}
```

**权限**: `factory_super_admin`及以上

---

#### 获取设备详情
```http
GET /api/mobile/{factoryId}/equipment/{equipmentId}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "id": "EQ-001",
    "name": "冷冻机A",
    "type": "FREEZER",
    "model": "FL-5000",
    "status": "running",  // idle/running/maintenance/scrapped
    "purchaseDate": "2023-01-15",
    "purchasePrice": 500000.00,
    "lifespanYears": 10,
    "lastMaintenanceDate": "2025-10-20",
    "nextMaintenanceDate": "2025-12-20",
    "totalUsageMinutes": 876000,
    "location": "车间A-001"
  }
}
```

**权限**: `viewer`及以上

---

#### 获取设备列表
```http
GET /api/mobile/{factoryId}/equipment
```

**查询参数**:
- `type`: 设备类型
- `status`: 设备状态
- `keyword`: 关键词搜索
- `page`, `size`: 分页参数

**响应**: 分页数据

**权限**: `viewer`及以上

---

### 8.2 设备查询

#### 按状态获取设备
```http
GET /api/mobile/{factoryId}/equipment/status/{status}
```

**权限**: `viewer`及以上

---

#### 按类型获取设备
```http
GET /api/mobile/{factoryId}/equipment/type/{type}
```

**权限**: `viewer`及以上

---

#### 搜索设备
```http
GET /api/mobile/{factoryId}/equipment/search?q=冷冻
```

**权限**: `viewer`及以上

---

### 8.3 设备操作

#### 启动设备
```http
POST /api/mobile/{factoryId}/equipment/{equipmentId}/start
```

**请求体**:
```json
{
  "operatorId": 10,
  "productionBatchId": "BATCH-20251120-001"
}
```

**权限**: `operator`及以上

---

#### 停止设备
```http
POST /api/mobile/{factoryId}/equipment/{equipmentId}/stop
```

**权限**: `operator`及以上

---

#### 记录维护
```http
POST /api/mobile/{factoryId}/equipment/{equipmentId}/maintenance
```

**请求体**:
```json
{
  "maintenanceType": "ROUTINE" | "REPAIR" | "UPGRADE",
  "description": "更换温度传感器",
  "cost": 1500.00,
  "performedBy": 5,
  "startTime": "2025-11-20T08:00:00",
  "endTime": "2025-11-20T12:00:00"
}
```

**权限**: `supervisor`及以上

---

#### 获取使用历史
```http
GET /api/mobile/{factoryId}/equipment/{equipmentId}/history
```

**查询参数**:
- `startDate`, `endDate`: 日期范围
- `page`, `size`: 分页参数

**响应**: 设备使用记录（关联生产批次）

**权限**: `viewer`及以上

---

#### 获取设备告警
```http
GET /api/mobile/{factoryId}/equipment/{equipmentId}/alerts
```

**查询参数**:
- `status`: 告警状态

**响应**: 告警列表

**权限**: `operator`及以上

---

### 8.4 统计分析

#### 设备统计
```http
GET /api/mobile/{factoryId}/equipment/statistics
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "totalEquipment": 25,
    "byStatus": {
      "idle": 10,
      "running": 12,
      "maintenance": 2,
      "scrapped": 1
    },
    "averageUtilization": 75.5,
    "totalMaintenanceCost": 35000.00
  }
}
```

**权限**: `supervisor`及以上

---

#### 设备利用率
```http
GET /api/mobile/{factoryId}/equipment/utilization
```

**查询参数**:
- `period`: `daily` | `weekly` | `monthly`
- `equipmentId`: 特定设备ID (可选)

**响应**:
```json
{
  "code": 200,
  "data": [
    {
      "equipmentId": "EQ-001",
      "equipmentName": "冷冻机A",
      "utilizationRate": 85.5,
      "totalUsageMinutes": 12240,
      "availableMinutes": 14400
    }
  ]
}
```

**权限**: `supervisor`及以上

---

### 8.5 导入导出

#### 导出设备列表
```http
GET /api/mobile/{factoryId}/equipment/export
```

**权限**: `factory_admin`及以上

---

#### 批量导入设备
```http
POST /api/mobile/{factoryId}/equipment/import
```

**权限**: `factory_admin`及以上

---

#### 下载导入模板
```http
GET /api/mobile/{factoryId}/equipment/export/template
```

**权限**: `factory_admin`及以上

---

## 9. 质量检验API (QualityInspectionController)

**路径前缀**: `/api/mobile/{factoryId}/quality-inspections`
**文件**: `QualityInspectionController.java` (107行)

#### 获取质检记录列表
```http
GET /api/mobile/{factoryId}/quality-inspections
```

**查询参数**:
- `productionBatchId`: 批次ID
- `inspectorId`: 质检员ID
- `result`: `pass` | `fail` | `pending`
- `startDate`, `endDate`: 日期范围
- `page`, `size`: 分页参数

**响应**: 分页数据

**权限**: `viewer`及以上

---

#### 获取质检记录详情
```http
GET /api/mobile/{factoryId}/quality-inspections/{inspectionId}
```

**权限**: `viewer`及以上

---

#### 创建质检记录
```http
POST /api/mobile/{factoryId}/quality-inspections
```

**请求体**:
```json
{
  "productionBatchId": "BATCH-20251120-001",
  "result": "pass",
  "temperature": 4.5,
  "weight": 980.5,
  "appearance": "良好",
  "smell": "正常",
  "texture": "紧实",
  "notes": "符合标准",
  "photos": ["url1", "url2"]
}
```

**权限**: `operator`及以上

---

#### 更新质检记录
```http
PUT /api/mobile/{factoryId}/quality-inspections/{inspectionId}
```

**权限**: `supervisor`及以上

---

## 10. 平台管理API (PlatformController)

**路径前缀**: `/api/platform`
**文件**: `PlatformController.java` (217行)

**说明**: 所有平台API仅 `platform_admin` 和 `super_admin` 可访问

### 10.1 AI配额管理

#### 获取所有工厂AI配额
```http
GET /api/platform/ai-quota
```

**响应**:
```json
{
  "code": 200,
  "data": [
    {
      "factoryId": "F-SH-2024-001",
      "factoryName": "上海工厂",
      "weeklyQuota": 20,
      "remainingQuota": 14,
      "consumedThisWeek": 6
    }
  ]
}
```

---

#### 更新工厂AI配额
```http
PUT /api/platform/ai-quota/{factoryId}
```

**请求体**:
```json
{
  "weeklyQuota": 30
}
```

---

#### 获取平台AI使用统计
```http
GET /api/platform/ai-usage-stats
```

**查询参数**:
- `period`: `daily` | `weekly` | `monthly`

**响应**:
```json
{
  "code": 200,
  "data": {
    "totalQuotaAllocated": 500,
    "totalQuotaConsumed": 320,
    "averageUsagePerFactory": 16,
    "topFactories": [
      {
        "factoryId": "F-SH-2024-001",
        "factoryName": "上海工厂",
        "consumed": 25
      }
    ]
  }
}
```

---

### 10.2 工厂管理

#### 获取所有工厂列表
```http
GET /api/platform/factories
```

**查询参数**:
- `industry`: 行业筛选
- `isActive`: `true` | `false`
- `page`, `size`: 分页参数

**响应**: 分页数据

---

#### 获取工厂详情
```http
GET /api/platform/factories/{factoryId}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "id": "F-SH-2024-001",
    "name": "上海工厂",
    "industry": "水产加工",
    "address": "上海市浦东新区xxx路xxx号",
    "aiWeeklyQuota": 20,
    "isActive": true,
    "createdAt": "2024-01-15T08:00:00",
    "statistics": {
      "totalUsers": 120,
      "totalBatches": 500,
      "monthlyOutput": 150000
    }
  }
}
```

---

#### 创建新工厂
```http
POST /api/platform/factories
```

**请求体**:
```json
{
  "name": "北京工厂",
  "industry": "水产加工",
  "address": "北京市朝阳区xxx路xxx号",
  "aiWeeklyQuota": 20,
  "contactPerson": "张经理",
  "contactPhone": "13800138000"
}
```

**响应**: 新创建的工厂信息（包含自动生成的factoryId）

---

#### 更新工厂信息
```http
PUT /api/platform/factories/{factoryId}
```

**请求体**: 与创建相同（部分字段可选）

---

#### 删除工厂
```http
DELETE /api/platform/factories/{factoryId}
```

**说明**: 软删除，设置 `isActive=false`

---

#### 激活工厂
```http
POST /api/platform/factories/{factoryId}/activate
```

---

#### 停用工厂
```http
POST /api/platform/factories/{factoryId}/deactivate
```

---

### 10.3 平台统计

#### 获取平台统计数据
```http
GET /api/platform/dashboard/statistics
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "totalFactories": 15,
    "activeFactories": 14,
    "totalUsers": 1800,
    "totalBatchesThisMonth": 2500,
    "totalOutputThisMonth": 2250000,
    "aiQuotaUtilization": 64.0,
    "revenueThisMonth": 35000000.00
  }
}
```

---

## 11. 其他Controller

### 11.1 材料类型管理 (MaterialTypeController)
**路径**: `/api/mobile/{factoryId}/material-types`

- `GET /` - 获取材料类型列表
- `POST /` - 创建材料类型
- `PUT /{id}` - 更新材料类型
- `DELETE /{id}` - 删除材料类型
- `GET /export` - 导出材料类型
- `POST /import` - 导入材料类型

---

### 11.2 客户管理 (CustomerController)
**路径**: `/api/mobile/{factoryId}/customers`

- `GET /` - 获取客户列表
- `POST /` - 创建客户
- `PUT /{id}` - 更新客户
- `DELETE /{id}` - 删除客户
- `GET /{id}/orders` - 获取客户订单
- `GET /export` - 导出客户列表

---

### 11.3 供应商管理 (SupplierController)
**路径**: `/api/mobile/{factoryId}/suppliers`

- `GET /` - 获取供应商列表
- `POST /` - 创建供应商
- `PUT /{id}` - 更新供应商
- `DELETE /{id}` - 删除供应商
- `GET /{id}/rating` - 获取供应商评级
- `POST /{id}/rate` - 评价供应商

---

### 11.4 生产计划 (ProductionPlanController)
**路径**: `/api/mobile/{factoryId}/production-plans`

- `GET /` - 获取生产计划列表
- `POST /` - 创建生产计划
- `PUT /{id}` - 更新生产计划
- `POST /{id}/execute` - 执行生产计划
- `POST /{id}/complete` - 完成生产计划

---

### 11.5 报告管理 (ReportController)
**路径**: `/api/mobile/{factoryId}/reports`

- `GET /production` - 生产报表
- `GET /quality` - 质量报表
- `GET /cost` - 成本报表
- `GET /personnel` - 人员报表
- `GET /efficiency` - 效率报表
- `POST /generate` - 生成报告
- `GET /{reportId}/download` - 下载报告

---

### 11.6 工厂设置 (FactorySettingsController)
**路径**: `/api/mobile/{factoryId}/settings`

- `GET /` - 获取工厂设置
- `PUT /` - 更新工厂设置
- `PUT /gps` - 更新GPS位置
- `PUT /work-time` - 更新工作时间

---

### 11.7 时间统计 (TimeStatsController)
**路径**: `/api/mobile/{factoryId}/time-stats`

- `GET /summary` - 工时汇总
- `GET /by-department` - 部门工时统计
- `GET /by-user/{userId}` - 用户工时统计

---

### 11.8 白名单管理 (WhitelistController)
**路径**: `/api/mobile/{factoryId}/whitelist`

- `GET /` - 获取白名单列表
- `POST /` - 添加白名单
- `DELETE /{phone}` - 移除白名单
- `GET /check/{phone}` - 检查手机号是否在白名单

---

### 11.9 部门管理 (DepartmentController)
**路径**: `/api/mobile/{factoryId}/departments`

- `GET /` - 获取部门列表
- `POST /` - 创建部门
- `PUT /{id}` - 更新部门
- `DELETE /{id}` - 删除部门

---

### 11.10 工种管理 (WorkTypeController)
**路径**: `/api/mobile/{factoryId}/work-types`

- `GET /` - 获取工种列表
- `POST /` - 创建工种
- `PUT /{id}` - 更新工种
- `DELETE /{id}` - 删除工种

---

### 11.11 产品类型 (ProductTypeController)
**路径**: `/api/mobile/{factoryId}/product-types`

- `GET /` - 获取产品类型列表
- `POST /` - 创建产品类型
- `PUT /{id}` - 更新产品类型
- `DELETE /{id}` - 删除产品类型

---

### 11.12 转换率管理 (ConversionController)
**路径**: `/api/mobile/{factoryId}/conversions`

- `GET /` - 获取转换率配置列表
- `POST /` - 创建转换率配置
- `PUT /{id}` - 更新转换率配置

---

### 11.13 原材料类型 (RawMaterialTypeController)
**路径**: `/api/mobile/{factoryId}/raw-material-types`

- `GET /` - 获取原材料类型列表
- `POST /` - 创建原材料类型

---

### 11.14 材料规格配置 (MaterialSpecConfigController)
**路径**: `/api/mobile/{factoryId}/material-spec-configs`

- `GET /` - 获取材料规格配置列表
- `POST /` - 创建材料规格配置

---

### 11.15 系统管理 (SystemController)
**路径**: `/api/system`

- `GET /health` - 系统健康检查
- `GET /info` - 系统信息
- `GET /config` - 系统配置

---

### 11.16 测试接口 (TestController)
**路径**: `/api/test`

**说明**: 仅开发环境可用

---

## 12. 错误码参考

### HTTP状态码

| 状态码 | 说明 | 示例场景 |
|-------|------|----------|
| **200** | 成功 | 请求成功处理 |
| **201** | 已创建 | 资源创建成功 |
| **204** | 无内容 | 删除成功 |
| **400** | 请求错误 | 参数验证失败 |
| **401** | 未认证 | Token无效或过期 |
| **403** | 禁止访问 | 权限不足 |
| **404** | 未找到 | 资源不存在 |
| **409** | 冲突 | 资源已存在 |
| **500** | 服务器错误 | 内部错误 |

### 业务错误码

| 错误码 | 说明 | 示例 |
|-------|------|------|
| **AUTH_001** | 用户名或密码错误 | 登录失败 |
| **AUTH_002** | Token已过期 | 需要刷新Token |
| **AUTH_003** | Token无效 | 重新登录 |
| **AUTH_004** | 权限不足 | 403 Forbidden |
| **BATCH_001** | 批次不存在 | 404 Not Found |
| **BATCH_002** | 批次状态不允许操作 | 已完成的批次无法修改 |
| **MATERIAL_001** | 库存不足 | 无法开始生产 |
| **MATERIAL_002** | 材料已过期 | 无法使用 |
| **AI_001** | AI配额不足 | 本周配额已用完 |
| **AI_002** | DeepSeek API调用失败 | 服务不可用 |
| **FILE_001** | 文件上传失败 | 文件过大 |
| **FILE_002** | 文件格式不支持 | 仅支持jpg/png |

---

## 13. 请求示例

### 13.1 使用curl

#### 登录
```bash
curl -X POST http://139.196.165.140:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin@123456",
    "deviceId": "test-device-001"
  }'
```

#### 获取批次列表（带Token）
```bash
curl -X GET "http://139.196.165.140:10010/api/mobile/F001/processing/batches?page=0&size=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### 创建批次
```bash
curl -X POST http://139.196.165.140:10010/api/mobile/F001/processing/batches \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "冷冻虾仁",
    "quantity": 1000,
    "unit": "kg",
    "supervisorId": 5
  }'
```

#### 上班打卡
```bash
curl -X POST http://139.196.165.140:10010/api/mobile/F001/timeclock/clock-in \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "31.2304,121.4737",
    "deviceId": "test-device-001"
  }'
```

#### AI成本分析
```bash
curl -X POST http://139.196.165.140:10010/api/mobile/F001/ai/analysis/cost/batch \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "BATCH-20251120-001",
    "question": "分析这个批次的成本构成，找出可优化的地方"
  }'
```

---

### 13.2 使用JavaScript (Axios)

```javascript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://139.196.165.140:10010/api',
  timeout: 30000,
});

// 请求拦截器 - 添加Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 刷新Token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      const response = await apiClient.post('/mobile/auth/refresh', null, {
        headers: { Authorization: `Bearer ${refreshToken}` },
      });

      const { accessToken } = response.data.data;
      localStorage.setItem('accessToken', accessToken);

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    }

    return Promise.reject(error);
  }
);

// 使用示例
async function getBatches(factoryId, page = 0, size = 10) {
  const response = await apiClient.get(
    `/mobile/${factoryId}/processing/batches`,
    { params: { page, size } }
  );
  return response.data.data;
}

async function createBatch(factoryId, batchData) {
  const response = await apiClient.post(
    `/mobile/${factoryId}/processing/batches`,
    batchData
  );
  return response.data.data;
}

async function clockIn(factoryId, location, deviceId) {
  const response = await apiClient.post(
    `/mobile/${factoryId}/timeclock/clock-in`,
    { location, deviceId }
  );
  return response.data.data;
}
```

---

## 附录

### A. API开发规范

1. **RESTful规范**
   - GET: 查询资源
   - POST: 创建资源
   - PUT: 更新资源（完整更新）
   - PATCH: 更新资源（部分更新）
   - DELETE: 删除资源

2. **路径设计**
   - 移动端API统一前缀: `/api/mobile`
   - 工厂相关API包含factoryId: `/api/mobile/{factoryId}/...`
   - 平台管理API前缀: `/api/platform`

3. **分页规范**
   - `page`: 页码，从0开始
   - `size`: 每页大小，默认20
   - `sort`: 排序字段，格式 `field,direction`（如 `createdAt,desc`）

4. **日期时间格式**
   - 日期: `yyyy-MM-dd` (如 `2025-11-20`)
   - 日期时间: `yyyy-MM-ddTHH:mm:ss` (如 `2025-11-20T14:30:55`)

5. **错误处理**
   - 统一返回格式
   - 明确的错误码
   - 有意义的错误消息

---

### B. 性能建议

1. **使用分页**: 列表查询必须分页
2. **缓存利用**: AI分析结果缓存5分钟
3. **批量操作**: 优先使用批量接口
4. **字段筛选**: 仅请求需要的字段
5. **压缩传输**: 启用gzip压缩

---

### C. 安全建议

1. **HTTPS**: 生产环境必须使用HTTPS
2. **Token管理**:
   - accessToken存储在内存或SecureStore
   - refreshToken仅存储在SecureStore
3. **输入验证**: 前后端双重验证
4. **SQL注入防护**: 使用参数化查询
5. **XSS防护**: 输出转义

---

**文档维护**:
- **版本**: v2.0
- **更新日期**: 2025-11-20
- **维护人**: 后端开发团队
- **反馈渠道**: backend-team@example.com

**相关文档**:
- [业务逻辑总览](./BUSINESS_LOGIC_OVERVIEW.md)
- [功能与文件映射](./prd/PRD-功能与文件映射-v2.0.html)
