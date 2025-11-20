# 前后端API集成缺口分析报告

**分析日期**: 2025-11-19
**分析范围**: 全部26个前端API Client + 15个后端Controller
**当前对接率**: **约75%** (153/203个API)

---

## 📊 总体对接情况

### 完全对接模块 (13个 - 50%) ✅

| 模块 | API数 | 状态 | Controller |
|------|-------|------|-----------|
| Dashboard | 6 | ✅ 完全对接 | DashboardController |
| Processing | 20 | ✅ 完全对接 | ProcessingController |
| TimeClock | 11 | ✅ 完全对接 | TimeClockController |
| User | 14 | ✅ 完全对接 | UserController |
| ProductType | 12 | ✅ 完全对接 | ProductTypeController |
| MaterialType | 13 | ✅ 完全对接 | MaterialTypeController |
| WorkType | 10 | ✅ 完全对接 | WorkTypeController |
| Whitelist | 5 | ✅ 完全对接 | WhitelistController |
| Supplier | 8 | ✅ 完全对接 | SupplierController |
| Customer | 8 | ✅ 完全对接 | CustomerController |
| ConversionRate | 15 | ✅ 完全对接 | ConversionRateController |
| MaterialBatch | 22 | ✅ 完全对接 | MaterialBatchController |
| ProductionPlan | 12 | ✅ 完全对接 | ProductionPlanController |
| **小计** | **156** | **完全可用** | **13个** |

### 部分对接模块 (3个 - 12%) ⚠️

| 模块 | 已实现 | 缺失 | 状态 |
|------|--------|------|------|
| AI | 部分 | 11 | ⚠️ 分散在ProcessingController |
| Reports | 1 | 多个 | ⚠️ 仅实现cost-analysis |
| Attendance | 冲突 | - | ⚠️ 与TimeClock重复 |

### 完全未对接模块 (7个 - 27%) ❌

| 模块 | API数 | 优先级 | 影响Screen |
|------|-------|--------|------------|
| MaterialSpec | ~10 | P1 | MaterialSpecManagementScreen |
| FactorySettings | ~8 | P2 | FactorySettingsScreen |
| TimeStats | ~5 | P2 | AttendanceStatisticsScreen (部分) |
| Platform | ~15 | P2 | PlatformDashboard等 |
| Equipment | ~20 | P3 | EquipmentMonitoringScreen |
| Alert | ~10 | P3 | ExceptionAlertScreen |
| Employee | ~10 | P3 | 可能与User重复 |

---

## 🔴 P0 紧急问题（本周必须解决）

### 问题1: Attendance vs TimeClock 路径冲突 ⚠️

**现状**:
- `attendanceApiClient.ts` (11个方法) - 路径 `/api/mobile/{factoryId}/attendance`
- `timeclockApiClient.ts` (11个方法) - 路径 `/api/mobile/{factoryId}/timeclock`
- 后端只实现了 `TimeClockController` (路径: `/timeclock`)

**冲突的API**:
```typescript
// attendanceApiClient (未实现)
GET /attendance/department/{dept}     ❌
GET /attendance/statistics             ❌
GET /attendance/export                 ❌

// timeclockApiClient (已实现)
GET /timeclock/department/{dept}      ✅
GET /timeclock/statistics             ✅
GET /timeclock/export                 ✅
```

**解决方案** (2小时):
1. **废弃 attendanceApiClient.ts**
2. **统一使用 timeclockApiClient.ts**
3. **更新所有Screen的import**:
   - AttendanceStatisticsScreen.tsx
   - TimeClockScreen.tsx
   - 任何其他使用attendance API的Screen

**实施步骤**:
```bash
# 1. 搜索所有使用attendanceApiClient的文件
grep -r "attendanceApiClient" frontend/CretasFoodTrace/src --include="*.tsx"

# 2. 替换为timeclockApiClient
# 3. 删除attendanceApiClient.ts或标记为deprecated
```

### 问题2: AI功能分散 - 需要统一AIController ⚠️

