# 白垩纪食品溯源系统 - 完整模块列表

**生成时间**: 2025-11-20
**后端Controllers**: 25个
**前端API Clients**: 33个

---

## 📋 模块分类总览

### 核心业务模块 (10个)

1. **认证与授权模块** (Authentication & Authorization)
2. **用户管理模块** (User Management)
3. **工厂管理模块** (Factory Management)
4. **部门管理模块** (Department Management)
5. **考勤打卡模块** (Time & Attendance)
6. **生产加工模块** (Production Processing)
7. **质量检验模块** (Quality Inspection)
8. **设备告警模块** (Equipment & Alerts)
9. **客户管理模块** (Customer Management)
10. **供应商管理模块** (Supplier Management)

### 支撑功能模块 (9个)

11. **原料管理模块** (Material Management)
12. **产品类型模块** (Product Type Management)
13. **工作类型模块** (Work Type Management)
14. **转换率管理** (Conversion Rate Management)
15. **生产计划模块** (Production Plan)
16. **AI分析模块** (AI Analysis)
17. **报表模块** (Report)
18. **白名单管理** (Whitelist)
19. **系统管理模块** (System Management)

---

## 🔍 详细模块说明

### 1. 认证与授权模块 (Authentication & Authorization)

**后端**: `MobileController` (auth相关端点)
**前端**: `mobileApiClient.ts`

**核心功能**:
- ✅ 统一登录 (平台管理员 + 工厂用户)
- ✅ 刷新令牌
- ⚠️ 设备绑定
- ⚠️ 双因素认证

**关键API**:
- `POST /api/mobile/auth/unified-login` - 统一登录
- `POST /api/mobile/auth/refresh` - 刷新令牌
- `POST /api/mobile/auth/bind-device` - 设备绑定

---

### 2. 用户管理模块 (User Management)

**后端**: `UserController`
**前端**: `userApiClient.ts`

**核心功能**:
- ✅ 用户CRUD (增删改查)
- ✅ 用户列表分页
- ✅ 角色管理 (8个角色)
- ✅ 用户状态管理

**关键API**:
- `GET /api/mobile/{factoryId}/users` - 用户列表
- `POST /api/mobile/{factoryId}/users` - 创建用户
- `PUT /api/mobile/{factoryId}/users/{userId}` - 更新用户
- `DELETE /api/mobile/{factoryId}/users/{userId}` - 删除用户
- `GET /api/mobile/{factoryId}/users/{userId}` - 用户详情

**8个角色**:
1. developer (开发者)
2. platform_admin (平台管理员)
3. factory_super_admin (工厂超级管理员)
4. factory_admin (工厂管理员)
5. department_admin (部门管理员)
6. supervisor (班组长)
7. operator (操作员)
8. viewer (查看者)

---

### 3. 工厂管理模块 (Factory Management)

**后端**: `PlatformController` + `FactorySettingsController`
**前端**: `platformApiClient.ts` + `factorySettingsApiClient.ts`

**核心功能**:
- ✅ 工厂CRUD (平台管理员)
- ✅ 工厂激活/停用
- ✅ 工厂设置 (AI、库存、生产、通知)
- ✅ AI配额管理

**关键API (Platform)**:
- `GET /api/platform/factories` - 工厂列表
- `POST /api/platform/factories` - 创建工厂
- `PUT /api/platform/factories/{factoryId}` - 更新工厂
- `DELETE /api/platform/factories/{factoryId}` - 删除工厂
- `POST /api/platform/factories/{factoryId}/activate` - 激活工厂
- `POST /api/platform/factories/{factoryId}/deactivate` - 停用工厂
- `GET /api/platform/dashboard/statistics` - 平台统计

**关键API (Settings)**:
- `GET /api/mobile/{factoryId}/settings` - 获取工厂设置
- `PUT /api/mobile/{factoryId}/settings` - 更新工厂设置
- `GET /api/mobile/{factoryId}/settings/basic` - 基本设置
- `PUT /api/mobile/{factoryId}/settings/basic` - 更新基本设置
- `GET /api/mobile/{factoryId}/settings/ai` - AI设置
- `PUT /api/mobile/{factoryId}/settings/ai` - 更新AI设置
- `GET /api/mobile/{factoryId}/settings/inventory` - 库存设置
- `PUT /api/mobile/{factoryId}/settings/inventory` - 更新库存设置

