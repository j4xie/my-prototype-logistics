# 客户需求 v3 — V1.0 交付 + V2.0 愿景 双阶段路线图

**版本**: v3.0
**更新日期**: 2026-04-07
**前置文档**:
- v1: `customer-meeting-apr7-requirements.md`（会议纪要 + 原始需求）
- v2: `customer-meeting-apr7-requirements-v2.md`（画布配置驱动方案 — 已降级为愿景文档）
- audit: `customer-meeting-apr7-requirements-v2-audit.md`（v2 二次审核报告）

**核心变化**: v3 是 audit 结论的落地版本。v2 把"画布可配置化"当作 4 周交付方案是幻觉；v3 把它拆成 **V1.0（8 周交付，硬编码 + 局部 schemaJson）+ V2.0（画布愿景，时间待定）** 两阶段，保证六扇门客户本轮能验收，同时保留 v2 的长期架构方向。

---

## 0. v3 核心原则

1. **客户原话优先** — 每条需求必须能追溯到会议转录的具体时间戳
2. **不做无证据承诺** — 删除 v2 里所有"PageEditor 复用 / Formily / 不写一行代码"等不实表述
3. **拒收级别分类** — 每项需求标注 🔴(真拒收) / 🟡(抱怨但接受) / 🟢(演示加分)
4. **工期带置信度** — 每个里程碑给出概率估算，不拍脑袋
5. **双阶段边界清晰** — V1.0 只做客户验收必须项，V2.0 是产品演进路线图
6. **技术前提先于功能** — Week 1 必须先做 factoryId 隔离审计，否则后面都是空中楼阁

---

## 1. 背景 — 客户原话锚点

**会议**: 2026-04-06 昆山六扇门食品 × Steven (85 分钟屏幕共享会议)
**客户**: 张权 (六扇门食品，前永辉集团 ERP 设计经验，**第 4 次 ERP 落地尝试**)
**业务特征**:
- 熟食加工非标品（猪肉精、带鱼段、白鹿鸡腿、梅酱小排等）
- **无固定产线**，小组长动态认领工序
- **双仓体系**: 物流仓 + 鲜棉仓（车间仓当天清仓）
- **主原料定点追踪**（贵重料防多采）
- **PC (生产日期批次)** 强制，客户要先进先出
- **40+ 种原辅料 per SKU**
- **销售运营部** 统一做报价（而非销售员）

**关键客户原话锚点**:

| 时间戳 | 原话 | 影响 |
|--------|------|------|
| 1007-1017s | "研发需求跟样品管理做一个合并" | L12 研发样品 3→2 页 |
| 1265-1275s | "人工留个窗口，我们自己往上加" | BOM 工序自定义 |
| 1670-1750s | "运营是销售运营部，报价是运营部门做的，要指定到人不是岗位" | L1 运营报价 + L2 指定人员 |
| 1737-1761s | "我们这边基本上是指定人员去做某些事...岗位也是比较模糊" | L2 人员而非岗位授权 |
| 1879s | "同一个商品一个订单里面应该只能出现一次" | A3.2 SKU 去重 |
| 2645-2660s | "订单含 9% 原料 + 13% 加工费两个税项" | 🔥 **G1 税率分组开票** (六扇门最核心财务诉求) |
| 2906-2921s | "订单未出库显示订单金额，出库后显示出库金额" | A3.5 金额联动 |
| 3128-3252s | "订单 → 物料需求单 → 仓库备料 → 工厂调拨 → 报工 → 退料" | 🔥 **G3 生产 6 步链路** + 物料需求单实体 |
| 3225-3245s | "鲜棉仓当天清仓，不留原辅料" | A9 双仓体系 |
| 3438-3475s | "框作为一个商品，做一个进销存号" | L5 周转耗材 SKU 化 |
| 4302-4309s | "前一天排计划，第二天早会自己认领" | 工序认领模式 |
| 4587-4594s | "认领的是认领一个工序，不是认领一批生产计划" | 工序二维码扫码 |
| 4720-4740s | "中间有员工走了，扫一下这个员工 = 欠退，从我这工序下班了" | L3 工人欠退机制 |
| 4802-4810s | "可以做一个数字大屏，看到所有商品工序生产进度" | 数字大屏 (P3) |
| 4870-4880s | "仓库扫描采购订单二维码进入入库页面，不是仓库自建入库" | A5 入库流程严格化 |
| 5016-5024s | "客户也要做先进先出，销售出库单要有 PC 日期" | A4.4 PC 批次 |
| 5049-5054s | 🔥 **"采购、人事、财务这一部分不特别紧急，可以后面慢慢往上"** | 🔥 **A6/A7/A8 降 P2** (v2 错放 P0) |
| 1503-1512s | 客户演示: "选成品但能看到原料" | G5 **线上 bug 非新功能** |