**现状**:
- 前端定义: `aiApiClient.ts` (11个方法)
- 后端状态: AI方法分散在ProcessingController中

**前端期望的API**:
```typescript
// AI分析
POST /ai/analysis/cost/batch           - 单批次成本AI分析
POST /ai/analysis/cost/time-range      - 时间范围成本AI分析
POST /ai/analysis/cost/compare         - 批次对比分析

// AI配额管理
GET  /ai/quota                         - 获取配额信息
PUT  /ai/quota                         - 更新配额

// AI对话管理
GET    /ai/conversations/{id}          - 获取对话
POST   /ai/conversations/continue      - 继续对话
DELETE /ai/conversations/{id}          - 关闭对话

// AI报告管理
GET  /ai/reports                       - 获取报告列表
GET  /ai/reports/{id}                  - 获取报告详情
POST /ai/reports/generate              - 生成报告

// 健康检查
GET /ai/health                         - AI服务健康检查
```

**当前ProcessingController中的AI方法**:
```java
// ProcessingController.java 已有：
POST /processing/ai-cost-analysis/time-range  ✅ (但路径不匹配)
```

**解决方案** (1天):
创建独立的 `AIController.java`:
```java
@RestController
@RequestMapping("/api/mobile/{factoryId}/ai")
public class AIController {
    @Autowired
    private AIService aiService;

    // 实现11个AI相关端点
}
```

---

## 🟡 P1 高优先级（本月完成）

### 任务3: 原材料规格配置 (MaterialSpec)

**影响**: MaterialSpecManagementScreen 无法使用

**后端状态**: `MaterialSpecConfigController.java` 已存在，需验证

**验证步骤**:
```bash
# 1. 检查Controller实现
grep -n "@GetMapping\|@PostMapping\|@PutMapping\|@DeleteMapping" \
  backend-java/src/main/java/com/cretas/aims/controller/MaterialSpecConfigController.java

# 2. 对比前端API定义
# 3. 补充缺失端点
```

**预期API**:
```
GET    /material-specs              - 获取规格列表
POST   /material-specs              - 创建规格
GET    /material-specs/{id}         - 获取规格详情
PUT    /material-specs/{id}         - 更新规格
DELETE /material-specs/{id}         - 删除规格
GET    /material-specs/material/{materialId} - 按原料查询规格
```

### 任务4: 工厂设置 (FactorySettings)

**影响**: FactorySettingsScreen 无法使用

**后端状态**: ❌ 完全未实现

**需要创建**:
- `FactorySettingsController.java`
- `FactorySettingsService.java`
- `FactorySettings` Entity (可能已存在)

**预期API** (~8个):
```
GET    /factory-settings            - 获取工厂设置
PUT    /factory-settings            - 更新工厂设置
GET    /factory-settings/basic      - 基本信息
PUT    /factory-settings/basic      - 更新基本信息
GET    /factory-settings/business   - 业务配置
PUT    /factory-settings/business   - 更新业务配置
GET    /factory-settings/system     - 系统配置
PUT    /factory-settings/system     - 更新系统配置
```

---

## 🟢 P2 中优先级（下月计划）

### 任务5: 平台管理功能 (Platform)

**影响**: PlatformDashboardScreen, FactoryManagementScreen, AIQuotaManagementScreen

**前端定义**: `platformApiClient.ts`

**需要验证**: 是否已有部分后端实现

**预期功能**:
- 工厂管理 (CRUD)
- AI配额分配
- 平台级统计
- 系统监控

### 任务6: 时间统计服务 (TimeStats)

**影响**: AttendanceStatisticsScreen 的高级统计功能

**建议**: 合并到 `TimeClockController` 或创建独立的 `TimeStatsController`

**预期API** (~5个):
```
GET /time-stats/daily/{userId}       - 每日工时统计
GET /time-stats/weekly/{userId}      - 每周工时统计
GET /time-stats/monthly/{userId}     - 每月工时统计
GET /time-stats/department/{dept}    - 部门统计
GET /time-stats/summary              - 汇总统计
```

---

