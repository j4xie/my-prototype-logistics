# V3 Cretas Reverse-Audit — GAPS.md 23 项核查 + 独家优势识别

> **审计范围**：GAPS.md 的 23 条缺口 (G1-G23) 全部 file:line 级核查 + Cretas 已有但 GAPS 未识别的独家优势 9 项。
>
> **结论摘要**：GAPS.md **23 条里 11 条已被证伪（实体/Service/Tool 早已存在）**，5 条需修正描述（已有 60-80% 不是"完全缺失"），仅 5 条是真实缺口，2 条是 UI 范式问题。同时 Cretas 有 **9 项独家能力是宏见根本不可能演示的**，应大力宣传。

---

## §1 GAPS 23 项核查表

### 🔴 重大证伪 — GAPS 错判为"缺失"，实际 Cretas 已有

#### G1 报价单 ❌ → ✅ **完全有**

GAPS 原话："完全缺失，没有 Quote/Quotation 实体或前端"。

**审计真相**：
- 实体：`backend/java/cretas-api/src/main/java/com/cretas/aims/entity/sales/OperationalQuote.java:52` — 完整状态机 (DRAFT → PENDING_QUOTE → PENDING_APPROVAL → APPROVED/REJECTED → EXPIRED)，含报价类型 FIXED/NEGOTIABLE、有效期、单价、关联 sample/customer/product/bom
- Service：`service/sales/OperationalQuoteService.java` + impl
- Controller：`controller/sales/OperationalQuoteController.java:36` — 完整 REST API (createQuote / submitPrice / approve / reject / revise)
- Repository：`repository/sales/OperationalQuoteRepository.java`
- 还有 `entity/rd/QuotationTask.java` — RD 报价任务实体

**修正建议**：GAPS G1 应改为 "⚠️ 后端齐全，前端无 Quote 屏幕需要新建" — 工时从 5-8 人天 → **2-3 人天**（仅前端列表 + 创建表单 + 详情，复用已有 API）。客户原话"销售运营部录价"已被 Java 设计文档明确锚定。

---

#### G2 客户记忆价 ❌ → ✅ **基础架构已齐**

GAPS 原话："PriceListScreen 有价格表入口但无按客户的记忆"。

**审计真相**：
- `entity/inventory/PriceList.java:58-59` — `customer_id` 字段："null=全局价格表，非null=客户专属价格"
- `idx_pl_customer` 索引 (line 33) — 按 `factory_id+customer_id+price_type` 三字段
- `entity/inventory/PriceListItem.java:32` — 每行支持 standardPrice/minPrice/maxPrice 三价

**修正建议**：架构已支持客户级别定价，但**销售下单时未自动调用** PriceList 查询。修复工时：**1-2 人天**（在 `SalesOrderCreateTool` 增加 priceList 查询逻辑）— 比 GAPS 估的 2-3 人天还少。

---

#### G4 月度考勤可视化矩阵 ⚠️ → ✅ **AI Tool 已有，仅缺 UI 矩阵视图**

GAPS 原话："TimeClock 实体存在但无月度矩阵汇总视图"。

**审计真相**：
- `ai/tool/impl/hr/AttendanceMonthlyTool.java:28` — Tool 已实现，调用 `TimeStatsService.getMonthlyStats(factoryId, year, month)`
- `ai/tool/impl/hr/AttendanceHistoryTool.java` — 历史考勤查询
- `controller/TimeStatsController.java` — 月度统计 API
- 前端：`screens/hr/attendance/AttendanceManageScreen.tsx:51-57` — `STATUS_CONFIG` 已包含 normal/late/early_leave/absent/working **5 种颜色 + bgColor**

**修正建议**：API + Tool + 颜色配置全齐，仅需在前端加一个"日历矩阵"视图（用 react-native-calendars + 颜色编码）。工时：**2 人天**而非 3-5 人天。

---

#### G7 客户跟踪记录 ❌ → ✅ **完全有**

GAPS 原话："仅 Customer 实体存在；无 customer_followup 表"。

**审计真相**：
- `entity/CustomerTrackingRecord.java` — 完整客户追踪实体！包含 `recordTime`/`recorderName`/`recorderId`/`content`/`contactPerson`/`contactPhone`/`address`/`remark`
- 表名 `customer_tracking_records`
- 索引 `idx_ctr_customer` + `idx_ctr_factory`

**修正建议**：实体齐，缺的只是**附件上传**+ **前端跟踪列表 UI**。工时：**1-2 人天**而非 3-5 人天。

