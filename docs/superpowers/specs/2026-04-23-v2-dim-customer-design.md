# v2 unblocker — dim_customer design

**Status**: SPEC DRAFT. Not implementable until upstream data source chosen.
**Last updated**: 2026-04-23
**Unblocks**: 客户管理 module Gold flip (v1.2 spec §5) + 收款 A/R view (partial)

---

## Problem

Spec §2.1 deferred `dim_customer` from v1.1 because qhj POS feed carries no customer ID. v1.2 Week 9 audit confirmed same gap — no flip possible without a customer dimension. v2 must answer: **where do customer identities come from?**

## Open questions (must be resolved before coding)

1. **Primary data source?** Spec §2.1 hints "review 带 user_pseudo_id" → 点评/美团 review ingestion (v1.3 scope). But review user IDs are **pseudo-IDs per review source** — a 美团 reviewer and a 点评 reviewer might be the same person. Do we collapse them, and how?
2. **Does the customer have PII?** Phone? WeChat? For restaurant B2C, expecting PII across channels is aggressive. v2 likely **pseudonymous-only**.
3. **Cross-source identity resolution scope?** Deterministic (same phone) vs probabilistic (same device / same order time + store)? Deterministic only is safer.
4. **Membership program data?** Some 青花椒 stores presumably have loyalty cards. Is that data available? If yes, it's a stronger identity anchor than review pseudo-IDs.
5. **What does 客户管理 UI need to show?** A/R aging (if receivables tied to customers)? Order history? LTV? RFM? The UI spec for this page does not exist today — must be defined BEFORE Silver schema.

## Proposed minimal schema (contingent on answers above)

```sql
-- Assumes pseudonymous-only + deterministic merge via contact_hash when available.
CREATE TABLE dim_customer (
  customer_sk         BIGSERIAL PRIMARY KEY,
  factory_id          VARCHAR(50) NOT NULL,

  -- Identity anchors (at least one required, validated by app layer):
  contact_hash        VARCHAR(64),       -- SHA256(phone) when phone available
  membership_id       VARCHAR(100),      -- loyalty-card ID if present
  pos_user_pseudo_id  VARCHAR(100),      -- from POS feed when present
  review_user_pseudo_id VARCHAR(100),    -- from 点评/美团 ingestion (v1.3)

  -- Derived attributes (nullable):
  display_name        VARCHAR(200),      -- e.g. "张女士" or "会员 XX" or ""
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_channels     TEXT[],            -- e.g. ['pos','meituan_review']

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_at_least_one_anchor CHECK (
    contact_hash IS NOT NULL
    OR membership_id IS NOT NULL
    OR pos_user_pseudo_id IS NOT NULL
    OR review_user_pseudo_id IS NOT NULL
  )
);

-- RLS per spec §6
ALTER TABLE dim_customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_customer FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dim_customer
  USING (factory_id = current_setting('app.factory_id', true));

-- Uniqueness per factory per anchor (partial unique indexes)
CREATE UNIQUE INDEX ux_dim_customer_contact ON dim_customer(factory_id, contact_hash) WHERE contact_hash IS NOT NULL;
CREATE UNIQUE INDEX ux_dim_customer_membership ON dim_customer(factory_id, membership_id) WHERE membership_id IS NOT NULL;
CREATE UNIQUE INDEX ux_dim_customer_pos_user ON dim_customer(factory_id, pos_user_pseudo_id) WHERE pos_user_pseudo_id IS NOT NULL;
CREATE UNIQUE INDEX ux_dim_customer_review_user ON dim_customer(factory_id, review_user_pseudo_id) WHERE review_user_pseudo_id IS NOT NULL;
```

Resolver lives in `smartbi/canonical/dim_resolver.py` alongside existing `resolve_store`, `resolve_product` etc. Signature: `resolve_customer(conn, factory_id, *, contact=None, membership=None, pos_user=None, review_user=None) -> customer_sk`.

## Why the current design is premature to build

- **No data source wired**. POS ingest (`excel_async.py`) has no customer extraction — the field doesn't exist in qhj's Excel columns we've seen. Without point of ingestion, `dim_customer` is an empty table.
- **v1.3 review ingestion is the actual trigger** for the first `review_user_pseudo_id` rows. Spec §0.3 v1.3 is 2 weeks out scoping-wise, not scheduled.
- **UX undefined**. Without knowing what 客户管理 page shows (A/R? RFM? LTV?), the schema might miss columns that turn out to matter.

## Recommended sequencing

1. **Block on**: v1.3 review ingestion design (spec §0.3 Week 12). `dim_customer` schema ships with it.
2. **Before either**: product/UX decision on 客户管理 for restaurant tenants — maybe the right answer is the page says "本模块仅 manufacturing 适用" for restaurants and stays Java-backed.
3. **If 2 → "drop"**: Remove 客户管理 from v2 spec, update `docs/prd/v1.2-module-gold-coverage.md` to mark DROPPED like 开票/出货.

## Effort estimate (if greenlit)

- Schema migration: 0.5 day
- `resolve_customer` + tests: 1 day
- Wire into `SilverNormalizer` (review path): 1 day
- 客户管理 Vue page Gold view: 2-3 days depending on UX
- **Total**: ~5 engineer-days, **gated on v1.3 review ingestion**
