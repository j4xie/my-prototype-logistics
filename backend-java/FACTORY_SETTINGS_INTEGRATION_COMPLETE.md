# 工厂设置API集成完成报告

## 📋 概述

工厂设置功能已完成**完整的前后端集成**，包括后端API实现和前端页面集成。

## ✅ 实现内容

### 后端实现 (Spring Boot)

#### 1. DTO定义 (MobileDTO.java)

新增3个DTO类：

```java
// 工作时间配置
public static class WorkingHours {
    private String startTime;  // "08:00"
    private String endTime;    // "17:00"
}

// 工作时间设置（存储在work_time_settings JSON字段）
public static class WorkTimeSettings {
    private WorkingHours workingHours;
    private String lunchBreakStart;       // "12:00"
    private String lunchBreakEnd;         // "13:00"
    private boolean[] workingDays;        // [周一-周日] - 7个布尔值
    private Integer lateThresholdMinutes;
    private Integer earlyLeaveThresholdMinutes;
    private Boolean enableOvertimeTracking;
    private Boolean enableGPSChecking;
}

// 工厂设置响应（组合Factory和FactorySettings数据）
public static class FactorySettingsResponse {
    // 基本信息（来自Factory表）
    private String factoryName;
    private String factoryAddress;
    private String contactPhone;
    private String contactEmail;

    // 工作时间配置（来自FactorySettings.workTimeSettings JSON）
    private WorkingHours workingHours;
    private String lunchBreakStart;
    private String lunchBreakEnd;
    private boolean[] workingDays;

    // 考勤配置（来自FactorySettings.workTimeSettings JSON）
    private Integer lateThresholdMinutes;
    private Integer earlyLeaveThresholdMinutes;

    // 功能开关（来自FactorySettings表）
    private Boolean enableOvertimeTracking;
    private Boolean enableGPSChecking;
}

// 更新工厂设置请求
public static class UpdateFactorySettingsRequest {
    // 同FactorySettingsResponse结构，所有字段可选
}
```

#### 2. API端点 (MobileController.java)

新增2个REST API：

```java
/**
 * 获取工厂设置
 * GET /api/mobile/{factoryId}/settings
 */
@GetMapping("/{factoryId}/settings")
public ApiResponse<MobileDTO.FactorySettingsResponse> getFactorySettings(
    @PathVariable String factoryId
)

/**
 * 更新工厂设置
 * PUT /api/mobile/{factoryId}/settings
 */
@PutMapping("/{factoryId}/settings")
public ApiResponse<MobileDTO.FactorySettingsResponse> updateFactorySettings(
    @PathVariable String factoryId,
    @RequestBody MobileDTO.UpdateFactorySettingsRequest request,
    @RequestAttribute("userId") Integer userId
)
```

#### 3. Service层实现 (MobileServiceImpl.java)

新增7个方法（~220行代码）：

1. **getFactorySettings()** - 获取工厂设置
   - 查询Factory表（基本信息）
   - 查询FactorySettings表（工作时间、功能开关）
   - 解析workTimeSettings JSON
   - 组合返回响应

2. **updateFactorySettings()** - 更新工厂设置
   - 更新Factory表（名称、地址、联系方式）
   - 更新FactorySettings表（工作时间JSON、功能开关）
   - 序列化workTimeSettings为JSON
   - 返回更新后的设置

3. **createDefaultFactorySettings()** - 创建默认设置
   - 自动创建工厂设置记录（如果不存在）
   - 默认工作时间：08:00-17:00
   - 默认工作日：周一至周五
   - 默认考勤阈值：10分钟

4. **parseWorkTimeSettings()** - 解析JSON
   - 将JSON字符串解析为WorkTimeSettings对象
   - 处理null和空字符串情况
   - 返回默认值（如果JSON无效）

5. **serializeWorkTimeSettings()** - 序列化JSON
   - 将WorkTimeSettings对象序列化为JSON字符串
   - 用于存储到数据库

#### 4. Repository注入

新增2个Repository：

```java
private final FactoryRepository factoryRepository;
private final FactorySettingsRepository factorySettingsRepository;
```