---

## 2. V1.0 vs V2.0 边界

### V1.0 — 六扇门客户本轮交付 (8 周)

**范围**: P0 + P1，硬编码为主 + 局部 schemaJson 探索（只 2-3 个实体）
**目标**: 六扇门客户验收通过，能跑通完整业务闭环
**成本**: 1 人 8 周（或 2 人 5 周）
**置信度**: 70%

**明确 V1.0 不做**:
- ❌ PageEditor 画布编辑器（v2 假想，实际不存在）
- ❌ 引入 Formily 框架（学习成本 1 周 + 迁移 4 周）
- ❌ 49 页 el-form 全站画布化（只做客户演示路径 6 页）
- ❌ 6 套食品行业模板（整场会议只有 1 个客户）
- ❌ FormTemplate 前端可视化编辑器
- ❌ 3 种报工模式（per_process / per_product / per_batch），只做 per_process

### V2.0 — 产品演进愿景 (时间待定)

**目标**: 把 V1.0 的硬编码逐步沉淀为画布配置，实现多租户 SaaS 化
**触发条件**: V1.0 客户验收通过 + 至少 2-3 个新客户落地验证需求共性
**估算工期**: 12-16 周（但不在本次承诺范围）

**V2.0 范围预览**:
- 画布编辑器 (PageEditor 从零建)
- FormTemplate 可视化编辑器
- 前端 DynamicEntityForm 重构为全能表单渲染器（子表/联动/条件显示）
- 49 页 el-form → schemaJson 迁移
- 多行业模板（基于 V1.0 客户案例提炼，而非虚构）
- ToolRegistry per-factory 启用/禁用
- SmartBiSkill 加 factory_id + 版本管理
- RN App 端 schemaJson 共享渲染

---

## 3. 技术前提清单 (Week 1 必做)

### 3.1 🔥 factoryId 行级隔离审计 (P0-blocker)

**背景**: 300+ Tool 的 factoryId 透传一致性未验证。一旦六扇门客户在系统里看到别家工厂数据 → 当场退货 + 法律风险。审计脚本 Week 1 Day 1 必须开工。

**任务**:
1. 编写 `scripts/audit/tool-factory-isolation-audit.mjs`
2. 遍历 `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/**/*.java`
3. 检查每个 `doExecute` 方法是否使用 factoryId 参数
4. 检查每个 Service 的 Repository 调用是否带 factoryId WHERE 条件
5. 输出高危 Tool 清单（按风险排序）
6. 对所有 Repository finder 加跨工厂单元测试（跨工厂调用必须返回空）

**验收**:
- 审计 CSV 输出完整 (300+ Tool 全覆盖)
- 高危清单 ≤ 30（超过则升级为紧急响应）
- 所有高危 Tool 修复 PR 合并
- 跨工厂 E2E 自动化回归用例 100% 通过

### 3.2 schemaJson 设计原则 (不走 Formily)

**背景**: v2 假设用 Formily 渲染 schemaJson，但 `web-admin/package.json` 零 `@formily/*` 依赖。引入 Formily = 1 周学习 + 4 周迁移，不现实。

**v3 方案**: 用现有 el-form + props 包装层实现配置驱动

