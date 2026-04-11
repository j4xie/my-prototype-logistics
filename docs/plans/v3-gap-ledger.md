# V3 现实审计 Gap Ledger — Phase A

**日期**: 2026-04-11
**触发**: E2E Task 10 (G2 销售链) 暴露 3 个真实 bug (权限 matrix 缺 2 role / ck_po_status 约束缺状态 / 自动采购建议不存在). 全项 audit 前不继续 E2E 框架.
**方法**: 每个 P0/P1 item 在后端/DB/web-admin/RN 4 层独立核对, 不相信旧 audit 报告 (`customer-meeting-apr7-implementation-verification.md` 只覆盖 3 commit).
**状态标记**:
- ✅ **FULL** — 功能存在 + 流程对 + 权限对 + 无 bug, 可直接演示
- 🟡 **PARTIAL** — 主要功能在, 但有缺陷 (UI 不全 / 流程绕一步 / 边角 case 炸)
- ❌ **MISSING** — 功能不存在或完全没接
- 🔴 **BLOCKER** — 有存在, 但被 bug / 权限 / 约束阻断 (客户演示时会炸)
- ❓ **UNKNOWN** — 审计未覆盖到, 需补查

---

## P0 立即修 (19 items)

| ID | Item | 状态 | 证据 / Gap 细节 | 决策 |
|---|---|---|---|---|
| P0-1 | factoryId 行级隔离审计 | 🟡 TBD | audit script 已跑, 7 HIGH → 1, TransferTool 7 方法仍走 internal (2026-04-07 audit) | TBD |
| P0-2 | 产品大类隔离 bug (G5) | ❓ | 待查 ProductCategoryServiceImpl | TBD |
| P0-3a | 税率分组聚合 | ✅ | InvoiceServiceImpl.aggregateByTaxRate + E2E Task 9 `febd39adc` + `8e0112c17` 2/2 pass | — |
| P0-3b | 金额按出库联动 | ❓ | 2026-04-07 audit 说未修, 后续未再 verify. 需查 `computeLineAmountForInvoice` 是否已用 deliveredQuantity | TBD |
| P0-3c | 财务上传发票 PDF + 销售下载 | ❓ | v1-user-journey-audit 声称 ✅ `5f459f51f`, 需核对 OSS upload 实际工作 | TBD |
| P0-3d | 同订单多次付款 (定金+尾款) | ❓ | 需查 PaymentRecord 凭证字段 + 前端 dialog | TBD |
| P0-4 | 销售运营报价流程 (L1) | ❓ | 需查 OperationalQuote 实体 + 4 段流程前端 | TBD |
| P0-5 | 物料需求单实体 (G3) | ❓ | B1 FMR 存在 (Task 3 seed 证实), B2 warehouse dim 已 Reject (ADR) | TBD |
| P0-6 | 指定人员授权 (L2) | ❓ | 需查权限表是否有 user_id 字段 | TBD |
| P0-7 | 销售订单 SKU 去重 (A3.2) | ❓ | 需查 SalesServiceImpl 重复校验 | TBD |
| P0-8 | 销售订单明细字段补全 | ❓ | v1 §2.4.1 (specification / box_quantity) | TBD |
| P0-9 | 销售订单 3 状态字段 (A3.4) | ❓ | payment/invoice/delivery status | TBD |
| P0-11 | 销售订单业务中心 4 tabs | ❓ | v1 audit 声称 ✅ `80afe8bb`, 需核对 4 tab 实际可用 | TBD |
| P0-12 | 生产计划必须关联销售订单 | ❓ | 需查 ProductionPlan.sales_order_id | TBD |
| P0-13 | PC 批次字段强制 (A4) | ❓ | 需查 ProductionReport + 出库单 | TBD |
| P0-14 | BOM 原辅料拆 3 块 (A2) | ❓ | BomItem.group 字段 + 前端 3 tab | TBD |
| P0-15 | 生产报工 mode_1 | ❓ | per_process 单一模式 | TBD |
| P0-16 | 手机端拍照签收 (L7) | ❓ | RN 出库单 + 附件上传 | TBD |
| P0-17 | 入库必须有发起单 (A5) | ❓ | 后端权限拦截 | TBD |
| P0-18 | 大组长/小组长角色分工 | ❓ | Role 表加 2 角色 + PERMISSION_MATRIX | TBD |

## P1 (9 items)

| ID | Item | 状态 | 证据 / Gap 细节 | 决策 |
|---|---|---|---|---|
| P1-1 | 工人欠退/换岗扫码 (L3) | ❓ | 工时表 checkout_reason, Task 9 Web 部分已落地, RN 扫码未 E2E | TBD |
| P1-2 | 周转耗材 SKU 化 (L5) | ❓ | 销售订单加周转筐区 | TBD |
| P1-3 | 研发样品 3 页合 2 页 (L12) | ❓ | 前端路由调整 | TBD |
| P1-4 | 双仓体系 (A9) | 🟡 TBD | FactoryWarehouse 存在 (Task 3 seed 证实), FMR 仓库联动待 verify | TBD |
| P1-5 | 车间仓当天清仓定时任务 | ❓ | 每日 20:00 cron, FmrExpiryScanner 已建 | TBD |
| P1-6 | 销售订单列表智能筛选 tab | ❓ | 6 tab (未出库/部分出库/未收款 etc) | TBD |
| P1-7 | 预订合同附件上传 | ❓ | 销售订单加附件字段 | TBD |
| P1-8 | 研发样品追踪记录表 | ❓ | 子表实体 | TBD |
| P1-9 | BOM 追踪记录 (痕迹追踪) | ❓ | 子表实体 | TBD |

---

## 🔴 已知 Blocker (Task 10 发现)

| ID | 描述 | 发现时间 | Fix 难度 |
|---|---|---|---|
| B1 | `purchase_manager` / `warehouse_operator` 不在 `PERMISSION_MATRIX`, 这 2 个 role 登 web-admin 直接 /403 | Task 10 | 小 (~1h, 改权限配置) |
| B2 | DB CHECK `ck_po_status` 缺 `PENDING_FINANCE_REVIEW` / `FINANCE_APPROVED`, 采购 PO 审批链中段炸 | Task 10 | 中 (Flyway migration + 代码对齐) |
| B3 | "SO 触发采购建议" feature 根本不存在, 只有手工建 PO (v3 spec G2 假设的自动化 = 假) | Task 10 | 大 (epic) → 建议 de-scope, 改 spec 接受手工流程 |

---

## 📊 统计 (填完后更新)

| 状态 | P0 数量 | P1 数量 | 总计 |
|---|---|---|---|
| ✅ FULL | 1 | 0 | 1 |
| 🟡 PARTIAL | 0 | 0 | 0 |
| ❌ MISSING | 0 | 0 | 0 |
| 🔴 BLOCKER | 0 (外加 B1-B3) | 0 | 0 |
| ❓ UNKNOWN | 18 | 9 | 27 |

**审计覆盖率**: 1/28 (3.6%) — **待 Agent 填充**

---

## Phase B 决策区 (审计完后填)

TBD — 等 Phase A 完成所有 ❓→ 具体状态后, 逐项决定: 修 / 降级 / 推迟 / 接受.
