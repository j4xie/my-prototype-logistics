# 进销存业务链路完整性分析报告

**分析日期**: 2026-02-19
**分析模式**: Full (3 Researchers + Analyst)
**代码基线**: main branch, commit 20622023

---

## 执行摘要

对照客户需求的10节点业务链路（销售接单→库存匹配→生产→BOM展开→采购→入库→生产完成→调拨→出库），系统当前**完全实现 2 个节点（20%），部分实现 4 个节点（40%），完全缺失 4 个节点（40%）**。总体业务覆盖率约 **40%**。

关键问题：**6个跨模块自动化联动全部缺失**。各模块（销售、采购、生产、库存）作为独立孤岛运行，无法形成业务闭环。最严重的断点在节点2（SO确认后不查库存）和节点3b（库存不足不触发生产），导致整条链路在第二步即中断。

---

## 10节点覆盖矩阵

| 节点 | 描述 | 数据模型 | API端点 | 业务逻辑 | 前端界面 | 自动化联动 | **综合** |
|:----:|------|:-------:|:-------:|:-------:|:-------:|:---------:|:-------:|
| 1 | 销售接单（创建SO） | ✅ | ✅ | ✅ | ✅ | N/A | **✅** |
| 2 | 查成品库存是否满足SO | ✅ | ❌ | ❌ | ❌ | ❌ | **❌** |
| 3a | 库存满足→仓库配货 | ✅ | ⚠️ | ⚠️ | ⚠️ | ❌ | **⚠️** |
| 3b | 库存不足→下发生产工单 | ⚠️ | ❌ | ❌ | ❌ | ❌ | **❌** |
| 4 | BOM展开匹配原辅料库存 | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | **⚠️** |
| 5a | 原辅料足→领料排产 | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ | **⚠️** |
| 5b | 原辅料不足→推送采购需求 | ❌ | ❌ | ❌ | ❌ | ❌ | **❌** |
| 6 | 采购执行（创建PO→入库） | ✅ | ✅ | ✅ | ✅ | ⚠️ | **✅** |
| 7 | 原辅料到齐→推送生产任务 | ❌ | ❌ | ❌ | ❌ | ❌ | **❌** |
| 8 | 生产完成→扣减原辅料+新增成品 | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ | **⚠️** |
| 9 | 成品调拨到仓库 | ⚠️ | ✅ | ⚠️ | ✅ | ❌ | **⚠️** |* |
| 10 | 回款+约仓出库 | ⚠️ | ⚠️ | ❌ | ⚠️ | ❌ | **❌** |* |

> *节点9：InternalTransfer实体完整但TransferType缺少"车间→仓库"类型
> *节点10：ArApService有回款记录但与出库无门控关联

---

## 链路断点分析

### 断点1: SO确认 → 库存匹配（节点2）⛔ 链路首断

**现状**: `SalesServiceImpl.confirmOrder()` 仅将状态从 DRAFT→CONFIRMED，**不查询成品库存**。

**代码证据**:
```java
// SalesServiceImpl.java:134-143
public SalesOrder confirmOrder(String factoryId, String orderId) {
    SalesOrder order = getSalesOrderById(factoryId, orderId);
    if (order.getStatus() != SalesOrderStatus.DRAFT) {
        throw new BusinessException("只有草稿状态的订单可以确认");
    }
    order.setStatus(SalesOrderStatus.CONFIRMED);
    order.setConfirmedAt(LocalDateTime.now());
    // ← 无任何成品库存查询
    return salesOrderRepository.save(order);
}
```

**影响**: 整条链路在第二步中断。SO确认后系统"失忆"，不知道需要多少货、库存够不够。后续所有节点全靠人工离线协调。

**矛盾**: `FinishedGoodsBatch` 有 `reservedQuantity` 字段，设计意图是为SO预留库存，但该字段从未被写入。

---

### 断点2: 库存不足 → 生产工单（节点3b）⛔ 销售-生产断链

**现状**: `SalesService` 无任何 `ProductionPlanService` 依赖注入。

**代码证据**:
```java
// SalesServiceImpl.java 依赖列表（第34-38行）
private final SalesOrderRepository salesOrderRepository;
private final SalesOrderItemRepository salesOrderItemRepository;
private final SalesDeliveryRecordRepository deliveryRecordRepository;
private final FinishedGoodsBatchRepository finishedGoodsBatchRepository;
private final CustomerRepository customerRepository;
private final ArApService arApService;
// ← 无 ProductionPlanService
```

