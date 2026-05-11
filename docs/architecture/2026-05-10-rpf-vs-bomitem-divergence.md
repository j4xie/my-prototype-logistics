# RPF (MaterialProductConversion) vs BomItem 共存说明

**Decided**: 2026-05-10 customer meeting (Steve + customer)
**Status**: Path A (document only) — Path B (reconciliation) deferred, pending Steve sign-off
**PR**: 本 doc 关联 PR #288 §D4 implementation plan
**Owner**: Cretas Team

---

## 1. 背景

Cretas 系统中存在两套"原料-成品配方"数据模型, 长期并存但走两条独立代码路径:

| 字段命名 | 概念 | 数据表 | 实体类 |
|---|---|---|---|
| 转换率 (旧字段, 简称 **RPF** — Rate Per Factor) | 单一原料 → 单一成品「出成率」 | `material_product_conversions` | `MaterialProductConversion` (`entity/MaterialProductConversion.java:34`) |
| BOM (新字段) | 多原料组合配方 + 成本拆分 + 含税率 / 出成率% | `bom_items` | `BomItem` (`entity/bom/BomItem.java:29`) |

**客户原话** (2026-05-10 meeting transcript line 29):

> 转换率就是你单个原料类型的转换 ⋯ 这个其实是之前就是最早期那个版本, 就是原来的 BOOM, 是我把设计生转换率的。但其实就是原本的 RPF 足足足足够了。但是我还是先留下来 ⋯ 因为刚刚的功能其实有重叠的嘛。

---

## 2. 当前共存现状 (隐藏分歧)

⚠️ **客户在 BOM 页面录入的配方数据, 不被生产计划展开使用** — 客户输入有效但 silent ignored, 生产计划展开走的是 RPF 表。

| Layer | 实现 | 数据源 |
|---|---|---|
| **客户填写入口 (Vue)** | `web-admin/src/views/production/bom/index.vue:619` BOM 成本管理 tab | 写入 `bom_items` 表 |
| **写入 service** | `BomServiceImpl.saveBomItem()` (`service/impl/BomServiceImpl.java:117`) | `bom_items` 表 |
| **生产计划 BOM 展开** | `BomExpansionService.expandBOM()` (`service/orchestration/BomExpansionService.java:51-80`) | ⚠️ 读 `material_product_conversions` 表 (RPF), **不读 `bom_items`** |
| **客户填入口 (替代)** | `web-admin/src/views/production/conversions/index.vue:184` 转换率配置 | 写入 `material_product_conversions` 表 |

**数据流分歧示意**:

```
[客户在 BOM 页面录入]
       ↓
   BomServiceImpl.saveBomItem()
       ↓
   bom_items 表
       ❌ (不被读取)

[生产计划触发 BOM 展开]
       ↓
   BomExpansionService.expandBOM(factoryId, productTypeId, qty)
       ↓
   ConversionRepository.findByFactoryIdAndProductTypeId(...)
       ↓
   material_product_conversions 表 (RPF)
```

---

## 3. 为什么保留 RPF (不删)

客户 + Steve 在 2026-05-10 meeting 决策保留 RPF 表, 理由:

1. **历史数据存在**: 老工厂 (F001 / RES_3101_009 等 Phase 2A cascade 完成的 14 个工厂) 已经在 RPF 表录入数据并依赖该路径做生产计划
2. **migration 工作量大**: BOM → RPF 双向转换工具未实现, 字段映射存在精度损失 (BOM 的"成品克数 + 出成率%" → RPF 的"标准用量")
3. **生产计划逻辑稳定**: `BomExpansionService.expandBOM()` + `checkMaterialAvailability()` + `recheckAvailability()` 三个 method 已在生产环境跑了几个月, 替换风险高
4. **重叠功能可后期下线**: 客户认可"原本的 RPF 足足够了", 暂保留两套, Phase 4 评估下线时机

---

## 4. Path A — 本 doc 范围 (文档化 + UI 提示)

### 4.1 范围