**设计约定**:
```typescript
// schemaJson 简化版 (不依赖 Formily)
interface SimpleFieldSchema {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'decimal' | 'array';
  required?: boolean;
  visible?: string;  // 条件表达式 (如 "category === 'raw'")
  default?: unknown;
  options?: Array<{value: string; label: string}>;  // for select
  children?: SimpleFieldSchema[];  // for array (子表)
}

interface EntitySchema {
  entityType: string;
  factoryId: string | null;  // null = 系统级
  fields: SimpleFieldSchema[];
}
```

**V1.0 只用 schemaJson 覆盖 3 个实体**:
1. `SALES_ORDER` — 销售订单（六扇门验证起点）
2. `RD_SAMPLE` — 研发样品（字段变化最多）
3. `BOM` — BOM 头部（物料明细仍用硬编码子表）

其余 46 个表单页保持硬编码。

### 3.3 BomItem.group 字段补齐

**背景**: v2 要求 BOM 物料拆 3 块（原料/辅料/包材），但 v2 路线图**漏掉 BomItem.group 字段**。

**任务**:
- `entity/inventory/BomItem.java` 加 `@Column material_group ENUM('RAW', 'AUXILIARY', 'PACKAGING', 'SEASONING')`
- 数据库迁移脚本
- 现有数据回填（根据物料名关键词自动分类 + 人工复核）
- 前端 BOM 编辑页按 group 分 3 个 tab

### 3.4 物料需求单 (MaterialRequisition) 实体补齐

**背景**: 客户原话 G3 "生产 6 步链路" 缺第 2 步"物料需求单"独立实体

**任务**:
- 新建 `entity/production/MaterialRequisition.java`
- 字段: `id / factory_id / production_plan_id / items[] / status / created_at`
- Repository + Service + Controller
- 与 ProductionPlan 联动: 计划创建时自动生成物料需求单

---

## 4. 需求清单 (按 P0/P1/P2/P3 + 拒收级别)

### 4.1 P0 立即修 (Week 1，本周必须开工)

> **v3.1 重排说明 (Apr 7 verification)**: 客户原话 2585-2974s 这一段连续讲了 "税率分组 → 财务审批 → 上传发票 PDF → 销售下载 → 出库后金额切换 → 定金尾款追踪", **是同一段连贯的财务诉求, 不能拆**. 因此 P0-3 现在是一个完整闭环, 把原 P0-10 (金额联动) 和原 P2-2 (附件回传) 合并进来.

| # | 需求 | 拒收级 | 来源 | 实体/文件 |
|---|------|--------|------|-----------|
| P0-1 | factoryId 行级隔离审计 + 修复 | 🔴 | Critic 新增 | `scripts/audit/*` + 各 Tool |
| P0-2 | 产品大类隔离 bug（G5，线上 bug 不是新功能）| 🔴 | 会议 1503s | `ProductCategoryServiceImpl` |
| **P0-3** | **开票完整闭环 (G1) — 税率分组 + 出库金额 + 附件回传** | 🔴 | 会议 2585-2974s | `InvoiceRecord.taxBreakdown` JSON + `InvoiceService.requestInvoiceFromOrder` (按出库金额) + `issueInvoice` 上传 PDF |
| P0-3a | └─ 税率分组聚合 (9% 原料 + 13% 加工费 自动按 SalesOrderItem.taxRate 分组) | 🔴 | 会议 2645s | ✅ 已实现 (commit 310b30a4) |
| P0-3b | └─ **金额按出库联动** (未出库=订单金额, 已出库=出库金额) | 🔴 | 会议 2906s "不然金额会对不上" | ⚠️ 需修 `aggregateByTaxRate` 接 shipped quantity |
| P0-3c | └─ **财务上传发票 PDF + 销售下载** (4 步闭环) | 🔴 | 会议 2585+2675s | `InvoiceRecord.invoicePdfUrl` 字段已有, `issueInvoice` 已经接受 MultipartFile, 待补 OSS 上传逻辑 + 前端下载 |
| P0-3d | └─ **同订单多次付款** (定金 + 尾款 + 凭证) | 🟡 | 会议 2931-2952s | PaymentRecord 已有, 前端弹窗已加备注字段, 待补凭证字段联动 |
| P0-4 | 销售运营报价流程（L1）| 🔴 | 会议 1670s | 新建 `OperationalQuote` 实体 |
| P0-5 | 物料需求单实体（G3）| 🔴 | 会议 3128s | 新建 `MaterialRequisition` |
| P0-6 | 指定人员授权（L2，不是岗位）| 🟡 | 会议 1737s | 权限表加 user_id |

