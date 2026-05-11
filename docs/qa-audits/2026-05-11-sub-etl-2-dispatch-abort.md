# Sub-ETL-2 dispatch — ABORT (HOLD blocks not cleared + prereqs missing + MO/spec mismatches)

**Status**: ⛔ ABORTED — no impl code written. STOP-and-ping organizer per MO §⛔ HOLD.
**Date**: 2026-05-11
**Author**: chat2 (Sub-ETL-2 designee)
**Branch**: `ops-sub-etl-2-dispatch-abort` (base `origin/main` @ `ab348cb7f8`)
**Triggering MO**: organizer dispatch "Sub-ETL-2 Silver/Gold loader (idempotent UPSERT) per PR #316 §6", marked `⚡ IMMEDIATE — Pre-cleared`.

---

## 0. TL;DR

The dispatch claims `Pre-cleared` but four independent checks contradict that:

1. **HOLD blocks on PR #316 (the cited authority) are NOT cleared.** Spec §9 + PR #316 body both require Steve sign-off on Q-ETL-1/2/3 *before any Sub-ETL chat fires*. No follow-up sign-off PR exists in the last 30 commits on `main`.
2. **Sub-ETL-2c prerequisites do not exist on disk.** Spec §6 marks Sub-ETL-2c as depending on Sub-ETL-1c output (canonical CSVs) + Sub-ETL-2b helpers + Sub-ETL-3b catalog seed. None of these exist.
3. **MO contains factual mismatches with the spec it cites** — file name, natural keys, a referenced table that doesn't exist, and a Gold table family pointing at the wrong migration file.
4. **HARD memory rule violation.** `feedback_organizer_dispatch_must_grep_canonical_HOLD.md` requires grepping recent PRs for `⛔ HOLD` before dispatching on T6.6. PR #316 (merged 5h ago at the time of writing) has six explicit `⛔` lines in §9.

Recommendation: hold dispatch until (a) Steve sign-off PR on Q-ETL-1/2/3 lands, (b) Sub-ETL-1a/b/c + Sub-ETL-3a/b ship per §6 sequencing, then (c) re-issue Sub-ETL-2 MO aligned to spec §3.3 + §1.5.

---

## 1. Finding 1 — HOLD blocks on PR #316 are NOT cleared

### Evidence

**PR #316 body** (verified via `gh pr view 316`):

> *"⛔ HOLD: Design spec only — no code, no DDL, no deploys, no nginx changes"*
> *"Sign-off needed on minimum Q-ETL-1 (tenant abstraction), Q-ETL-2 (catalog table ship), Q-ETL-3 (factory_id naming) before Sub-ETL-3 dispatches"*

**Spec §9 (`docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md:643-652`)** — six explicit ⛔ HOLD lines, including:

- *"This is a design spec only. No code edits, no migrations applied, no DDL run, no deploys, no nginx changes."*
- *"Steve sign-off required on at minimum Q-ETL-1, Q-ETL-2, Q-ETL-3 before Sub-ETL-3 dispatches."*

**Spec §10 Sign-off checklist** (lines 660-665) — five unchecked `[ ]` boxes for Steve / engineering organizer / T6.5 Phase C lead / reviewer audit.

### Verification: no sign-off PR exists

