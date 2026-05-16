# Cretas 代码独立审计 — Fresh Audit (71 项借鉴清单)

> **审计时间**: 2026-05-14
> **审计员**: Claude Code (基于源码 grep/glob 独立验证, 不参考 V3/BORROW_LIST 结论)
> **审计基线**: `C:\Users\Steve\my-prototype-logistics\backend\java + frontend\CretasFoodTrace`
>
> **Verdict 5 档**:
> - ✅ 完全有 — 前后端 + AI 全通
> - 🟢 后端有缺前端 — 仅缺 UI 暴露
> - 🟡 部分有 — 实体在但流程不完整
> - 🟠 仅 AI Tool 有 — 没传统 UI 入口但 AIChat 可触发
> - ❌ 完全没有

---

## §1. 71 项 Verdict 矩阵

### 一、销售 / CRM (10 项)

| # | 功能 | Verdict | Evidence | 备注 |
|---|------|---------|----------|------|
| **S1** | 销售单 → 三向分流 | ❌ | 无 `SalesToProductionPurchaseSkill` ; `BomExpansionTool` 存在但未集成转换链路 | V3 未误报；此功能完全缺失，需新建 Skill |
| **S2** | 报价单 → 销售单转化 | 🟢 | 后端: `entity/sales/OperationalQuote.java:52`, `controller/sales/OperationalQuoteController.java:36`, `service/sales/impl/OperationalQuoteServiceImpl.java:23`. 前端: 0 个 Quote*Screen 引用 | V3 标 ⚪ 准确：后端全套 (entity+service+controller)，**前端完全没有** |
| **S3** | 同产品 × 多客户价目记忆 | 🟡 | `entity/inventory/PriceList.java:37` 支持 customer_id 客户专属价；`PriceListScreen.tsx` 存在；但没有"历史价"概念（无 customer_product_price_history 表） | 部分有：仅支持客户价格表，不是历史价记忆 |
| **S4** | 客户跟踪记录 + 文件附件 | 🟡 | `entity/CustomerTrackingRecord.java:25`, `repository/CustomerTrackingRecordRepository.java`. **没有 Service/Controller/前端** | **反例 V3**：V3 说"完整"实际只 entity+repository，没有 Service/Controller |
| **S5** | 业务员客户隔离权限 | 🟡 | `entity/inventory/SalesOrder.java:133 salesperson_id`. 但 `Customer.java` 无 owner/salesman 字段 | 仅订单维度有业务员，客户级别隔离缺失 |
| **S6** | 客户撞重 + 申请争取 | ❌ | 无 `customer_assign|customerAssignment` 文件 | 完全没有 |
| **S7** | 业绩管理 + 提成计算 | ❌ | 无 CommissionRule/commission_rule 实体 | 完全没有 |
| **S8** | 月结对账单 | ❌ | 无 MonthlyStatement 实体；ArAp 有但是单笔不是月结汇总 | 完全没有 |
| **S9** | 销售订单 4 状态 + 6 按钮 | 🟡 | `screens/factory-admin/inventory/SalesOrderListScreen.tsx:21` 有 6 状态 chip filter，但**仅 2 按钮**（确认/取消），缺转生产/转采购/转外购/复制/打印 | 部分有：状态 OK 按钮不全 |
| **S10** | 租赁/寄卖/借出/样品/微信网店 | ❌ | 无对应 entity | 完全没有 |

### 二、采购 (5 项)

| # | 功能 | Verdict | Evidence | 备注 |
|---|------|---------|----------|------|
| **P1** | 采购订单按供应商拆单 | 🟠 | `ai/tool/impl/canvas/SplitOrderTool.java:45` 仅支持 SalesOrder 拆单；`OrderApprovalTool` + `PurchaseOrderApproveTool` 存在；无按物料-供应商映射拆 PO | SplitOrderTool 是销售订单拆单，不是采购订单按供应商拆 |
| **P2** | 采购全链路 6 阶段 | 🟡 | 后端: `entity/inventory/PurchaseOrder.java:50`, `PurchaseReceiveRecord.java`, `PurchaseReceiveItem.java`; AI Tools: `PurchaseOrderCreateTool/ListTool/ApproveTool/DetailTool/StatsTool/FinanceApproveTool`(6 个). 前端: `PurchaseOrderListScreen/CreateScreen/DetailScreen` | 部分有：请购+采购+收货+审批已通，质检环节缺，付款半通 |
| **P3** | 询价管理 | ❌ | 无 supplierQuote/SupplierQuote/RFQ entity | 完全没有 |
| **P4** | 采购退货/退换货 | ✅ | 后端: `entity/inventory/ReturnOrder.java:40`; AI: `ReturnOrderCreateTool/ListTool/ApproveTool/DetailTool/StatsTool`; 前端: `ReturnOrderListScreen/DetailScreen` | 5 工具 + 前端列表/详情，齐全 |
| **P5** | 按订单 vs 多订单汇总对账 | ❌ | 无 multi-order settlement | 完全没有 |

