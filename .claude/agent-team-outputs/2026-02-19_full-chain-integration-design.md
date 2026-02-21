# 进销存 + 报工 全链路联动设计方案

**日期**: 2026-02-19
**基线**: main branch, commit 20622023

---

## 一、现有系统全景图

### 已有的"孤岛"

```
┌─────────────────────────────────────────────────────────────────┐
│                        当前系统：5个孤岛                         │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│  │  销售模块  │   │  生产模块  │   │  采购模块  │   │  仓储模块  │    │
│  │          │   │          │   │          │   │          │    │
│  │ SalesOrder│   │ PP + PB  │   │ PO + 收货 │   │ 出入库    │    │
│  │ 发货单    │   │ 工单     │   │ 退货      │   │ 调拨     │    │
│  │ 成品库存  │   │ 报工     │   │           │   │ 打包     │    │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘    │
│                                                                 │
│  ┌──────────┐                                                   │
│  │  财务模块  │   每个模块内部完整，但模块之间 ≈ 0 联动             │
│  │ AR/AP    │                                                   │
│  │ 回款/付款 │                                                   │
│  └──────────┘                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 已有的关键实体 & 预留字段

| 实体 | 关键字段 | 预留但未用的字段 | 作用 |
|------|---------|----------------|------|
| `ProductionPlan` | plannedQuantity, productTypeId | `sourceType`=CUSTOMER_ORDER, `sourceOrderId`, `allocatedQuantity`, `isFullyMatched` | 生产计划→SO关联、原料匹配状态 |
| `ProductionBatch` | actualQuantity, goodQuantity | `productionPlanId` (已用) | 报工执行→计划关联 |
| `FinishedGoodsBatch` | producedQuantity, shippedQuantity | `reservedQuantity` | 成品预留给SO |
| `MaterialProductConversion` | conversionRate, wastageRate | `calculateActualUsage()` | BOM展开计算 |
| `MaterialConsumption` | quantity, batchId | `productionPlanId` (已用) | 原辅料消耗记录 |
| `SalesDeliveryRecord` | — | — | 发货时自动创建AR_INVOICE ✅ |
| `BatchCompletedEvent` | — | — | Spring Event 已定义但**从未发布** |

### 已有的自动化钩子

| 钩子 | 位置 | 状态 |
|------|------|------|
| `schedulingService.onProductionPlanCreated()` | PP创建后异步调用 | ✅ 已工作 |
| `BatchCompletedEvent` | 定义在event包 | ❌ 从未publish |
| `arApService.recordArInvoice()` | 发货确认时调用 | ✅ 已工作 |
| `deductFinishedGoodsInventory()` | 发货确认时FIFO扣减 | ✅ 已工作（但库存不足仅warn） |

---

## 二、目标全链路：16节点闭环

```
                         ┌─── 正向链 (需求驱动) ──────────────────────────────────────┐
                         │                                                           │
   ① 创建SO ──→ ② 库存匹配 ──┬──→ ③a 满足→预留+通知仓库                                 │
                              │                                                       │
                              └──→ ③b 不足→创建PP ──→ ④ BOM展开 ──┬──→ ⑤a 料足→排产     │
                                         ↑                        │                    │
                                         │                        └──→ ⑤b 料不足→PO草稿│
                                         │                                    │        │
                         ┌─── 反向链 (完成反馈) ───────────────────────────┐     │        │
                         │                                               │     ↓        │
   ⑩ 回款门控 ←── ⑨ 发货 ←── ⑧ 通知SO ←── ⑦ 完成联动 ←── ⑥ 报工                │   ⑤c PO审批  │
       出库         扣减成品     可发货      扣料+入成品    (扫码/班组)          │    →收货    │
                                                                         │     │        │
                                                                         │     ↓        │
                                                                         │   ⑤d 到齐    │
                                                                         │   →通知PP    │
                                                                         └─────────────┘

   ⑥ = 报工环节（现有报工系统的位置）