---

### 4. 部门管理模块 (Department Management)

**后端**: `DepartmentController`
**前端**: `departmentApiClient.ts`

**核心功能**:
- ✅ 部门CRUD
- ✅ 部门层级管理
- ✅ 部门成员管理

**关键API**:
- `GET /api/mobile/{factoryId}/departments` - 部门列表
- `POST /api/mobile/{factoryId}/departments` - 创建部门
- `PUT /api/mobile/{factoryId}/departments/{deptId}` - 更新部门
- `DELETE /api/mobile/{factoryId}/departments/{deptId}` - 删除部门

---

### 5. 考勤打卡模块 (Time & Attendance)

**后端**: `TimeClockController` + `TimeStatsController`
**前端**: `timeclockApiClient.ts` + `timeStatsApiClient.ts`

**核心功能**:
- ✅ 上班打卡/下班打卡
- ✅ 今日打卡记录查询
- ✅ 打卡历史查询
- ✅ 考勤统计 (个人/部门)
- ✅ GPS定位打卡

**关键API (TimeClock)**:
- `POST /api/mobile/{factoryId}/timeclock/clock-in` - 上班打卡
- `POST /api/mobile/{factoryId}/timeclock/clock-out` - 下班打卡
- `GET /api/mobile/{factoryId}/timeclock/today` - 今日打卡记录
- `GET /api/mobile/{factoryId}/timeclock/history` - 打卡历史
- `GET /api/mobile/{factoryId}/timeclock/records/{recordId}` - 打卡详情

**关键API (TimeStats)**:
- `GET /api/mobile/{factoryId}/timestats/personal` - 个人考勤统计
- `GET /api/mobile/{factoryId}/timestats/department` - 部门考勤统计
- `GET /api/mobile/{factoryId}/timestats/summary` - 考勤汇总

---

### 6. 生产加工模块 (Production Processing)

**后端**: `ProcessingController` + `ProductionPlanController`
**前端**: `processingApiClient.ts` + `productionPlanApiClient.ts`

**核心功能**:
- ✅ 生产批次管理 (CRUD)
- ✅ 批次状态流转 (planning → in_progress → completed/failed)
- ✅ 材料消耗记录
- ✅ 成本分析 (AI集成)
- ✅ Dashboard统计 (生产/质量/设备趋势)
- ✅ 生产计划管理

**关键API (Processing)**:
- `GET /api/mobile/{factoryId}/processing/batches` - 批次列表
- `POST /api/mobile/{factoryId}/processing/batches` - 创建批次
- `GET /api/mobile/{factoryId}/processing/batches/{batchId}` - 批次详情
- `PUT /api/mobile/{factoryId}/processing/batches/{batchId}` - 更新批次
- `POST /api/mobile/{factoryId}/processing/batches/{batchId}/start` - 开始生产
- `POST /api/mobile/{factoryId}/processing/batches/{batchId}/complete` - 完成生产
- `POST /api/mobile/{factoryId}/processing/batches/{batchId}/cancel` - 取消生产
- `POST /api/mobile/{factoryId}/processing/batches/{batchId}/material-consumption` - 记录材料消耗
- `GET /api/mobile/{factoryId}/processing/batches/{batchId}/cost-analysis` - 成本分析

**关键API (Dashboard)** ✅ 刚测试完成:
- `GET /api/mobile/{factoryId}/processing/dashboard/alerts` - 告警仪表盘
- `GET /api/mobile/{factoryId}/processing/dashboard/trends` - 趋势分析

**关键API (Production Plan)**:
- `GET /api/mobile/{factoryId}/production-plans` - 生产计划列表
- `POST /api/mobile/{factoryId}/production-plans` - 创建计划
- `PUT /api/mobile/{factoryId}/production-plans/{planId}` - 更新计划
- `DELETE /api/mobile/{factoryId}/production-plans/{planId}` - 删除计划

---

### 7. 质量检验模块 (Quality Inspection)

