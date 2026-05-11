# Sub-ETL-2a Day 0 — Schema UPSERT-key audit (4 ⚠️ tables from spec §1.5)

**Status**: ✅ Audit complete — STOP-and-ping organizer before any DDL action.
**Date**: 2026-05-12 (MO filename) / dispatched 2026-05-11
**Author**: chat2 (Sub-ETL-2a designee, post-`/clear` fresh context)
**Branch**: `ops-sub-etl-2a-day-0-audit` (base `origin/main` @ `68465a6fed`)
**Triggering MO**: organizer dispatch "Sub-ETL-2a Day 0 schema audit per PR #316 §1.5", marked `⚡ IMMEDIATE — Pre-flight verified`.
**Authority**: spec `docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md` §1.5 (4 ⚠️ rows to verify) + Q-ETL-1/2/3 verbal sign-off ratified PR #325 + abort audit PR #324 §3.2 (natural-key finding on `fact_pos_transaction`).

---

## 0. TL;DR

Four tables audited against spec §1.5 required UPSERT keys; live `\d+` taken on `smartbi_prod_db` AND `smartbi_db` (test) on server `47.100.235.168`. Both environments schema-identical (information_schema cross-check).

| Table | Spec §1.5 UPSERT key (claimed) | Schema reality | ON CONFLICT works? | ALTER needed? |
|---|---|---|---|---|
| `dim_ingredient` | `(factory_id, name)` | TWO uniques: `(factory_id, source_pk)` + `(factory_id, normalized_name)`. NO unique on raw `name`. | ✅ **Yes** — but on a DIFFERENT key than spec claims | ❌ No DDL — but Sub-ETL-2b helper MUST pick `source_pk` (preferred) or `normalized_name`, **not** `name` |
| `fact_pos_item` | `(factory_id, source_type, store_id, source_bill_no, line_no)` | **NO natural-key UNIQUE.** Only `PRIMARY KEY (id)` on BIGSERIAL surrogate. Columns `source_type`, `source_bill_no`, `store_id`, `line_no` **DO NOT EXIST** on this table (they live on parent `fact_pos_transaction`). | ❌ **No** — bare INSERT only; re-running ETL on same upload would duplicate all child rows | ⚠️ **Yes, with caveats** — see §2 + §5 |
| `fact_pos_transaction` | `(factory_id, source_type, store_id, source_bill_no)` | `uq_fact_pos_txn (factory_id, source_type, store_id, source_bill_no)` | ✅ **Yes** — exact match | ❌ No |
| `fact_restaurant_requisition` | `(factory_id, source_bill_no)` | `uq_fact_req_factory_source (factory_id, source_pk)`. **NO `source_bill_no` column on this table.** Schema has `requisition_number VARCHAR(100)` (human-readable ref, non-unique). | ✅ **Yes** — but on a DIFFERENT key than spec claims (`source_pk` not `source_bill_no`) | ❌ No DDL — but spec §1.5 wording is **wrong**; Sub-ETL-2 MO + spec amend needed |

**Summary**: 1 / 4 tables matches spec literally (`fact_pos_transaction`). 2 / 4 tables work with ON CONFLICT but on a **different** key than spec claims (`dim_ingredient`, `fact_restaurant_requisition`). 1 / 4 tables **cannot do idempotent ON CONFLICT at all** (`fact_pos_item`) — schema design relies on parent-cascade for dedup, not row-level natural key.

**Recommendation**: 1× tiny amend-PR to spec §1.5 to flip the 3 ⚠️ rows to ✅ with the actual constraint names; 1× design decision required on `fact_pos_item` (DELETE-by-transaction-then-INSERT vs ADD COLUMN line_no migration — Sub-ETL-2b/2c scope). **No `V20260815_03__t6_6_etl_constraint_fixups.sql` migration should ship for the dim/fact_req tables — the existing constraints are correct, the spec is mis-described.**

---

## 1. `dim_ingredient` — audit

### 1.1 Schema reality