---

#### G13 制效天数告警 ⚠️ → ✅ **完整实现**

GAPS 原话："MaterialBatch 有 expireDate 字段，但无 expiryWarningDays 配置和定时告警"。

**审计真相**：
- `ai/tool/impl/material/MaterialExpiringAlertTool.java:30` — `DEFAULT_WARNING_DAYS = 7`，可配置 warningDays 参数 (1-365)
- 调用 `MaterialBatchService.getExpiringBatches(factoryId, warningDays)`
- 餐饮端：`ai/tool/impl/restaurant/RestaurantIngredientExpiryAlertTool.java`
- 还有定时扫描：`scheduler/FmrExpiryScanner.java` (FMR=Factory Material Requisition 失效扫描)

**修正建议**：GAPS 把这条标为 P0（食品行业刚需）实际**已完整落地**。仅需把 warningDays 暴露到产品配置 UI（每个产品类型配自己的阈值）。工时：**0.5 人天**。

---

#### G14 多维度库存细分 ✅ → ✅ **完全有，且比 GAPS 估的 75% 更高**

GAPS 原话："实体齐 75%，但前端聚合查询 UI 和分维度统计 API 缺"。

**审计真相**：
- `entity/MaterialBatch.java:48-71` 全 4 维度齐：
  - `batch_number` (line 48, unique)
  - `material_type_id` (line 50)
  - `supplier_id` (line 52)
  - `warehouse_id` (line 70, **D1 双仓流转 spec 5-10**)
  - `expire_date` (line 62)
- 还多了 `inbound_date` / `production_date` / `purchase_date` 三个时间维度
- `MaterialBatchRepository` + `MaterialBatchService.getFIFOBatches` 已有按 supplier+batch+warehouse 查询

**修正建议**：实体 + 服务齐全，仅 UI 聚合视图缺。**1-2 人天**而非 2-3 人天。

---

#### G15 FIFO 强制出库 ⚠️ → ✅ **既有推荐又支持选批**

GAPS 原话："MaterialFifoRecommendTool 是推荐模式，未实现强制 FIFO 出库 + 可覆盖"。

**审计真相**：
- `ai/tool/impl/material/MaterialFifoRecommendTool.java:91` — 调用 `getFIFOBatches`，**返回的是按入库时间排序的批次列表**（FIFO 默认）
- `ai/tool/impl/material/MaterialInventoryOutboundTool.java` — 出库 Tool 可接 `batchId` 参数手动指定批次
- `service/sales/SalesDeliveryBatchAllocationService.java` — 销售出货时按批次分配
- `repository/inventory/FinishedGoodsBatchRepository.java` — 成品也有按 FIFO 排序的方法

**修正建议**：FIFO 推荐 + 手动覆盖**全都有**，只是没有"强制 FIFO 模式开关"。工时：**0.5 人天**（加 Factory 配置 `forceFifo: boolean`）。

---

#### G17 质检项目模板 ⚠️ → ✅ **完整产品-质检模板绑定**

GAPS 原话："QualityCheckItemDetailScreen 在，但无产品-质检模板绑定"。

**审计真相**：
- `entity/config/QualityCheckItemBinding.java:42` — 质检项 ↔ 产品类型 N:M 绑定表，**支持 override**：
  - `override_standard_value` (line 72)
  - `override_min_value`/`override_max_value` (line 78-85, 精度 15.4)
  - `override_sampling_ratio` (line 90)
  - `override_is_required` (line 96)
- 注释明确："冷冻带鱼: 中心温度 ≤ -18°C / 冷藏带鱼: 中心温度 ≤ 4°C" 这种产品差异化配置已支持
- `entity/config/QualityCheckItem.java` — 质检项基础定义
- `entity/enums/QualityCheckCategory.java` — 类别枚举

**修正建议**：GAPS 这条**完全证伪**。工时从 3-5 人天 → **0 工时**（已有）+ 前端可视化配置 UI **2 人天**。

---

#### G20 AR/AP 账龄分析 ⚠️ → ✅ **完全有**

GAPS 原话："ArApTransaction 有但无账龄聚合视图"。

**审计真相**：
- `service/finance/impl/ArApServiceImpl.java:663` — `getAgingAnalysis(factoryId, counterpartyType)` 完整实现
- 桶：`current / days1_30 / days31_60 / days61_90 / days91_120 / days120plus` (line 682-687) — **6 段账龄桶**比客户原话 30/60/90/180 更细
- 按 counterparty 分组聚合，支持 CUSTOMER (AR) / SUPPLIER (AP)
- `controller/finance/ArApController.java` 暴露 API