**后端**: `QualityInspectionController`
**前端**: `qualityInspectionApiClient.ts`

**核心功能**:
- ✅ 质检记录CRUD
- ✅ 质检结果管理 (合格/不合格)
- ✅ 质检统计分析
- ✅ 批次质检关联

**关键API**:
- `GET /api/mobile/{factoryId}/quality-inspections` - 质检列表
- `POST /api/mobile/{factoryId}/quality-inspections` - 创建质检
- `GET /api/mobile/{factoryId}/quality-inspections/{inspectionId}` - 质检详情
- `PUT /api/mobile/{factoryId}/quality-inspections/{inspectionId}` - 更新质检
- `DELETE /api/mobile/{factoryId}/quality-inspections/{inspectionId}` - 删除质检

---

### 8. 设备告警模块 (Equipment & Alerts)

**后端**: `EquipmentController` + `MobileController` (alerts相关)
**前端**: `equipmentApiClient.ts` + `alertApiClient.ts`

**核心功能**:
- ✅ 设备管理 (CRUD)
- ✅ 设备状态监控
- ✅ 告警管理 (创建/确认/解决/忽略)
- ✅ 告警统计分析
- ✅ 设备维护记录

**关键API (Equipment)**:
- `GET /api/mobile/{factoryId}/equipment` - 设备列表
- `POST /api/mobile/{factoryId}/equipment` - 创建设备
- `GET /api/mobile/{factoryId}/equipment/{equipmentId}` - 设备详情
- `PUT /api/mobile/{factoryId}/equipment/{equipmentId}` - 更新设备
- `DELETE /api/mobile/{factoryId}/equipment/{equipmentId}` - 删除设备

**关键API (Alerts)** ✅ 刚测试完成:
- `GET /api/mobile/{factoryId}/equipment-alerts/statistics` - 告警统计
- `POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/ignore` - 忽略告警
- `POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/acknowledge` - 确认告警
- `POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/resolve` - 解决告警

---

### 9. 客户管理模块 (Customer Management)

**后端**: `CustomerController`
**前端**: `customerApiClient.ts`

**核心功能**:
- ✅ 客户CRUD
- ✅ 客户等级管理
- ✅ 客户Excel导入/导出
- ✅ 客户统计

**关键API**:
- `GET /api/mobile/{factoryId}/customers/list` - 客户列表
- `POST /api/mobile/{factoryId}/customers` - 创建客户
- `GET /api/mobile/{factoryId}/customers/{customerId}` - 客户详情
- `PUT /api/mobile/{factoryId}/customers/{customerId}` - 更新客户
- `DELETE /api/mobile/{factoryId}/customers/{customerId}` - 删除客户
- `POST /api/mobile/{factoryId}/customers/import` - Excel导入
- `GET /api/mobile/{factoryId}/customers/export` - Excel导出
- `GET /api/mobile/{factoryId}/customers/export/template` - 下载模板

---

### 10. 供应商管理模块 (Supplier Management)

**后端**: `SupplierController`
**前端**: `supplierApiClient.ts`

**核心功能**:
- ✅ 供应商CRUD
- ✅ 供应商等级管理
- ✅ 供应商Excel导入/导出
- ✅ 供应商评分

**关键API**:
- `GET /api/mobile/{factoryId}/suppliers` - 供应商列表
- `POST /api/mobile/{factoryId}/suppliers` - 创建供应商
- `GET /api/mobile/{factoryId}/suppliers/{supplierId}` - 供应商详情
- `PUT /api/mobile/{factoryId}/suppliers/{supplierId}` - 更新供应商
- `DELETE /api/mobile/{factoryId}/suppliers/{supplierId}` - 删除供应商
- `POST /api/mobile/{factoryId}/suppliers/import` - Excel导入
- `GET /api/mobile/{factoryId}/suppliers/export` - Excel导出

---

### 11. 原料管理模块 (Material Management)

**后端**: `MaterialBatchController` + `MaterialTypeController` + `RawMaterialTypeController` + `MaterialSpecConfigController`
**前端**: `materialBatchApiClient.ts` + `materialTypeApiClient.ts` + `materialSpecApiClient.ts` + `materialQuickApiClient.ts`