### 4.2 P0 客户验收必须 (Week 2-4)

| # | 需求 | 拒收级 | 来源 | 说明 |
|---|------|--------|------|------|
| P0-7 | 销售订单 SKU 去重（A3.2）| 🔴 | 会议 1879s | 前后端校验 |
| P0-8 | 销售订单明细字段补全（A3.1）| 🟡 | v1 §2.4.1 | 已部分完成 (specification/box_quantity) |
| P0-9 | 销售订单 3 个状态字段（A3.4）| 🟡 | v1 §2.4.4 | payment/invoice/delivery status |
| ~~P0-10~~ | ~~销售订单金额联动 → **已合并到 P0-3b**~~ | — | — | 见 §4.1 P0-3b |
| P0-11 | 销售订单业务中心 tabs（A3.3）| 🔴 | 金矿截图 49m17s | 开票/出库/收款/采购 4 tab ✅ 已实现 (commit 80afe8bb). 关联采购 tab = 查询已有 PO (salesOrderId 关联), **不自动生成采购建议**. V1 现状: 采购员手工建 PO, 系统仅做关联展示. (2026-04-11 gap audit: 自动采购建议 feature 不存在, 确认手工流程即 V1 现状) |
| P0-12 | 生产计划必须关联销售订单（A3）| 🔴 | 会议 4141s | ProductionPlan 加 sales_order_id |
| P0-13 | PC 批次字段强制（A4）| 🔴 | 会议 5016s | ProductionReport + 出库单 |
| P0-14 | BOM 原辅料拆 3 块（A2）| 🔴 | 会议 1151s | BomItem.group 字段 + 前端 3 tab |
| P0-15 | 生产报工 mode_1（per_process，单一模式）| 🔴 | 会议 4587s | 不做 mode_2/3 |
| P0-16 | 手机端拍照签收（L7）| 🔴 | 会议 2820s | RN 出库单 + 附件上传 |
| P0-17 | 入库必须有发起单（A5）| 🔴 | 会议 4870s | 后端权限拦截 |
| P0-18 | 大组长/小组长角色分工（L16）| 🟡 | 会议 4677s | Role 表加 2 个角色 |

**P0 合计**: 18 项

### 4.3 P1 (Week 5-6)

| # | 需求 | 拒收级 | 来源 | 说明 |
|---|------|--------|------|------|
| P1-1 | 工人欠退/换岗扫码（L3）| 🟡 | 会议 4720s | 工时表加 checkout_reason |
| P1-2 | 周转耗材 SKU 化（L5，客户称"当下痛点"）| 🟡 | 会议 3438s | 销售订单加周转筐区 |
| P1-3 | 研发样品 3 页合 2 页（L12）| 🟡 | 会议 1007s | 前端路由调整 |
| P1-4 | 双仓体系（A9，物流仓+车间仓）| 🟡 | 会议 3225s | Warehouse.type 枚举 |
| P1-5 | 车间仓当天清仓定时任务 | 🟡 | 会议 3225s | 每日 20:00 cron |
| P1-6 | 销售订单列表智能筛选 tab | 🟢 | 金矿截图 49m38s | 未出库/部分出库/未收款等 6 tab |
| P1-7 | 预订合同附件上传 | 🟢 | 会议 2257s | 销售订单加附件字段 |
| P1-8 | 研发样品追踪记录表 | 🟡 | v1 §2.1.3 | 子表实体 |
| P1-9 | BOM 追踪记录（痕迹追踪）| 🟡 | v1 §2.2.6 | 子表实体 |

**P1 合计**: 9 项

