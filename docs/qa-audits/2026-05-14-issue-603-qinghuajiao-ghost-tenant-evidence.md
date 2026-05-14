# Issue #603 — R_QINGHUAJIAO_REAL is NOT a ghost (reclassify, do not consolidate)

**Date**: 2026-05-14
**Issue**: [#603](https://github.com/j4xie/my-prototype-logistics/issues/603)
**Investigator**: chat 5
**Verdict**: **STOP — do not consolidate.** Reclassify `R_QINGHUAJIAO_REAL` as an **active, intentional placeholder tenant** for Sub-ETL-2c real-data import. The MO STOP condition ("recent activity → STOP, do NOT consolidate") fires on top of explicit architectural-intent evidence.

---

## 1. Summary

| Question | Answer |
|---|---|
| Is `R_QINGHUAJIAO_REAL` a ghost? | **No.** |
| Is it a duplicate of `RES_3101_009`? | **No** — they are architecturally distinct by design (REAL vs DEMO). |
| Should we consolidate (Path A)? | **No.** Would conflate real-data destination with synthetic demo seed and break live T6.6.3c routing. |
| Should we seed data (Path B)? | **No** — data ingestion is owned by Sub-ETL-2c (separate workstream). |
| Should we tombstone (Path C)? | **No** — actively logged-in today; would break the user. |
| Action | **Close #603 as "not a ghost; reclassify"** with this evidence doc. No migration. |

---

## 2. Side-by-side inventory (queried on prod 2026-05-14)

### `cretas_prod_db.factories`

| Field | `R_QINGHUAJIAO_REAL` | `RES_3101_009` |
|---|---|---|
| name | 青花椒 | QHJ_PROD |
| type | RESTAURANT | RESTAURANT |
| is_active | true | true |
| manually_verified | false | true |
| deleted_at | NULL | NULL |
| created_at | 2026-05-12 10:00:30 (V20260511_01) | 2026-04-21 10:37:05 |

### `cretas_prod_db.users`

| factory_id | username | role | full_name | is_active | last_login |
|---|---|---|---|---|---|
| `R_QINGHUAJIAO_REAL` | `qhj_admin` (id=1573) | factory_super_admin | 青花椒管理员 | true | **2026-05-14 12:40:35** ← today |
| `RES_3101_009` | `qhj_prod` (id=1550) | factory_super_admin | QHJ Prod Admin | true | 2026-05-14 11:56:42 |
| `RES_3101_009` | `qhj_warehouse_mgr` (1574) | warehouse_manager | 秦皇荷 仓储主管 (测试) | true | (never) |
| `RES_3101_009` | `qhj_finance_mgr` (1575) | finance_manager | 秦皇荷 财务主管 (测试) | true | (never) |
| `RES_3101_009` | `qhj_sales_mgr` (1576) | sales_manager | 秦皇荷 销售主管 (测试) | true | (never) |
| `RES_3101_009` | `qhj_operator` (1577) | operator | 秦皇荷 操作员 (测试) | true | (never) |

The four `RES_3101_009` role accounts (1574–1577) were just seeded today via V20260514_04 (per Flyway: `seed_restaurant_role_accounts.sql`) — they have `full_name` suffix "(测试)" indicating they are explicitly demo/test users on the demo tenant.

### `cretas_prod_db.conversation_sessions` (recent activity probe)

```
R_QINGHUAJIAO_REAL | user_id=1573 | 2026-05-14 06:50:20
R_QINGHUAJIAO_REAL | user_id=1573 | 2026-05-14 06:51:03
R_QINGHUAJIAO_REAL | user_id=1573 | 2026-05-14 11:28:20
```

3 sessions on the audit day. **This is the MO STOP signal.**

### `smartbi_prod_db` data presence

| Table | `R_QINGHUAJIAO_REAL` | `RES_3101_009` |
|---|---|---|
| `fact_pos_transaction` | 0 | 140,541 |
| `fact_pos_item` | 0 | 646,946 |
| `fact_restaurant_recipe_line` | 0 | 383 |
| `fact_restaurant_wastage` | 0 | 6 |
| `restaurant_chain_catalog` | **1** (see below) | 0 |

### `restaurant_chain_catalog` row (smartbi_prod_db)

```
factory_id        = R_QINGHUAJIAO_REAL
chain_name_zh     = 青花椒
chain_name_roman  = QINGHUAJIAO
cuisine           = Sichuan
source_kind       = REAL
source_root_path  = 青花椒/ + 青花椒25年/
notes             = T6.6 Phase B real-DB import; distinct from RES_3101_009 demo seed
```

That `notes` field is the smoking gun — the architectural-intent statement is baked into the data itself by V20260511_02 (Sub-ETL-3 seed). The two factory_ids are **declared distinct by design**.

### `cretas_prod_db` other business tables

| Table | `R_QINGHUAJIAO_REAL` | `RES_3101_009` |
|---|---|---|
| `sales_orders` | 0 | 0 |
| `purchase_orders` | 0 | 0 |
| `suppliers` | 0 | 0 |
| `recipes` | 0 | 383 |
| `product_types` | 0 | 136 |
| `customers` | 0 | 0 |

`RES_3101_009`'s 383 recipes + 136 product_types are the Plan C synthetic demo seed (`backend/python/smartbi/database/migrations/2026_04_25_qhj_demo_seed.sql` — notes='PLAN_C_DEMO_SEED_2026_04_25').

---

## 3. Architectural intent (why both must exist)

### V20260511_01 (cretas_prod_db) — onboard 14 R_*_REAL chains

`backend/java/cretas-api/src/main/resources/db/flyway/V20260511_01__onboard_14_r_real_chains.sql` lines 1-26:

> Sub-ETL-3 V20260511_02 seeded `smartbi_prod_db.restaurant_chain_catalog` with 14 R_*_REAL chains (cuisine + chain_name_zh metadata). Those 14 factory_ids were NOT in `cretas_prod_db.factories` tenant registry. […]
>
> This migration onboards the 14 chains as RESTAURANT tenants so they route to the restaurant Python branch correctly. Each chain returns the restaurant envelope; **null-marker payload is expected until Sub-ETL-2c ingests their POS / review / wastage data** (per chat4 PR #372 audit §3 — 0 ingested rows for all 14 R_*_REAL today).

R_QINGHUAJIAO_REAL is one of these 14. The "0 POS records" today is the **expected pre-Sub-ETL-2c state**, not a defect.

### Spec `2026-05-11-t6-6-etl-infra-design-spec.md` §… "Special case — 青花椒"

> existing `RES_3101_009` (Apr-25 qhj demo seed, synthetic top-136 menu) and the new `R_QINGHUAJIAO_REAL` (real Excel-import data) are **two distinct factory_ids**. They live in the same smartbi_prod_db but are isolated tenants. Per Q1 §4.3 footnote: *"this is a separate real-data factory"*.

### Spec `2026-05-11-t6-6-cutover-spec.md` §T6.6.3b

> Action: nginx whitelist becomes `(R_TEST_MOCK|R_ILTEATRO_REAL|R_QINGHUAJIAO_REAL)`.
> Active-E2E: 15-30 min smoke with 青花椒 customer data. Specifically validate that `R_QINGHUAJIAO_REAL` does NOT collide with `RES_3101_009`. […]
> GO criteria: collision verification (different responses for `R_QINGHUAJIAO_REAL` vs `RES_3101_009`).

T6.6.3a/3b/3c cutover is **LIVE** as of 2026-05-14 03:35:50 UTC. Both factory_ids appear in the prod nginx `api.cretaceousfuture.com.conf` / `web-admin.conf` regex prefix routing (R_* and RES_* both → Python). Verified on server 139:

```
/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf:
# T6.6.3c full cascade (2026-05-14): all restaurant tenants → Python for /analysis/(production|quality).
# Replaces explicit T6.6.3a (R_ILTEATRO_REAL) + T6.6.3b (R_QINGHUAJIAO_REAL) single-tenant blocks
# with the spec PR #366 §4.1 target-state regex. Tenant-type heuristic by factory_id prefix:
#   R_*    — real restaurant chains and demos
#   RES_*  — restaurant test/staging factories
```

PR #543 (T6.6.3c, merged 2026-05-13 19:45:11 UTC, mergeCommit 25c1535ed) is the live state.

---

## 4. Why each path fails

### Path A (Consolidate users + soft-delete factory) — **REJECTED**

- Would break the `qhj_admin` user mid-session (3 active sessions today).
- Would dissolve the `restaurant_chain_catalog` mapping that Sub-ETL-2c relies on to land real Excel-import rows. The next ingestion run would have nowhere to write 青花椒 real data without recreating the factory_id.
- Would invalidate every spec/audit doc that has shipped against `R_QINGHUAJIAO_REAL` (PR #398 / #427 R_*_REAL chain parity sweep, T6.6.3b GO-criteria collision check, restaurant data-readiness audit, etc.).
- Nginx routes both `R_QINGHUAJIAO_REAL` and `RES_3101_009` to Python by prefix regex — there is no behavioral leak. Customers/audits already get distinct responses (verified in `docs/qa-audits/2026-05-12-r-real-chains-parity-evidence.md` 100% dict-eq pass).

### Path B (Seed POS data into R_QINGHUAJIAO_REAL) — **REJECTED (out of scope)**

Real-data ingestion is owned by Sub-ETL-2c (`backend/python/smartbi/etl/`). The ETL roadmap is tracked separately and processes `青花椒/` + `青花椒25年/` Excel sources into Bronze→Silver→Gold layers. Issue #603 should not pre-empt that workstream.

### Path C (Soft-delete / tombstone) — **REJECTED**

- `qhj_admin` is actively logged in (last_login 2026-05-14 12:40, after the issue was filed). Tombstone would lock the user out.
- T6.6.3c is LIVE — removing the factory row would route a customer-facing tenant to 404.

---

## 5. Recommended next steps

1. **Close issue #603 as "not actually a ghost — reclassify"** referencing this evidence doc.
2. **No migration in this PR.** Per MO Don'ts: "DON'T deploy this migration in this PR — that's a separate confirmed-deploy step." (And we are not writing one because no Path A/B/C applies.)
3. **Optional defensive doc tweak** (not in this PR): consider amending the issue with the note that the original "ghost" framing missed the V20260511_01 / restaurant_chain_catalog / T6.6.3c context. The pre-flight check that found "1 user, 0 POS" was correct at write-time but the user actively started using the system the same day.
4. **Monitor Sub-ETL-2c** ingestion to populate `fact_pos_*` / `fact_restaurant_*` / `restaurant_reviews` for the 14 R_*_REAL chains (including R_QINGHUAJIAO_REAL). That is the natural close-out for the "0 POS" condition — not consolidation.

---

## 6. Rollback considerations

**N/A** — no migration is written. This PR ships only the evidence doc.

If Steve overrides and instructs Path A in a future PR, the rollback would be:

```sql
-- Restore tenant
UPDATE factories
SET is_active = true, deleted_at = NULL, updated_at = NOW()
WHERE id = 'R_QINGHUAJIAO_REAL';

-- Restore user
UPDATE users
SET factory_id = 'R_QINGHUAJIAO_REAL',
    username = REPLACE(username, '_legacy', ''),
    updated_at = NOW()
WHERE username LIKE 'qhj_admin_legacy';
```

But this rollback would still not recover the FK consistency for `conversation_sessions` (3 rows reassigned) or `restaurant_chain_catalog` (1 row). We strongly recommend not consolidating at all.

---

## 7. Verification commands (re-runnable)

```bash
# 1. Factories metadata
ssh root@47.100.235.168 "sudo -u postgres psql -d cretas_prod_db -At -c \
  \"SELECT id, name, is_active, manually_verified, deleted_at, created_at \
    FROM factories WHERE id IN ('R_QINGHUAJIAO_REAL', 'RES_3101_009') ORDER BY id;\""

# 2. User activity (last_login = today proves not-ghost)
ssh root@47.100.235.168 "sudo -u postgres psql -d cretas_prod_db -At -c \
  \"SELECT username, factory_id, role_code, last_login \
    FROM users WHERE factory_id IN ('R_QINGHUAJIAO_REAL','RES_3101_009') ORDER BY factory_id, id;\""

# 3. Recent conversation sessions (recent activity probe)
ssh root@47.100.235.168 "sudo -u postgres psql -d cretas_prod_db -At -c \
  \"SELECT factory_id, user_id, session_id, created_at \
    FROM conversation_sessions WHERE factory_id = 'R_QINGHUAJIAO_REAL' \
    ORDER BY created_at DESC LIMIT 10;\""

# 4. restaurant_chain_catalog architectural-intent row
ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_prod_db -At -c \
  \"SELECT factory_id, chain_name_zh, source_kind, source_root_path, notes \
    FROM restaurant_chain_catalog WHERE factory_id IN ('R_QINGHUAJIAO_REAL','RES_3101_009');\""

# 5. Nginx live whitelist
ssh root@139.196.165.140 "grep -A2 -B1 'R_QINGHUAJIAO_REAL' \
  /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf | head -20"
```

---

## 8. References

- Issue: [#603 data-hygiene: R_QINGHUAJIAO_REAL ghost tenant](https://github.com/j4xie/my-prototype-logistics/issues/603)
- Related issue: [#538 Test Env Seed: F006 factory missing on test DB](https://github.com/j4xie/my-prototype-logistics/issues/538) — different topic (F006 test env seeding), not a duplicate
- PR #543 (T6.6.3c full cascade) — `25c1535eda` merged 2026-05-13 19:45 UTC
- PR #398 (R_*_REAL chains sampled parity sweep)
- PR #427 / `docs/qa-audits/2026-05-12-r-real-chains-full-sweep-evidence.md` (11 remaining chains, all PASS)
- Migration: `backend/java/cretas-api/src/main/resources/db/flyway/V20260511_01__onboard_14_r_real_chains.sql`
- Seed migration: `backend/python/smartbi/database/migrations/V20260511_02__t6_6_etl_seed_14_real_chains.sql`
- Spec: `docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md` (§57 "Special case — 青花椒")
- Spec: `docs/superpowers/specs/2026-05-11-t6-6-cutover-spec.md` (§T6.6.3b — explicit collision-verification GO criterion)
- Spec: `docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md` (§4.3 footnote — "separate real-data factory")
- Plan C demo seed (origin of `RES_3101_009`'s 140,541 POS): `backend/python/smartbi/database/migrations/2026_04_25_qhj_demo_seed.sql` notes='PLAN_C_DEMO_SEED_2026_04_25'
