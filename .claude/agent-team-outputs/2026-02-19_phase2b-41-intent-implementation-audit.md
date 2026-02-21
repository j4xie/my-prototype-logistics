# Phase 2b 41个缺失Intent — 功能实现状态审计报告

**日期**: 2026-02-19
**核心结论**: **之前的"幻影功能"判断有误** — 经审计后端89个Controller/1309个API端点，发现**41个缺失intent中约31个(76%)已有后端实现**，只需在handler的switch中接入即可。

---

## 一、审计结果总览

| 分类 | 数量 | 说明 |
|------|------|------|
| **T1-接入型** (API已有，只需加switch case) | **24** | 后端Service/Controller完整，handler添加case调用即可 |
| **T2-组装型** (需组合多个API) | **7** | 需要组合2-3个Service查询结果，写30-60 LOC |
| **T3-新建型** (需新建算法/Entity) | **7** | 需要新写计算逻辑或数据模型 |
| **T4-外部依赖型** (需外部集成) | **3** | 需要微信/IoT等外部服务接入 |

---

## 二、逐个Intent审计明细

### T1-接入型 (24个) — 只需handler添加switch case

每个intent只需在对应handler的switch中添加一个case，调用已有的Service/Repository方法，格式化返回。每个约15-40 LOC。

| # | Intent Code | 对应Controller | 对应Service方法 | 所属Handler |
|---|-------------|----------------|----------------|-------------|
| 1 | QUERY_EMPLOYEE_PROFILE | UserController | `GET /users/{id}`, `GET /users/search` | HRIntentHandler |
| 2 | QUERY_ONLINE_STAFF_COUNT | TimeClockController | `GET /time-clock/today` → 计数 | HRIntentHandler |
| 3 | ATTENDANCE_STATS_BY_DEPT | TimeClockController | `GET /time-clock/department/{dept}`, `GET /time-clock/statistics` | HRIntentHandler |
| 4 | HR_DELETE_EMPLOYEE | UserController | `DELETE /users/{userId}` | HRIntentHandler (需确认操作) |
| 5 | TASK_ASSIGN_WORKER | WorkOrderController | `POST /work-orders/{id}/assign` | 新建WorkflowIntentHandler 或扩展DataOp |
| 6 | ORDER_APPROVAL | TransferController | `POST /transfers/{id}/approve` | 新建ApprovalIntentHandler |
| 7 | QUERY_APPROVAL_RECORD | ApprovalChainController | `GET /approval-chains`, `GET /statistics` | ReportIntentHandler |
| 8 | EQUIPMENT_BREAKDOWN_REPORT | EquipmentAlertsController | `GET /alerts` + `GET /alerts/stats` | EquipmentIntentHandler |
| 9 | QUERY_EQUIPMENT_STATUS_BY_NAME | EquipmentController | `GET /equipment/search?keyword=NAME` | EquipmentIntentHandler |
| 10 | ANALYZE_EQUIPMENT | EquipmentController | `GET /equipment/{id}/statistics` + `/usage-history` | EquipmentIntentHandler |
| 11 | EQUIPMENT_CAMERA_START | CameraController | `POST /camera/connect` + `POST /camera/capture` | EquipmentIntentHandler |
| 12 | QUERY_PROCESSING_CURRENT_STEP | ProcessingController | `GET /processing/batches/{id}/timeline` | MaterialIntentHandler |
| 13 | QUERY_PROCESSING_STEP | ProcessingController | `GET /processing/batches/{id}` (工序详情) | MaterialIntentHandler |
| 14 | QUERY_PROCESSING_BATCH_SUPERVISOR | ProcessingController | `GET /processing/batches/{id}/workers` | MaterialIntentHandler |
| 15 | WORKER_ARRIVAL_CONFIRM | TimeClockController | `POST /time-clock/clock-in` (确认到岗) | HRIntentHandler |
| 16 | SUPPLIER_CREATE | SupplierController | `POST /suppliers` (完整CRUD) | CRMIntentHandler |
| 17 | SHIPMENT_DELETE | ShipmentController | `DELETE /shipments/{id}` | ShipmentIntentHandler |
| 18 | USER_TODO_LIST | WorkOrderController | `GET /work-orders/my` (我的待办) | 新建WorkflowIntentHandler |
| 19 | REPORT_WORKSHOP_DAILY | ProductionAnalyticsController | `GET /production-analytics/dashboard` + `/daily-trend` | ReportIntentHandler |
| 20 | REPORT_BENEFIT_OVERVIEW | ProductionAnalyticsController | `GET /production-analytics/efficiency/dashboard` | ReportIntentHandler |
| 21 | REPORT_AI_QUALITY | QualityCheckItemController | quality inspection reports | ReportIntentHandler |
| 22 | APPROVAL_CONFIG_PURCHASE_ORDER | ApprovalChainController | `GET/POST /approval-chains` 完整CRUD | SystemIntentHandler |
| 23 | CONFIG_RESET | SystemConfigController | 添加reset endpoint | SystemIntentHandler |
| 24 | CCP_MONITOR_DATA_DETECTION | EquipmentController | `GET /equipment/statistics` (关键控制点设备) | EquipmentIntentHandler |

