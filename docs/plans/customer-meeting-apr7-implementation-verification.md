# 实现核对报告 — 2026-04-07

> 核对范围: commit `310b30a4` (税率分组开票) + `7526a254` (factoryId 隔离修复) vs 会议原话 (`temp/meeting-transcribe/transcript.txt`) + v3 需求文档。
> 核对人: Verification Agent (Opus 4.6 1M)

---

## 1. 总体评分

| 维度 | 评分 | 说明 |
|------|-----|------|
| 税率分组开票实现准确度 | **6/10** | 聚合粒度对、税额计算对; 但**金额来源用错**(用订单金额而非出库金额, 与客户 2906s 原话冲突), 且**审批流没改**, 客户原话明确要求"财务审批+回传发票附件"的完整闭环 |
| factoryId 隔离修复完整度 | **8/10** | 3 个 HIGH 漏洞修对了, JPQL/Repository 加得正确; 但 TransferTool 的 7 个状态机方法仍走 `getTransferByIdInternal` 绕过隔离, commit 自己也写了 TODO, 风险窗口未关闭 |
| v3 文档与原话对齐 | **7/10** | 抽样的 5 项 P0/P1 描述基本准确, 但 P0-3 描述把数据结构标成 `SalesOrder.taxBreakdown JSON` (实现实际上落在 `InvoiceRecord.tax_breakdown`), 文档与代码不符 |
| 截图与实现对齐 | **N/A** | 本轮未读截图 (时间预算所限), 留待人工核对 |
| 遗漏需求识别 | **5/10** | 2906-2921s "出库后金额联动" 已在 v3 列为 P0-10 但本周未实现; 2589-2601s "财务回传发票附件" 在 v3 中降为 P2-2, 但客户原话其实是 P0-3 同段语境内连续讲的, 强行拆分导致本轮交付不完整 |

**综合**: **6.5/10** — 核心金矿 G1 的"税率分组"骨架立住了, 但"金额联动 + 审批回传 + 附件回写"三个客户在同一段连续讲的诉求被人为拆走, 客户验收时大概率会问"为啥只做了一半"。

---

## 2. 严重问题 (Must Fix)

### 2.1 🔴 开票金额来源错了 — 用订单金额而非出库金额

**客户原话** (transcript.txt L1083-1089, 时间戳 2906-2921s):
> "如果这个订单还没有出库, 那么只显示我们的订单金额, 一旦有出库了, 就要显示我们的那个出库金额, **不然的话我们金额会对不上, 因为出库金额跟订单金额有时候是不一样的**"

**实际实现** (`InvoiceServiceImpl.java:139`):
```java
BigDecimal lineAmount = item.getLineAmount();  // = quantity × unit_price × (1-discount/100)
```
`item.getLineAmount()` 用的是 `SalesOrderItem` 的下单数量, 不是出库数量。

**差距**: 客户在同一通讲话里 (2906-2921 紧接着 2645-2660 讲税率) 已经明说"开票金额必须跟着出库金额走", 否则会和实际发货量对不上。我们当前实现等于把客户最在意的"金额对不上"问题写进了代码里。

**修复建议**:
- `aggregateByTaxRate` 接受第二个参数 `Map<itemId, shippedQty>`, 从 `OutboundOrder` / `ShipmentItem` 聚合实际出库数量
- 当订单尚未出库 (shipped = 0) → 退回订单数量
- 当部分出库 → 用 shipped × unit_price
- 单测必须覆盖: 全部未出库 / 部分出库 / 全部出库 三个场景
- 这件事 v3 已经列为 P0-10, **不能拆**, 必须和 P0-3 一起在 W1 D3-D4 出, 否则 P0-3 单独上线就是个错的功能

### 2.2 🔴 审批回传发票附件流程未实现, 与客户原话不符

**客户原话** (L914-924, 时间戳 2585-2607s):
> "发起申请, 发起申请以后**财务审批**, 财务审批完以后**财务回传, 回传财务发票附件**, 发票附件的话, 就是根据这个订单就可以找到, 然后自己下载"

以及 L961-966 (2675-2693s):
> "**财务开票完以后, 它那边会有一个上传**, 上传一个窗口, 它会把发票上传, **以附件的形式上传到申请单上面去**, 然后后面随时能调出来"

**实际实现**:
- ✅ `requestInvoiceFromOrder` 创建申请 (status=REQUESTED)
- ✅ `approveInvoice` / `rejectInvoice` 已存在 (本次 commit 7526a254 仅修了隔离, 未动业务流)
- ❌ **没有 `attachInvoiceFile` / `uploadInvoicePdf` 方法**
- ❌ `InvoiceRecord` 实体中没看到 `invoice_file_url` / `attachment_oss_key` 字段

**差距**: 客户讲的是一个**完整的 4 步流**: 销售申请 → 财务审批 → 财务上传发票 PDF → 销售从订单页下载。我们只做了第 1 步, 第 2 步是旧代码, 第 3-4 步完全没做。v3 把"附件回传闭环"丢到 P2-2, 但**客户原话里这是同一段连续讲的**, 拆开会被认为"做了一半"。

