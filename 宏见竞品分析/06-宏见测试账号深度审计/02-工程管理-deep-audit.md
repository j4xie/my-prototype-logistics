# 02 — 工程管理 (BOM/工序) Deep Audit (Tier 1, P6 优先级)

> Phase 2 deep dive. 截图: `screenshots/nav-08-工程管理-fullpage.png` + `screenshots/工程-*`

> ⚠️ **重要修正**: "工程管理" 不是项目工程, 是 **BOM/工序/工艺管理** (M 域核心), 是 Cretas M-BOM-1 / M-WP-1 / M-BOM-VER-1 的直接对照源.

---

## 1. 模块入口 + 架构

- 路径: `顶部菜单 → 工程管理 → BOM列表 → 待审核BOM`
- URL: `https://bom.hongjian.com/bom/productbomcheckinglist.jsp`
- **独立子域**: `bom.hongjian.com` (BOM 单独子域, 凸显工程级地位)

---

## 2. 业务流程图 (7 节点)

```
BOM物料替换 / 待审核BOM / BOM反查 / 工序配置 / 设备配置 / 质检项目 / BOM设置
```

- 不是线性流程, 是 7 个独立 BOM 工程操作工具
- **BOM物料替换** ⭐ — Cretas 没有 (替换 BOM 内某物料 → 影响所有相关 BOM)
- **BOM反查** ⭐⭐ — Cretas 没有 (从物料反查"哪些 BOM 用了它")
- **工序配置 / 设备配置 / 质检项目** — BOM 的下游配置入口

---

## 3. 待审核BOM列表 (实测)

![待审核BOM](./screenshots/工程-01-BOM待审核.png)

### 3.1 列表表头 (12 列, BOM 工程级)

| # | 列 | Cretas 对照 |
|---|---|---|
| 1 | **BOMID** | Cretas 无独立 BOM 实体 (附在 product) |
| 2 | 产品编号 | ✅ |
| 3 | 产品名称 | ✅ |
| 4 | 规格 | ✅ |
| 5 | **版本号** ⭐⭐⭐ | **Cretas M-BOM-VER-1 P3 缺失!** 宏见已实装 |
| 6 | **工序数** ⭐ | Cretas 缺 (BOM-工序关联统计) |
| 7 | **物料数** ⭐ | Cretas 缺 (BOM 行数汇总) |
| 8 | 新增人员 | ✅ |
| 9 | 新增日期 | ✅ |
| 10 | **工作流状态** ⭐ | **Cretas BOM 没有独立工作流状态!** |
| 11 | 类型 | (推测: 工艺/销售/工程 BOM 多种) |
| 12 | 操作 | 查看/审核/反对 |

### 3.2 顶部 button
- 查询 (按 pname/pno)
- **批量审核** ⭐⭐ — 多 BOM 一键审核

### 3.3 关键字段 (实测)
- pname / pno (查询)
- layTableCheckbox (多选行)

---

## 4. 14 子菜单 (按 Tier)

### Tier 1 (Cretas 必抄/对照)
- **BOM管理** (9 三级):
  - **BOM列表** ⭐⭐⭐ (M-BOM-1 直接对照, 含 BOMID + 版本号)
  - **BOM审核** ⭐⭐⭐ (Cretas 没有审批流, 创建即可用)
  - **BOM反查** ⭐⭐⭐ (从物料反查 BOM, Cretas 完全没有)
  - **BOM导入** ⭐ (Excel 批量导入)
  - **BOM物料批量修改** ⭐⭐ (4 种批量操作)
  - **BOM物料批量替换** ⭐⭐ (供应商换型号场景)
  - **BOM物料批量删除**
  - **BOM物料批量新增**
  - **BOM备料批量新增**
- **ECN变更** ⭐⭐⭐ (Engineering Change Notice — Cretas M-BOM-VER-1 P3 缺失!)
- **工序管理** ⭐⭐ (M-WP-1 直接对照 — 跟生产管理子菜单同名但是这里是配置)
- 电子作业 ⭐⭐ (跟生产管理同名 — 推测是 SOP 数字化)
- 参数设置

### Tier 3 (无)
所有 14 子菜单都是 BOM/工序工程相关, 全部 Tier 1.

---

## 5. 跟 Cretas 对照 (BOM 工程深度差距)

| 维度 | 宏见 | Cretas |
|---|---|---|
| **BOM 实体** | 独立 (BOMID) | 附在 product (无独立 ID) |
| **版本号** | ✅ 列表显示 + ECN 变更 | ❌ 缺 (M-BOM-VER-1 P3) |
| **工作流状态** | ✅ BOM 自身有审批 | ❌ 创建即可用 |
| **工序数 / 物料数** | ✅ 列表汇总 | ❌ 详情才能看 |
| **BOM 反查** | ✅ 物料 → BOM | ❌ 完全没有 |
| **BOM 物料批量** | 修改/替换/删除/新增 4 种 | ❌ 仅 inline 单行编辑 |
| **BOM 备料批量** | ✅ 备料是独立维度 | ❌ |
| **BOM 导入** | ✅ Excel | C-MIGRATE-1 含 (Sprint 0 设计中) |
| **ECN 变更** (BomVersion) | ✅ 实装 | ❌ M-BOM-VER-1 P3 不抄 (但宏见有, 重新评估) |
| **多 BOM 类型** | 工程/工艺/销售 (推测) | 单一 BOM |
| **独立子域** | bom.hongjian.com | 无 |
| **关联工序数** | ✅ 列汇总 | M-WP-2 关联但缺汇总 |