### 前端实现 (React Native + TypeScript)

#### 1. API客户端 (factoryApiClient.ts)

新建文件，包含：

```typescript
interface WorkingHours {
  startTime: string;
  endTime: string;
}

interface FactorySettingsResponse {
  factoryName: string;
  factoryAddress: string;
  contactPhone: string;
  contactEmail: string;
  workingHours: WorkingHours;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  workingDays: boolean[];
  lateThresholdMinutes: number;
  earlyLeaveThresholdMinutes: number;
  enableOvertimeTracking: boolean;
  enableGPSChecking: boolean;
}

class FactoryApiClient {
  async getFactorySettings(factoryId?: string): Promise<Response>
  async updateFactorySettings(request: UpdateRequest, factoryId?: string): Promise<Response>
}
```

#### 2. 页面集成 (FactorySettingsScreen.tsx)

更新以下部分：

1. **导入API客户端和认证状态**
```typescript
import { factoryApiClient } from '../../services/api/factoryApiClient';
import { useAuthStore } from '../../store/authStore';
```

2. **获取factoryId**
```typescript
const factoryId = useAuthStore((state) => state.user?.factoryId);
```

3. **loadFactorySettings()** - 使用真实API
```typescript
const response = await factoryApiClient.getFactorySettings(factoryId);
if (response.success && response.data) {
  setSettings(response.data);
}
```

4. **handleSave()** - 使用真实API
```typescript
const response = await factoryApiClient.updateFactorySettings(settings, factoryId);
if (response.success) {
  Alert.alert('保存成功', response.message);
  await loadFactorySettings(); // 重新加载最新数据
}
```

## 🗄️ 数据库设计

### Factory表（基本信息）

| 字段 | 类型 | 说明 |
|-----|------|-----|
| id | VARCHAR(191) | 工厂ID（主键）|
| name | VARCHAR(255) | 工厂名称 |
| address | VARCHAR(500) | 工厂地址 |
| contact_phone | VARCHAR(50) | 联系电话 |
| contact_email | VARCHAR(100) | 联系邮箱 |

### FactorySettings表（设置信息）

| 字段 | 类型 | 说明 |
|-----|------|-----|
| id | INT | 主键 |
| factory_id | VARCHAR(191) | 工厂ID（外键，唯一）|
| work_time_settings | TEXT | 工作时间设置JSON |
| updated_by | INT | 更新人ID |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### work_time_settings JSON结构

```json
{
  "workingHours": {
    "startTime": "08:00",
    "endTime": "17:00"
  },
  "lunchBreakStart": "12:00",
  "lunchBreakEnd": "13:00",
  "workingDays": [true, true, true, true, true, false, false],
  "lateThresholdMinutes": 10,
  "earlyLeaveThresholdMinutes": 10,
  "enableOvertimeTracking": true,
  "enableGPSChecking": true
}
```

## 🔧 核心功能

### 1. 自动创建默认设置

如果工厂设置记录不存在，系统自动创建默认设置：
- 工作时间：08:00-17:00
- 午休时间：12:00-13:00
- 工作日：周一至周五
- 迟到/早退阈值：10分钟
- 加班追踪：启用
- GPS检查：启用

### 2. 数据组合查询

**GET API** 组合两个表的数据：
- Factory表：基本信息（名称、地址、联系方式）
- FactorySettings表：工作时间配置、功能开关

### 3. 分离更新

**PUT API** 分别更新两个表：
- Factory表：更新基本信息字段
- FactorySettings表：序列化工作时间配置为JSON并更新

### 4. JSON存储优化

使用JSON存储灵活配置：
- 避免频繁修改表结构
- 支持动态配置项扩展
- 减少数据库字段数量

## 📝 API文档

### GET /api/mobile/{factoryId}/settings

**请求**:
```
GET /api/mobile/CRETAS_2024_001/settings
```

