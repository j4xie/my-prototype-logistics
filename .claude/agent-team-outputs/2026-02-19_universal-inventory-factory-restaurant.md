# 进销存通用产品设计 — 工厂+饭店通用, 单店 vs 总部分店

**日期**: 2026-02-19
**模式**: Full (5 agents: 3×Researcher sonnet + Analyst opus + Critic opus + Integrator sonnet)

---

## Executive Summary

- **建议**: 以现有代码为基础进行渐进式通用化改造——P0 阶段扩展 Factory 表(加 type/parent_id/level), 保持 factoryId 命名不变, UI 层做业态映射; BOM/原料/供应商实体无需改动即可通用
- **置信度**: 高 (三个 Agent 一致认同核心模型通用性, Critic 挑战仅影响边缘实体设计)
- **核心风险**: InternalTransfer 跨租户库存事务复杂度被低估; 套餐(combo)场景需新建 ComboItem 而非改 BomItem
- **工期影响**: P0(Factory 扩展)=3 天; P1-P2(进销存核心)=2 周; P3(总部-分店调拨)=2 周; P4(POS/财务)=1 个月
- **投入规模**: P0-P2 低风险(局部修改); P3 中等风险(状态机+在途库存); 89 个 Controller 路径不改动

---

## Consensus & Disagreements

| 议题 | Researcher | Analyst | Critic | 最终裁决 |
|------|-----------|---------|--------|---------|
| factoryId 命名是否保留 | 89 个 Controller 硬编码, 改名成本极高 | 保持 factoryId, 语义扩展为"租户ID" | 代码层不改, 但 UI/API 文档必须做业态映射 | **保持代码层 factoryId; UI 显示"门店"/"工厂"; API 文档注明 Organization ID** |
| BOM/原料实体通用性 | BomItem 结构与菜品配方完全一致 | 无需改动 | 套餐(combo)需 BomItem 支持"产品→产品"关系, 现有结构不足 | **原料/BOM 核心通用; 套餐场景新建 ComboItem 实体, 不修改 BomItem** |
| Factory 加 parent_id | 现有 Factory 纯平面结构, 需扩展 | 加 type/parent_id/level | 需同步新增多 factoryId 聚合查询; 现有查询不受影响 | **扩展 Factory 表; 总部聚合查询用 findByFactoryIdIn, 不动现有 findByFactoryId** |
| InternalTransfer 实现 | 总部→分店调拨是核心流程 | 新建 InternalTransfer 实体 | 一次性事务不够, 需状态机(REQUESTED→SHIPPED→RECEIVED→CONFIRMED) + 在途库存 | **InternalTransfer 用状态机; 分店 RECEIVED 时才写库存; 引入 IN_TRANSIT 状态** |
| 餐饮特有功能 | 估清/套餐/加料/日清是差异点 | 通过 Factory.type 区分展示逻辑 | 套餐需 ComboItem; 估清可用 sold_out 标记; 日清可用批处理 | **分三类处理: 套餐→新实体; 估清→字段扩展; 日清→计划任务** |
| 产品分类扩展 | ProductType.productCategory 已有枚举 | 可加 DISH/COMBO/SEMI_FINISHED | 无异议 | **扩展 productCategory 枚举, 加 DISH/COMBO/SEMI_FINISHED/ADD_ON** |

---

## Detailed Analysis

### 1. 核心实体通用性评估

**80% 的实体原地通用, 20%(套餐/加料)需扩展**

| 现有实体 | 工厂语义 | 餐饮语义 | 通用? |
|---------|---------|---------|------|
| RawMaterialType | 原料类型 | 食材类型 | ✅ 100% |
| MaterialBatch | 原料批次(库存) | 食材批次(库存) | ✅ 100% |
| BomItem | 产品配方(产品→原料用量) | 菜品配方(菜品→食材用量) | ✅ 90% (套餐除外) |
| ProductType | 成品类型 | 菜品类型 | ✅ 需扩展 productCategory |
| Supplier | 原料供应商 | 食材供应商 | ✅ 100% |
| Customer | 销售客户(B2B) | 顾客/平台(B2C) | ✅ 90% |
| ShipmentRecord | 出货记录 | 外卖/配送记录 | ⚠️ productName是String |

### 2. Factory 组织树扩展

Factory 表扩展是低风险高价值改造。JWT payload 扩展为:
```json
{
  "factoryId": "HQ001",
  "accessibleFactoryIds": ["HQ001", "B001", "B002"]
}
```
总部用户可查所有分店数据, 门店用户只看自己。

### 3. 两种模式对比

**单店/单厂模式**:
- Factory.type ∈ {FACTORY, RESTAURANT}, parent_id = NULL, level = 0
- 全部进销存操作在单一 factoryId 下完成
- 现有代码无需任何改动即可支持

**总部+分店模式**:
- Factory.type ∈ {HEADQUARTERS, BRANCH, CENTRAL_KITCHEN}
- parent_id 指向上级组织, level 表示层级深度
- 总部统采: PurchaseOrder.factoryId=总部ID → InternalTransfer → 分店
- 分店自采: PurchaseOrder.factoryId=分店ID
- InternalTransfer 状态机: DRAFT→REQUESTED→APPROVED→SHIPPED→RECEIVED→CONFIRMED

### 4. InternalTransfer 状态机(总部-分店调拨)

```
DRAFT → REQUESTED → APPROVED → SHIPPED → RECEIVED → CONFIRMED
                                  ↓          ↓
                              扣源仓库    加目标仓库
                              库存减少    库存增加
```

- SHIPPED 时: 源仓库扣库存, 记录为 IN_TRANSIT
- RECEIVED 时: 目标仓库加库存, IN_TRANSIT 结束
- CANCELLED: 如果已 SHIPPED, 需回滚源仓库库存

