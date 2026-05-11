# Feature Flag: A5 Cross-Factory Sales (集团联销)

**Date**: 2026-05-10
**PR**: #309 A5=C (Steve approved long-term)
**Status**: Shipped infrastructure — default disabled, future-activatable via config

---

## Background

Cretas 销售订单 (Sales Order, SO) 当前实现 **单工厂语义**：SO 的库存匹配 / 预留只在 `SO.factoryId` 所在工厂的成品批次中进行。来源：

- `InventoryMatchingService.checkAvailability(factoryId, salesOrderId)` 调用 `FinishedGoodsBatchRepository.sumAvailableQuantityByProductType(factoryId, productTypeId)` — 含 factoryId 过滤
- `InventoryMatchingService.reserveStock(factoryId, productTypeId, qty)` 调用 `FinishedGoodsBatchRepository.findAvailableBatches(factoryId, productTypeId)` — 含 factoryId 过滤

未来业务诉求：**集团联销 (cross-factory sales)** — 总仓 (WH-LOG) 下单时可以从 **多个工厂** 的成品库存中抓取参与履行。例如 D5 sales order from 总仓 可能涉及 F001 + F002 + F003 三个工厂的成品同时参与一笔 SO。

为避免未来变更 schema (新增 `factory_network` 表) 才能开启此能力，本次 PR 引入 **feature flag**，让未来激活成为 1 行 config 改动，而不是 schema migration + 代码大改。

---

## What's Shipped

### 1. Feature flag property

```properties
# application.properties / application-pg-prod.properties / application-test.properties
cretas.sales.cross-factory.enabled=false  # 默认关闭, 保持当前单厂语义
```

生产环境 (`application-pg-prod.properties`) 通过 env var 控制：

```properties
cretas.sales.cross-factory.enabled=${CROSS_FACTORY_SALES_ENABLED:false}
```

启用方式（未来）：

```bash
# /www/wwwroot/cretas/.env.prod
CROSS_FACTORY_SALES_ENABLED=true
```

然后 `systemctl restart cretas-backend`。

### 2. Repository extensions

`FinishedGoodsBatchRepository` 新增两个 "AllFactories" 方法（跳过 factoryId 过滤）：

- `sumAvailableQuantityByProductTypeAllFactories(productTypeId)` — 跨工厂可用总量
- `findAvailableBatchesAllFactories(productTypeId)` — 跨工厂 FEFO 批次列表

原 `sumAvailableQuantityByProductType(factoryId, productTypeId)` 和 `findAvailableBatches(factoryId, productTypeId)` **保持原样不动**。

### 3. Service gate

`InventoryMatchingService` 注入 `@Value("${cretas.sales.cross-factory.enabled:false}")` 字段，在两个查询调用点用三元运算符切换：

```java
BigDecimal available = crossFactoryEnabled
        ? finishedGoodsBatchRepository
                .sumAvailableQuantityByProductTypeAllFactories(item.getProductTypeId())
        : finishedGoodsBatchRepository
                .sumAvailableQuantityByProductType(factoryId, item.getProductTypeId());
```

```java
List<FinishedGoodsBatch> batches = crossFactoryEnabled
        ? finishedGoodsBatchRepository.findAvailableBatchesAllFactories(productTypeId)
        : finishedGoodsBatchRepository.findAvailableBatches(factoryId, productTypeId);
```

### 4. Tests

`InventoryMatchingServiceCrossFactoryFlagTest` (5 tests) — 用反射设置 `crossFactoryEnabled` 字段，验证：

- flag=false: `checkAvailability` 调用 factory-filtered query, never all-factories
- flag=true: `checkAvailability` 调用 all-factories query, never factory-filtered
- flag=false: `reserveStock` 同上
- flag=true: `reserveStock` 同上
- flag=true 端到端: FEFO 从多工厂批次池中按返回顺序预留 (F002 batch 全用 + F003 batch 部分用)

---

## How to Enable (Future)

1 行 config 改动 + 重启：