```

### 16节点清单

| # | 节点 | 现有状态 | 涉及Service |
|---|------|---------|-------------|
| ① | 创建SO（含交期、产品、数量） | ✅ 已有 | SalesService |
| ② | SO确认→库存可用性检查 | ❌ **新增** | SalesService + FinishedGoodsBatchRepo |
| ③a | 库存满足→预留库存+创建配货任务 | ❌ **新增** | SalesService + (NotificationService) |
| ③b | 库存不足→自动创建PP(sourceType=CUSTOMER_ORDER) | ❌ **新增** | SalesService + ProductionPlanService |
| ④ | PP创建→BOM展开→计算原辅料需求 | ⚠️ 部分(有BOM表,缺展开逻辑) | **新增** ProductionMaterialService |
| ⑤a | 原辅料足→分配批次+排产 | ⚠️ 部分(手动分配有) | ProductionPlanService (增强) |
| ⑤b | 原辅料不足→生成采购建议/PO草稿 | ❌ **新增** | **新增** ProcurementSuggestionService |
| ⑤c | PO审批→收货入库 | ✅ 已有 | PurchaseService |
| ⑤d | 收货入库→检查PP原料到齐→通知 | ❌ **新增** | PurchaseService (增强) |
| ⑥ | **报工**（扫码报工/班组报工/完成生产） | ✅ 已有 | ProcessingService |
| ⑦ | 报工完成→**自动**扣减原辅料+创建成品批次 | ❌ **新增** | ProcessingService (增强) |
| ⑧ | 成品入库→通知SO"可发货" | ❌ **新增** | (NotificationService) |
| ⑨ | 发货→FIFO扣减成品库存+创建AR | ✅ 已有 | SalesService |
| ⑩ | 回款门控出库 | ❌ **新增** | SalesService + ArApService |
| ⑪ | 退货→冲减库存+冲减AR/AP | ✅ 刚实现 | ReturnOrderService |
| ⑫ | 全链路追溯（SO→PP→PB→MaterialConsumption→MaterialBatch→PO） | ⚠️ 数据在，缺串联查询 | **新增** TraceChainService |

---

## 三、报工环节在链路中的核心地位

```
                          报工是唯一的"数据采集入口"
                          ┌──────────────────────────┐
                          │                          │
    原辅料库存 ──领料──→  │  ⑥ 车间报工                │ ──→ 成品库存
    MaterialBatch         │                          │     FinishedGoodsBatch
    (扣减 usedQuantity)   │  · 扫码报工 (单人)         │     (新增 producedQuantity)
                          │  · 班组报工 (批量)         │
    生产计划 ──关联──→    │  · 动态表单报工             │ ──→ 成本核算
    ProductionPlan        │  · 拍照证据                │     (material+labor+equipment)
    (更新 actualQuantity)  │  · 质检报工                │
                          │                          │
                          └──────────────────────────┘
                                      │
                                      ↓
                            BatchCompletedEvent (现有但未发布)
                                      │
                          ┌───────────┼───────────┐
                          ↓           ↓           ↓
                    自动扣减原辅料  自动创建成品  通知SO可发货
                    (新增逻辑)     (新增逻辑)   (新增逻辑)
```

### 报工触发的联动效果

当车间主管点击「完成生产」时，系统应**自动**完成以下4步：

1. **扣减原辅料库存**
   - 从 `MaterialConsumption` 记录中汇总该批次已消耗的原辅料
   - 验证消耗量 vs `MaterialBatch.usedQuantity`（已在 `recordMaterialConsumption` 中扣减 ✅）
   - 如果报工过程中已经逐步 `recordMaterialConsumption`，则此步为确认校验

2. **创建成品入库批次**
   - 根据 `ProductionBatch.goodQuantity` 自动创建 `FinishedGoodsBatch`
   - 关联 `productTypeId`、`factoryId`
   - 设置 `producedQuantity = goodQuantity`
   - 设置批次号规则: `FG-{productCode}-{yyyyMMdd}-{NNN}`

3. **更新生产计划状态**
   - 如果该PP下所有PB都已完成 → PP状态→COMPLETED
   - 更新 `actualQuantity`（累加所有PB的goodQuantity）

4. **通知关联的SO**
   - 如果 `PP.sourceType == CUSTOMER_ORDER && PP.sourceOrderId != null`
   - 查询关联的SO，检查新增的成品是否满足SO剩余需求
   - 满足 → 更新SO状态为 PROCESSING，推送"可发货"通知给仓库

---

## 四、联动实现方案（事件驱动架构）

### 核心设计：Spring ApplicationEvent

```java
// 新增事件
SalesOrderConfirmedEvent     → 触发库存匹配
ProductionPlanCreatedEvent   → 触发BOM展开+原料检查 (复用已有的onProductionPlanCreated)
MaterialReceivedEvent        → 触发"原料到齐"检查
BatchCompletedEvent          → 触发扣料+入成品+通知SO (已有Event，需要publish)
FinishedGoodsCreatedEvent    → 触发SO可发货检查
PaymentReceivedEvent         → 触发出库授权检查
```

### 联动编排服务

```java
/**
 * 进销存+报工 全链路编排服务
 * 负责监听各模块事件，驱动跨模块联动
 */
