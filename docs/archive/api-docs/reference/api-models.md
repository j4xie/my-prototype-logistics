# Cretas食品溯源系统 - API数据模型字典

本文档包含所有API使用的数据模型定义。

---

## 目录

- [🔐 认证相关模型](#-认证相关模型) (14个模型)
- [📱 设备和激活模型](#-设备和激活模型) (4个模型)
- [👤 用户相关模型](#-用户相关模型) (2个模型)
- [📤 文件上传模型](#-文件上传模型) (1个模型)
- [🔄 数据同步模型](#-数据同步模型) (4个模型)
- [🔔 推送通知模型](#-推送通知模型) (1个模型)
- [📊 系统管理模型](#-系统管理模型) (1个模型)
- [📦 版本管理模型](#-版本管理模型) (1个模型)
- [🏭 工厂管理模型](#-工厂管理模型) (16个模型)
- [📋 生产管理模型](#-生产管理模型) (52个模型)
- [📝 其他业务模型](#-其他业务模型) (126个模型)

**总计**: 222 个数据模型

---

## 🔐 认证相关模型

### LoginRequest

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `deviceInfo` | `DeviceInfo` |  |  |
| `factoryId` | `string` |  |  |
| `password` | `string` |  |  |
| `username` | `string` |  |  |

---

### LoginResponse

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `expiresIn` | `integer (int64)` |  |  |
| `factoryId` | `string` |  |  |
| `factoryName` | `string` |  |  |
| `lastLoginTime` | `string (date-time)` |  |  |
| `permissions` | `array<string>` |  |  |
| `profile` | `UserProfile` |  |  |
| `refreshToken` | `string` |  |  |
| `role` | `string` |  |  |
| `token` | `string` |  |  |
| `userId` | `integer (int32)` |  |  |
| `username` | `string` |  |  |

---

### PlatformLoginRequest

**说明**: 平台管理员登录请求

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `deviceInfo` | `string` |  | 设备信息（可选） |
| `password` | `string` | ✓ | 密码 |
| `username` | `string` | ✓ | 用户名 |

---

### PlatformLoginResponse

**说明**: 平台管理员登录响应

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `accessToken` | `string` |  | 访问令牌 |
| `expiresIn` | `integer (int64)` |  | 令牌过期时间（秒） |
| `permissions` | `array<string>` |  | 权限列表 |
| `platformRole` | `string` |  | 平台角色 |
| `realName` | `string` |  | 真实姓名 |
| `refreshToken` | `string` |  | 刷新令牌 |
| `tokenType` | `string` |  | 令牌类型 |
| `userId` | `integer (int32)` |  | 用户ID |
| `userType` | `string` |  | 用户类型 |
| `username` | `string` |  | 用户名 |

---

### RegisterRequest

**说明**: 用户注册请求

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `department` | `string` |  | 部门 |
| `email` | `string` |  | 邮箱（可选） |
| `factoryId` | `string` | ✓ | 工厂ID |
| `password` | `string` | ✓ | 密码 |
| `position` | `string` |  | 职位 |
| `realName` | `string` | ✓ | 真实姓名 |
| `tempToken` | `string` | ✓ | 临时令牌（验证手机后获得） |
| `username` | `string` | ✓ | 用户名 |

---

### RegisterResponse

**说明**: 用户注册响应

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `accessToken` | `string` |  | 访问令牌 |
| `expiresIn` | `integer (int64)` |  | 令牌过期时间（秒） |
| `message` | `string` |  | 提示消息 |
| `refreshToken` | `string` |  | 刷新令牌 |
| `tokenType` | `string` |  | 令牌类型 |
| `user` | `UserDTO` |  | 用户信息 |

---

### RegisterPhaseOneRequest

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `deviceInfo` | `DeviceInfo` |  |  |
| `factoryId` | `string` |  |  |
| `phoneNumber` | `string` |  |  |
| `verificationCode` | `string` |  |  |

---

### RegisterPhaseOneResponse

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `expiresAt` | `integer (int64)` |  |  |
| `factoryId` | `string` |  |  |
| `isNewUser` | `boolean` |  |  |
| `message` | `string` |  |  |
| `phoneNumber` | `string` |  |  |
| `tempToken` | `string` |  |  |

---

### RegisterPhaseTwoRequest

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `deviceInfo` | `DeviceInfo` |  |  |
| `email` | `string` |  |  |
| `factoryId` | `string` |  |  |
| `password` | `string` |  |  |
| `position` | `string` |  |  |
| `realName` | `string` |  |  |
| `tempToken` | `string` |  |  |
| `username` | `string` |  |  |

---

### RegisterPhaseTwoResponse

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `expiresIn` | `integer (int64)` |  |  |
| `factoryId` | `string` |  |  |
| `factoryName` | `string` |  |  |
| `message` | `string` |  |  |
| `profile` | `UserProfile` |  |  |
| `refreshToken` | `string` |  |  |
| `registeredAt` | `string (date-time)` |  |  |
| `role` | `string` |  |  |
| `token` | `string` |  |  |
| `userId` | `integer (int32)` |  |  |
| `username` | `string` |  |  |

---

### VerifyPhoneRequest

**说明**: 手机验证请求

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `factoryId` | `string` |  | 工厂ID（可选，用于验证是否已存在） |
| `phoneNumber` | `string` | ✓ | 手机号 |
| `verificationCode` | `string` | ✓ | 验证码 |

---

### VerifyPhoneResponse

**说明**: 手机验证响应

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `expiresAt` | `integer (int64)` |  | 令牌过期时间（时间戳） |
| `isNewUser` | `boolean` |  | 是否为新用户 |
| `phoneNumber` | `string` |  | 手机号 |
| `tempToken` | `string` |  | 临时令牌（30分钟有效期） |

---

### 刷新令牌请求

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `refreshToken` | `string` | ✓ | 刷新令牌 |

---

### 发送验证码请求

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `factoryId` | `string` | ✓ | 工厂ID |
| `phoneNumber` | `string` | ✓ | 手机号 |

---

## 📱 设备和激活模型

### DeviceInfo

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `appVersion` | `string` |  |  |
| `carrier` | `string` |  |  |
| `deviceId` | `string` |  |  |
| `deviceType` | `string` |  |  |
| `extra` | `object` |  |  |
| `location` | `LocationInfo` |  |  |
| `manufacturer` | `string` |  |  |
| `model` | `string` |  |  |
| `networkType` | `string` |  |  |
| `osVersion` | `string` |  |  |

---

### LocationInfo

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `address` | `string` |  |  |
| `city` | `string` |  |  |
| `country` | `string` |  |  |
| `latitude` | `number (double)` |  |  |
| `longitude` | `number (double)` |  |  |
| `province` | `string` |  |  |

---

### ActivationRequest

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `activationCode` | `string` |  |  |
| `deviceInfo` | `DeviceInfo` |  |  |

---

### ActivationResponse

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `activatedAt` | `string (date-time)` |  |  |
| `configuration` | `object` |  |  |
| `factoryId` | `string` |  |  |
| `factoryName` | `string` |  |  |
| `features` | `array<string>` |  |  |
| `success` | `boolean` |  |  |
| `validUntil` | `string (date-time)` |  |  |

---

## 👤 用户相关模型

### UserDTO

**说明**: 用户信息

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `ccrRate` | `number` |  | CCR费率 |
| `createdAt` | `string (date-time)` |  | 创建时间 |
| `department` | `string` |  | 部门 可选值: `farming`, `processing`, `logistics`, `quality`, `management` |
| `departmentDisplayName` | `string` |  | 部门显示名称 |
| `email` | `string` |  | 邮箱 |
| `expectedWorkMinutes` | `integer (int32)` |  | 预期工作分钟数 |
| `factoryId` | `string` |  | 工厂ID |
| `fullName` | `string` |  | 全名 |
| `id` | `integer (int32)` |  | 用户ID |
| `isActive` | `boolean` |  | 是否激活 |
| `lastLogin` | `string (date-time)` |  | 最后登录时间 |
| `monthlySalary` | `number` |  | 月薪 |
| `phone` | `string` |  | 手机号 |
| `position` | `string` |  | 职位 |
| `roleCode` | `string` |  | 角色代码 可选值: `factory_super_admin`, `permission_admin`, `department_admin`, `operator`, `viewer`, `unactivated` |
| `roleDisplayName` | `string` |  | 角色显示名称 |
| `updatedAt` | `string (date-time)` |  | 更新时间 |
| `username` | `string` |  | 用户名 |

---

### UserProfile

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `avatar` | `string` |  |  |
| `department` | `string` |  |  |
| `email` | `string` |  |  |
| `name` | `string` |  |  |
| `phoneNumber` | `string` |  |  |
| `position` | `string` |  |  |

---

## 📤 文件上传模型

### UploadResponse

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `failedCount` | `integer (int32)` |  |  |
| `files` | `array<UploadedFile>` |  |  |
| `successCount` | `integer (int32)` |  |  |

---

## 🔄 数据同步模型

### SyncRequest

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `dataTypes` | `array<string>` |  |  |
| `lastSyncTime` | `string` |  |  |
| `localChanges` | `object` |  |  |

---

### SyncResponse

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `conflictCount` | `object` |  |  |
| `nextSyncToken` | `string` |  |  |
| `serverData` | `object` |  |  |
| `syncTime` | `string (date-time)` |  |  |

---

### OfflineDataPackage

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `baseData` | `object` |  |  |
| `configData` | `object` |  |  |
| `expiresAt` | `string (date-time)` |  |  |
| `generatedAt` | `string (date-time)` |  |  |
| `packageId` | `string` |  |  |
| `version` | `string` |  |  |

---

### DashboardData

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `alerts` | `array<Alert>` |  |  |
| `quickActions` | `array<QuickAction>` |  |  |
| `recentActivities` | `array<ActivityLog>` |  |  |
| `todayStats` | `TodayStats` |  |  |
| `todoItems` | `array<TodoItem>` |  |  |

---

## 🔔 推送通知模型

### PushRegistration

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `deviceInfo` | `DeviceInfo` |  |  |
| `deviceToken` | `string` |  |  |
| `platform` | `string` |  |  |
| `topics` | `array<string>` |  |  |

---

## 📊 系统管理模型

### SystemLog

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `action` | `string` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `errorMessage` | `string` |  |  |
| `executionTime` | `integer (int64)` |  |  |
| `factoryId` | `string` |  |  |
| `id` | `integer (int64)` |  |  |
| `ipAddress` | `string` |  |  |
| `logLevel` | `string` |  |  |
| `logType` | `string` |  |  |
| `message` | `string` |  |  |
| `module` | `string` |  |  |
| `requestMethod` | `string` |  |  |
| `requestParams` | `string` |  |  |
| `requestUrl` | `string` |  |  |
| `responseData` | `string` |  |  |
| `responseStatus` | `integer (int32)` |  |  |
| `stackTrace` | `string` |  |  |
| `userAgent` | `string` |  |  |
| `userId` | `integer (int32)` |  |  |
| `username` | `string` |  |  |

---

## 📦 版本管理模型

### VersionCheckResponse

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `currentVersion` | `string` |  |  |
| `downloadUrl` | `string` |  |  |
| `fileSize` | `integer (int64)` |  |  |
| `latestVersion` | `string` |  |  |
| `releaseDate` | `string (date-time)` |  |  |
| `releaseNotes` | `string` |  |  |
| `updateAvailable` | `boolean` |  |  |
| `updateRequired` | `boolean` |  |  |

---

## 🏭 工厂管理模型

### AISettings

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `customPrompt` | `string` |  | 自定义提示 |
| `detailLevel` | `string` |  | 详细级别 |
| `enabled` | `boolean` |  | 是否启用 |
| `goal` | `string` |  | 目标 |
| `industryStandards` | `IndustryStandards` |  | 行业标准 |
| `tone` | `string` |  | 语气 |

---

### ApiResponse«AISettings»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `AISettings` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«DataRetentionSettings»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `DataRetentionSettings` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«FactorySettingsDTO»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `FactorySettingsDTO` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«InventorySettings»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `InventorySettings` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«NotificationSettings»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `NotificationSettings` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«ProductionSettings»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `ProductionSettings` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«WorkTimeSettings»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `WorkTimeSettings` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### DataRetentionSettings

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `backupFrequency` | `string` |  | 备份频率 |
| `dataArchiveDays` | `integer (int32)` |  | 数据归档天数 |
| `logRetentionDays` | `integer (int32)` |  | 日志保留天数 |

---

### Factory

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `address` | `string` |  |  |
| `aiWeeklyQuota` | `integer (int32)` |  |  |
| `confidence` | `number (float)` |  |  |
| `contactEmail` | `string` |  |  |
| `contactName` | `string` |  |  |
| `contactPhone` | `string` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `customers` | `array<Customer>` |  |  |
| `employeeCount` | `integer (int32)` |  |  |
| `equipment` | `array<FactoryEquipment>` |  |  |
| `factoryYear` | `integer (int32)` |  |  |
| `id` | `string` |  |  |
| `industry` | `string` |  |  |
| `industryCode` | `string` |  |  |
| `inferenceData` | `string` |  |  |
| `isActive` | `boolean` |  |  |
| `legacyId` | `string` |  |  |
| `manuallyVerified` | `boolean` |  |  |
| `materialBatches` | `array<MaterialBatch>` |  |  |
| `name` | `string` |  |  |
| `productTypes` | `array<ProductType>` |  |  |
| `productionPlans` | `array<ProductionPlan>` |  |  |
| `rawMaterialTypes` | `array<RawMaterialType>` |  |  |
| `regionCode` | `string` |  |  |
| `sequenceNumber` | `integer (int32)` |  |  |
| `subscriptionPlan` | `string` |  |  |
| `suppliers` | `array<Supplier>` |  |  |
| `updatedAt` | `string (date-time)` |  |  |
| `users` | `array<User>` |  |  |
| `workTypes` | `array<WorkType>` |  |  |

---

### FactoryEquipment

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `string` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `createdBy` | `integer (int32)` |  |  |
| `depreciationYears` | `integer (int32)` |  |  |
| `equipmentCode` | `string` |  |  |
| `equipmentUsages` | `array<BatchEquipmentUsage>` |  |  |
| `factory` | `Factory` |  |  |
| `factoryId` | `string` |  |  |
| `hourlyCost` | `number` |  |  |
| `id` | `integer (int32)` |  |  |
| `lastMaintenanceDate` | `string (date)` |  |  |
| `location` | `string` |  |  |
| `maintenanceIntervalHours` | `integer (int32)` |  |  |
| `maintenanceRecords` | `array<EquipmentMaintenance>` |  |  |
| `manufacturer` | `string` |  |  |
| `model` | `string` |  |  |
| `name` | `string` |  |  |
| `nextMaintenanceDate` | `string (date)` |  |  |
| `notes` | `string` |  |  |
| `powerConsumptionKw` | `number` |  |  |
| `purchaseDate` | `string (date)` |  |  |
| `purchasePrice` | `number` |  |  |
| `serialNumber` | `string` |  |  |
| `status` | `string` |  |  |
| `totalRunningHours` | `integer (int32)` |  |  |
| `type` | `string` |  |  |
| `updatedAt` | `string (date-time)` |  |  |
| `warrantyExpiryDate` | `string (date)` |  |  |

---

### FactorySettingsDTO

**说明**: 工厂设置信息

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `aiSettings` | `AISettings` |  | AI设置 |
| `aiWeeklyQuota` | `integer (int32)` |  | AI每周配额 |
| `allowSelfRegistration` | `boolean` |  | 允许自注册 |
| `currency` | `string` |  | 货币 |
| `dataRetentionSettings` | `DataRetentionSettings` |  | 数据保留设置 |
| `dateFormat` | `string` |  | 日期格式 |
| `defaultUserRole` | `string` |  | 默认用户角色 |
| `enableAttendance` | `boolean` |  | 启用考勤管理 |
| `enableBatchManagement` | `boolean` |  | 启用批次管理 |
| `enableCostCalculation` | `boolean` |  | 启用成本核算 |
| `enableEquipmentManagement` | `boolean` |  | 启用设备管理 |
| `enableQrCode` | `boolean` |  | 启用QR码 |
| `enableQualityCheck` | `boolean` |  | 启用质量检测 |
| `factoryId` | `string` | ✓ | 工厂ID |
| `id` | `integer (int32)` |  | 设置ID |
| `inventorySettings` | `InventorySettings` |  | 库存设置 |
| `language` | `string` |  | 语言 |
| `lastModifiedAt` | `string (date-time)` |  | 最后修改时间 |
| `notificationSettings` | `NotificationSettings` |  | 通知设置 |
| `productionSettings` | `ProductionSettings` |  | 生产设置 |
| `requireAdminApproval` | `boolean` |  | 需要管理员审批 |
| `timezone` | `string` |  | 时区 |
| `workTimeSettings` | `WorkTimeSettings` |  | 工作时间设置 |

---

### InventorySettings

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `autoReorderPoint` | `integer (int32)` |  | 自动补货点 |
| `maxStockLimit` | `integer (int32)` |  | 最高库存限制 |
| `minStockAlert` | `integer (int32)` |  | 最低库存预警 |

---

### NotificationSettings

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `emailEnabled` | `boolean` |  | 启用邮件通知 |
| `pushEnabled` | `boolean` |  | 启用推送通知 |
| `smsEnabled` | `boolean` |  | 启用短信通知 |
| `wechatEnabled` | `boolean` |  | 启用微信通知 |

---

### ProductionSettings

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `autoApprovalThreshold` | `integer (int32)` |  | 自动审批阈值 |
| `defaultBatchSize` | `integer (int32)` |  | 默认批次大小 |
| `qualityCheckFrequency` | `integer (int32)` |  | 质检频率 |

---

### WorkTimeSettings

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `endTime` | `string` |  | 结束时间 |
| `holidays` | `string` |  | 节假日 |
| `startTime` | `string` |  | 开始时间 |
| `workDays` | `string` |  | 工作日 |

---

## 📋 生产管理模型

### ApiResponse«ConversionDTO»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `ConversionDTO` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«ConversionStatistics»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `ConversionStatistics` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«ConversionDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<ConversionDTO>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«MaterialBatchDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<MaterialBatchDTO>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«MaterialRequirement»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<MaterialRequirement>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«ProductOutput»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<ProductOutput>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«ProductTypeDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<ProductTypeDTO>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«ProductionPlanDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<ProductionPlanDTO>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«RawMaterialTypeDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<RawMaterialTypeDTO>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«MaterialBatchDTO»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `MaterialBatchDTO` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«MaterialBatch»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `MaterialBatch` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PageResponse«ConversionDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PageResponse«ConversionDTO»` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PageResponse«MaterialBatchDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PageResponse«MaterialBatchDTO»` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PageResponse«MaterialBatch»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PageResponse«MaterialBatch»` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PageResponse«ProductTypeDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PageResponse«ProductTypeDTO»` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PageResponse«ProductionBatch»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PageResponse«ProductionBatch»` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PageResponse«ProductionPlanDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PageResponse«ProductionPlanDTO»` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PageResponse«RawMaterialTypeDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PageResponse«RawMaterialTypeDTO»` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«ProductTypeDTO»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `ProductTypeDTO` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«ProductionBatch»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `ProductionBatch` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«ProductionPlanDTO»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `ProductionPlanDTO` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«ProductivityAnalysis»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `ProductivityAnalysis` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«RawMaterialTypeDTO»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `RawMaterialTypeDTO` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ConversionDTO

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `conversionRate` | `number` |  |  |
| `id` | `integer (int32)` |  |  |
| `isActive` | `boolean` |  |  |
| `materialTypeId` | `integer (int32)` |  |  |
| `materialTypeName` | `string` |  |  |
| `materialUnit` | `string` |  |  |
| `maxBatchSize` | `number` |  |  |
| `minBatchSize` | `number` |  |  |
| `notes` | `string` |  |  |
| `productCode` | `string` |  |  |
| `productTypeId` | `integer (int32)` |  |  |
| `productTypeName` | `string` |  |  |
| `productUnit` | `string` |  |  |
| `standardUsage` | `number` |  |  |
| `wastageRate` | `number` |  |  |

---

### ConversionStatistics

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `activeConversions` | `integer (int64)` |  |  |
| `averageConversionRate` | `number` |  |  |
| `averageWastageRate` | `number` |  |  |
| `inactiveConversions` | `integer (int64)` |  |  |
| `materialTypes` | `integer (int64)` |  |  |
| `productTypes` | `integer (int64)` |  |  |
| `totalConversions` | `integer (int64)` |  |  |

---

### CreateMaterialBatchRequest

**说明**: 创建原材料批次请求

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `expireDate` | `string (date)` |  | 到期日期 |
| `initialQuantity` | `number` | ✓ | 初始数量 |
| `materialTypeId` | `integer (int32)` | ✓ | 原材料类型ID |
| `notes` | `string` |  | 备注 |
| `purchaseDate` | `string (date)` | ✓ | 采购日期 |
| `qualityCertificate` | `string` |  | 质量证书 |
| `shelfLifeDays` | `integer (int32)` |  | 保质期天数（如果未提供到期日期） |
| `storageLocation` | `string` |  | 存储位置 |
| `supplierId` | `integer (int32)` |  | 供应商ID |
| `unitPrice` | `number` | ✓ | 单价 |

---

### CreateProductionPlanRequest

**说明**: 创建生产计划请求

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `customerId` | `integer (int32)` |  | 客户ID |
| `customerOrderNumber` | `string` |  | 客户订单号 |
| `estimatedEquipmentCost` | `number` |  | 预估设备成本 |
| `estimatedLaborCost` | `number` |  | 预估人工成本 |
| `estimatedMaterialCost` | `number` |  | 预估材料成本 |
| `estimatedOtherCost` | `number` |  | 预估其他成本 |
| `materialBatchIds` | `array<integer>` |  | 原材料批次ID列表 |
| `notes` | `string` |  | 备注 |
| `plannedDate` | `string (date)` | ✓ | 计划日期 |
| `plannedQuantity` | `number` | ✓ | 计划数量 |
| `priority` | `integer (int32)` |  | 优先级(1-10) |
| `productTypeId` | `integer (int32)` | ✓ | 产品类型ID |

---

### MaterialBatch

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `adjustments` | `array<MaterialBatchAdjustment>` |  |  |
| `batchNumber` | `string` |  |  |
| `consumptions` | `array<MaterialConsumption>` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `createdBy` | `integer (int32)` |  |  |
| `createdByUser` | `User` |  |  |
| `currentQuantity` | `number` |  |  |
| `expireDate` | `string (date)` |  |  |
| `factory` | `Factory` |  |  |
| `factoryId` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `initialQuantity` | `number` |  |  |
| `lastUsedAt` | `string (date-time)` |  |  |
| `materialType` | `RawMaterialType` |  |  |
| `materialTypeId` | `integer (int32)` |  |  |
| `notes` | `string` |  |  |
| `planBatchUsages` | `array<ProductionPlanBatchUsage>` |  |  |
| `purchaseDate` | `string (date)` |  |  |
| `qualityCertificate` | `string` |  |  |
| `remainingQuantity` | `number` |  |  |
| `reservedQuantity` | `number` |  |  |
| `status` | `string` |  |  可选值: `AVAILABLE`, `USED_UP`, `EXPIRED`, `INSPECTING`, `SCRAPPED` |
| `storageLocation` | `string` |  |  |
| `supplier` | `Supplier` |  |  |
| `supplierId` | `integer (int32)` |  |  |
| `totalPrice` | `number` |  |  |
| `totalQuantity` | `number` |  |  |
| `unitPrice` | `number` |  |  |
| `updatedAt` | `string (date-time)` |  |  |
| `usedQuantity` | `number` |  |  |

---

### MaterialBatchAdjustment

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `adjustedBy` | `integer (int32)` |  |  |
| `adjustedByUser` | `User` |  |  |
| `adjustmentQuantity` | `number` |  |  |
| `adjustmentTime` | `string (date-time)` |  |  |
| `adjustmentType` | `string` |  |  |
| `batch` | `MaterialBatch` |  |  |
| `batchId` | `integer (int32)` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `id` | `integer (int32)` |  |  |
| `notes` | `string` |  |  |
| `quantityAfter` | `number` |  |  |
| `quantityBefore` | `number` |  |  |
| `reason` | `string` |  |  |
| `updatedAt` | `string (date-time)` |  |  |

---

### MaterialBatchDTO

**说明**: 原材料批次信息

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `batchNumber` | `string` |  | 批次号 |
| `createdAt` | `string (date-time)` |  | 创建时间 |
| `createdBy` | `integer (int32)` |  | 创建人ID |
| `createdByName` | `string` |  | 创建人姓名 |
| `currentQuantity` | `number` |  | 当前数量 |
| `expireDate` | `string (date)` |  | 到期日期 |
| `factoryId` | `string` |  | 工厂ID |
| `id` | `integer (int32)` |  | 批次ID |
| `initialQuantity` | `number` |  | 初始数量 |
| `lastUsedAt` | `string (date-time)` |  | 最后使用时间 |
| `materialCategory` | `string` |  | 原材料类别 |
| `materialCode` | `string` |  | 原材料代码 |
| `materialName` | `string` |  | 原材料名称 |
| `materialTypeId` | `integer (int32)` |  | 原材料类型ID |
| `notes` | `string` |  | 备注 |
| `purchaseDate` | `string (date)` |  | 采购日期 |
| `qualityCertificate` | `string` |  | 质量证书 |
| `remainingDays` | `integer (int32)` |  | 剩余天数 |
| `status` | `string` |  | 状态 可选值: `AVAILABLE`, `USED_UP`, `EXPIRED`, `INSPECTING`, `SCRAPPED` |
| `statusDisplayName` | `string` |  | 状态显示名称 |
| `storageLocation` | `string` |  | 存储位置 |
| `supplierId` | `integer (int32)` |  | 供应商ID |
| `supplierName` | `string` |  | 供应商名称 |
| `totalPrice` | `number` |  | 总价 |
| `unit` | `string` |  | 单位 |
| `unitPrice` | `number` |  | 单价 |
| `updatedAt` | `string (date-time)` |  | 更新时间 |
| `usageRate` | `number` |  | 库存占用率 |

---

### MaterialConsumption

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `batch` | `MaterialBatch` |  |  |
| `batchId` | `integer (int32)` |  |  |
| `consumedAt` | `string (date-time)` |  |  |
| `consumptionTime` | `string (date-time)` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `factory` | `Factory` |  |  |
| `factoryId` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `notes` | `string` |  |  |
| `productionBatchId` | `integer (int64)` |  |  |
| `productionPlan` | `ProductionPlan` |  |  |
| `productionPlanId` | `integer (int32)` |  |  |
| `quantity` | `number` |  |  |
| `recordedBy` | `integer (int32)` |  |  |
| `recorder` | `User` |  |  |
| `totalCost` | `number` |  |  |
| `unitPrice` | `number` |  |  |
| `updatedAt` | `string (date-time)` |  |  |

---

### MaterialProductConversion

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `conversionRate` | `number` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `createdBy` | `integer (int32)` |  |  |
| `factory` | `Factory` |  |  |
| `factoryId` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `isActive` | `boolean` |  |  |
| `materialType` | `RawMaterialType` |  |  |
| `materialTypeId` | `integer (int32)` |  |  |
| `maxBatchSize` | `number` |  |  |
| `minBatchSize` | `number` |  |  |
| `notes` | `string` |  |  |
| `productType` | `ProductType` |  |  |
| `productTypeId` | `integer (int32)` |  |  |
| `standardUsage` | `number` |  |  |
| `updatedAt` | `string (date-time)` |  |  |
| `updatedBy` | `integer (int32)` |  |  |
| `wastageRate` | `number` |  |  |

---

### MaterialRequirement

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `materialTypeId` | `integer (int32)` |  |  |
| `materialTypeName` | `string` |  |  |
| `quantity` | `number` |  |  |
| `totalQuantity` | `number` |  |  |
| `unit` | `string` |  |  |
| `wastageQuantity` | `number` |  |  |

---

### PageResponse«ConversionDTO»

**说明**: 分页响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | `array<ConversionDTO>` |  | 数据列表 |
| `first` | `boolean` |  | 是否第一页 |
| `last` | `boolean` |  | 是否最后一页 |
| `page` | `integer (int32)` |  | 当前页码 |
| `size` | `integer (int32)` |  | 每页大小 |
| `totalElements` | `integer (int64)` |  | 总记录数 |
| `totalPages` | `integer (int32)` |  | 总页数 |

---

### PageResponse«MaterialBatchDTO»

**说明**: 分页响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | `array<MaterialBatchDTO>` |  | 数据列表 |
| `first` | `boolean` |  | 是否第一页 |
| `last` | `boolean` |  | 是否最后一页 |
| `page` | `integer (int32)` |  | 当前页码 |
| `size` | `integer (int32)` |  | 每页大小 |
| `totalElements` | `integer (int64)` |  | 总记录数 |
| `totalPages` | `integer (int32)` |  | 总页数 |

---

### PageResponse«MaterialBatch»

**说明**: 分页响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | `array<MaterialBatch>` |  | 数据列表 |
| `first` | `boolean` |  | 是否第一页 |
| `last` | `boolean` |  | 是否最后一页 |
| `page` | `integer (int32)` |  | 当前页码 |
| `size` | `integer (int32)` |  | 每页大小 |
| `totalElements` | `integer (int64)` |  | 总记录数 |
| `totalPages` | `integer (int32)` |  | 总页数 |

---

### PageResponse«ProductTypeDTO»

**说明**: 分页响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | `array<ProductTypeDTO>` |  | 数据列表 |
| `first` | `boolean` |  | 是否第一页 |
| `last` | `boolean` |  | 是否最后一页 |
| `page` | `integer (int32)` |  | 当前页码 |
| `size` | `integer (int32)` |  | 每页大小 |
| `totalElements` | `integer (int64)` |  | 总记录数 |
| `totalPages` | `integer (int32)` |  | 总页数 |

---

### PageResponse«ProductionBatch»

**说明**: 分页响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | `array<ProductionBatch>` |  | 数据列表 |
| `first` | `boolean` |  | 是否第一页 |
| `last` | `boolean` |  | 是否最后一页 |
| `page` | `integer (int32)` |  | 当前页码 |
| `size` | `integer (int32)` |  | 每页大小 |
| `totalElements` | `integer (int64)` |  | 总记录数 |
| `totalPages` | `integer (int32)` |  | 总页数 |

---

### PageResponse«ProductionPlanDTO»

**说明**: 分页响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | `array<ProductionPlanDTO>` |  | 数据列表 |
| `first` | `boolean` |  | 是否第一页 |
| `last` | `boolean` |  | 是否最后一页 |
| `page` | `integer (int32)` |  | 当前页码 |
| `size` | `integer (int32)` |  | 每页大小 |
| `totalElements` | `integer (int64)` |  | 总记录数 |
| `totalPages` | `integer (int32)` |  | 总页数 |

---

### PageResponse«RawMaterialTypeDTO»

**说明**: 分页响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | `array<RawMaterialTypeDTO>` |  | 数据列表 |
| `first` | `boolean` |  | 是否第一页 |
| `last` | `boolean` |  | 是否最后一页 |
| `page` | `integer (int32)` |  | 当前页码 |
| `size` | `integer (int32)` |  | 每页大小 |
| `totalElements` | `integer (int64)` |  | 总记录数 |
| `totalPages` | `integer (int32)` |  | 总页数 |

---

### ProcessingBatch

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `batchNumber` | `string` |  |  |
| `batchWorkSessions` | `array<BatchWorkSession>` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `endTime` | `string (date-time)` |  |  |
| `equipmentCost` | `number` |  |  |
| `equipmentUsages` | `array<BatchEquipmentUsage>` |  |  |
| `factory` | `Factory` |  |  |
| `factoryId` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `laborCost` | `number` |  |  |
| `materialCost` | `number` |  |  |
| `notes` | `string` |  |  |
| `otherCost` | `number` |  |  |
| `productName` | `string` |  |  |
| `quantity` | `number` |  |  |
| `startTime` | `string (date-time)` |  |  |
| `status` | `string` |  |  |
| `supervisor` | `User` |  |  |
| `supervisorId` | `integer (int32)` |  |  |
| `totalCost` | `number` |  |  |
| `unit` | `string` |  |  |
| `updatedAt` | `string (date-time)` |  |  |

---

### ProductOutput

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `efficiency` | `number` |  |  |
| `productTypeId` | `integer (int32)` |  |  |
| `productTypeName` | `string` |  |  |
| `quantity` | `number` |  |  |
| `unit` | `string` |  |  |

---

### ProductType

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `category` | `string` |  |  |
| `code` | `string` |  |  |
| `conversions` | `array<MaterialProductConversion>` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `createdBy` | `integer (int32)` |  |  |
| `createdByUser` | `User` |  |  |
| `factory` | `Factory` |  |  |
| `factoryId` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `isActive` | `boolean` |  |  |
| `name` | `string` |  |  |
| `notes` | `string` |  |  |
| `packageSpec` | `string` |  |  |
| `productionPlans` | `array<ProductionPlan>` |  |  |
| `productionTimeMinutes` | `integer (int32)` |  |  |
| `shelfLifeDays` | `integer (int32)` |  |  |
| `unit` | `string` |  |  |
| `unitPrice` | `number` |  |  |
| `updatedAt` | `string (date-time)` |  |  |

---

### ProductTypeDTO

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `activePlans` | `integer (int32)` |  |  |
| `category` | `string` |  |  |
| `code` | `string` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `createdBy` | `integer (int32)` |  |  |
| `createdByName` | `string` |  |  |
| `factoryId` | `string` |  |  |
| `factoryName` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `isActive` | `boolean` |  |  |
| `name` | `string` |  |  |
| `notes` | `string` |  |  |
| `packageSpec` | `string` |  |  |
| `productionTimeMinutes` | `integer (int32)` |  |  |
| `shelfLifeDays` | `integer (int32)` |  |  |
| `totalProducedQuantity` | `number` |  |  |
| `totalProductionPlans` | `integer (int32)` |  |  |
| `unit` | `string` |  |  |
| `unitPrice` | `number` |  |  |
| `updatedAt` | `string (date-time)` |  |  |

---

### ProductionBatch

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `actualQuantity` | `number` |  |  |
| `batchNumber` | `string` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `createdBy` | `integer (int32)` |  |  |
| `defectQuantity` | `number` |  |  |
| `efficiency` | `number` |  |  |
| `endTime` | `string (date-time)` |  |  |
| `equipmentCost` | `number` |  |  |
| `equipmentId` | `integer (int32)` |  |  |
| `equipmentName` | `string` |  |  |
| `factoryId` | `string` |  |  |
| `goodQuantity` | `number` |  |  |
| `id` | `integer (int64)` |  |  |
| `laborCost` | `number` |  |  |
| `materialCost` | `number` |  |  |
| `notes` | `string` |  |  |
| `otherCost` | `number` |  |  |
| `plannedQuantity` | `number` |  |  |
| `productName` | `string` |  |  |
| `productTypeId` | `integer (int32)` |  |  |
| `productionPlanId` | `integer (int32)` |  |  |
| `qualityStatus` | `string` |  |  |
| `startTime` | `string (date-time)` |  |  |
| `status` | `string` |  |  |
| `supervisorId` | `integer (int32)` |  |  |
| `supervisorName` | `string` |  |  |
| `totalCost` | `number` |  |  |
| `unitCost` | `number` |  |  |
| `updatedAt` | `string (date-time)` |  |  |
| `workDurationMinutes` | `integer (int32)` |  |  |
| `workerCount` | `integer (int32)` |  |  |
| `yieldRate` | `number` |  |  |

---

### ProductionPlan

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `actualEquipmentCost` | `number` |  |  |
| `actualLaborCost` | `number` |  |  |
| `actualMaterialCost` | `number` |  |  |
| `actualOtherCost` | `number` |  |  |
| `actualQuantity` | `number` |  |  |
| `batchUsages` | `array<ProductionPlanBatchUsage>` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `createdBy` | `integer (int32)` |  |  |
| `createdByUser` | `User` |  |  |
| `customerOrderNumber` | `string` |  |  |
| `endTime` | `string (date-time)` |  |  |
| `estimatedEquipmentCost` | `number` |  |  |
| `estimatedLaborCost` | `number` |  |  |
| `estimatedMaterialCost` | `number` |  |  |
| `estimatedOtherCost` | `number` |  |  |
| `factory` | `Factory` |  |  |
| `factoryId` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `materialConsumptions` | `array<MaterialConsumption>` |  |  |
| `notes` | `string` |  |  |
| `planNumber` | `string` |  |  |
| `plannedDate` | `string (date)` |  |  |
| `plannedQuantity` | `number` |  |  |
| `priority` | `integer (int32)` |  |  |
| `productType` | `ProductType` |  |  |
| `productTypeId` | `integer (int32)` |  |  |
| `startTime` | `string (date-time)` |  |  |
| `status` | `string` |  |  可选值: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `PAUSED` |
| `updatedAt` | `string (date-time)` |  |  |

---

### ProductionPlanBatchUsage

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `actualQuantity` | `number` |  |  |
| `batchId` | `integer (int32)` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `id` | `integer (int32)` |  |  |
| `materialBatch` | `MaterialBatch` |  |  |
| `materialBatchId` | `integer (int32)` |  |  |
| `plannedQuantity` | `number` |  |  |
| `productionPlan` | `ProductionPlan` |  |  |
| `productionPlanId` | `integer (int32)` |  |  |
| `reservedQuantity` | `number` |  |  |
| `updatedAt` | `string (date-time)` |  |  |
| `usedQuantity` | `number` |  |  |

---

### ProductionPlanDTO

**说明**: 生产计划信息

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `actualEquipmentCost` | `number` |  | 实际设备成本 |
| `actualLaborCost` | `number` |  | 实际人工成本 |
| `actualMaterialCost` | `number` |  | 实际材料成本 |
| `actualOtherCost` | `number` |  | 实际其他成本 |
| `actualQuantity` | `number` |  | 实际数量 |
| `createdAt` | `string (date-time)` |  | 创建时间 |
| `createdBy` | `integer (int32)` |  | 创建人ID |
| `createdByName` | `string` |  | 创建人姓名 |
| `customerOrderNumber` | `string` |  | 客户订单号 |
| `endTime` | `string (date-time)` |  | 结束时间 |
| `estimatedEquipmentCost` | `number` |  | 预估设备成本 |
| `estimatedLaborCost` | `number` |  | 预估人工成本 |
| `estimatedMaterialCost` | `number` |  | 预估材料成本 |
| `estimatedOtherCost` | `number` |  | 预估其他成本 |
| `factoryId` | `string` |  | 工厂ID |
| `id` | `integer (int32)` |  | 计划ID |
| `notes` | `string` |  | 备注 |
| `planNumber` | `string` |  | 计划编号 |
| `plannedDate` | `string (date)` |  | 计划日期 |
| `plannedQuantity` | `number` |  | 计划数量 |
| `priority` | `integer (int32)` |  | 优先级 |
| `productName` | `string` |  | 产品名称 |
| `productTypeId` | `integer (int32)` |  | 产品类型ID |
| `productUnit` | `string` |  | 产品单位 |
| `startTime` | `string (date-time)` |  | 开始时间 |
| `status` | `string` |  | 状态 可选值: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `PAUSED` |
| `statusDisplayName` | `string` |  | 状态显示名称 |
| `totalCost` | `number` |  | 总成本 |
| `updatedAt` | `string (date-time)` |  | 更新时间 |

---

### ProductionStatistics

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `activePlans` | `integer (int32)` |  |  |
| `completedPlans` | `integer (int32)` |  |  |
| `completionRate` | `number (double)` |  |  |
| `efficiency` | `number (double)` |  |  |
| `monthlyOutput` | `number` |  |  |
| `totalOutput` | `number` |  |  |
| `totalPlans` | `integer (int32)` |  |  |

---

### ProductivityAnalysis

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `efficiencyIndex` | `number` |  | 效率指数 |
| `growthRate` | `number` |  | 环比增长 |
| `improvements` | `array<string>` |  | 改进建议 |
| `mostEfficientDepartment` | `string` |  | 最高效部门 |
| `mostEfficientWorkType` | `string` |  | 最高效工作类型 |
| `outputPerHour` | `number` |  | 时均产出 |
| `outputPerWorker` | `number` |  | 人均产出 |
| `period` | `string` |  | 时间段 |
| `totalInputHours` | `number` |  | 总投入工时 |
| `totalOutput` | `number` |  | 总产出 |
| `trend` | `string` |  | 趋势 |

---

### RawMaterialType

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `category` | `string` |  |  |
| `code` | `string` |  |  |
| `conversions` | `array<MaterialProductConversion>` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `createdBy` | `integer (int32)` |  |  |
| `createdByUser` | `User` |  |  |
| `factory` | `Factory` |  |  |
| `factoryId` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `isActive` | `boolean` |  |  |
| `materialBatches` | `array<MaterialBatch>` |  |  |
| `maxStock` | `number` |  |  |
| `minStock` | `number` |  |  |
| `name` | `string` |  |  |
| `notes` | `string` |  |  |
| `shelfLifeDays` | `integer (int32)` |  |  |
| `storageType` | `string` |  |  |
| `unit` | `string` |  |  |
| `unitPrice` | `number` |  |  |
| `updatedAt` | `string (date-time)` |  |  |

---

### RawMaterialTypeDTO

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `category` | `string` |  |  |
| `code` | `string` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `createdBy` | `integer (int32)` |  |  |
| `createdByName` | `string` |  |  |
| `currentStock` | `number` |  |  |
| `factoryId` | `string` |  |  |
| `factoryName` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `isActive` | `boolean` |  |  |
| `maxStock` | `number` |  |  |
| `minStock` | `number` |  |  |
| `name` | `string` |  |  |
| `notes` | `string` |  |  |
| `shelfLifeDays` | `integer (int32)` |  |  |
| `storageType` | `string` |  |  |
| `totalBatches` | `integer (int32)` |  |  |
| `totalValue` | `number` |  |  |
| `unit` | `string` |  |  |
| `unitPrice` | `number` |  |  |
| `updatedAt` | `string (date-time)` |  |  |

---

## 📝 其他业务模型

### ActivityLog

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `description` | `string` |  |  |
| `id` | `string` |  |  |
| `operator` | `string` |  |  |
| `time` | `string (date-time)` |  |  |
| `title` | `string` |  |  |
| `type` | `string` |  |  |

---

### Alert

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `string` |  |  |
| `message` | `string` |  |  |
| `severity` | `string` |  |  |
| `time` | `string (date-time)` |  |  |
| `title` | `string` |  |  |
| `type` | `string` |  |  |

---

### AlertInfo

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `date` | `string (date)` |  |  |
| `level` | `string` |  |  |
| `message` | `string` |  |  |
| `targetId` | `string` |  |  |
| `targetName` | `string` |  |  |
| `type` | `string` |  |  |

---

### ApiResponse«ActivationResponse»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `ActivationResponse` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«BatchResult»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `BatchResult` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«CustomerDTO»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `CustomerDTO` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«DashboardData»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `DashboardData` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«DashboardStatisticsDTO»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `DashboardStatisticsDTO` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«EquipmentDTO»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `EquipmentDTO` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«CustomerDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<CustomerDTO>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«DailyStats»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<DailyStats>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«DeviceInfo»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<DeviceInfo>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«EquipmentDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<EquipmentDTO>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«Map«string,object»»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<Map«string,object»>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«SupplierDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<SupplierDTO>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«UserDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<UserDTO>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«WhitelistDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<WhitelistDTO>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«WorkTypeDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<WorkTypeDTO>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«WorkerTimeStats»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<WorkerTimeStats>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«List«string»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `array<string>` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«LoginResponse»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `LoginResponse` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«Map«int,long»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `object` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«Map«string,boolean»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `object` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«Map«string,long»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `object` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«Map«string,object»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `object` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«Map«string,string»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `object` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«OfflineDataPackage»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `OfflineDataPackage` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PageResponse«CustomerDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PageResponse«CustomerDTO»` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PageResponse«EquipmentDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PageResponse«EquipmentDTO»` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PageResponse«Map«string,object»»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PageResponse«Map«string,object»»` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PageResponse«SupplierDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PageResponse«SupplierDTO»` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PageResponse«SystemLog»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PageResponse«SystemLog»` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PageResponse«TimeClockRecord»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PageResponse«TimeClockRecord»` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PageResponse«UserDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PageResponse«UserDTO»` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PageResponse«WhitelistDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PageResponse«WhitelistDTO»` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PageResponse«WorkTypeDTO»»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PageResponse«WorkTypeDTO»` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«PlatformLoginResponse»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `PlatformLoginResponse` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«RegisterPhaseOneResponse»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `RegisterPhaseOneResponse` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«RegisterPhaseTwoResponse»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `RegisterPhaseTwoResponse` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«RegisterResponse»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `RegisterResponse` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«SupplierDTO»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `SupplierDTO` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«SyncResponse»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `SyncResponse` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«TimeClockRecord»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `TimeClockRecord` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«TimeStatsDTO»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `TimeStatsDTO` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«UploadResponse»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `UploadResponse` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«UserDTO»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `UserDTO` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«ValidationResponse»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `ValidationResponse` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«ValidationResult»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `ValidationResult` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«VerifyPhoneResponse»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `VerifyPhoneResponse` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«VersionCheckResponse»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `VersionCheckResponse` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«Void»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«WhitelistDTO»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `WhitelistDTO` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«WhitelistStats»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `WhitelistStats` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«WorkTypeDTO»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `WorkTypeDTO` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«WorkTypeStats»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `WorkTypeStats` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«WorkerTimeStats»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `WorkerTimeStats` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«bigdecimal»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `number` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«boolean»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `boolean` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«double»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `number (double)` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«int»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `integer (int32)` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«object»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `object` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### ApiResponse«string»

**说明**: 统一API响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | `integer (int32)` |  | 响应状态码 |
| `data` | `string` |  | 响应数据 |
| `message` | `string` |  | 响应消息 |
| `success` | `boolean` |  | 请求是否成功 |
| `timestamp` | `string (date-time)` |  | 响应时间戳 |

---

### BatchAddRequest

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `department` | `string` |  |  |
| `entries` | `array<WhitelistEntry>` |  |  |
| `expiresAt` | `string (date-time)` |  |  |
| `maxUsageCount` | `integer (int32)` |  |  |
| `notes` | `string` |  |  |
| `role` | `string` |  |  |

---

### BatchEquipmentUsage

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `batch` | `ProcessingBatch` |  |  |
| `batchId` | `integer (int32)` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `endTime` | `string (date-time)` |  |  |
| `equipment` | `FactoryEquipment` |  |  |
| `equipmentCost` | `number` |  |  |
| `equipmentId` | `integer (int32)` |  |  |
| `id` | `integer (int32)` |  |  |
| `powerConsumption` | `number` |  |  |
| `startTime` | `string (date-time)` |  |  |
| `updatedAt` | `string (date-time)` |  |  |
| `usageHours` | `number` |  |  |

---

### BatchResult

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `failedCount` | `integer (int32)` |  |  |
| `failedEntries` | `array<FailedEntry>` |  |  |
| `successCount` | `integer (int32)` |  |  |
| `successPhones` | `array<string>` |  |  |

---

### BatchWorkSession

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `batch` | `ProcessingBatch` |  |  |
| `batchId` | `integer (int32)` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `employee` | `User` |  |  |
| `employeeId` | `integer (int32)` |  |  |
| `id` | `integer (int32)` |  |  |
| `laborCost` | `number` |  |  |
| `updatedAt` | `string (date-time)` |  |  |
| `workMinutes` | `integer (int32)` |  |  |
| `workSession` | `EmployeeWorkSession` |  |  |
| `workSessionId` | `integer (int32)` |  |  |

---

### CreateCustomerRequest

**说明**: 创建客户请求

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `billingAddress` | `string` |  | 账单地址 |
| `businessLicense` | `string` |  | 营业执照号 |
| `contactPerson` | `string` | ✓ | 联系人 |
| `creditLimit` | `number` |  | 信用额度 |
| `email` | `string` |  | 邮箱 |
| `industry` | `string` |  | 所属行业 |
| `name` | `string` | ✓ | 客户名称 |
| `notes` | `string` |  | 备注 |
| `paymentTerms` | `string` |  | 付款条款 |
| `phone` | `string` | ✓ | 联系电话 |
| `rating` | `integer (int32)` |  | 客户评级 (1-5) |
| `ratingNotes` | `string` |  | 评级说明 |
| `shippingAddress` | `string` | ✓ | 收货地址 |
| `taxNumber` | `string` |  | 税号 |
| `type` | `string` |  | 客户类型 |

---

### CreateEquipmentRequest

**说明**: 创建设备请求

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `depreciationYears` | `integer (int32)` |  | 折旧年限 |
| `hourlyCost` | `number` |  | 每小时成本 |
| `location` | `string` |  | 设备位置 |
| `maintenanceIntervalHours` | `integer (int32)` |  | 维护间隔(小时) |
| `manufacturer` | `string` |  | 制造商 |
| `model` | `string` |  | 设备型号 |
| `name` | `string` | ✓ | 设备名称 |
| `notes` | `string` |  | 备注 |
| `powerConsumptionKw` | `number` |  | 功率(千瓦) |
| `purchaseDate` | `string (date)` |  | 购买日期 |
| `purchasePrice` | `number` |  | 购买价格 |
| `serialNumber` | `string` |  | 序列号 |
| `type` | `string` |  | 设备类型 |
| `warrantyExpiryDate` | `string (date)` |  | 保修到期日 |

---

### CreateSupplierRequest

**说明**: 创建供应商请求

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `address` | `string` | ✓ | 地址 |
| `bankAccount` | `string` |  | 银行账号 |
| `bankName` | `string` |  | 开户银行 |
| `businessLicense` | `string` |  | 营业执照号 |
| `contactPerson` | `string` | ✓ | 联系人 |
| `creditLimit` | `number` |  | 信用额度 |
| `deliveryDays` | `integer (int32)` |  | 交货天数 |
| `email` | `string` |  | 邮箱 |
| `name` | `string` | ✓ | 供应商名称 |
| `notes` | `string` |  | 备注 |
| `paymentTerms` | `string` |  | 付款条款 |
| `phone` | `string` | ✓ | 联系电话 |
| `qualityCertificates` | `string` |  | 质量认证证书 |
| `rating` | `integer (int32)` |  | 供应商评级 (1-5) |
| `ratingNotes` | `string` |  | 评级说明 |
| `suppliedMaterials` | `string` |  | 供应材料类型 |
| `taxNumber` | `string` |  | 税号 |

---

### CreateUserRequest

**说明**: 创建用户请求

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `ccrRate` | `number` |  | CCR费率 |
| `department` | `string` |  | 部门 可选值: `farming`, `processing`, `logistics`, `quality`, `management` |
| `email` | `string` | ✓ | 邮箱 |
| `expectedWorkMinutes` | `integer (int32)` |  | 预期工作分钟数 |
| `fullName` | `string` |  | 全名 |
| `monthlySalary` | `number` |  | 月薪 |
| `password` | `string` | ✓ | 密码 |
| `phone` | `string` |  | 手机号 |
| `position` | `string` |  | 职位 |
| `roleCode` | `string` | ✓ | 角色代码 可选值: `factory_super_admin`, `permission_admin`, `department_admin`, `operator`, `viewer`, `unactivated` |
| `username` | `string` | ✓ | 用户名 |

---

### Customer

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `billingAddress` | `string` |  |  |
| `businessLicense` | `string` |  |  |
| `code` | `string` |  |  |
| `contactEmail` | `string` |  |  |
| `contactName` | `string` |  |  |
| `contactPerson` | `string` |  |  |
| `contactPhone` | `string` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `createdBy` | `integer (int32)` |  |  |
| `createdByUser` | `User` |  |  |
| `creditLimit` | `number` |  |  |
| `currentBalance` | `number` |  |  |
| `customerCode` | `string` |  |  |
| `email` | `string` |  |  |
| `factory` | `Factory` |  |  |
| `factoryId` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `industry` | `string` |  |  |
| `isActive` | `boolean` |  |  |
| `name` | `string` |  |  |
| `notes` | `string` |  |  |
| `paymentTerms` | `string` |  |  |
| `phone` | `string` |  |  |
| `rating` | `integer (int32)` |  |  |
| `ratingNotes` | `string` |  |  |
| `shipmentRecords` | `array<ShipmentRecord>` |  |  |
| `shippingAddress` | `string` |  |  |
| `taxNumber` | `string` |  |  |
| `type` | `string` |  |  |
| `updatedAt` | `string (date-time)` |  |  |

---

### CustomerDTO

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `averageOrderValue` | `number` |  |  |
| `billingAddress` | `string` |  |  |
| `businessLicense` | `string` |  |  |
| `contactPerson` | `string` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `createdBy` | `integer (int32)` |  |  |
| `createdByName` | `string` |  |  |
| `creditLimit` | `number` |  |  |
| `currentBalance` | `number` |  |  |
| `customerCode` | `string` |  |  |
| `email` | `string` |  |  |
| `factoryId` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `industry` | `string` |  |  |
| `isActive` | `boolean` |  |  |
| `lastOrderDate` | `string (date-time)` |  |  |
| `name` | `string` |  |  |
| `notes` | `string` |  |  |
| `paymentTerms` | `string` |  |  |
| `phone` | `string` |  |  |
| `rating` | `integer (int32)` |  |  |
| `ratingNotes` | `string` |  |  |
| `shippingAddress` | `string` |  |  |
| `taxNumber` | `string` |  |  |
| `totalOrders` | `integer (int32)` |  |  |
| `totalSales` | `number` |  |  |
| `type` | `string` |  |  |
| `updatedAt` | `string (date-time)` |  |  |

---

### DailyStats

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `activeWorkers` | `integer (int32)` |  | 活跃员工数 |
| `attendanceRate` | `number` |  | 出勤率 |
| `clockIns` | `integer (int64)` |  | 打卡次数 |
| `date` | `string (date)` |  | 日期 |
| `dayOfWeek` | `string` |  | 星期 |
| `isWorkday` | `boolean` |  | 是否工作日 |
| `totalHours` | `number` |  | 总工时 |

---

### DailyTrend

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `changeRate` | `number (double)` |  |  |
| `date` | `string (date)` |  |  |
| `value` | `number` |  |  |

---

### DashboardStatisticsDTO

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `alerts` | `array<AlertInfo>` |  |  |
| `equipmentStats` | `EquipmentStatistics` |  |  |
| `financeStats` | `FinanceStatistics` |  |  |
| `inventoryStats` | `InventoryStatistics` |  |  |
| `personnelStats` | `PersonnelStatistics` |  |  |
| `productionStats` | `ProductionStatistics` |  |  |
| `qualityStats` | `QualityStatistics` |  |  |
| `trendStats` | `TrendStatistics` |  |  |

---

### DepartmentStats

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `attendanceRate` | `number` |  | 出勤率 |
| `averageHours` | `number` |  | 平均工时 |
| `departmentName` | `string` |  | 部门名称 |
| `overtimeHours` | `number` |  | 加班工时 |
| `totalHours` | `number` |  | 总工时 |
| `workerCount` | `integer (int32)` |  | 员工数 |

---

### DisplayOrderUpdate

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `displayOrder` | `integer (int32)` |  |  |
| `id` | `integer (int32)` |  |  |

---

### EmployeeWorkSession

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `actualWorkMinutes` | `integer (int32)` |  |  |
| `batchWorkSessions` | `array<BatchWorkSession>` |  |  |
| `breakMinutes` | `integer (int32)` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `endTime` | `string (date-time)` |  |  |
| `factory` | `Factory` |  |  |
| `factoryId` | `string` |  |  |
| `hourlyRate` | `number` |  |  |
| `id` | `integer (int32)` |  |  |
| `laborCost` | `number` |  |  |
| `notes` | `string` |  |  |
| `startTime` | `string (date-time)` |  |  |
| `status` | `string` |  |  |
| `updatedAt` | `string (date-time)` |  |  |
| `user` | `User` |  |  |
| `userId` | `integer (int32)` |  |  |
| `workType` | `WorkType` |  |  |
| `workTypeId` | `integer (int32)` |  |  |

---

### EquipmentDTO

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `availability` | `number (double)` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `createdBy` | `integer (int32)` |  |  |
| `createdByName` | `string` |  |  |
| `currentValue` | `number` |  |  |
| `depreciationYears` | `integer (int32)` |  |  |
| `efficiency` | `number (double)` |  |  |
| `equipmentCode` | `string` |  |  |
| `factoryId` | `string` |  |  |
| `hourlyCost` | `number` |  |  |
| `id` | `integer (int32)` |  |  |
| `lastMaintenanceDate` | `string (date)` |  |  |
| `location` | `string` |  |  |
| `maintenanceCount` | `integer (int32)` |  |  |
| `maintenanceIntervalHours` | `integer (int32)` |  |  |
| `manufacturer` | `string` |  |  |
| `model` | `string` |  |  |
| `name` | `string` |  |  |
| `needsMaintenance` | `boolean` |  |  |
| `nextMaintenanceDate` | `string (date)` |  |  |
| `notes` | `string` |  |  |
| `powerConsumptionKw` | `number` |  |  |
| `purchaseDate` | `string (date)` |  |  |
| `purchasePrice` | `number` |  |  |
| `serialNumber` | `string` |  |  |
| `status` | `string` |  |  |
| `totalMaintenanceCost` | `number` |  |  |
| `totalOperatingCost` | `number` |  |  |
| `totalRunningHours` | `integer (int32)` |  |  |
| `type` | `string` |  |  |
| `updatedAt` | `string (date-time)` |  |  |
| `utilizationRate` | `number (double)` |  |  |
| `warrantyExpiryDate` | `string (date)` |  |  |

---

### EquipmentMaintenance

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `cost` | `number` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `description` | `string` |  |  |
| `endTime` | `string (date-time)` |  |  |
| `equipment` | `FactoryEquipment` |  |  |
| `equipmentId` | `integer (int32)` |  |  |
| `id` | `integer (int32)` |  |  |
| `maintenanceDate` | `string (date)` |  |  |
| `maintenanceType` | `string` |  |  |
| `nextMaintenanceDate` | `string (date)` |  |  |
| `notes` | `string` |  |  |
| `performedBy` | `string` |  |  |
| `startTime` | `string (date-time)` |  |  |
| `updatedAt` | `string (date-time)` |  |  |

---

### EquipmentStatistics

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `availability` | `number (double)` |  |  |
| `idleEquipment` | `integer (int32)` |  |  |
| `maintenanceEquipment` | `integer (int32)` |  |  |
| `needsMaintenance` | `integer (int32)` |  |  |
| `runningEquipment` | `integer (int32)` |  |  |
| `totalEquipment` | `integer (int32)` |  |  |
| `totalValue` | `number` |  |  |
| `utilizationRate` | `number (double)` |  |  |

---

### FailedEntry

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `phoneNumber` | `string` |  |  |
| `reason` | `string` |  |  |

---

### FinanceStatistics

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `accountsPayable` | `number` |  |  |
| `accountsReceivable` | `number` |  |  |
| `monthlyCost` | `number` |  |  |
| `monthlyProfit` | `number` |  |  |
| `monthlyRevenue` | `number` |  |  |
| `profitMargin` | `number (double)` |  |  |
| `totalCost` | `number` |  |  |
| `totalProfit` | `number` |  |  |
| `totalRevenue` | `number` |  |  |

---

### IndustryStandards

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `equipmentUtilization` | `integer (int32)` |  | 设备利用率 |
| `laborCostPercentage` | `integer (int32)` |  | 人工成本百分比 |
| `profitMargin` | `integer (int32)` |  | 利润率 |

---

### InventoryStatistics

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `expiredBatches` | `integer (int32)` |  |  |
| `expiringBatches` | `integer (int32)` |  |  |
| `lowStockItems` | `integer (int32)` |  |  |
| `totalBatches` | `integer (int32)` |  |  |
| `totalMaterials` | `integer (int32)` |  |  |
| `totalValue` | `number` |  |  |
| `turnoverRate` | `number` |  |  |

---

### Map«int,long»

**类型**: `object`

---

### Map«string,boolean»

**类型**: `object`

---

### Map«string,long»

**类型**: `object`

---

### Map«string,object»

**类型**: `object`

---

### Map«string,string»

**类型**: `object`

---

### ModulePermissions

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `adminAccess` | `boolean` |  |  |
| `debugAccess` | `boolean` |  |  |
| `farmingAccess` | `boolean` |  |  |
| `logisticsAccess` | `boolean` |  |  |
| `platformAccess` | `boolean` |  |  |
| `processingAccess` | `boolean` |  |  |
| `systemConfig` | `boolean` |  |  |
| `traceAccess` | `boolean` |  |  |

---

### PageResponse«CustomerDTO»

**说明**: 分页响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | `array<CustomerDTO>` |  | 数据列表 |
| `first` | `boolean` |  | 是否第一页 |
| `last` | `boolean` |  | 是否最后一页 |
| `page` | `integer (int32)` |  | 当前页码 |
| `size` | `integer (int32)` |  | 每页大小 |
| `totalElements` | `integer (int64)` |  | 总记录数 |
| `totalPages` | `integer (int32)` |  | 总页数 |

---

### PageResponse«EquipmentDTO»

**说明**: 分页响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | `array<EquipmentDTO>` |  | 数据列表 |
| `first` | `boolean` |  | 是否第一页 |
| `last` | `boolean` |  | 是否最后一页 |
| `page` | `integer (int32)` |  | 当前页码 |
| `size` | `integer (int32)` |  | 每页大小 |
| `totalElements` | `integer (int64)` |  | 总记录数 |
| `totalPages` | `integer (int32)` |  | 总页数 |

---

### PageResponse«Map«string,object»»

**说明**: 分页响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | `array<Map«string,object»>` |  | 数据列表 |
| `first` | `boolean` |  | 是否第一页 |
| `last` | `boolean` |  | 是否最后一页 |
| `page` | `integer (int32)` |  | 当前页码 |
| `size` | `integer (int32)` |  | 每页大小 |
| `totalElements` | `integer (int64)` |  | 总记录数 |
| `totalPages` | `integer (int32)` |  | 总页数 |

---

### PageResponse«SupplierDTO»

**说明**: 分页响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | `array<SupplierDTO>` |  | 数据列表 |
| `first` | `boolean` |  | 是否第一页 |
| `last` | `boolean` |  | 是否最后一页 |
| `page` | `integer (int32)` |  | 当前页码 |
| `size` | `integer (int32)` |  | 每页大小 |
| `totalElements` | `integer (int64)` |  | 总记录数 |
| `totalPages` | `integer (int32)` |  | 总页数 |

---

### PageResponse«SystemLog»

**说明**: 分页响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | `array<SystemLog>` |  | 数据列表 |
| `first` | `boolean` |  | 是否第一页 |
| `last` | `boolean` |  | 是否最后一页 |
| `page` | `integer (int32)` |  | 当前页码 |
| `size` | `integer (int32)` |  | 每页大小 |
| `totalElements` | `integer (int64)` |  | 总记录数 |
| `totalPages` | `integer (int32)` |  | 总页数 |

---

### PageResponse«TimeClockRecord»

**说明**: 分页响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | `array<TimeClockRecord>` |  | 数据列表 |
| `first` | `boolean` |  | 是否第一页 |
| `last` | `boolean` |  | 是否最后一页 |
| `page` | `integer (int32)` |  | 当前页码 |
| `size` | `integer (int32)` |  | 每页大小 |
| `totalElements` | `integer (int64)` |  | 总记录数 |
| `totalPages` | `integer (int32)` |  | 总页数 |

---

### PageResponse«UserDTO»

**说明**: 分页响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | `array<UserDTO>` |  | 数据列表 |
| `first` | `boolean` |  | 是否第一页 |
| `last` | `boolean` |  | 是否最后一页 |
| `page` | `integer (int32)` |  | 当前页码 |
| `size` | `integer (int32)` |  | 每页大小 |
| `totalElements` | `integer (int64)` |  | 总记录数 |
| `totalPages` | `integer (int32)` |  | 总页数 |

---

### PageResponse«WhitelistDTO»

**说明**: 分页响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | `array<WhitelistDTO>` |  | 数据列表 |
| `first` | `boolean` |  | 是否第一页 |
| `last` | `boolean` |  | 是否最后一页 |
| `page` | `integer (int32)` |  | 当前页码 |
| `size` | `integer (int32)` |  | 每页大小 |
| `totalElements` | `integer (int64)` |  | 总记录数 |
| `totalPages` | `integer (int32)` |  | 总页数 |

---

### PageResponse«WorkTypeDTO»

**说明**: 分页响应对象

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | `array<WorkTypeDTO>` |  | 数据列表 |
| `first` | `boolean` |  | 是否第一页 |
| `last` | `boolean` |  | 是否最后一页 |
| `page` | `integer (int32)` |  | 当前页码 |
| `size` | `integer (int32)` |  | 每页大小 |
| `totalElements` | `integer (int64)` |  | 总记录数 |
| `totalPages` | `integer (int32)` |  | 总页数 |

---

### PersonnelStatistics

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `activeEmployees` | `integer (int32)` |  |  |
| `attendanceRate` | `number (double)` |  |  |
| `averageSalary` | `number` |  |  |
| `departmentCount` | `integer (int32)` |  |  |
| `todayAbsent` | `integer (int32)` |  |  |
| `todayPresent` | `integer (int32)` |  |  |
| `totalEmployees` | `integer (int32)` |  |  |
| `totalSalary` | `number` |  |  |

---

### QualityStatistics

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `defectiveProduction` | `number` |  |  |
| `firstPassRate` | `number (double)` |  |  |
| `qualifiedProduction` | `number` |  |  |
| `qualityIssues` | `integer (int32)` |  |  |
| `qualityRate` | `number (double)` |  |  |
| `resolvedIssues` | `integer (int32)` |  |  |
| `totalProduction` | `number` |  |  |

---

### QuickAction

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `action` | `string` |  |  |
| `color` | `string` |  |  |
| `icon` | `string` |  |  |
| `id` | `string` |  |  |
| `orderIndex` | `integer (int32)` |  |  |
| `title` | `string` |  |  |

---

### Session

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `createdAt` | `string (date-time)` |  |  |
| `expiresAt` | `string (date-time)` |  |  |
| `factory` | `Factory` |  |  |
| `factoryId` | `string` |  |  |
| `id` | `string` |  |  |
| `isRevoked` | `boolean` |  |  |
| `refreshToken` | `string` |  |  |
| `token` | `string` |  |  |
| `updatedAt` | `string (date-time)` |  |  |
| `user` | `User` |  |  |
| `userId` | `integer (int32)` |  |  |

---

### ShipmentRecord

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `createdAt` | `string (date-time)` |  |  |
| `customer` | `Customer` |  |  |
| `customerId` | `integer (int32)` |  |  |
| `deliveryAddress` | `string` |  |  |
| `factory` | `Factory` |  |  |
| `factoryId` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `logisticsCompany` | `string` |  |  |
| `notes` | `string` |  |  |
| `orderNumber` | `string` |  |  |
| `productName` | `string` |  |  |
| `quantity` | `number` |  |  |
| `recordedBy` | `integer (int32)` |  |  |
| `recorder` | `User` |  |  |
| `shipmentDate` | `string (date)` |  |  |
| `shipmentNumber` | `string` |  |  |
| `status` | `string` |  |  |
| `totalAmount` | `number` |  |  |
| `trackingNumber` | `string` |  |  |
| `unit` | `string` |  |  |
| `unitPrice` | `number` |  |  |
| `updatedAt` | `string (date-time)` |  |  |

---

### Supplier

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `address` | `string` |  |  |
| `bankAccount` | `string` |  |  |
| `bankName` | `string` |  |  |
| `businessLicense` | `string` |  |  |
| `code` | `string` |  |  |
| `contactEmail` | `string` |  |  |
| `contactName` | `string` |  |  |
| `contactPerson` | `string` |  |  |
| `contactPhone` | `string` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `createdBy` | `integer (int32)` |  |  |
| `createdByUser` | `User` |  |  |
| `creditLimit` | `number` |  |  |
| `currentBalance` | `number` |  |  |
| `deliveryDays` | `integer (int32)` |  |  |
| `email` | `string` |  |  |
| `factory` | `Factory` |  |  |
| `factoryId` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `isActive` | `boolean` |  |  |
| `materialBatches` | `array<MaterialBatch>` |  |  |
| `name` | `string` |  |  |
| `notes` | `string` |  |  |
| `paymentTerms` | `string` |  |  |
| `phone` | `string` |  |  |
| `qualityCertificates` | `string` |  |  |
| `rating` | `integer (int32)` |  |  |
| `ratingNotes` | `string` |  |  |
| `suppliedMaterials` | `string` |  |  |
| `supplierCode` | `string` |  |  |
| `taxNumber` | `string` |  |  |
| `updatedAt` | `string (date-time)` |  |  |

---

### SupplierDTO

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `address` | `string` |  |  |
| `bankAccount` | `string` |  |  |
| `bankName` | `string` |  |  |
| `businessLicense` | `string` |  |  |
| `contactPerson` | `string` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `createdBy` | `integer (int32)` |  |  |
| `createdByName` | `string` |  |  |
| `creditLimit` | `number` |  |  |
| `currentBalance` | `number` |  |  |
| `deliveryDays` | `integer (int32)` |  |  |
| `email` | `string` |  |  |
| `factoryId` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `isActive` | `boolean` |  |  |
| `lastOrderDate` | `string (date-time)` |  |  |
| `name` | `string` |  |  |
| `notes` | `string` |  |  |
| `paymentTerms` | `string` |  |  |
| `phone` | `string` |  |  |
| `qualityCertificates` | `string` |  |  |
| `rating` | `integer (int32)` |  |  |
| `ratingNotes` | `string` |  |  |
| `suppliedMaterials` | `string` |  |  |
| `supplierCode` | `string` |  |  |
| `taxNumber` | `string` |  |  |
| `totalAmount` | `number` |  |  |
| `totalOrders` | `integer (int32)` |  |  |
| `updatedAt` | `string (date-time)` |  |  |

---

### TimeClockRecord

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `attendanceStatus` | `string` |  |  |
| `breakDurationMinutes` | `integer (int32)` |  |  |
| `breakEndTime` | `string (date-time)` |  |  |
| `breakStartTime` | `string (date-time)` |  |  |
| `clockDate` | `string (date)` |  |  |
| `clockDevice` | `string` |  |  |
| `clockInTime` | `string (date-time)` |  |  |
| `clockLocation` | `string` |  |  |
| `clockOutTime` | `string (date-time)` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `editReason` | `string` |  |  |
| `editedBy` | `integer (int32)` |  |  |
| `factoryId` | `string` |  |  |
| `id` | `integer (int64)` |  |  |
| `isManualEdit` | `boolean` |  |  |
| `notes` | `string` |  |  |
| `overtimeMinutes` | `integer (int32)` |  |  |
| `status` | `string` |  |  |
| `updatedAt` | `string (date-time)` |  |  |
| `userId` | `integer (int32)` |  |  |
| `username` | `string` |  |  |
| `workDurationMinutes` | `integer (int32)` |  |  |
| `workTypeId` | `integer (int32)` |  |  |
| `workTypeName` | `string` |  |  |

---

### TimeStatsDTO

**说明**: 时间统计信息

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `absentCount` | `integer (int64)` |  | 缺勤次数 |
| `activeWorkers` | `integer (int32)` |  | 活跃员工数 |
| `attendanceRate` | `number` |  | 出勤率 |
| `averageHours` | `number` |  | 平均工时 |
| `dailyStatsList` | `array<DailyStats>` |  | 日统计列表 |
| `departmentStats` | `object` |  | 按部门统计 |
| `earlyLeaveCount` | `integer (int64)` |  | 早退次数 |
| `endDate` | `string (date)` |  | 结束日期 |
| `lateCount` | `integer (int64)` |  | 迟到次数 |
| `overtimeHours` | `number` |  | 加班工时 |
| `period` | `string` |  | 统计周期 |
| `productivity` | `number` |  | 生产效率 |
| `regularHours` | `number` |  | 正常工时 |
| `startDate` | `string (date)` |  | 开始日期 |
| `totalClockIns` | `integer (int64)` |  | 总打卡次数 |
| `totalHours` | `number` |  | 总工时 |
| `workTypeStats` | `object` |  | 按工作类型统计 |

---

### TodayStats

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `activeWorkers` | `integer (int32)` |  |  |
| `materialReceived` | `integer (int32)` |  |  |
| `ordersCompleted` | `integer (int32)` |  |  |
| `productionCount` | `integer (int32)` |  |  |
| `productionEfficiency` | `number (double)` |  |  |
| `qualityCheckCount` | `integer (int32)` |  |  |

---

### TodoItem

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `description` | `string` |  |  |
| `dueTime` | `string (date-time)` |  |  |
| `id` | `string` |  |  |
| `priority` | `string` |  |  |
| `status` | `string` |  |  |
| `title` | `string` |  |  |

---

### TrendStatistics

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `dailyCost` | `array<DailyTrend>` |  |  |
| `dailyProduction` | `array<DailyTrend>` |  |  |
| `dailyQuality` | `array<DailyTrend>` |  |  |
| `dailyRevenue` | `array<DailyTrend>` |  |  |
| `monthlyComparison` | `object` |  |  |

---

### UpdateRequest

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `department` | `string` |  |  |
| `expiresAt` | `string (date-time)` |  |  |
| `maxUsageCount` | `integer (int32)` |  |  |
| `name` | `string` |  |  |
| `notes` | `string` |  |  |
| `permissions` | `array<string>` |  |  |
| `position` | `string` |  |  |
| `role` | `string` |  |  |
| `status` | `string` |  |  |

---

### UploadedFile

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `contentType` | `string` |  |  |
| `id` | `string` |  |  |
| `originalName` | `string` |  |  |
| `size` | `integer (int64)` |  |  |
| `thumbnailUrl` | `string` |  |  |
| `uploadTime` | `string (date-time)` |  |  |
| `url` | `string` |  |  |

---

### User

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `avatar` | `string` |  |  |
| `batchAdjustments` | `array<MaterialBatchAdjustment>` |  |  |
| `batchWorkSessions` | `array<BatchWorkSession>` |  |  |
| `ccrRate` | `number` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `createdCustomers` | `array<Customer>` |  |  |
| `createdMaterialBatches` | `array<MaterialBatch>` |  |  |
| `createdMaterialTypes` | `array<RawMaterialType>` |  |  |
| `createdProductTypes` | `array<ProductType>` |  |  |
| `createdProductionPlans` | `array<ProductionPlan>` |  |  |
| `createdSuppliers` | `array<Supplier>` |  |  |
| `department` | `string` |  |  可选值: `farming`, `processing`, `logistics`, `quality`, `management` |
| `email` | `string` |  |  |
| `expectedWorkMinutes` | `integer (int32)` |  |  |
| `factory` | `Factory` |  |  |
| `factoryId` | `string` |  |  |
| `fullName` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `isActive` | `boolean` |  |  |
| `lastLogin` | `string (date-time)` |  |  |
| `materialConsumptions` | `array<MaterialConsumption>` |  |  |
| `monthlySalary` | `number` |  |  |
| `name` | `string` |  |  |
| `password` | `string` |  |  |
| `passwordHash` | `string` |  |  |
| `permissions` | `string` |  |  |
| `phone` | `string` |  |  |
| `position` | `string` |  |  |
| `role` | `string` |  |  |
| `roleCode` | `string` |  |  可选值: `factory_super_admin`, `permission_admin`, `department_admin`, `operator`, `viewer`, `unactivated` |
| `sessions` | `array<Session>` |  |  |
| `updatedAt` | `string (date-time)` |  |  |
| `username` | `string` |  |  |
| `workSessions` | `array<EmployeeWorkSession>` |  |  |

---

### UserPermissions

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `features` | `array<string>` |  | 功能权限 |
| `modules` | `ModulePermissions` |  | 模块权限 |
| `role` | `string` |  | 角色名称 |
| `roleLevel` | `integer (int32)` |  | 角色级别 |
| `userType` | `string` |  | 用户类型 |

---

### ValidationResponse

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `expiresAt` | `string (date-time)` |  |  |
| `invalidReason` | `string` |  |  |
| `isValid` | `boolean` |  |  |
| `name` | `string` |  |  |
| `permissions` | `array<string>` |  |  |
| `phoneNumber` | `string` |  |  |
| `remainingUsage` | `integer (int32)` |  |  |
| `role` | `string` |  |  |

---

### ValidationResult

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `errors` | `array<string>` |  |  |
| `valid` | `boolean` |  |  |
| `warnings` | `array<string>` |  |  |

---

### WhitelistDTO

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `addedBy` | `integer (int32)` |  |  |
| `addedByName` | `string` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `daysUntilExpiry` | `integer (int32)` |  |  |
| `department` | `string` |  |  |
| `expiresAt` | `string (date-time)` |  |  |
| `factoryId` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `isExpiringSoon` | `boolean` |  |  |
| `isValid` | `boolean` |  |  |
| `lastUsedAt` | `string (date-time)` |  |  |
| `maxUsageCount` | `integer (int32)` |  |  |
| `name` | `string` |  |  |
| `notes` | `string` |  |  |
| `permissions` | `array<string>` |  |  |
| `phoneNumber` | `string` |  |  |
| `position` | `string` |  |  |
| `remainingUsage` | `integer (int32)` |  |  |
| `role` | `string` |  |  |
| `status` | `string` |  |  |
| `updatedAt` | `string (date-time)` |  |  |
| `usageCount` | `integer (int32)` |  |  |

---

### WhitelistEntry

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `name` | `string` |  |  |
| `phoneNumber` | `string` |  |  |
| `position` | `string` |  |  |

---

### WhitelistStats

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `activeCount` | `integer (int64)` |  |  |
| `activeUsersCount` | `integer (int64)` |  |  |
| `averageUsage` | `number (double)` |  |  |
| `countByDepartment` | `object` |  |  |
| `countByRole` | `object` |  |  |
| `disabledCount` | `integer (int64)` |  |  |
| `expiredCount` | `integer (int64)` |  |  |
| `expiringSoonCount` | `integer (int64)` |  |  |
| `expiringSoonUsers` | `array<WhitelistDTO>` |  |  |
| `lastUpdated` | `string (date-time)` |  |  |
| `limitReachedCount` | `integer (int64)` |  |  |
| `mostActiveUsers` | `array<WhitelistDTO>` |  |  |
| `recentlyUsedUsers` | `array<WhitelistDTO>` |  |  |
| `todayAddedCount` | `integer (int64)` |  |  |
| `totalCount` | `integer (int64)` |  |  |
| `totalUsageCount` | `integer (int64)` |  |  |

---

### WorkType

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `baseRate` | `number` |  |  |
| `billingType` | `string` |  |  |
| `certificationRequired` | `boolean` |  |  |
| `code` | `string` |  |  |
| `color` | `string` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `department` | `string` |  |  |
| `description` | `string` |  |  |
| `displayOrder` | `integer (int32)` |  |  |
| `factory` | `Factory` |  |  |
| `factoryId` | `string` |  |  |
| `hazardLevel` | `integer (int32)` |  |  |
| `holidayRateMultiplier` | `number` |  |  |
| `icon` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `isActive` | `boolean` |  |  |
| `isDefault` | `boolean` |  |  |
| `name` | `string` |  |  |
| `nightShiftRateMultiplier` | `number` |  |  |
| `overtimeRateMultiplier` | `number` |  |  |
| `requiredSkills` | `string` |  |  |
| `updatedAt` | `string (date-time)` |  |  |

---

### WorkTypeDTO

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `activeEmployeeCount` | `integer (int32)` |  |  |
| `averageWorkHours` | `number` |  |  |
| `baseRate` | `number` |  |  |
| `billingType` | `string` |  |  |
| `certificationRequired` | `boolean` |  |  |
| `code` | `string` |  |  |
| `color` | `string` |  |  |
| `createdAt` | `string (date-time)` |  |  |
| `department` | `string` |  |  |
| `description` | `string` |  |  |
| `displayOrder` | `integer (int32)` |  |  |
| `factoryId` | `string` |  |  |
| `hazardLevel` | `integer (int32)` |  |  |
| `holidayRateMultiplier` | `number` |  |  |
| `icon` | `string` |  |  |
| `id` | `integer (int32)` |  |  |
| `isActive` | `boolean` |  |  |
| `isDefault` | `boolean` |  |  |
| `name` | `string` |  |  |
| `nightShiftRateMultiplier` | `number` |  |  |
| `overtimeRateMultiplier` | `number` |  |  |
| `requiredSkills` | `string` |  |  |
| `totalWorkHours` | `number` |  |  |
| `updatedAt` | `string (date-time)` |  |  |

---

### WorkTypeStats

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `activeTypes` | `integer (int32)` |  |  |
| `inactiveTypes` | `integer (int32)` |  |  |
| `lastUpdated` | `string (date-time)` |  |  |
| `leastUsedTypes` | `array<WorkTypeUsage>` |  |  |
| `mostUsedTypes` | `array<WorkTypeUsage>` |  |  |
| `totalTypes` | `integer (int32)` |  |  |
| `typesByBillingType` | `object` |  |  |
| `typesByDepartment` | `object` |  |  |
| `typesByHazardLevel` | `object` |  |  |
| `typesRequiringCertification` | `integer (int32)` |  |  |

---

### WorkTypeUsage

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `employeeCount` | `integer (int32)` |  |  |
| `totalHours` | `number` |  |  |
| `totalPaid` | `number` |  |  |
| `usageCount` | `integer (int32)` |  |  |
| `workTypeId` | `integer (int32)` |  |  |
| `workTypeName` | `string` |  |  |

---

### WorkerTimeStats

**类型**: `object`

**字段列表**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `attendanceDays` | `integer (int32)` |  | 出勤天数 |
| `attendanceRate` | `number` |  | 出勤率 |
| `department` | `string` |  | 部门 |
| `earlyLeaveCount` | `integer (int32)` |  | 早退次数 |
| `lateCount` | `integer (int32)` |  | 迟到次数 |
| `overtimeHours` | `number` |  | 加班工时 |
| `ranking` | `integer (int32)` |  | 排名 |
| `regularHours` | `number` |  | 正常工时 |
| `totalHours` | `number` |  | 总工时 |
| `workerId` | `integer (int32)` |  | 员工ID |
| `workerName` | `string` |  | 员工姓名 |

---


## 📚 使用说明

### 类型说明

- `string`: 字符串
- `integer`: 整数
- `number`: 数字（包括小数）
- `boolean`: 布尔值 (true/false)
- `array<T>`: 数组，元素类型为 T
- `object`: 对象/字典
- `date`: 日期格式字符串
- `date-time`: 日期时间格式字符串

### 常用数据模型关系

```
登录流程:
  LoginRequest → LoginResponse (包含 UserProfile)

注册流程:
  RegisterPhaseOneRequest → RegisterPhaseOneResponse (获得tempToken)
  RegisterPhaseTwoRequest → RegisterPhaseTwoResponse (包含 UserProfile)

设备激活:
  ActivationRequest → ActivationResponse

文件上传:
  multipart/form-data → UploadResponse

数据同步:
  SyncRequest → SyncResponse
  离线数据: OfflineDataPackage
```

---

## 🔗 相关文档

- [移动端API专用指南](./mobile-api-guide.md)
- [完整API参考文档](./swagger-api-reference.md)
- [项目开发指南](../../CLAUDE.md)

---

**Swagger文档地址**: http://47.251.121.76:10010/swagger-ui.html
