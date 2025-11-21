# PRD-API-FactorySettingsController（工厂设置控制器）

**文档版本**: v1.0.0
**创建日期**: 2025-11-20
**Controller路径**: `/api/mobile/{factoryId}/settings`
**所属模块**: 系统配置模块
**Controller文件**: `FactorySettingsController.java` (264行)

---

## 📋 目录 (Table of Contents)

1. [Controller概述](#controller概述)
2. [端点清单](#端点清单)
3. [详细API文档](#详细api文档)
   - [3.1 获取工厂设置](#31-获取工厂设置)
   - [3.2 更新工厂设置](#32-更新工厂设置)
   - [3.3 获取AI设置](#33-获取ai设置)
   - [3.4 更新AI设置](#34-更新ai设置)
   - [3.5 获取AI使用统计](#35-获取ai使用统计)
   - [3.6 获取通知设置](#36-获取通知设置)
   - [3.7 更新通知设置](#37-更新通知设置)
   - [3.8 获取工作时间设置](#38-获取工作时间设置)
   - [3.9 更新工作时间设置](#39-更新工作时间设置)
   - [3.10 获取生产设置](#310-获取生产设置)
   - [3.11 更新生产设置](#311-更新生产设置)
   - [3.12 获取库存设置](#312-获取库存设置)
   - [3.13 更新库存设置](#313-更新库存设置)
   - [3.14 获取数据保留设置](#314-获取数据保留设置)
   - [3.15 更新数据保留设置](#315-更新数据保留设置)
   - [3.16 获取功能开关](#316-获取功能开关)
   - [3.17 更新功能开关](#317-更新功能开关)
   - [3.18 获取显示设置](#318-获取显示设置)
   - [3.19 更新显示设置](#319-更新显示设置)
   - [3.20 重置为默认设置](#320-重置为默认设置)
   - [3.21 导出设置](#321-导出设置)
   - [3.22 导入设置](#322-导入设置)
4. [数据模型](#数据模型)
5. [业务规则](#业务规则)
6. [错误处理](#错误处理)
7. [前端集成指南](#前端集成指南)

---

## Controller概述

### 功能描述

**FactorySettingsController** 负责管理工厂的所有配置和设置，是系统配置管理的中心。

**核心功能**:
- ✅ **整体设置管理**: 获取和更新工厂的全部设置
- ✅ **AI设置**: DeepSeek AI配置、每周配额、使用统计
- ✅ **通知设置**: 推送通知、邮件通知、短信通知配置
- ✅ **工作时间设置**: 工作时间、休息时间、加班设置
- ✅ **生产设置**: 生产流程配置、质量标准、批次规则
- ✅ **库存设置**: 库存预警、FIFO/LIFO、盘点规则
- ✅ **数据保留设置**: 数据保留期限、自动清理规则
- ✅ **功能开关**: 功能启用/禁用开关
- ✅ **显示设置**: 语言、时区、日期格式、货币
- ✅ **导入导出**: 设置备份、恢复、重置

**业务价值**:
- ⚙️ **灵活配置**: 工厂可根据自身需求定制系统行为
- 🔔 **通知管理**: 精细化控制通知渠道和频率
- 📊 **AI成本控制**: 配额管理，防止AI费用超支
- 🌐 **国际化支持**: 多语言、多时区、多货币
- 💾 **数据治理**: 合规的数据保留和清理策略

**使用场景**:
1. 工厂初始化时配置基础设置（时区、语言、工作时间）
2. 管理员调整AI配额，控制DeepSeek使用成本
3. 配置通知规则，选择接收推送/邮件/短信
4. 设置库存预警阈值，防止缺货
5. 开启/关闭特定功能（如AI分析、自动盘点）
6. 备份设置到JSON，迁移到新工厂

---

## 端点清单

| # | HTTP方法 | 端点路径 | 功能描述 | 权限要求 | E2E验证 |
|---|----------|----------|----------|----------|---------|
| 1 | GET | `/settings` | 获取工厂设置（全部） | factory_* | ⚪ 未验证 |
| 2 | PUT | `/settings` | 更新工厂设置（全部） | factory_super_admin, factory_admin | ⚪ 未验证 |
| 3 | GET | `/settings/ai` | 获取AI设置 | factory_* | ⚪ 未验证 |
| 4 | PUT | `/settings/ai` | 更新AI设置 | factory_super_admin, factory_admin | ⚪ 未验证 |
| 5 | GET | `/settings/ai/usage-stats` | 获取AI使用统计 | factory_* | ⚪ 未验证 |
| 6 | GET | `/settings/notifications` | 获取通知设置 | factory_* | ⚪ 未验证 |
| 7 | PUT | `/settings/notifications` | 更新通知设置 | factory_super_admin, factory_admin | ⚪ 未验证 |
| 8 | GET | `/settings/work-time` | 获取工作时间设置 | factory_* | ⚪ 未验证 |
| 9 | PUT | `/settings/work-time` | 更新工作时间设置 | factory_super_admin, factory_admin | ⚪ 未验证 |
| 10 | GET | `/settings/production` | 获取生产设置 | factory_* | ⚪ 未验证 |
| 11 | PUT | `/settings/production` | 更新生产设置 | factory_super_admin, factory_admin | ⚪ 未验证 |
| 12 | GET | `/settings/inventory` | 获取库存设置 | factory_* | ⚪ 未验证 |
| 13 | PUT | `/settings/inventory` | 更新库存设置 | factory_super_admin, factory_admin | ⚪ 未验证 |
| 14 | GET | `/settings/data-retention` | 获取数据保留设置 | factory_super_admin, factory_admin | ⚪ 未验证 |
| 15 | PUT | `/settings/data-retention` | 更新数据保留设置 | factory_super_admin, factory_admin | ⚪ 未验证 |
| 16 | GET | `/settings/features` | 获取功能开关 | factory_* | ⚪ 未验证 |
| 17 | PUT | `/settings/features/{feature}` | 更新功能开关 | factory_super_admin, factory_admin | ⚪ 未验证 |
| 18 | GET | `/settings/display` | 获取显示设置 | factory_* | ⚪ 未验证 |
| 19 | PUT | `/settings/display` | 更新显示设置 | factory_* | ⚪ 未验证 |
| 20 | POST | `/settings/reset` | 重置为默认设置 | factory_super_admin | ⚪ 未验证 |
| 21 | GET | `/settings/export` | 导出设置（JSON） | factory_super_admin, factory_admin | ⚪ 未验证 |
| 22 | POST | `/settings/import` | 导入设置（JSON） | factory_super_admin | ⚪ 未验证 |

**图例**:
- ✅ E2E已验证 (100%通过)
- ⚠️ E2E部分验证
- ⚪ 未验证（需要添加测试）

**端点统计**:
- **总计**: 22个端点
- **整体设置**: 2个（获取、更新）
- **分类设置**: 14个（AI、通知、工作时间、生产、库存、数据保留、功能开关）
- **显示设置**: 2个（获取、更新）
- **管理操作**: 4个（重置、导出、导入、功能开关）

---

## 详细API文档

### 3.1 获取工厂设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/settings` |
| **功能** | 获取工厂的所有设置 |
| **权限** | `factory_*`（所有工厂角色） |
| **限流** | 100次/分钟 |

#### 请求参数

**路径参数**:
```typescript
interface PathParams {
  factoryId: string;  // 工厂ID，例如 "CRETAS_2024_001"
}
```

#### 响应结构

**成功响应** (200 OK):
```typescript
interface Response {
  code: 200;
  message: "操作成功";
  success: true;
  data: FactorySettingsDTO;
}

interface FactorySettingsDTO {
  // AI设置
  aiSettings: AISettings;

  // 通知设置
  notificationSettings: NotificationSettings;

  // 工作时间设置
  workTimeSettings: WorkTimeSettings;

  // 生产设置
  productionSettings: ProductionSettings;

  // 库存设置
  inventorySettings: InventorySettings;

  // 数据保留设置
  dataRetentionSettings: DataRetentionSettings;

  // 功能开关
  featureToggles: Record<string, boolean>;

  // 显示设置
  displaySettings: DisplaySettings;
}

// AI设置
interface AISettings {
  enabled: boolean;               // 是否启用AI功能
  weeklyQuota: number;            // 每周配额（次数）
  currentWeekUsage: number;       // 本周已使用次数
  autoAnalysis: boolean;          // 自动分析（批次完成后）
  cacheEnabled: boolean;          // 启用缓存（5分钟）
  cacheDuration: number;          // 缓存时长（分钟）
}

// 通知设置
interface NotificationSettings {
  pushEnabled: boolean;           // 推送通知
  emailEnabled: boolean;          // 邮件通知
  smsEnabled: boolean;            // 短信通知
  notifyOnBatchComplete: boolean; // 批次完成通知
  notifyOnQualityFail: boolean;   // 质检不合格通知
  notifyOnInventoryLow: boolean;  // 库存低于阈值通知
  notifyOnEquipmentAlert: boolean;// 设备告警通知
}

// 工作时间设置
interface WorkTimeSettings {
  workStartTime: string;          // 上班时间 "08:00"
  workEndTime: string;            // 下班时间 "18:00"
  breakStartTime: string;         // 休息开始时间 "12:00"
  breakEndTime: string;           // 休息结束时间 "13:00"
  workDays: number[];             // 工作日 [1,2,3,4,5] (周一到周五)
  overtimeAllowed: boolean;       // 是否允许加班
  maxOvertimeHours: number;       // 最大加班小时数/天
}

// 生产设置
interface ProductionSettings {
  batchIdPrefix: string;          // 批次ID前缀 "BATCH"
  autoAssignBatchNumber: boolean; // 自动分配批次号
  requireQualityInspection: boolean; // 强制质检
  minBatchSize: number;           // 最小批次数量
  maxBatchSize: number;           // 最大批次数量
  allowPartialBatch: boolean;     // 允许部分批次
}

// 库存设置
interface InventorySettings {
  lowStockThreshold: number;      // 低库存阈值（件）
  inventoryMethod: "FIFO" | "LIFO"; // 库存计价方法
  autoInventoryCheck: boolean;    // 自动盘点
  inventoryCheckFrequency: "DAILY" | "WEEKLY" | "MONTHLY"; // 盘点频率
  enableStockAlert: boolean;      // 启用库存告警
}

// 数据保留设置
interface DataRetentionSettings {
  retainProductionData: number;   // 生产数据保留天数
  retainQualityData: number;      // 质检数据保留天数
  retainInventoryData: number;    // 库存数据保留天数
  retainUserActivityLogs: number; // 用户活动日志保留天数
  autoCleanup: boolean;           // 自动清理
}

// 显示设置
interface DisplaySettings {
  language: string;               // 语言 "zh-CN"
  timezone: string;               // 时区 "Asia/Shanghai"
  dateFormat: string;             // 日期格式 "YYYY-MM-DD"
  currency: string;               // 货币 "CNY"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": {
    "aiSettings": {
      "enabled": true,
      "weeklyQuota": 20,
      "currentWeekUsage": 5,
      "autoAnalysis": false,
      "cacheEnabled": true,
      "cacheDuration": 5
    },
    "notificationSettings": {
      "pushEnabled": true,
      "emailEnabled": true,
      "smsEnabled": false,
      "notifyOnBatchComplete": true,
      "notifyOnQualityFail": true,
      "notifyOnInventoryLow": true,
      "notifyOnEquipmentAlert": true
    },
    "workTimeSettings": {
      "workStartTime": "08:00",
      "workEndTime": "18:00",
      "breakStartTime": "12:00",
      "breakEndTime": "13:00",
      "workDays": [1, 2, 3, 4, 5],
      "overtimeAllowed": true,
      "maxOvertimeHours": 3
    },
    "productionSettings": {
      "batchIdPrefix": "BATCH",
      "autoAssignBatchNumber": true,
      "requireQualityInspection": true,
      "minBatchSize": 10,
      "maxBatchSize": 1000,
      "allowPartialBatch": false
    },
    "inventorySettings": {
      "lowStockThreshold": 100,
      "inventoryMethod": "FIFO",
      "autoInventoryCheck": true,
      "inventoryCheckFrequency": "WEEKLY",
      "enableStockAlert": true
    },
    "dataRetentionSettings": {
      "retainProductionData": 1095,
      "retainQualityData": 1095,
      "retainInventoryData": 365,
      "retainUserActivityLogs": 90,
      "autoCleanup": true
    },
    "featureToggles": {
      "ai_analysis": true,
      "auto_inventory": true,
      "batch_tracking": true,
      "quality_control": true,
      "cost_analysis": true
    },
    "displaySettings": {
      "language": "zh-CN",
      "timezone": "Asia/Shanghai",
      "dateFormat": "YYYY-MM-DD",
      "currency": "CNY"
    }
  }
}
```

#### 核心业务逻辑

**查询流程**:
```
1. 验证factoryId和用户权限
2. 从数据库查询工厂设置（JSON字段）
3. 如果不存在，返回默认设置
4. 解析JSON为FactorySettingsDTO
5. 返回完整设置
```

**默认设置**:
- AI配额: 20次/周
- 通知: 推送和邮件启用
- 工作时间: 8:00-18:00，周一到周五
- 库存方法: FIFO
- 数据保留: 生产数据3年，日志90天

#### TypeScript代码示例

```typescript
import { apiClient } from '@/services/api/apiClient';

/**
 * 获取工厂设置
 */
export const getFactorySettings = async (
  factoryId: string
): Promise<ApiResponse<FactorySettingsDTO>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/settings`
  );

  return response.data;
};

// 使用示例
const loadSettings = async () => {
  const result = await getFactorySettings('CRETAS_2024_001');

  if (result.success) {
    const settings = result.data;
    console.log(`AI配额: ${settings.aiSettings.weeklyQuota}`);
    console.log(`本周已用: ${settings.aiSettings.currentWeekUsage}`);
    console.log(`剩余: ${settings.aiSettings.weeklyQuota - settings.aiSettings.currentWeekUsage}`);
  }
};
```

---

### 3.2 更新工厂设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/settings` |
| **功能** | 更新工厂的所有设置 |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 30次/分钟 |

#### 请求参数

**请求体**: 完整的 `FactorySettingsDTO`（所有字段可选，部分更新）

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": {
    "aiSettings": {
      "enabled": true,
      "weeklyQuota": 30
    }
  }
}
```

---

### 3.3 获取AI设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/settings/ai` |
| **功能** | 获取AI相关设置 |
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
    "enabled": true,
    "weeklyQuota": 20,
    "currentWeekUsage": 5,
    "autoAnalysis": false,
    "cacheEnabled": true,
    "cacheDuration": 5
  }
}
```

---

### 3.4 更新AI设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/settings/ai` |
| **功能** | 更新AI相关设置 |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 30次/分钟 |

#### 请求参数

**请求体**:
```typescript
interface UpdateAISettingsRequest {
  enabled?: boolean;               // 是否启用AI
  weeklyQuota?: number;            // 每周配额（1-100）
  autoAnalysis?: boolean;          // 自动分析
  cacheEnabled?: boolean;          // 启用缓存
  cacheDuration?: number;          // 缓存时长（分钟，1-60）
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
    "enabled": true,
    "weeklyQuota": 30,
    "currentWeekUsage": 5,
    "autoAnalysis": true,
    "cacheEnabled": true,
    "cacheDuration": 10
  }
}
```

#### 核心业务逻辑

**配额管理**:
```typescript
// AI配额限制
const MIN_WEEKLY_QUOTA = 1;
const MAX_WEEKLY_QUOTA = 100;

// 成本估算（假设每次调用¥0.5）
const estimatedMonthlyCost = weeklyQuota * 4 * 0.5;

// 配额预警
if (currentWeekUsage >= weeklyQuota * 0.8) {
  showWarning('本周AI配额即将用完');
}
```

---

### 3.5 获取AI使用统计

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/settings/ai/usage-stats` |
| **功能** | 获取AI使用统计信息 |
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
    "weeklyQuota": 20,
    "currentWeekUsage": 5,
    "remainingQuota": 15,
    "utilizationRate": 25.0,
    "totalUsageThisMonth": 18,
    "totalUsageAllTime": 156,
    "averageDailyCalls": 0.7,
    "peakUsageDay": "2025-01-15",
    "estimatedMonthlyCost": 40.0,
    "topUsedFeatures": [
      {
        "feature": "cost_analysis",
        "callCount": 85,
        "percentage": 54.5
      },
      {
        "feature": "quality_prediction",
        "callCount": 71,
        "percentage": 45.5
      }
    ]
  }
}
```

---

### 3.6 获取通知设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/settings/notifications` |
| **功能** | 获取通知相关设置 |
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
    "pushEnabled": true,
    "emailEnabled": true,
    "smsEnabled": false,
    "notifyOnBatchComplete": true,
    "notifyOnQualityFail": true,
    "notifyOnInventoryLow": true,
    "notifyOnEquipmentAlert": true
  }
}
```

---

### 3.7 更新通知设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/settings/notifications` |
| **功能** | 更新通知相关设置 |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 30次/分钟 |

#### 请求参数

**请求体**:
```typescript
interface UpdateNotificationSettingsRequest {
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  notifyOnBatchComplete?: boolean;
  notifyOnQualityFail?: boolean;
  notifyOnInventoryLow?: boolean;
  notifyOnEquipmentAlert?: boolean;
}
```

---

### 3.8 获取工作时间设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/settings/work-time` |
| **功能** | 获取工作时间相关设置 |
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
    "workStartTime": "08:00",
    "workEndTime": "18:00",
    "breakStartTime": "12:00",
    "breakEndTime": "13:00",
    "workDays": [1, 2, 3, 4, 5],
    "overtimeAllowed": true,
    "maxOvertimeHours": 3
  }
}
```

---

### 3.9 更新工作时间设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/settings/work-time` |
| **功能** | 更新工作时间相关设置 |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 30次/分钟 |

#### 请求参数

**请求体**:
```typescript
interface UpdateWorkTimeSettingsRequest {
  workStartTime?: string;          // "HH:mm" 格式
  workEndTime?: string;            // "HH:mm" 格式
  breakStartTime?: string;         // "HH:mm" 格式
  breakEndTime?: string;           // "HH:mm" 格式
  workDays?: number[];             // 1-7 (周一到周日)
  overtimeAllowed?: boolean;
  maxOvertimeHours?: number;       // 0-12
}
```

#### 核心业务逻辑

**工作日编码**:
```typescript
// 1 = 周一, 2 = 周二, ..., 7 = 周日
const workDays = [1, 2, 3, 4, 5];  // 周一到周五

// 判断今天是否工作日
const today = new Date().getDay();  // 0 = 周日, 1 = 周一, ...
const isTodayWorkDay = workDays.includes(today === 0 ? 7 : today);
```

**工作时长计算**:
```typescript
const calculateWorkHours = (settings: WorkTimeSettings): number => {
  const startMinutes = parseTime(settings.workStartTime);
  const endMinutes = parseTime(settings.workEndTime);
  const breakStartMinutes = parseTime(settings.breakStartTime);
  const breakEndMinutes = parseTime(settings.breakEndTime);

  const totalMinutes = endMinutes - startMinutes;
  const breakMinutes = breakEndMinutes - breakStartMinutes;
  const workMinutes = totalMinutes - breakMinutes;

  return workMinutes / 60;  // 转换为小时
};

// 示例: 08:00-18:00，午休12:00-13:00 = 9小时
```

---

### 3.10 获取生产设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/settings/production` |
| **功能** | 获取生产相关设置 |
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
    "batchIdPrefix": "BATCH",
    "autoAssignBatchNumber": true,
    "requireQualityInspection": true,
    "minBatchSize": 10,
    "maxBatchSize": 1000,
    "allowPartialBatch": false
  }
}
```

---

### 3.11 更新生产设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/settings/production` |
| **功能** | 更新生产相关设置 |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 30次/分钟 |

#### 请求参数

**请求体**:
```typescript
interface UpdateProductionSettingsRequest {
  batchIdPrefix?: string;          // 1-10字符
  autoAssignBatchNumber?: boolean;
  requireQualityInspection?: boolean;
  minBatchSize?: number;           // ≥1
  maxBatchSize?: number;           // ≥minBatchSize
  allowPartialBatch?: boolean;
}
```

---

### 3.12 获取库存设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/settings/inventory` |
| **功能** | 获取库存相关设置 |
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
    "lowStockThreshold": 100,
    "inventoryMethod": "FIFO",
    "autoInventoryCheck": true,
    "inventoryCheckFrequency": "WEEKLY",
    "enableStockAlert": true
  }
}
```

---

### 3.13 更新库存设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/settings/inventory` |
| **功能** | 更新库存相关设置 |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 30次/分钟 |

#### 请求参数

**请求体**:
```typescript
interface UpdateInventorySettingsRequest {
  lowStockThreshold?: number;      // ≥0
  inventoryMethod?: "FIFO" | "LIFO";
  autoInventoryCheck?: boolean;
  inventoryCheckFrequency?: "DAILY" | "WEEKLY" | "MONTHLY";
  enableStockAlert?: boolean;
}
```

#### 核心业务逻辑

**FIFO vs LIFO**:
```typescript
// FIFO (First In First Out) - 先进先出
// 优点: 符合实际物流，防止过期
// 缺点: 成本计算复杂

// LIFO (Last In First Out) - 后进先出
// 优点: 成本计算简单
// 缺点: 可能导致旧库存积压
```

---

### 3.14 获取数据保留设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/settings/data-retention` |
| **功能** | 获取数据保留相关设置 |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 100次/分钟 |

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": {
    "retainProductionData": 1095,
    "retainQualityData": 1095,
    "retainInventoryData": 365,
    "retainUserActivityLogs": 90,
    "autoCleanup": true
  }
}
```

---

### 3.15 更新数据保留设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/settings/data-retention` |
| **功能** | 更新数据保留相关设置 |
| **权限** | `factory_super_admin` |
| **限流** | 30次/分钟 |

#### 请求参数

**请求体**:
```typescript
interface UpdateDataRetentionSettingsRequest {
  retainProductionData?: number;   // 天数，30-3650
  retainQualityData?: number;      // 天数，30-3650
  retainInventoryData?: number;    // 天数，30-3650
  retainUserActivityLogs?: number; // 天数，7-365
  autoCleanup?: boolean;
}
```

#### 核心业务逻辑

**数据保留合规**:
```typescript
// 食品安全法要求
const MIN_PRODUCTION_DATA_RETENTION = 1095;  // 3年
const MIN_QUALITY_DATA_RETENTION = 1095;     // 3年

// GDPR要求
const MAX_USER_LOG_RETENTION = 365;          // 1年
```

---

### 3.16 获取功能开关

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/settings/features` |
| **功能** | 获取所有功能开关 |
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
    "ai_analysis": true,
    "auto_inventory": true,
    "batch_tracking": true,
    "quality_control": true,
    "cost_analysis": true,
    "equipment_monitoring": false,
    "predictive_maintenance": false,
    "blockchain_tracking": false
  }
}
```

---

### 3.17 更新功能开关

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/settings/features/{feature}` |
| **功能** | 更新单个功能开关 |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 60次/分钟 |

#### 请求参数

**路径参数**:
```typescript
interface PathParams {
  factoryId: string;
  feature: string;  // 功能名称，如 "ai_analysis"
}
```

**查询参数**:
```typescript
interface QueryParams {
  enabled: boolean;  // true=启用，false=禁用
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
 * 更新功能开关
 */
export const updateFeatureToggle = async (
  factoryId: string,
  feature: string,
  enabled: boolean
): Promise<ApiResponse<void>> => {
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/settings/features/${feature}`,
    null,
    {
      params: { enabled },
    }
  );

  return response.data;
};

// 使用示例：启用AI分析
await updateFeatureToggle('CRETAS_2024_001', 'ai_analysis', true);
```

---

### 3.18 获取显示设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/settings/display` |
| **功能** | 获取显示相关设置（语言、时区等） |
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
    "language": "zh-CN",
    "timezone": "Asia/Shanghai",
    "dateFormat": "YYYY-MM-DD",
    "currency": "CNY"
  }
}
```

---

### 3.19 更新显示设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/settings/display` |
| **功能** | 更新显示相关设置 |
| **权限** | `factory_*` |
| **限流** | 30次/分钟 |

#### 请求参数

**查询参数**:
```typescript
interface QueryParams {
  language?: string;    // "zh-CN", "en-US", "ja-JP"
  timezone?: string;    // "Asia/Shanghai", "America/New_York"
  dateFormat?: string;  // "YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"
  currency?: string;    // "CNY", "USD", "JPY", "EUR"
}
```

#### 核心业务逻辑

**支持的语言**:
- `zh-CN`: 简体中文
- `zh-TW`: 繁体中文
- `en-US`: 英语
- `ja-JP`: 日语

**支持的时区**:
- `Asia/Shanghai`: 中国标准时间 (UTC+8)
- `Asia/Tokyo`: 日本标准时间 (UTC+9)
- `America/New_York`: 美国东部时间 (UTC-5/-4)
- `Europe/London`: 英国时间 (UTC+0/+1)

**支持的货币**:
- `CNY`: 人民币 ¥
- `USD`: 美元 $
- `JPY`: 日元 ¥
- `EUR`: 欧元 €

---

### 3.20 重置为默认设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `POST /api/mobile/{factoryId}/settings/reset` |
| **功能** | 将所有设置重置为默认值 |
| **权限** | `factory_super_admin` |
| **限流** | 10次/分钟 |

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": {
    "aiSettings": {
      "enabled": true,
      "weeklyQuota": 20
    }
  }
}
```

#### 核心业务逻辑

**重置警告**:
```
1. 确认操作（前端弹窗）
2. 备份当前设置
3. 应用默认设置
4. 记录操作日志
```

---

### 3.21 导出设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/settings/export` |
| **功能** | 导出设置为JSON字符串（用于备份） |
| **权限** | `factory_super_admin`, `factory_admin` |
| **限流** | 30次/分钟 |

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": "{\"aiSettings\":{\"enabled\":true,\"weeklyQuota\":20},...}"
}
```

#### TypeScript代码示例

```typescript
/**
 * 导出设置并保存到文件
 */
export const exportAndDownloadSettings = async (factoryId: string): Promise<void> => {
  const result = await exportSettings(factoryId);

  if (result.success) {
    const settingsJson = result.data;

    // 创建Blob
    const blob = new Blob([settingsJson], { type: 'application/json' });

    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `factory_settings_${factoryId}_${Date.now()}.json`;
    link.click();

    // 清理
    URL.revokeObjectURL(url);
  }
};
```

---

### 3.22 导入设置

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `POST /api/mobile/{factoryId}/settings/import` |
| **功能** | 从JSON字符串导入设置（用于恢复） |
| **权限** | `factory_super_admin` |
| **限流** | 10次/分钟 |

#### 请求参数

**请求体**:
```typescript
interface ImportSettingsRequest {
  settingsJson: string;  // JSON字符串
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
    "aiSettings": {
      "enabled": true
    }
  }
}
```

#### TypeScript代码示例

```typescript
/**
 * 从文件导入设置
 */
export const importSettingsFromFile = async (
  factoryId: string,
  file: File
): Promise<ApiResponse<FactorySettingsDTO>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const settingsJson = e.target?.result as string;

        // 验证JSON格式
        JSON.parse(settingsJson);

        // 导入设置
        const result = await importSettings(factoryId, settingsJson);
        resolve(result);
      } catch (error) {
        reject(new Error('无效的JSON文件'));
      }
    };

    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
};
```

---

## 数据模型

### FactorySettingsDTO（工厂设置）

```typescript
/**
 * 工厂设置DTO
 */
interface FactorySettingsDTO {
  aiSettings: AISettings;
  notificationSettings: NotificationSettings;
  workTimeSettings: WorkTimeSettings;
  productionSettings: ProductionSettings;
  inventorySettings: InventorySettings;
  dataRetentionSettings: DataRetentionSettings;
  featureToggles: Record<string, boolean>;
  displaySettings: DisplaySettings;
}
```

**数据库存储**:
```sql
-- 设置以JSON格式存储在factories表中
ALTER TABLE factories ADD COLUMN settings JSON;

-- 示例数据
{
  "aiSettings": {...},
  "notificationSettings": {...},
  "workTimeSettings": {...},
  ...
}
```

---

## 业务规则

### 1. AI配额管理

**配额限制**:
- 最小配额: 1次/周
- 最大配额: 100次/周
- 默认配额: 20次/周

**配额重置**:
- 每周一 00:00 自动重置

**超额处理**:
- 达到配额后，AI功能暂停
- 显示"配额已用完"提示
- 管理员可增加配额

### 2. 数据保留合规

**法规要求**:
- 生产数据: 最少3年（食品安全法）
- 质检数据: 最少3年
- 用户日志: 最多1年（GDPR）

**自动清理**:
- 定时任务每天 02:00 执行
- 仅删除超过保留期的数据
- 软删除，可恢复30天

### 3. 功能开关

**核心功能**（不可关闭）:
- `batch_tracking`: 批次追踪
- `quality_control`: 质量控制

**可选功能**:
- `ai_analysis`: AI分析
- `auto_inventory`: 自动盘点
- `cost_analysis`: 成本分析
- `equipment_monitoring`: 设备监控
- `predictive_maintenance`: 预测性维护
- `blockchain_tracking`: 区块链追踪

### 4. 时区处理

**时区转换**:
```typescript
// 服务器时间 (UTC)
const serverTime = new Date();

// 工厂时区时间
const factoryTime = serverTime.toLocaleString('en-US', {
  timeZone: settings.displaySettings.timezone
});
```

---

## 错误处理

### 错误码列表

| HTTP状态码 | 错误码 | 错误信息 | 说明 |
|-----------|-------|---------|------|
| 400 | INVALID_PARAMETER | 参数验证失败 | 请求参数不符合规则 |
| 400 | INVALID_QUOTA | AI配额超出范围 | weeklyQuota必须在1-100之间 |
| 400 | INVALID_TIME_FORMAT | 时间格式错误 | workStartTime必须为HH:mm格式 |
| 400 | INVALID_JSON | JSON格式错误 | 导入的设置JSON格式无效 |
| 403 | PERMISSION_DENIED | 权限不足 | 仅super_admin可重置设置 |
| 404 | SETTINGS_NOT_FOUND | 设置不存在 | 工厂设置未初始化 |

---

## 前端集成指南

### 完整API客户端实现

创建 `src/services/api/factorySettingsApiClient.ts`:

```typescript
import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/apiResponses';

/**
 * 工厂设置API客户端
 */

// ============ 类型定义 ============

export interface FactorySettingsDTO {
  aiSettings: AISettings;
  notificationSettings: NotificationSettings;
  workTimeSettings: WorkTimeSettings;
  productionSettings: ProductionSettings;
  inventorySettings: InventorySettings;
  dataRetentionSettings: DataRetentionSettings;
  featureToggles: Record<string, boolean>;
  displaySettings: DisplaySettings;
}

export interface AISettings {
  enabled: boolean;
  weeklyQuota: number;
  currentWeekUsage: number;
  autoAnalysis: boolean;
  cacheEnabled: boolean;
  cacheDuration: number;
}

// ... 其他类型定义 ...

// ============ API函数 ============

/**
 * 获取工厂设置
 */
export const getFactorySettings = async (
  factoryId: string
): Promise<ApiResponse<FactorySettingsDTO>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/settings`
  );

  return response.data;
};

/**
 * 更新工厂设置
 */
export const updateFactorySettings = async (
  factoryId: string,
  settings: Partial<FactorySettingsDTO>
): Promise<ApiResponse<FactorySettingsDTO>> => {
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/settings`,
    settings
  );

  return response.data;
};

/**
 * 获取AI设置
 */
export const getAISettings = async (
  factoryId: string
): Promise<ApiResponse<AISettings>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/settings/ai`
  );

  return response.data;
};

/**
 * 更新AI设置
 */
export const updateAISettings = async (
  factoryId: string,
  settings: Partial<AISettings>
): Promise<ApiResponse<AISettings>> => {
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/settings/ai`,
    settings
  );

  return response.data;
};

/**
 * 获取AI使用统计
 */
export const getAIUsageStats = async (
  factoryId: string
): Promise<ApiResponse<any>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/settings/ai/usage-stats`
  );

  return response.data;
};

/**
 * 更新功能开关
 */
export const updateFeatureToggle = async (
  factoryId: string,
  feature: string,
  enabled: boolean
): Promise<ApiResponse<void>> => {
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/settings/features/${feature}`,
    null,
    {
      params: { enabled },
    }
  );

  return response.data;
};

/**
 * 重置为默认设置
 */
export const resetSettings = async (
  factoryId: string
): Promise<ApiResponse<FactorySettingsDTO>> => {
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/settings/reset`
  );

  return response.data;
};

/**
 * 导出设置
 */
export const exportSettings = async (
  factoryId: string
): Promise<ApiResponse<string>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/settings/export`
  );

  return response.data;
};