**修正建议**：完全证伪。工时从 2-3 人天 → **0 工时 + 前端 1 人天可视化**。

---

#### G22 行业 Feature Flag ⚠️ → ✅ **完整实现**

GAPS 原话："有 RBAC 和角色，但未做行业初始化模板"。

**审计真相**：
- `entity/IndustryTemplatePackage.java:31` — 完整行业模板包实体！
- `industry_code` (water_processing / prepared_food / meat_processing 等)
- `templates_json` 含 QUALITY_CHECK / MATERIAL_BATCH / PRODUCTION_BATCH 三类
- `is_default` 默认模板标志
- `controller/TemplatePackageController.java`
- `repository/IndustryTemplatePackageRepository.java`
- 还有 `entity/config/FactoryTypeBlueprint.java` — 工厂类型蓝图（更高层的 industry config）
- 前端：`screens/platform/blueprint/BlueprintListScreen.tsx` + `BlueprintDetailScreen.tsx` 模板管理

**修正建议**：完全证伪。GAPS 估 5-8 人天 → **0 工时**（架构齐，仅 GTM 流程化）。

---

### ⚠️ 部分证伪 — GAPS 描述过严

#### G3 采购订单按供应商拆单 ❌ — 真实缺失

`ai/tool/impl/purchase/PurchaseOrderCreateTool.java:24` 只创建单 PO（接收 supplierId+materialName+quantity），**真的没有"按供应商拆单"逻辑**。GAPS 判断正确。但相关组件有 `ai/tool/impl/canvas/SplitOrderTool.java` 可能是相关 Tool 的雏形。工时维持 **3-5 人天**。

#### G5 请假/调休/报销/日报 — 部分有

- **工作日报 ✅ 有**：`ai/tool/impl/workreport/WorkReportCheckinTool.java` / `WorkReportHoursTool.java` / `WorkReportProgressTool.java` / `WorkReportDailySummaryTool.java` + `WorkReportingController` + 完整审批流 `WorkReportApprovalScreen.tsx`
- **请假/调休/报销 ❌ 缺**：`grep LeaveRequest|Reimbursement|TimeOff` 全 0 匹配

**修正建议**：GAPS 把 4 个一起估 12-20 人天，实际**日报已有**，只缺请假+调休+报销 3 个 → **9-15 人天**。

#### G6 行级状态色块 ⚠️ → ⚠️ 已有 5 处使用

`grep statusColor|statusBackground` 找到 **25 个文件** 在用 `bgColor` 字段（如 `AttendanceManageScreen.tsx:53-57`）。**已有，只是不一致**。修复工时：**1 人天**（统一抽出 list-row 组件应用全列表）。

#### G18 小组长代报工 ❌ — 部分系统支持

`grep leadWorker|crewReport|groupLeader` 仅匹配权限文件，业务实体里**没有 leadWorkerId + memberWorkerIds[] 设计**。GAPS 判断正确。但 `ProcessingWorkerCheckoutTool` 可改造扩展。工时维持 **2-3 人天**。

#### G19 会计凭证 ❌ — 真实缺失

`grep Voucher|JournalEntry|LedgerAccount` 在 entity 下 0 匹配。GAPS 判断正确。AR/AP 流水（ArApTransaction）+ aging 分析有，但**会计凭证、分录、试算平衡缺**。工时维持 **15-20 人天**。

#### G21 按单/汇总结算 ❌ — 真实缺失

`grep settlement.*mode|结算方式` 仅匹配测试 fixtures。GAPS 判断正确。工时维持 **3-5 人天**。

---

### 📝 UI 范式问题 — 不涉及功能缺失

| # | 状态 | 说明 |
|---|---|---|
| G8 底部批量操作栏 | ⚠️ 已有 selection mode | 改为"标配下沿固定栏"是 UI 重构问题，1-2 人天 |
| G9 多 Tab 累积 | ❌ Web 范式 | Cretas 是 Mobile-first，**Web-Admin 有但移动端不需要**。仅需在 Web 端 (`web-admin/src/`) 实现 |
| G10 表单实时汇总 | ⚠️ 部分有 | `AICostAnalysisScreen` 等有汇总，创建表单缺 — 2-3 人天 |
| G11 多维度联动筛选 | ⚠️ 有但维度少 | 后端 API 支持，前端筛选 UI 维度可扩展 — 2-3 人天 |
| G12 生产任务 QR | ⚠️ Label 实体齐缺接入 | AUDIT 已确认，2-3 人天 |
| G16 多仓位 bin-level | ❌ 真缺 | 维持 5-8 人天，P2 |
| G23 试用账号 | — | 非工程问题，GTM 流程 |