@Service
public class SupplyChainOrchestrator {

    // ═══════════ 正向链：SO → 生产 → 采购 ═══════════

    @EventListener
    public void onSalesOrderConfirmed(SalesOrderConfirmedEvent event) {
        // ② 库存可用性检查
        StockCheckResult result = inventoryMatchingService.checkAvailability(
            event.getFactoryId(), event.getSalesOrderId());

        for (LineItemMatch match : result.getLineItems()) {
            if (match.isFullySatisfied()) {
                // ③a 满足 → 预留库存
                inventoryMatchingService.reserveStock(match);
            } else {
                // ③b 不足 → 创建生产计划
                productionPlanService.createFromSalesOrder(
                    event.getFactoryId(),
                    event.getSalesOrderId(),
                    match.getProductTypeId(),
                    match.getShortfallQuantity());
            }
        }
    }

    @EventListener
    public void onProductionPlanCreated(ProductionPlanCreatedEvent event) {
        // ④ BOM展开
        List<MaterialRequirement> requirements =
            bomExpansionService.expandBOM(event.getProductTypeId(), event.getQuantity());

        // ⑤a/⑤b 原辅料检查
        MaterialCheckResult result =
            bomExpansionService.checkMaterialAvailability(event.getFactoryId(), requirements);

        if (result.isFullySatisfied()) {
            // ⑤a 原辅料足 → 自动分配
            bomExpansionService.autoAllocateMaterials(event.getPlanId(), result);
        } else {
            // ⑤b 原辅料不足 → 生成采购建议
            procurementService.generateSuggestions(event.getFactoryId(), event.getPlanId(), result.getShortfalls());
        }
    }

    @EventListener
    public void onMaterialReceived(MaterialReceivedEvent event) {
        // ⑤d 检查关联PP的原料是否到齐
        List<ProductionPlan> waitingPlans =
            productionPlanRepository.findByFactoryIdAndIsFullyMatchedFalse(event.getFactoryId());

        for (ProductionPlan plan : waitingPlans) {
            boolean allReady = bomExpansionService.recheckAvailability(plan);
            if (allReady) {
                plan.setIsFullyMatched(true);
                productionPlanRepository.save(plan);
                // 通知：原料到齐，可以开始生产
                notificationService.notifyMaterialReady(plan);
            }
        }
    }

    // ═══════════ 反向链：报工 → 成品 → SO → 出库 ═══════════

    @EventListener
    public void onBatchCompleted(BatchCompletedEvent event) {
        ProductionBatch batch = event.getBatch();

        // ⑦ 自动创建成品批次
        if (batch.getGoodQuantity() != null && batch.getGoodQuantity().compareTo(BigDecimal.ZERO) > 0) {
            FinishedGoodsBatch fgBatch = finishedGoodsService.createFromProductionBatch(batch);

            // ⑧ 检查关联SO是否可发货
            if (batch.getProductionPlanId() != null) {
                ProductionPlan plan = productionPlanRepository.findById(batch.getProductionPlanId().toString()).orElse(null);
                if (plan != null && plan.getSourceOrderId() != null) {
                    salesOrderService.checkAndNotifyReadyToShip(plan.getSourceOrderId());
                }
            }
        }
    }