### T2-组装型 (7个) — 需组合多个Service

每个需要30-60 LOC，调用2-3个现有Service组合结果。

| # | Intent Code | 需要组合的Service | 实现思路 |
|---|-------------|-----------------|----------|
| 1 | ORDER_UPDATE | SalesController PUT + ProcessingController | 识别订单类型(采购/销售/内部)→调对应Service更新 |
| 2 | INVENTORY_OUTBOUND | TransferController POST(type=出库) | 创建type=OUTBOUND的InternalTransfer |
| 3 | WAREHOUSE_OUTBOUND | TransferController POST + ship | 创建transfer + 触发ship流程 |
| 4 | SHIPMENT_NOTIFY_WAREHOUSE_PREPARE | ShipmentController POST + NotificationService | 创建shipment + 发送站内通知 |
| 5 | PRODUCT_SALES_RANKING | SalesController GET /statistics | 查询销售数据 + 排序格式化 |
| 6 | PAYMENT_STATUS_QUERY | ArApController | 查询AR/AP事务 + 过滤未结清 |
| 7 | QUERY_MATERIAL_REJECTION_REASON | QualityDispositionController | 查询处置记录 + 过滤退货类型 |

### T3-新建型 (7个) — 需新建算法/Service

每个需要80-200 LOC新代码。

| # | Intent Code | 缺少什么 | 实现方案 |
|---|-------------|----------|----------|
| 1 | QUERY_SOLVENCY | 偿债能力算法 | 用ArApTransaction计算：流动资产/流动负债 |
| 2 | QUERY_FINANCE_ROE | ROE算法 | 净利润/净资产 (需从SmartBI或ArAp聚合) |
| 3 | QUERY_DUPONT_ANALYSIS | 杜邦分析模型 | 拆解为利润率×周转率×杠杆率 |
| 4 | QUERY_LIQUIDITY | 流动比率算法 | 速动比率 = (流动资产-存货)/流动负债 |
| 5 | QUERY_FINANCE_ROA | ROA算法 | 净利润/总资产 |
| 6 | MRP_CALCULATION | MRP引擎 | BomItem + MaterialBatch + WorkOrder → 需求计算 |
| 7 | WORKER_IN_SHOP_REALTIME_COUNT | 实时计数Service | WorkstationCountingController有基础，需聚合全车间 |
| 8 | QUERY_ORDER_PENDING_MATERIAL_QUANTITY | 缺料计算 | WorkOrder需求 - MaterialBatch库存 = 缺口 |

### T4-外部依赖型 (3个) — 需外部服务集成

| # | Intent Code | 依赖 | 可替代方案 |
|---|-------------|------|-----------|
| 1 | NOTIFICATION_SEND_WECHAT | 微信公众号/企业微信API | 改为站内通知(NotificationController已有) |
| 2 | COLD_CHAIN_TEMPERATURE | IoT温度传感器数据 | 用IsapiDevice查询温度设备状态 |
| 3 | QUERY_TRANSPORT_LINE | 物流TMS系统 | 用VehicleController查询车辆信息替代 |

---

## 三、修复方案与工作量

### 方案：分3轮实施

#### Round 1: T1接入型 (24个intent, 预计2-3天)

**核心工作**: 在现有handler的switch中添加case，调用已有Service。

需要修改的handler文件：
- `HRIntentHandler.java` — 添加5个case (QUERY_EMPLOYEE_PROFILE, QUERY_ONLINE_STAFF_COUNT, ATTENDANCE_STATS_BY_DEPT, HR_DELETE_EMPLOYEE, WORKER_ARRIVAL_CONFIRM)
- `EquipmentIntentHandler.java` — 添加5个case (EQUIPMENT_BREAKDOWN_REPORT, QUERY_EQUIPMENT_STATUS_BY_NAME, ANALYZE_EQUIPMENT, EQUIPMENT_CAMERA_START, CCP_MONITOR_DATA_DETECTION)
- `MaterialIntentHandler.java` — 添加3个case (QUERY_PROCESSING_CURRENT_STEP, QUERY_PROCESSING_STEP, QUERY_PROCESSING_BATCH_SUPERVISOR)
- `ReportIntentHandler.java` — 添加4个case (REPORT_WORKSHOP_DAILY, REPORT_BENEFIT_OVERVIEW, REPORT_AI_QUALITY, QUERY_APPROVAL_RECORD)
- `CRMIntentHandler.java` — 添加1个case (SUPPLIER_CREATE)
- `ShipmentIntentHandler.java` — 添加1个case (SHIPMENT_DELETE)
- `SystemIntentHandler.java` — 添加2个case (APPROVAL_CONFIG_PURCHASE_ORDER, CONFIG_RESET)
- **新建** `WorkflowIntentHandler.java` — 3个case (TASK_ASSIGN_WORKER, USER_TODO_LIST, ORDER_APPROVAL)