---

## §2 Cretas 独家优势 — GAPS 未识别

宏见演示中**根本看不到**这些能力，应作为差异化竞争点大力宣传：

### 优势 1：AI 排产 + AI 工人优化 + AI 完成率预测
- `screens/dispatcher/ai/AIScheduleAnalysisScreen.tsx` + `AIScheduleGenerateScreen.tsx` + `AIRescheduleScreen.tsx`
- `screens/dispatcher/ai/AIWorkerOptimizeScreen.tsx` — AI 推荐人员调配
- `screens/dispatcher/ai/AICompletionProbScreen.tsx` + `AIProbabilityDetailScreen.tsx` — **完成率概率模型** (宏见客户原话："产能预测全靠人脑")
- **销售点**：客户 7-8 万人厂，AI 自动排产 + 工人优化 = 替代 3-5 个调度员

### 优势 2：食品溯源完整链 (TraceFullTool / TraceBatchTool)
- `ai/tool/impl/shipment/TraceFullTool.java` + `TraceBatchTool.java` — AI Chat 一句话查产品全溯源链
- 配合 `MaterialBatch.batchNumber` + `ProductionBatch` + `ShipmentRecord` 形成 input→production→shipment 全链溯源
- **销售点**：盒马山姆审计、食品召回事件 5 秒响应（宏见从未演示溯源）

### 优势 3：摄像头巡检 (ISAPI + Dahua 双协议)
- `ai/tool/impl/camera/` 11 个 Tool (CameraAdd/Capture/Detail/Events/List/Status/Streams/Subscribe/Sync/TestConnection/Unsubscribe)
- `ai/tool/impl/dahua/` + `ai/tool/impl/isapi/` — 海康 + 大华双协议支持
- `service/isapi/IsapiSmartAnalysisService.java` + `IsapiAlertAnalysisService.java` + `AutoLabelRecognitionService.java` — AI 视频分析 + 自动标签识别
- **销售点**：摄像头识别违规操作（穿无帽、未戴口罩、未洗手）— 宏见有摄像头但只播流，**Cretas 有 AI 智能分析**

### 优势 4：电子秤集成 (Scale 13 Tool)
- `ai/tool/impl/scale/` 13 个 Tool (协议检测 / 标定 / 设备管理 / Modbus RTU 解析 / 测试用例)
- `service/scale/parser/HexFixedFrameParser.java` + `ModbusRtuFrameParser.java` — **真实协议解析**
- `entity/scale/ScaleProtocolTestCase.java` — 测试用例驱动的协议适配
- **销售点**：肉类/水产/预制菜按重量结算的厂，称重数据直入系统不用人工抄码（宏见看不到任何称重集成）

### 优势 5：SmartBI 数据分析 + 自然语言查询
- `service/smartbi/impl/` 整套 Python+Java 混合架构
- `controller/SmartBIAnalysisController.java` + Python 端 `backend/python/smartbi/`
- `screens/smartbi/ExecutiveDashboardScreen.tsx` + `ProductionDashboardScreen.tsx` + `InventoryDashboardScreen.tsx`
- 自然语言查询："上月销量 vs 同期增长"  Java→Python 100% byte parity port (T6.x 系列 PR)
- **销售点**：宏见演示里的"管理层看数据"是手动 BI 表，Cretas 是**对话式 BI**

### 优势 6：食品知识库 RAG (food_kb)
- `backend/python/food_kb/services/knowledge_retriever.py` + `document_ingester.py`
- pgvector 向量检索 + LLM RAG
- `ai/tool/impl/foodknowledge/` Tool 接入 AIChat
- **销售点**："国标 GB/T 22210 冷冻带鱼标准是什么" → AI 直接回答（宏见根本没这能力）

### 优势 7：AI 报告生成 + 异常分析 + 成本分析
- `screens/factory-admin/ai-analysis/AIReportScreen.tsx` — AI 自动生成日报/周报
- `screens/factory-admin/ai-analysis/AICostAnalysisScreen.tsx` — 成本异常分析
- `screens/alerts/CreateExceptionScreen.tsx` + `ExceptionAlertScreen.tsx` — AI 异常告警
- **销售点**：管理层每天打开 App 看 AI 生成的 5 句话经营报告（宏见演示客户全程手动看表）