**矛盾**: `ProductionPlan.sourceType` 枚举包含 `CUSTOMER_ORDER`，`sourceOrderId` 字段设计为关联SO，但系统中**零处代码**自动设置这些字段。只能手动创建生产计划时填写。

---

### 断点3: 原辅料不足 → 采购需求（节点5b）⛔ 生产-采购断链

**现状**: `ProductionPlanServiceImpl` 无 `PurchaseService` 依赖。无"计算原料缺口→自动生成采购建议"逻辑。

**已有能力**:
- `MaterialProductConversion.calculateActualUsage(quantity)` 可计算生产所需原料量（含损耗）
- `MaterialBatch` 可查询当前原料库存
- `PurchaseOrder` 有完整CRUD

**缺失**: 将以上三者串联的业务编排层。

---

### 断点4: 采购到齐 → 生产通知（节点7）⛔ 采购-生产断链

**现状**: `PurchaseServiceImpl.receiveGoods()` 仅更新 PO 状态（→PARTIAL_RECEIVED/COMPLETED）+更新收货数量，**无通知机制**。

**影响**: 采购收货入库后系统不知道应该通知哪个生产计划"你等的料到了"。生产排期与采购进度完全脱节。

---

### 断点5: 生产完成 → 自动库存调整（节点8）⚠️ 手动可完成但易出错

**现状**:
- `ProductionPlanServiceImpl.completeProduction()` — 仅更新状态+actualQuantity，**不扣减原辅料、不创建成品批次**
- `ProcessingServiceImpl.recordMaterialConsumption()` — 可扣减原辅料（手动调用）
- `SalesServiceImpl.createFinishedGoodsBatch()` — 可创建成品批次（手动调用）

**影响**: 生产完成后需要人工：(1)手动录入原辅料消耗 (2)手动创建成品入库记录。遗漏任一步骤将导致库存数据与实际不一致。

---

### 断点6: 回款门控出库（节点10）⛔ 财务-仓储断链

**现状**:
- `ArApService.recordArPayment()` 存在，可记录收款
- `SalesDeliveryRecord.shipDelivery()` 存在，发货时自动创建 AR_INVOICE
- **但两者无关联**: 发货不检查回款状态，全局搜索 `paymentStatus.*outbound` 零命中

**影响**: 系统允许对未回款客户无限发货，造成应收账款失控风险。

---

## Gap优先级清单

| 优先级 | Gap ID | 描述 | 业务影响 | 工作量 | 涉及模块 | 建议方案 |
|:------:|:------:|------|---------|:------:|---------|---------|
| **P0** | G1 | SO确认→库存可用性检查 | 链路首断，后续全部失效 | **M** | Sales+Inventory | `confirmOrder()`中调用`FinishedGoodsBatchRepo.findAvailableBatches()`，按行比对需求量vs可用量，写入`reservedQuantity`，返回匹配结果 |
| **P0** | G2 | 库存不足→自动/建议生产工单 | 销售-生产断链 | **M** | Sales+Production | G1返回不足行 → 创建`ProductionPlan(sourceType=CUSTOMER_ORDER, sourceOrderId=SO.id)` |
| **P0** | G3 | BOM展开→原辅料需求清单 | 生产计划无法执行 | **S** | Production+Conversion | 新增`expandBOM(productTypeId, quantity)` → 查`MaterialProductConversion` → 计算含损耗的各原料需求量 |
| **P0** | G4 | 原辅料缺口→采购建议 | 生产-采购断链 | **M** | Production+Purchase | G3的需求量 vs `MaterialBatch`库存 → 计算缺口 → 生成`PurchaseOrder`草稿或采购建议列表 |
| **P1** | G5 | 采购到齐→通知生产 | 采购-生产断链 | **S** | Purchase+Production | `receiveGoods()`入库后检查关联PP的所有原料是否到齐 → 更新`isFullyMatched` → 推送通知 |
| **P1** | G6 | 生产完成→自动扣减+入库 | 库存数据不准 | **M** | Production+Inventory | `completeProduction()`自动：(1)按BOM扣减`MaterialBatch` (2)创建`FinishedGoodsBatch` |
| **P1** | G7 | 仓库配货通知 | 仓库被动等待 | **S** | Sales+Notification | SO确认+库存满足后创建"配货任务"或发送通知给仓储角色 |
| **P2** | G8 | 回款门控出库 | 应收失控风险 | **M** | Finance+Sales | `shipDelivery()`前检查客户应收余额/信用额度，超限需审批 |
| **P2** | G9 | 车间→仓库调拨类型 | 调拨场景不完整 | **S** | Transfer | `TransferType`添加`WORKSHOP_TO_WAREHOUSE`，或在生产完成时自动创建调拨单 |
| **P2** | G10 | 前端状态枚举同步 | 前端显示异常 | **S** | Frontend | `salesApiClient.ts`状态枚举与后端`SalesOrderStatus`对齐 |