**预估LOC**: 24 × 25 avg = ~600 LOC
**需要注入的Service**: UserService, TimeClockService, EquipmentService, ProcessingService, CameraService, SupplierService, ShipmentService, ApprovalChainService, WorkOrderService, ProductionAnalyticsService

#### Round 2: T2组装型 (7个intent, 预计1-2天)

修改handler中的case实现，组合调用多个Service。

**预估LOC**: 7 × 45 avg = ~315 LOC

#### Round 3: T3新建型 (7个intent, 预计2-3天)

- **财务分析Service** (新建 `FinancialAnalysisService.java`): 5个计算公式 ~200 LOC
- **MRP计算Service** (新建 `MrpCalculationService.java`): 需求-库存匹配 ~150 LOC
- **实时车间人数**: 聚合WorkstationCounting结果 ~50 LOC
- **缺料计算**: WorkOrder需求对比MaterialBatch ~60 LOC

**预估LOC**: ~460 LOC

#### T4: 降级处理 (3个intent)

- NOTIFICATION_SEND_WECHAT → 改为发送站内通知 + 提示"微信通知功能开发中"
- COLD_CHAIN_TEMPERATURE → 查询IsapiDevice温度设备状态
- QUERY_TRANSPORT_LINE → 查询VehicleController车辆信息

**预估LOC**: 3 × 30 = ~90 LOC

### 总工作量

| 阶段 | Intent数 | LOC | 天数 | Phase 2b提升 |
|------|---------|-----|------|-------------|
| Round 1 (T1) | 24 | ~600 | 2-3天 | 67% → 82% |
| Round 2 (T2) | 7 | ~315 | 1-2天 | 82% → 87% |
| Round 3 (T3) | 7 | ~460 | 2-3天 | 87% → 93% |
| T4 降级 | 3 | ~90 | 0.5天 | 93% → 95% |
| **总计** | **41** | **~1465** | **6-8天** | **67% → 95%** |

---

## 四、关键handler需要注入的Service清单

当前handler是`@Component`，通过`@Autowired`注入Service。需要确认的依赖：

| Handler | 需注入的新Service | 是否已有@Autowired |
|---------|-----------------|-------------------|
| HRIntentHandler | UserService, TimeClockService | 需添加 |
| EquipmentIntentHandler | EquipmentAlertService, CameraService | 需添加 |
| MaterialIntentHandler | ProcessingService | 可能已有 |
| ReportIntentHandler | ProductionAnalyticsService, ApprovalChainService | 需添加 |
| CRMIntentHandler | SupplierService | 可能已有 |
| 新建 WorkflowIntentHandler | WorkOrderService, ApprovalChainService, TransferService | 全部新增 |

---

## 五、Critic验证结果

### 已验证的代码映射

1. **SupplierController** — `POST /suppliers` 完整CRUD ✅ 有创建/删除/查询/导入导出
2. **ProcessingController** — `GET /batches/{id}/timeline` 有timeline API ✅ 可用于QUERY_PROCESSING_CURRENT_STEP
3. **TransferController** — `POST /transfers/{id}/approve|reject` ✅ 有审批流程
4. **EquipmentController** — `GET /equipment/search` + `GET /{id}/statistics` ✅ 支持名称搜索和统计
5. **CameraController** — `POST /camera/connect` + `POST /camera/capture` ✅ 有摄像头控制
6. **ApprovalChainController** — 完整CRUD + statistics ✅ 支持审批配置
7. **WorkOrderController** — `GET /work-orders/my` + `POST /{id}/assign` ✅ 支持待办和分配
8. **ArApTransaction Entity** — 应收应付交易记录 ✅ 有完整的银行流水模式

### 风险点

1. **Handler注入Service的方式**: 现有handler通过构造函数注入(如FoodKnowledgeIntentHandler用`@RequiredArgsConstructor`)，新增Service需要添加到构造函数
2. **Service层是否暴露内部方法**: Controller调用的Service方法是`public`的，handler可以直接调用
3. **返回格式适配**: Controller返回的DTO需要转换为IntentExecuteResponse的message+resultData格式
4. **Category映射**: 新增的WorkflowIntentHandler需要在handlerMap中注册新category

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (后端审计 + 前端审计 + 新模块审计) + 1 Analyst-Critic
- Total files audited: 89 controllers, 80+ entities, 6 SQL schemas
- Key correction: 从"60%幻影功能"修正为"76%已有实现"
- Phases: Research → Codebase Audit → Analysis → Critique → Integration