**响应**:
```json
{
  "code": 200,
  "success": true,
  "message": "获取成功",
  "data": {
    "factoryName": "白垩纪食品加工厂",
    "factoryAddress": "上海市浦东新区张江高科技园区XXX号",
    "contactPhone": "021-12345678",
    "contactEmail": "contact@cretas.com",
    "workingHours": {
      "startTime": "08:00",
      "endTime": "17:00"
    },
    "lunchBreakStart": "12:00",
    "lunchBreakEnd": "13:00",
    "workingDays": [true, true, true, true, true, false, false],
    "lateThresholdMinutes": 10,
    "earlyLeaveThresholdMinutes": 10,
    "enableOvertimeTracking": true,
    "enableGPSChecking": true
  }
}
```

### PUT /api/mobile/{factoryId}/settings

**请求**:
```json
{
  "factoryName": "白垩纪食品加工厂（新名称）",
  "factoryAddress": "上海市浦东新区张江高科技园区XXX号",
  "contactPhone": "021-88888888",
  "contactEmail": "new@cretas.com",
  "workingHours": {
    "startTime": "09:00",
    "endTime": "18:00"
  },
  "lunchBreakStart": "12:30",
  "lunchBreakEnd": "13:30",
  "workingDays": [true, true, true, true, true, true, false],
  "lateThresholdMinutes": 15,
  "earlyLeaveThresholdMinutes": 15,
  "enableOvertimeTracking": false,
  "enableGPSChecking": true
}
```

**响应**:
```json
{
  "code": 200,
  "success": true,
  "message": "更新成功",
  "data": {
    // 同GET响应，返回更新后的设置
  }
}
```

## 🧪 测试建议

### 1. 基本功能测试

```bash
# 1. 启动后端服务
cd backend-java
mvn spring-boot:run

# 2. 测试GET接口
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/settings" \
  -H "Authorization: Bearer YOUR_TOKEN" | python3 -m json.tool

# 3. 测试PUT接口
curl -X PUT "http://localhost:10010/api/mobile/CRETAS_2024_001/settings" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "factoryName": "测试工厂",
    "workingHours": {
      "startTime": "09:00",
      "endTime": "18:00"
    }
  }' | python3 -m json.tool
```

### 2. 前端集成测试

1. 登录应用
2. 导航到 **管理** → **工厂设置**
3. 验证设置加载是否成功
4. 修改任意字段
5. 点击保存按钮
6. 验证保存成功提示
7. 刷新页面，验证修改已保存

### 3. 边界情况测试

- **空工厂设置**：第一次访问时应自动创建默认设置
- **无效JSON**：后端应返回默认值
- **字段验证**：前端验证电话号码和邮箱格式
- **并发更新**：多个用户同时修改设置

## 📊 代码统计

### 后端代码

| 文件 | 新增行数 | 说明 |
|-----|----------|------|
| MobileDTO.java | ~90 | 4个DTO类 |
| MobileController.java | ~30 | 2个API端点 |
| MobileService.java | ~15 | 2个接口方法 |
| MobileServiceImpl.java | ~220 | 7个实现方法 |
| **总计** | **~355** | |

### 前端代码

| 文件 | 新增/修改行数 | 说明 |
|-----|--------------|------|
| factoryApiClient.ts | ~120（新建）| API客户端 |
| FactorySettingsScreen.tsx | ~40（修改）| 页面集成 |
| **总计** | **~160** | |

## ✅ 完成清单

- [x] 后端DTO定义（MobileDTO.java）
- [x] 后端API端点（MobileController.java）
- [x] 后端Service接口（MobileService.java）
- [x] 后端Service实现（MobileServiceImpl.java）
- [x] Repository注入（FactoryRepository、FactorySettingsRepository）
- [x] 前端API客户端（factoryApiClient.ts）
- [x] 前端页面集成（FactorySettingsScreen.tsx）
- [x] 后端编译通过（BUILD SUCCESS）
- [x] TODO列表更新
- [x] 集成完成报告

## 🚀 下一步工作

根据TODO列表，下一个优先级P2任务是：

**【后端-P2】实现异常告警API (2个) - GET/POST exceptions**

继续按照"后端实现 → 前端集成"的完整流程完成剩余功能。

---

**报告生成时间**: 2025-11-20
**实现状态**: ✅ 完整集成完成（后端 + 前端）