---

## 通用数据模型

```
[Organization / Factory 组织]
  id (factoryId)
  name
  type: FACTORY | RESTAURANT | HEADQUARTERS | BRANCH | CENTRAL_KITCHEN
  parent_id → Organization.id
  level: 0=独立 1=总部 2=区域 3=门店

    ↓ 1:N (factoryId 隔离)

[RawMaterialType]    [ProductType]           [Supplier]    [Customer]
  原料/食材            产品/菜品               供应商         客户
  通用                 +DISH/COMBO/ADD_ON      通用           通用

[BomItem 配方]                    [ComboItem 套餐组合] (NEW)
  产品→原料用量                     套餐→子菜品
  工厂配方=菜品配方                  is_optional(加料)
                                   extra_price(加价)

[PurchaseOrder 采购单]            [SalesOrder 销售单]
  order_type: DIRECT|HQ_UNIFIED    channel_type: B2B|DINE_IN|TAKEOUT
  ↓                                ↓
[PurchaseOrderItem]               [SalesOrderItem]
  material_type_id                  product_type_id

[InternalTransfer 内部调拨] (NEW)  [PriceList 价格表] (NEW)
  source_factory_id → target        owner_factory_id(谁定价)
  状态机(6步)                        scope_factory_id(适用谁)
  ↓                                 product_type_id + price
[InternalTransferItem]
  MATERIAL or PRODUCT
```

---

## 需新建实体清单

| # | 实体 | 用途 | 阶段 |
|---|------|------|------|
| 1 | PurchaseOrder | 采购/进货单 | P1 |
| 2 | PurchaseOrderItem | 采购行 | P1 |
| 3 | PurchaseReceiveRecord | 入库单 | P1 |
| 4 | FinishedGoodsBatch | 成品/菜品库存 | P2 |
| 5 | SalesOrder | 销售/出餐单 | P2 |
| 6 | SalesOrderItem | 销售行 | P2 |
| 7 | SalesDelivery | 出库/配送单 | P2 |
| 8 | ComboItem | 套餐组合(产品→产品) | P2 |
| 9 | InternalTransfer | 内部调拨(总部→分店) | P3 |
| 10 | InternalTransferItem | 调拨行 | P3 |
| 11 | PriceList | 价格表(总部定价/区域调价) | P3 |

## 需修改现有实体

| 实体 | 新增字段 | 阶段 |
|------|---------|------|
| Factory | type VARCHAR(32), parent_id, level INT | P0 |
| ProductType | productCategory 扩展: +DISH/COMBO/SEMI_FINISHED/ADD_ON | P0 |
| MaterialBatch | warehouse_id, location_id (可空, 预留) | P3 |

---

## 分阶段实施

| 阶段 | 范围 | 工期 | 风险 |
|------|------|------|------|
| **P0** | Factory扩展 + ProductType枚举 + UI映射 | 3天 | 低 |
| **P1** | 采购订单 + 入库单 (复用Supplier+MaterialBatch) | 2周 | 低 |
| **P2** | 销售订单 + 出库 + 成品库存 + ComboItem | 2周 | 低-中 |
| **P3** | 总部分店 + InternalTransfer状态机 + PriceList | 2周 | 中 |
| **P4** | POS对接 + 财务应收应付 | 1月 | 中-高 |

---

## UI 层业态映射

```typescript
const ORG_TYPE_LABEL = {
  FACTORY: '工厂',
  RESTAURANT: '门店',
  HEADQUARTERS: '总部',
  BRANCH: '分店',
  CENTRAL_KITCHEN: '中央厨房'
}
```

前端所有涉及"工厂"标签的地方, 根据 `factory.type` 动态显示对应名称。

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| 核心实体(BOM/原料/批次/供应商)原地通用 | ★★★★★ | 三 Agent 全部一致 |
| factoryId 代码层保留不改 | ★★★★★ | 89个Controller实测 |
| Factory 加 type/parent_id/level | ★★★★☆ | 三者一致, JWT扩展细节需验证 |
| 套餐需新建 ComboItem | ★★★★☆ | Critic 代码验证 |
| InternalTransfer 需状态机 | ★★★★☆ | Critic 充分论证 |
| P0-P2 分阶段路线 | ★★★★☆ | 阶段边界合理 |
| PriceList 总部定价体系 | ★★★☆☆ | 多级继承复杂度未知 |

---

## Open Questions

1. **JWT 权限扩展**: 总部用户 JWT 如何携带 accessibleFactoryIds? 动态查询还是 token 编码?
2. **PriceList 多级价格继承**: 总部价 vs 区域价 vs 门店价的优先级规则?
3. **央厨生产流程**: 复用现有工厂 ProductionBatch 还是新建 WorkOrder 类型?
4. **估清与库存联动**: 餐饮"估清"触发后是否自动锁定对应 MaterialBatch?
5. **ShipmentRecord 迁移**: 现有 String productName 数据能否反查到 ProductType?
6. **多税率**: 跨省/跨境连锁是否需要 PriceList 支持多税率?
7. **在途库存报表**: InternalTransfer 实现后, 总部如何实时查看各分店在途库存?

---

## Process Note
- Mode: Full
- Researchers deployed: 3 (sonnet) — 代码通用性 / HQ-Branch架构 / 工厂vs餐饮差异
- Analyst: 1 (opus)
- Critic: 1 (opus) — challenged 5 conclusions, all resolved
- Integrator: 1 (sonnet)
- Key disagreements: 5 resolved, 0 unresolved
- Phases completed: Research → Analysis → Critique → Integration
