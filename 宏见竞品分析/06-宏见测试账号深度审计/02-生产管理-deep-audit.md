# 02 — 生产管理 Deep Audit (Tier 1, P4 优先级)

> Phase 2 deep dive. 截图: `screenshots/nav-06-生产管理-fullpage.png` + `screenshots/生产-*`

---

## 1. 模块入口 + 架构

- 路径: `顶部菜单 → 生产管理 → 生产任务管理`
- 子域: `product.hongjian.com` (推测)
- 物料需求 URL 实测: `https://product.hongjian.com/tree/tree.jsp?type=productionmaterialdate` ⭐ — 是 tree picker 而非传统 list
- 这意味着: 生产模块的"物料需求"是**层级树视图** (按产品分类树展开物料需求), 不是 flat 列表

---

## 2. 业务流程图 (8 节点)

```
销售订单 → 产品结构(BOM) → 生产计划 → 物料需求
                                          ├→ 厂内加工 → 生产成本 → 报表
                                          └→ 委外加工 ↗
```

8 节点都是可点击的 jsPlumb endpoint, 跟其他模块一样.

---

## 3. 31 子菜单完整清单 (BIGGEST 模块)

### 3.1 生产管理 (9 三级)
- 生产任务预备 ⭐ (Cretas 缺 — "生产任务草稿"独立状态)
- 生产任务管理 (M-PLAN-1)
- 生产进度跟踪 ⭐ (Cretas 缺独立进度视图)
- 生产交货预警 ⭐ (Cretas dashboard 显示 "2 条预警")
- 生产实时数据 ⭐ (M-RPT-BATCH 升级版?)
- 成品完工列表
- 成品入库列表
- 成品批量入库 ⭐
- 成品领出列表

### 3.2 顶层 (22 项)
- **工序流转** ⭐⭐⭐ (M-WP-1 操作入口 — Cretas 后端有但前端缺)
- 装箱管理 ⭐ (W-SN 关联)
- 物料需求 ⭐ (M-EXP-1, **tree 形式**)
- **线边仓** ⭐⭐ (W-MULTI-1, 车间专属仓)
- 物料管理 (主数据)
- 物料评估 ⭐ (供应商/质量评估)
- 生产计划 (M-PLAN-1)
- **在制品** ⭐⭐ (Cretas 没有 WIP 状态管理)
- **计件计时** ⭐⭐⭐ (M-WAGE-1 直接对标!)
- **电子作业** ⭐⭐ (Cretas 没有 — 数字化作业指导书?)
- 设备管理 (C-DEVICE-*)
- 工时报表
- 统计报表
- 利润报表
- 生产费用 ⭐ (F-AR-1 cost accounting)
- **周转箱管理** ⭐⭐ (Cretas 没有, 卤制品周转箱循环)
- 品质管理 (副入口)
- **条码管理** ⭐⭐ (P-SCAN-1 / W-ABA-1 关联!)
- 车间管理
- **工具管理** ⭐ (Cretas 没有)
- 模具管理 (Tier 3)
- 参数设置

---

## 4. 物料需求 (tree picker 模式, 实测)

![物料需求 tree](./screenshots/生产-01-物料需求.png)

- URL: `/tree/tree.jsp?type=productionmaterialdate`
- 字段: id / datalinktype / source / list (隐藏 textarea, 推测 JSON 输出)
- buttons: 保存 / 取消
- **架构**: 产品分类 tree 展开 → 选物料 → 输出物料需求 list
- **vs Cretas**: Cretas M-EXP-1 是直接展开 BOM 后输出 list, 没有"按分类筛"步骤. 宏见的 tree 模式适合**多 SKU/多分类的大型工厂**.

---

## 5. 跟 Cretas 对照

| 维度 | 宏见 | Cretas |
|---|---|---|
| 子菜单数 | **31 (最大)** | ~15 |
| 业务流程图节点 | 8 (含厂内/委外分流) | 1 主流程 |
| 工序流转 (M-WP-1) | 独立子菜单 | 后端 OK, 前端 0 Screen |
| 计件计时 (M-WAGE-1) | 独立子菜单 | 计件 PieceworkConfig 部分 |
| 电子作业 | 独立子菜单 | **完全没有** ⭐ |
| 在制品 (WIP) | 独立子菜单 | 没有 WIP 独立状态 |
| 条码管理 | 独立子菜单 | LabelScanScreen 部分 |
| 物料需求展开 | tree 模式 | flat list (BomExpansion) |
| 周转箱 | 独立 | 缺 |
| 工具/模具 | 独立 | 缺 |

---

## 6. Cretas 应该抄的 (新增)

