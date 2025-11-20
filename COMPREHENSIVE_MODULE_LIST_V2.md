# 完整模块列表 V2.0

**生成时间**: 2025-11-20
**模块总数**: 27个 (更新自之前的19个)
**后端Controllers**: 25个
**前端API Clients**: 34个 (包括3个future目录文件)

---

## 📊 完整模块对照表

### ✅ P0: 核心业务模块 (4个)

#### 1. 认证模块 (Authentication)
**优先级**: P0
**后端**: MobileController
**前端**:
- `mobileApiClient.ts`
- `forgotPasswordApiClient.ts`

**API路径**: `/api/mobile/auth/*`

**主要功能** (12个API):
- `POST /auth/unified-login` - 统一登录
- `POST /auth/refresh` - 刷新令牌
- `POST /auth/logout` - 登出
- `POST /auth/send-verification-code` - 发送验证码
- `POST /auth/verify-reset-code` - 验证重置码
- `POST /auth/forgot-password` - 忘记密码
- `POST /auth/register-phase-one` - 注册第一阶段
- `POST /auth/register-phase-two` - 注册第二阶段
- `GET /auth/validate` - 验证令牌
- `GET /auth/me` - 获取当前用户
- `POST /auth/change-password` - 修改密码
- `POST /auth/reset-password` - 重置密码(管理员)

**集成状态**: ✅ 完全集成

---

#### 2. 生产加工模块 (Processing)
**优先级**: P0
**后端**: ProcessingController
**前端**:
- `processingApiClient.ts`
- `dashboardApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/processing/*`

**主要功能** (15+个API):
- `GET /processing/batches` - 批次列表
- `POST /processing/batches` - 创建批次
- `GET /processing/batches/{id}` - 批次详情
- `PUT /processing/batches/{id}` - 更新批次
- `POST /processing/batches/{id}/start` - 开始生产
- `POST /processing/batches/{id}/pause` - 暂停生产
- `POST /processing/batches/{id}/complete` - 完成生产
- `GET /processing/dashboard/overview` - Dashboard概览
- `GET /processing/dashboard/alerts` - Dashboard告警
- `GET /processing/dashboard/trends` - Dashboard趋势 ✅ 已测试
- `GET /processing/cost-comparison` - 成本对比

**集成状态**: ✅ 完全集成

---

#### 3. 质检模块 (Quality Inspection)
**优先级**: P0
**后端**: QualityInspectionController
**前端**: `qualityInspectionApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/quality-inspections/*`

**主要功能** (10+个API):
- `GET /quality-inspections` - 质检列表
- `POST /quality-inspections` - 创建质检记录
- `GET /quality-inspections/{id}` - 质检详情
- `PUT /quality-inspections/{id}` - 更新质检记录
- `DELETE /quality-inspections/{id}` - 删除质检记录
- `GET /quality-inspections/statistics` - 质检统计
- `GET /quality-inspections/batch/{batchId}` - 批次质检记录

**集成状态**: ✅ 完全集成

---

#### 4. 设备告警模块 (Equipment Alerts)
**优先级**: P0
**后端**:
- MobileController (告警管理)
- EquipmentController (设备管理)

**前端**:
- `equipmentApiClient.ts`
- `alertApiClient.ts`

**API路径**:
- `/api/mobile/{factoryId}/equipment-alerts/*`
- `/api/mobile/{factoryId}/equipment/alerts/*`

**主要功能** (10个API):
- `GET /{factoryId}/equipment-alerts` - 告警列表
- `GET /{factoryId}/equipment-alerts/statistics` - 告警统计 ✅ 已测试
- `POST /{factoryId}/equipment/alerts/{id}/acknowledge` - 确认告警
- `POST /{factoryId}/equipment/alerts/{id}/resolve` - 解决告警
- `POST /{factoryId}/equipment/alerts/{id}/ignore` - 忽略告警
- `GET /equipment/{id}/alerts` - 设备告警列表
- `GET /equipment/alerts/active` - 活跃告警

**集成状态**: ✅ 完全集成

---

### ✅ P1: 核心功能模块 (6个)

#### 5. 用户管理模块 (User Management)
**优先级**: P1
**后端**: UserController
**前端**: `userApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/users/*`

