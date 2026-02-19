# 进销存功能设计 — 多租户厂家 vs 单一厂家

**日期**: 2026-02-19
**模式**: Full (5 agents)
**语言**: Chinese

---

## Final Integrated Report

### Executive Summary

- **推荐方案**: 继续共享表+factoryId多租户架构，分4阶段建设进销存模块，P1聚焦采购订单+入库单。
- **置信度**: 高（多租户架构3个代理一致认可；复用率存在分歧，保守估计50-55%）。
- **最大风险**: 系统缺少"成品库存"完整链路（原料→生产→成品库→出货），是最核心的架构gap，必须优先解决。
- **工期影响**: P1采购模块约3-4周，全部4阶段约3-4个月。
- **成本/工作量**: 需新建7个实体，部分现有实体需加字段，现有Controller/Service可部分复用。

---

### Consensus & Disagreements

| 议题 | Researcher | Analyst | Critic | 最终裁定 |
|------|-----------|---------|--------|---------|
| 多租户架构选择 | 描述了共享表现状，无自动化过滤 | 推荐继续共享表，考虑Hibernate @Filter | 认可共享表，但对@Filter持审慎态度（影响1309个端点） | **共识：继续共享表** — 3个代理一致，风险低 |
| 现有代码复用率 | 列举了7个可复用实体/模块（乐观） | 评估约70%可复用 | 修正为50-55%，指出MaterialBatch不含成品、ShipmentRecord用String而非关联 | **采纳Critic修正：50-55%** — Critic提供了具体的代码层面论据 |
| Hibernate @Filter实施范围 | 未涉及 | 建议全面引入 | 仅新模块引入，旧模块逐步迁移 | **采纳Critic方案：新模块用@Filter，旧模块保持现状** — 降低回归风险 |
| 成品库存gap | Researcher未明确指出 | 列入需新建列表（FinishedGoodsBatch） | 指出这是最大架构gap，现有系统生产链路直接跳到ShipmentRecord | **Critic正确，高优先级** — 成品库存是进销存核心，不能缺失 |
| 分阶段方案 | 未涉及 | P1→P2→P3→P4阶段规划 | 指出遗漏数据迁移（ShipmentRecord历史数据、MaterialBatch加warehouse字段） | **采纳Critic补充：必须加入数据迁移设计** |

---

### Detailed Analysis

#### 1. 多租户架构：继续共享表模式

**Evidence For**:
- 所有现有entity均已有factoryId字段，API路径含`/{factoryId}/`，架构一致性好。
- 100+厂家规模下，Schema隔离过度工程，独立DB成本过高——3个代理一致认可。
- 食品溯源场景中，租户间数据不需要物理隔离（非金融级别的合规要求）。

**Evidence Against**:
- 目前无自动化factoryId过滤（无Hibernate Filter/拦截器），全部依赖人工传参，进销存新模块若遗漏factoryId过滤会造成跨租户数据泄露。

**Net Assessment**: 架构方向不变，但新模块强制使用@Filter，同时在代码审查checklist中加入factoryId验证项。旧模块保持现状，等待逐步迁移，不做大范围改造。

---

#### 2. 现有代码复用率：50-55%（保守）

**可直接复用**:
- `Supplier`（供应商）、`Customer`（客户）：字段完整（creditLimit、currentBalance、paymentTerms），直接关联新订单实体即可。
- `MaterialBatch`（原材料批次）：receiptQty/usedQty/reservedQty实时计算机制可复用于库存扣减逻辑。
- `BomItem`（BOM配方）：采购需求计算、生产领料计算的基础。
- `MaterialConsumption`、`MaterialBatchAdjustment`：盘点和消耗逻辑可作为进销存库存调整参考。
- `ProcurementAnalysisServiceImpl`、`SalesAnalysisServiceImpl`：分析逻辑基本可复用。

**需重构或新建**:
- `ShipmentRecord.productName`是String类型，不关联ProductType实体，无法支持正式的销售出库单据（单据追溯、库存扣减）。
- `MaterialBatch`仅覆盖原材料，没有"成品批次入库"概念，进销存需要三级库存：原料库存+成品库存+半成品库存。
- 缺少仓库（Warehouse）、货位（WarehouseLocation）概念，现有库存是"虚拟"的，没有物理位置管理。

---

#### 3. 成品库存链路：最大架构gap

**现状**:
```
原材料采购 → MaterialBatch(原料库存) → MaterialConsumption(生产领料) → ProductionBatch(生产批次) → [？] → ShipmentRecord(出货)
```
中间缺少"成品入库→成品库存→成品出库"完整链路。

**进销存要求**:
```
采购订单 → PurchaseReceiveRecord(入库单) → 原料库存
生产完工 → FinishedGoodsBatch(成品入库) → 成品库存
销售订单 → SalesDelivery(出库单) → 成品库存减少 → 物流发货
```