### 4.4 P2 (验收后, Week 7+)

**客户原话明确降级** (5049-5054s): "采购、人事、财务这一部分，他不是特别紧急，可以后面慢慢往上"

| # | 需求 | 原 v2 等级 | v3 调整 |
|---|------|-----------|---------|
| P2-1 | 采购订单深化 (关联销售订单/主原料定点追踪) | v2 P0 | v3 P2 |
| ~~P2-2~~ | ~~开票申请流程完整闭环~~ → **已合并到 P0-3c (附件回传 4 步闭环)** | v2 P0 | **v3.1 提到 P0** |
| ~~P2-3~~ | ~~收款记录多账户+多次付款~~ → **部分合并到 P0-3d (定金+尾款+凭证)** | v2 P0 | **v3.1 部分提到 P0** |
| P2-4 | 人事模块 | v2 P2 | v3 P2 |
| P2-5 | 财务模块深化 (除 P0-3 外的报表/对账) | v2 P0 | v3 P2 |
| P2-6 | SmartBiSkill 加 factory_id | v2 P1 | v3 P2 (非演示路径) |

### 4.5 P3 愿景 (V2.0, 不承诺时间)

| # | 需求 |
|---|------|
| P3-1 | PageEditor 画布编辑器 (从零建) |
| P3-2 | FormTemplate 可视化编辑器 |
| P3-3 | DynamicEntityForm 重构为全能渲染器 |
| P3-4 | 49 页 el-form → schemaJson 全迁移 |
| P3-5 | 6 套食品行业模板 (基于多客户案例，非虚构) |
| P3-6 | ToolRegistry per-factory 启用/禁用 |
| P3-7 | RN App 端 schemaJson 共享渲染 |
| P3-8 | 数字大屏 (车间工序进度) |
| P3-9 | 3 种报工模式 (mode_2/mode_3) |
| P3-10 | 钉钉集成 |
| P3-11 | Formily 引入 (若决定走这条路) |

---

## 5. 8 周里程碑 + DoD

### Week 1 — 技术前提 + 硬伤修复

**任务**:
- D1 AM: factoryId 隔离审计脚本 (3h)
- D1 PM: 跑审计 + 标红高危 (3h)
- D2: 产品大类 bug 修复 (6h)
- D3: 税率分组开票后端 (8h)
- D4: 税率分组开票前端 (6h) + 运营报价数据建模 (4h)
- D5: 运营报价 API+UI (8h) + 物料需求单 stub (2h)

**DoD**:
- [ ] factoryId 审计 CSV 输出，高危清单 ≤ 30
- [ ] 所有高危 Tool 修复 PR 合并
- [ ] 跨工厂 E2E 自动化回归用例 100% 通过
- [ ] 产品大类 bug 关闭（六扇门工厂选"成品"不能看到"原料"）
- [ ] 税率分组开票单测覆盖 9%+13% 混合场景
- [ ] 运营报价流程创建→审批→转订单 E2E 通过
- [ ] 物料需求单实体+基础 CRUD 上线

### Week 2 — 销售订单业务中心 + schemaJson 试点

**任务**:
- 销售订单 4 tab（开票/出库/收款/采购关联）
- 销售订单 3 状态字段 + 金额联动
- 销售订单 SKU 去重校验
- **schemaJson 试点**: 销售订单使用 `SimpleFieldSchema` (不依赖 Formily)
- 指定人员授权（取代岗位）

**DoD**:
- [ ] 销售订单详情页 4 tab 全部可联动（基础版）
- [ ] 同产品加两行触发前后端校验错误
- [ ] 金额显示随订单状态切换正确
- [ ] `SALES_ORDER` 的 schemaJson 存入 DB，前端能读取并渲染
- [ ] 六扇门用"指定人员"创建订单，权限正确

### Week 3 — 生产计划 + 报工 + 仓库 PC

**任务**:
- 生产计划必须关联销售订单
- ProductionPlan 加 sales_order_id 必填
- 生产报工 mode_1（工序维度累积）
- PC 生产批次字段（所有批次实体）
- 出库单 FIFO 推荐
- BomItem.group 字段 + 前端 3 tab
- 入库单必须有 source_doc_id 权限拦截

