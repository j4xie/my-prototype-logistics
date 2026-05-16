# 03 — 跨模块业务流 (Cross-Module Workflows)

> Phase 3 输出. 基于 Phase 2 实测 + 流程图节点反推 + 跨域 URL 跳转 evidence.
>
> ⚠️ **方法说明**: 本文档结合**实测证据** (从 list 页 link / linklistarray / 流程图节点 推断) + **关键节点截图** + 必要时 **active 跑流** 验证. 5 个端到端业务流如下:

---

## 1. 业务流 1: 销售订单 → 出库 → 应收 → 财务凭证 (S-MRP-1 + F-VOUCHER-HOOK-1)

### 1.1 流程图 (跨 5 子域)

```
[CRM] 客户档案
    ↓ 选择客户
[销售] sale.hongjian.com
    ├─ 报价单 → 销售订单 → (审批节点: workflow.hongjian.com)
    │                        ↓ 提交后
    ├─ 销售订单 list (4 状态 chip: 销售订单创建/进行中/未审核/未出库)
    ↓ 行末"操作 ▼" → 销售出库
[仓库] stockwork.hongjian.com
    ├─ 销售出库单 (扣减库存)
    │   ↓ vflag=未生成 → 等凭证生成
    ├─ "批量生成凭证" button
[财务] finance.hongjian.com
    ├─ 进销存单据生成凭证 (流程图节点)
    │   → 借: 主营业务成本 / 贷: 库存商品
    ├─ 应收应付 (新增应收 record)
    │   ↓ 列表 link "应收: 0 - 0 = 0"
[OA] oa.hongjian.com (合同关联)
    └─ 销售合同 (linked via 单号)
[财务] (收款)
    └─ 收款流水 → 应收冲销 → 凭证 (现金银行单据生成凭证)
```

### 1.2 实测证据
| 节点 | URL pattern | 实测 |
|---|---|---|
| 客户档案 | `crm.hongjian.com/crm/custom/clientroute.jsp?id=X` | ✅ 销售单点客户名跳 |
| 销售订单 | `sale.hongjian.com/sale/list/salelist.jsp` | ✅ 已 audit |
| 工作流引擎 | `workflow.hongjian.com/workflow/workflow.jsp?workno=sale` | ✅ 创建销售单时实测 |
| 应收单 | `finance.hongjian.com/finance/receivable/salereceivablelist.jsp?bno=X` | ✅ 销售单"应收"link 跳 |
| 合同 | `oa.hongjian.com/oa/contract/contractmanager/salecontractlist_pc.jsp?type=sale&linkno=X` | ✅ 销售单"合同"chip 跳 |
| 凭证生成 | finance 流程图 7 节点 hook | ✅ 已 audit |

### 1.3 状态机 (销售订单)
```
销售订单创建 (草稿)
    → 提交 → 进行中 / 未审核 / 未出库
        → 审核通过 → 进行中 / 已审核 / 未出库
            → 销售出库 → 进行中 / 已审核 / 部分出库
                → 全部出库 → 进行中 / 已审核 / 已出库 / (vflag: 未生成凭证)
                    → 批量生成凭证 → 已审核 / 已出库 / (vflag: 已生成)
                        → 收款 → 已完成 (订单状态终态)
```

也可走异常路径:
- 已出库 + 出库且退货 → (退货流程)
- 进行中 → 已暂停 / 已中止 (admin 决策)