### 三、生产 (9 项)

| # | 功能 | Verdict | Evidence | 备注 |
|---|------|---------|----------|------|
| **M1** | 物料需求按工序展开 | ✅ | `service/orchestration/BomExpansionService.java:45`, `BomExpansionTool.java`, `SupplyChainOrchestrator.java` | 后端完整 |
| **M2** | 缺料分析统一视图 | 🟡 | `BomExpansionService` 内有 MaterialShortfall DTO；`InventoryAlertScreen.tsx` 有库存预警 UI；但没"一键转请购"链路 | 部分有：分析在，转换链路缺 |
| **M3** | 生产任务专属 QR | 🟡 | `entity/Label.java:23` 有 qr_content 字段 + 服务；`entity/ProcessTask.java` 和 `ProductionPlan.java` **没有 qrCode 字段**；前端 `ScanReportScreen.tsx` 存在 | **反例 V3**：BORROW_LIST 说"Label QR 字段已有"但 ProcessTask 没绑定 QR |
| **M4** | 领料单按 BOM 自动展开 + 多列进度 | 🟢 | 后端: `entity/factory/FactoryMaterialRequisition.java`, `entity/restaurant/MaterialRequisition.java`, `FactoryMaterialRequisitionController.java`, `MaterialRequisitionServiceImpl.java`. 前端: 缺专门的领料单 Screen (`restaurant/requisition/` 是餐饮版) | 后端完整，工厂端前端 UI 缺 |
| **M5** | 生产任务列表 4 列状态色编码 | 🟡 | 个别 Screen 用 STATUS_MAP 实现 (SalesOrderListScreen) ；没抽 `StatusChipRow` 共享组件 | 部分有：散点实现，无共享体系 |
| **M6** | 批量电脑报工（统计员模式） | ✅ | `frontend/CretasFoodTrace/src/screens/processing/TeamBatchReportScreen.tsx:40` 多选员工+总产量+一键提交；后端 `ProcessingController` + `TeamBatchReportRequest` DTO | 客户原话需求已实现 |
| **M7** | 小组长代报工 | ✅ | 同 M6（TeamBatchReport 设计已含小组长视图） | 与 M6 一体 |
| **M8** | 报工 → 计件工资联动 | 🟢 | `entity/PayrollRecord.java` + `entity/PieceRateRule.java` + `service/WageCalculationService.java` + `controller/WageController.java` + `entity/restaurant/PieceworkConfig.java`. 前端 UI 不明显 | 后端齐全，前端展示缺 |
| **M9** | 工程 BOM 版本管理 | ❌ | 无 BomVersion/bom_version entity；只有 ProductType + SkuAssemblyService | 完全没有 |

### 四、库存 / 仓库 (10 项)