```
Indexes:
    "dim_ingredient_pkey" PRIMARY KEY, btree (ingredient_id)
    "idx_dim_ingredient_factory_cat" btree (factory_id, category)
    "idx_dim_ingredient_factory_name" btree (factory_id, name)
    "uq_dim_ingredient_factory_normname" UNIQUE CONSTRAINT, btree (factory_id, normalized_name)
    "uq_dim_ingredient_factory_source" UNIQUE CONSTRAINT, btree (factory_id, source_pk)
```

Defined in `backend/python/smartbi/database/migrations/2026_04_24_silver_restaurant_ops.sql:26-43` — **NOT** in `2026_04_28_silver_dimensions.sql` as the MO 必读 block cites (MO file-cite drift, low-severity).

Source comment (line 24-25): *"ETL source: cretas_db.raw_material_types. Every row is 1 food ingredient used by restaurant kitchen (not to be confused with dim_product = menu dish)."*

Two valid natural keys by design:
- `(factory_id, source_pk)` — `source_pk = cretas_db.raw_material_types.id` (stable PK of upstream row)
- `(factory_id, normalized_name)` — for cross-source dedup (e.g. "牛肉" vs "牛肉 " vs "Beef")

`idx_dim_ingredient_factory_name (factory_id, name)` is a **non-unique** index (lookup acceleration only, not a constraint). Spec §1.5 likely confused this index with a unique.

### 1.2 Verdict

| Question | Answer |
|---|---|
| PK unique? | ✅ Yes, `ingredient_id BIGSERIAL` |
| Natural-key UNIQUE exists? | ✅ Yes — TWO of them |
| Spec §1.5 claim `(factory_id, name)`? | ❌ **No such constraint** — but two alternatives exist |
| Can ETL UPSERT with `ON CONFLICT`? | ✅ **Yes**, on either `uq_dim_ingredient_factory_source` or `uq_dim_ingredient_factory_normname` |
| ALTER needed? | ❌ No |

### 1.3 Recommendation for Sub-ETL-2b helper

Use `ON CONFLICT (factory_id, source_pk)`. Reasons:
- `source_pk` is the cretas_db upstream PK, stable across renames / category re-labels
- `normalized_name` could legitimately change if alias_normalizer rules evolve, breaking dedup
- Existing `silver_restaurant_loader` (if reused per §3.3 line 408) likely already chose this path

Row count (prod): 112 rows. Trivial scale.

---

## 2. `fact_pos_item` — audit

### 2.1 Schema reality

```
Indexes:
    "fact_pos_item_pkey" PRIMARY KEY, btree (id)
    "idx_fact_pos_item_factory_product_amount" btree (factory_id, product_id, amount)
    "idx_fact_pos_item_txn" btree (transaction_id)
    "idx_fact_pos_item_unresolved" btree (factory_id, created_at DESC) WHERE product_id IS NULL
Foreign-key constraints:
    "fk_fact_pos_item_product" FOREIGN KEY (product_id) REFERENCES dim_product(product_id) ON DELETE SET NULL
    "fk_fact_pos_item_txn" FOREIGN KEY (transaction_id) REFERENCES fact_pos_transaction(id) ON DELETE CASCADE
```

Columns (9 total): `id, transaction_id, factory_id, product_id, qty, unit_price, amount, source_item_raw, created_at`.

**Missing columns** (referenced by spec §1.5): `source_type`, `store_id`, `source_bill_no`, `line_no` — **none exist**. These live on the parent `fact_pos_transaction`. The schema design (per source comment lines 81-85) treats `fact_pos_item` as a pure child of `fact_pos_transaction`, dedup-by-cascade.

Defined in `backend/python/smartbi/database/migrations/2026_04_29_silver_facts.sql:86-116`.

### 2.2 Verdict

| Question | Answer |
|---|---|
| PK unique? | ✅ Yes, `id BIGSERIAL` (surrogate only — no natural-key meaning) |
| Natural-key UNIQUE exists? | ❌ **No** — no UNIQUE on any column combination |
| Spec §1.5 claim `(factory_id, source_type, store_id, source_bill_no, line_no)`? | ❌ **Cannot build** — 4 of 5 columns don't exist on this table |
| Can ETL UPSERT with `ON CONFLICT`? | ❌ **No** — bare INSERT only |
| ALTER needed? | ⚠️ **Conditional** — see §5 design decision |