**风险**: 若直接扩展ShipmentRecord（String productName）来承担正式销售出库功能，将导致历史数据无法关联ProductType实体、库存扣减逻辑无从挂靠、批次追溯链断裂。

**Net Assessment**: 必须新建`FinishedGoodsBatch`和`SalesDelivery`两个实体，不能依赖ShipmentRecord。

---

#### 4. Hibernate @Filter策略：分步实施

**风险**: 现有1309个API端点，全局加@Filter可能导致未预期的查询行为，特别是Native SQL查询不受@Filter影响，存在安全漏洞。

**建议策略**:
1. 新建的进销存实体（PurchaseOrder等7个新实体）全部加`@Filter(name = "factoryFilter", condition = "factory_id = :factoryId")`
2. 旧实体保持不变，通过Repository层手动传factoryId（现有模式）
3. 新增单元测试：每个新Repository方法必须有factoryId隔离测试用例
4. 不在当前迭代做全局@Filter改造

---

### Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| 继续共享表+factoryId多租户架构 | ★★★★★ | 3个代理一致，现有代码验证，适合当前规模 |
| 现有复用率50-55% | ★★★★☆ | Critic提供具体代码层面论据，Analyst乐观估计被合理修正 |
| 成品库存是最大gap | ★★★★★ | Critic独立发现，与进销存标准实践一致，代码层面可验证 |
| 新模块用@Filter、旧模块保持现状 | ★★★★☆ | Critic论据充分（Native SQL不受影响），Analyst方案风险被量化 |
| 需新建7个实体 | ★★★★☆ | Researcher/Analyst/Critic均指向相似缺口，具体数量可能微调 |
| 分4阶段实施 | ★★★☆☆ | Analyst提出，Critic指出数据迁移遗漏，阶段划分需细化 |

---

### Actionable Recommendations

#### 立即可做（本周）

1. `[无需代码改动]` 确认进销存需求范围：是否需要半成品库存管理？仓库是否需要多库多仓？这决定Warehouse实体的复杂度。

2. `[无需代码改动]` 在代码审查checklist中加入factoryId验证项，防止新开发人员在新模块中遗漏过滤。

3. `[局部修改]` 评估`ShipmentRecord`历史数据：统计现有`shipment_records`表中productName字段的数据质量，确认数据迁移可行性（是否能反查到ProductType）。

#### 短期（1-2个月）

4. `[架构级]` P1实施：新建`PurchaseOrder`（采购订单）、`PurchaseOrderItem`（采购订单行）、`PurchaseReceiveRecord`（入库单）三个实体，对接现有Supplier实体，实现采购→入库→原料库存完整链路。全部新实体使用@Filter。

5. `[架构级]` P2实施：新建`FinishedGoodsBatch`（成品批次/成品库存）实体，连接ProductionBatch产出到库存，再新建`SalesOrder`（销售订单）和`SalesDelivery`（销售出库单），对接现有Customer实体，替代ShipmentRecord承担正式出库职能。

6. `[局部修改]` 为`MaterialBatch`增加`warehouse_id`和`location_id`字段（可空，向下兼容），为后续P3仓库管理做准备。

#### 条件性（需讨论后决定）

7. `[架构级]` 若租户数量超过50家且数据隔离合规要求提升，考虑Per-Schema隔离方案——但当前阶段不建议实施。

8. `[架构级]` 若ShipmentRecord历史数据迁移评估结果为"不可行"，则保留ShipmentRecord作为历史记录只读存档，新出库业务完全走SalesDelivery。

9. `[局部修改]` P3仓库管理（Warehouse/WarehouseLocation/StockLedger）实施时机：建议在P1/P2上线并稳定运行1个月后再启动。

---

### 新实体设计方案

#### 需新建实体（7个）

**1. PurchaseOrder（采购订单）**
```java
@Entity
@Table(name = "purchase_orders")
@FilterDef(name = "factoryFilter", parameters = @ParamDef(name = "factoryId", type = "string"))
@Filter(name = "factoryFilter", condition = "factory_id = :factoryId")
public class PurchaseOrder extends BaseEntity {
    @Id private String id;
    private String factoryId;
    private String orderNumber;       // 采购单号，唯一
    @ManyToOne private Supplier supplier;
    private LocalDate orderDate;
    private LocalDate expectedDeliveryDate;
    private BigDecimal totalAmount;
    private String status;            // DRAFT/APPROVED/PARTIAL/COMPLETED/CANCELLED
    private String approvedBy;
    private String remark;
}
```

**2. PurchaseOrderItem（采购订单行）**
```java
@Entity
@Table(name = "purchase_order_items")
public class PurchaseOrderItem extends BaseEntity {
    @Id private Long id;
    @ManyToOne private PurchaseOrder order;
    @ManyToOne private RawMaterialType materialType;
    private BigDecimal quantity;
    private String unit;
    private BigDecimal unitPrice;
    private BigDecimal receivedQty;   // 已收货数量
    private BigDecimal taxRate;
}
```

