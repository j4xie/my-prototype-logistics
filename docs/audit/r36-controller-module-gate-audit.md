# R36+ Controller @RequireModule Sister Sweep — Audit Doc

**Snapshot**: 2026-04-27 (post-R35 production sweep)
**Status**: Backlog for V2 / future audit rounds

## 背景

R31→R34 关闭了排产模块的 module-gate 漏洞 (Scheduling/Optimization/Metrics + LinUCB/MixedBatch/APS/UrgentInsert/StrategyWeight). R35 关闭了生产模块 (Bom/Production/Quality 共 14 controllers).

本文档记录**剩余 ~73 个**没有任何 @RequireModule 的 factory-scoped controllers (118 total - R31-R35 ~45 covered). 按推荐 module code 分组, 留 R36+ 系统级 sweep dedicated effort.

## 剩余 controllers 按推荐模块分组

### 🟡 Sales/Customer 模块 (推荐 module=`sales_order` / `customer`)
- `inventory/SalesController.java` (21) → `sales_order`
- `inventory/ReturnOrderController.java` (8) → `sales_order`
- `inventory/PriceListController.java` (6) → `sales_order` (定价是销售附属)
- `CustomerController.java` (26) → `customer`

### 🟡 Supplier/Purchase 模块 (推荐 `supplier` / `purchase_order`)
- `SupplierController.java` (19) → `supplier`
- `SupplierAdmissionController.java` (7) → `supplier`

### 🟡 HR/Payroll/Workforce 模块 (推荐 `hr_employee`)
- `WageController.java` (22)
- `TimeStatsController.java` (17)
- `TimeClockController.java` (14)
- `WorkSessionController.java` (12)
- `WorkTypeController.java` (10)
- `WorkProcessController.java` (8)
- `WorkstationCountingController.java` (6)
- `SkillManagementController.java` (6)
- `workreport/EmployeeProcessSegmentController.java` (4)
- `WorkReportingController.java` (16) — **可能与 production_report 冲突, 需评估**

### 🟡 Equipment/Devices/Camera 模块 (推荐 `equipment`)
- `IsapiDeviceController.java` (35) — IsAPI 摄像头
- `DahuaDeviceController.java` (17)
- `IsapiSmartAnalysisController.java` (7)
- `isapi/IsapiRecordingController.java` (4)
- `DeviceController.java` (6)
- `LabelRecognitionController.java` (10) — 标签识别 (camera AI)
- `LabelController.java` (17) — 标签 (跨模块? 需评估)
- `ScaleSimulatorController.java` (13) — 电子秤
- `ScaleDeviceController.java` (7)
- `ImageAnalysisTestController.java` (4)

### 🟡 Inventory/Warehouse 模块 (推荐 `inventory` / `transfer`)
- `RawMaterialTypeController.java` (13) — 原料 catalog (跨模块? 需评估)
- `MaterialSpecConfigController.java` (5)
- `factory/FactoryWarehouseController.java` (1)
- `warehouse/ReusableContainerController.java` (8)
- `VehicleController.java` (8) — 车辆 (transfer/物流)

### 🟡 POS/Restaurant 模块 (推荐 `restaurant`)
- `pos/PosController.java` (10)
- `restaurant/RestaurantDashboardController.java` (1)

### 🔴 跨模块/系统级 — 谨慎评估, 大概率不应加 module gate
以下 controllers 是横切系统功能, 加 @RequireModule 可能 break 所有 module 启用的工厂. **建议保持 不加, 用 @RequirePermission 控制即可**:

