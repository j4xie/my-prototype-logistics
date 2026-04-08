# Verification Round 2 — 综合总结

**日期**: 2026-04-07
**5 个并行 verification subagent 完成**
**目的**: 深度核对 Round 1 (6.5/10) 未覆盖的 5 个领域

---

## 🎯 总体评分汇总

| Agent | 任务 | 评分 | 性质 |
|-------|------|------|------|
| **A** | 5 张关键截图对齐 | **5.5/10** | 字段密度差距大 |
| **B** | P0-4 运营报价 设计 | **8.5/10** | 设计成熟，可直接干 |
| **B** | P0-5 物料需求单 设计 | **9/10** | 同上 |
| **C** | P0-13 PC 批次 | **3/10** | SalesDeliveryItem 单批次绑定结构性阻断 |
| **C** | P1-1 工人欠退扫码 | **2/10** | 完全无工序级扫码进出 |
| **C** | P1-3 研发样品 3→2 页 | **4/10** | 当前仅 1 页, 比预期还少 |
| **D** | 产品大类隔离 bug | **2/10 修复成熟度** | 后端完全忽略 productCategory 参数 |
| **E** | 跨工厂 E2E 覆盖度 | **风险 8/10** | 0 个相关测试 |

**综合**: 已实现的 (Round 1 覆盖) 还不错，但**未实现的 5 项整体严重不足**。客户演示路径上的硬伤依次是:
1. 🔴 截图 1 研发样品字段缺一半 (15 项)
2. 🔴 截图 3/4 销售订单**审批进度 timeline 完全缺失**
3. 🔴 P0-2 产品大类 bug 还在 (后端 query 完全忽略 category 参数)
4. 🔴 P0-13 PC 批次出库单一行只能绑一个批次 (客户明说"同一产品出现 3 个 PC")
5. 🔴 跨工厂 E2E 0 测试覆盖, V3 W1 DoD 第 3 项未达成

---

## 🔥 五大新发现 (Round 1 未识别)

### 1. 截图 3 销售订单详情页 — 审批进度 Timeline 完全缺失 (Agent A)

> **客户截图**: 底部固定显示 "张权 提交申请 → 刘会林 审批人(已同意)" 时间线
> **我们的实现**: detail.vue 5 tab 都对齐了 ✅, 但**完全没有审批 timeline 区**
> **影响**: 演示时客户必反馈, 因为这是他们日常最依赖的"审批可视化"

### 2. 产品大类 bug 在后端不在前端 (Agent D)

> **客户原话** (会议 1503s): "选成品但能看到原料"
> **根因**: `ProductTypeServiceImpl.getProductTypes()` **完全忽略前端传的 `productCategory` 参数** — 直接 `findByFactoryId`，所以前端 4 个 tab 共享同一份数据
> **意外发现**: 历史遗留双字段 `category` (旧) + `productCategory` (新), 需配套数据迁移
> **修复**: 5-9h, 1-1.5 人日

### 3. P0-13 PC 批次的真正瓶颈是 SalesDeliveryItem (Agent C)

> **客户原话** (会议 5016s): "同一个产品出现三个 PC, 因为我们给到客户里面要告知人家生产日期的"
> **现状好的一面**: `FinishedGoodsBatch.productionDate` ✅ 已有, `MaterialBatch.batchNumber` ✅ 已有
> **致命差距**: `SalesDeliveryItem.finishedGoodsBatchId` **是单值字段** — 一个出库行只能绑一个批次
> **修复**: 新建 `SalesDeliveryItemBatchAllocation` 子表 + 出库 FIFO 改造 + 打印模板加 PC 列, 中等工时

### 4. 工人欠退完全无基础 (Agent C)

> **客户原话** (会议 4720s): "扫一下这个员工, 这个员工相当于欠退了, 从我这工序下班了"
> **现状**: `EmployeeWorkSession.workTypeId` 是单值, 一个 session 只能绑一个工种 — 无法表达"上午切配/下午包装"工种切换
> **需要**: 新表 `EmployeeProcessSegment` 或允许 EmployeeWorkSession 一天多条 + 主管端"扫码加人/扫码踢人" UI

### 5. 跨工厂 0 测试覆盖 = V3 W1 DoD 未达成 (Agent E)

> **V3 W1 DoD 第 3 项**: "跨工厂 E2E 自动化回归用例覆盖率 100%"
> **实际**: 76 个 Java 单测 / 36 个 test-*.mjs 中, **本次修复的 3 Tool + 7 状态机方法 0 测试**
> **唯一覆盖**: `MultiFactoryDataIsolationTest` 仅覆盖 calibration 模块
> **修复**: 8 个必写单测 + 5 个 E2E mjs, 估算 10h

---

## 🟢 好消息: P0-4 + P0-5 设计成熟可直接开干 (Agent B)

Agent B 给出了 **OperationalQuote (报价)** 和 **MaterialRequisition (物料需求单)** 的:
- 端到端业务场景 (从客户视角)
- 完整 DDL 字段清单
- API endpoint 设计 (HTTP method + path)
- 与现有实体关系图

**意外发现**:
- v3 写 P0-4 时**漏了"指定到人不是岗位"之外的 2 个细节**:
  - 报价完成后**还要走一次审批**才能给销售 (三段式: 提交→报价→审批→销售可下单)
  - 报价有 `FIXED / NEGOTIABLE` 类型 (固定 vs 可议价)
