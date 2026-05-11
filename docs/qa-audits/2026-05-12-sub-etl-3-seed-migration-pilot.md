# Sub-ETL-3 Seed Migration Pilot — Audit Report

**Date**: 2026-05-11 (work date) — file label per MO `2026-05-12-...`
**Branch**: `ops-sub-etl-3-seed-migration` (worktree: `.worktrees/sub-etl-3-seed-migration/`)
**Author**: chat3 (Sub-ETL-3 dispatched per PR #316 §6 Sub-ETL-3a + Sub-ETL-3b)
**Predecessors**: PR #316 (spec, merged 2026-05-11) · PR #223 (Q1 real-DB amendment, merged) · PR #298 (Phase B pre-flight audit, merged)
**Status**: ⛔ HOLD before push — migration files written in worktree, no DB execute, awaiting organizer GO + live dry-run.

---

## 0. TL;DR

Two new V*.sql migrations seed the T6.6 Phase B `restaurant_chain_catalog` per PR #316 spec §1.2 + §1.4 + §2.2 + §2.4:

| File | Rows | Bytes | Purpose |
|---|---|---|---|
| `V20260511_01__t6_6_etl_chain_catalog.sql` | n/a (DDL) | 2546 | CREATE TABLE `restaurant_chain_catalog` + PK + CHECK + index + trigger |
| `V20260511_02__t6_6_etl_seed_14_real_chains.sql` | 14 INSERT | 4061 | INSERT 14 real-data chains per Q1 §4.3 verbatim |

Effort: ~0.5 person-day per Q1 §4.3 estimate.

⛔ **HOLD** per MO §⛔ and `feedback_pause_before_deploy_or_push.md` — files committed to local worktree only. Push + PR + runner apply gated on organizer GO.

---

## 1. MO vs Spec Reconciliation

The marching order had three divergences from PR #316 spec; all were raised with Steve and resolved before any code was written.

### 1.1 Resolution table

| MO instruction | Spec reference | Resolution (Steve sign-off) |
|---|---|---|
| `V20260815_01__seed_restaurant_chain_catalog.sql` — conflate CREATE TABLE + INSERT seed into one file | §2.1 splits into V_01 (table) + V_03 (seed) | **Split per spec.** Two files: V20260511_01 (table) + V20260511_02 (seed). |
| `V20260815_02__add_factory_tenant_columns.sql` — ALTER cretas_prod_db tables, add `tenant_type` column, BACKFILL 75 + 14 | §1.1 EXPLICITLY rejects new tenant abstraction (Q-ETL-1 default); §4.2 lists cretas_prod_db change as OUT of ETL scope (Q-ETL-4 deferred); migration runner cannot apply to cretas_prod_db (`apply-smartbi-migrations.sh:75-76`) | **DROPPED entirely.** No tenant_type column, no cretas_prod_db ALTER. factory_id remains the sole tenant identifier per Q-ETL-1. |
| V_02 (constraint fixups) included in this PR | §6 batch #6 = Sub-ETL-2a owns constraint fixups, gated on Sub-ETL-2 Day 0 audit | **DEFERRED to Sub-ETL-2a.** This PR ships only Sub-ETL-3 deliverables (table + seed). Sub-ETL-2a writes its own dated file when dispatched. |
| Filename date placeholder `V20260815_NN` | Q-ETL-10 default = use actual dispatch date | **Renamed to `V20260511_NN`** (today's dispatch date). |

### 1.2 Why MO file #2 had to be dropped (cretas_prod_db tenant_type)

Three independent reasons made the MO's V_02 a non-starter:

1. **Spec design-decision contradiction.** PR #316 §1.1 line 44–53 explicitly rejects "introduce restaurant_tenant_id" framing in favor of `factory_id` as sole tenant. The MO's `tenant_type` column on `factories` is structurally that same rejected abstraction. Q-ETL-1 default (Steve-signed-off) seals this decision.

2. **Out-of-scope for ETL.** §4.2 line 533: *"Create `factories` row in cretas_prod_db (Q-ETL-4 — separate decision)"* is explicitly listed under "What ETL infra DOES NOT do."

3. **Infrastructure mismatch.** The smartbi migration runner (`scripts/migrations/apply-smartbi-migrations.sh:75-76`) maps `--env test` → `smartbi_db` and `--env prod` → `smartbi_prod_db`. There is **no path** to apply a V*.sql against `cretas_prod_db` through this runner. cretas schema changes route through Java Flyway / Hibernate `ddl-auto`, not the smartbi runner.

Steve confirmed: drop the file entirely; cretas-side `factories` rows (if/when needed) are a separate Q-ETL-4 decision outside this scope.

### 1.3 Q-ETL sign-off recorded (this audit + PR description)

Per spec §10 prerequisite, Steve signed off in this dispatch:

- [x] **Q-ETL-1** — factory_id is sole tenant; no new abstraction. Recorded 2026-05-11.
- [x] **Q-ETL-2** — ship `restaurant_chain_catalog` table per §1.2/§2.2. Recorded 2026-05-11.
- [x] **Q-ETL-3** — factory_id naming per Q1 §4.3 verbatim; `R_HUOGUO_GENERIC_REAL` kept SEPARATE (not merged with `R_SHANGMA_HG_REAL`); `_HG` suffix retained on hot-pot chains. Recorded 2026-05-11.
- (Q-ETL-4..Q-ETL-10) using spec defaults per §10 line 564 ("Q-ETL-4 through Q-ETL-10 can use defaults at chat dispatch").

---

## 2. Migration File Detail

### 2.1 `V20260511_01__t6_6_etl_chain_catalog.sql` (table creation)

Mirrors spec §2.2 skeleton verbatim:

- `CREATE TABLE IF NOT EXISTS restaurant_chain_catalog` — idempotent.
- `factory_id VARCHAR(50) PRIMARY KEY` — 1:1 with chain; no parallel ID space (Q-ETL-1 default).
- `chain_name_zh VARCHAR(200) NOT NULL`, `chain_name_roman VARCHAR(100) NOT NULL` — both required, no fallback.
- `cuisine VARCHAR(50)` nullable — three chains (鸿德记, 有滋有味, 邻家宴) have NULL cuisine per Q1 §4.3.
- `source_kind VARCHAR(20) NOT NULL` + `CONSTRAINT chk_chain_source_kind CHECK (source_kind IN ('REAL', 'DEMO', 'TEST'))` — admits the existing `RES_3101_009` (DEMO) and F999 (TEST) chains alongside new 14 REAL rows.
- `source_root_path VARCHAR(500)` — operational provenance hint (relative path under `smartbi维度分析/大众点评/真实餐饮连锁数据/`).
- `notes TEXT` — free-form provenance note (used in seed for Q-ETL-3 sign-off audit trail).
- `created_at`, `updated_at` TIMESTAMP with DEFAULT NOW() — audit columns matching existing Silver dim pattern.
- `idx_chain_catalog_source_kind` on `source_kind` — supports admin queries filtering REAL vs DEMO vs TEST.
- `silver_touch_updated_at()` BEFORE UPDATE trigger — reuses existing function defined in `2026_04_28_silver_dimensions.sql:36` (verified via grep; function uses `CREATE OR REPLACE` so always present in target DB before this migration runs).
- **No RLS.** Spec §1.2 explicitly: *"control-plane catalog readable by all factory contexts"* — cross-tenant data leakage stays blocked at the dim_store / fact_* RLS layer.

### 2.2 `V20260511_02__t6_6_etl_seed_14_real_chains.sql` (14 INSERT rows)

Mirrors spec §2.4 + Q1 §4.3 verbatim, with two small annotation refinements:

- Single `INSERT INTO ... VALUES (...), (...), ..., (...) ON CONFLICT (factory_id) DO NOTHING;` — idempotent re-apply, never overwrites existing rows.
- 14 rows, ordered per Q1 §4.3 table.
- All `source_kind = 'REAL'` (satisfies CHECK constraint).
- All `factory_id` follow `R_<ROMAN>_REAL` convention per Q-ETL-3 default.

| # | factory_id | chain_name_zh | cuisine | notes column flavor |
|---|---|---|---|---|
| 1 | R_ILTEATRO_REAL | IL TEATRO 西餐 | Western | base note |
| 2 | R_SHANGMA_HG_REAL | 上马火锅 | HotPot | base note |
| 3 | R_JINCHUAN_HG_REAL | 锦川火锅 | HotPot | "5-month series" |
| 4 | R_XIMAXIANG_REAL | 唏嘛香 牛肉面 | Noodles | base note |
| 5 | R_YUJIUJING_REAL | 御九井 日料 | Japanese | base note |
| 6 | R_YONGHE_REAL | 永和豆浆 | FastFood | base note |
| 7 | R_XINBASHU_REAL | 鑫巴蜀 | Sichuan | "5-month series" |
| 8 | R_QINGHUAJIAO_REAL | 青花椒 | Sichuan | **"distinct from RES_3101_009 demo seed"** — explicit annotation per Q1 §4.3 footnote |
| 9 | R_DONGMENKOU_REAL | 东门口 | Local | "CSV + 2025 history" |
| 10 | R_HONGDEJI_REAL | 鸿德记 | NULL | "5-month series" |
| 11 | R_JINRINIUSHI_REAL | 今日牛事 | Beef | "5-month series" |
| 12 | R_YOUZIYOUWEI_REAL | 有滋有味 | NULL | "5-month series" |
| 13 | R_LINJIAYAN_REAL | 邻家宴 | NULL | "5-month series" |
| 14 | R_HUOGUO_GENERIC_REAL | 火锅 (generic) | HotPot | **"kept separate from R_SHANGMA_HG_REAL per Q-ETL-3 sign-off (generic 利润表 vs sales-report distinction)"** — sealed Q-ETL-3 decision recorded in-row |

**Annotation refinements vs spec §2.4 verbatim text**:

1. Row 14 (`R_HUOGUO_GENERIC_REAL`) notes column updated from spec's *"merge candidate with R_SHANGMA_HG_REAL — see Q-ETL-3"* (pending-decision wording) to *"kept separate per Q-ETL-3 sign-off"* (sealed-decision wording). Reason: Steve signed off Q-ETL-3 keep-separate default; the "see Q-ETL-3" pointer is stale.
2. All other rows verbatim per spec §2.4.

### 2.3 What was NOT included in this PR

Per scope answers:

- ❌ No V20260511_03 / V20260815_02 constraint fixups — Sub-ETL-2a owns per spec §6 batch #6.
- ❌ No ALTER on cretas_prod_db.factories — Q-ETL-4 deferred decision.
- ❌ No tenant_type column anywhere — Q-ETL-1 default rejects.
- ❌ No Python loader code (`scripts/etl/`) — Sub-ETL-1 and Sub-ETL-2 deliverables.
- ❌ No nginx route changes — Sub-F (organizer-owned, post-Phase B cutover).
- ❌ No `factories` row creation in cretas_prod_db — explicit non-goal per spec §4.2.
- ❌ No production deploy / no test env deploy — HOLD per MO §⛔ + memory `feedback_pause_before_deploy_or_push.md`.

---

## 3. Static Validation Performed (local)

Live psql is not available in the dispatch chat environment (no local PostgreSQL client; remote test DB at 47.100.235.168 requires SSH + `sudo -u postgres psql`). Static-only validation performed below; live `--dry-run` is documented in §4 as an organizer-side step.

### 3.1 File presence + size

```
backend/python/smartbi/database/migrations/V20260511_01__t6_6_etl_chain_catalog.sql      2546 bytes
backend/python/smartbi/database/migrations/V20260511_02__t6_6_etl_seed_14_real_chains.sql 4061 bytes
```

### 3.2 SQL shape

| Check | V_01 result | V_02 result |
|---|---|---|
| Paren balance (code only, comments stripped) | 13 `(` = 13 `)` ✓ | 25 `(` = 25 `)` ✓ |
| Statement count (code-line `;`) | 4 (CREATE TABLE / CREATE INDEX / DROP TRIGGER / CREATE TRIGGER) | 1 real (INSERT terminator) + 2 inside string-literal `notes` content (Postgres parses as string content, not statement break) |
| Row count in INSERT VALUES | n/a | 14 ✓ (matches Q1 §4.3 table) |
| All `source_kind` values satisfy CHECK | n/a | 14/14 = 'REAL' ✓ |
| No duplicate `factory_id` keys | n/a | 14 distinct strings ✓ |

### 3.3 Cross-file consistency

- V_02 references `restaurant_chain_catalog` (created by V_01); filename sort `V20260511_01_*` < `V20260511_02_*` guarantees the runner applies V_01 first.
- V_02 column list `(factory_id, chain_name_zh, chain_name_roman, cuisine, source_kind, source_root_path, notes)` matches V_01 column declarations (7 columns; `created_at`/`updated_at` omitted, defaulted by V_01).
- `ON CONFLICT (factory_id)` references PRIMARY KEY declared in V_01 — valid.
- `CHECK (source_kind IN ('REAL', 'DEMO', 'TEST'))` admits all 14 seed rows (all 'REAL').

### 3.4 No factory_id collisions in existing migrations / code

Grep over `backend/python/` + `backend/java/` for `R_QINGHUAJIAO_REAL` / `R_ILTEATRO_REAL` / `R_SHANGMA_HG_REAL` / `R_HUOGUO_GENERIC_REAL`: **0 matches**. Safe to introduce as net-new factory_ids. The existing `RES_3101_009` (qhj synthetic demo seed) coexists in `raw_material_types` / `product_types` / `bom_*` tables and stays untouched (Q1 §4.3 footnote: distinct factory).

### 3.5 silver_touch_updated_at() function dependency

Function is declared in `2026_04_28_silver_dimensions.sql:36` with `CREATE OR REPLACE FUNCTION` — already part of the applied migration history for both `smartbi_db` and `smartbi_prod_db` (per runner tracker). No bootstrap concern when V_01 runs.

---

## 4. Validation NOT Performed Locally (organizer-side responsibility before merge)

Live dry-run + apply through the runner is gated on organizer GO + push. Below is the verification plan when GO arrives.

### 4.1 Runner dry-run on test env (smartbi_db)

```bash
# On server 47.100.235.168, with branch checked out:
bash scripts/migrations/apply-smartbi-migrations.sh --env test --dry-run --target V20260511_02
```

Expected output:
- `[migrations] [dry-run] would apply V20260511_01__t6_6_etl_chain_catalog.sql` — applies CREATE TABLE / trigger inside BEGIN, then ROLLBACKs. Tracker untouched.
- `[migrations] [dry-run] would apply V20260511_02__t6_6_etl_seed_14_real_chains.sql` — applies INSERT inside BEGIN, then ROLLBACKs.
- Both should report `would apply in <N>ms (rolled back)`.

If either file errors during BEGIN/ROLLBACK wrap → SQL syntactically broken → fix in worktree, re-run dry-run.

### 4.2 Real apply on test env

```bash
./scripts/deploy/deploy-smartbi-python.sh --env test
```

Step 3.5 of the deploy script invokes the runner. Expected:
- Migration runner applies V_01 + V_02 successfully (no rollback).
- Tracker rows inserted with filename + checksum.
- Smoke verify:
  ```bash
  ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_db -c \
    'SELECT COUNT(*) FROM restaurant_chain_catalog WHERE source_kind=\\'REAL\\';'"
  # Expected: 14
  ```

### 4.3 Real apply on prod env (smartbi_prod_db)

After test env smoke passes and organizer reviews:

```bash
./scripts/deploy/deploy-smartbi-python.sh --env prod
```

Same expected outcome; prod tracker also gets two new rows.

### 4.4 Rollback (if needed)

```sql
-- Rollback only the data seed (table stays for future use):
DELETE FROM restaurant_chain_catalog WHERE source_kind = 'REAL';

-- Full rollback of both migrations (drop table + tracker entries):
DROP TABLE IF EXISTS restaurant_chain_catalog CASCADE;
DELETE FROM smartbi_migrations
  WHERE filename IN (
    'V20260511_01__t6_6_etl_chain_catalog.sql',
    'V20260511_02__t6_6_etl_seed_14_real_chains.sql'
  );
```

The full rollback path is safe because no downstream object references `restaurant_chain_catalog` yet (Step 1 normalize / Step 2 load happen in later PRs after Sub-ETL-1c + Sub-ETL-2c).

---

## 5. ⛔ HOLD Gate (per MO §⛔ + memory HARD RULES)

Per the MO's explicit `⛔ HOLD` clause + `feedback_pause_before_deploy_or_push.md` HARD rule + `feedback_chat_must_push_before_clear.md` HARD rule:

- ✅ Migration files written in worktree `.worktrees/sub-etl-3-seed-migration/`.
- ✅ Audit report written (this doc).
- ⛔ **NOT YET DONE** — local commit (await organizer review of this audit).
- ⛔ **NOT YET DONE** — push to origin.
- ⛔ **NOT YET DONE** — PR create.
- ⛔ **NOT YET DONE** — runner dry-run / apply on test / apply on prod (organizer-owned).

When organizer issues GO:

1. Inside worktree: `git add backend/python/smartbi/database/migrations/V20260511_01__*.sql backend/python/smartbi/database/migrations/V20260511_02__*.sql docs/qa-audits/2026-05-12-sub-etl-3-seed-migration-pilot.md`
2. `git commit -- <those exact paths>` (per `concurrent-edit-safety.md` Rule 5b paths-only mode to defeat husky/lint-staged scope creep across parallel worktrees).
3. `git status --short` post-commit verify — only those 3 files in the commit.
4. `git push -u origin ops-sub-etl-3-seed-migration` (after fetch + verify base is current per `feedback_organizer_must_git_pull_before_deploy.md` HARD).
5. Open PR with predecessors chain (#196, #199, #203, #220, #223, #249, #298, #316).
6. Organizer triggers `apply-smartbi-migrations.sh --env test --dry-run` per §4.1 above.

---

## 6. Cross-references

| Doc | Path / PR | Relation |
|---|---|---|
| T6.6 Phase B ETL infra design spec | `docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md` (PR #316) | Directly implements §1.2 + §1.4 + §2.2 + §2.4; Q-ETL-1/2/3 sign-off |
| Q1 real-DB amendment | `docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md` (PR #223) | §4.3 14-row table is the authoritative seed list |
| T6.6 Phase B execute MO | PR #249 (DRAFT/HOLD) | Sub-A / Sub-B remain HOLD pending T6.5 Phase C close + soak; ETL infra is pre-MO scope per PR #298 §6.2 |
| T6.6 Phase B pre-flight audit | PR #298 | §6.2 recommended this Sub-ETL-3 dispatch parallel with T6.5 Phase C close |
| smartbi migration runner spec | `docs/superpowers/specs/2026-05-07-smartbi-migration-runner-spec.md` | Runner contract; tracker PK = filename |
| Migration runner script | `scripts/migrations/apply-smartbi-migrations.sh` | Will apply these two files via Step 3.5 of deploy-smartbi-python.sh |
| Server operations HARD RULE | `.claude/rules/server-operations.md` § "Smartbi 数据库 schema 变更" | All smartbi schema goes through runner; this PR complies |
| Existing silver dim pattern | `backend/python/smartbi/database/migrations/2026_04_28_silver_dimensions.sql` | `silver_touch_updated_at()` defined at line 36; reused by V_01 |
| qhj demo seed (collocation reference) | `backend/python/smartbi/database/migrations/2026_04_25_qhj_demo_seed_v5.sql` | `RES_3101_009` (qhj DEMO) coexists with new `R_QINGHUAJIAO_REAL` (REAL) per Q1 §4.3 footnote |
| Concurrent edit safety | `.claude/rules/concurrent-edit-safety.md` | Rule 5b `git commit -- <paths>` mode for the eventual commit |

---

## 7. Effort & Time Accounting

| Phase | Spec estimate | Actual |
|---|---|---|
| Phase 1 — migration file writes | ~60 min | ~25 min (after MO reconciliation pause) |
| Phase 2 — static validation | ~30 min | ~10 min (no live dry-run available) |
| Phase 3 — audit report | ~30 min (~250 LOC target) | ~35 min (~310 LOC) |
| MO reconciliation pause + Steve sign-off Q&A | not budgeted | ~10 min |
| **Total** | ~120 min | ~80 min — under budget |

Per spec §6 batch breakdown: Sub-ETL-3a = 0.2pd, Sub-ETL-3b = 0.3pd, combined 0.5pd. This run sits inside that envelope.

---

## 8. Sign-off Checklist (filling spec §10 prerequisites)

- [x] Steve — Q-ETL-1 (tenant abstraction = factory_id sole) decision recorded — §1.3 above + PR description.
- [x] Steve — Q-ETL-2 (catalog table ship) decision recorded — §1.3 above + PR description.
- [x] Steve — Q-ETL-3 (factory_id naming Q1 §4.3 verbatim; keep R_HUOGUO_GENERIC_REAL separate; _HG suffix retained) decision recorded — §1.3 above + PR description.
- [ ] Reviewer audit cycle on this PR (per `feedback_subagent_driven_audit_pattern.md` — 2-4 cycles recommended on migration-touching PRs).
- [ ] Engineering organizer review of audit (this doc) → issues GO to push.
- [ ] T6.5 Phase C lead — confirm Sub-ETL-3 worktree (`.worktrees/sub-etl-3-seed-migration/`) does not collide with any active T6.5 worktree.
- [ ] Live dry-run on test env (organizer-side) per §4.1.
- [ ] Real apply on test env per §4.2; 14-row smoke verify.
- [ ] Real apply on prod env per §4.3 after test smoke OK.

---

**End of Sub-ETL-3 Seed Migration Pilot audit report.**

*Author: chat3 (post-`/clear`, 2026-05-11). Worktree: `.worktrees/sub-etl-3-seed-migration/`. Branch: `ops-sub-etl-3-seed-migration`.*
*Per HARD memories `feedback_pause_before_deploy_or_push.md` + `feedback_dispatch_on_technical_readiness.md` + `feedback_chat_must_push_before_clear.md`: STOP-and-ping organizer before push. /clear must wait until push verified.*