### 2.3 Why this is by design (not a bug)

Source comment line 19: *"FKs to parent transaction are ON DELETE CASCADE (item/payment/discount are meaningless without their bill)"*.

The dedup model is: parent `fact_pos_transaction` carries natural key `(factory_id, source_type, store_id, source_bill_no)` → child `fact_pos_item` rows are scoped by FK + CASCADE. Re-importing a bill is handled at the parent level:

```
-- pseudocode for the existing pattern (no line-level UPSERT)
INSERT INTO fact_pos_transaction (factory_id, source_type, store_id, source_bill_no, ...)
VALUES (...)
ON CONFLICT (factory_id, source_type, store_id, source_bill_no) DO UPDATE SET ...
RETURNING id;
-- Then for child rows:
DELETE FROM fact_pos_item WHERE transaction_id = <parent_id>;
INSERT INTO fact_pos_item (transaction_id, factory_id, product_id, ...)
VALUES (...);
```

This is **NOT idempotent at the row level** (child rows get new BIGSERIAL ids each re-import) but **IS idempotent at the bill level** (final state after re-import = same data, just with rolled ids).

### 2.4 Row count (prod): 1,310,246 rows

If we did want to add `line_no INT` + `UNIQUE (factory_id, transaction_id, line_no)` retroactively:
- DDL: `ALTER TABLE fact_pos_item ADD COLUMN line_no INT;`
- Backfill: `WITH numbered AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY transaction_id ORDER BY id) AS rn FROM fact_pos_item) UPDATE fact_pos_item SET line_no = numbered.rn FROM numbered WHERE fact_pos_item.id = numbered.id;` — touches 1.3M rows
- Constraint: `ALTER TABLE fact_pos_item ADD CONSTRAINT uq_fact_pos_item UNIQUE (factory_id, transaction_id, line_no);`

This is a substantial migration with backfill cost on the largest fact table in the schema. **Recommendation**: keep the existing DELETE-by-transaction-then-INSERT pattern, do NOT add `line_no`. The cost-benefit doesn't pencil out for ETL idempotency that the parent already provides.

---

## 3. `fact_pos_transaction` — audit

### 3.1 Schema reality

```
Indexes:
    "fact_pos_transaction_pkey" PRIMARY KEY, btree (id)
    ...
    "uq_fact_pos_txn" UNIQUE CONSTRAINT, btree (factory_id, source_type, store_id, source_bill_no)
```

Defined in `backend/python/smartbi/database/migrations/2026_04_29_silver_facts.sql:54`.

Source comment line 51-53: *"Prevent duplicate bill imports: (factory, source, store, bill_no) is the natural key. Same bill_no across different sources is allowed (Excel + API may both see same bill — we want them deduped by store)."*

### 3.2 Verdict

| Question | Answer |
|---|---|
| PK unique? | ✅ Yes, `id BIGSERIAL` |
| Natural-key UNIQUE exists? | ✅ Yes — `uq_fact_pos_txn` |
| Spec §1.5 claim `(factory_id, source_type, store_id, source_bill_no)`? | ✅ **Exact match** |
| Can ETL UPSERT with `ON CONFLICT`? | ✅ Yes |
| ALTER needed? | ❌ No |

### 3.3 PR #324 §3.2 corroboration

The abort audit explicitly flagged that the prior Sub-ETL-2 MO claimed `(factory_id + date + product_id 等)` as the natural key — that was wrong then, and remains wrong now. The schema's actual key has been `(factory_id, source_type, store_id, source_bill_no)` since `2026_04_29_silver_facts.sql:54` shipped. Any re-issued MO must cite this exact tuple.

Row count (prod): 297,436 rows. Healthy table.

---

## 4. `fact_restaurant_requisition` — audit

### 4.1 Schema reality

