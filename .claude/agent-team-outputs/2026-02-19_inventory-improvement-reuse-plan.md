# 进销存改进实现方案——复用已有代码与AI能力

**日期**: 2026-02-19
**主题**: 基于已有Java后端、RN前端模式和Python AI服务，实现进销存P0-P2改进的具体路径

---

## Executive Summary

经过对后端Java（89个Controller/1309端点）、前端RN（35+仓储屏幕）和Python AI服务（18种图表/预测/RAG）的全面代码盘点，发现**绝大多数进销存改进可通过复用已有代码实现**。核心发现：

1. **后端API远比前端丰富** — MaterialBatchController已有26个端点（含FEFO/预警/盘点调整），TraceabilityController已有完整追溯API，前端只需对接
2. **追溯/召回后端已实现** — `getFullTrace(batchNumber)` 返回原料→生产→质检→出货全链路，RN页面用的是mock数据而非真实API
3. **AI能力可直接赋能进销存** — 图表引擎(18种)、Insight生成、预测服务、统计分析、钻取分析均**零改动**即可用于库存分析/采购建议/销售预测
4. **前端有成熟模板可复制** — 退货单≈4小时前端工作量（复制PurchaseOrderListScreen模板）

---

## 一、后端已有能力 vs 前端缺口对照

### 1.1 "后端已有，前端未接"的功能（零后端开发）

| 功能 | 后端端点 | 前端现状 | 修复工作量 |
|------|---------|---------|-----------|
| **批次追溯（真实数据）** | `GET /traceability/full/{batchNumber}` | WHBatchTraceScreen 用 mock | **小** — 替换mock为API调用 |
| **公开追溯（消费者扫码）** | `GET /api/public/trace/{batchNumber}` | 未对接 | 小 |
| **FEFO批次推荐** | `GET /material-batches/fifo/{materialTypeId}` | 出库页未联动 | 小 — 在出库选批次时调用 |
| **综合库存预警** | `GET /material-batches/inventory/alerts` | InventoryWarningsScreen已接 | ✅已完成 |
| **批次使用历史** | `GET /material-batches/{batchId}/usage-history` | 未展示 | 小 |
| **库存导出** | `GET /material-batches/export` (blob) | 无导出按钮 | 小 |
| **收款/付款API** | `POST /finance/receivable/payment` 等4个 | ArApOverview仅展示 | 中 — 需新建表单UI |
| **信用检查** | `GET /finance/credit-check` | 销售下单未联动 | 小 |
| **价格表创建** | `POST /price-lists` | PriceListScreen仅查看 | 中 — 需新建表单UI |
| **质检处置审批** | `POST /quality-disposition/apply` + `approve` | 未对接 | 中 |
| **标签/溯源码生成** | LabelController 已有 | 未对接 | 小 |

### 1.2 需要少量后端扩展的功能（1-3天）

| 功能 | 现有基础 | 需扩展内容 |
|------|---------|-----------|
| **FEFO排序** | `getAvailableBatches()` 返回可用批次 | Service层加 `ORDER BY expire_date ASC` |
| **采购→AP自动挂账** | `ArApService.recordPayable()` 已实现 | `PurchaseService.confirmReceive()` 末尾注入调用 |
| **销售→AR自动挂账** | `ArApService.recordReceivable()` 已实现 | `SalesService.shipDelivery()` 末尾注入调用 |
| **IQC-采购联动** | `QualityInspectionRepository` 已有 | `confirmReceive()` 前检查质检状态 |
| **FQC-销售联动** | `QualityCheckItemController` 支持FQC | `shipDelivery()` 前检查出厂检验 |
| **通知推送** | `NotificationService` + `sendToRole()` 完整 | 在关键节点注入通知调用 |

### 1.3 需要新建的后端功能（1周）

| 功能 | 复用基础 | 新建内容 |
|------|---------|---------|
| **采购退货** | PurchaseController模式 + ArApService | 新建ReturnOrderController/Service/Entity |
| **销售退货** | SalesController模式 + ArApService | 同上，共用ReturnOrder实体 |
| **盘点工作流** | `material-batches/{id}/adjust` + ApprovalChainService | 新建StocktakeController/Service |

---

## 二、AI能力复用矩阵

### 2.1 Python AI服务 → 进销存场景映射

