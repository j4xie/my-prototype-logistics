# Sub-ETL-1 Follow-up — Modular Split + Profit/Purchase + Q-DEC-6 F1 return_qty

**Date**: 2026-05-11 (file dated 2026-05-12 per dispatch convention)
**Author**: chat1 (Sub-ETL-1 follow-up impl, post-`/clear` context)
**Branch**: `ops-sub-etl-1-followup`
**Worktree**: `.worktrees/sub-etl-1-followup/`
**Status**: ⛔ HOLD — committed locally, NOT pushed. STOP-and-ping organizer per dispatch §⛔ HOLD.
**Predecessors**: PR #316 (ETL infra spec) → PR #327 (Sub-ETL-1 pilot) → PR #326+#330 (Q-DEC ratification) → this PR.

---

## 0. TL;DR

Three follow-up workstreams bundled into one PR (per organizer dispatch):

1. **`_lib/` modular split** — extract PR #327's monolithic 655 LOC into 3 reusable modules.
2. **2 new report types** — 利润表 (profit) + 采购入库明细 (purchase_inbound). PR #327 only handled `product_sales`.
3. **Q-DEC-6 F1 schema extension** — `V20260511_03__fact_pos_item_add_return_qty.sql` adds `return_qty NUMERIC(18,3) DEFAULT NULL` column. canonical CSV's existing `qty_refund` column is the upstream surface.
4. **gitignore policy** — `data/imports/` raw + canonical CSV not committed; `.gitkeep` placeholders preserve directory tree.

**Tests**: 51/51 pass (40 baseline + 11 new). 0 deletions, 1 amended (profit detection now SUPPORTED, not UNSUPPORTED).

**⛔ Drift between MO and canonical PR #326 §6 line 522 spec** — see §3 below. Pilot follows MO; organizer to decide if spec scope should be restored.

---

## 1. Files Changed

| Path | LOC | Δ | Purpose |
|---|---|---|---|
| `scripts/etl/_lib/format_detect.py` | 91 | NEW | Sub-ETL-1a: format dispatch + readers (xls/xlsx/csv) |
| `scripts/etl/_lib/column_mapping.py` | 258 | NEW | Header maps (3 report types) + 14-chain catalog + `detect_report_type` + `match_chain_for_path` |
| `scripts/etl/_lib/quarantine.py` | 66 | NEW | QR_* enums + QuarantineEvent + `write_quarantine` |
| `scripts/etl/normalize_restaurant_chains.py` | 491 (was 655) | REFACTOR | Imports from `_lib`; keeps row normalize + file orchestrator + CLI |
| `backend/python/smartbi/database/migrations/V20260511_03__fact_pos_item_add_return_qty.sql` | 33 | NEW | Q-DEC-6 F1 — adds `fact_pos_item.return_qty NUMERIC(18,3) DEFAULT NULL` |
| `backend/python/tests/test_normalize_restaurant_chains.py` | 705 (was 493) | +11 new tests, 1 amended | Phase 1 split verified; Phase 2 new types covered; Phase 3 return_qty path covered |
| `.gitignore` | +9 lines | EDIT | `data/imports/restaurant-chains/**` + `data/imports/_quarantine/**` + `data/imports/_index.json`, with `.gitkeep` exception |
| `data/imports/restaurant-chains/.gitkeep` | 8 | NEW | Directory placeholder + operator pointer |
| `data/imports/_quarantine/.gitkeep` | 7 | NEW | Directory placeholder + operator pointer |

**Total**: 9 files (3 NEW _lib, 1 REFACTOR, 1 NEW migration, 1 EDIT tests, 1 EDIT gitignore, 2 NEW .gitkeep).

**Zero touched**: Java sources, Python service code (`backend/python/smartbi/api/`, `backend/python/smartbi/services/`), nginx, deploy scripts.

---

## 2. Phase-by-Phase Delta

### 2.1 Phase 1 — `_lib/` Modular Split

PR #327's `normalize_restaurant_chains.py` was 655 LOC, inlining all of:
- format detection + readers
- 19-column `PRODUCT_SALES_HEADER_MAP` + `CHAIN_CATALOG` + `match_chain_for_path` + `detect_report_type`
- closed-enum `QR_*` constants + `QuarantineEvent` dataclass + `write_quarantine`
- row normalize + file orchestrator + CLI