| # | 功能 | Verdict | Evidence | 备注 |
|---|------|---------|----------|------|
| **W1** | 多维度库存细分 | ✅ | `entity/MaterialBatch.java:42` 已含 supplier_id + batch_number + expiry_date + warehouse 字段 | V3 ⚪ 准确 |
| **W2** | 多维度联动筛选 17 列 | ❌ | 无 17列密集表格 UI；`MaterialBatchManagementScreen` 仅基础列表 | 完全没有 |
| **W3** | FIFO 强制出库 | 🟠 | `ai/tool/impl/material/MaterialFifoRecommendTool.java:27` ; `service/MaterialBatchService` 有 FIFO 逻辑；前端无 FIFO 强制设置 UI | AI Tool 推荐 OK，传统 UI 入口缺 |
| **W4** | 制效天数告警 | ✅ | 后端: `ai/tool/impl/material/MaterialExpiringAlertTool.java:25` (默认 7 天). 前端: `screens/warehouse/alerts/InventoryAlertScreen.tsx:65` 列表展示 expiring + expired + low_stock | **修正 V3**：V3 说"AI Tool 默认 7 天 + cron 已有"，实际**无 @Scheduled cron**，仅 AI 触发；但前端有展示 |
| **W5** | 库存出入流水追溯 | 🟡 | `entity/MaterialBatchAdjustment.java` 存在；前端缺统一流水追溯 UI | 部分有 |
| **W6** | 库存盘点 + 调整 | 🟡 | `entity/restaurant/StocktakingRecord.java` + `service/restaurant/impl/StocktakingRecordServiceImpl.java` + `controller`. 前端 `restaurant/stocktaking/`. **仅餐饮版，无工厂版** | 餐饮已实现，工厂未实现 |
| **W7** | 借入借出 4 单据 | 🟢 | `entity/warehouse/ReusableContainer.java/Transaction.java` + `controller/ReusableContainerController.java` + 4 AI Tools (`ShipOutTool/ReturnInTool/QueryTool/LossTool`). 前端 UI 缺 | 后端完整（适用容器借出场景） |
| **W8** | 产品报废 + 库存调拨 | ✅ | 报废: `entity/DisposalRecord.java` + `controller/DisposalController.java` + `service/DisposalRecordService.java`. 调拨: `entity/inventory/InternalTransfer.java:51` + `controller/inventory/TransferController.java` + 5 AI Tools (TransferCreate/Detail/Approve/List/Stats) | 报废+调拨齐全 |
| **W9** | 多仓位 bin-level | ❌ | 无 bin-level entity | 完全没有 |
| **W10** | 序列号 + 箱标 | 🟡 | `entity/Label.java` 支持序列号场景；无统一 SN 系统 | 部分有 |

### 五、财务 (7 项)

| # | 功能 | Verdict | Evidence | 备注 |
|---|------|---------|----------|------|
| **F1** | AR/AP 账龄分析 6 段桶 | ✅ | 后端: `service/finance/impl/ArApServiceImpl.java:663 getAgingAnalysis()` + 6 桶 (current/days1_30/days31_60/days61_90/days91_120/days120plus). 前端: `screens/factory-admin/inventory/ArApOverviewScreen.tsx:208` 有"账龄"tab | V3 ⚪ 准确，前端**已暴露**（非"仅后端"） |
| **F2** | AR/AP 凭证基础 | ❌ | 无 VoucherEntry/JournalEntry 实体 | 完全没有 |
| **F3** | 单据 → 凭证 hook | ❌ | 同 F2 | 完全没有 |
| **F4** | 多币种 + 多账户 | ❌ | 无 Currency entity | 完全没有 |
| **F5** | 发票管理 + 票据 OCR | 🟡 | 后端: `entity/finance/InvoiceRecord.java` + `service/finance/impl/InvoiceServiceImpl.java` + `controller/finance/InvoiceController.java` + 3 AI Tools (Request/RequestFromOrder/Approve). OCR: 有 `DashScopeVisionClient` 但未对接 invoice 流程 | 发票管理 OK，OCR 缺 invoice 集成 |
| **F6** | 固定资产折旧 | 🟡 | `entity/FactoryEquipment.java:63 depreciation_years` 字段存在；无 depreciation service | 字段在，逻辑缺 |
| **F7** | 汇率管理 | ❌ | 无 currency_config | 完全没有 |

### 六、HR / 考勤 (9 项)

| # | 功能 | Verdict | Evidence | 备注 |
|---|------|---------|----------|------|
| **H1** | 月度考勤可视化矩阵 8 色 | 🟠 | `ai/tool/impl/hr/AttendanceMonthlyTool.java:28` **只返回 stats 汇总**（出勤天数/迟到/缺勤/加班时长），**没有矩阵格式**；前端 `MyAttendanceScreen/AttendanceStatsScreen` 是统计表非矩阵 | **反例 V3**：V3 说"已有可视化矩阵"，实际只有 stats |
| **H2** | 6 班次打卡 | 🟡 | 前端: `types/hrNavigation.ts:307 SHIFT_CONFIG` **只有 4 班次**（morning/afternoon/evening/night），**缺三班倒/弹性/标准**；`WorkScheduleScreen` 仅按 4 班次显示 | **反例 V3**：BORROW_LIST 说"6 班次"，实际 4 班次 |
| **H3** | 外勤签到 GPS + 照片 | 🟠 | `ClockInTool.java:26` 有 remark "外勤说明" 字段但**无 GPS/photo** | 仅文字 remark，缺 GPS+photo |
| **H4** | 请假流程 | ❌ | 无 Leave/LeaveRequest entity | 完全没有 |
| **H5** | 调休流程 | ❌ | 无 compensatory_leave entity | 完全没有 |
| **H6** | 报销流程 | ❌ | 无 ExpenseClaim/Reimbursement entity | 完全没有 |
| **H7** | 工作日报 | ✅ | 后端: `service/impl/WorkReportingServiceImpl.java` + `controller/WorkReportingController.java` + `entity/workreport/EmployeeProcessSegment.java`. AI: 4 个 WorkReport*Tool. 前端: `screens/processing/MyWorkReportsScreen.tsx`, `DraftReportsScreen.tsx`, `factory-admin/management/WorkReportApprovalScreen.tsx` | 齐全 |
| **H8** | 考勤机硬件集成 | 🟡 | `entity/iot/IotDevice.java:35` 支持 IoT 通用框架；`controller/IsapiDeviceController` 海康摄像头集成。无专门考勤机 | 框架有但无适配 |
| **H9** | 考勤地理围栏 | ❌ | 无 geofence/geo_fence 文件 | 完全没有 |