**DoD**:
- [ ] 生产计划创建时必须选销售订单（无选项则失败）
- [ ] 报工支持同一工序多次累积
- [ ] 出库单自动按 production_date 升序建议批次
- [ ] BOM 编辑页显示"原料 / 辅料 / 包材" 3 个 tab
- [ ] 仓库自建入库被拒绝（除盘点）
- [ ] `BOM` 实体的 schemaJson 试点（只头部字段）

### Week 4 — P0 收尾 + 内部 dry-run

**任务**:
- 拍照签收（RN 出库单）
- 大组长/小组长角色
- 研发样品 schemaJson 试点
- 🎯 **内部 dry-run**（PM + 销售 + 1 名外部观察员）
- 收集"客户可能反悔点"清单
- 编写客户演示话术

**DoD**:
- [ ] RN App 出库单拍照上传功能完成
- [ ] 大小组长角色 E2E 测试通过
- [ ] `RD_SAMPLE` 的 schemaJson 试点完成
- [ ] Dry-run 会议纪要 + 反悔点清单
- [ ] 演示话术 reviewed by PM
- [ ] V1.0 需求基线确认（避免后续漂移）

### Week 5 — P1 前半 (欠退 + 周转耗材)

**任务**:
- 工人欠退/换岗扫码机制
- 周转耗材 SKU 化（销售订单加周转筐区）
- 双仓体系（Warehouse.type）
- 车间仓当天清仓定时任务

**DoD**:
- [ ] 工人中途下班扫码，工时表记录 checkout_reason
- [ ] 周转筐作为商品做进销存
- [ ] 双仓 E2E: 物流仓 → 车间仓 → 生产 → 退料回物流仓
- [ ] 20:00 cron 自动清仓任务生效

### Week 6 — P1 后半 (研发 + 追踪)

**任务**:
- 研发样品 3 页合 2 页
- 研发样品追踪记录表
- BOM 追踪记录
- 销售订单列表智能筛选 tab (6 个)
- 预订合同附件上传

**DoD**:
- [ ] 研发样品路由合并为 2 页（研发管理 + 转化成品）
- [ ] 追踪记录子表支持增删改查 + 附件
- [ ] 销售订单列表 6 个筛选 tab 切换正确

### Week 7 — E2E 回归 + AI 意图保护

**任务**:
- 169 个 AI 意图全量回归测试
- factoryId 隔离完整回归
- BERT classifier 健康检查
- 性能测试（Tool 执行时间、表单渲染时间）
- 六扇门 F006 工厂完整数据初始化

**DoD**:
- [ ] 169 意图回归通过率 ≥ 98%
- [ ] factoryId 隔离回归 100% 通过
- [ ] Tool 执行 P95 < 500ms
- [ ] F006 工厂 10+ 产品/5+ BOM/3+ 销售订单就绪

### Week 8 — 客户演示 + 验收

**任务**:
- 客户正式演示
- 验收 sign-off
- 遗留问题清单
- V2.0 路线图与客户对齐

**DoD**:
- [ ] 客户签字验收确认书
- [ ] 遗留问题清单明确优先级
- [ ] V2.0 启动条件与客户书面确认

---

## 6. 风险登记册