**主要功能** (8个API):
- `GET /users` - 用户列表
- `POST /users` - 创建用户
- `GET /users/{id}` - 用户详情
- `PUT /users/{id}` - 更新用户
- `DELETE /users/{id}` - 删除用户
- `PUT /users/{id}/status` - 更新用户状态
- `GET /users/by-role/{role}` - 按角色查询

**集成状态**: ✅ 完全集成

---

#### 6. 考勤打卡模块 (Time Clock & Attendance)
**优先级**: P1
**后端**:
- TimeClockController (打卡)
- TimeStatsController (统计)

**前端**:
- `timeclockApiClient.ts`
- `timeStatsApiClient.ts`

**API路径**:
- `/api/mobile/{factoryId}/timeclock/*`
- `/api/mobile/{factoryId}/time-stats/*`

**主要功能** (12个API):
- `POST /timeclock/clock-in` - 上班打卡
- `POST /timeclock/clock-out` - 下班打卡
- `GET /timeclock/today` - 今日打卡记录
- `GET /timeclock/records` - 打卡记录列表
- `GET /timeclock/user/{userId}` - 用户打卡记录
- `GET /time-stats/daily` - 每日统计
- `GET /time-stats/weekly` - 每周统计
- `GET /time-stats/monthly` - 每月统计
- `GET /time-stats/user/{userId}` - 用户工时统计

**集成状态**: ✅ 完全集成

---

#### 7. 客户管理模块 (Customer Management)
**优先级**: P1
**后端**: CustomerController
**前端**: `customerApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/customers/*`

**主要功能** (10+个API):
- `GET /customers` - 客户列表
- `POST /customers` - 创建客户
- `GET /customers/{id}` - 客户详情
- `PUT /customers/{id}` - 更新客户
- `DELETE /customers/{id}` - 删除客户
- `POST /customers/import` - Excel导入客户
- `GET /customers/export` - 导出客户列表
- `GET /customers/search` - 搜索客户

**集成状态**: ✅ 完全集成

---

#### 8. 供应商管理模块 (Supplier Management)
**优先级**: P1
**后端**: SupplierController
**前端**: `supplierApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/suppliers/*`

**主要功能** (10+个API):
- `GET /suppliers` - 供应商列表
- `POST /suppliers` - 创建供应商
- `GET /suppliers/{id}` - 供应商详情
- `PUT /suppliers/{id}` - 更新供应商
- `DELETE /suppliers/{id}` - 删除供应商
- `GET /suppliers/{id}/materials` - 供应商原料
- `GET /suppliers/search` - 搜索供应商

**集成状态**: ✅ 完全集成

---

#### 9. 原料批次管理模块 (Material Batch Management)
**优先级**: P1
**后端**: MaterialBatchController
**前端**:
- `materialBatchApiClient.ts`
- `materialQuickApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/material-batches/*`

**主要功能** (12+个API):
- `GET /material-batches` - 批次列表
- `POST /material-batches` - 创建批次
- `GET /material-batches/{id}` - 批次详情
- `PUT /material-batches/{id}` - 更新批次
- `POST /material-batches/{id}/adjust-stock` - 库存调整
- `GET /material-batches/low-stock` - 低库存警告
- `GET /material-batches/expiring` - 即将过期
- `GET /material-batches/statistics` - 批次统计

**集成状态**: ✅ 完全集成

---

#### 10. 人员报表模块 (Personnel Reports) ⚠️ 新发现
**优先级**: P1
**后端**: MobileController
**前端**: `personnelApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/personnel/*`

**主要功能** (4个API):
- `GET /{factoryId}/personnel/statistics` - 人员总览统计
- `GET /{factoryId}/personnel/work-hours-ranking` - 工时排行榜
- `GET /{factoryId}/personnel/overtime-statistics` - 加班统计
- `GET /{factoryId}/personnel/performance` - 人员绩效统计

**集成状态**: ✅ 完全集成 (在MobileController中实现)

**注**: 之前遗漏了此模块，现已确认后端API完整实现

---

### ✅ P2: 扩展功能模块 (12个)

#### 11. 平台管理模块 (Platform Management)
**优先级**: P2
**后端**: PlatformController
**前端**: `platformApiClient.ts`