| 优先级 | 项 | 工时 | 说明 |
|---|---|---|---|
| **P0** | 工序流转 UI (M-WP-1, 已 list) | 已估 5d | 客户 May 第四次会议反复要求 |
| **P0** | 计件计时 UI (M-WAGE-1, 已 list) | 已估 3d | 食品厂工资模式 |
| **P1** | 在制品 (WIP) 状态管理 | 3d | 半成品库存可视化 |
| **P1** | 物料需求 tree 模式 (按分类展开) | 4d | 食品厂多 SKU 场景 |
| **P1** | 生产任务预备 (草稿态) | 2d | 任务正式 issue 前的 staging |
| **P1** | 生产交货预警 dashboard | 3d | Cretas dashboard 已有 hint, 需独立模块 |
| **P2** | 电子作业指导书 | 8d | SOP 数字化 (P-SCAN-1 关联) |
| **P2** | 条码管理独立模块 | 5d | LabelScanScreen 升级为模块 |
| **P3** | 周转箱管理 | 5d | 卤制品行业刚需 |
| **P3** | 工具/模具管理 | 4d | 设备类工厂场景 |

---

## 7. 餐饮 vs 食品厂双主线影响

宏见 31 子菜单中, **跟 F006 卤制品工厂直接相关的**:
- 工序流转 / 计件计时 / 在制品 / 物料需求 / 生产计划 / 生产任务管理 / 成品入库 / 装箱 / 周转箱 / 条码管理 — 10+

**餐饮 QHJ 不需要的** (Tier 3 archive):
- 工具管理 / 模具管理 / 设备管理 (餐饮中央厨房简化版)

**Cretas 双主线**:
- 餐饮: 简化生产模块, 仅"加工任务"概念
- 食品厂: 完整 31 子菜单跟得上 (Sprint 3-5)

---

## 8. Phase 2 生产模块完成度

✅ 31 子菜单 Tier 分类
✅ 物料需求 tree 模式实测 (URL/字段/架构)
✅ 跟 Cretas 对照 9 维度
✅ 新 MUST_COPY 增量 10 项
✅ 餐饮/食品厂双主线分析
🟡 工序流转 / 计件计时 / 在制品 / 设备管理 详细 audit (留 Phase 3 active flow 时跑)

---

## 9. Round 5+ 真实数字修正 (2026-05-15 amend)

| 维度 | Round 1 估算 | **Round 5 真实** |
|---|---|---|
| 子菜单数 | 31 | **109** (3.5× — 最大模块) |
| 后端子域 | production.hongjian.com | production (53) + bom (13) + mould (13) + device (13) + wip (5) + ProcedureQuality (27) + service (16) + import (5) — **跨 9 子域!** |

### Round 5 真实 109 子菜单分组
- **device** (12): 设备管理 / 类型 / 属性 / 维修 / 借出 / 点检 / 保养 等
- **mould** (13): 模具管理 / 备件 / 领取 / 盘点 / 部位 / 关联产品 / 维修 / 借出 / 点检 / 寿命 / 变更
- **production** (9): 任务预备 / 任务管理 / 进度跟踪 / 交货预警 / 实时数据 / 成品完工/入库/批量入库/领出
- **mater****ial** (7): 物料需求/领料 / 退料 / 半成品 / 边角料 等
- **report** (9): 生产报工统计 / 完工数值 / 产值 (产品/员工/部门) / 入库分析 (产品/员工) / 成本明细 / 工序合格率
- **wage** (7): 计件管理 / 计时管理 / 计件计时月报/日报 / 计件工资月报 / 工时计件扣款月报 / 控台计件月报
- **workhourreport** (4): 工时报表 (工序 / 员工) / 工艺工时明细 / 工时明细汇总
- **mould 子组** + **tool** (3): 工具管理 / 工具发放 / 工具借用
- **packing** (4): 生产装箱 / 标签装箱 / 装箱列表 / 箱号追溯
- **processflow** (5): 工序流转 / 工序检验 / 扫码工序流转 / 工序流转追溯 / 我的工序流转
- **production**run (6): 半成品库存查询 / 半成品入库 / 出库 / 调拨 / 盘点
- **aps** (6 ⭐⭐⭐): 自动排产 / 自动排产历史 / 排产明细 / 设备工时 / 派工任务
- **productionprofit** (3): 生产毛利 (时段/产品) / 生产计划预警
- **lineedgewarehouse** (3): 库存查询 / 仓库管理 / 仓库报表
- **packing/serial/turnoverbox** 等

### 新发现 (Round 7-8)
- **wip.hongjian.com 独立子域** — 在制品库存查询独立 (5 列)
- **mould.hongjian.com 独立子域** — 模具完整生命周期 (13 项)
- **device.hongjian.com 独立子域** — 设备类型独立
- **service.hongjian.com** — 售后服务 16 项 (跟生产同战线)
- **ProcedureQuality.hongjian.com** — 工序质检 27 项 (15 列含失败原因/处理结果)

### Cretas 累计借鉴 (生产域)
- P0: M-WP-1/2 (工序管理 + 产品工序配置) / M-BOM-1 (BOM UI) / M-BOM-VER-1 升级 (工程级)
- P1: M-WIP-1 / M-MATTREE-1 / M-PREP-1 / M-DELIVERY-WARN-1 / Q-PROCESS-1 (工序质检不良)
- P2: M-APS-1 ⭐ (高级排产 15d, 大型工厂) / M-MOULD-1 (12d, 注塑/电子行业)

详见 `28-CRETAS-PRIORITIZED-BACKLOG.md`.