```
Indexes:
    "fact_restaurant_requisition_pkey" PRIMARY KEY, btree (id)
    "idx_fact_req_factory_date" btree (factory_id, date)
    "idx_fact_req_factory_ingredient" btree (factory_id, ingredient_id)
    "idx_fact_req_factory_status" btree (factory_id, status)
    "uq_fact_req_factory_source" UNIQUE CONSTRAINT, btree (factory_id, source_pk)
```

Defined in `backend/python/smartbi/database/migrations/2026_04_24_silver_restaurant_ops.sql:63-86` — **NOT** in `2026_04_29_silver_facts.sql` as the MO 必读 block cites (same file-cite drift as `dim_ingredient`).

Schema does NOT have a `source_bill_no` column. The human-readable reference is `requisition_number VARCHAR(100)` (non-unique). The natural key is `source_pk` = `cretas_db.material_requisitions.id` (line 66 comment: *"cretas_db.material_requisitions.id"*).

### 4.2 Verdict

| Question | Answer |
|---|---|
| PK unique? | ✅ Yes, `id BIGSERIAL` |
| Natural-key UNIQUE exists? | ✅ Yes — `uq_fact_req_factory_source` |
| Spec §1.5 claim `(factory_id, source_bill_no)`? | ❌ **No such column exists** — but `(factory_id, source_pk)` is the actual key |
| Can ETL UPSERT with `ON CONFLICT`? | ✅ Yes, on `(factory_id, source_pk)` |
| ALTER needed? | ❌ No |

### 4.3 Sibling tables (same pattern — informational)

The wastage / recipe / stocktaking tables in the same migration follow the identical `(factory_id, source_pk)` pattern:
- `fact_restaurant_wastage` → `uq_fact_wastage_factory_source`
- `fact_restaurant_recipe_line` → `uq_fact_recipe_factory_source`
- `fact_restaurant_stocktaking` → `uq_fact_stock_factory_source`

Per spec §1.6 these three are **intentionally deferred** for Q5 resolution. Audit does not extend to them, but the natural-key convention is consistent and re-confirms `source_pk` as the right ETL UPSERT key for all `fact_restaurant_*` tables.

Row count (prod): 22 rows. Tiny — small backfill cohort.

---

## 5. ALTER recommendations

### 5.1 No ALTER for 3 of 4 tables

`dim_ingredient`, `fact_pos_transaction`, `fact_restaurant_requisition` all have correct existing UNIQUE constraints. **`V20260815_03__t6_6_etl_constraint_fixups.sql` should ship empty (or be deleted from the §6 batch list).**

### 5.2 `fact_pos_item` — design decision needed (Sub-ETL-2b/2c scope)

**Option A — keep existing schema, use DELETE-by-transaction-then-INSERT** (recommended)
- Pros: zero migration cost; pattern already implicit in CASCADE design; parent-level idempotency suffices for ETL re-runs
- Cons: child row ids change on re-import (not externally referenceable — no downstream consumers query `fact_pos_item.id` directly per `grep` of `analysis_*` modules; needs Sub-ETL-2b confirmation)
- Migration: none