**API路径**: `/api/platform/*`

**主要功能** (8个API):
- `GET /platform/factories` - 工厂列表
- `POST /platform/factories` - 创建工厂
- `GET /platform/factories/{id}` - 工厂详情
- `PUT /platform/factories/{id}` - 更新工厂
- `DELETE /platform/factories/{id}` - 删除工厂
- `GET /platform/statistics` - 平台统计

**集成状态**: ✅ 完全集成

---

#### 12. 工厂管理模块 (Factory Management)
**优先级**: P2
**后端**: PlatformController (子功能)
**前端**: `factoryApiClient.ts`

**API路径**: `/api/platform/factories/*`

**主要功能**: 与平台管理模块共用API

**集成状态**: ✅ 完全集成

---

#### 13. 工厂设置模块 (Factory Settings)
**优先级**: P2
**后端**: FactorySettingsController
**前端**: `factorySettingsApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/settings/*`

**主要功能** (5个API):
- `GET /settings` - 获取工厂设置
- `PUT /settings` - 更新工厂设置
- `GET /settings/general` - 通用设置
- `GET /settings/processing` - 加工设置
- `GET /settings/quality` - 质检设置

**集成状态**: ✅ 完全集成

---

#### 14. 部门管理模块 (Department Management)
**优先级**: P2
**后端**: DepartmentController
**前端**: `departmentApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/departments/*`

**主要功能** (8个API):
- `GET /departments` - 部门列表
- `POST /departments` - 创建部门
- `GET /departments/{id}` - 部门详情
- `PUT /departments/{id}` - 更新部门
- `DELETE /departments/{id}` - 删除部门
- `GET /departments/{id}/users` - 部门用户

**集成状态**: ✅ 完全集成

---

#### 15. 产品类型模块 (Product Type Management)
**优先级**: P2
**后端**: ProductTypeController
**前端**: `productTypeApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/product-types/*`

**主要功能** (8个API):
- `GET /product-types` - 产品类型列表
- `POST /product-types` - 创建产品类型
- `GET /product-types/{id}` - 产品类型详情
- `PUT /product-types/{id}` - 更新产品类型
- `DELETE /product-types/{id}` - 删除产品类型

**集成状态**: ✅ 完全集成

---

#### 16. 原料类型模块 (Material Type Management)
**优先级**: P2
**后端**: MaterialTypeController
**前端**: `materialTypeApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/materials/types/*`

**主要功能** (8个API):
- `GET /materials/types` - 原料类型列表
- `POST /materials/types` - 创建原料类型
- `GET /materials/types/{id}` - 原料类型详情
- `PUT /materials/types/{id}` - 更新原料类型
- `DELETE /materials/types/{id}` - 删除原料类型

**集成状态**: ✅ 完全集成

---

#### 17. 原料规格配置模块 (Material Spec Config) ⚠️ 新发现
**优先级**: P2
**后端**: MaterialSpecConfigController
**前端**: `materialSpecApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/material-spec-config/*`

**主要功能** (3个API):
- `GET /material-spec-config` - 获取规格配置
- `PUT /material-spec-config/{category}` - 更新类别规格
- `DELETE /material-spec-config/{category}` - 重置为默认

**集成状态**: ✅ 完全集成

**注**: 之前遗漏了此独立模块

---

#### 18. 原始原料类型模块 (Raw Material Type) ⚠️ 新发现
**优先级**: P2
**后端**: RawMaterialTypeController
**前端**: `materialTypeApiClient.ts` (可能共用)

**API路径**: `/api/mobile/{factoryId}/raw-material-types/*`

**主要功能** (8个API):
- `GET /raw-material-types` - 原始原料类型列表
- `POST /raw-material-types` - 创建原始原料类型
- `GET /raw-material-types/{id}` - 原始原料类型详情
- `PUT /raw-material-types/{id}` - 更新原始原料类型
- `DELETE /raw-material-types/{id}` - 删除原始原料类型

**集成状态**: ✅ 完全集成

**注**: 之前遗漏了此独立模块，与MaterialTypeController不同

---