**修复建议**:
- `InvoiceRecord` 加 `invoiceFileUrl` / `invoiceFileName` / `issuedAt` 字段
- `InvoiceService.issueInvoice(factoryId, invoiceId, MultipartFile pdf, ...)` — 已有方法签名但需补附件参数 (L14 已 import OssService, 应当用上)
- `SalesOrderController` 加 `GET /sales-orders/{id}/invoices` 给销售下载用
- 这件事建议提到 P0, 与 P0-3 合并交付

### 2.3 🔴 TransferTool 7 个状态机方法仍未隔离

**commit 7526a254 自述**:
> "TODO(W1 D3): 7 个状态机方法 (request/approve/reject/ship/receive/confirm/cancel) 仍用 internal 版本, 延后 MEDIUM 批量修复"

**风险**: `TransferDetailTool` 的查询路径堵了, 但**写路径**(approve/ship/receive 等)还在用 `getTransferByIdInternal`。攻击者只要知道 transferId 就能跨工厂触发状态变更。这比单纯查询泄露更严重 (可被用于伪造收货确认)。

**修复建议**: 不能"延后", W1 D3 必须把这 7 个方法一起改完。每个状态变更方法 doExecute 第一行就传 factoryId 进 service。

---

## 3. 中等问题 (Should Fix)

### 3.1 🟡 v3 文档说 `SalesOrder.taxBreakdown JSON` 但代码落在 `InvoiceRecord.tax_breakdown`

**v3 doc L182**:
> | P0-3 | 税率分组开票 ... | `SalesOrder.taxBreakdown` JSON + `InvoiceService` |

**实际实现**: `InvoiceRecord.tax_breakdown JSONB` (commit message 与代码一致)

**评判**: 实现位置其实**比 v3 文档对**——税率分组是开票时的快照, 应当冻结在 `InvoiceRecord` 上, 不应回写销售订单 (订单可能后续修改, 而历史发票不能变)。这是文档的笔误, 不是代码错。**建议修 v3 文档**, 不要修代码。

### 3.2 🟡 税率聚合按 `tax_rate` 数值聚合, 没区分"原料行 vs 加工费行"

**客户原话** (L945-948, 2641-2651s):
> "其实就分两个税项, 一个是**原材料 9 个点**的税项, 一个是**加工费 13 个点**的税项"

**实际实现**: 仅按 `taxRate` 数值分组 (9 一组, 13 一组)。

**潜在问题**: 如果将来某个原料行的税率也是 13% (例如某些深加工原料), 会被合并到"加工费 13%"组里, 导致税务核对时无法区分来源。客户用"原料/加工费"这种业务语言, 不是用"税率数字"。

**修复建议**:
- `TaxBreakdownEntry` 加一个 `categoryHint` 字段 (来源于 SalesOrderItem 的 `itemType` 或 BOM 关联)
- 或者在前端展示时把"原料/加工费"作为分组标签, 不只是"9% / 13%"
- 短期: 至少在 `TaxBreakdownEntry` 上加注释, 提示"如未来出现同税率不同业务来源需求需扩展"

### 3.3 🟡 InvoiceRequestFromOrderTool 没有 preview 实现

WRITE 类 Tool (创建开票申请) 是高敏操作, 按 `.claude/rules/ai-intent-tool-skill-architecture.md` 应当 `supportsPreview() = true` + `doPreview()` 返回"预计创建 N 条税率分组, 总金额 X" 给用户确认, 而不是直接落库。

---

## 4. 轻微问题 / 改进建议

- **L4.1** `aggregateByTaxRate` 中 `setScale(2)` 后再用 `BigDecimal` 作 Map key, 依赖 `BigDecimal.equals` 严格 scale 匹配 — 已经做了 `setScale(2, HALF_UP)` 保险, OK 但建议加单测覆盖 `9.0` / `9.00` / `9` 都进同一组。
- **L4.2** `requestInvoiceFromOrder` 没校验"该订单是否已有 REQUESTED 或 APPROVED 状态的发票申请", 客户可能重复申请同一笔订单。
- **L4.3** commit 7526a254 把 `InvoiceService.approveInvoice` 加了 factoryId 参数, 但 `IntentExecutor` 调用面/Controller 调用面没在 grep 范围内复核, 建议跑一次 `mvn test -Dtest=*Invoice*` 看有无遗漏调用面。
- **L4.4** v3 文档 W1 D3 排了 8h 做"税率分组开票后端"——实际 commit 只有 294 行, 大概 3-4h, 留出来的时间应当被 2.1 / 2.2 的修复占用, 不要省。

---

## 5. 已完成的部分 (做对了的)