| Python能力 | 当前端点 | 进销存应用 | 改动量 |
|-----------|---------|-----------|--------|
| **图表引擎(18种)** | `/api/chart/build` | 库存趋势(line)、采购排行(bar_h)、销售占比(donut)、库龄(bar)、ABC(pareto) | **零改动** |
| **AI Insight** | `/api/insight/generate` | 库存分析报告、采购建议、应收风险预警 | 新增进销存prompt模板 |
| **预测服务** | `/api/forecast/predict` | 需求预测、销售趋势、资金计划 | **零改动** |
| **统计分析** | `/api/statistical/analyze` | ABC分析(Pareto/Gini)、供应商绩效(correlation)、库龄分布 | **零改动** |
| **钻取分析** | `/api/chat/drill-down` | 品类→供应商→批次、客户→订单→发票 | **零改动** |
| **根因分析** | `/api/chat/root-cause` | "为什么库存周转率下降"、"为什么应收增加" | **零改动** |
| **跨期对比** | `/api/smartbi/cross-sheet-analysis` | 月度进销存对比、多仓库汇总 | 扩展KPI关键词 |
| **行业基准** | `/api/chat/benchmark` | food_processing行业基准对比 | **零改动** |

### 2.2 Java AI能力 → 进销存场景映射

| Java能力 | 当前类 | 进销存应用 | 改动量 |
|---------|-------|-----------|--------|
| **DashScope LLM** | `DashScopeClient.chat()` | FEFO推荐理由、库存分析摘要、采购建议 | **零改动**，直接注入 |
| **Function Calling** | `DashScopeClient.chatWithTools()` | 多步AI代理（查库存→推荐→下单） | 新增Tool注册 |
| **意图路由** | `IntentExecutorServiceImpl` | "帮我生成采购建议"→InventoryHandler | 新增Handler+DB配置 |
| **AI Tool体系** | `MaterialFifoRecommendTool` 等11个 | FEFO推荐、临期预警、低库存触发 | **已有，直接可用** |
| **质检Tool** | `QualityCheckCreateTool` 等4个 | IQC/FQC创建和查询 | **已有** |
| **审批链** | `ApprovalChainService` | 盘点审批、退货审批、价格审批 | 扩展DecisionType枚举 |
| **Drools规则** | `RuleEngineService` | 临期批次自动处置规则 | 可配置但非必须 |
| **通知推送** | `NotificationService` | 临期提醒、审批通知、低库存预警 | 注入调用即可 |
| **语义缓存** | `SemanticCacheService` | 缓存重复的进销存AI查询 | **自动生效** |

### 2.3 食品知识库RAG → 进销存知识扩充

通过 `POST /api/food-kb/ingest-batch` 直接写入（零代码修改）：

| 文档 | category | 内容 |
|------|---------|------|
| FEFO操作规范 | `process` | 先到期先出库的操作流程 |
| 保质期法规汇编 | `regulation` | GB 7718预包装食品标签/GB/T 46453追溯评价 |
| 临期食品处置SOP | `sop` | 30天/7天分级处置流程+审批要求 |
| 冷链温控标准 | `standard` | GB/T 24616冷藏食品物流标准 |
| ABC库存管理 | `process` | A/B/C类物料分级策略 |

---

## 三、前端实现路径（复用模板）

### 3.1 四大屏幕模板

| 模板 | 代表文件 | 适用新屏幕 | 核心行数 |
|------|---------|-----------|---------|
| **A: 列表+状态筛选** | PurchaseOrderListScreen (161行) | 退货单列表、盘点单列表、FQC列表 | ~150行 |
| **B: 详情+明细表格** | PurchaseOrderDetailScreen (200行) | 退货单详情、收付款详情 | ~200行 |
| **C: 多Tab+KPI** | ArApOverviewScreen (861行) | 进销存统计概览、FQC统计 | ~400行 |
| **D: 状态时间轴** | TransferDetailScreen (212行) | 退货流程、FQC流程、盘点审批流 | ~200行 |

### 3.2 退货单完整实现路径（4小时估算）

```
步骤1 [30min]: returnOrderApiClient.ts
  → 复制 purchaseApiClient.ts 结构
  → 路径改为 /api/mobile/{factoryId}/return-orders
  → 类型: ReturnOrder, CreateReturnOrderRequest

步骤2 [30min]: ReturnOrderListScreen.tsx
  → 复制 PurchaseOrderListScreen.tsx (模板A)
  → STATUS_MAP: DRAFT/SUBMITTED/APPROVED/PROCESSING/COMPLETED/REJECTED
  → API: returnOrderApiClient.getOrders()

步骤3 [45min]: ReturnOrderDetailScreen.tsx
  → 复制 TransferDetailScreen.tsx (模板D)
  → STEPS: ['草稿','已提交','已审批','处理中','已完成']
  → DataTable列: 物料名/退货数量/退货原因/检验结果

步骤4 [2h]: ReturnOrderCreateScreen.tsx
  → 复制 WHInboundCreateScreen.tsx 表单结构
  → 集成 SupplierSelector(采购退) / CustomerSelector(销售退)
  → 动态明细行（DynamicItemList，需新建）

步骤5 [15min]: 注册导航
  → types/navigation.ts: 加 ReturnOrderList/Detail/Create
  → FAManagementStackNavigator.tsx: 注册3个Screen
  → FAManagementScreen.tsx: 添加GridItem入口图标
```

