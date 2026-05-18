# Canvas 业务规则引擎 — 产品愿景

**Created**: 2026-05-18
**Author**: Steve + Claude (chat session bb64271a)
**Status**: Vision / Pre-spec (待拆解为 Phase 1-7 implementation specs)
**Origin**: F006 客户 (六膳门食品科技) 反馈 — 审批规则要自由配置 + AI 自然语言操作

---

## TL;DR

把 **Canvas 从"页面/字段编辑器"升级为"业务规则可视化引擎"** —
通过抽象 Canvas-Core 内核 + 7 个 domain 扩展模块, 让客户**自服务**配置所有业务规则
(审批/预警/通知/价格/校验/定时/权限), 并通过 **AI 自然语言**操作.

**核心差异化**: 客户老板能自己用 + AI 一句话改 — 其他 ERP (金蝶/用友/SAP) 都做不到.

---

## 1. 现状盘点 (2026-05-18)

### Canvas 体系已有 (Phase 0)
- **可视化编辑器**: `web-admin/src/views/platform/canvas-editor/`
- **AI Tools** (~20 个): `backend/.../ai/tool/impl/canvas/Canvas*Tool.java`
- **Dynamic Fields**: `CanvasDynamicFields.vue` + `DynamicModulePage`
- **Module wrapper**: `CanvasAwareWrapper.vue` (业务模块自动应用 Canvas 配置)
- **数据存储**: `canvas_dynamic_fields` 表