**核心功能**:
- ✅ 原料批次管理 (入库/出库/调整)
- ✅ 原料类型管理
- ✅ 原料规格配置
- ✅ 库存统计
- ✅ 快速查询

**关键API (MaterialBatch)**:
- `GET /api/mobile/{factoryId}/material-batches` - 批次列表
- `POST /api/mobile/{factoryId}/material-batches` - 创建批次
- `GET /api/mobile/{factoryId}/material-batches/{batchId}` - 批次详情
- `PUT /api/mobile/{factoryId}/material-batches/{batchId}` - 更新批次
- `POST /api/mobile/{factoryId}/material-batches/{batchId}/adjust` - 库存调整

**关键API (MaterialType)**:
- `GET /api/mobile/{factoryId}/material-types` - 类型列表
- `POST /api/mobile/{factoryId}/material-types` - 创建类型
- `PUT /api/mobile/{factoryId}/material-types/{typeId}` - 更新类型
- `DELETE /api/mobile/{factoryId}/material-types/{typeId}` - 删除类型

**关键API (MaterialSpecConfig)**:
- `GET /api/mobile/{factoryId}/material-spec-configs` - 规格配置列表
- `POST /api/mobile/{factoryId}/material-spec-configs` - 创建配置
- `PUT /api/mobile/{factoryId}/material-spec-configs/{configId}` - 更新配置

---

### 12. 产品类型模块 (Product Type Management)

**后端**: `ProductTypeController`
**前端**: `productTypeApiClient.ts`

**核心功能**:
- ✅ 产品类型CRUD
- ✅ 产品分类管理
- ✅ Excel导入/导出

**关键API**:
- `GET /api/mobile/{factoryId}/product-types` - 产品类型列表
- `POST /api/mobile/{factoryId}/product-types` - 创建类型
- `PUT /api/mobile/{factoryId}/product-types/{typeId}` - 更新类型
- `DELETE /api/mobile/{factoryId}/product-types/{typeId}` - 删除类型
- `POST /api/mobile/{factoryId}/product-types/import` - Excel导入
- `GET /api/mobile/{factoryId}/product-types/export` - Excel导出

---

### 13. 工作类型模块 (Work Type Management)

**后端**: `WorkTypeController`
**前端**: `workTypeApiClient.ts`

**核心功能**:
- ✅ 工作类型CRUD
- ✅ 工作类型分类
- ✅ 工时配置

**关键API**:
- `GET /api/mobile/{factoryId}/work-types` - 工作类型列表
- `POST /api/mobile/{factoryId}/work-types` - 创建类型
- `PUT /api/mobile/{factoryId}/work-types/{typeId}` - 更新类型
- `DELETE /api/mobile/{factoryId}/work-types/{typeId}` - 删除类型

---

### 14. 转换率管理 (Conversion Rate Management)

**后端**: `ConversionController`
**前端**: `conversionApiClient.ts`

**核心功能**:
- ✅ 原料→产品转换率配置
- ✅ 转换率历史记录
- ✅ Excel导入/导出

**关键API**:
- `GET /api/mobile/{factoryId}/conversions` - 转换率列表
- `POST /api/mobile/{factoryId}/conversions` - 创建转换率
- `PUT /api/mobile/{factoryId}/conversions/{conversionId}` - 更新转换率
- `DELETE /api/mobile/{factoryId}/conversions/{conversionId}` - 删除转换率
- `POST /api/mobile/{factoryId}/conversions/import` - Excel导入
- `GET /api/mobile/{factoryId}/conversions/export` - Excel导出

---

### 15. 生产计划模块 (Production Plan)

**后端**: `ProductionPlanController`
**前端**: `productionPlanApiClient.ts`

**核心功能**:
- ✅ 生产计划CRUD
- ✅ 计划状态管理
- ✅ 计划执行跟踪
- ✅ 计划与批次关联

**关键API**:
- `GET /api/mobile/{factoryId}/production-plans` - 计划列表
- `POST /api/mobile/{factoryId}/production-plans` - 创建计划
- `GET /api/mobile/{factoryId}/production-plans/{planId}` - 计划详情
- `PUT /api/mobile/{factoryId}/production-plans/{planId}` - 更新计划
- `DELETE /api/mobile/{factoryId}/production-plans/{planId}` - 删除计划
- `POST /api/mobile/{factoryId}/production-plans/{planId}/execute` - 执行计划