- v3 写 P0-5 太简化, 真实诉求是 **4 个动作 + 1 个实体**:
  1. 计划提交 → 按 BOM 自动生成 MaterialRequisition
  2. 仓库备料 (从物流仓拣货)
  3. 物流仓 → 工厂仓调拨
  4. 报工后退料

→ **可以直接照着 Agent B 的设计动手，省 2-3h 设计时间**

---

## 📋 修复优先级建议 (基于 Round 2)

按"客户演示阻塞性 + 投入产出比"排序:

| # | 修复项 | 阻塞性 | 工时 | 来源 |
|---|--------|--------|------|------|
| **1** | **产品大类 bug 修复** (后端 ServiceImpl 忽略 category) | 🔴 客户已现场演示 | 5-9h | Agent D |
| **2** | **销售订单审批进度 Timeline** (detail.vue 加 timeline 区) | 🔴 演示必反馈 | 4-6h | Agent A |
| **3** | **研发样品字段补齐** (15 个缺失字段) | 🔴 字段缺一半 | 8-12h | Agent A |
| **4** | **跨工厂 E2E 测试** (8 单测 + 5 E2E) | 🔴 W1 DoD | 10h | Agent E |
| **5** | **P0-4 OperationalQuote 实体 + API** | 🟡 P0 但客户未演示 | 12-16h | Agent B |
| **6** | **P0-5 MaterialRequisition 实体 + 4 动作** | 🟡 同上 | 16-20h | Agent B |
| **7** | **PC 批次** SalesDeliveryItemBatchAllocation 子表 | 🟡 客户提到但非演示焦点 | 12-16h | Agent C |
| **8** | **P1-3 研发 → 报价管理页** | 🟡 P1, 与 P0-4 配套 | 6-8h | Agent C |
| **9** | **P1-1 工人欠退扫码** (基础 EmployeeProcessSegment) | 🟢 P1, 涉及硬件 | 16-24h | Agent C |

**总工时**: **89-141h** (约 11-18 人日)
**当前剩余 W1 时间**: D5-D7 = 24h (单人)

→ **不能全做完**, 必须 PM 决策"客户演示前必修哪几项, 哪些能延后到 W2"

---

## 🎯 关键决策点 (需 PM/CEO 在 D5 早会决定)

### 决策 1: 客户演示前的"红线清单" 是哪 4-5 项?

**建议清单**:
- 🔴 1. 产品大类 bug 修复 (5-9h) — 客户已现场演示, 不修必反馈
- 🔴 2. 销售订单审批 Timeline (4-6h) — 演示必看页, 缺失硬伤
- 🔴 3. 研发样品字段补齐 (8-12h, 至少补 8 个核心字段) — 演示必看
- 🔴 4. 跨工厂 E2E 测试 (10h) — V3 W1 DoD, 安全红线
- 🟡 5. P0-4 OperationalQuote MVP (8h, 只做基础 CRUD 不做审批流) — 演示有报价就行

**总工时**: **35-45h** (约 4.5-5.5 人日, 单人 D5-D7 + 周末加班)

### 决策 2: 哪些必须延后到 W2?

- P0-5 MaterialRequisition (16-20h) — 复杂, 涉及双仓体系
- PC 批次 SalesDeliveryItemBatchAllocation (12-16h) — 涉及 schema + FIFO + 打印模板
- P1-1 工人欠退 (16-24h) — 涉及硬件扫码集成

### 决策 3: 是否需要加人?

如果坚持 D5-D7 完成"红线清单 5 项 + V3 原 D5 任务", 单人不够, **必须双人并行**或者**延期演示 1 周**。

---

## 📂 5 份子报告位置

```
docs/plans/verification-round2/
├── A-screenshot-alignment.md       (5.5/10)
├── B-p04-p05-design.md             (8.5/10 + 9/10)
├── C-p013-p11-p13-detail.md        (3/10 + 2/10 + 4/10)
├── D-product-category-bug.md       (2/10 修复成熟度)
├── E-cross-factory-e2e-coverage.md (风险 8/10)
└── SUMMARY.md                      (本文档)
```

---

## 🚀 推荐执行顺序 (假设单人 + 不延期)

### D5 (今天/明天)
- **AM**: 产品大类 bug 修复 (5h, Agent D 已给出修复方案)
- **PM**: 销售订单审批 Timeline (4h, 加 detail.vue 一个区域)

### D6
- **AM**: 研发样品字段补齐 (8h, 后端加字段 + 前端 form)
- **PM**: 跨工厂 E2E 测试 (核心 8 个单测, 5h)

### D7
- **AM**: P0-4 OperationalQuote MVP (8h, 实体 + Repository + Service + Controller + 简单 list 页)
- **PM**: 内部 dry-run + 演示话术准备

### W2 (验收后或并行)
- P0-5 / PC 批次 / 工人欠退 / 完整审批流 / camera 系统修复

---

**Round 2 verification 主结论**: 目前已完成的 (税率分组 + 业务中心 + factoryId 隔离) 是真正的硬骨头, 已经啃下。剩下的 5 项中, **P0-2 产品大类 bug** 和 **审批 Timeline** 是阻塞客户演示的最低成本高价值修复 (合计 9-15h), 应当 D5 优先做。