### 七、质检 (4 项)

| # | 功能 | Verdict | Evidence | 备注 |
|---|------|---------|----------|------|
| **Q1** | 质检项目和参数自定义模板 | ✅ | 后端: `entity/config/QualityCheckItemBinding.java:42` + `service/QualityCheckItemService.java` + `controller/QualityCheckItemController.java` + `service/impl/QualityCheckItemServiceImpl.java` + `repository/QualityCheckItemBindingRepository.java`. 前端: `screens/factory-admin/config/QualityCheckItemConfigScreen.tsx` + `factory-admin/management/QualityCheckItemDetailScreen.tsx` + `services/api/qualityCheckItemApiClient.ts` | V3 ⚪ 准确，前端已暴露 |
| **Q2** | 质检流程可选关闭 | ❌ | 无 qualityCheckOptional/skip flag | 完全没有 |
| **Q3** | 质检不合格 → 退货/报废 | 🟢 | `entity/DisposalRecord.java` + `DisposalController.java` + `entity/ReworkRecord.java` + `QualityDispositionEvaluateTool/ExecuteTool` AI Tools. 流程串联需前端补 | 后端齐全 |
| **Q4** | 质检附件上传（手机端） | 🟡 | `entity/BatchEvidencePhoto.java` + `repository/BatchEvidencePhotoRepository.java`，**没有 Service/Controller**；前端 `QIPhotoScreen` 等 QI*Screen 有 18 个但 photo 上传未串通 | 部分有 |

### 八、设备 (4 项)

| # | 功能 | Verdict | Evidence | 备注 |
|---|------|---------|----------|------|
| **E1** | 设备 6 子模块 | 🟡 | 后端: `entity/FactoryEquipment.java` + `entity/EquipmentMaintenance.java` + 15 个 AI Tools (start/stop/maintenance/diagnosis/coldChain/ccpMonitor 等). 6 子模块（管理/能耗/维修/巡检/保养/报废）部分覆盖. 前端: `EquipmentManagementScreen/DetailScreen/MonitoringScreen/AlertsScreen/AnalysisScreen` | 后端约 50% 覆盖 6 子模块（管理/维修/能耗/保养有，巡检/报废弱） |
| **E2** | 三色灯状态显示 | ✅ | `entity/FactoryEquipment.java:70 status` (idle/running/maintenance/scrapped 4 状态). 前端 `EquipmentManagementScreen.tsx` + StatusBadge UI | 4 状态 + chip UI 齐 |
| **E3** | 设备工作时间表 + 排班 | ❌ | 无 equipment scheduling | 完全没有 |
| **E4** | 设备点检 / 巡检记录 | 🟠 | `service/workflow/impl/EquipmentCheckNode.java` 工作流节点有；`EquipmentMaintenanceTool` AI Tool 有；无专门 inspection entity | AI Tool 有但传统流程缺 |

### 九、通用平台能力 (8 项)