    @EventListener
    public void onPaymentReceived(PaymentReceivedEvent event) {
        // ⑩ 检查是否有等待回款的SO
        salesOrderService.checkPaymentGateForPendingDeliveries(
            event.getFactoryId(), event.getCounterpartyId());
    }
}
```

---

## 五、需要新增 / 修改的文件清单

### 新增文件 (7个)

| # | 文件 | 类型 | 职责 |
|---|------|------|------|
| 1 | `service/orchestration/SupplyChainOrchestrator.java` | Service | 全链路事件编排 |
| 2 | `service/orchestration/InventoryMatchingService.java` | Service | SO↔成品库存匹配+预留 |
| 3 | `service/orchestration/BomExpansionService.java` | Service | BOM展开+原辅料需求计算+可用性检查 |
| 4 | `service/orchestration/ProcurementSuggestionService.java` | Service | 原辅料缺口→采购建议 |
| 5 | `event/SalesOrderConfirmedEvent.java` | Event | SO确认事件 |
| 6 | `event/MaterialReceivedEvent.java` | Event | 原辅料入库事件 |
| 7 | `event/FinishedGoodsCreatedEvent.java` | Event | 成品入库事件 |

### 修改文件 (6个)

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `SalesServiceImpl.java` | `confirmOrder()` 中 publish `SalesOrderConfirmedEvent`；新增 `checkAndNotifyReadyToShip()`、`checkPaymentGateForPendingDeliveries()` |
| 2 | `ProductionPlanServiceImpl.java` | `createProductionPlan()` 新增 `createFromSalesOrder()` 便捷方法；`completeProduction()` 中检查PP下所有PB完成则PP→COMPLETED |
| 3 | `ProcessingServiceImpl.java` | `completeProduction()` 末尾 publish `BatchCompletedEvent`（已有Event类，只需加一行publish） |
| 4 | `PurchaseServiceImpl.java` | `receiveGoods()` 末尾 publish `MaterialReceivedEvent` |
| 5 | `SalesServiceImpl.java` | `deductFinishedGoodsInventory()` 库存不足从 warn 改为 throw BusinessException |
| 6 | `FinishedGoodsBatchRepository.java` | 新增 `sumAvailableByProductTypeId()` 聚合查询 |

### 不需要修改的文件（已有能力复用）

| 能力 | 文件 | 说明 |
|------|------|------|
| BOM数据 | `MaterialProductConversion.java` | 已有 conversionRate + calculateActualUsage() |
| 原料扣减 | `ProcessingServiceImpl.recordMaterialConsumption()` | 已有完整逻辑 |
| 成品FIFO出库 | `SalesServiceImpl.deductFinishedGoodsInventory()` | 已有FIFO扣减 |
| AR自动记账 | `SalesServiceImpl.shipDelivery()` → arApService | 已有联动 |
| 自动排产 | `SchedulingServiceImpl.onProductionPlanCreated()` | 已有异步钩子 |
| PO完整流程 | `PurchaseServiceImpl` | CRUD+状态流+收货 |

---

## 六、各Gap的具体实现方案

### Gap G1: SO确认→库存可用性检查

```java
// InventoryMatchingService.java
public StockCheckResult checkAvailability(String factoryId, String salesOrderId) {
    SalesOrder so = salesOrderRepository.findById(salesOrderId).orElseThrow();
    List<LineItemMatch> matches = new ArrayList<>();

    for (SalesOrderItem item : so.getItems()) {
        // 查询该产品的可用成品总量
        BigDecimal available = finishedGoodsBatchRepository
            .sumAvailableQuantityByProductType(factoryId, item.getProductTypeId());

        BigDecimal pending = item.getPendingQuantity(); // 需求量 - 已发量
        BigDecimal shortfall = pending.subtract(available).max(BigDecimal.ZERO);

        matches.add(new LineItemMatch(item.getProductTypeId(), pending, available, shortfall));
    }

    return new StockCheckResult(salesOrderId, matches);
}