/**
 * 导入设置
 */
export const importSettings = async (
  factoryId: string,
  settingsJson: string
): Promise<ApiResponse<FactorySettingsDTO>> => {
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/settings/import`,
    settingsJson,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
};

// ============ 辅助函数 ============

/**
 * 计算AI配额剩余百分比
 */
export const getQuotaPercentage = (
  currentUsage: number,
  quota: number
): number => {
  return Math.round((currentUsage / quota) * 100);
};

/**
 * 判断AI配额是否即将用完
 */
export const isQuotaLow = (
  currentUsage: number,
  quota: number
): boolean => {
  return currentUsage >= quota * 0.8;
};
```

---

## 总结

### 关键特性

1. **分类设置管理**: 7大类设置（AI、通知、工作时间、生产、库存、数据保留、显示）
2. **AI成本控制**: 配额管理、使用统计、缓存优化
3. **灵活配置**: 每个工厂独立配置
4. **备份恢复**: 导出/导入JSON，快速迁移
5. **功能开关**: 灵活启用/禁用功能
6. **国际化支持**: 多语言、多时区、多货币

### 使用建议

1. **初始化**: 工厂创建后立即配置基础设置
2. **AI配额**: 根据预算调整每周配额
3. **数据合规**: 确保数据保留期符合法规
4. **定期备份**: 导出设置JSON备份
5. **功能开关**: 根据订阅计划启用功能

### 待实现功能

- 设置模板（快速应用行业最佳实践）
- 设置版本控制（回滚到历史版本）
- 设置审计日志（谁在何时修改了什么）
- 批量设置（多工厂同时配置）

---

**文档结束**
