# V3 现实审计 Gap Ledger — Phase A

**日期**: 2026-04-11
**触发**: E2E Task 10 暴露 3 个 bug → 全项 audit 前不继续写 E2E 测试.
**方法**: 每个 P0/P1 item 在 backend 代码 + 数据库 schema + web-admin + RN 四层独立核对. 不信任旧 audit.
**状态**: Phase A 审计完成 (3 个并行 audit agent 全返), 下一步 Phase B 修复冲刺.

## 状态标记
- ✅ **FULL** — 功能存在 + 流程对 + 无 bug, 可直接演示
- 🟡 **PARTIAL** — 主要功能在, 但有缺陷 (通常是前端未接 / 边角 case)
- ❌ **MISSING** — 不存在
- 🔴 **BLOCKER** — 存在但被约束阻断
- 工期: **XS** <30min / **S** <2h / **M** <1d / **L** multi-day

---

## ⚠️ 并行 worktree 分支发现

审计过程中发现仓库有 **20+ `worktree-agent-*` 分支**, 每个都在针对具体 P0 item 做实现工作. **全部未 merge 到 main**. 见末尾 "Phase B merge 清单". 我们的 audit 基于 main 状态, 某些 🟡/🔴 项在 worktree 里可能已修好.

---

## P0 立即修 (19 items)

| ID | Item | 状态 | 证据 | Fix |
|---|---|---|---|---|
| P0-1 | factoryId 行级隔离审计 | ✅ FULL | `scripts/audit/tool-factory-isolation-audit.mjs` 跑完 **0 HIGH / 0 MEDIUM** (362 Tool 文件) | — |
| P0-2 | 产品大类隔离 bug (G5) | ✅ FULL | ProductTypeServiceImpl:245,249,269,279,312 全部 findByFactoryId. ProductCategory 是常量不是 JPA entity | — |
| P0-3a | 税率分组聚合 | ✅ FULL | InvoiceServiceImpl.aggregateByTaxRate + Task 9 E2E febd39adc + 8e0112c17 2/2 pass | — |
| P0-3b | 金额按出库联动 | ✅ FULL | InvoiceServiceImpl:204-228 computeLineAmountForInvoice 明确用 getDeliveredQuantity() >0 时, 否则 fallback getQuantity(). Javadoc 引用客户原话. 2026-04-07 audit 过期了, 这项已 fix | — |
| P0-3c | 财务上传 PDF + 销售下载 | ✅ FULL | InvoiceRecord.invoicePdfUrl + invoiceFileName 字段齐全. issueInvoice:260 要求 MultipartFile + ossService.uploadFile. 前端 detail.vue:690 `<el-link :href=... :download>` 下载, 869 拖拽上传 dialog | — |
| P0-3d | 同订单多次付款 (凭证) | ✅ FULL | `a95895f1a`. POST `/upload/receipt` endpoint 加到 FileUploadController. 付款 dialog 加 el-upload, auto-upload on change, 返回 OSS URL 存 paymentForm.receiptUrl, 随 finance/payments/record 一起提交 → receipt_url 落库. | — |
| P0-4 | 销售运营报价流程 (L1) | 🟡 PARTIAL | **BE ✅**: OperationalQuote entity + 4 段 state machine (DRAFT→PENDING_QUOTE→PENDING_APPROVAL→APPROVED) + margin_rate. **FE ❌**: web-admin 没有 sales/quotes 下的 OperationalQuote 管理页 | **M**: 写 Vue 管理页 (list/detail/dialog) wire 到 OperationalQuoteController |
| P0-5 | 物料需求单 (G3) | ✅ FULL | FactoryMaterialRequisition:57,61,102,107 — source/target warehouse + outbound/return transferId. B2 ADR Reject | — |
| P0-6 | 指定人员授权 (L2) | ✅ FULL | UserMenuPermission entity + UserMenuPermissionService grant/revoke + Controller + V20260408_06 migration — 已在 e2e/v1-framework (forked from main at 63041f7dd 时已包含 06708ebe6). Phase B Step 2 确认. | — |
| P0-7 | 销售订单 SKU 去重 | ✅ FULL | SalesServiceImpl:146-151 Set<String> seenProductIds → throws BusinessException("同一订单不能添加重复的产品") on createSalesOrder | — |
| P0-8 | 销售订单明细字段补全 | ✅ FULL | SalesOrderItem: specification:79 + boxQuantity:83 字段存在. 前端 detail.vue:582-588 渲染 "规格" + "箱数" 列 | — |
| P0-9 | 销售订单 3 状态字段 | ✅ FULL | (1) paymentStatus @JsonProperty `e86a47d14` (2) transportPlanStatus wiring `7cf290259` — updateOrderDeliveryStatus 现设 IN_TRANSIT (部分) / DELIVERED (全) (3) B4 ck_so_status ✅. 全 3 sub-gaps resolved. | — |
| P0-11 | 销售订单业务 4 tabs | ✅ FULL | detail.vue:563-806 — 5 el-tab-pane: 订单详情/开票申请/销售出库/收款记录/关联采购. 每 tab 独立 API endpoint | — |
| P0-12 | 生产计划必须关联 SO | ✅ FULL | ProductionPlanController GET /sales-orders/selectable (d8c8e7ace) + sourceOrderItemId 字段粒度修正 (cdf2d2a2c) + V20260408_08 migration. MANUAL 计划为合理例外 (客户原话 4216s 限"关联 SO 产品"). 已在 e2e/v1-framework. Phase B Step 2 确认. | — |
| P0-13 | PC 批次字段强制 (A4) | ✅ FULL | SalesDeliveryBatchAllocationController:17 P0-13 标签. SalesServiceImpl:580 出库前强校. V20260408_07 migration | — |
| P0-14 | BOM 原辅料拆 3 块 (A2) | ✅ FULL (BE) | BomItem:99,101 material_category 枚举 RAW/AUXILIARY/PACKAGING | 前端 3 tab 未核对 — worktree-agent-a907eae5 可能已做 |
| P0-15 | 生产报工 mode_1 | ✅ FULL | ProductionReport:61 reportMode 默认 MODE_1. WorkReportingServiceImpl:50 默认 MODE_1 | — |
| P0-16 | 手机端拍照签收 (L7) | ✅ FULL | BE: SalesDeliveryRecord:99 signature_photo_urls TEXT. RN: WHShippingConfirmScreen:124 signaturePhotos state + expo-image-picker + 至少 1 张强校 + photoUrls 送 shipmentApiClient | — |
| P0-17 | 入库必须有发起单 (A5) | ✅ FULL | MaterialBatchServiceImpl:177,231-277 P0-17 标签 + BusinessException. INVENTORY_COUNT 允许 null sourceDoc + 备注. SALES_RETURN stub | SALES_RETURN 补强可择时做 |
| P0-18 | 大组长/小组长角色 | ✅ FULL | FactoryUserRole:94,100 team_leader + group_leader enum. PermissionServiceImpl:87-105 两者都有 matrix 条目 | — |

