# Sprint 3 Track-E F-VFLAG-1 — Marching Order

**Dispatched**: 2026-05-16
**Target chat**: fresh Claude Code session, no prior context
**Branch**: `feature/sprint3-track-e-f-vflag-1`
**Estimated effort**: 10 days backend major (Claude 加速 ~6d)
**Backlog**: `宏见竞品分析/06-宏见测试账号深度审计/28-CRETAS-PRIORITIZED-BACKLOG.md` §1.1 row 1 (P0 战略)
**Audit reference**: `宏见竞品分析/06-宏见测试账号深度审计/30-BACKLOG-STATUS-AUDIT.md` §2

## Goal

实现宏见 ERP 的 **vflag 凭证生成 hook 机制**. 客户痛点: Cretas 现有 10 个 Finance Tool (DupontTool / RoaTool / RoeTool / LiquidityTool / etc.) 全是分析查询类, **缺业务单 → 财务凭证 自动生成桥梁**. 业务员每完一单, 财务必手动重录凭证. 宏见实测有 **7 类凭证 generator** (销售收款 / 采购付款 / 库存调拨 / 报销 / 工资发放 / 退货 / 折旧) + **vflag 4 状态** (`UNCREATED` / `PENDING` / `CREATED` / `FAILED`) 标在每个业务单上.

参考宏见: 销售单审批 → 自动 GenerateVoucherCommand → `Voucher` + `VoucherEntry` (借/贷分录) → 业务单 `vflag = CREATED`. 财务月底只需审凭证, 不重录.

**这是 Cretas 走向"业务-财务一体化"的关键桥梁**. F-VFLAG-1 ship 后, Sprint 4 C-APPROVAL-EDITOR (Track-I) + C-PRT-EDITOR (Track-J) 可基于 vflag 状态做工作流路由 + 凭证打印.

## Prerequisites done

- ✅ ApprovalChainConfig 全栈 (Track-I 也用) — `entity/config/ApprovalChainConfig.java` + Controller + Service
- ✅ Finance 现有 entity: `ArApTransaction` / `InvoiceRecord` / `PaymentRecord` (per grep verify)
- ✅ ⚠️ **无 Voucher / VoucherEntry / VoucherGenerator** — 完全 net-new 基础设施
- ✅ 业务单 entity 现有: SalesOrder / PurchaseOrder / ProductionPlan / ReturnOrder / InternalTransfer / WastageRecord / WageRecord
- ✅ 跟 Track-F (C-LINKARRAY-1) 互补: vflag 生成的 voucher 也通过 LinkArrayService link 回业务单

## Read these files first

1. `宏见竞品分析/06-宏见测试账号深度审计/02-财务管理-deep-audit.md` — 宏见 7 凭证 generator + vflag 4 状态实测 (Round 5)
2. `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/finance/` — 现有 finance entity (3 文件)
3. `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/SalesOrder.java` — 第一个 vflag column 目标
4. `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/ApprovalChainConfig.java` — 审批 hook 配合 (audit 已确认存在)
5. `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/finance/InvoiceApproveTool.java` — 现存 Tool 模式参考
6. `backend/java/cretas-api/src/main/java/com/cretas/aims/event/SalesOrderConfirmedEvent.java` — event-driven hook 模式参考
7. `.claude/rules/ai-intent-tool-skill-architecture.md` — 添加 Tool
8. `.claude/rules/database-entity-sync.md` — BaseEntity + Flyway
9. `.claude/rules/field-naming-convention.md`

## Concrete tasks

### Day 1-2: Entity + Flyway

`backend/java/cretas-api/src/main/java/com/cretas/aims/entity/finance/Voucher.java`:

```java
@Entity
@Table(name = "vouchers")
public class Voucher extends BaseEntity {
    private String id;                   // UUID
    private String factoryId;
    private String voucherNumber;        // e.g. "V-2026-0001"
    private VoucherType voucherType;     // SALES_RECEIPT / PURCHASE_PAYMENT / INVENTORY_TRANSFER / EXPENSE / WAGE / RETURN / DEPRECATION
    private LocalDate voucherDate;       // 凭证日期 (业务发生日, 不是创建日)
    private String sourceBusinessType;   // SALES_ORDER / PURCHASE_ORDER / ...
    private String sourceBusinessId;     // 业务单 UUID
    private BigDecimal totalDebit;       // 借方合计
    private BigDecimal totalCredit;      // 贷方合计 (= totalDebit, 借贷必平)
    private VoucherStatus status;        // DRAFT / POSTED / VOID
    private String createdBy;
    private String approvedBy;
    private Instant approvedAt;
    private String description;

    @OneToMany(mappedBy = "voucher", cascade = CascadeType.ALL)
    private List<VoucherEntry> entries = new ArrayList<>();
}
```

`VoucherEntry.java`:

```java
@Entity
@Table(name = "voucher_entries")
public class VoucherEntry extends BaseEntity {
    private String id;
    @ManyToOne private Voucher voucher;
    private Integer lineNo;
    private String subjectCode;          // 会计科目编码 (e.g. "1001.01" 银行存款)
    private String subjectName;
    private String description;
    private BigDecimal debit;            // 借方金额 (or null/0)
    private BigDecimal credit;           // 贷方金额 (or null/0)
    private String costCenter;           // 可选 辅助核算
}
```

`VoucherType.java` enum: 7 types.

Flyway: `V20260516_03__vouchers_and_entries.sql` (协调 Wave 1 三 chat 用 V20260516_03, Track-F 用 _01, Track-G 用 _02).

**业务单 add vflag column**:

```sql
ALTER TABLE sales_orders        ADD COLUMN vflag VARCHAR(20) DEFAULT 'UNCREATED' NOT NULL;
ALTER TABLE purchase_orders     ADD COLUMN vflag VARCHAR(20) DEFAULT 'UNCREATED' NOT NULL;
ALTER TABLE production_plans    ADD COLUMN vflag VARCHAR(20) DEFAULT 'UNCREATED' NOT NULL;
ALTER TABLE return_orders       ADD COLUMN vflag VARCHAR(20) DEFAULT 'UNCREATED' NOT NULL;
ALTER TABLE internal_transfers  ADD COLUMN vflag VARCHAR(20) DEFAULT 'UNCREATED' NOT NULL;
ALTER TABLE wastage_records     ADD COLUMN vflag VARCHAR(20) DEFAULT 'UNCREATED' NOT NULL;
ALTER TABLE wage_records        ADD COLUMN vflag VARCHAR(20) DEFAULT 'UNCREATED' NOT NULL;
```

Entity 同步加 `@Column private VoucherFlag vflag = VoucherFlag.UNCREATED;`

### Day 3-4: VoucherGenerator interface + 7 impl

`backend/java/cretas-api/src/main/java/com/cretas/aims/service/voucher/VoucherGenerator.java`:

```java
public interface VoucherGenerator<T> {
    VoucherType getType();
    boolean supports(String businessType);
    Voucher generate(String factoryId, T businessEntity);   // Pure function, 不存 DB
    List<VoucherEntry> buildEntries(T businessEntity);      // 借贷分录构建
}
```

7 impl: `SalesReceiptVoucherGenerator` / `PurchasePaymentVoucherGenerator` / `InventoryTransferVoucherGenerator` / `ExpenseVoucherGenerator` / `WageVoucherGenerator` / `ReturnVoucherGenerator` / `DepreciationVoucherGenerator`.

**示例 SalesReceiptVoucherGenerator**:

```java
@Component
public class SalesReceiptVoucherGenerator implements VoucherGenerator<SalesOrder> {
    @Override public VoucherType getType() { return VoucherType.SALES_RECEIPT; }
    @Override public boolean supports(String t) { return "SALES_ORDER".equals(t); }

    @Override
    public List<VoucherEntry> buildEntries(SalesOrder order) {
        BigDecimal total = order.getTotalAmount();
        return List.of(
            VoucherEntry.builder()
                .lineNo(1).subjectCode("1122").subjectName("应收账款")
                .description("销售订单 " + order.getOrderNumber())
                .debit(total).credit(BigDecimal.ZERO).build(),
            VoucherEntry.builder()
                .lineNo(2).subjectCode("6001").subjectName("主营业务收入")
                .description("销售收入")
                .debit(BigDecimal.ZERO).credit(total).build()
        );
    }
}
```

### Day 5: VoucherService + business event hook

`VoucherService.java`:

```java
public interface VoucherService {
    Voucher createFromBusiness(String factoryId, String businessType, String businessId);
    void batchCreate(String factoryId, List<BusinessRef> refs);  // 批量补凭证
    Voucher post(String voucherId, String userId);
    void voidVoucher(String voucherId, String reason);
    Voucher findBySourceBusiness(String businessType, String businessId);
}
```

**Event listener** 自动 hook:

```java
@Component
public class SalesOrderVoucherListener {
    @Autowired private VoucherService voucherService;

    @EventListener
    public void onSalesOrderApproved(SalesOrderConfirmedEvent event) {
        if (event.getOrder().getVflag() == VoucherFlag.UNCREATED) {
            event.getOrder().setVflag(VoucherFlag.PENDING);
            // Async: 不阻塞业务流
            voucherService.createFromBusiness(
                event.getOrder().getFactoryId(),
                "SALES_ORDER",
                event.getOrder().getId()
            );
        }
    }
}
```

7 业务单 7 listener (或泛型 listener + dispatch).

### Day 6-7: AIChat Tool + 批量补单

`VoucherGenerateTool.java`:

```java
@Component
public class VoucherGenerateTool extends AbstractBusinessTool {
    @Override public String getToolName() { return "voucher_generate"; }
    @Override public String getDescription() {
        return "为业务单生成财务凭证. 输入 businessType (SALES_ORDER/PURCHASE_ORDER/...) + businessId, 自动 dispatch 到对应 VoucherGenerator, 返回凭证号 + 借贷分录预览.";
    }
}
```

`VoucherBatchGenerateTool.java` — 批量补单 (`UNCREATED` 状态全 generate):

```java
@Component
public class VoucherBatchGenerateTool extends AbstractBusinessTool {
    @Override public String getToolName() { return "voucher_batch_generate"; }
}
```

### Day 8: VoucherController endpoints

```java
@RestController
@RequestMapping("/api/mobile/{factoryId}/finance/vouchers")
@RequirePermission("finance:voucher:view")
public class VoucherController {
    @GetMapping                    // page query
    @PostMapping("/generate")      // single
    @PostMapping("/batch-generate")
    @PostMapping("/{id}/post")     @RequirePermission("finance:voucher:post")
    @PostMapping("/{id}/void")     @RequirePermission("finance:voucher:void")
    @GetMapping("/by-business/{type}/{id}")
}
```

### Day 9: Tests + acceptance

unit tests 覆盖:
1. SalesReceiptVoucherGenerator: input 销售单 → output 2 entries, debit=credit
2. 全 7 generator 各 1 happy path
3. VoucherService.createFromBusiness happy + 重复触发 (idempotent)
4. SalesOrderVoucherListener event-driven 自动 trigger
5. batch generate (50 unc reated → 50 created)
6. Vflag 状态机: UNCREATED → PENDING → CREATED / FAILED
7. RBAC: 仓管员不能 view voucher (`@RequirePermission("finance:voucher:view")`)

E2E:
1. 创建 SalesOrder + 审批通过 → 自动 Voucher 生成 → SalesOrder.vflag=CREATED
2. AIChat "为销售单 SO-XXX 生成凭证" → tool call + Voucher 返回
3. AIChat "批量生成本月所有未凭证业务单" → batch tool