- 本 doc 落地: 阐述 RPF / BomItem 关系 + 当前分歧
- `BomServiceImpl.saveBomItem()` 加 log warning: 用户每次写 BomItem 时, 日志提示生产计划仍走 RPF
- `web-admin/src/views/production/bom/index.vue` 顶部加 `el-alert`: 在 UI 上提示客户当前生产计划基于 RPF, BOM 编辑需手动同步到转换率才能生效

### 4.2 不做的事 (留给 Path B)

- 不动 `BomExpansionService.expandBOM()` 的数据源 (仍走 RPF)
- 不删 `material_product_conversions` 表
- 不实现 BOM → RPF 自动 sync
- 不改 feature flag

### 4.3 接受标准

- ✅ 本 doc 在 PR 内 ship
- ✅ `BomServiceImpl.saveBomItem()` 内 1 行 `log.warn(...)` 引用此 doc 路径
- ✅ `bom/index.vue` 顶部 banner 引用此 doc 路径
- ✅ Steve sign-off on Path B 选择 (next step)

---

## 5. Path B — 真正的 reconciliation (deferred, needs Steve sign-off)

⚠️ **本 doc 不实施 Path B, 仅列出选项, 等 Steve 决策**:

| 选项 | 描述 | 工作量估算 | 风险 |
|---|---|---|---|
| **B1: 双写 BomItem + RPF** | `BomServiceImpl.saveBomItem()` 写入时同步 upsert `MaterialProductConversion` 行, 字段映射 (`standardQuantity` / `yieldRate` → `standardUsage` / `wastageRate`) | 2-3d | 中 — 字段映射 + transaction boundary 需仔细测试 |
| **B2: 改 BomExpansionService 读 BomItem (推荐)** | 把 `BomExpansionService.expandBOM()` 数据源换成 `BomItemRepository`, RPF 表 deprecate | 3-5d | 高 — 改动核心 service, regression 测试需覆盖 F001 等已用 RPF 的工厂 |
| **B3: BOM 编辑触发 RPF 重算 + 重 seed** | BomServiceImpl 写后异步触发 ETL 把 BomItem aggregate 回 RPF 表 | 2-3d | 中 — 需要 ETL 触发 + 失败重试 + 一致性窗口 |

### 5.1 推荐 (per PR #288 §5.5)

**B2 推荐** — 客户在 BOM 页面录入即期望生效, 是用户直觉行为。但改动 `BomExpansionService` 是核心服务, 需 regression 测试。

### 5.2 Path B 触发条件

1. Steve sign-off 选 B1 / B2 / B3 之一
2. F006 数据稽查 (同时有 BOM + RPF 配置的产品, 验证两份数据一致 / 偏差度量)
3. Feature flag `BOM_EXPANSION_USE_BOM_ITEMS` 准备好做灰度

---

## 6. 关联 PR & 参考

- PR #288 (impl plan) §D4 — RPF (MaterialProductConversion) 保留不删 — 完整背景
- PR #288 §5.5 — Code impact + 路径选择讨论
- PR #288 §9.2 — 隐藏分歧节点 (`BomExpansionService.java:54` vs `BomServiceImpl`)
- PR #288 §10 — Steve sign-off items 第 2 项 (Path A vs B)
- 客户 transcript line 29 (2026-05-10 customer meeting)

---

## 7. Path A → B 路径上的关闭标准

| 阶段 | 输出 | 状态 |
|---|---|---|
| Path A doc ship | 本 doc 在 main 落地 | ⏳ in flight (本 PR) |
| Path A log warning | `BomServiceImpl.saveBomItem()` 加 `log.warn` | ⏳ 本 PR 一并 ship |
| Path A UI banner | `bom/index.vue` 加 `el-alert` | ⏳ 本 PR 一并 ship |
| Steve sign-off Path B | 选 B1 / B2 / B3 | ⏸️ blocked on Steve |
| Path B spec | `docs/superpowers/specs/<date>-d4-path-b-design.md` | ⏸️ 待 sign-off 后 dispatch |
| Path B impl | 单独 PR (估 2-5d) | ⏸️ 待 spec |
| Path B regression test + cutover | F006 数据稽查 + feature flag 灰度 | ⏸️ 待 impl |
| 关闭 RPF 表 (optional) | Phase 4 评估下线 | ⏸️ 长期 |