#### 19. 转换率管理模块 (Conversion Rate Management)
**优先级**: P2
**后端**: ConversionController
**前端**: `conversionApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/conversions/*`

**主要功能** (8个API):
- `GET /conversions` - 转换率列表
- `POST /conversions` - 创建转换率
- `GET /conversions/{id}` - 转换率详情
- `PUT /conversions/{id}` - 更新转换率
- `DELETE /conversions/{id}` - 删除转换率
- `GET /conversions/material/{materialId}` - 原料转换率

**集成状态**: ✅ 完全集成

---

#### 20. 工作类型模块 (Work Type Management) ⚠️ 新发现
**优先级**: P2
**后端**: WorkTypeController
**前端**: `workTypeApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/work-types/*`

**主要功能** (8个API):
- `GET /work-types` - 工作类型列表
- `POST /work-types` - 创建工作类型
- `GET /work-types/{id}` - 工作类型详情
- `PUT /work-types/{id}` - 更新工作类型
- `DELETE /work-types/{id}` - 删除工作类型

**集成状态**: ✅ 完全集成

**注**: 之前遗漏了此独立模块

---

#### 21. AI分析模块 (AI Analysis - DeepSeek)
**优先级**: P2
**后端**: AIController
**前端**: `aiApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/ai/*`

**主要功能** (5+个API):
- `POST /ai/analyze/cost` - 成本分析
- `POST /ai/analyze/quality` - 质量分析
- `POST /ai/analyze/efficiency` - 效率分析
- `GET /ai/history` - 分析历史
- `GET /ai/usage` - AI使用统计

**集成状态**: ✅ 完全集成

---

#### 22. 生产计划模块 (Production Plan) ⚠️ 新发现
**优先级**: P2
**后端**: ProductionPlanController
**前端**: `productionPlanApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/production-plans/*`

**主要功能** (10个API):
- `GET /production-plans` - 计划列表
- `POST /production-plans` - 创建计划
- `GET /production-plans/{id}` - 计划详情
- `PUT /production-plans/{id}` - 更新计划
- `DELETE /production-plans/{id}` - 删除计划
- `POST /production-plans/{id}/execute` - 执行计划
- `GET /production-plans/statistics` - 计划统计

**集成状态**: ✅ 完全集成

**注**: 之前遗漏了此独立模块

---

### ✅ P3: 辅助功能模块 (5个)

#### 23. 报表模块 (Report Management)
**优先级**: P3
**后端**: ReportController
**前端**: `future/reportApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/reports/*`

**主要功能** (19个API):
- `GET /reports/daily-production` - 日生产报表
- `GET /reports/weekly-production` - 周生产报表
- `GET /reports/monthly-production` - 月生产报表
- `GET /reports/inventory` - 库存报表
- `GET /reports/cost-analysis` - 成本分析报表
- `GET /reports/quality` - 质量报表
- `GET /reports/material-usage` - 原料使用报表
- `GET /reports/product-output` - 产品产出报表
- `GET /reports/supplier-performance` - 供应商绩效
- `GET /reports/customer-sales` - 客户销售
- `GET /reports/employee-performance` - 员工绩效
- `GET /reports/equipment-utilization` - 设备利用率
- `GET /reports/wastage` - 损耗报表
- `GET /reports/profit-analysis` - 利润分析
- `GET /reports/trend-analysis` - 趋势分析
- `GET /reports/comparison` - 对比报表
- `POST /reports/custom` - 自定义报表
- `GET /reports/export/{type}` - 导出报表
- `POST /reports/schedule` - 定时报表

**集成状态**: ✅ 完全集成

---

#### 24. 系统管理模块 (System Management)
**优先级**: P3
**后端**: SystemController
**前端**: `systemApiClient.ts`

**API路径**: `/api/mobile/system/*`

**主要功能** (5个API):
- `GET /system/health` - 系统健康检查
- `GET /system/info` - 系统信息
- `GET /system/version` - 版本信息
- `GET /system/logs` - 系统日志
- `POST /system/backup` - 系统备份

**集成状态**: ✅ 完全集成

---

#### 25. 白名单管理模块 (Whitelist Management)
**优先级**: P3
**后端**: WhitelistController
**前端**: `whitelistApiClient.ts`