**Option B — add `line_no` column + UNIQUE constraint** (NOT recommended)
- Pros: row-level idempotency; line ids stable across re-imports
- Cons: 1.3M-row backfill; new column has no source data (raw Excel rows don't carry an authoritative line index — only positional order in the bill); risk of false "duplicate" errors when raw input order is non-deterministic
- Migration: ALTER + backfill + ADD CONSTRAINT (see §2.4)

**Recommendation**: Option A. Sub-ETL-2b `_lib/upsert_helpers.py` should expose `replace_child_rows(parent_table, parent_natkey, child_table, parent_fk_col, rows)` helper. Existing `silver_restaurant_loader` may already do this — Sub-ETL-2b reviewer should grep and reuse rather than reimplement.

---

## 6. Sub-ETL-2b / 2c MO corrections per findings

When organizer re-dispatches Sub-ETL-2b (UPSERT helpers) and Sub-ETL-2c (orchestrator):

### 6.1 Drop migration `V20260815_03__t6_6_etl_constraint_fixups.sql`

Or ship as a comment-only no-op file. Three of four tables need no DDL; the fourth (`fact_pos_item`) is a design decision, not a missing-constraint fix.

### 6.2 Fix spec §1.5 wording (tiny amend-PR)

Suggested replacement table (literal):

```markdown
| Table | Existing UPSERT key (verified) | Sub-ETL-2 status |
|---|---|---|
| `dim_store` | `UNIQUE (factory_id, name)` | ✅ Confirmed `2026_04_28_silver_dimensions.sql:56` |
| `dim_product` | `UNIQUE (factory_id, normalized_name)` | ✅ Confirmed `2026_04_28_silver_dimensions.sql:84` |
| `dim_ingredient` | `UNIQUE (factory_id, source_pk)` + `UNIQUE (factory_id, normalized_name)` | ✅ Confirmed `2026_04_24_silver_restaurant_ops.sql:41-42` — ETL uses `source_pk` |
| `fact_pos_item` | **NO natural-key UNIQUE** by design — dedup-by-CASCADE via parent | ⚠️ Design choice (Sub-ETL-2b §5.2) — no DDL ALTER recommended |
| `fact_pos_transaction` | `UNIQUE (factory_id, source_type, store_id, source_bill_no)` | ✅ Confirmed `2026_04_29_silver_facts.sql:54` |
| `fact_restaurant_requisition` | `UNIQUE (factory_id, source_pk)` | ✅ Confirmed `2026_04_24_silver_restaurant_ops.sql:83` — ETL uses `source_pk` |
```

### 6.3 Sub-ETL-2b helper API

`_lib/upsert_helpers.py` should expose:

```python
def upsert_dim_ingredient(rows: list[dict]) -> list[int]:
    """ON CONFLICT (factory_id, source_pk) DO UPDATE ..."""

def upsert_fact_pos_transaction(rows: list[dict]) -> list[int]:
    """ON CONFLICT (factory_id, source_type, store_id, source_bill_no) DO UPDATE ..."""

def replace_fact_pos_items(parent_id: int, factory_id: str, rows: list[dict]) -> None:
    """DELETE WHERE transaction_id=$1; INSERT INTO ... (in single transaction)."""

def upsert_fact_restaurant_requisition(rows: list[dict]) -> list[int]:
    """ON CONFLICT (factory_id, source_pk) DO UPDATE ..."""
```

Note the **asymmetric** API — three `upsert_*` (UPSERT semantics) + one `replace_*` (CASCADE-dedup semantics). This is intentional and reflects the schema design.

### 6.4 Sub-ETL-2c orchestrator scope

Per PR #324 §5 (the abort audit), Sub-ETL-2c sequencing requires Sub-ETL-1c CSVs + Sub-ETL-3b catalog seed to land first. This audit does **not** change that sequencing — Sub-ETL-2a (this doc) is parallel-with-1a/3a (`§5 row 5` of PR #324), Sub-ETL-2c remains last on critical path.

---

## 7. Cross-references

- PR #316 — `docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md` §1.5 (the 4 ⚠️ rows being audited) + §10 sign-off (Q-ETL-1/2/3 now `[x]`)
- PR #324 — `docs/qa-audits/2026-05-11-sub-etl-2-dispatch-abort.md` §3.2 (natural-key finding on `fact_pos_transaction` — corroborated here §3.3)
- PR #325 — Q-ETL verbal sign-off ratification (cited by spec §10 evidence: "V20260511_01 applied prod")
- PR #223 — Q1 amendment §4.2 (referenced by spec §1.5 for fact_pos_item shape — but column-set mismatch already exists upstream of Q1; this is a pre-existing schema-vs-spec gap, not Q1-introduced)
- Migration `backend/python/smartbi/database/migrations/2026_04_24_silver_restaurant_ops.sql` (lines 26-43 `dim_ingredient`; 63-86 `fact_restaurant_requisition`)
- Migration `backend/python/smartbi/database/migrations/2026_04_29_silver_facts.sql` (lines 26-78 `fact_pos_transaction`; 86-116 `fact_pos_item`)
- HARD memory `feedback_organizer_dispatch_must_grep_canonical_HOLD.md` — verified Q-ETL-1/2/3 cleared per spec §10 before this audit was undertaken
- HARD memory `feedback_organizer_dispatch_must_read_prior_sub_keep_list.md` — read PR #324 KEEP list (§5 sequencing) before scoping this audit

---

## 8. What I did (and did NOT do)

✅ Read spec §1.5 + §1.6 in full
✅ Read 4 migration files: `2026_04_28_silver_dimensions.sql`, `2026_04_29_silver_facts.sql`, `2026_04_24_silver_restaurant_ops.sql`, `V20260427_02__b_silver_writer_tables.sql`
✅ Ran live `\d+` introspection on `smartbi_prod_db` for all 4 tables via SSH `root@47.100.235.168`
✅ Cross-verified test env `smartbi_db` via `information_schema.table_constraints` — schema parity confirmed
✅ Captured row counts for impact sizing (112 / 297k / 1.3M / 22)
✅ Verified MO file-citation drift (MO cited `2026_04_28` and `2026_04_29` for `dim_ingredient` and `fact_restaurant_requisition` — actual file is `2026_04_24_silver_restaurant_ops.sql`)
✅ Wrote this audit doc on isolated worktree branch `ops-sub-etl-2a-day-0-audit`

❌ Did NOT create any V*.sql migration
❌ Did NOT run any DDL (ALTER / CREATE / DROP) on any database
❌ Did NOT write any Python code or modify `scripts/etl/`
❌ Did NOT touch `restaurant_chain_catalog` or any 14-chain seed data
❌ Did NOT push the branch — STOP-and-ping per MO §Phase 3 final line

---

## 9. Evidence appendix (verifiable commands)

```bash
# Worktree state
git rev-parse HEAD                          # 68465a6fed...
git branch --show-current                   # ops-sub-etl-2a-day-0-audit

# Live schema (prod)
ssh root@47.100.235.168 'sudo -u postgres psql -d smartbi_prod_db -c "\d+ dim_ingredient" \
    -c "\d+ fact_pos_item" -c "\d+ fact_pos_transaction" -c "\d+ fact_restaurant_requisition"'

# Cross-verify test env via information_schema
ssh root@47.100.235.168 'sudo -u postgres psql -d smartbi_db -c "
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
           string_agg(kcu.column_name, '\'', '\'' ORDER BY kcu.ordinal_position) AS cols
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu USING (constraint_name)
     WHERE tc.table_name IN ('\''dim_ingredient'\'','\''fact_pos_item'\'',
                              '\''fact_pos_transaction'\'','\''fact_restaurant_requisition'\'')
       AND tc.constraint_type IN ('\''PRIMARY KEY'\'','\''UNIQUE'\'')
     GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
     ORDER BY tc.table_name, tc.constraint_type;"'

# Row counts
ssh root@47.100.235.168 'sudo -u postgres psql -d smartbi_prod_db \
    -c "SELECT count(*) FROM dim_ingredient" \
    -c "SELECT count(*) FROM fact_pos_transaction" \
    -c "SELECT count(*) FROM fact_pos_item" \
    -c "SELECT count(*) FROM fact_restaurant_requisition"'

# Migration file authority
sed -n '26,43p' backend/python/smartbi/database/migrations/2026_04_24_silver_restaurant_ops.sql  # dim_ingredient
sed -n '63,86p' backend/python/smartbi/database/migrations/2026_04_24_silver_restaurant_ops.sql  # fact_restaurant_requisition
sed -n '26,78p' backend/python/smartbi/database/migrations/2026_04_29_silver_facts.sql           # fact_pos_transaction
sed -n '86,116p' backend/python/smartbi/database/migrations/2026_04_29_silver_facts.sql          # fact_pos_item
```

---

*End of audit. Branch `ops-sub-etl-2a-day-0-audit` held locally, NOT pushed. Organizer: please decide (a) merge this audit + ship the §6.2 tiny spec amend-PR, (b) reject and re-scope, or (c) request follow-up on Option A vs B for `fact_pos_item` (§5.2 design decision) before Sub-ETL-2b dispatches.*