### 3.3 收付款表单实现路径（2小时估算）

```
步骤1 [30min]: 在 ArApOverviewScreen 的应收/应付Tab添加"新增回款"按钮
步骤2 [1.5h]: PaymentFormModal.tsx (Modal内嵌表单)
  → 字段: 客户/供应商选择, 金额, 支付方式(8种), 日期, 备注
  → API: financeApiClient.recordArPayment() / recordApPayment()
  → 复用 SupplierSelector 模式做客户选择
```

### 3.4 追溯页真实数据对接（1小时估算）

```
步骤1 [30min]: WHBatchTraceScreen.tsx
  → 删除 mock traceData/traceNodes 硬编码
  → 添加 useEffect → materialBatchApiClient 或新建 traceApiClient
  → 调用 GET /traceability/full/{batchNumber}
  → 映射返回数据到现有UI结构

步骤2 [30min]: WHRecallManageScreen.tsx
  → 同理，删除mock数据，对接后端recall API
```

---

## 四、AI增强进销存——具体场景设计

### 4.1 场景1: AI智能补货建议（复用：预测+Insight+意图路由）

```
用户在AI对话页说: "帮我生成下周采购建议"
  ↓
IntentExecutorService → REPLENISHMENT_SUGGESTION意图
  ↓
InventoryIntentHandler:
  1. 查询所有低库存物料 (MaterialBatchService.getLowStockBatches())
  2. 查询每种物料最近30天日均消耗 (usage-history)
  3. 调用Python /api/forecast/predict → 未来7天需求预测
  4. 计算: 建议采购量 = 预测需求 - 当前库存 + 安全库存
  5. 调用DashScopeClient.chat() 生成自然语言建议
  6. 返回: "建议采购清单: 猪肉200kg(当前库存50kg,预测周消耗180kg)..."
```

### 4.2 场景2: AI进销存报表（复用：图表+统计+跨期对比）

```
Java InventoryAIController:
  GET /api/mobile/{factoryId}/inventory-ai/monthly-report

流程:
  1. 从purchase_orders/sales_orders/material_batches表查本月汇总
  2. POST数据到Python /api/chart/build → 生成5张ECharts配置
     - 库存趋势line / 采购排行bar_h / 销售占比donut / 库龄bar / ABC pareto
  3. POST数据到Python /api/insight/generate → AI分析摘要
  4. POST到Python /api/statistical/analyze → 统计指标(周转率/Gini等)
  5. 组合返回 → 前端进销存报表页渲染

前端: 复用SmartBIAnalysis.vue的ECharts渲染模式，或在RN中用react-native-echarts
```

### 4.3 场景3: AI钻取分析（复用：drill-down）

```
在"进销存报表"页点击柱状图某根柱子（如"猪肉"品类）:
  ↓
前端调用: POST /api/chat/drill-down
  { dimension: "supplier_name", filter_value: "猪肉", measures: ["purchase_amount"] }
  ↓
Python返回: 按供应商分组的采购金额 + ECharts配置
  ↓
前端弹出Drawer显示（复用SmartBIAnalysis的handleChartDrillDown模式）
  ↓
继续点击某供应商 → 钻取到批次级别
```

### 4.4 场景4: AI应收风险预警（复用：Insight+通知）

```
定时任务(每日):
  1. 查询所有逾期>30天的应收 (ArApService.getAging())
  2. POST到Python /api/insight/generate
     data: 账龄分段数据
     analysis_context: "应收账款管理，关注逾期风险"
  3. LLM生成风险评估: "注意: 客户A逾期60天¥50万，建议立即催收..."
  4. NotificationService.sendToRole(FINANCE_STAFF, WARNING, ...)
  5. 同时存储分析结果，供前端ArApOverview页展示
```

---

## 五、实施优先级路线图

### Phase 0: 零开发快速上线（1天）