### 已建但**独立**的 (待合并进 Canvas)
- `approval-workflow-editor/` — 独立 DAG 编辑器 (废弃合并)
- `purchase_order_approval_rules` 表 + `PurchaseApprovalRuleController` (PR #859 stop-gap)

### 硬编码散落 (要消灭的 ~12 处)
| 模块 | 当前 Service |
|---|---|
| 采购单财务复核 | `PurchaseServiceImpl.evaluateApprovalTrigger()` |
| 销售单财务复核 | `SalesOrderService` |
| 退货 / 调拨 / 报废 / 盘点 / 开票 / 收款 | 各 Service |
| HR 请假/报销 / BOM 变更 / 物料申购 / 工序完工 | 各 Service |

---

## 2. 架构 — Canvas-Core + 7 Domain 扩展

```
Canvas-Core (内核, 所有模块共用)
├── Canvas-Schema      — 通用 JSON schema (id / type / props / children)
├── Canvas-Renderer    — 通用渲染器 (DAG / Form / List)
├── Canvas-Editor      — 通用编辑器 UI (拖拽 + 属性面板 + palette)
├── Canvas-Engine      — 运行时引擎 (按 schema 执行)
└── Canvas-AI-ToolBase — AI Tool 抽象基类
   ↓
   ├── canvas-fields/   (已有) — 字段节点 ★
   ├── canvas-layout/   (已有) — 布局节点 ★
   ├── canvas-workflow/ (Phase 1) — 审批流程节点 ⭐
   ├── canvas-alerts/   (Phase 2) — 库存/质量预警 ⭐
   ├── canvas-notify/   (Phase 3) — 通知触发器 ⭐
   ├── canvas-rules/    (Phase 4) — 业务规则/校验 ⭐
   ├── canvas-pricing/  (Phase 5) — 价格策略 ⭐
   ├── canvas-cron/     (Phase 6) — 定时任务 ⭐
   └── canvas-permission/ (Phase 7) — 权限矩阵 (远期) ⭐
```

---

## 3. 7 个 Domain 详解

### 3.1 ⭐ Canvas-Workflow (审批流程)

**形态**: 拖拽 DAG (开始/判断/审批/通知/终态).

**用在 12 业务**:
采购 / 销售 / 退货 / 调拨 / 报废 / 盘点 / 开票 / 收款 / 请假 / 报销 / BOM 变更 / 物料申购.

**谁用**:
- 配置: factory_super_admin / permission_admin
- 触发: 业务用户 (procurement_mgr 提单 → 触发)
- 审批: 各级 (finance_mgr / 部门主管 / 总监)

**AI 例子**:
- "把采购金额阈值改成 5 万" → AI 找节点 → preview → 改阈值
- "在销售订单加二级总监审批" → AI 加节点 → preview → 加 DAG 行

---

### 3.2 ⚠️ Canvas-Alerts (预警规则)

**形态**: if-then 规则, 不需要 DAG.

```
[规则名]: 冻猪蹄低库存预警
触发: 当 [冻猪蹄] [< 30 kg] 或 [过期 < 7 天]
动作: ☑ 仪表盘红 ☑ 推送采购员 ☑ 邮件 warehouse@六腾门.com
[启用] ✓
```

**用在**:
原料/成品低库存 / 临期 / 质量合格率低 / 设备故障率高 / 应收逾期 / 任何数值业务指标.

**谁用**: factory_super_admin / 部门主管 (配) + 各角色 (收).

**AI 例子**:
- "冻猪蹄低于 50 给采购员发钉钉"
- "再加: 过期前 10 天也提醒"

---

### 3.3 📢 Canvas-Notify (通知规则)

**形态**: 事件触发器 + 接收者矩阵.

```
[规则名]: 销售订单状态变化通知
触发: ☑ 订单 创建 ☑ 财务通过 ☑ 完成发货
接收:
  销售员: ✓微信 ✗钉钉 ✗邮件
  生产经理: ✓微信 ✓钉钉
  客户: ✗ ✗ ✓邮件
模板: "订单 {orderNumber} 状态: {oldStatus} → {newStatus}"
```

**用在**: 订单状态变化 / 生产完工 / 入库 / 设备故障 / 应收逾期.

**谁用**: factory_super_admin (配) + 全员 (收).

**AI 例子**: "订单完成发货时给客户发邮件" → 一句话配规则.

---

### 3.4 💰 Canvas-Pricing (价格策略)

**形态**: 阶梯规则表 + 条件匹配.

```
匹配: IF 客户=叮咚 AND 月采购>¥10万 THEN 5%折扣
      ELIF 客户=叮咚 AND 月采购>¥5万 THEN 3%折扣
      ELIF 客户.评级=A THEN 2%折扣
      ELSE 0%

应用: ☑ SO 单价自动算 ☑ 报价单显示参考价
```

**用在**: 销售订单单价自动算 / 报价单 / 促销 (满减) / 阶梯采购 (供应商批量折扣).

**谁用**: sales_manager (配) + 自动生效.

**AI 例子**: "叮咚月采购超 10 万给 5%" → AI 配规则.

---

### 3.5 📋 Canvas-Rules (业务规则 / 校验)

**形态**: 字段联动 / 跨字段约束.

```
适用: 销售订单
规则 1: 交货日期 >= 今天+3天 ("六腾门生产周期")
规则 2: 订单 > ¥5万 必填合同附件
规则 3: 客户协议价 vs 订单单价 → 黄色警示偏离
```

**用在**: 字段必填 / 联动 / 校验 / 大额必传附件 / 跨实体约束 (库存不足不让下产) / 防呆.

**谁用**: factory_super_admin (配) + 所有用户提单时自动校验.

**AI 例子**: "销售订单超 5 万必传合同" → AI 加校验规则.

---

### 3.6 ⏰ Canvas-Cron (定时任务)

**形态**: cron 表达式 + 触发动作.

```
[任务]: 每月 1 号生成上月销售报表
执行: 每月 1 日 09:00 (cron: 0 0 9 1 * ?)
动作: ☑ 生成报表 ☑ 邮件给财务+总经理 ☑ 归档报表中心
历史: 最近 5 次执行 ✓ 全成功
```

**用在**: 日/月/季报表生成 / 库存盘点提醒 / 应收催收 / 数据归档 / 备份.

**谁用**: factory_super_admin / it_admin (配) + 系统自动跑.

**AI 例子**: "每周一早 9 点生成上周库存报表" → AI 加 cron.

---

### 3.7 🔐 Canvas-Permission (权限矩阵, 远期)

**形态**: 角色 × 模块 矩阵 + 字段级粒度.

```
角色\模块       采购    销售    生产    财务
admin           ✓写    ✓写    ✓写    ✓写
procurement_mgr ✓写    ○读    ○读    ○读
sales_mgr       ○读    ✓写    ○读    ○读

字段级: 销售员能看采购但**看不到单价** ✓
```

---

## 4. 完整模块使用 — 4 类入口

### 入口 A: 平台管理员配 (1 次性)
平台管理 → Canvas 配置中心 → 选模块 → 拖配规则.

### 入口 B: 业务用户使用 (透明)
采购员下单 → 系统按 Canvas 自动应用规则 (审批/价格/校验) → 业务用户感受不到背后规则.

### 入口 C: AI 助手 (自然语言)
任何 admin 点 🤖 → 对话 → AI 调 Canvas Tools → preview → 立即生效.

### 入口 D: API 集成 (远期)
客户 ERP/OA/钉钉 → webhook → /api/canvas/trigger/{module}/{event} → Canvas Engine 跑.

---

## 5. 用户画像 (5 角色)

| 角色 | 用法 | 频率 |
|---|---|---|
| **factory_super_admin** | 配规则 + 改流程 + AI 操作 | 每周几次 (初期密集) |
| **permission_admin** | 配权限矩阵 | 月度 |
| **部门主管** | 配本部门审批/通知 | 月度 |
| **业务员工** | **透明使用** (不直接看 Canvas) | 每天 |
| **Cretas 运维** | 监控客户配置 + 调优 | 按需 |

---

## 6. AI 能力图

### 已能 (Phase C 完成后)
- ✏️ 加 / 改 / 删 任何 Canvas 节点
- 📊 查询当前配置
- 🔄 切启用/禁用
- 📜 看历史变化
- 🧪 模拟运行 ("假设 PO ¥5 万会怎么走?")
- ⚠️ 风险提示 ("要关闭 12 模块全部审批?")

### 远期 AI 升级
- 🎯 **主动建议**: "本月 3 单大额 PO 都卡 2 天+, 建议加运营审"
- 📈 **数据驱动**: "90% 销售单 < ¥5万, 建议把财务审阈值改 ¥5万 → 月省财务 X 小时"
- 🔍 **异常检测**: "10 个 PO 都因没上传合同被驳回, 要自动加这条校验吗?"
- 🎨 **流程克隆**: "把销售流程复制到退货, 改 2 节点适配"

---

## 7. 实施路线图

```
Phase 1 (3-4 天): Canvas-Workflow ⭐⭐⭐ (F006 已要)
  └ 同时抽出 Canvas-Core 通用层

Phase 2 (2-3 天): Canvas-Alerts (库存/质量预警 — 常需求)
Phase 3 (2-3 天): Canvas-Notify (通知 — 跨模块基础)
Phase 4 (3-4 天): Canvas-Rules + Canvas-Pricing
Phase 5 (2 天):   Canvas-Cron

总: 12-16 天工程量
```

每 Phase ship 后客户立即可用.

---

## 8. 跟竞品对比

| 能力 | 金蝶/用友 | SAP | Cretas (做完后) |
|---|---|---|---|
| 字段自定义 | ✅ 基础 | ✅ 强 | ✅ Canvas |
| 流程可视化 | ⚠️ 有但复杂 | ✅ BPM 强 | ✅ Canvas + AI |
| 业务规则可配 | ⚠️ 部分 | ✅ DRL | ✅ Canvas |
| **AI 自然语言操作** | ❌ | ⚠️ 实验 | **✅ 全功能** ⭐ |
| 价格策略可视化 | ❌ | ⚠️ | ✅ |
| 预警规则可配 | ⚠️ 硬 | ✅ | ✅ |
| **客户自服务** | ❌ | ⚠️ 顾问配 | **✅** ⭐ |

**核心差异化**: **客户老板能自己用 + AI 一句话改**.

---

## 9. F006 客户预期上线 1 月后

- 自己进 Canvas 配完 12 模块审批 + 8 预警 + 5 通知
- **完全不需要联系 Cretas 改代码**
- AI 助手日常用 ("今天加个折扣规则" 一句搞定)
- 数据看板看到所有规则执行情况

**老板评价**: "上 ERP 上得最爽的一次"

---

## 10. 已 ship 的 Phase 0 处理建议

- **保留**: PR #859 (PurchaseApprovalRuleController + UI) 不删
- **标 deprecated**: Javadoc + UI callout "将在 Phase 1 后合并到 Canvas"
- **Phase 1 完成时**: 写 migration `purchase_order_approval_rules → canvas_workflow_nodes`, 数据保留

---

## 附录 — 关键文件 (chat 起点)

### Canvas 体系
- Editor: `web-admin/src/views/platform/canvas-editor/`
- Tools: `backend/.../ai/tool/impl/canvas/`
- Components: `web-admin/src/components/canvas/`
- Schema: `backend/.../entity/config/CanvasDynamicField.java`

### 现有独立 (待合并)
- Approval editor: `web-admin/src/views/platform/approval-workflow-editor/`
- Phase 0 stop-gap: `PurchaseApprovalRuleController.java` + `procurement/approval-rules/list.vue`

### 硬编码 (待清理)
- `PurchaseServiceImpl.evaluateApprovalTrigger`
- 11 其他业务 Service

### 项目规范
- `.claude/rules/ai-intent-tool-skill-architecture.md`
- `.claude/rules/fool-proof-design.md`
- `CLAUDE.md`

---

**下一步**: 把此 vision 拆解为 Phase 1 (Canvas-Workflow) 的 implementation spec, dispatch 给另一个 chat 实施.