- `AIController.java` (20) — AI 横切
- `AIIntentConfigController.java` (32) — AI 意图配置
- `AIQuotaConfigController.java` (5) — AI 配额
- `AIRuleController.java` (5) — AI 规则
- `AiAgentRuleController.java` (12)
- `ActiveLearningController.java` (16)
- `IntentAnalysisController.java` (27)
- `ConversationController.java` (9)
- `CanvasAIController.java` (2)
- `FoodKBFeedbackController.java` (3) — 食品知识库 (跨模块查询)
- `ConfigController.java` (20) — 工厂配置
- `ConfigChangeSetController.java` (14) — 配置变更
- `BusinessRuleController.java` (9)
- `RuleController.java` (16)
- `EncodingRuleController.java` (15)
- `TriggerChainController.java` (8)
- `ApprovalChainController.java` (12)
- `FactorySettingsController.java` (26) — 工厂设置 (横切)
- `SystemConfigController.java` (17)
- `FeatureConfigController.java` (3)
- `FactoryRoleModuleOverrideController.java` (2)
- `ReferenceDataController.java` (18) — 跨模块引用查询 ⚠️ 加 gate 一定会 break
- `ProductTypeController.java` (19) — 产品 catalog 跨模块 ⚠️
- `FormTemplateController.java` (15) — Canvas 表单
- `FieldVisibilityController.java` (4) — Canvas 可见性
- `DynamicFieldController.java` (12) — Canvas 动态字段
- `LowcodeController.java` (8) — Canvas
- `DecorationController.java` (8) — Canvas 装饰
- `WhitelistController.java` (21) — 白名单 (横切?)
- `auth/UserMenuPermissionController.java` (5) — 权限横切
- `RoleController.java` (1) — 角色横切
- `NotificationController.java` (9) — 通知横切
- `FileUploadController.java` (3) — 文件上传基础
- `AlertController.java` (6) — 告警横切
- `FormAssistantController.java` (6)
- `rd/RdController.java` (15) — R&D 跨模块? 需评估
- `SmartBIAnalysisController.java` (26) — SmartBI 智能分析
- `SmartBIDashboardController.java` (11)
- `SmartBIUploadController.java` (13)
- `ReportController.java` (25) — 报表横切
- `SystemLogController.java` (1) — 日志
- `SopController.java` (2) — SOP

## R36+ 推荐执行顺序

每轮一个模块, 减少 risk + 易回滚:

1. **R36 Sales/Customer**: `inventory/Sales` `inventory/ReturnOrder` `inventory/PriceList` `Customer` (61 mappings)
2. **R37 Supplier**: `Supplier` `SupplierAdmission` (26 mappings)
3. **R38 HR/Workforce**: 10 controllers (~120 mappings) — **高风险, WorkReporting 与 production_report 模块代码冲突需评估**
4. **R39 Equipment/Camera**: 9 controllers (~110 mappings)
5. **R40 Inventory/Warehouse**: 5 controllers (~35 mappings)
6. **R41 Restaurant/POS**: 2 controllers (~11 mappings)

## 每轮通用流程

每轮按 R31→R35 模板:
1. 给 controllers 加 class-level `@RequireModule("<module_code>")` + import
2. 必要时: FactoryServiceImpl 已加 scheduling seed; 看是否需要类似 seed 给该模块 (R34 lessons learned)
3. Test deploy + 真窗 check (尤其 cross-module 调用没被 break)
4. 独立 superpowers:code-reviewer audit (Rule 9)
5. 修反馈 + Prod deploy + commit + push
6. 更 MEMORY.md

## 验证 module 的 customer-facing 影响

每轮上 prod 前必须查:
```sql
SELECT factory_id, module_code, enabled
FROM factory_module_configs
WHERE module_code = '<target>' AND enabled = false;
```

如果有工厂显式 disabled 该 module 但代码端在用, R36+ sweep 会 break 这些工厂. 必须先确认或与客户对齐.

## 当前 V1 客户演示风险

- ✅ 排产 + 生产 模块已收紧
- ⚠️ Sales/Customer/Supplier/HR/Equipment 等模块未保护, 但**无客户报告**因为:
  - F001 旗舰工厂 LEGACY default enabled
  - 客户当前未在 factory_module_configs 显式 disable 任何模块
- 📋 V2 / R36+ sweep 是"未来工厂细分订阅"的前置条件, 不影响 V1 演示

---

**Owner**: 排产模块 (R31-R35 author) handed off to V2 dedicated effort
**Lock state**: 不再需要 R36 紧迫推进, 待 product 决定模块订阅模型时优先