| # | 风险 | 概率 | 影响 | 分数 | 缓解措施 |
|---|------|------|------|------|---------|
| R1 🔥 | factoryId 隔离漏洞 → 跨工厂数据泄露 | 40% | 致命 | **16** | W1 必修 + 双人 review + 自动化回归 |
| R2 🔥 | 客户反悔"采购不紧急"口头承诺 | 55% | 高 | **11** | W4 dry-run 时让 PM 重新确认书面 |
| R3 🔥 | W4 发现 schemaJson 设计方向错，回滚 2 周 | 30% | 高 | **9** | W1-W2 做小步 spike，不一次性铺开 |
| R4 | 49 页硬编码迁移诱惑 → 范围蔓延 | 50% | 中 | **7.5** | W1 锁定 3 个试点实体，其余进 V2.0 |
| R5 | 169 意图 W7 回归不通过 | 25% | 高 | **6** | W3 起每周跑一次增量回归 |
| R6 | v2 "4 周"承诺已对外发布，推翻信任成本 | 60% | 中 | **9** | W1 D1 PM 与客户/老板重新对齐 |
| R7 | 单人病假/中断 | 15% | 高 | **4.5** | W4 后允许加人，W1-W3 不允许 |
| R8 | BERT classifier 故障导致 AI 准确率掉 6% | 20% | 中 | **3** | 每周 W3+ 做 classifier 健康检查 |
| R9 | 客户演示时发现 RN App 报工流程与 PC 端不一致 | 35% | 中 | **5.25** | W4 dry-run 覆盖 RN + PC 双端联调 |

---

## 7. 开放决策项 (抛回 PM / CEO)

| # | 问题 | 决策方 | 截止 | 建议方向 |
|---|------|--------|------|---------|
| Q1 | 6 套行业模板砍 5 套还是保留？（越权决策） | CEO/PM 商业战略 | W1 D2 | 建议砍到 1 套（六扇门），V2.0 再基于实际客户案例提炼 |
| Q2 | v2 4 周计划是否已对客户/老板承诺？推翻成本？ | PM | W1 D1 | 必须先确认，否则 W1 工作无法启动 |
| Q3 | 是否接受 V1.0 (8 周 P0-P1) + V2.0 (画布愿景) 双阶段？ | PM + CEO | W1 D2 | 建议接受，v3 已按此设计 |
| Q4 | 采购/人事/财务从 P0 降到 P2 是否需要客户书面确认？ | PM + 销售 | W1 D3 | 建议 W2 客户对齐会上书面确认 |
| Q5 | factoryId 审计若发现 > 50 个高危 Tool，是否延期演示 1-2 周？ | PM | W1 D5 | 视审计结果决定 |
| Q6 | Formily 是否引入？（V2.0 决策，W4 前定方向） | 技术负责人 | W4 | v3 建议不引入，用 SimpleFieldSchema + el-form |
| Q7 | 49 页硬编码是进 V2.0 commit 还是按需迁移？ | 技术负责人 | V1.0 验收后 | 建议按需迁移（每个新客户带 1-3 页） |
| Q8 | V2.0 启动条件是什么？（客户数？收入？）| CEO | V1.0 中期 | 建议"2-3 个验收客户 + 画布化 ROI 清晰" |

---

## 8. 与 v2 的关键差异

| 维度 | v2 | v3 | 理由 |
|------|-----|-----|------|
| **工期** | 4 周 | **8 周** | 真实工作量 2-3x（audit 核实） |
| **架构承诺** | "画布配置驱动 + 不写一行代码" | "硬编码 + 3 实体 schemaJson 试点" | PageEditor 零存在 + Formily 零依赖 |
| **优先级** | 采购/人事/财务 P0 | **P2** | 客户原话"不特别紧急" |
| **模板数量** | 6 套行业模板 | **1 套（六扇门）** | 整场会议只有 1 个客户 |
| **报工模式** | 3 种（per_process/product/batch）| **1 种（per_process）** | 客户只要这 1 种 |
| **新增 P0** | 无 | **factoryId 隔离审计** | Critic 新增，避免跨工厂数据泄露 |
| **遗漏补齐** | - | **17 项 L1-L17** | G1 税率分组 / L1 运营报价 / L3 欠退 / L12 研发 3→2 页等 |
| **schemaJson** | Formily Schema | **SimpleFieldSchema (自研)** | 不引入 Formily |
| **前端改造范围** | 全站（49 页）| **3 个试点实体** (SO/RD_SAMPLE/BOM 头部) | 避免范围蔓延 |
| **P0 数量** | 模糊（v2 A1-A12 + 6 模板）| **18 项，明确** | 可跟踪 |
| **里程碑** | 无具体 DoD | **每周 5-8 条 DoD** | 可验收 |
| **dry-run** | 无 | **W4 内部 dry-run** | 提前暴露客户反悔点 |