// 预留库存
public void reserveStock(String factoryId, String salesOrderId, String productTypeId, BigDecimal quantity) {
    List<FinishedGoodsBatch> batches = finishedGoodsBatchRepository
        .findAvailableBatches(factoryId, productTypeId); // FEFO排序

    BigDecimal remaining = quantity;
    for (FinishedGoodsBatch batch : batches) {
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;
        BigDecimal available = batch.getAvailableQuantity();
        BigDecimal reserve = remaining.min(available);

        batch.setReservedQuantity(batch.getReservedQuantity().add(reserve)); // 终于用上了这个字段!
        finishedGoodsBatchRepository.save(batch);
        remaining = remaining.subtract(reserve);
    }
}
```

### Gap G3: BOM展开

```java
// BomExpansionService.java
public List<MaterialRequirement> expandBOM(String factoryId, String productTypeId, BigDecimal productionQuantity) {
    // 查所有 "materialType → productType" 的转换率
    List<MaterialProductConversion> conversions =
        conversionRepository.findByFactoryIdAndProductTypeIdAndIsActiveTrue(factoryId, productTypeId);

    List<MaterialRequirement> requirements = new ArrayList<>();
    for (MaterialProductConversion conv : conversions) {
        // 含损耗的实际需求量
        BigDecimal required = conv.calculateActualUsage(productionQuantity);
        requirements.add(new MaterialRequirement(
            conv.getMaterialTypeId(),
            required,
            conv.getWastageRate()
        ));
    }
    return requirements;
}

// 检查原辅料可用性
public MaterialCheckResult checkMaterialAvailability(String factoryId, List<MaterialRequirement> requirements) {
    List<MaterialShortfall> shortfalls = new ArrayList<>();
    boolean allSatisfied = true;

    for (MaterialRequirement req : requirements) {
        BigDecimal available = materialBatchRepository
            .sumAvailableByMaterialTypeId(factoryId, req.getMaterialTypeId());

        if (available.compareTo(req.getRequiredQuantity()) < 0) {
            allSatisfied = false;
            shortfalls.add(new MaterialShortfall(
                req.getMaterialTypeId(),
                req.getRequiredQuantity(),
                available,
                req.getRequiredQuantity().subtract(available)
            ));
        }
    }

    return new MaterialCheckResult(allSatisfied, shortfalls);
}
```

### Gap G6 (最关键): 报工完成→自动联动

```java
// ProcessingServiceImpl.java — 修改 completeProduction()
public ProductionBatch completeProduction(String factoryId, String batchId,
                                          BigDecimal actualQuantity,
                                          BigDecimal goodQuantity,
                                          BigDecimal defectQuantity) {
    // ... 现有逻辑保持不变 ...
    batch.setStatus(ProductionBatchStatus.COMPLETED);
    batch.setEndTime(LocalDateTime.now());
    batch.setActualQuantity(actualQuantity);
    batch.setGoodQuantity(goodQuantity);
    batch.setDefectQuantity(defectQuantity);
    batch.calculateMetrics();
    ProductionBatch saved = productionBatchRepository.save(batch);

    // ★ 新增：发布 BatchCompletedEvent（已有Event类，之前从未publish）
    applicationEventPublisher.publishEvent(new BatchCompletedEvent(this, saved));

    return saved;
}