### Day 10: Deploy + PR + smoke

```bash
gh pr create --title "[Sprint3-E] F-VFLAG-1 凭证生成 hook (7 generator + vflag + business event)" --body "..."
# deploy --env test → smoke ≥ 7 业务单 each 1 generator → CRETAS_PROD
```

## Acceptance gates (DoD)

- [ ] V20260516_03 Flyway apply (prod + test) — 2 表 + 7 业务单 vflag column
- [ ] 7 VoucherGenerator @Component 全 register
- [ ] VoucherService.createFromBusiness 单测 ≥ 14 cases (7 type × 2 happy/edge)
- [ ] EventListener 4+ hook (SalesOrder / PurchaseOrder / ProductionPlan / ReturnOrder / Wastage / Wage / etc.)
- [ ] AIChat 2 Tool 注册 (`voucher_generate` + `voucher_batch_generate`)
- [ ] VoucherController 7 endpoint + RBAC
- [ ] E2E 7 业务单各 1 generate happy path
- [ ] 借贷必平: 任何 Voucher.totalDebit == totalCredit (单测覆盖)
- [ ] 业务单 vflag 状态机不破坏 (regression test)
- [ ] Track-F (C-LINKARRAY-1) 集成: voucher 通过 LinkArrayService link 回 业务单 (Day 8+ 后做 if Track-F 已 ship; 否则留 follow-up)

## Branch + PR

```bash
git checkout -b feature/sprint3-track-e-f-vflag-1
# Day 1-10 work
gh pr create --title "[Sprint3-E] F-VFLAG-1 凭证生成 hook (7 generator + vflag 4 状态 + business event)" --body "Backlog §1.1 row 1 (P0 战略, 10d). 业务-财务一体化关键桥梁..."
```

## Risks + watchouts

1. **借贷必平**: 任何 generator buildEntries 末尾 assert `entries.stream().map(VoucherEntry::getDebit).reduce(ZERO, ADD) == credit sum`. 不平时抛 UnbalancedVoucherException
2. **科目码 hardcoded**: Day 1-9 写死 "1122" / "6001" 等. F-VOUCHER-TPL-1 (P1 后续) 引入科目模板. 现在留 TODO
3. **Idempotent**: createFromBusiness 必须 idempotent (`findBySourceBusiness != null → return existing`), 防 event 重发
4. **vflag 状态机不能跳**: UNCREATED → PENDING (call started) → CREATED (success) / FAILED (rollback to UNCREATED for retry); CREATED 不能回退到 UNCREATED 自动 (除非 voidVoucher)
5. **Async event 不阻塞业务**: VoucherService.createFromBusiness 跑 @Async, 业务流不卡. 失败时 vflag=FAILED, 后台 scheduler 重试
6. **Tool 命名**: grep `getToolName` 确认 "voucher_generate" + "voucher_batch_generate" 无冲突
7. **Flyway 编号**: Wave 1 三 chat 协调 V20260516_01/02/03 (Track-F/G/E)
8. **canViewPrice RBAC**: Voucher 含金额, 必加 `@PriceSensitive` on Voucher.totalDebit/totalCredit (跟 Track-B1 C-RBAC-1 ship 的 hooks 配合)

## Reference

- 宏见 deep-audit: `02-财务管理-deep-audit.md` Round 5 7 generator + vflag 实测
- 现存 finance Tool 模式: `InvoiceApproveTool.java` (RBAC + AbstractBusinessTool)
- Memory rules: `feedback_organizer_brief_grep_before_assume.md` HARD / `feedback_concurrent_edit_safety.md` HARD

---

**Total**: 10 days backend major (~6d Claude 加速). 跟 Track-F + Track-G 完全并行 (Flyway 编号已协调 _01/_02/_03 分配). 是 Sprint 3 最大头, ship 后 Sprint 4 Track-I/J 可基于 vflag 做 workflow / print 路由.