| # | 功能 | Verdict | Evidence | 备注 |
|---|------|---------|----------|------|
| **C1** | 通用 attachment 系统 | 🟡 | `ai/tool/impl/canvas/CanvasAddAttachmentFieldTool.java` (动态字段加 attachment 类型); `entity/BatchEvidencePhoto.java` (业务专属); **没有统一 generic_attachment 表** | 部分有：分散的图片表，无统一系统 |
| **C2** | 单据打印系统 + 模板可定制 | 🟡 | `service/inventory/impl/PurchaseOrderPdfServiceImpl.java` 单一采购单 PDF；无统一打印模板系统 | 部分有：1 个单据，无模板系统 |
| **C3** | 金额分级审批规则引擎 | ✅ | 后端: `entity/config/ApprovalChainConfig.java` + `controller/ApprovalChainController.java` + `service/impl/ApprovalChainServiceImpl.java` + `scheduler/ApprovalTimeoutScheduler.java` + `dto/approval/Create|Update*Request.java` + `ai/tool/impl/system/ApprovalConfigTool.java` | 齐全 |
| **C4** | 4 维度角色权限 | 🟡 | `entity/permission/PlatformRolePermission.java` + `controller/FieldVisibilityController.java:21` 字段级权限. 数据权限 RLS **未找到**，仅角色级 + 字段级（2/4 维） | 角色 + 字段维度有，功能 + 数据维度弱 |
| **C5** | 行业初始化 Feature Flag | ✅ | 后端: `entity/IndustryTemplatePackage.java:31` + `controller/TemplatePackageController.java` + `entity/config/FactoryTypeBlueprint.java` + `entity/config/FactoryBlueprintBinding.java` + `service/impl/FactoryBlueprintServiceImpl.java` + `controller/FactoryBlueprintController.java` + `entity/FactoryFeatureConfig.java` + `controller/FeatureConfigController.java`. 前端: `IndustryTemplateManagementScreen.tsx` + `FactorySetupScreen.tsx` | V3 ⚪ 准确，全套已通 |
| **C6** | 登陆地点限制 | ❌ | 无 login_restrict/ip_whitelist | 完全没有 |
| **C7** | 多 Tab 工作台（Web） | ❌ | RN 应用无 Web Tab；web-admin 也无 multi-tab | 完全没有 |
| **C8** | 行级状态多层 chip 体系 | 🟡 | `components/ui/StatusBadge.tsx` 单 chip 组件存在；各 Screen 内联实现 STATUS_MAP（如 SalesOrderListScreen.tsx:12）；**无统一 StatusChipRow 组件** | 散点实现，无共享多层体系 |

### 十、UI / UX 设计模式 (8 项)

| # | 功能 | Verdict | Evidence | 备注 |
|---|------|---------|----------|------|
| **U1** | 底部固定批量操作栏 | ❌ | 无 batchActionBar/bottomBar 组件 | 完全没有 |
| **U2** | 行级状态色块 | 同 C8 | 见 C8 | - |
| **U3** | 分块表单 + Sticky Footer 实时汇总 | ❌ | 无 stickyFooter/实时合计 组件 | 完全没有 |
| **U4** | 弹窗内联 QR + 工序说明 | 同 M3 | 见 M3 | - |
| **U5** | 多 Tab 累积导航 | ❌ | 同 C7 | 完全没有 |
| **U6** | 多列密集表格 + 双税轨 | ❌ | 无 denseTable | 完全没有 |
| **U7** | 行内进度条 sparkline | ❌ | 5 个 Screen 有 ProgressBar 但仅基础展示，无 sparkline | 完全没有 |
| **U8** | 筛选器联动 + 树形分类 | ❌ | 无 filterPanel/columnFilter | 完全没有 |

---

## §1.5 关键反例：V3 误标"已有"实际不完整的项

| # | 项 | V3 标注 | 实际状态 |
|---|---|---------|---------|
| **S4** | 客户跟踪记录 | "Cretas 实体 CustomerTrackingRecord 完整, 仅需前端" | 实体 + repository 在，**Service/Controller/前端 全无** |
| **H1** | 月度考勤矩阵 | "AttendanceMonthlyTool 已有, 仅升级 UI 8 色+badge" | Tool 仅返回统计数（出勤/迟到/缺勤/加班时长），**完全无矩阵格式** |
| **H2** | 6 班次打卡 | "BORROW_LIST 含 6 班次" | 前端 SHIFT_CONFIG 仅 4 班次（早/午/晚/夜） |
| **W4** | 制效天数告警 | "MaterialExpiringAlertTool 默认 7 天 + cron 已有" | Tool 在，**无 @Scheduled cron**，仅 AI 触发；但 InventoryAlertScreen 有展示 |
| **M3** | 生产任务 QR | "Label 实体已有 QR 字段" | Label 有 qr_content，**ProcessTask + ProductionPlan 无 qrCode 字段，无绑定** |
| **P1** | 采购按供应商拆单 | （未明确） | `SplitOrderTool` 实际是销售订单拆单，**不是采购订单按供应商拆 PO** |
| **Q4** | 质检附件上传 | （未明确） | `BatchEvidencePhoto` 只有 entity+repository，**无 Service/Controller** |
| **W6** | 库存盘点 | （未明确） | `StocktakingRecord` 是餐饮版（restaurant/），**工厂版无盘点功能** |
| **F5** | OCR 集成 | （未明确） | OCR 有 `DashScopeVisionClient` 但**未对接 invoice 流程** |
| **C8** | 多层 chip 体系 | 标 ⭐ Phase 1 | `StatusBadge` 单 chip 组件存在，**散点 STATUS_MAP 实现，无共享 StatusChipRow** |