// SupplyChainOrchestrator — 监听 BatchCompletedEvent
@EventListener
@Transactional
public void onBatchCompleted(BatchCompletedEvent event) {
    ProductionBatch batch = event.getBatch();

    // 1. 自动创建成品批次
    if (batch.getGoodQuantity() != null && batch.getGoodQuantity().compareTo(BigDecimal.ZERO) > 0) {
        FinishedGoodsBatch fg = new FinishedGoodsBatch();
        fg.setFactoryId(batch.getFactoryId());
        fg.setProductTypeId(batch.getProductTypeId());
        fg.setProducedQuantity(batch.getGoodQuantity());
        fg.setBatchNumber(generateFGBatchNumber(batch));
        fg.setProductionDate(LocalDate.now());
        // 过期日期从ProductType配置获取
        fg.setStatus("AVAILABLE");
        finishedGoodsBatchRepository.save(fg);
    }

    // 2. 更新关联的ProductionPlan
    if (batch.getProductionPlanId() != null) {
        String planId = batch.getProductionPlanId().toString();
        ProductionPlan plan = productionPlanRepository.findById(planId).orElse(null);
        if (plan != null) {
            // 累加实际产量
            BigDecimal totalActual = plan.getActualQuantity() != null ? plan.getActualQuantity() : BigDecimal.ZERO;
            plan.setActualQuantity(totalActual.add(batch.getGoodQuantity()));

            // 检查是否所有PB都完成了
            boolean allDone = productionBatchRepository
                .countByProductionPlanIdAndStatusNot(batch.getProductionPlanId(), ProductionBatchStatus.COMPLETED) == 0;
            if (allDone) {
                plan.setStatus(ProductionPlanStatus.COMPLETED);
            }
            productionPlanRepository.save(plan);

            // 3. 如果PP来自SO → 通知SO可发货
            if (plan.getSourceOrderId() != null && PlanSourceType.CUSTOMER_ORDER == plan.getSourceType()) {
                applicationEventPublisher.publishEvent(
                    new FinishedGoodsCreatedEvent(this, batch.getFactoryId(), plan.getSourceOrderId()));
            }
        }
    }
}
```

---

## 七、全链路数据流追溯

报工完成后，系统可以从任意节点追溯完整链路：

```
TraceChainService.traceFromSalesOrder(salesOrderId):

SalesOrder (SO-20260219-0001)
  └─ 客户: 永辉超市
  └─ 产品: 麻辣火锅底料 × 500kg
  └─ 状态: PROCESSING
  │
  ├─ 库存匹配结果:
  │   ├─ 成品可用: 200kg (3批次)
  │   └─ 缺口: 300kg → 生产计划 PP-20260219-001
  │
  ├─ ProductionPlan (PP-20260219-001)
  │   ├─ sourceType: CUSTOMER_ORDER
  │   ├─ sourceOrderId: SO-20260219-0001
  │   ├─ plannedQuantity: 300kg
  │   │
  │   ├─ BOM展开:
  │   │   ├─ 牛油 180kg (转换率0.6, 损耗5%)
  │   │   ├─ 辣椒粉 45kg (转换率0.15)
  │   │   └─ 花椒 30kg (转换率0.10)
  │   │
  │   ├─ 原辅料检查:
  │   │   ├─ 牛油: 库存150kg, 缺口30kg → PO-20260219-003
  │   │   ├─ 辣椒粉: 库存80kg ✅
  │   │   └─ 花椒: 库存50kg ✅
  │   │
  │   ├─ PurchaseOrder (PO-20260219-003)
  │   │   ├─ 牛油 × 30kg @ ¥25/kg
  │   │   ├─ 状态: COMPLETED (已收货)
  │   │   └─ 收货批次: MB-20260220-007
  │   │
  │   ├─ ProductionBatch (PB-001) ← 报工入口
  │   │   ├─ 车间: 一号生产线
  │   │   ├─ 负责人: 王工
  │   │   ├─ 实际产量: 310kg, 良品: 305kg, 不良: 5kg
  │   │   ├─ 良品率: 98.39%
  │   │   ├─ MaterialConsumption: [牛油182kg, 辣椒粉46kg, 花椒31kg]
  │   │   └─ → 自动创建 FinishedGoodsBatch (FG-HLGD-20260221-001, 305kg)
  │   │
  │   └─ 完成 → 通知SO可发货
  │
  ├─ SalesDeliveryRecord (发货)
  │   ├─ 发货 500kg (200kg旧库存 + 300kg新生产)
  │   ├─ → FIFO扣减成品库存
  │   └─ → 自动创建 AR_INVOICE ¥75,000
  │
  └─ ArApTransaction
      ├─ AR_INVOICE: ¥75,000 (应收)
      └─ AR_PAYMENT: ¥75,000 (已回款) → 确认出库