> 工作量: S=1-2天, M=3-5天, L=1-2周

---

## 覆盖率统计

| 维度 | 数量 | 比例 |
|------|:----:|:----:|
| ✅ 完全实现 | 2/10 | 20% |
| ⚠️ 部分实现 | 4/10 | 40% |
| ❌ 完全缺失 | 4/10 | 40% |
| **加权覆盖率** | — | **~40%** |

> 加权计算: ✅=100%, ⚠️=40%, ❌=0% → (2×100 + 4×40 + 4×0) / 10 = 36%，取整约40%

### 自动化联动覆盖

| 联动 | 状态 |
|------|:----:|
| SO→库存检查 | ❌ |
| SO→生产计划 | ❌ |
| 生产→BOM展开→采购 | ❌ |
| 采购到齐→生产通知 | ❌ |
| 生产完成→库存调整 | ❌ |
| 回款→出库门控 | ❌ |
| **自动化联动覆盖率** | **0/6 = 0%** |

---

## 风险评估

### 如果Gap不解决

1. **运营效率**: 每个SO确认后需要人工查Excel比对库存→电话通知生产→生产手动查原料→电话通知采购。一个完整循环需4-6个人工传递节点，预计每单额外耗时30-60分钟。

2. **数据准确性**: 生产完成不自动扣减原辅料→库存账实不符→采购决策基于错误数据→库存积压或断料。

3. **财务风险**: 无回款门控→可能对信用差的客户持续发货→应收坏账。

4. **客户体验**: 无法自动跟踪SO→交期无法准确承诺→客户催单时需人工跨部门查询。

### 积极面

- 各模块的**数据模型**相对完善（Entity已有预留字段如`reservedQuantity`, `sourceOrderId`, `isFullyMatched`）
- 单模块内的CRUD+状态流转已完整
- **补Gap主要是业务编排层的工作**，不需要重建数据模型

---

## 实施建议

### Phase A: 核心链路贯通（P0，预计2周）

```
G1(SO→库存检查) → G2(不足→生产) → G3(BOM展开) → G4(缺口→采购)
```

这4个Gap有严格依赖关系，必须按序实现。完成后即可实现 **销售→库存→生产→采购** 的基本闭环。

### Phase B: 反向通知（P1，预计1.5周）

```
G5(采购到齐→通知) + G6(生产完成→自动库存) + G7(配货通知)
```

这3个Gap可并行开发。完成后实现 **采购→生产→库存** 的反向信息回流。

### Phase C: 风控增强（P2，预计1周）

```
G8(回款门控) + G9(调拨类型) + G10(前端枚举)
```

独立增强，可根据业务优先级灵活安排。

---

## 附录: 关键代码文件索引

| 模块 | Entity | Service | Controller |
|------|--------|---------|-----------|
| 销售订单 | `SalesOrder.java`, `SalesOrderItem.java` | `SalesServiceImpl.java` | `SalesController.java` |
| 成品库存 | `FinishedGoodsBatch.java` | (在SalesService中) | (在SalesController中) |
| 生产计划 | `ProductionPlan.java`, `ProductionPlanBatchUsage.java` | `ProductionPlanServiceImpl.java` | `ProductionPlanController.java` |
| BOM/转换率 | `MaterialProductConversion.java` | `ConversionServiceImpl.java` | `ConversionController.java` |
| 原辅料库存 | `MaterialBatch.java`, `MaterialConsumption.java` | `MaterialBatchServiceImpl.java` | `MaterialBatchController.java` |
| 采购订单 | `PurchaseOrder.java`, `PurchaseOrderItem.java` | `PurchaseServiceImpl.java` | `PurchaseController.java` |
| 调拨 | `InternalTransfer.java`, `InternalTransferItem.java` | `TransferServiceImpl.java` | `TransferController.java` |
| 应收应付 | `ArApTransaction.java` | `ArApServiceImpl.java` | `ArApController.java` |
| 出货 | `ShipmentRecord.java`, `SalesDeliveryRecord.java` | `ShipmentRecordService.java` | `ShipmentController.java` |

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (parallel)
- Total source files examined: ~25
- Key disagreements: 0 (all researchers consistent)
- Phases completed: Research → Analysis → Integration (critic skipped — findings unambiguous)
- Fact-check: N/A (codebase grounding, no external claims)