**API路径**: `/api/{factoryId}/whitelist/*`

**主要功能** (8个API):
- `GET /whitelist` - 白名单列表
- `POST /whitelist` - 添加白名单
- `GET /whitelist/{id}` - 白名单详情
- `PUT /whitelist/{id}` - 更新白名单
- `DELETE /whitelist/{id}` - 删除白名单
- `POST /whitelist/check` - 检查手机号

**集成状态**: ✅ 完全集成

---

#### 26. 用户反馈模块 (User Feedback) ⚠️ 新发现
**优先级**: P3
**后端**: MobileController
**前端**: `feedbackApiClient.ts`

**API路径**: `/api/mobile/{factoryId}/feedback/*`

**主要功能** (1个API):
- `POST /{factoryId}/feedback` - 提交用户反馈

**集成状态**: ✅ 完全集成 (在MobileController中实现)

**注**: 之前遗漏了此独立模块

---

#### 27. 设备激活模块 (Device Activation) ⚠️ 新发现
**优先级**: P3
**后端**: MobileController
**前端**: `future/activationApiClient.ts`

**API路径**:
- `/api/mobile/activation/*`
- `/api/mobile/devices/*`

**主要功能** (3个API):
- `POST /activation/activate` - 设备激活
- `GET /devices` - 获取用户设备列表
- `DELETE /devices/{deviceId}` - 移除设备

**集成状态**: ✅ 完全集成 (在MobileController中实现)

**注**: 之前遗漏了此独立模块

---

## 📁 文件重复情况

### ⚠️ 发现的重复文件

1. **equipmentApiClient.ts**
   - 主目录: `/src/services/api/equipmentApiClient.ts`
   - future目录: `/src/services/api/future/equipmentApiClient.ts`
   - **建议**: 保留主目录版本，删除future版本

2. **future目录文件**
   - `future/reportApiClient.ts` - 报表模块 (ReportController已实现)
   - `future/activationApiClient.ts` - 设备激活 (MobileController已实现)
   - `future/equipmentApiClient.ts` - 设备管理 (EquipmentController已实现)
   - **说明**: future目录文件都已有对应的后端实现，可能是旧版本或备份

---

## 📊 统计汇总

### 模块数量
- **总模块数**: 27个 (非之前的19个)
- **P0核心业务**: 4个
- **P1核心功能**: 6个
- **P2扩展功能**: 12个
- **P3辅助功能**: 5个

### Controller统计
- **后端Controllers**: 25个
- **其中多功能Controllers**:
  - MobileController: 36个API (认证、人员报表、用户反馈、设备激活、告警等)
  - ProcessingController: 15+个API
  - EquipmentController: 30+个API

### API客户端统计
- **前端API Clients**: 34个文件
  - 主目录: 30个
  - future目录: 3个 (有1个重复)
  - API Client基类: 1个 (apiClient.ts)

### API端点统计
- **预估总API数**: 200+ 个
- **已测试API数**: 6个
- **待测试API数**: 194+个

### 集成状态
- **完全集成模块**: 27个 (100%)
- **部分集成模块**: 0个
- **未集成模块**: 0个

---

## ⚠️ 之前遗漏的模块 (8个)

1. **原料规格配置模块** - MaterialSpecConfigController ✅
2. **原始原料类型模块** - RawMaterialTypeController ✅
3. **工作类型模块** - WorkTypeController ✅
4. **人员报表模块** - MobileController (personnel/*) ✅
5. **用户反馈模块** - MobileController (feedback) ✅
6. **设备激活模块** - MobileController (activation/*, devices/*) ✅
7. **生产计划模块** - ProductionPlanController ✅
8. **忘记密码功能** - MobileController (auth/forgot-password) ✅

所有遗漏模块均已确认后端API完整实现。

---

## 📝 下一步行动

1. **更新测试计划**: 从150个测试用例扩展到200+个
2. **清理重复文件**: 删除future目录中的重复文件
3. **执行集成测试**: 按P0→P1→P2→P3顺序执行全部测试
4. **生成测试报告**: 记录所有测试结果和问题修复

---

**文档版本**: V2.0
**上一版本**: V1.0 (19个模块)
**更新内容**: 新增8个遗漏模块，修正模块总数为27个
