# 02 — 仓库管理 Deep Audit (Tier 1, P3 优先级)

> Phase 2 deep dive. 截图: `screenshots/nav-04-仓库管理-fullpage.png` + `screenshots/仓库-*`

---

## 1. 模块入口 + 架构

- 路径: `顶部菜单 → 仓库管理 → 库存管理 → 库存查询` (or 流程图节点 click)
- URL: `https://stockwork.hongjian.com/stockwork/otherout/stockoutlist.jsp` (其他出库单 list)
- **独立子域**: `stockwork.hongjian.com`

---

## 2. 业务流程图 (13 节点 — 仓库最多)

```
调整单 / 其他出库单 / 其他入库单 / 报废单 / 调拨单 /
库存盘点 / 报表 / 商品组合单 / 商品拆解单 /
借出单 / 借出还入单 / 借入单 / 借入还出单
```

**13 个独立单据类型** — 仓库的"单据驱动"是宏见核心. **Cretas 仅有 7-8 类**:
- ✅ 已对应: 出库单/入库单/调拨单/盘点
- ⚠️ 缺: 调整单 / **商品组合单 / 商品拆解单** (Cretas 没有 W-ASSEMBLY) / 借出/借出还入/借入/借入还出

---

## 3. 其他出库单 list (22 字段提取, 实测样本)

### 3.1 关键 combobox (4 项)

| 字段 | 选项数 | 选项 |
|---|---|---|
| **iflag (出库状态)** | 3 | 未出库 / 已出库 |
| **warehouse (仓库分类)** ⭐⭐⭐ | **10** | 默认仓库 / 样品仓 / 成品仓 / 半成品仓 / 原材料仓 / 辅材仓 / 报废仓 / cable车间仓 / FPC车间仓 |
| **vflag (凭证生成)** ⭐⭐⭐ | 4 | 无需生成 / 未生成 / 已生成 |
| momeflag (订单标记) | 7 色 | 灰/红/黄/绿/蓝/紫 |

### 3.2 列表表头 (7 列)
出库产品名称 / 出库数量 / 价格 / 产品备注 / **当前节点** ⭐ / 备注 / 操作

### 3.3 顶部 button
其他出库 / 查询 / 导出 / **批量操作** / **批量生成凭证** ⭐⭐ / 批量打印 / 确定

### 3.4 数据样本
- 默认日期范围: 2026-02-15 → 2026-05-16 (3 个月)
- 部门: 宏见演示苏州李

---

## 4. 关键差异化发现 (vs Cretas)

### 4.1 仓库分类 10 种 ⭐⭐⭐
Cretas 当前 `factory_warehouses` 表是动态用户定义, 没有预设的**功能性仓库类型**. 宏见枚举 10 种是"行业知识沉淀":
- 默认仓库 (通用)
- 样品仓 (S-RD-1 关联)
- 成品仓 / 半成品仓 / 原材料仓 / 辅材仓 (材料层级)
- 报废仓 (W-SCRAP-1 关联)
- cable车间仓 / FPC车间仓 (车间专属仓 — line-side warehouse 模式)

**Cretas 应该抄**: 加 `warehouse_type` 枚举 (W-RAW / W-SEMI / W-FINISHED / W-AUX / W-SAMPLE / W-SCRAP / W-LINESIDE / W-DEFAULT) 作为 factory_warehouses 子分类.

### 4.2 凭证生成状态 (vflag) ⭐⭐⭐
**直接对应 F-VOUCHER-HOOK-1** (BORROW_LIST F3):
- 每张库存单据都有"是否需要/已生成会计凭证"3 状态
- "批量生成凭证" button 一键批量 hook
- "无需生成" 状态 → 部分单据不进财务 (e.g. 内部调整, 不影响应付/库存价值)

Cretas 应该抄: 库存单表加 `voucher_state ENUM('NOT_NEEDED', 'PENDING', 'GENERATED')`, 加批量生成 service.

### 4.3 当前节点列 (workflow inline)
列表中直接显示当前工作流节点名 (e.g. "出库审核中" / "已审核" / "已出库") — UX_BORROW C-1.V3 (轻量步骤条) 实测.

---

## 5. 27 子菜单 (按 Tier)

### Tier 1
- **库存管理** 15 三级 (Phase 2 audit 子集)
- 库存盘点 ⭐ (W-COUNT-1)
- 库存调拨 ⭐ (W-TRANSFER-1)
- 库存预警 ⭐ (W-EXP-1)
- 组装拆卸 ⭐⭐ (Cretas 没有, 食品厂可能用 — 卤制品箱→份装)
- 退货管理
- 产品报废 ⭐ (W-SCRAP-1)