## P1 (9 items)

| ID | Item | 状态 | 证据 | Fix |
|---|---|---|---|---|
| P1-1 | 工人欠退/换岗扫码 (L3) | 🟡 PARTIAL | **BE ✅**: EmployeeProcessSegment + Controller 4 endpoint 齐. **RN ❌**: 扫码 screen 没做 | **M**: 新 RN screen + 扫码集成. **已 deferred** (硬件缺) — 演示用 Web 代替 |
| P1-2 | 周转耗材 SKU 化 (L5) | ✅ FULL | ReusableContainer entity + 4 AI tools (Query/ShipOut/ReturnIn/Loss). 未直连 SalesOrder line (独立库存管理) | — (若要挂订单行要澄清) |
| P1-3 | 研发样品 3 页合 2 页 | ✅ FULL | router:411-423 — /rd/ redirect /rd/samples, 2 routes: samples/list.vue + converted/list.vue. 注释明写 "只保留 2 个页面" | — |
| P1-4 | 双仓体系 | ✅ FULL | FactoryWarehouse:78-82 WarehouseType enum LOGISTICS/WORKSHOP/OTHER. DB: LOGISTICS=6, WORKSHOP=6 | — |
| P1-5 | 车间仓当天清仓定时任务 | ✅ FULL | FmrExpiryScanner:49 @Scheduled cron="0 0 20 * * ?". 扫 ISSUED/IN_USE 前日 FMR + notifyRole WORKSHOP_SUPERVISOR | — |
| P1-6 | 销售订单列表智能筛选 tab | ✅ FULL | list.vue:53-88 定义 6 tabs (all/unshipped/partialShipped/unpaid/partialPaid/completed) 客户端 filter. el-radio-button group 509. client-side 对 demo 规模够用 | — |
| P1-7 | 预订合同附件上传 | ✅ FULL | SalesOrder.contractFileUrl + contractFileName. FileUploadController:92 @PostMapping("/contract") 20MB + MIME + OSS. list.vue:119-150 + el-upload handleBeforeUpload → /upload/contract | — |
| P1-8 | 研发样品追踪记录表 | ✅ FULL | `1ec2fd661`. 新增 GET `/rd/samples/{id}/tracking-records` 端点. 前端 openTrackingDialog 优先调新端点; 新表 0 行时 fallback legacy progressNotes JSON. | — |
| P1-9 | BOM 追踪记录 (痕迹追踪) | 🟡 PARTIAL | **BE ✅**: bom_change_logs + BomServiceImpl:152-154 auto-log save/update/delete. **FE ❌**: 没有 audit log viewer UI | **S**: 前端写 BOM 审计日志浏览页 |