`git log --oneline -30 origin/main` (post-PR #316 merge) shows no PR touching Q-ETL questions. The most recent T6.6-tagged commits in the chain are:

- `97b02ad437` PR #316 — design spec (this one, status DRAFT)
- `50761f4248` PR #298 — pre-flight blocker audit *"PAUSE dispatch, ETL + Q4/Q5 unresolved"* (predecessor)

No `signoff(t6-6-q-etl-*)` or equivalent. The MO's `Pre-cleared` claim is unverified.

---

## 2. Finding 2 — Sub-ETL-2c prerequisites do not exist on disk

Spec §6 sequencing makes Sub-ETL-2c the **last** sub-batch on the critical path, depending on three predecessors. None exist:

| Prereq | Spec citation | Disk check | Status |
|---|---|---|---|
| Sub-ETL-1c canonical CSV output | §6 row 5 + §3.2 + §3.3 line 408 | `ls data/imports/` → *"No such file or directory"* | ❌ Missing |
| Sub-ETL-2b `_lib/upsert_helpers.py` | §6 row 7 + §3.1 line 292 | `ls scripts/etl/` → *"No such file or directory"* | ❌ Missing |
| Sub-ETL-3b `V20260815_03__t6_6_etl_seed_14_real_chains.sql` | §6 row 2 + §2.4 | `ls backend/python/smartbi/database/migrations/V20260815_*` → no match | ❌ Missing |
| `restaurant_chain_catalog` table (Sub-ETL-3a) | §2.2 | `grep restaurant_chain_catalog backend/python/smartbi/database/migrations` → no match | ❌ Missing |

Without canonical CSVs the loader has no input to consume. Without the catalog seed the loader cannot resolve `factory_id` → chain metadata. Without helpers the orchestrator has nothing to orchestrate. The MO assumes all three are landed; none are.

---

## 3. Finding 3 — MO contains factual mismatches with the spec it cites

| # | MO claim | Spec / schema reality | Severity |
|---|---|---|---|
| 3.1 | Output file: `scripts/etl/load-silver-gold.py` | Spec §3.1 line 285 + §3.3 line 401: `scripts/etl/import_restaurant_chain.py` (underscores, chain-scoped naming) | naming drift |
| 3.2 | Natural keys: *"(factory_id + date + product_id 等)"* | Schema `2026_04_29_silver_facts.sql:54`: `UNIQUE (factory_id, source_type, store_id, source_bill_no)` for `fact_pos_transaction`. Spec §1.5 + Q1 §4.2: `(factory_id, source_type='excel', store_id, source_bill_no, line_no)` for `fact_pos_item`. `date` + `product_id` are **NOT** part of any UPSERT key on fact tables. | wrong keys — would write duplicates on re-run |
| 3.3 | *"日志: stdout + dedicated `etl_run_log` table"* | `grep etl_run_log backend/python/smartbi/database/migrations` → 0 hits. No such table defined anywhere. Spec does not mention it. | fabricated dependency |
| 3.4 | *"Aggregator 跑 Gold tables: `agg_restaurant_daily_*` per existing schema"* + MO 必读 lists `2026_05_05_gold_aggregations.sql` | `agg_restaurant_daily_ops` / `agg_restaurant_daily_totals` / `agg_restaurant_product_cost` are defined in `2026_04_24_gold_restaurant_ops.sql` (NOT the file MO cites). `2026_05_05_gold_aggregations.sql` defines `agg_daily` / `agg_product` / `agg_channel` (no `_restaurant_` prefix). Spec §3.3 line 472-476 itself confuses these two migrations. | cited the wrong migration |
| 3.5 | Time budget: Phase 1 ~90 min + Phase 2 ~40 min + Phase 3 doc | Spec §6: Sub-ETL-2a+2b+2c = 0.3+0.7+2.0 = **3.0 person-days**. *"pilot"* qualifier in MO §⛔ partially reconciles but the natural-key & table-list errors mean the pilot would still produce wrong code. | scope unclear |

The MO's `必读` block does include the right files for *audit*, but the impl instructions diverge from them on the points above.

---

## 4. Finding 4 — HARD memory rule violation

Memory entry `feedback_organizer_dispatch_must_grep_canonical_HOLD.md` (HARD, May 9–10 2026, 6 catches in 48h):

> *"ANY dispatch on T6.5/T6.6/Phase 2C/Phase D MUST grep recent PRs for `⛔ HOLD` / `kickoff blocked` / `Aug 2026` / `prerequisite` strings BEFORE writing MO."*

PR #316 (cited as authority by this very MO) contains six `⛔` lines in §9 and the explicit string *"Steve sign-off required ... before Sub-ETL-3 dispatches"* (line 646). A grep would surface them in seconds. The dispatch appears to have skipped that step.

Related memory: `feedback_organizer_dispatch_must_read_prior_sub_keep_list.md` (HARD, May 9–10) — same root cause pattern (organizer dispatching against canonical block-lists in prior PRs).

---

## 5. Recommendation

**Re-dispatch sequence** (per spec §6 + §10 sign-off list):

1. **Q-ETL sign-off MO to Steve** — single ~10-min review of §5 Q-ETL-1 / Q-ETL-2 / Q-ETL-3 (the three blocking questions) with recommended defaults pre-filled. Optionally Q-ETL-4..10 (defaults sufficient). Output: a tiny PR amending §10 with Steve's `[x]` marks.
2. **Sub-ETL-1a + Sub-ETL-3a in parallel** — foundation work (column mapping / format detection / chain catalog table migration). Per spec §6 critical-path, these have no upstream deps once sign-off lands.
3. **Sub-ETL-1b → Sub-ETL-1c** — canonical CSV writer + orchestrator. Produces the `data/imports/restaurant-chains/` tree Sub-ETL-2c needs.
4. **Sub-ETL-3b** — 14-row catalog seed migration. ~0.3pd, can run parallel with Sub-ETL-1b/c after 3a merges.
5. **Sub-ETL-2a (Day 0 audit)** — answer §1.5 verify-table column on existing schema (4 ⚠️ rows). Standalone, can fire parallel with 1a/3a; output gates whether V20260815_02 ships empty or with `ALTER TABLE ... ADD CONSTRAINT`.
6. **Sub-ETL-2b helpers → Sub-ETL-2c orchestrator** — only fires after 1c output exists, 3b seed exists, 2a audit answered. This is what *should* be the Sub-ETL-2 MO when scope is right.

**MO corrections needed for re-dispatch of step 6:**

- File name: `scripts/etl/import_restaurant_chain.py` (underscores, per spec §3.3)
- Natural keys: cite `fact_pos_transaction.uq_fact_pos_txn` and Q1 §4.2 `(factory_id, source_type, store_id, source_bill_no, line_no)` for fact_pos_item — **not** `date + product_id`
- Drop `etl_run_log` table reference (or define it explicitly in V20260815_02 if logging-to-table is desired — spec is silent, current default is stdout only)
- Fix Gold table citation: read `2026_04_24_gold_restaurant_ops.sql` (the file that actually defines `agg_restaurant_*`), not `2026_05_05_gold_aggregations.sql` (which defines `agg_daily`/`agg_product`/`agg_channel`)
- Time budget: own ~2pd (Sub-ETL-2c only) or ~3pd (2a+2b+2c bundled), not ~150 min

---

## 6. What I did (and did NOT do)

✅ Read spec §1 + §6 + §9 (676 LOC) in full.
✅ Read `2026_04_29_silver_facts.sql`, `2026_05_05_gold_aggregations.sql`, `2026_04_28_silver_dimensions.sql`.
✅ Verified `scripts/etl/` and `data/imports/` do not exist; verified absent migrations / tables.
✅ Pulled PR #316 body via `gh pr view 316`.
✅ Grepped `agg_restaurant_*` and `etl_run_log` across migrations.
✅ Wrote this audit doc on isolated worktree branch `ops-sub-etl-2-dispatch-abort`.

❌ Did NOT create `scripts/etl/load-silver-gold.py` or any other code.
❌ Did NOT create any V*.sql migration.
❌ Did NOT touch any DB (local, test, or prod).
❌ Did NOT push the branch — STOP-and-ping per MO §⛔ HOLD final line.

---

## 7. Evidence appendix (verifiable commands)

```bash
# Worktree state
git rev-parse HEAD                          # ab348cb7f8...
git branch --show-current                   # ops-sub-etl-2-dispatch-abort

# HOLD verification
gh pr view 316 --json state,body | grep -i "hold\|sign-off"
sed -n '643,665p' docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md

# Prereq verification
ls scripts/etl/                             # No such file or directory
ls data/imports/                            # No such file or directory
ls backend/python/smartbi/database/migrations/V20260815_*  # no match
grep -l restaurant_chain_catalog backend/python/smartbi/database/migrations  # no match
grep -l etl_run_log backend/python/smartbi/database/migrations               # no match

# Natural key verification
sed -n '52,56p' backend/python/smartbi/database/migrations/2026_04_29_silver_facts.sql
# → CONSTRAINT uq_fact_pos_txn UNIQUE (factory_id, source_type, store_id, source_bill_no)

# Gold-table file verification
grep -nE "^CREATE TABLE" backend/python/smartbi/database/migrations/2026_05_05_gold_aggregations.sql
# → agg_daily / agg_product / agg_channel (no _restaurant_)
grep -nE "^CREATE TABLE" backend/python/smartbi/database/migrations/2026_04_24_gold_restaurant_ops.sql
# → agg_restaurant_daily_ops / agg_restaurant_daily_totals / agg_restaurant_product_cost
```

---

## 8. Cross-references

- PR #316 — `docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md` (authority cited by MO)
- PR #298 — `docs/qa-audits/2026-05-11-t6-6-phase-b-pre-flight-blockers.md` (immediate predecessor, said "PAUSE dispatch")
- PR #223 — Q1 amendment §4.3 (14-chain factory_id table referenced by spec §1.4)
- PR #249 — T6.6 Phase B execute MO (DRAFT/HOLD)
- HARD memory `feedback_organizer_dispatch_must_grep_canonical_HOLD.md` (May 9–10 2026)
- HARD memory `feedback_organizer_dispatch_must_read_prior_sub_keep_list.md` (May 9–10 2026)
- `.claude/rules/concurrent-edit-safety.md` Rule 5b (paths-only commit used here)

---

*End of abort audit. Branch held on `ops-sub-etl-2-dispatch-abort`, NOT pushed. Organizer: please decide between (a) merge this audit to `main` as a dispatch-error record, (b) discard and supersede with corrected MO sequence, or (c) other.*
