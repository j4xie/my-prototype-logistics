# Sprint 3 Track-G S-LOCK-1 — Marching Order

**Dispatched**: 2026-05-16
**Target chat**: fresh Claude Code session, no prior context
**Branch**: `feature/sprint3-track-g-s-lock-1`
**Estimated effort**: 1 day (Frontend + small backend column add)
**Backlog**: `宏见竞品分析/06-宏见测试账号深度审计/28-CRETAS-PRIORITIZED-BACKLOG.md` §1.1 row 3 (P0 战略)
**Audit reference**: `宏见竞品分析/06-宏见测试账号深度审计/30-BACKLOG-STATUS-AUDIT.md` §2

## Goal

宏见销售单每行实时显示 3 维度 inventory 状态:
- **锁定** (lockedQty): 已被生产/调拨锁住的数量
- **备货** (reservedQty): 已 BomExpansion + reserve 给生产的数量
- **缺料** (shortageQty): `quantity - reservedQty` (公式)

行内显示格式: `锁:5 / 备:3 / 缺:2` (3 chip 垂直堆叠或行内 inline)

客户痛点: 销售员看销售单要切到库存页查"够不够发", 浪费时间. 一眼看缺多少自动可决策"要不要催生产 + 要不要紧急采购".

依赖: S-MRP-1 (销售→采购自动分流 #682) **已 ship**, 提供 reservedQty 数据源.

## Prerequisites done

- ✅ S-MRP-1 (Sprint2-E #682) — 销售单 审批后自动 reserve, reservedQty 计算 ready
- ✅ SalesOrderItem entity 现有: quantity, deliveredQuantity, boxQuantity (per grep verify)

## Read these files first

1. `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/SalesOrderItem.java` — 目标 entity (现有 quantity/deliveredQuantity/boxQuantity)
2. `backend/java/cretas-api/src/main/java/com/cretas/aims/service/ShortageAnalysisServiceImpl.java` — Sprint2-E 已 ship, reservedQty 来源
3. `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/material/BomExpansionTool.java` — 备货逻辑
4. `frontend/CretasFoodTrace/src/screens/sales/SalesOrderListScreen.tsx` — RN 列表渲染 (找文件名验证)
5. `web-admin/src/views/sales/SalesOrderList.vue` — Vue 列表 (找文件名验证)
6. `.claude/rules/api-response-handling.md` — 响应格式
7. `.claude/rules/database-entity-sync.md` — Flyway migration

## Concrete tasks

### Task 1 — 后端 entity 加 3 column (~1hr)

修 `SalesOrderItem.java`:

```java
@Column(name = "locked_qty")
private BigDecimal lockedQty = BigDecimal.ZERO;     // 已被锁的数量

@Column(name = "reserved_qty")
private BigDecimal reservedQty = BigDecimal.ZERO;   // 已备货的数量

// shortageQty 计算字段 — 不存数据库, 用 @Formula 或 getter
@Transient
public BigDecimal getShortageQty() {
    BigDecimal demand = this.quantity != null ? this.quantity : BigDecimal.ZERO;
    BigDecimal reserved = this.reservedQty != null ? this.reservedQty : BigDecimal.ZERO;
    BigDecimal shortage = demand.subtract(reserved);
    return shortage.signum() < 0 ? BigDecimal.ZERO : shortage;
}
```

Flyway: `backend/java/cretas-api/src/main/resources/db/migration/V20260516_02__sales_order_item_lock_columns.sql`:

```sql
ALTER TABLE sales_order_items
    ADD COLUMN locked_qty NUMERIC(15,4) DEFAULT 0 NOT NULL,
    ADD COLUMN reserved_qty NUMERIC(15,4) DEFAULT 0 NOT NULL;
```

### Task 2 — Hook 到 ShortageAnalysisServiceImpl (~2hr)

Sprint2-E (#682) ShortageAnalysisServiceImpl 已计算 reservedQty, 但目前写到独立 ShortageAnalysisResult. 现在改成 **同时写回 SalesOrderItem.reservedQty**:

```java
@Service
public class ShortageAnalysisServiceImpl {
    public ShortageAnalysisResult analyze(String factoryId, String salesOrderId) {
        var items = salesOrderItemRepository.findBySalesOrderId(salesOrderId);
        for (var item : items) {
            BigDecimal reserved = calculateReserved(item);   // BomExpansion 计算
            BigDecimal locked = calculateLocked(item);       // production_plan 锁定
            item.setReservedQty(reserved);
            item.setLockedQty(locked);
        }
        salesOrderItemRepository.saveAll(items);
        return buildResult(items);
    }
}
```

### Task 3 — Vue Web list view 显示 (~2hr)

`web-admin/src/views/sales/SalesOrderList.vue` (grep 验证文件路径) 加列:

```vue
<el-table-column label="锁/备/缺" width="120">
  <template #default="{ row }">
    <div class="lock-reserve-shortage">
      <div class="chip chip-lock">锁:{{ row.lockedQty || 0 }}</div>
      <div class="chip chip-reserve">备:{{ row.reservedQty || 0 }}</div>
      <div class="chip chip-shortage" :class="{ 'has-shortage': row.shortageQty > 0 }">
        缺:{{ row.shortageQty || 0 }}
      </div>
    </div>
  </template>
</el-table-column>
```

CSS: 3 chip 垂直堆叠, 缺料 > 0 时 chip 红色.

### Task 4 — RN list display (~2hr)

`frontend/CretasFoodTrace/src/screens/sales/SalesOrderListScreen.tsx` (grep 验证):

新组件 `<LockReserveShortageChip>` (类似 Sprint2-I StickyFooterSummary 风格):

```tsx
function LockReserveShortageChip({ item }: { item: SalesOrderItem }) {
  const shortage = (item.quantity || 0) - (item.reservedQty || 0);
  return (
    <View style={styles.chipColumn}>
      <Text style={styles.chipLock}>锁:{item.lockedQty || 0}</Text>
      <Text style={styles.chipReserve}>备:{item.reservedQty || 0}</Text>
      <Text style={[styles.chipShortage, shortage > 0 && styles.shortageRed]}>
        缺:{Math.max(0, shortage)}
      </Text>
    </View>
  );
}
```

### Task 5 — Acceptance + smoke

1. 创建销售单 quantity=10
2. ShortageAnalysisServiceImpl analyze → reservedQty=3 (BOM 计算)
3. Vue 显示 `锁:0 / 备:3 / 缺:7` (缺 7 红色)
4. RN 显示同样
5. 启动生产 plan → lockedQty=5, 再 analyze → `锁:5 / 备:3 / 缺:7`
6. canViewPriceStore 不需要 (这是 inventory 数据, 不是价格)

## Acceptance gates (DoD)

- [ ] V20260516_02 Flyway apply (prod + test)
- [ ] SalesOrderItem.reservedQty / lockedQty getter 在 JSON response 可见
- [ ] ShortageAnalysisServiceImpl 自动写回 (Sprint2-E hook)
- [ ] Vue + RN 列表都显示 3 chip (锁/备/缺)
- [ ] 缺料 > 0 时红色高亮
- [ ] 不破坏 Sprint2-E 已 ship 行为 (regression test)

## Branch + PR

```bash
git checkout -b feature/sprint3-track-g-s-lock-1
# 1 day work (1d nominal, 0.5d Claude 加速)
gh pr create --title "[Sprint3-G] S-LOCK-1 销售单行内 锁/备/缺 3 chip" --body "..."
```

## Risks + watchouts

1. **shortageQty 用 @Transient getter, 不存 DB** — JSON 序列化时要确保 Jackson 走 getter (检查 @JsonIgnore)
2. **Sprint2-E (#682) regression** — ShortageAnalysisServiceImpl 改动要确保不破现有 endpoint
3. **Flyway 编号冲突** — V20260516_01 已被 Track-F 用, Track-G 用 V20260516_02 (协调 Wave 1 三 chat 不撞号)
4. **RN list rerender 性能** — 大量销售单 list 加 chip 列后 FlatList scroll fps. 用 React.memo 优化
5. **price RBAC 隔离** — 锁/备/缺 是 inventory 数据 NOT 价格, 不需 canViewPrice 隔离 (跟 N3 RBAC Track-B1 已 ship 兼容)

## Reference

- Sprint2-E S-MRP-1 ship: `b936d19e3 [Sprint2-E] S-MRP-1 销售订单→采购自动分流 (#682)`
- Sprint2-I U-FOOTER-1 ship pattern: `a86e40bd5 [Sprint2-I] U-FOOTER-1 Sticky Footer 实时合计 (#681)`
- 宏见 deep-audit: `02-销售管理-deep-audit.md` Round 5 显示宏见行内 锁:0 备:1 缺:0 pattern

---

**Total**: 1 day. Independent — 可跟 Track-E + Track-F 完全并行. Quick win 类型 (3 chat 中最先 close).