1. ✅ **税率分组聚合算法本身正确** — `LinkedHashMap` 保稳定顺序, 升序排序保证 9% 在 13% 前, scale 归一化, 与客户"表头能看到税率和金额"诉求对齐 (L949-952)。
2. ✅ **`tax_breakdown` 落在 `InvoiceRecord` 而非 `SalesOrder`** — 比 v3 文档写得对, 历史发票不被订单修改影响。
3. ✅ **factoryId 强制隔离** (`InvoiceServiceImpl.java:82-84`) — 在生成发票前显式校验销售订单的 factoryId, 防止跨工厂开票。
4. ✅ **3 个 HIGH factoryId 漏洞 Repository 层面修复扎实** — `findByIdAndFactoryIdAndDeletedAtIsNull` / `findByIdAndEitherFactoryId` 都是在 Repository 层加 WHERE, 而不是 Service 层 if 判断, 这是正确的纵深防御做法。
5. ✅ **审计脚本升级支持 `@FactoryIsolationExempt` 注解和白名单注释** — 治理类元工具 (SkillCompose / FinancePptExport) 显式标 EXEMPT 是合理工程实践, 没有掩盖问题。
6. ✅ **InvoiceRequestFromOrderTool 触发短语清晰** — "为订单一键开票/按税率分组开票/9% 13% 分开开" 可被 PHRASE_MATCH 直接命中, 不依赖 LLM 兜底。

---

## 6. 漏掉的需求 (v3 没覆盖 或 拆错优先级)

### 6.1 🔴 "出库金额 vs 订单金额联动" 应当与 P0-3 合并

见 §2.1。客户在 2906s 紧接着讲完税率紧接着就讲金额联动, 是同一段连贯的财务诉求, v3 拆成 P0-3 + P0-10 两条本周交付一条, 必然交付不完整。

### 6.2 🔴 "财务回传发票附件" 应当从 P2-2 提到 P0

见 §2.2。客户 2585-2607s 和 2675-2693s 两次讲到"附件上传到申请单, 销售从订单页下载", 这是开票闭环的必要环节。v3 把它放 P2 是误判客户原话权重。

### 6.3 🟡 "原材料定金 + 尾款" 多次付款机制

**客户原话** (L1095-1108, 2931-2952s):
> "它其实就分两批的, 一个是**原材料的定金**, 你看这原材料定金, 他是付了 9150, 然后他说他这边有他的那个**使馆凭证** ... 我们后面财务追踪也好追"

v3 P2-3 列了"收款记录多账户+多次付款", 但客户原话明确把"定金 + 凭证"和销售订单绑死, 这其实和 P0-3 / P0-10 是同一段连续语境, 不是单独的 P2 财务模块。建议把"定金记录字段"提到 P0 范围。

### 6.4 🟡 v3 没列: 销售订单→开票→收款的"闭环视图"

**客户原话** (L1112-1118, 2965-2974s):
> "订单基本到这就 OK 了, 就基本是一个闭环了, 因为他这边这个订单**关联的一个开票销售收款**"

客户希望在销售订单详情页一眼能看到"开票状态 / 已收款金额 / 待收款金额"。v3 P0-11 只写了"4 tab" (开票/出库/收款/采购), 但没明确"汇总卡片"形态, 建议补充 DoD: 订单详情顶部 KPI 卡 = 订单金额/出库金额/已开票金额/已收款金额。

---

## 7. 立即行动建议 (按优先级)

| 优先级 | 行动 | 工时 | 负责人 |
|--------|------|------|--------|
| P0-now | 修 `aggregateByTaxRate` 改用出库金额 (§2.1) | 4h | 后端 |
| P0-now | 补发票附件回传 + InvoiceRecord 加 fileUrl 字段 (§2.2) | 6h | 后端 |
| P0-now | TransferTool 7 个状态机方法补 factoryId (§2.3) | 3h | 后端 |
| P1 | TaxBreakdownEntry 加 categoryHint (§3.2) | 2h | 后端 |
| P1 | InvoiceRequestFromOrderTool 加 preview (§3.3) | 2h | 后端 |
| P1 | 修 v3 文档 P0-3 描述, 把 `SalesOrder.taxBreakdown` 改成 `InvoiceRecord.taxBreakdown` (§3.1) | 0.5h | PM |
| P1 | 重排 v3: P0-10 / P2-2 提到 P0-3 同一交付批次 (§6.1, §6.2) | 1h | PM |

---

## 附录: 本次未核对项

由于时间预算所限, 以下项**未深度核对**, 建议下一轮 verification 单独做:

1. ❌ Task 4 截图对齐 (`t049m17s_0176_s.jpg` 等 5 张) — 需要视觉读图
2. ❌ Task 3 中 P0-4 (运营报价) / P0-5 (物料需求单) / P0-13 (PC 批次) / P1-1 (工人欠退) / P1-3 (研发样品 3→2 页) 的 transcript 原话对照
3. ❌ Task 5 transcript 200-1000 段 (研发样品 + BOM) 的遗漏需求扫描
4. ❌ "产品大类隔离 bug" (1503s) 的具体复现步骤 vs 当前修复方案
5. ❌ commit 7526a254 修复后是否真有跨工厂 E2E 自动化用例覆盖 (v3 W1 DoD 第 3 项)

**建议**: 上述 5 项每项独立开一个 verification subagent, 每个限时 15 分钟, 并行跑完。