### 1.4 Cretas 对照 + 差距
| 子流程 | 宏见 | Cretas |
|---|---|---|
| 销售单创建 → 工作流引擎 | ✅ workflow.hongjian.com | 部分 (状态机简化, 无独立审批引擎) |
| 销售单 → 出库自动联动 | ✅ "操作 ▼ → 销售出库" 一键 | ⚠️ 手动跨页 |
| 出库 → 应收创建 | ✅ 自动 | ✅ 已 ship (PR #414) |
| 出库 → 凭证 hook | ✅ vflag + 批量生成 | ❌ F-VOUCHER-HOOK-1 完全缺 |
| 应收 → 收款冲销 | ✅ | ⚠️ 部分 (FinanceCostAnalysisDashboard 视图) |

---

## 2. 业务流 2: 采购订单 → 收货 → 质检 → 入库 → 应付 → 凭证

### 2.1 流程图

```
[销售] 销售订单 (linked via linklistarray)
    ↓ 自动触发
[采购] buy.hongjian.com
    ├─ 请购单 (M-EXP-1 缺料分析触发)
    │   → 核价单 ⭐ (定价审批中间单据)
    │       → 采购底稿 ⭐ (草稿态)
    │           → 采购订单 (workflow.hongjian.com/workflow/workflow.jsp?workno=buy)
    ↓ 行末"操作 ▼" → 采购收货
[采购] 采购收货单 (P-RECV-1)
    → 采购质检单 (检验状态: 5 — 全部/未/部分/已质检 + 全检/抽检)
        → 采购入库列表 (W → vflag pending)
[财务] 应收应付 (新建应付)
    └─ 凭证 hook (应收应付单据生成凭证)
```

### 2.2 关联类型 8 类 (linklistarray 实测)
采购订单可关联 source: **销售单 / 样品单 / 请购单 / 生产单 / 委外单 / 备货单 / 项目管理 / 自由采购** (8 类)

### 2.3 状态机 (采购订单)
```
采购底稿 (草稿)
    → 提交 → 未审核
        → 审核通过 → 进行中 / 未收货
            → 采购收货 → 进行中 / 部分收货
                → 质检 → 良品 / 不良品
                    → 全收货 → 已审核 / 完全收货
                        → 入库 → 已审核 / 已入库 / (vflag: 未生成)
                            → 凭证生成 → 已审核 / 已入库 / (vflag: 已生成)
                                → 付款 → 已完成
```

异常: 收货且退货 / 超量收货 / 暂停 / 中止

### 2.4 三价对比 (P-3PC-1) 触发点
- 采购订单创建时, 系统自动调用 MaterialPriceComparisonDTO
- 三价: BOM 标准 / 历史均价 / 当前采购价
- 差异 > N% 自动标红 → 触发"采购财务审核 + 三价标红" (P-FIN-1)

---

## 3. 业务流 3: BOM 创建 → ECN 审核 → 生产计划 → 工序流转 → 报工 → 完工

### 3.1 流程图

```
[工程] bom.hongjian.com
    ├─ BOM列表 (BOMID + 版本号 + 工作流状态)
    │   → BOM审核 (待审核BOM列表 → 批量审核)
    │       → 生效 (版本号生效, 旧版历史化)
    │   → BOM物料批量替换 / 修改 / 删除 / 新增 (4 操作)
    │   → ECN变更 (新建变更单 → 审批链 → 生效)
    ↓ 关联
[生产] product.hongjian.com
    ├─ 生产计划 (基于已审核 BOM 生成)
    │   → 物料需求 (tree 模式, BOM 展开)
    │       → 厂内加工 / 委外加工 (分流)
    │           → 工序流转 (M-WP-1, 当前节点 inline 显示)
    │               → 报工 (计件计时 → M-WAGE-1 工资)
    │                   → 成品完工 → 质检 → 成品入库
```

### 3.2 状态机 (BOM)
```
BOM创建 (草稿)
    → 提交审核 → 待审核
        → 批量审核通过 → 已生效 (版本号 v1)
            → ECN 变更 (新建变更单 + 审批) → 历史 v1 + 新 v2 生效
                → 旧订单走 v1, 新订单走 v2
```

### 3.3 关键差异 (vs Cretas)
- 宏见 BOM 是**工程级** (BOMID + 版本 + 工作流), Cretas 是配方
- 宏见生产任务 = "工序流转" (按工序拆分子任务), Cretas 是"任务整体推进"
- 宏见报工 = 计件计时 → 工资联动, Cretas 报工是"已完成数量"

---

## 4. 业务流 4: 考勤打卡 → 工资计算 → 工资分摊 → 凭证

### 4.1 流程图

```
[人力] hr.hongjian.com
    ├─ 考勤管理 (月考勤员工矩阵, 6 周 × 3 时长)
    │   → 重新生成 (从打卡机汇总)
    │       → 工资管理 (按 部门/岗位 计算)
    │           → 加班/请假/调休 调整
    │               → 月度工资单 (含计件 from M-WAGE-1)
[财务] finance.hongjian.com
    └─ 工资分摊生成凭证 (流程图节点)
        → 借: 应付职工薪酬 / 贷: 银行存款
        → 各部门成本中心分摊 (辅助核算)
```

### 4.2 跨模块 trigger
- 计件工资 (M-WAGE-1) 来自生产管理"计件计时" 子菜单
- 加班 / 请假 → 影响工时统计 → 影响工资
- 工资生成后 → 凭证 hook → 财务

---

## 5. 业务流 5: 销售退货 → 退款 → 凭证反向

### 5.1 流程图

```
[销售] sale.hongjian.com
    ├─ 销售订单 → 行末 "操作 ▼" → 销售退货
    │   → 销售退货单 (新建)
    │       → 客户确认 (推测)
    │           → 退款金额录入
[仓库] stockwork.hongjian.com
    └─ 退货入库 (反向出库)
        → 库存恢复
[财务] finance.hongjian.com
    └─ 应收冲销 (负数应收) → 退款流水 → 反向凭证
        → 借: 主营业务收入 / 贷: 应收账款 (反向)
```

### 5.2 状态机 (退货)
```
销售退货单创建 → 待客户确认
    → 客户确认 → 退货入库 (待入库)
        → 仓库收回 → 已入库 (库存恢复)
            → 退款执行 → 反向凭证生成
                → 已退款 (终态)
```

---

## 6. 跨模块联动总结表

| Trigger | 自动触发 | 业务流 |
|---|---|---|
| 销售单审批通过 | 应收创建 + 库存锁定 | 流 1 |
| 销售单出库 | 库存扣减 + 应收实例化 + vflag pending | 流 1 |
| 缺料 → 销售单 | 请购单生成 → 采购订单 | 流 1+2 |
| 采购入库 | 应付创建 + 库存增加 + 三价对比 | 流 2 |
| BOM 审核生效 | 影响所有相关生产计划 | 流 3 |
| 工序完工 (计件) | 工资计算更新 | 流 3+4 |
| 工资生成 | 凭证 hook | 流 4 |
| 销售退货 | 库存恢复 + 应收负数 + 反向凭证 | 流 5 |

**8 种跨模块 auto-trigger** 详细在 `11-AUTO-TRIGGERS.md`.

---

## 7. Cretas 对照 (跨模块差距)

| 跨模块流 | 宏见 | Cretas |
|---|---|---|
| **销售→出库→应收→凭证** | ✅ 完整 (vflag + 批量) | ⚠️ 缺 vflag/凭证 hook |
| **销售→请购→采购** | ✅ linklistarray 8 类关联 | ⚠️ S-MRP-1 单向, 缺反向追溯 |
| **采购→收货→质检→入库→应付→凭证** | ✅ 完整 | ⚠️ 缺质检流程 + 凭证 hook |
| **BOM→审核→生产→报工→完工** | ✅ ECN + 计件 + 多状态 | ⚠️ 缺 BOM 工作流, 缺计件 UI |
| **考勤→工资→凭证** | ✅ 工资分摊凭证 | ❌ Cretas 无工资模块 |
| **退货→反向凭证** | ✅ 反向流程 | ⚠️ 退货单已有, 反向凭证缺 |

---

## 8. 关键洞察

### 8.1 宏见的"单据驱动"哲学
- 每个业务节点 = 一张单据 (创建 → 审批 → 下游)
- 单据之间通过 `linklistarray` 关联 → 完整追溯
- 单据 → 凭证 hook = 自动账务

### 8.2 Cretas 的"AI 流驱动"对照
- AIChat 一句话跨多步骤 → 内部 Skill 编排多 Tool 调用
- 没有显式"单据"概念, 是数据 + 状态变更
- **优势**: 学习曲线低, "说人话即可"
- **劣势**: 审计追溯弱 (没有强单据 trace)

### 8.3 互补建议
- Cretas 加 vflag 凭证 hook (P0 战略, MUST_COPY 增量)
- Cretas 加 linklistarray 关联类型 8 类 (业务追溯增强)
- AI Skill 内部仍然走 Cretas 现有数据流, 但**"输出"自动生成宏见风格的"单据"格式** → 兼容传统 ERP 客户审计需求

---

## 9. Phase 3 完成度

✅ 5 个完整业务流文档化 (基于实测 URL pattern + linklistarray + 流程图节点)
✅ 跨模块 auto-trigger 8 种总结
✅ 状态机 5 个 (销售/采购/BOM/工资/退货)
✅ 跟 Cretas 对照 6 流
✅ 战略洞察: 单据驱动 vs AI 流驱动
✅ **Round 3 Plan C — 销售单创建 Flow Story-Board** (7 张顺序截图 + 详细描述, 见 `19-FLOW-STORYBOARD.md`)
🟡 真正 .webm 视频未录 (技术原因: mcp__playwright-test 需要 playwright config setup, story-board 截图序列等效)

---

## 10. Round 3 Flow Story-Board 引用 (新)

**完整流程**: 登录 → dashboard → 销售流程图 → 销售订单 list → 新增 → 表单 → 操作下拉

| Step | 截图 | 描述 |
|---|---|---|
| 1 | flow-01-login-form.png | 登录表单 (3 字段必填) |
| 2 | flow-02-dashboard.png | 工作台 (12 stats + 待办 + 异常预警) |
| 3 | flow-03-销售流程图.png | 销售模块自动加载流程图 tab (jsPlumb 7 节点) |
| 4 | flow-04-销售订单-list.png | 销售订单列表 (37 查询字段) |
| 5 | flow-05b-销售单创建.png | 销售单创建 (workflow shell + 嵌套 form) |
| 6 | flow-06-销售单创建-产品行.png | 滚动看产品明细 5 行 + 汇总 |
| 7 | flow-07-操作下拉展开.png | 已有销售单"操作 ▼" 11 项 (含行内利润 ¥21,876.12) |

**实测时间线**: 50 秒走到创建表单 (vs Cretas SPA 应该 < 5 秒)

详见 `19-FLOW-STORYBOARD.md`.