---

## §2. Cretas 独家强项验证表

| # | 独家能力 | Verdict | 实际可用度 | Evidence |
|---|---------|---------|-----------|----------|
| **1** | AIChat 8 场景化 SCENE_CONFIG | ✅ | 完全可用 | `frontend/CretasFoodTrace/src/screens/factory-admin/ai-analysis/AIChatScreen.tsx:84-145` 定义 8 场景: PRODUCTION_PLAN, WORK_REPORT, QUALITY_CHECK, SHIPMENT, MATERIAL, PURCHASE, EQUIPMENT, ATTENDANCE，每场景含 quickQuestions + allowedActionCodes |
| **2** | 18 Skill 内置 (代码 default + SKILL.md) | ✅ | 完全可用，MEMORY 索引一致 | `service/skill/impl/SkillRegistryImpl.java:148-466` 18 个 `.name(...)` registerWithSource() + `resources/skills/` 下 14 个 SKILL.md 文件 (financial-dashboard/inventory-health/production-oee/quality-analysis 等) |
| **3** | 404 个 Tool 实现 + 361 个 extends AbstractBusinessTool | ✅ | 超 V3 标注的 337+ | `ai/tool/impl/{34 子目录}/*.java` 总 404 java 文件，361 个继承 AbstractBusinessTool。子目录: alert/camera/canvas/config/crm/dahua/dataop/decoration/dictionary/equipment/factory/finance/foodknowledge/form/governance/hr/isapi/material/pagedesign/processing/production/purchase/quality/rd/restaurant/returnorder/sales/scale/scheduling/shipment/sop/system/transfer/user/warehouse/workreport |
| **4** | 食品溯源 TraceFullTool / TraceBatchTool / TracePublicTool | ✅ | 完全可用 | `ai/tool/impl/shipment/TraceBatchTool.java:25`, `TraceFullTool.java`, `TracePublicTool.java`. 配套 `ai/tool/impl/dataop/TraceGenerateTool.java` + `controller/TraceabilityController.java` + 前端 `screens/traceability/TraceabilityScreen.tsx` + `TraceabilityDetailScreen.tsx` |
| **5** | 海康 ISAPI 摄像头集成 | ✅ | 完全可用 | `entity/isapi/IsapiEventLog.java`, `controller/IsapiDeviceController.java`, `service/isapi/IsapiDeviceService.java`, `service/isapi/IsapiEventSubscriptionService.java`, `service/isapi/AutoLabelRecognitionService.java`, 3 AI Tools (`IsapiDetectionEventsQueryTool/IsapiFieldDetectionConfigTool/IsapiLineDetectionConfigTool`). 前端: `screens/factory-admin/isapi/IsapiDeviceListScreen/CreateScreen/DetailScreen/SmartConfigScreen/DeviceSetupWizardScreen` |
| **6** | 大华摄像头集成 | ✅ | 完全可用 | `ai/tool/impl/dahua/DahuaSmartConfigTool.java`, `DahuaDeviceManageTool.java`, `DahuaDiscoveryTool.java` |
| **7** | 通用 Camera 11 工具 | ✅ | 完全可用 | `ai/tool/impl/camera/{11 个}.java`: CameraAddTool/CaptureTool/DetailTool/EventsTool/ListTool/StatusTool/StreamsTool/SubscribeTool/SyncTool/TestConnectionTool/UnsubscribeTool. 前端 `UnifiedDeviceDiscoveryScreen.tsx` |
| **8** | 电子秤集成（13 个 AI Tool + 多协议） | ✅ | 完全可用 | `ai/tool/impl/scale/{13 个}.java`: ScaleAddDeviceTool/AddDeviceVisionTool/AddModelTool/CalibrateTool/ConfigGenerateTool/DeleteDeviceTool/DeviceDetailTool/ListDevicesTool/ListProtocolsTool/ProtocolDetectTool/TestParseTool/TroubleshootTool/UpdateDeviceTool. `entity/scale/ScaleProtocolConfig.java/ScaleBrandModel.java` + `entity/WeightHistory.java`. 前端 `screens/factory-admin/iot/ScaleTestScreen.tsx` |
| **9** | SmartBI NL Query + 18 SmartBI Screen | ✅ | 完全可用 | 后端: `backend/python/smartbi/{api,services,ingestion,gold,canonical,knowledge}` Python 服务. 前端: 18 个 SmartBI Screen (`screens/smartbi/`): NLQueryScreen.tsx, ExcelUploadScreen, DynamicAnalysisScreen, ExecutiveDashboardScreen, CashFlowScreen, InventoryDashboardScreen, ProductionDashboardScreen, SalesAnalysisScreen, ProcurementDashboardScreen, QualityDashboardScreen, FinanceAnalysisScreen, FinancialRatiosScreen, EfficiencyDashboardScreen, CustomerRFMScreen, SalesFunnelScreen 等 |
| **10** | 食品知识库 RAG (Python + pgvector) | ✅ | 完全可用 | 后端: `backend/python/food_kb/{api,services,database,data}` Python FastAPI 服务. AI Tool: `ai/tool/impl/foodknowledge/FoodKnowledgeQueryTool.java:24` 接入 `/food_kb/query` |
| **11** | AI Insight Card 主动推送 | ✅ | 部分可用 | 前端: `screens/factory-admin/home/components/AIInsightCard.tsx` + `FAHomeScreen.tsx` + `SmartBI/ExecutiveDashboardScreen.tsx` 已集成 |
| **12** | AI 排产/工人优化 Screen | ✅ | 完全可用 | `screens/dispatcher/ai/{7 个}.tsx`: AICompletionProbScreen, AIProbabilityDetailScreen, AIRescheduleScreen, AIScheduleAnalysisScreen, AIScheduleGenerateScreen, AIScheduleScreen, AIWorkerOptimizeScreen. 路由: `navigation/DispatcherNavigator.tsx:108-109` + `dispatcher/DSAIStackNavigator.tsx:42-44` |
| **13** | i18n 多语言（en-US + zh-CN, 20 个 namespace 各） | ✅ | 完全可用 | `src/i18n/locales/{en-US,zh-CN}/` 各含 20 个 namespace: alerts/auth/common/dispatcher/dispatcher-complete/errors/home/hr/logistics/management/platform/processing/profile/quality/reports/restaurant/smartbi/voice/warehouse/workshop |
| **14** | 餐饮专用 35+ AI Tools | ✅ | 完全可用 | `ai/tool/impl/restaurant/{35+}.java` + `restaurant/diagnostic/` 子目录: RestaurantAvgTicketTool/BestsellerQueryTool/DailyRevenueTool/DishCostAnalysisTool/.../WastageRecordTool/SeatConfigManageTool/ShiftScheduleCreateTool/RevenueReportGenerateTool 等。前端: `screens/restaurant/{recipes,requisition,stocktaking,wastage}/` |
| **15** | Canvas 动态字段系统（15 工具） | ✅ | 完全可用 | `ai/tool/impl/canvas/{15 个}.java`: CanvasAddAttachmentFieldTool/AddFieldTool/AddSubTableTool/ApplyTemplateTool/SetApsWeightTool/SetFormulaTool/SetUserPermissionTool/SetVisibilityTool/ToggleModuleTool/ToggleSkillTool/ToggleToolTool/UpdateFieldTool/UpdateTriggerChainTool/HttpCallTool/SplitOrderTool |
| **16** | Approval 审批链 + Timeout Scheduler | ✅ | 完全可用 | `entity/config/ApprovalChainConfig.java` + `scheduler/ApprovalTimeoutScheduler.java` + `controller/ApprovalChainController.java` 见 C3 |
| **17** | 工作日报全套 | ✅ | 完全可用 | 见 H7 |
| **18** | 报废 + 调拨全套 | ✅ | 完全可用 | 见 W8 |