---

### 16. AI分析模块 (AI Analysis)

**后端**: `AIController`
**前端**: `aiApiClient.ts`

**核心功能**:
- ✅ DeepSeek成本分析
- ✅ AI配额管理
- ✅ AI使用统计
- ✅ AI报告生成

**关键API**:
- `POST /api/mobile/{factoryId}/ai/analyze` - AI分析
- `GET /api/mobile/{factoryId}/ai/quota` - 查询配额
- `GET /api/mobile/{factoryId}/ai/usage` - 使用统计
- `GET /api/mobile/{factoryId}/ai/reports` - AI报告列表
- `GET /api/mobile/{factoryId}/ai/reports/{reportId}` - 报告详情

---

### 17. 报表模块 (Report)

**后端**: `ReportController`
**前端**: `reportApiClient.ts`

**核心功能**:
- ✅ 生产报表
- ✅ 质检报表
- ✅ 考勤报表
- ✅ 成本报表
- ✅ 报表导出 (PDF/Excel)

**关键API**:
- `GET /api/mobile/{factoryId}/reports/production` - 生产报表
- `GET /api/mobile/{factoryId}/reports/quality` - 质检报表
- `GET /api/mobile/{factoryId}/reports/attendance` - 考勤报表
- `GET /api/mobile/{factoryId}/reports/cost` - 成本报表
- `POST /api/mobile/{factoryId}/reports/export` - 导出报表

---

### 18. 白名单管理 (Whitelist)

**后端**: `WhitelistController`
**前端**: `whitelistApiClient.ts`

**核心功能**:
- ✅ 白名单CRUD
- ✅ 手机号白名单
- ✅ IP白名单
- ✅ 批量导入

**关键API**:
- `GET /api/mobile/{factoryId}/whitelist` - 白名单列表
- `POST /api/mobile/{factoryId}/whitelist` - 添加白名单
- `DELETE /api/mobile/{factoryId}/whitelist/{whitelistId}` - 删除白名单
- `POST /api/mobile/{factoryId}/whitelist/import` - 批量导入

---

### 19. 系统管理模块 (System Management)

**后端**: `SystemController`
**前端**: `systemApiClient.ts`

**核心功能**:
- ✅ 系统健康检查
- ✅ 系统日志
- ✅ 系统配置
- ✅ 系统监控

**关键API**:
- `GET /api/mobile/health` - 健康检查
- `GET /api/mobile/{factoryId}/system/logs` - 系统日志
- `GET /api/mobile/{factoryId}/system/config` - 系统配置
- `GET /api/mobile/{factoryId}/system/monitor` - 系统监控

---

## 📊 统计汇总

| 类别 | 数量 |
|------|------|
| **后端Controllers** | 25个 |
| **前端API Clients** | 33个 |
| **核心业务模块** | 10个 |
| **支撑功能模块** | 9个 |
| **总API端点数** | ~200+ |

---

## 🎯 测试优先级分级

### P0 (最高优先级) - 核心业务流程
1. ✅ 认证与授权模块
2. ⏳ 生产加工模块
3. ⏳ 质量检验模块
4. ⏳ 设备告警模块 (部分已测试)

### P1 (高优先级) - 主要功能
5. ⏳ 用户管理模块
6. ⏳ 考勤打卡模块
7. ⏳ 客户管理模块
8. ⏳ 供应商管理模块
9. ⏳ 原料管理模块

### P2 (中优先级) - 扩展功能
10. ⏳ 工厂管理模块
11. ⏳ 部门管理模块
12. ⏳ 产品类型模块
13. ⏳ 转换率管理
14. ⏳ AI分析模块

### P3 (低优先级) - 辅助功能
15. ⏳ 工作类型模块
16. ⏳ 生产计划模块
17. ⏳ 报表模块
18. ⏳ 白名单管理
19. ⏳ 系统管理模块

---

**文档生成时间**: 2025-11-20
**下一步**: 创建详细的集成测试TodoList