```

---

## 八、实施路线图

### Phase A: 事件基础设施 + 核心正向链（~2周）

**Week 1:**
1. 新建 `SupplyChainOrchestrator.java` 空壳
2. 新建 3 个 Event 类（SalesOrderConfirmedEvent, MaterialReceivedEvent, FinishedGoodsCreatedEvent）
3. 实现 `InventoryMatchingService`（G1: SO→库存检查+预留）
4. 修改 `SalesServiceImpl.confirmOrder()` 发布事件
5. 实现 `SupplyChainOrchestrator.onSalesOrderConfirmed()` → 库存不足→创建PP

**Week 2:**
6. 实现 `BomExpansionService`（G3: BOM展开+原料检查）
7. 实现 `ProcurementSuggestionService`（G4: 缺口→采购建议/PO草稿）
8. 修改 `PurchaseServiceImpl.receiveGoods()` 发布 MaterialReceivedEvent
9. 实现 `onMaterialReceived()` → 检查PP原料到齐（G5）

### Phase B: 报工联动（~1.5周）

**Week 3:**
10. 修改 `ProcessingServiceImpl.completeProduction()` 发布 `BatchCompletedEvent`（一行代码）
11. 实现 `onBatchCompleted()` → 自动创建成品+更新PP+通知SO（G6）
12. 实现 `SalesServiceImpl.checkAndNotifyReadyToShip()`（G7/G8）
13. 修改 `deductFinishedGoodsInventory()` 库存不足抛异常

**Week 3.5:**
14. 实现回款门控 `checkPaymentGateForPendingDeliveries()`（G8）
15. 前端：SO详情页增加"库存匹配状态"卡片
16. 前端：PP详情页增加"原料齐备状态"卡片

### Phase C: 前端可视化 + 全链路追溯（~1周）

17. `TraceChainService` → 从SO/PP/PB/PO任意入口追溯全链
18. 前端：全链路追溯可视化组件
19. 前端：仓库配货任务列表（接收来自SupplyChainOrchestrator的通知）

---

## 九、关键设计决策

### Q1: 报工环节原辅料消耗的时机？

**现状**: 车间主管在报工过程中手动调用 `recordMaterialConsumption()`，逐步记录消耗。

**建议**: 保持现有的"逐步记录"模式不变，但在 `completeProduction()` 时做**校验**：
- 汇总该PB所有 MaterialConsumption 的总量
- 对比 BOM 展开的理论用量
- 差异超过 10% → 警告（不阻断，因为实际生产有合理偏差）
- 差异超过 30% → 阻断，要求主管确认

### Q2: 自动创建PP还是采购建议？

**建议**: 默认创建**PP草稿**(PENDING状态)，需要调度员/厂长确认后才排产。原因：
- 生产排期涉及产能、设备维护、人员排班
- 自动排产可能打乱现有计划
- `SchedulingService.onProductionPlanCreated()` 已有异步自动排产逻辑

### Q3: 回款门控的严格程度？

**建议**: 分级门控：
- 客户信用额度 < 50% → 正常发货
- 客户信用额度 50-80% → 提示风险，需仓管确认
- 客户信用额度 > 80% → 阻断，需财务审批
- 信用额度 = 客户应收余额 / 客户信用限额

### Q4: 事件同步 vs 异步？

**建议**:
- `SalesOrderConfirmedEvent` → **同步** `@TransactionalEventListener(phase = AFTER_COMMIT)` → 用户看到确认结果时就知道库存匹配情况
- `BatchCompletedEvent` → **异步** `@Async` → 不阻塞报工流程，成品入库在后台完成
- `MaterialReceivedEvent` → **异步** `@Async` → 不阻塞收货流程

---

## 十、并行工作建议

### Subagent 并行: ✅ 适合
- Phase A 中 InventoryMatchingService 和 BomExpansionService 可并行开发（不共享文件）
- Phase B 中 报工联动(后端) 和 前端UI(回款门控) 可并行

### 多Chat并行: ✅ 适合
- Chat 1: Java 后端 (SupplyChainOrchestrator + Events + Services)
- Chat 2: RN 前端 (SO详情库存卡片 + PP原料状态 + 配货任务列表)
- 冲突风险: 低（前后端独立文件）