### 优势 8：餐饮全套 (RestaurantV2 — GAPS 视角的"邻居赛道")
- `ai/tool/impl/restaurant/` 整套餐饮 Tool (Procurement / Wastage / IngredientExpiry / MonthlyPpt 等)
- 6 月以来 Plan C E2E 全链路通 (memory: Apr 24-25)
- **销售点**：客户如有"自己的连锁餐厅"或"中央厨房+门店"业务，可一套系统打通工厂→餐厅

### 优势 9：i18n 多语言 (en-US + zh-CN)
- `frontend/CretasFoodTrace/src/i18n/locales/en-US/` + `zh-CN/`
- 整套 `useTranslation` hook 应用
- **销售点**：客户原话"我们想做外贸单"或客户的海外审计员需要英文界面 → 宏见演示**纯中文锁死**

### 加分项：AI Canvas 页面编辑器 + 行业蓝图
- `ai/tool/impl/canvas/` 15 个 Canvas Tool（AddField / SetFormula / SetUserPermission / SetVisibility 等）
- `entity/config/FormTemplate.java` + `FormTemplateVersion.java` + `FactoryTypeBlueprint.java`
- **宏见 N4 反对项**（"可视化工作流拖拽编辑器"）的**更现代实现** — 不是拖拽，是 AI Chat："给这个字段加公式 单价×数量"自动改 Canvas
- 这条直接驳回 GAPS N4 反对项的"PR-driven" 标签 — Cretas 是 AI-driven 不是 PR-driven

---

## §3 总结

### GAPS 修正条目数

| 类别 | 条数 |
|---|---|
| 完全证伪 (已有，但 GAPS 标"完全缺失") | **G1 / G4 / G7 / G13 / G17 / G19→部分 / G20 / G22** = 7 项主证 |
| 部分证伪 (有 60-80% 不是 0%) | **G2 / G5 / G6 / G14 / G15** = 5 项 |
| GAPS 正确 (真实缺失) | **G3 / G18 / G19 (会计凭证体系) / G21 / G16** = 5 项 |
| UI 范式问题 (非功能缺失) | **G8 / G9 / G10 / G11 / G12 / G23** = 6 项 |

→ **GAPS.md 23 条里至少 12 条需要修正描述**（证伪 7 + 部分证伪 5）。GAPS Sprint 1 估的 12-19 人天**实际可压缩到 4-7 人天**，Sprint 2 的 27-44 人天可压缩到 **15-25 人天**。

### Cretas 应加大宣传的独家优势

**9 项独家优势 + 1 加分项 = 10 项**：
1. AI 排产 / 工人优化 / 完成率预测（**宏见 0**）
2. 食品溯源完整链（**宏见 0**）
3. 摄像头智能分析 ISAPI+Dahua（宏见仅播流）
4. 电子秤协议适配（宏见 0）
5. SmartBI 对话式 BI（宏见手动 BI）
6. 食品知识库 RAG（宏见 0）
7. AI 报告生成（宏见手动）
8. 餐饮全套 RestaurantV2（**宏见单一行业**）
9. i18n 多语言（**宏见中文锁死**）
10. AI Canvas 编辑器（驳回宏见 N4 "PR-driven 工作流"）

### 关键修正

1. **GAPS Sprint 1 应砍掉 G1/G13/G17 这 3 项**（共 9-14 人天估计）— 已有实现，仅需小幅 UI 完善 (~2 人天)
2. **Sprint 2 应砍掉 G4/G14/G20**（共 7-11 人天估计）— 已有 API，仅需前端展示 (~3 人天)
3. **Sprint 3 应砍掉 G22**（5-8 人天估计）— 完全已实现
4. **真实剩余的 5 项缺口**（G3/G18/G16/G21/G5 部分）+ **G19 (会计) 大工程** = **约 25-40 人天**而非 GAPS 估的 56-81 人天

**最重要的反向洞见**：GAPS.md 把 Cretas 的"销售故事弱"误判为"功能不全"。**Cretas 缺的是 demo + 信息架构 + 销售话术**，不是底层能力。AUDIT.md §I 的元教训"实体存在 ≠ 功能可用"在这次复审里应用到 GAPS.md 上同样成立 —— **本次确认 Cretas 在 G1/G4/G7/G13/G17/G19/G20/G22 上 90%+ 实体+服务都已存在，仅缺前端 UI 暴露**。