| 任务 | 改动 | 效果 |
|------|------|------|
| 追溯页对接真实API | 替换mock→API调用 | **法规合规** |
| 召回页对接真实API | 替换mock→API调用 | **法规合规** |
| 温控页对接真实API | 替换硬编码→API | 数据真实化 |
| 出库页联动FEFO推荐 | 调用已有`/fifo/`端点 | **食品行业核心** |
| 知识库写入进销存文档 | 调用ingest API | AI问答增强 |

### Phase 1: 核心业务闭环（1周）

| 任务 | 前端 | 后端 | AI复用 |
|------|------|------|--------|
| 退货单(采购+销售) | 4h(模板复制) | 3天(新建Controller) | — |
| 收付款表单 | 2h(Modal表单) | **零**(API已有) | — |
| FEFO排序 | 小(展示排序) | 小(Service加ORDER BY) | — |
| AR/AP自动挂账 | 无 | 小(Service注入) | — |
| 进销存意图扩展 | 无 | 小(DB配置+Handler) | 意图路由复用 |

### Phase 2: AI增强报表（1周）

| 任务 | 前端 | 后端 | AI复用 |
|------|------|------|--------|
| 进销存月报(5张图+AI摘要) | 中(ECharts页) | 小(查询+转发Python) | 图表+Insight+统计 |
| AI补货建议 | 小(结果展示) | 中(Handler逻辑) | 预测+LLM |
| 应收风险AI预警 | 小(通知展示) | 小(定时任务) | Insight+通知 |
| 库存ABC分析 | 中(图表页) | 小(查询转发) | Pareto统计 |

### Phase 3: 管理增强（2周）

| 任务 | 前端 | 后端 | AI复用 |
|------|------|------|--------|
| 盘点工作流+审批 | 中(3屏幕) | 中(Controller+审批链) | 审批链复用 |
| 价格表创建/编辑 | 中(表单) | **零**(API已有) | — |
| FQC出厂检验 | 中(2屏幕) | 小(质检API已有) | 质检Tool复用 |
| 进销存钻取分析 | 中(Drawer) | 小(转发Python) | drill-down复用 |
| 台账导出 | 小(按钮) | 小(export已有) | — |

---

## 六、关键代码文件索引

### 后端（可直接复用）

| 能力 | 关键文件 |
|------|---------|
| LLM调用 | `ai/client/DashScopeClient.java` |
| 意图路由 | `service/impl/IntentExecutorServiceImpl.java` |
| AI Tool注册 | `ai/tool/impl/material/Material*Tool.java` (11个) |
| 审批链 | `service/ApprovalChainService.java` |
| 通知推送 | `service/NotificationService.java` |
| 采购API | `controller/inventory/PurchaseController.java` |
| 销售API | `controller/inventory/SalesController.java` |
| 库存API | `controller/MaterialBatchController.java` (26端点) |
| 财务API | `controller/finance/ArApController.java` |
| 追溯API | `controller/TraceabilityController.java` |
| 质检处置 | `controller/QualityDispositionController.java` |
| 价格表 | `controller/inventory/PriceListController.java` |

### 前端（模板源）

| 模板 | 文件 |
|------|------|
| 列表+筛选 | `screens/factory-admin/inventory/PurchaseOrderListScreen.tsx` |
| 详情+明细 | `screens/factory-admin/inventory/PurchaseOrderDetailScreen.tsx` |
| 多Tab+KPI | `screens/factory-admin/inventory/ArApOverviewScreen.tsx` |
| 状态时间轴 | `screens/factory-admin/inventory/TransferDetailScreen.tsx` |
| 创建表单 | `screens/warehouse/inbound/WHInboundCreateScreen.tsx` |
| 供应商选择器 | `components/common/SupplierSelector.tsx` |
| API客户端模式 | `services/api/purchaseApiClient.ts` |

### Python AI（零改动可用）

| 能力 | 端点 |
|------|------|
| 图表构建(18种) | `POST /api/chart/build` |
| AI洞察 | `POST /api/insight/generate` |
| 时序预测 | `POST /api/forecast/predict` |
| 统计分析 | `POST /api/statistical/analyze` |
| 钻取分析 | `POST /api/chat/drill-down` |
| 根因分析 | `POST /api/chat/root-cause` |
| 知识库RAG | `POST /api/food-kb/query` |

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (Java后端能力 / RN前端模式 / Python AI服务)
- Total source files explored: 80+ (32 Java tools, 24 RN screens, 24 Python modules)
- Key discovery: 追溯/召回后端API已完整实现，前端用mock数据是最大浪费
- Phases completed: Research (parallel) → Manager Integration