This PR extracts the first three layers into `_lib/`. Orchestrator file shrank from 655 → 491 LOC (mostly because column maps moved out; line count didn't drop proportionally because new report-type imports + `report_spec` parameter wiring added back).

**Test compat**: 40 existing tests pass unchanged via re-export from `normalize_restaurant_chains` namespace. The test file loads the script via `importlib.util.spec_from_file_location` (per Q-ETL-5 — `scripts/etl/` is operational, not a Python package). Self-bootstrap `sys.path.insert` in the script makes `from _lib.X import Y` work in both CLI-invocation and importlib-load paths.

**KEEP from PR #327** (verified intact):
- Closed-enum quarantine reasons (`QR_UNKNOWN_CHAIN` / `QR_UNSUPPORTED_REPORT_TYPE` / `QR_MISSING_HEADER` / `QR_MISSING_REQUIRED_COLUMN` / `QR_NON_NUMERIC_NUMERIC_FIELD` / `QR_EMPTY_REQUIRED_FIELD` / `QR_UNREADABLE_FILE`).
- `_index.json` deterministic file ordering (sort by `(chain, report, period)`).
- `lineterminator="\n"` everywhere for byte-identical idempotence.
- 19-column `PRODUCT_SALES_HEADER_MAP` verbatim (incl. line 71 `退货数量(不含套餐子商品) → qty_refund`).
- Banner skip + `max_scan=10` header detection heuristic.
- Two-pass row validation (required-col check first, then numeric coercion).
- SHA-256 idempotence verification.
- Q-ETL defaults (Q-ETL-5 location, Q-ETL-6 fail-loud, Q-ETL-9 prefer xlsx_converted).

### 2.2 Phase 2 — profit + purchase_inbound report types

PR #327 quarantined any non-product_sales header as `MISSING_HEADER`. This PR adds first-class support for two more report types under the `REPORT_SPECS` registry pattern:

| Report type | Source filename hint | Canonical cols | Detect threshold |
|---|---|---|---|
| `product_sales` | 商品销量报表 | 19 | 10 of 19 |
| `profit` | 利润表 | 5 | 3 of 5 |
| `purchase_inbound` | 采购入库明细 | 11 | 5 |

**`REPORT_SPECS` registry** is the single source of truth — adding a 4th report type only requires adding an entry there. `detect_report_type` scores all registered types and picks the highest-scoring above its threshold.

**Header alias collapsing**: purchase_inbound has multiple Chinese aliases mapping to the same canonical col (e.g. `供应商` AND `供应商名称` → `supplier_name`; `入库数量` AND `数量` → `inbound_qty`). Detection counts distinct canonical cols, not raw header strings.

**`change_rate` percent-string handling** (profit): real source data may have `"25%"` in `change_rate`. The pilot keeps `change_rate` as a numeric column, so `"25%"` fails to coerce → row quarantines as `NON_NUMERIC_NUMERIC_FIELD` (fail-loud per Q-ETL-6). Operators must strip `%` upstream or pre-convert to decimal. **Future PR can add `%`-stripping if Steve / operator triages this as scope.** Tests cover both clean decimal (`"0.25"`) and dirty percent (`"20%"`) rows.

### 2.3 Phase 3 — Q-DEC-6 F1 return_qty

`fact_pos_item` (silver_facts.sql line 86-100) gets a new nullable column. The canonical CSV already mapped 退货数量 → `qty_refund` in PR #327 (line 71); Sub-ETL-2 loader (separate future PR) is the half that lands `qty_refund → fact_pos_item.return_qty`.

Migration `V20260511_03` is **additive, NULL-safe**. Apply via `apply-smartbi-migrations.sh` runner (auto-triggered by `deploy-smartbi-python.sh` Step 3.5). **DO NOT** apply manually per `.claude/rules/server-operations.md`.

### 2.4 Phase 4 — gitignore policy

`data/imports/` is a NEW top-level directory introduced by Sub-ETL-1. Per PR #330 Q-DEC verbal sign-off, raw Excel + canonical CSV are local-only. Negation pattern (`!data/imports/.../.gitkeep`) requires the parent rule to glob children (`/**`) rather than exclude the directory itself, otherwise git can't re-include files under an excluded dir (git docs: "It is not possible to re-include a file if a parent directory of that file is excluded").

Verified via `git check-ignore`:
- `data/imports/restaurant-chains/foo.csv` → ignored ✓
- `data/imports/restaurant-chains/sub/bar.csv` → ignored ✓
- `data/imports/_quarantine/foo.csv` → ignored ✓
- `data/imports/_index.json` → ignored ✓
- `data/imports/restaurant-chains/.gitkeep` → tracked ✓
- `data/imports/_quarantine/.gitkeep` → tracked ✓

---

## 3. ⛔ DRIFT FLAG — Phase 3 MO vs canonical PR #326 §6 spec

**This is the section requiring organizer attention before push.**

Marching order Phase 3 says:
> Add migration V20260511_03__fact_pos_item_add_return_qty.sql
> (ALTER fact_pos_item ADD return_qty NUMERIC(18,3) DEFAULT NULL)

PR #326 §6 line 522 (canonical spec ratified Q-DEC-6 = F1 via PR #330) says:
> **+1 migration**: `V20260815_04__t6_6_etl_return_qty_columns.sql` —
> ALTER TABLE fact_pos_item ADD COLUMN return_qty NUMERIC(18,3) DEFAULT 0,
> ADD COLUMN return_amount NUMERIC(18,2) DEFAULT 0;

**Three deltas**:

| # | Aspect | Marching order | Canonical PR #326 §6 spec | Pilot impl chose |
|---|---|---|---|---|
| 1 | Migration filename | `V20260511_03` | `V20260815_04` | **MO** (V20260815_04 was a future placeholder per PR #249 dispatch convention; V20260511_03 continues the V20260511_NN series from PR #325) |
| 2 | Columns | `return_qty` only | `return_qty` + `return_amount` | **MO** — narrower scope. `return_amount` deferred. |
| 3 | DEFAULT | `NULL` | `0` | **MO** — `DEFAULT NULL` preserves "unknown" semantics for legacy rows; `DEFAULT 0` would falsely claim "zero observed returns" for pre-ETL data |

**Why pilot followed MO**:
- Filename: V20260511_03 is the correct apply-date convention (V20260511_01/02 were PR #325). V20260815_04 was a forward-looking placeholder.
- Scope narrowing: Phase 3 is pilot scope; adding `return_amount` is straightforward follow-up. No downstream caller depends on `return_amount` yet.
- DEFAULT NULL is defensible — better data semantics for additive migrations on existing tables.

**Pilot adds in migration COMMENT** documenting the divergence so future readers find the discussion trail.

**Organizer decision needed**:
- ✅ Accept MO subset → ship as-is (this audit doc documents the drift).
- ⏭️ Restore spec full scope → follow-up migration `V20260511_04__fact_pos_item_add_return_amount.sql` adds the missing column.
- 🔄 Flip DEFAULT to 0 → modify V20260511_03 before apply.

---

## 4. Test Coverage Delta

```
backend\python\tests\test_normalize_restaurant_chains.py
============================== 51 passed, 1 warning in 0.61s ==============================
```

| Group | PR #327 | This PR | Δ |
|---|---|---|---|
| Format detection | 6 | 6 | 0 |
| Chain catalog | 7 | 7 | 0 |
| Report type / header | 6 | 7 (1 amended + 4 new − 3 collapsed) | +1 (4 added incl. profit_supported, purchase_supported, below-threshold) |
| Numeric coercion | 5 | 5 | 0 |
| Row normalize | 4 | 6 | +2 (profit spec happy + purchase spec required-col) |
| File pipeline | 6 | 8 | +2 (profit_supported, purchase_supported) |
| Purchase alias columns | 0 | 1 | +1 |
| Index + quarantine writers | 3 | 3 | 0 |
| CLI exit codes | 3 | 3 | 0 |
| Q-DEC-6 F1 return_qty | 0 | 3 | +3 (nonzero round-trip, blank preserves NULL, file-level qty_refund) |
| Purchase inbound alias | (incl. above) | — | — |
| **Total** | **40** | **51** | **+11** |

(One PR #327 test — `test_detect_report_type_unsupported_profit_report` — was amended to `test_detect_report_type_profit_supported` since profit is now a first-class type, not UNSUPPORTED. Similarly `test_normalize_file_profit_report_quarantines` was amended to `test_normalize_file_profit_report_supported`.)

---

## 5. KEEP-list verification (per HARD `feedback_organizer_dispatch_must_read_prior_sub_keep_list`)

PR #327 audit doc §4 catalog of behaviors KEPT intact in this PR:

| KEEP item (from PR #327) | Status in this PR |
|---|---|
| 7 closed-enum quarantine reasons | ✓ moved to `_lib/quarantine.py` verbatim |
| `_index.json` deterministic order (sort by chain/report/period) | ✓ unchanged in orchestrator |
| Idempotent byte-identical CSV via `lineterminator="\n"` | ✓ unchanged |
| 19-col PRODUCT_SALES_HEADER_MAP verbatim | ✓ moved to `_lib/column_mapping.py` verbatim |
| 14-chain CHAIN_CATALOG verbatim per Q1 §4.3 | ✓ moved verbatim; `match_chain_for_path` semantics unchanged |
| Banner skip + max_scan=10 header detection | ✓ `find_header_row` unchanged |
| Two-pass row validation (required → numeric coerce) | ✓ generalized to per-report-type via `ReportTypeSpec` parameter |
| `None` → `""` at CSV write time (Rule 1 NULL preserve) | ✓ unchanged |
| Q-ETL-5/6/9 defaults | ✓ unchanged |
| SHA-256 idempotence verify | ✓ unchanged |
| `xlsx_converted/` source-walk exclusion | ✓ unchanged |
| CLI `--no-fail-loud` opt-out | ✓ unchanged |

No KEEP item was regressed.

---

## 6. Behaviors NOT Covered (Gaps + Future Work)

### 6.1 Real-data smoke (NOT run) — same as PR #327 §6.1

Pilot follow-up has NOT been executed against `smartbi维度分析/大众点评/真实餐饮连锁数据/`. Recommended follow-up dispatch:

```bash
python scripts/etl/normalize_restaurant_chains.py \
  --source-root "smartbi维度分析/大众点评/真实餐饮连锁数据" \
  --output-root data/imports/restaurant-chains \
  --quarantine-root data/imports/_quarantine \
  --index-path data/imports/_index.json \
  --no-fail-loud

cat data/imports/_index.json | jq '.files[] | {report_type, canonical_rows, quarantine_events}'
```

Note: now that profit + purchase_inbound are SUPPORTED, real-data smoke will produce canonical CSVs for those report types too. PR #327's smoke wouldn't have — it would've quarantined them as MISSING_HEADER.

### 6.2 `%` stripping in profit `change_rate`

Real source data has values like `"25%"` in change_rate. Currently fails NON_NUMERIC_NUMERIC_FIELD. Two options for follow-up:
- A) Strip `%` in `coerce_numeric` (would affect all reports — too broad).
- B) Add per-spec preprocessor in `ReportTypeSpec` (cleaner; profit-only).
- C) Make `change_rate` a string column (preserve verbatim; defer parse to Sub-ETL-2 loader).

### 6.3 Return-amount column

Per §3 drift discussion: if organizer chooses to restore spec full scope, follow-up adds `fact_pos_item.return_amount` + canonical `refund_amount` Silver mapping. The canonical CSV already carries `refund_amount` (PR #327 line 78) so it's a downstream loader concern, not an ETL change.

### 6.4 Sub-ETL-1c orchestrator vs Sub-ETL-2 loader

This PR completes Sub-ETL-1a (foundation modules) + Sub-ETL-1b partial (quarantine + canonical writer + index) but is still **pilot scope** in terms of Sub-ETL-1c (multi-chain end-to-end orchestrator). Production split per spec §6 row 5 expects ~1.5pd more work to handle all 14 chains × 3 report types end-to-end with full operator runbook. This PR doesn't claim to complete that; it just shifts code into proper module boundaries so future Sub-ETL-1c can build on it.

---

## 7. Cross-references

| Doc | PR / Path |
|---|---|
| ETL infra design spec | PR #316 / `docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md` (§3.1 layout, §6 8-batch breakdown) |
| Q1 real-DB amendment | PR #223 / `docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md` (§3.1 report types, §4.3 14-chain catalog) |
| Restaurant semantics decision | PR #326 / `docs/superpowers/specs/2026-05-12-t6-6-restaurant-semantics-decision.md` (§6 Q-DEC-6 F1 schema; §9 sign-off table) |
| Q-DEC ratification | PR #330 (commit 68465a6fed) — flipped Q-DEC-6 / Q-DEC-8 / gitignore to `[x]` |
| Sub-ETL-1 pilot | PR #327 / `docs/qa-audits/2026-05-12-sub-etl-1-normalizer-pilot.md` (§4-§7 implementation notes; §6 follow-up gaps this PR closes) |
| smartbi migration runner | `.claude/rules/server-operations.md` § "Smartbi 数据库 schema 变更" — runner auto-applies V20260511_03 at deploy |
| python-java-port rules | `.claude/rules/python-java-port.md` — Rule 1 (`is not None` not `or`), Rule 6 (explicit None boundary checks) |
| Concurrent edit safety Rule 5b | `.claude/rules/concurrent-edit-safety.md` — paths-only commit prevents scope creep |
| Sub-ETL-2 (future) | PR #316 §6 row 8 — canonical CSV → fact_pos_item loader incl. `qty_refund → return_qty` mapping |
| Sub-ETL-3 (shipped) | PR #325 — V20260511_01/02 chain catalog + seed migrations (Q-ETL-1/2/3 ratified PR #328) |

---

## 8. Pre-flight HARD-rule verification (organizer claimed pre-cleared)

| HARD rule | Claim | Independent verify |
|---|---|---|
| `organizer_dispatch_must_grep_canonical_HOLD` | "No canonical HOLD blocks for Sub-ETL-1 follow-up ✓" | ✓ `2026-05-11-t6-6-etl-infra-design-spec.md` §9 HOLD blocks reviewed — none gate Sub-ETL-1 follow-up. Sub-A/Sub-B HOLD per MO PR #249 still active but unrelated. |
| `organizer_dispatch_must_read_prior_sub_keep_list` | "PR #316 §10 sign-off [x] (PR #328 verbal ratify) ✓" | ✓ `2026-05-11-t6-6-etl-infra-design-spec.md` §10: Q-ETL-1/2/3 all `[x]` ratified per PR #325 evidence cite. |
| `organizer_dispatch_must_read_prior_sub_keep_list` | "PR #326 §9 Q-DEC-6=F1 / Q-DEC-8=Option A / gitignore ratified (PR #330) ✓" | ✓ `2026-05-12-t6-6-restaurant-semantics-decision.md` §9 (PR #330 ratification commit 68465a6fed): all three `[x]`. **However spec §6 line 522 vs MO drift surfaced — see §3 above.** |
| `narrow_scope_fix_sister_site_sweep` | New report types added to `REPORT_SPECS` registry; all callers route through registry | ✓ `detect_report_type` / `normalize_row` / `write_canonical_csv` all consume `REPORT_SPECS[rtype]` — no sister-site needs separate update. |
| `chat_must_push_before_clear` | "STOP-and-ping organizer BEFORE push" | Will obey — commit local, **NO push**, this audit doc is the ping artifact. |

---

## 9. ⛔ HOLD Status — committed locally, NOT pushed, awaiting organizer review

**Current state**:
- Worktree `.worktrees/sub-etl-1-followup/` on branch `ops-sub-etl-1-followup` from origin/main HEAD `68465a6fed`.
- All 9 files written.
- **Will commit via `git commit -- <paths>` paths-only** (concurrent-edit-safety Rule 5b) — see commit plan below.
- All 51 unit tests pass locally.
- CLI `--help` smoke OK.
- `git check-ignore` verified gitignore patterns work correctly.

**Commit plan** (paths-only, single commit per organizer dispatch):

```bash
# In .worktrees/sub-etl-1-followup/
git status --short  # verify only the 9 expected files in worktree
git commit -m "feat(t6-6-etl): Sub-ETL-1 follow-up — _lib split + profit/purchase + Q-DEC-6 F1 return_qty" \
  -- \
    scripts/etl/_lib/format_detect.py \
    scripts/etl/_lib/column_mapping.py \
    scripts/etl/_lib/quarantine.py \
    scripts/etl/normalize_restaurant_chains.py \
    backend/python/tests/test_normalize_restaurant_chains.py \
    backend/python/smartbi/database/migrations/V20260511_03__fact_pos_item_add_return_qty.sql \
    .gitignore \
    data/imports/restaurant-chains/.gitkeep \
    data/imports/_quarantine/.gitkeep \
    docs/qa-audits/2026-05-12-sub-etl-1-follow-up-modular-return-qty.md
git show --stat HEAD  # post-commit verify: exactly 10 files (above + this doc)
# DO NOT git push yet — STOP and ping organizer
```

**Next steps for organizer**:

1. **Review this audit doc + the 10 committed files**.
2. **Resolve §3 drift** — accept MO subset (ship as-is), restore spec scope (follow-up PR adds `return_amount`), or flip DEFAULT to 0 (modify V20260511_03 before apply).
3. **If approved as-is**: organizer or follow-up chat runs `git push -u origin ops-sub-etl-1-followup` + creates PR.
4. **PR body should include**: predecessors (#316/#327/#326/#330), drift note (this audit §3), test results (51/51), deploy migration auto-apply via Step 3.5.

**Outstanding spec items NOT touched by this PR** (per PR #316 §10):
- [ ] Engineering organizer timing acceptance (no-op — Sub-ETL-1 is pre-MO scope per §6)
- [ ] T6.5 Phase C lead — no scope-creep into T6.5 (verified — only `scripts/etl/`, `backend/python/tests/`, `backend/python/smartbi/database/migrations/V20260511_03*`, `.gitignore`, `data/imports/`, `docs/qa-audits/`)
- [ ] Reviewer audit cycle (per `feedback_subagent_driven_audit_pattern.md`) — recommended on this PR if organizer wants deep review before push

---

**End of follow-up audit. Awaiting organizer decision on §3 drift + push approval.**