```bash
# 在 47.100.235.168 服务器
ssh root@47.100.235.168
echo 'CROSS_FACTORY_SALES_ENABLED=true' >> /www/wwwroot/cretas/.env.prod
systemctl restart cretas-backend
```

或本地开发：

```bash
# 在 application-pg.properties 加入
cretas.sales.cross-factory.enabled=true
```

启用后立即生效：

- 所有 `checkAvailability(factoryId, soId)` 调用会查询所有工厂的池子
- 所有 `reserveStock(factoryId, productTypeId, qty)` 会跨工厂 FEFO 预留

---

## Future Migration Path (factory_network table)

当客户实际有"销售组织受控的跨工厂"诉求（而非"所有工厂一个池"）时，需要：

1. **新增 `factory_network` 表**

   ```sql
   CREATE TABLE factory_network (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       parent_factory_id VARCHAR(191) NOT NULL,
       member_factory_id VARCHAR(191) NOT NULL,
       network_type VARCHAR(32) NOT NULL,  -- 'SALES_ORG' / 'GROUP_POOL' / ...
       active BOOLEAN DEFAULT true,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW(),
       deleted_at TIMESTAMP NULL,
       UNIQUE (parent_factory_id, member_factory_id, network_type)
   );
   ```

2. **替换 repository 查询**

   把 `findAvailableBatchesAllFactories(productTypeId)` 的 JPQL 从：

   ```jpql
   SELECT b FROM FinishedGoodsBatch b WHERE b.productTypeId = :productTypeId ...
   ```

   改为：

   ```jpql
   SELECT b FROM FinishedGoodsBatch b WHERE b.productTypeId = :productTypeId
   AND b.factoryId IN (SELECT n.memberFactoryId FROM FactoryNetwork n
                       WHERE n.parentFactoryId = :soFactoryId AND n.active = true)
   ...
   ```

3. **方法签名改为接收 soFactoryId**

   ```java
   List<FinishedGoodsBatch> findAvailableBatchesInNetwork(
           @Param("soFactoryId") String soFactoryId,
           @Param("productTypeId") String productTypeId);
   ```

   `InventoryMatchingService` 调用点改为传入 `factoryId`（SO.factoryId）。

无需新加 feature flag — `cretas.sales.cross-factory.enabled` 沿用即可。

---

## Tradeoffs

### Why default false?

- **0 客户** 当前用集团联销 — 改 default 会引入未经验证的库存语义变化（可能误把 F002 的成品分给 F001 的订单）
- **schema 不动** — `factory_network` 表暂不引入，避免迁移负担
- **回滚成本最低** — 出问题改 config 1 行即可

### Why store the "All Factories" queries even if flag=false?

- Repository 方法不会"自动执行" — 仅当 service 端 `crossFactoryEnabled=true` 时才被调用
- 默认 false 时 dead code（JPQL 静态校验通过、bytecode 存在、运行时永不命中）— 无任何业务风险
- 这正是 "feature flag infrastructure shipped, default disabled" 的核心契约：未来激活时 1 行 config，不是 schema migration

### What does flag=true do RIGHT NOW (without factory_network)?

**等价于"集团池"语义** — 完全跳过 factoryId 过滤，所有 `AVAILABLE` 状态的批次都参与匹配。
适合的客户场景：

- 单一集团 / 总仓统一调度所有工厂库存
- 暂无销售组织 / 子集团 受控诉求

不适合的客户场景：

- 多集团租户（一个 SO 不能跨集团）— 必须先引入 `factory_network` 才能开启

---

## Verification

```bash
cd backend/java/cretas-api
mvn test -Dtest='InventoryMatchingServiceCrossFactoryFlagTest'
```

预期：5 tests pass。

---

## References

- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/orchestration/InventoryMatchingService.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/inventory/FinishedGoodsBatchRepository.java`
- `backend/java/cretas-api/src/test/java/com/cretas/aims/service/orchestration/InventoryMatchingServiceCrossFactoryFlagTest.java`
- PR #309 A5=C — Steve 长期方案审批