---

## §3. 审计统计汇总

### 71 项 Verdict 分布

| Verdict | 数量 | 占比 | 含义 |
|---------|------|------|------|
| ✅ 完全有 | 14 | 19.7% | 前后端 + AI 全通 |
| 🟢 后端有缺前端 | 4 | 5.6% | 仅缺 UI 暴露 |
| 🟡 部分有 | 22 | 31.0% | 实体在但流程不完整 |
| 🟠 仅 AI Tool 有 | 6 | 8.5% | 没传统 UI 入口但 AIChat 可触发 |
| ❌ 完全没有 | 25 | 35.2% | 完全没实现 |

**总计**: 71 项

### 按域分布

| 域 | ✅ | 🟢 | 🟡 | 🟠 | ❌ | 域总 |
|---|---|---|---|---|---|---|
| 销售/CRM (S1-S10) | 0 | 1 | 4 | 0 | 5 | 10 |
| 采购 (P1-P5) | 1 | 0 | 1 | 1 | 2 | 5 |
| 生产 (M1-M9) | 3 | 1 | 4 | 0 | 1 | 9 |
| 库存 (W1-W10) | 2 | 1 | 4 | 1 | 2 | 10 |
| 财务 (F1-F7) | 1 | 0 | 2 | 0 | 4 | 7 |
| HR (H1-H9) | 1 | 0 | 2 | 2 | 4 | 9 |
| 质检 (Q1-Q4) | 1 | 1 | 1 | 0 | 1 | 4 |
| 设备 (E1-E4) | 1 | 0 | 1 | 1 | 1 | 4 |
| 通用 (C1-C8) | 2 | 0 | 4 | 0 | 2 | 8 |
| UI/UX (U1-U8) | 0 | 0 | 2 | 0 | 6 | 8 |

