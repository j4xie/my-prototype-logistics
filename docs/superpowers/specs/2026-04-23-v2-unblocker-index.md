# v2 Unblocker Specs — Index

**Date**: 2026-04-23
**Why these specs exist**: After v1.1+v1.2 ship (5 modules Gold-backed on prod), 5 modules remain DEFERred waiting on upstream data sources. These 4 specs are **design drafts**, not approved plans. Each exists to:

1. Name the open product questions that block implementation.
2. Propose schema skeletons so engineers don't start from zero when unblocked.
3. Recommend the cheapest path (often "drop permanently + document").
4. Give effort estimates for budgeting.

## Reading order

1. [`2026-04-23-v2-dim-customer-design.md`](2026-04-23-v2-dim-customer-design.md) — blocks 客户管理 + 收款. **Gated on v1.3 review ingestion + UX decision.**
2. [`2026-04-23-v2-fact-receivable-design.md`](2026-04-23-v2-fact-receivable-design.md) — recommends **drop** general A/R + build narrow `fact_platform_settlement` when 美团 ingestion lands.
3. [`2026-04-23-v2-fact-inventory-movement-design.md`](2026-04-23-v2-fact-inventory-movement-design.md) — recommends **drop** 成品库存 + rename 进销存 to 食材成本 reusing existing BOM path.
4. [`2026-04-23-v2-accounting-import-bronze-design.md`](2026-04-23-v2-accounting-import-bronze-design.md) — recommends manual Excel import adapter **after** customer agrees on template format.

## Coverage after recommendations land

| Module | Current | After unblocker recommendations |
|---|---|---|
| 收款 | DEFER | DROP (general A/R) + new 平台结算 section (美团-gated) |
| 进销存 | DEFER | RENAMED to 食材成本, Gold-backed via existing BOM |
| 成品库存 | DEFER | DROP permanent |
| 客户管理 | DEFER | DROP (likely; pending UX decision) |
| 成本分析 | DEFER | Gold-backed via manual Excel adapter (post-customer-alignment) |

**Projected v2 final coverage**: 5 (v1.1+v1.2 shipped) + 1 (食材成本 renamed) + 1 (成本分析) = **7 modules** with Gold analytics.
**Permanent drops**: 开票, 出货, 成品库存 (and likely 客户管理 + general 收款 receivables).

## What each spec needs before engineering starts

| Spec | Required input | Who provides it |
|---|---|---|
| dim_customer | UX for 客户管理 + decision on dropping vs keeping + v1.3 review ingestion timeline | Product + customer conversations |
| fact_receivable | 美团 ingestion greenlight + drop-doc for general A/R | Product |
| fact_inventory_movement | Rename approval (进销存 → 食材成本) + 成品库存 drop confirmation | Product |
| accounting_import | Standard Excel template format + frequency commitment | Customer (accountant) |

**None of these are engineering blockers. All are product/customer conversations.**