---

## 9. 立即行动 (v3 发布后 D1 任务)

**D1 上午** (必须 PM/CEO 决策 Q1/Q2/Q3 才能启动):
1. 将 v3 + audit 发给 PM，2 小时内拿到 Q1/Q2/Q3 反馈
2. 若 Q2 显示 v2 已对客户承诺 → 先由 PM 与客户对齐工期调整
3. 启动 factoryId 审计脚本编写

**D1 下午** (决策通过后):
1. 跑审计 + 输出高危清单
2. 发给团队 review

**D2-D5**: 按 §5 Week 1 任务清单执行

---

## 10. 附录

### 10.1 关键文件路径清单

**后端核心实体** (需要改):
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/sales/SalesOrder.java` (加 3 status + sales_order_id 关联; 税率分组实际落在 `InvoiceRecord.tax_breakdown` JSONB — 见 §4.1 P0-3a)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/production/ProductionPlan.java` (加 sales_order_id 必填)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/production/ProductionReport.java` (加 pc_code + production_date)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/BomItem.java` (加 material_group)
- **新建** `entity/production/MaterialRequisition.java`
- **新建** `entity/sales/OperationalQuote.java`

**前端核心文件** (需要改):
- `web-admin/src/views/sales/orders/list.vue` (584 行，重点关注 onProductSelect/calcBox)
- `web-admin/src/views/sales/orders/detail.vue` (加 4 tab 业务中心)
- `web-admin/src/views/factory/products/list.vue` (产品大类 bug)
- `web-admin/src/views/production/plans/*` (生产计划必关联销售订单)
- `web-admin/src/views/material/bom/*` (BOM 原辅料 3 tab)
- `frontend/CretasFoodTrace/src/screens/outbound/*` (RN 拍照签收)

**新建脚本**:
- `scripts/audit/tool-factory-isolation-audit.mjs`
- `scripts/migration/bomitem-group-backfill.sql`
- `scripts/migration/sales-order-status-fields.sql`

### 10.2 会议转录 + 关键帧索引

- 转录全文: `temp/meeting-transcribe/transcript.txt` (94KB, 1915 段)
- 关键帧: `temp/meeting-transcribe/frames_all/` (292 张)
- v1 金矿截图索引: 见 v1 §6.1

### 10.3 画布系统真实状态 (audit 核实)

| 系统 | 状态 | 验证方式 |
|------|------|---------|
| `LowcodePageConfig` | ✅ 后端实体+约束齐全 | Read Entity |
| `FormTemplate` | 🟡 后端齐全，前端无消费层 | Grep `formTemplateService` 前端零引用 |
| `FactoryFeatureConfig` | 🟡 后端齐全，前端 Grep 零引用 | Grep 验证 |
| `AIIntentConfig` | ✅ 已有 11+ by-factory finder | Read Repository (推翻 Researcher A) |
| `SmartBiSkill` | ❌ 无 factory_id | Read Entity |
| `ToolRegistry` | 🟡 execute() 拿 factoryId，无缓存 | Read AbstractBusinessTool |
| `DynamicEntityForm.vue` | 🟡 207 行 9 字段，读本地 TS 不调 API | Read 全文 + Grep usage |
| `PageEditor` | ❌ **组件零存在** | Grep 零结果 |
| `@formily/*` | ❌ **零依赖** | package.json 验证 |
| 49 页 el-form | ⚠️ 硬编码现状 | Grep `<el-form` |

---

**文档版本**: v3.0
**状态**: 待 PM/CEO 决策 Q1-Q3 后启动
**责任人**: Steven + PM
**下次更新**: W1 D1 PM 决策反馈后
**关联文档**:
- `customer-meeting-apr7-requirements.md` (v1)
- `customer-meeting-apr7-requirements-v2.md` (v2 — 已降级为 V2.0 愿景文档)
- `customer-meeting-apr7-requirements-v2-audit.md` (v2 审核报告)