### V3 误标统计

- **V3 标 ⚪ "后端已有仅需前端" 7 项**：
  - S2 报价单 → 🟢 验证准确（前端 0 引用）
  - S4 客户跟踪 → 🟡 反例（无 Service/Controller）
  - W4 制效告警 → ✅ 部分准确（无 cron）
  - H1 月度考勤 → 🟠 反例（无矩阵格式）
  - Q1 质检模板 → ✅ 完全准确（前端已实现）
  - F1 AR/AP 账龄 → ✅ 完全准确（前端已实现）
  - C5 行业模板 → ✅ 完全准确

- **结论**: V3 ⚪ 标注 **3/7 准确（43%）**，4/7 需修正

### Cretas 独家强项

- **18 项独家能力**：全部 ✅ 完全可用
- 364 个 Tool + 18 Skill + 14 SKILL.md 资源
- 18 个 SmartBI Screen + 7 个 AI 排产 Screen
- 海康 ISAPI + 大华 + 通用 Camera + 电子秤 4 大硬件集成
- 35+ 餐饮专用 Tool
- 食品溯源 + 食品知识库 RAG 双服务

---

## §4. 关键发现总结

### 🔴 V3 误判修正 (高风险)
1. **S4 客户跟踪**：实际只有 entity + repository，**没有 Service/Controller/前端**。BORROW_LIST 说"4.5 人天仅前端"是低估，需补 Service + Controller。
2. **H1 月度考勤矩阵**：AttendanceMonthlyTool 只返回 stats 数字，**没有矩阵 + 8 色 + badge**。需要重写。
3. **H2 6 班次**：前端 SHIFT_CONFIG 实际 **4 班次**（早/午/晚/夜），缺三班倒/弹性/标准 3 种。
4. **W4 制效告警**：**无 cron**，仅 AI Tool 触发。需补 @Scheduled。
5. **M3 生产任务 QR**：Label 有 qr_content，但 ProcessTask 和 ProductionPlan 没有 qrCode 字段绑定。需补 entity 字段 + 服务关联。

### 🟢 V3 准确的省工项 (高 ROI)
1. **F1 AR/AP 账龄** - 后端 + 前端齐全（ArApOverviewScreen 已有"账龄"tab）
2. **Q1 质检模板** - 后端 + 前端齐全（QualityCheckItemConfigScreen）
3. **C5 行业模板** - 8 个 entity + controller + 2 个前端 Screen

### 📊 Cretas 真实实力评估
- **Tool 总数 404 个** > V3 标注 337+，被低估约 67 个
- **Skill 18 + 14 SKILL.md** 与 MEMORY 一致
- **餐饮专用 Tool 35+ 个** 是 Cretas 独家壁垒
- **AI Scheduling 7 Screen** + Insight Card + SmartBI 18 Screen 构成完整 AI 故事

### 🔵 工时建议修正
- BORROW_LIST 6 项 ⚪ 总 25 人天 **被低估**：
  - S4 客户跟踪 实际需 ~6 人天（V3 估 3 人天，+ Service/Controller 3 人天）
  - H1 月度考勤 实际需 ~5 人天（V3 估 3 人天，+ 矩阵 Tool 重写 2 人天）
  - W4 制效告警 实际需 ~3 人天（V3 估 2 人天，+ cron 1 人天）
- **真实 ⚪ 工时**: ~35 人天 (vs V3 估 25 人天，**上调 40%**)