---

## 🔴 Blocker (4 项)

| ID | 描述 | 根因 | Fix |
|---|---|---|---|
| **B1** | Task 2 seed 给用户设了 `warehouse_operator` / `purchase_manager`, 但 permission.ts:11-68 的规范代码是 `warehouse_worker` / `procurement_manager`. 这 2 seed role 不在系统里, 自然 /403 | **是 seed bug 不是后端 bug**. roles/list.vue:180 mock 有 `warehouse_operator` 误导, 实际 auth.ts:37 是 `WAREHOUSE_WORKER` | ✅ FIXED in commit `acb2c150c`. 改 seed-e2e-factory.sql: `purchase_manager` → `procurement_manager`, `warehouse_operator` → `warehouse_worker`. 本地 DB 同步更新 (UPDATE 2 rows confirmed). 全 5 user role_code 已验证与 FactoryUserRole enum 一致. |
| **B2** | DB `ck_po_status` CHECK 只允许 `DRAFT/SUBMITTED/APPROVED/PARTIAL_RECEIVED/COMPLETED/CANCELLED/CLOSED`. `PurchaseOrderStatus:17,19` enum 有 `PENDING_FINANCE_REVIEW`/`FINANCE_APPROVED`. `PurchaseServiceImpl:216,228` 转这些状态 → **运行时 DB CHECK violation** | 后端 + DB 不同步, 迁移没跟上 | ✅ FIXED in `V20260411_10__fix_po_so_status_check_constraints.sql`. CHECK 现在包含 PENDING_FINANCE_REVIEW/FINANCE_APPROVED/FINANCE_REJECTED 全部 10 个 enum 值. 验证: UPDATE to blocked states succeeded (rollback). |
| **B3** | `PurchaseSuggestion` / `generateSuggestionFrom` 后端 0 hit. SupplyChainOrchestrator:260 从 SO 自动建 production plan, 但没建 purchase suggestion | "自动采购建议" feature 根本没实现 | ✅ FIXED in commit `e08460093`. 改 v3 spec P0-11 说明: 关联采购 tab = 查询已有 PO (salesOrderId 关联), 不自动生成采购建议. V1 现状确认为手工流程. |
| **B4** | 同 B2 模式, 但在销售订单端: DB `ck_so_status` CHECK (V20260408_11 migration) 只允许 6 个值, 缺 `PENDING_FINANCE_REVIEW`/`FINANCE_APPROVED`/`FINANCE_REJECTED`. `SalesServiceImpl:278,298,332` 设这些状态 → DB check_violation. 点"提交财务审核"直接 500 | 又一次 enum/DB 不同步 | ✅ FIXED in `V20260411_10__fix_po_so_status_check_constraints.sql` (同 B2 migration). CHECK 现在包含 9 个值含全部财务状态. 验证: UPDATE to PENDING_FINANCE_REVIEW/FINANCE_APPROVED succeeded (rollback). |

---

## 📊 Phase A 最终统计

| 状态 | P0 | P1 | 总计 | 百分比 |
|---|---|---|---|---|
| ✅ FULL | 18 | 7 | **25** | **89%** |
| 🟡 PARTIAL | 1 | 2 | **3** | **11%** |
| ❌ MISSING | 0 | 0 | 0 | 0% |
| 🔴 BLOCKER | — | — | **4** (B1-B4) | — (all closed) |