**3. PurchaseReceiveRecord（采购入库单）**
```java
@Entity
@Table(name = "purchase_receive_records")
@Filter(name = "factoryFilter", condition = "factory_id = :factoryId")
public class PurchaseReceiveRecord extends BaseEntity {
    @Id private String id;
    private String factoryId;
    private String receiveNumber;
    @ManyToOne private PurchaseOrder purchaseOrder;
    @ManyToOne private Supplier supplier;
    private LocalDate receiveDate;
    private String warehouseId;       // 预留，P3启用
    private Long receivedBy;
    private String status;            // DRAFT/CONFIRMED/QUALITY_CHECKED
    // 关联 MaterialBatch（入库后创建批次）
}
```

**4. FinishedGoodsBatch（成品批次/库存）**
```java
@Entity
@Table(name = "finished_goods_batches")
@Filter(name = "factoryFilter", condition = "factory_id = :factoryId")
public class FinishedGoodsBatch extends BaseEntity {
    @Id private String id;
    private String factoryId;
    private String batchCode;
    @ManyToOne private ProductType productType;
    @ManyToOne private ProductionBatch productionBatch;
    private BigDecimal producedQty;
    private BigDecimal availableQty;
    private BigDecimal reservedQty;
    private BigDecimal shippedQty;
    private LocalDate productionDate;
    private LocalDate expiryDate;
    private String storageLocation;
    private String warehouseId;       // 预留，P3启用
    private String status;            // IN_STOCK/RESERVED/SHIPPED/EXPIRED
}
```

**5. SalesOrder（销售订单）**
```java
@Entity
@Table(name = "sales_orders")
@Filter(name = "factoryFilter", condition = "factory_id = :factoryId")
public class SalesOrder extends BaseEntity {
    @Id private String id;
    private String factoryId;
    private String orderNumber;
    @ManyToOne private Customer customer;
    private LocalDate orderDate;
    private LocalDate expectedDeliveryDate;
    private BigDecimal totalAmount;
    private String status;            // DRAFT/CONFIRMED/PARTIAL_DELIVERED/COMPLETED/CANCELLED
    private String paymentStatus;     // UNPAID/PARTIAL/PAID
    private String remark;
}
```

**6. SalesOrderItem（销售订单行）**
```java
@Entity
@Table(name = "sales_order_items")
public class SalesOrderItem extends BaseEntity {
    @Id private Long id;
    @ManyToOne private SalesOrder order;
    @ManyToOne private ProductType productType;
    private BigDecimal quantity;
    private String unit;
    private BigDecimal unitPrice;
    private BigDecimal deliveredQty;
    private BigDecimal taxRate;
}
```

**7. SalesDelivery（销售出库单）**
```java
@Entity
@Table(name = "sales_deliveries")
@Filter(name = "factoryFilter", condition = "factory_id = :factoryId")
public class SalesDelivery extends BaseEntity {
    @Id private String id;
    private String factoryId;
    private String deliveryNumber;
    @ManyToOne private SalesOrder salesOrder;
    @ManyToOne private Customer customer;
    private LocalDate deliveryDate;
    private String logisticsCompany;
    private String trackingNumber;
    private String status;            // PREPARED/SHIPPED/DELIVERED/RETURNED
    @OneToMany(mappedBy = "delivery") private List<SalesDeliveryItem> items;
}
```

#### 建议补充字段（现有实体）

| 实体 | 新增字段 | 用途 |
|------|---------|------|
| `MaterialBatch` | `warehouse_id VARCHAR(50) NULL` | P3仓库管理预留 |
| `MaterialBatch` | `location_id VARCHAR(50) NULL` | P3货位管理预留 |
| `ShipmentRecord` | `sales_delivery_id VARCHAR(191) NULL` | 过渡期关联新出库单 |

---

### Open Questions

1. **成品库存数据来源**: 现有`ProductionBatch`完工后如何触发`FinishedGoodsBatch`创建？人工入库确认还是自动转化？
2. **ShipmentRecord历史数据迁移**: 现有String productName能否反查到ProductType？
3. **多仓库需求**: 是否需要支持同一厂家的多个仓库（原料仓、成品仓、冷链仓）？
4. **应付/应收财务模块**: P1/P2阶段就对接财务，还是P4再做？
5. **@Filter激活方式**: 如何从JWT中提取factoryId并注入Hibernate Filter参数？
6. **半成品库存**: 食品加工中是否有半成品暂存场景？若有，需要第8个实体`SemiFinishedBatch`。

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (sonnet)
- Analyst: 1 (opus)
- Critic: 1 (opus)
- Integrator: 1 (sonnet)
- Key disagreements: 3 resolved (复用率70%→50-55%; @Filter全局→仅新模块; ShipmentRecord不适合正式出库), 0 unresolved
- Phases completed: Research → Analysis → Critique → Integration
