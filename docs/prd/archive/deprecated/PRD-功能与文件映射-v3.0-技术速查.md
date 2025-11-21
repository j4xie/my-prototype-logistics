# 白垩纪食品溯源系统 - 功能与文件映射 v3.0 技术速查

> **版本**: v3.0-技术速查
> **类型**: 快速参考，适合已熟悉系统的开发者
> **生成日期**: 2025-11-21
> **格式**: 简洁API列表 + 文件路径
> **核对状态**: ✅ 已核对与实现同步

---

## 📑 文档目录

1. [核对结果与统计](#核对结果与统计)
2. [认证与权限模块](#1-认证与权限模块)
3. [考勤管理模块](#2-考勤管理模块)
4. [生产加工模块](#3-生产加工模块)
5. [AI智能分析模块](#4-ai智能分析模块)
6. [设备管理模块](#5-设备管理模块)
7. [库存管理模块](#6-库存管理模块)
8. [质量检验模块](#7-质量检验模块)
9. [基础数据管理模块](#8-基础数据管理模块)
10. [平台管理模块](#9-平台管理模块)
11. [报表分析模块](#10-报表分析模块)
12. [数据导入导出](#11-数据导入导出)

---

## 核对结果与统计

### ✅ 核对数据

| 维度 | 预期值 | 实际值 | 状态 |
|------|--------|--------|------|
| **前端页面总数** | 75个 | 75个 | ✅ 准确 |
| **后端Controller** | 25个 | 25个 | ✅ 准确 |
| **已实现API端点** | 577个* | **397个** | ✅ 准确 |
| **规划中API端点** | - | **180个** | 📋 新增统计 |
| **数据实体数量** | 43个 | 43个 | ✅ 准确 |
| **系统完成度** | 75-80% | **82-85%** | ✅ 更新 |

**说明**: *v2.0中声称577个API端点，经核对实际已实现397个（25个Controllers），其余180个为Phase 4-5规划中的端点。

### 📊 各模块完成度

| 模块 | 前端页面 | 后端API | 整体完成度 | 状态 |
|------|---------|---------|-----------|------|
| 认证与授权 | 3页 | 37个 | 95% | ✅ 基本完成 |
| 考勤打卡 | 5页 | 30个 | 90% | ✅ 基本完成 |
| 生产加工 | 25页 | 50个 | 85% | 🔨 核心完成，细节完善中 |
| AI成本分析 | 5页 | 12个 | 95% | ✅ 基本完成 |
| 设备管理 | 4页 | 26个 | 90% | ✅ 基本完成 |
| 质量检验 | 3页 | 5个 | 70% | 🔨 待完成 |
| 基础数据管理 | 14页 | 多个 | 90% | ✅ 基本完成 |
| 平台管理 | 3页 | 12个 | 85% | ✅ 基本完成 |
| 报表分析 | 12页 | 20个 | 80% | 🔨 待完善 |

**系统总体完成度**: **82-85%** (更新自v2.0的75-80%)

---

## 1. 认证与权限模块

### 1.1 统一登录 | ✅ 95%

**前端**: `src/screens/auth/EnhancedLoginScreen.tsx` (~400行)
**后端**: `controller/MobileController.java` (603行)
**API**:
```
POST /api/mobile/auth/unified-login       ✅
POST /api/mobile/auth/refresh-token       ✅
POST /api/mobile/auth/logout              ✅
GET  /api/mobile/auth/me                  ✅
```

### 1.2 Token刷新 | ✅ 100%

**实现**: `services/api/apiClient.ts` (响应拦截器)
**说明**: 自动检测401，使用RefreshToken刷新AccessToken

### 1.3 用户注册 | 🔨 部分完成

**前端**: `src/screens/auth/RegisterScreen.tsx`
**API**:
```
POST /api/mobile/auth/register-phase-one   🔨
POST /api/mobile/auth/register-phase-two   🔨
```

### 1.4 权限验证 | ✅ 100%

**前端**: `components/permissions/PermissionGuard.tsx`
**后端**: Spring Security `@PreAuthorize` 注解

---

## 2. 考勤管理模块

### 2.1 员工打卡 | ✅ 90%

**前端**: `src/screens/attendance/TimeClockScreen.tsx` (~350行)
**后端**: `controller/TimeClockController.java` (216行)
**API**:
```
POST /api/mobile/{factoryId}/timeclock/clock-in    ✅
POST /api/mobile/{factoryId}/timeclock/clock-out   ✅
GET  /api/mobile/{factoryId}/timeclock/status      ✅
GET  /api/mobile/{factoryId}/timeclock/today       ✅
GET  /api/mobile/{factoryId}/timeclock/history     🔨
```

### 2.2 工时统计 | ✅ 90%

**前端**: `src/screens/attendance/AttendanceStatisticsScreen.tsx`
**后端**: `controller/TimeStatsController.java` (259行)
**API**:
```
GET /api/mobile/{factoryId}/time-stats/summary              ✅
GET /api/mobile/{factoryId}/time-stats/by-department        ✅
GET /api/mobile/{factoryId}/time-stats/by-user/{userId}    ✅
GET /api/mobile/{factoryId}/personnel/work-hours-ranking   ✅
GET /api/mobile/{factoryId}/personnel/overtime-statistics  ✅
```

---

## 3. 生产加工模块

### 3.1 批次列表与详情 | ✅ 85%

**前端**: `src/screens/processing/BatchListScreen.tsx` (~400行)
**后端**: `controller/ProcessingController.java`
**API**:
```
GET    /api/mobile/{factoryId}/processing/batches                ✅
POST   /api/mobile/{factoryId}/processing/batches                ✅
GET    /api/mobile/{factoryId}/processing/batches/{batchId}      ✅
PUT    /api/mobile/{factoryId}/processing/batches/{batchId}      ✅
DELETE /api/mobile/{factoryId}/processing/batches/{batchId}      ✅
POST   /api/mobile/{factoryId}/processing/batches/{id}/start     ✅
POST   /api/mobile/{factoryId}/processing/batches/{id}/complete  ✅
```

### 3.2 原材料批次管理 | ✅ 90%

**前端**: `src/screens/processing/MaterialBatchManagementScreen.tsx` (56KB)
**后端**: `controller/MaterialBatchController.java` (463行)
**API**:
```
GET    /api/mobile/{factoryId}/material-batches                      ✅
POST   /api/mobile/{factoryId}/material-batches                      ✅
GET    /api/mobile/{factoryId}/material-batches/{batchId}            ✅
PUT    /api/mobile/{factoryId}/material-batches/{batchId}            ✅
DELETE /api/mobile/{factoryId}/material-batches/{batchId}            ✅
GET    /api/mobile/{factoryId}/material-batches/material-type/{id}   ✅
GET    /api/mobile/{factoryId}/material-batches/status/{status}      ✅
GET    /api/mobile/{factoryId}/material-batches/low-stock            ✅
GET    /api/mobile/{factoryId}/material-batches/near-expiry          ✅
POST   /api/mobile/{factoryId}/material-batches/{id}/consume         🔨
```

### 3.3 生产计划 | ✅ 85%

**前端**: `src/screens/processing/ProductionPlanManagementScreen.tsx`
**后端**: `controller/ProductionPlanController.java` (387行)
**API**:
```
GET  /api/mobile/{factoryId}/production-plans           ✅
POST /api/mobile/{factoryId}/production-plans           ✅
PUT  /api/mobile/{factoryId}/production-plans/{id}      ✅
POST /api/mobile/{factoryId}/production-plans/{id}/execute   ✅
```

### 3.4 质量检验 | 🔨 70%

**前端**: `src/screens/processing/CreateQualityRecordScreen.tsx`
**后端**: `controller/QualityInspectionController.java` (107行)
**API**:
```
GET  /api/mobile/{factoryId}/quality-inspections             ✅
POST /api/mobile/{factoryId}/quality-inspections             🔨
GET  /api/mobile/{factoryId}/quality-inspections/{id}        🔨
GET  /api/mobile/{factoryId}/processing/quality/statistics   ✅
```

### 3.5 成本分析 | ✅ 95%

**前端**: `src/screens/processing/CostAnalysisDashboard.tsx` (~500行)
**API**:
```
GET  /api/mobile/{factoryId}/processing/batches/{batchId}/cost-analysis   ✅
POST /api/mobile/{factoryId}/ai/analysis/cost/batch                       ✅
```

---

## 4. AI智能分析模块

### 4.1 AI批次成本分析 | ✅ 95%

**前端**: `src/screens/processing/DeepSeekAnalysisScreen.tsx`
**后端**: `controller/AIController.java` (409行)
**Service**: `service/AIEnterpriseService.java`
**Python**: `backend-java/backend-ai-chat/ai_service.py`

**API**:
```
POST /api/mobile/{factoryId}/ai/analysis/cost/batch         ✅
GET  /api/mobile/{factoryId}/ai/quota                       ✅
PUT  /api/mobile/{factoryId}/ai/quota                       ✅
GET  /api/mobile/{factoryId}/ai/conversations/{sessionId}   ✅
DELETE /api/mobile/{factoryId}/ai/conversations/{sessionId} ✅
GET  /api/mobile/{factoryId}/ai/reports                     ✅
GET  /api/mobile/{factoryId}/ai/reports/{reportId}          ✅
GET  /api/mobile/{factoryId}/ai/health                      ✅
```

**缓存**: Redis, TTL 5分钟

---

## 5. 设备管理模块

### 5.1 设备列表与管理 | ✅ 90%

**前端**: `src/screens/processing/EquipmentManagementScreen.tsx`
**后端**: `controller/EquipmentController.java` (502行)

**API**:
```
GET    /api/mobile/{factoryId}/equipment                    ✅
POST   /api/mobile/{factoryId}/equipment                    ✅
GET    /api/mobile/{factoryId}/equipment/{equipmentId}      ✅
PUT    /api/mobile/{factoryId}/equipment/{equipmentId}      ✅
DELETE /api/mobile/{factoryId}/equipment/{equipmentId}      ✅
POST   /api/mobile/{factoryId}/equipment/{equipmentId}/start        ✅
POST   /api/mobile/{factoryId}/equipment/{equipmentId}/stop         ✅
POST   /api/mobile/{factoryId}/equipment/{equipmentId}/maintenance  ✅
GET    /api/mobile/{factoryId}/equipment/{equipmentId}/history      ✅
GET    /api/mobile/{factoryId}/equipment/statistics                 ✅
```

### 5.2 设备告警管理 | 🔨 80%

**前端**: `src/screens/processing/EquipmentAlertsScreen.tsx`

**API**:
```
GET  /api/mobile/{factoryId}/equipment-alerts?status=ACTIVE        ✅
POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/acknowledge 🔨
POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/resolve     🔨
```

---

## 6. 库存管理模块

### 6.1 库存预警与统计 | ✅ 90%

**API**:
```
GET /api/mobile/{factoryId}/material-batches/low-stock      ✅
GET /api/mobile/{factoryId}/material-batches/near-expiry    ✅
GET /api/mobile/{factoryId}/material-batches/statistics     ✅
```

---

## 7. 质量检验模块

**状态**: 🔨 **待完成 (70%)**

**API** (已实现):
```
GET  /api/mobile/{factoryId}/quality-inspections             ✅
GET  /api/mobile/{factoryId}/processing/quality/statistics   ✅
```

**API** (待完成):
```
POST /api/mobile/{factoryId}/quality-inspections             🔨
GET  /api/mobile/{factoryId}/quality-inspections/{id}        🔨
PUT  /api/mobile/{factoryId}/quality-inspections/{id}        🔨
DELETE /api/mobile/{factoryId}/quality-inspections/{id}      🔨
```

---

## 8. 基础数据管理模块

### 各子模块

| 模块 | Controller | 代码行数 | 状态 |
|------|-----------|---------|------|
| 用户管理 | UserController | 314行 | ✅ |
| 部门管理 | DepartmentController | ~250行 | ✅ |
| 产品类型管理 | ProductTypeController | ~280行 | ✅ |
| 原材料类型管理 | MaterialTypeController | 556行 | ✅ |
| 供应商管理 | SupplierController | 398行 | ✅ |
| 客户管理 | CustomerController | 506行 | ✅ |
| 白名单管理 | WhitelistController | 281行 | ✅ |
| 工厂设置 | FactorySettingsController | 263行 | ✅ |

### 8.1 用户管理 | ✅ 90%

**前端**: `src/screens/management/UserManagementScreen.tsx`

**API**:
```
GET    /api/mobile/{factoryId}/users                        ✅
POST   /api/mobile/{factoryId}/users                        ✅
GET    /api/mobile/{factoryId}/users/{userId}               ✅
PUT    /api/mobile/{factoryId}/users/{userId}               ✅
DELETE /api/mobile/{factoryId}/users/{userId}               ✅
GET    /api/mobile/{factoryId}/users/role/{roleCode}        ✅
POST   /api/mobile/{factoryId}/users/{userId}/activate      ✅
POST   /api/mobile/{factoryId}/users/{userId}/deactivate    ✅
```

---

## 9. 平台管理模块

### 9.1 工厂管理 | ✅ 85%

**前端**: `src/screens/platform/FactoryManagementScreen.tsx`
**后端**: `controller/PlatformController.java` (217行)

**API**:
```
GET    /api/platform/factories                     ✅
GET    /api/platform/factories/{factoryId}         ✅
POST   /api/platform/factories                     ✅
PUT    /api/platform/factories/{factoryId}         ✅
DELETE /api/platform/factories/{factoryId}         ✅
POST   /api/platform/factories/{factoryId}/activate    ✅
POST   /api/platform/factories/{factoryId}/deactivate  ✅
```

### 9.2 AI配额管理 | ✅ 100%

**前端**: `src/screens/platform/AIQuotaManagementScreen.tsx`

**API**:
```
GET /api/platform/ai-quota                    ✅
PUT /api/platform/ai-quota/{factoryId}        ✅
GET /api/platform/ai-usage-stats?period=weekly ✅
```

---

## 10. 报表分析模块

**状态**: 🔨 **开发中 (80%)**

### 前端实现

| 文件 | 代码行数 | 状态 |
|------|---------|------|
| `screens/reports/ReportDashboardScreen.tsx` | ~400行 | ✅ |
| `screens/reports/ProductionReportScreen.tsx` | ~300行 | ✅ |
| `screens/reports/QualityReportScreen.tsx` | ~300行 | ✅ |
| `screens/reports/CostReportScreen.tsx` | ~300行 | ✅ |
| `screens/reports/PersonnelReportScreen.tsx` | ~300行 | ✅ |

### 后端实现

**Controller**: `controller/ReportController.java` (347行)

**API**:
```
GET /api/mobile/{factoryId}/reports/production      ✅
GET /api/mobile/{factoryId}/reports/quality         ✅
GET /api/mobile/{factoryId}/reports/cost            ✅
GET /api/mobile/{factoryId}/reports/personnel       ✅
GET /api/mobile/{factoryId}/reports/efficiency      🔨
GET /api/mobile/{factoryId}/reports/{reportId}/download  🔨
POST /api/mobile/{factoryId}/reports/export-excel       🔨
POST /api/mobile/{factoryId}/reports/export-pdf         🔨
```

---

## 11. 数据导入导出

**状态**: 🔨 **开发中 (70%)**

**支持格式**: Excel (.xlsx), CSV (.csv), PDF (.pdf)

**API**:
```
GET  /api/mobile/{factoryId}/users/export              🔨
POST /api/mobile/{factoryId}/users/import              🔨
GET  /api/mobile/{factoryId}/equipment/export          🔨
POST /api/mobile/{factoryId}/equipment/import          🔨
```

---

## 快速查询

### API基础URL
```
生产环境: http://139.196.165.140:10010
本地开发: http://localhost:10010
```

### 认证Header
```
Authorization: Bearer {AccessToken}
```

### 常用Factory ID
```
CRETAS_2024_001  - 主厂（测试用）
```

### 角色代码
- `platform_admin` - 平台管理员
- `factory_super_admin` - 工厂超级管理员
- `factory_admin` - 工厂管理员
- `department_admin` - 部门主任
- `supervisor` - 班组长
- `operator` - 操作员
- `viewer` - 查看者

---

## 状态图例

- ✅ 已完成
- 🔨 开发中
- 📅 规划中

---

**更新日期**: 2025-11-21
**维护人**: Claude Code