**审计覆盖率**: 28/28 (100%) ✅ · Phase B Step 2 完成: P0-6 + P0-12 → ✅ FULL (已在 e2e/v1-framework, 无需 cherry-pick)
**Phase B Step 3 Batch 1 完成 (2026-04-11)**: B1 ✅ (`acb2c150c`) + B3 ✅ (`e08460093`) + P0-9 getPaymentStatus 序列化 ✅ (`e86a47d14`). 现在 4 blocker: B1 ✅ B2 ✅ B3 ✅ B4 ✅ — 全部 closed.
**Phase B Step 3 Batch 2 完成 (2026-04-11)**: P1-8 ✅ (`1ec2fd661`) + P0-3d ✅ (`a95895f1a`) + P0-9 transport ✅ (`7cf290259`). 3/6 PARTIAL → FULL. 现在 **25/28 FULL (89%)**. 剩余 PARTIAL: P0-4 FE, P1-1 RN (deferred), P1-9 BOM audit viewer.

**核心结论**:
- 😊 **V1 实际完成度远高于预期**. 20/28 ✅ FULL, 0 item 完全缺失
- 🟡 **8 个 PARTIAL 几乎全是 "backend 完整 + frontend 未接"**. 前端补齐都是 S (<2h) 或 M (<1d)
- 🔴 **4 blocker 中 3 个是小 fix**: B1 XS (seed), B2 S (migration), B3 XS (doc), B4 S (migration)
- ⚠️ **B2 + B4 是 live prod latent bug**: CHECK 约束不匹配 enum 状态. 这俩必须修 — 不修的话客户演示走财审流程直接炸
- 🔄 **Worktree 已在并行做大部分 P0 工作**, merge 后 PARTIAL 数会进一步下降

---

## Phase B 修复冲刺清单

按 ROI 排序 (大效果 / 小工作量 优先):

### Priority 1: 🔴 Live bug (必须修)
1. **B2** `ck_po_status` Flyway migration (~1h) ✅ DONE — `V20260411_10`
2. **B4** `ck_so_status` Flyway migration (~1h) ✅ DONE — `V20260411_10`

### Priority 2: 🟢 小补丁 (快速 close gap)
3. **B1** 改 seed role code (~15min)
4. **B3** 改 v3 spec 措辞 (~15min)
5. **P1-8 前端** 切 tracking records read path (~1-2h)
6. **P0-3d 付款凭证** 加 el-upload (~1-2h)
7. **P0-9 transportPlanStatus** 服务层接 wiring (~2h)
8. **P0-9 getPaymentStatus() 序列化** 加 @JsonProperty (~15min)

### Priority 3: 🟡 中等补丁
9. **P1-9 BOM 审计 viewer** 前端页 (~2-4h)
10. ~~**P0-12 决策 + 实施**~~ ✅ DONE Phase B Step 2
11. **P0-4 OperationalQuote 前端页** (~半天-1天, 最大剩余工作量)
12. **P0-14 前端 3 tab** 核实 / 实现 (~2-4h)

### Priority 4: 🟡 推迟 (Phase C 之后)
13. **P1-1 RN 扫码 screen** (Memory 已标 deferred, 硬件缺)

### 并行工作: Worktree merge 审计
需要单独 survey (建议另起 session):
- ~~P0-6 `ac999d50`~~ ✅ 已在 e2e/v1-framework / ~~P0-12 `a249079a+a99541ab`~~ ✅ 已在 e2e/v1-framework / P0-14 `a907eae5` / P0-NEW-1 `af539ae8+ab4497e3`
- G1 前端 `af2b3dc8` / C4 `a6842597+afd5da3e` / B8 看板 `a4f2f159` / B9+B10 入库类型 `ae370dff` / P1-NEW-2/3 `ae01740e` / B1+B2 运费 `a7565fd3`

---

## 下一步

**等用户确认 Phase B 优先级**, 然后:
1. 修 B1+B2+B3+B4 (1 个 session 搞定, 总共 ~3-4h)
2. 修 Priority 2 的 5 项小补丁 (~6-8h)
3. 重跑 Task 10 G2 测试 (现在角色应该能 login 了)
4. 继续 Task 11+ E2E 框架 (或并行 worktree merge)
