# RPF (MaterialProductConversion) vs BomItem 共存说明

**Decided**: 2026-05-10 customer meeting (Steve + customer)
**Status**: ✅ **Path B (B2) shipped 2026-05-10** — BomExpansionService 已改读 BomItem, RPF 保留作为 fallback。
**PR**: PR #294 (Path A doc) → PR #297 (D2/D3 + sourceUnit dormant) → PR #309 A2=B (本 PR Path B 落地)
**Owner**: Cretas Team

> **2026-05-10 Path B shipped 摘要**:
> - `BomExpansionService.expandBOM()` 优先查 `BomItem`, 不存在时 fallback 到 `MaterialProductConversion` (RPF)
> - `MaterialRequirement.sourceUnit` (PR #297 dormant 字段) 通过 BomItem 路径激活, 端到端开通 D3 g↔kg 1:1000 单位换算
> - RPF 表 + entity + repository **保留不删** (向后兼容 F001 等老工厂数据)
> - `BomServiceImpl.saveBomItem()` 的 D4-divergence warn log 已改为 D4-B active info log
> - `web-admin/src/views/production/bom/index.vue` 顶部 banner 从 warning 改为 success 提示
> - 详见下方 §7 "Path B 落地说明"

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

## 7. Path B 落地说明 (2026-05-10 shipped, PR #309 A2=B)

### 7.1 实施总结

Steve 在 2026-05-10 选定 **B2 推荐方案** — 改 `BomExpansionService` 数据源到 `BomItem`, RPF 保留作为 fallback。

**改动文件**:
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/orchestration/BomExpansionService.java`
  - 注入 `BomService` 依赖
  - `expandBOM()` 拆分为 `expandFromBomItems()` (主路径) + `expandFromConversions()` (fallback)
  - BomItem 路径调用 `bomItem.getActualQuantity()` (= `standardQuantity / (yieldRate/100)`) × productionQuantity 计算 required
  - **关键**: `req.setSourceUnit(item.getUnit())` 激活 PR #297 dormant 的 D3 单位换算
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/BomServiceImpl.java`
  - 移除 `[D4-divergence]` `log.warn` 警告, 改为 `[D4-B active]` `log.info` 正面消息
- `web-admin/src/views/production/bom/index.vue`
  - 顶部 `el-alert` 从 `type="warning"` 改为 `type="success"`, 文案改为 "BOM 已对接生产计划, 录入即生效"
- `backend/java/cretas-api/src/test/java/com/cretas/aims/service/orchestration/BomExpansionServiceTest.java`
  - 新建 5+ 单元测试: BomItem 优先 / RPF fallback / 双存在时 BomItem 赢 / yieldRate scaling / D3 sourceUnit 激活

### 7.2 数据流 (Path B 之后)

```
[客户在 BOM 页面录入]
       ↓
   BomServiceImpl.saveBomItem()
       ↓
   bom_items 表
       ↓ ✅ (直接被读取)
[生产计划触发 BOM 展开]
       ↓
   BomExpansionService.expandBOM(factoryId, productTypeId, qty)
       ├─ bomService.getBomItemsByProduct(...) (优先)
       │   └─ 非空 → expandFromBomItems() → req.sourceUnit=BomItem.unit
       │       ↓
       │   ProductionWorkflowOrchestrator.buildTransferRequest()
       │       └─ sourceUnit≠targetUnit (e.g. g≠kg) → convertUnit() 1:1000 换算
       │
       └─ 空 → expandFromConversions() (RPF fallback, sourceUnit=null, 沿用 1:1 透传)
```

### 7.3 向后兼容性

- F001 等老工厂只配置了 `material_product_conversions` (RPF) 没配置 `bom_items` → 自动走 fallback 路径, 行为完全不变
- 新工厂只配 BomItem (默认推荐) → 走新路径, 享受 D3 单位换算
- 同一产品同时配置两种 → BomItem 优先 (per Path B 契约)

### 7.4 关闭标准

| 阶段 | 输出 | 状态 |
|---|---|---|
| Path A doc ship | 本 doc 在 main 落地 (PR #294) | ✅ 2026-05-10 |
| Path A log warning | `BomServiceImpl.saveBomItem()` `log.warn` | ✅ 2026-05-10 (本 PR 改为 info) |
| Path A UI banner | `bom/index.vue` `el-alert warning` | ✅ 2026-05-10 (本 PR 改为 success) |
| PR #297 D2/D3 + `sourceUnit` 字段 (dormant) | `MaterialRequirement.sourceUnit` ship | ✅ 2026-05-10 |
| Steve sign-off Path B | 选 B2 (改 BomExpansionService) | ✅ 2026-05-10 |
| Path B impl | `BomExpansionService` + `BomServiceImpl` + Vue banner + test | ✅ 2026-05-10 (PR #309 A2=B, 本 PR) |
| Path B regression test | unit test 覆盖 BomItem / RPF fallback / D3 激活 | ✅ 2026-05-10 (本 PR) |
| F006 数据稽查 + cutover 灰度 | 部署后客户回访验证 | ⏸️ 待部署后续观察 |
| 关闭 RPF 表 (optional) | Phase 4 评估下线 | ⏸️ 长期 (保留 fallback) |