---

## 6. Cretas 应该抄的 (新增, 评估升级)

### 6.1 重新评估 M-BOM-VER-1 (从 P3 → P1)
**原 v2 评估**: M-BOM-VER-1 (BOM 版本管理) = P3 不抄
**实测后修正**: 宏见已实装版本号 + ECN 变更, F006 客户后续会需要 (产品配方调整频繁) → **升级 P1**

| 优先级 | 项 | 工时 | 说明 |
|---|---|---|---|
| **P0 (升级)** | **BOM 实体独立化** (BOMID + 版本号 + 状态机) | 5d | M-BOM-VER-1 升级 P0, 解锁后续审批/ECN/反查 |
| **P0** | **BOM 审核工作流** (创建 → 审核 → 启用) | 3d | 防止配方误改影响生产 |
| **P0** | **批量审核** + 列表批量操作 | 1d | 同 BOM 多版本批审 |
| **P1** | **BOM 反查** (物料 → BOM list) | 2d | 物料替换/降级影响评估 |
| **P1** | **BOM 物料批量修改/替换/删除/新增** (4 种) | 4d | 替换关键 — 供应商换型号 |
| **P1** | **ECN 变更** (Engineering Change Notice) | 5d | 含变更原因 + 影响范围 + 通知列表 |
| **P1** | 列表汇总列 (工序数/物料数) | 1d | UI 即可 |
| **P2** | 多 BOM 类型 (工程/工艺/销售) | 3d | 大客户场景 |
| **P2** | BOM 备料维度 | 3d | 备料是独立"BOM" 子集 |

**总工时**: ~27d 工程级 BOM 升级

---

## 7. ECN 变更 (BORROW_LIST M9 新发现)

ECN = **Engineering Change Notice** — 工程级配方变更通知:
- 变更单号 (类似 PR 编号)
- 变更原因 (强制必填: 客户要求 / 物料停产 / 成本优化 / 质量缺陷 / 工艺改进)
- 影响范围 (哪些 BOM 受影响)
- 通知列表 (生产/采购/质检 自动通知)
- 生效日期 (历史 BOM 仍可用, 新订单走新 BOM)
- 审批链 (工程师 → 工艺主管 → 生产主管 → 质检 → 采购)

**Cretas 完全没有, 但 F006 客户做卤制品配方迭代会需要**:
- 牛肉减 5g 改 195g + 盐增 1g
- 这种 调整不能直接覆盖, 需要 ECN 流程 + 历史可追溯

---

## 8. 战略意义

宏见 BOM 是 **工程级 PLM-Lite** (Product Lifecycle Management 简版), 不是单纯"配方":
- 独立子域 bom.hongjian.com
- 版本号 + 工作流状态 + ECN
- 批量操作 4 种
- 反查能力

**Cretas BOM 是配方 + 自动展开, 缺工程级管理**.

**销售话术**:
- ❌ 不能说: "我们 BOM 跟金蝶/宏见一样深"
- ✅ 可说: "我们 BOM 配方更易上手, AI 一句话建配方; 工程级 BOM 升级在我们 Sprint 4 路线图"
- 🟡 客户问"BOM 版本管理": 提"M-BOM-VER-1 ASAP+1 月内可补"

---

## 9. Phase 2 工程模块完成度

✅ 待审核BOM list 实测 (12 列含 BOMID/版本号/工序数/物料数/工作流状态)
✅ 业务流程图 7 节点 (含 BOM物料替换/反查 — Cretas 缺)
✅ 14 子菜单 全 Tier 1 分类
✅ 跟 Cretas 对照 12 维度
✅ 新 MUST_COPY 增量 9 项 (含 M-BOM-VER-1 升级 P3 → P0)
✅ ECN 变更详细分析
✅ 战略洞察: PLM-Lite vs 配方

---

## 9. Round 5+ 真实数字修正 (2026-05-15 amend)

| 维度 | Round 1 估算 | **Round 5 真实** |
|---|---|---|
| 子菜单数 | 14 | **15** (1.1× — 最准确的模块!) |
| 后端子域 | bom.hongjian.com | bom (13) + + ECN 子模块 |

### Round 5 真实 15 子菜单分组
- **bom** (9): BOM列表 / BOM审核 / BOM反查 / BOM导入 / BOM物料批量修改/替换/删除/新增/备料批量新增
- **ecn** (1): ECN变更明细
- **process** (3): **全局工序设置** / **工序条件设置** ⭐ / **工序条件预判** ⭐
- **engineeringsetup** (1): BOM参数设置
- **technology** (1): 作业指导书

### 新发现 (Round 4-5)
- **Round 4**: BOM 工程级 (BOMID + 版本号 + 工作流状态 + ECN 变更) 实测确认 — M-BOM-VER-1 P3 → P0 升级
- **Round 5**: **工序条件设置 + 预判** = 条件路由 (e.g. "材质=不锈钢 → 工序 A; 否则工序 B") — Cretas 缺
- **作业指导书** (technology) — 数字化 SOP

### Cretas 累计借鉴 (工程域)
- P0: M-BOM-VER-1 (15d, BOM 实体独立 + 版本 + ECN + 反查 + 批量) / M-WP-1/2
- P1: M-WP-CONDITION-1 (工序条件路由, Round 5 新发现, 5d 推荐)
- P1: M-TECHNOLOGY-1 (作业指导书, Round 5 新发现, 8d 推荐)

详见 `28-CRETAS-PRIORITIZED-BACKLOG.md`.
