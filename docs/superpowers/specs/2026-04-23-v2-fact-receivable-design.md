# v2 unblocker — fact_receivable design

**Status**: SPEC DRAFT. Not implementable without A/R data source clarified.
**Last updated**: 2026-04-23
**Unblocks**: 收款 module Gold flip (partial — channel view only without A/R)

---

## Problem

收款 (Accounts Receivable collections) is A/R aging — "who owes us, how overdue, how much". Silver today only has `fact_pos_payment` (payment channel EAV: 现金/支付宝/美团券 etc.) which is a consumer payment **method** breakdown, NOT an A/R aging model.

For manufacturing tenants, the Java `finance/payments/list.vue` page already backs onto Java `finance_receivable` entities — fully functional. For restaurant tenants, **A/R is conceptually unusual**: consumers pay at POS; there are no open receivables.

## Open questions

1. **Do restaurant tenants actually have A/R?** Possible cases:
   - Corporate catering invoices (公司宴请, 单位订餐) — genuine A/R
   - Membership card prepayments — negative A/R (deferred revenue)
   - Franchise royalties owed — chain-level A/R
   - 美团/点评 platform settlement delays — platform A/R (waits for payout)
2. **Is the 美团 platform settlement receivable worth modeling?** 美团 holds consumer payment for 3-14 days before settling to merchant. For a chain with ¥20M/yr revenue and average 7-day settlement, this is ~¥400K in transit at any given time. Might be a valuable KPI.
3. **Data source?** Merchant backend API? Manual Excel import? Bank reconciliation?

## Design alternatives

### Alt A: Drop 收款 flip permanently for restaurants

Document in `docs/prd/v1.2-module-gold-coverage.md` that restaurant tenants have no meaningful A/R concept beyond platform settlement. Java `/finance/payments` stays manufacturing-only. Restaurant tenants see the Java page empty (accept empty UI) or hide the menu item via business-mode.

**Pros**: zero schema, zero code, aligned with actual business reality.
**Cons**: misses platform settlement KPI (which is legitimately interesting).

### Alt B: Model platform settlement only as `fact_platform_settlement`

Narrower scope: track 美团/点评 daily settlements. Not general A/R.

```sql
CREATE TABLE fact_platform_settlement (
  settlement_sk       BIGSERIAL PRIMARY KEY,
  factory_id          VARCHAR(50) NOT NULL,
  store_sk            BIGINT NOT NULL REFERENCES dim_store(store_sk),
  platform            VARCHAR(30) NOT NULL,  -- 'meituan' / 'dianping' / 'eleme'
  transaction_date    DATE NOT NULL,          -- when consumer paid
  settlement_date     DATE,                   -- when platform paid us (NULL=pending)
  gross_amount        NUMERIC(18,2) NOT NULL,
  platform_fee        NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_amount          NUMERIC(18,2) NOT NULL,
  status              VARCHAR(20) NOT NULL,   -- 'pending' / 'settled' / 'refunded'
  source_upload_id    BIGINT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS + indexes omitted for brevity (follow fact_pos_transaction pattern)
```

**Data source for Alt B**: 美团 merchant API (v1.2 spec Week 7-8 — but deferred) OR 美团 backend Excel export (manual, feasible now).

### Alt C: Generic fact_receivable mirroring Java entity

```sql
CREATE TABLE fact_receivable (
  receivable_sk       BIGSERIAL PRIMARY KEY,
  factory_id          VARCHAR(50) NOT NULL,
  customer_sk         BIGINT NOT NULL,  -- depends on dim_customer (v2-blocked)
  invoice_id          VARCHAR(100),
  invoice_date        DATE NOT NULL,
  due_date            DATE NOT NULL,
  amount_due          NUMERIC(18,2) NOT NULL,
  amount_received     NUMERIC(18,2) NOT NULL DEFAULT 0,
  status              VARCHAR(20) NOT NULL,
  ...
);
```

**Blockers for Alt C**: depends on `dim_customer` (v2-blocked), depends on invoice domain (spec dropped as permanent "restaurant has no invoice concept"). **Self-inconsistent for restaurants**.

## Recommendation

**Alt A + Alt B concurrently, when the 美团 ingestion adapter lands (v1.2 Week 7-8)**:
- Permanent drop of 收款 as "general A/R" for restaurants (Alt A — document now).
- New 平台结算 view (Alt B) — ships with 美团 API adapter. Not its own page; renders inside FinanceAnalysis.vue 下一 section.

## Why not implementable now

- 美团 API adapter is v1.2 Week 7-8 scope, **currently deferred** (user explicit: "美团那个放一下把").
- Manual 美团 Excel import path requires customer to ship Excel format — not negotiated.
- Alt A is the only *doc-only* action; no schema cost.

## Effort (if greenlit)

- Alt A (doc-only): 0.5 day
- Alt B migration + Bronze adapter + Gold materializer: 3-4 days **after** 美团 ingestion path exists
- Vue 平台结算 section: 1-2 days
- **Total**: ~7 days, **gated on 美团 ingestion being un-deferred**