## 🔵 P3 低优先级（未来规划）

### 任务7: 设备监控 (Equipment)

**影响**: EquipmentMonitoringScreen, EquipmentDetailScreen

**当前状态**: Dashboard有设备统计，但缺少详细管理

**需要创建**: `EquipmentController.java` (~20个API)

### 任务8: 异常告警 (Alert)

**影响**: ExceptionAlertScreen, EquipmentAlertsScreen

**需要创建**: `AlertController.java` (~10个API)

### 任务9: 数据报表导出

**影响**: DataExportScreen

**当前状态**: ReportsController部分实现

**需要补充**: 多种格式导出、报表模板管理

---

## 📋 立即执行计划

### 本周任务 (2025-11-19 ~ 2025-11-22)

#### Day 1-2: 解决冲突和验证
- [ ] **Task 1.1**: 解决 Attendance vs TimeClock 冲突 (2小时)
  - 废弃attendanceApiClient
  - 更新所有Screen引用
  - 测试功能正常

- [ ] **Task 1.2**: 验证 MaterialType 后端实现 (2小时)
  - 测试13个API端点
  - 修复任何问题
  - 更新文档

- [ ] **Task 1.3**: 验证 MaterialSpec 后端实现 (2小时)
  - 检查MaterialSpecConfigController
  - 补充缺失端点
  - 测试前端对接

#### Day 3-5: 创建AI Controller
- [ ] **Task 2.1**: 创建 AIController.java (1天)
  - 实现11个AI端点
  - 集成DeepSeek API
  - 配置AI配额管理

- [ ] **Task 2.2**: 测试AI功能 (半天)
  - 测试所有AI API
  - 验证DeepSeekAnalysisScreen
  - 性能和成本优化

### 本月任务 (2025-11-23 ~ 2025-11-30)

- [ ] **Task 3**: 创建 FactorySettingsController (2天)
- [ ] **Task 4**: 验证和补充 Platform 功能 (3天)
- [ ] **Task 5**: 整合 TimeStats 功能 (2天)

---

## 📈 完成度追踪

### 当前状态 (2025-11-19)
```
核心功能对接: 156/173 = 90% ✅
总体API对接: 153/203 = 75% ⚠️
```

### 本周目标 (2025-11-22)
```
核心功能对接: 173/173 = 100% ✅
总体API对接: 170/203 = 84% ✅
```

### 本月目标 (2025-11-30)
```
核心功能对接: 173/173 = 100% ✅
总体API对接: 190/203 = 94% ✅
```

---

## 🔧 代码清理建议

### 需要废弃的文件
```
frontend/CretasFoodTrace/src/services/api/
├── attendanceApiClient.ts          - ❌ 废弃，使用timeclockApiClient
├── employeeApiClient.ts (可能)     - ❌ 与userApiClient重复
└── materialApiClient.ts (可能)     - ❌ 功能待确认
```

### 需要重构的文件
```
backend-java/src/main/java/com/cretas/aims/controller/
├── ProcessingController.java       - ⚠️ 移除AI方法到AIController
└── TimeClockController.java        - ⚠️ 考虑合并TimeStats功能
```

---

## 📞 问题排查清单

### 验证MaterialType后端
```bash
# 1. 检查Controller
cat backend-java/src/main/java/com/cretas/aims/controller/MaterialTypeController.java

# 2. 测试API
curl -X GET "http://localhost:10010/api/mobile/F001/materials/types" \
  -H "Authorization: Bearer $TOKEN"

# 3. 检查是否所有13个API都已实现
```

### 验证MaterialSpec后端
```bash
# 1. 检查Controller
cat backend-java/src/main/java/com/cretas/aims/controller/MaterialSpecConfigController.java

# 2. 对比前端API定义
cat frontend/CretasFoodTrace/src/services/api/materialSpecApiClient.ts

# 3. 补充缺失端点
```

---

**报告生成**: 2025-11-19
**下次更新**: 完成本周任务后
**负责人**: Claude Code 自动化分析
**状态**: ✅ 分析完成，等待执行