### Tier 2
- 统计报表
- 仓库管理 (主数据)

### Tier 3
- 序列号 (W-SN-1 不抄)
- 箱标管理 (W-SN-1 不抄)

---

## 6. 跟 Cretas 对照

| 维度 | 宏见 | Cretas |
|---|---|---|
| 单据类型 (流程图节点) | **13** | ~7 |
| 仓库分类枚举 | **10 类** | 动态用户定义 |
| 凭证生成 hook | vflag 3 状态 + 批量按钮 | **缺** ⭐⭐⭐ |
| 当前节点 inline 显示 | ✅ 列内显示 | ❌ 仅在详情页 |
| 组装拆卸 (assembly) | 独立单据 | 缺 (食品厂卤制品箱→份装可用) |
| 借入/借出 4 种 | 独立单据 | 缺 (B2B 借货场景) |
| 调整单 (库存调整) | 独立单据 | inline 修改 |

---

## 7. Cretas 应该抄的 (新增)

| 优先级 | 项 | 工时 | 说明 |
|---|---|---|---|
| **P1** | **仓库分类 10 枚举** (W-RAW/SEMI/FINISH/AUX/SAMPLE/SCRAP/LINE/DEFAULT) | 1d | 配合现有 factory_warehouses, 行业知识沉淀 |
| **P1** | **凭证生成 hook** (vflag) | 3d | F-VOUCHER-HOOK-1 关键, 库存单 → 财务凭证联动 |
| **P2** | 商品组合单 / 商品拆解单 | 4d | 卤制品: 箱→份装拆 / 配菜组合 — 食品行业刚需 |
| **P2** | 调整单独立 (vs inline) | 2d | 审计追溯需要独立调整记录, 不能 inline edit |
| **P3** | 借入/借出 4 单据 | 8d | B2B 借货场景, P3 (F006 不刚需) |
| **P3** | 当前节点列 inline | 1d | UX_BORROW C-1.V3 实现 |

---

## 8. Phase 2 仓库模块完成度

✅ 其他出库单 list (22 字段, 10 仓库分类, 凭证 hook)
✅ 业务流程图 13 节点 (含组装/拆解/借入借出)
✅ 27 子菜单 Tier 分类
✅ 跟 Cretas 对照 7 维度
✅ 新 MUST_COPY 增量 6 项
✅ **F-VOUCHER-HOOK-1 实测确认** (vflag + 批量生成)

---

## 9. Round 5+ 真实数字修正 (2026-05-15 amend)

| 维度 | Round 1 估算 | **Round 5 真实** |
|---|---|---|
| 子菜单数 | 27 | **36** (1.3×) |
| 后端子域 | stockwork.hongjian.com | stockwork (14) + stock (19) + warehourse 别名 (36 总) |

### Round 5 真实 36 子菜单分组 (warehourse)
- **invoicing** (15, 最大): 库存查询 / 出库单 / 入库单 + 销售出/退/入库 / 采购收货/入库/退货 / 生产领料 / 成品入库 + 多个 ×7
- **assembly** (2): 组装产品 / 拆卸产品
- **box** (2): 箱号列表 / 箱号追溯
- **stockcheck** (2): 库存盘点 / 盘点报告
- **stockwarning** (2): 库存预警 / 产品失效期预警
- **serial** (3): 序列号追溯 / 序列号列表 / 序列号统计报表
- **report** (3): 仓库温度报表 / 流水查询 / 调拨报表
- **goodsreturn** (2): 客户退货入库 / 供应商退货出库
- **warehouse** (2): 仓库管理 / 库位管理
- **scrap** (1): 报废单
- **stockstubbs** (1): 仓库存根
- **warehoursesetup** (1): 仓库参数设置

### Cretas 累计借鉴 (仓库域)
- P0: F-VFLAG-1 (vflag 凭证 hook) / W-CLASS-1 (10 仓库分类)
- P1: W-COUNT-1 (盘点) / W-TRANSFER-1 (调拨) / W-EXP-1 (失效预警) / W-MULTI-1 (多维查询) / W-TRACE-1 (流水追溯)
- P2: W-SCRAP-FULL / 商品组合拆卸

详见 `28-CRETAS-PRIORITIZED-BACKLOG.md`.
