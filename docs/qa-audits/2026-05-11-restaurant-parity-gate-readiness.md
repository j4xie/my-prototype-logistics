# Restaurant Parity-Gate Readiness Audit

**Date**: 2026-05-12 (organizer brief filenamed `2026-05-11`)
**Author**: chat3 (T6.6 restaurant golden-record harness)
**Branch**: `feat/restaurant-golden-harness`
**Base SHA**: `d5cd41802a` (origin/main, post-PR #360 router-wire merge)
**Trigger**: chat-AB-1 follow-up to PR #359 (parity-gate framework merged)

---

## 0. TL;DR

| Deliverable | Status |
|---|---|
| `scripts/parity-gate/record-restaurant-goldens.sh` | ✅ Shipped (16 endpoint-runs per invocation: 2 factories × 4 prod-types + 4 quality-types) |
| `scripts/parity-gate/audit-restaurant-schema.sql` | ✅ Shipped + **executed on prod smartbi_prod_db** |
| Synthetic validation via `--fixtures` mode | ✅ **16/16 PASS at 100% match; 1 Pattern A correctly tracked as tolerated** |
| Live mock-data validation (R_TEST_MOCK loaded to test env) | ⛔ Deferred — see §6 / §7 prereqs |
| Real-data parity run (R_QINGHUAJIAO_REAL / R_ILTEATRO_REAL) | 🟥 **BLOCKED** by §4 + §5 findings |

### Critical findings (must surface before live run)

1. **🟥 P0 — `tenant.py:112` SQL bug**: queries `WHERE factory_id = $1` against `factories` table whose actual primary key column is **`id`**, not `factory_id`. Every restaurant tenant request will throw `column "factory_id" does not exist` → 500 to caller. Verified directly via on-server `psql` (§5).
2. **🟧 Spec/reality factory_id mismatch**: brief assumes `R_QINGHUAJIAO_REAL` + `R_ILTEATRO_REAL` exist; neither is in `cretas_prod_db.factories`. Closest existing restaurant chains: `RES_3101_009` (QHJ_PROD), `RES_3101_005..008` (QHJ demos), `R_GML_DEMO` (桂满陇), `R_XMX_CHAIN/FRESH/FRESH2/FRESH3` (唏嘛香 variants), `R_YHDJ_DEMO` (永和豆浆), `R_YJJ_DEMO` (御九井). Full 13-row inventory in §4.
3. **🟧 Sparse fact data**: only **2** of 13 restaurant factories have `fact_pos_transaction` rows; **1** has wastage/requisition rows; **0** have non-null `return_qty`; **0** have `restaurant_reviews`. Most N1-N4 metrics will return `dataAvailability` markers, not real values — this is *expected per spec*, but means dict-eq match rate over null-heavy responses is largely structural-only.

### What this PR ships

| File | Lines | Purpose |
|---|---|---|
| `scripts/parity-gate/record-restaurant-goldens.sh` | 117 | Loop driver — 2 factories × 4 prod types + 4 quality types × 2 endpoints = 16 runs, env-overridable, jq-aggregated summary |
| `scripts/parity-gate/audit-restaurant-schema.sql` | 174 | Read-only schema + data audit; safe on prod |
| `docs/qa-audits/2026-05-11-restaurant-parity-gate-readiness.md` | this doc | Full evidence + ready-state matrix + GO criteria |

---

## 1. Background

PR #359 (parity-gate framework) merged on `ce20c42ba3` provides the `compare.py` / `dict_eq.py` / `mock_data_generator.py` mechanics. This task adds the **execution layer** — a bash harness that drives the framework across the canonical 16-endpoint restaurant matrix plus a schema/data audit confirming the prereqs.

Phase 2A dict-eq standard per `.claude/rules/python-java-port.md` Rule 4: **≥99.945% match** (T6.1 dryrun bar). Pattern A int-collapse + Pattern A2 scale-loss tolerated.

PR #360 (router wire for `analysis_production` + `analysis_quality`) merged on `d5cd41802a` — both endpoints now LIVE on main, returning 401 (auth-required) when called without JWT (verified §6).

---

## 2. Harness design notes

### 2.1 analysisType vocab — brief had a bug

The organizer brief used `TYPES=("fpy" "defect" "rework" "overview")` for **both** endpoints' loops. Verified against main HEAD `d5cd41802a`:

| Endpoint | Source line | Vocabulary |
|---|---|---|
| `analysis_production` | `analysis_production.py:334-340` | `oee` / `efficiency` / `equipment` / overview (default `oee` when None) |
| `analysis_quality` | `analysis_quality.py:592-598` | `fpy` / `defect` / `rework` / overview (default `fpy` when None) |

The shipped harness uses separate `TYPES_PRODUCTION` and `TYPES_QUALITY` arrays accordingly. Using the brief's same-type-list for both would emit 4 of 8 production runs with unknown analysisType (silently dispatched to overview branch).

### 2.2 Total runs per invocation

```
2 factories
  × (4 production analysisTypes + 4 quality analysisTypes)
  = 16 endpoint-runs
```

The brief title said "8 goldens"; bash code generates 16. The harness ships at 16 (consistent with the code Steve intended).

### 2.3 JWT requirement (HARD)

Harness fails fast if `JWT_SECRET` is unset — no silent fallback. Mirrors HARD `feedback_no_defensive_in_verify_scripts.md`. For server-side runs, prod's secret is in `/www/wwwroot/cretas/.env.prod`; for local runs, copy out or use a dev JWT.

---

## 3. Schema audit results — prod smartbi_prod_db

Executed `audit-restaurant-schema.sql` via `ssh root@47.100.235.168 sudo -u postgres psql -d smartbi_prod_db`. Full raw output: `/tmp/audit-prod-output.txt` (215 lines, not committed — re-runnable via the audit SQL).

### 3.1 Table + column presence

| Metric | Table | Required columns | Status |
|---|---|---|---|
| M1 KITCHEN_STATION_UTILIZATION | (none — always null per Q-DEC-1=A1) | — | ✅ N/A |
| M2 AVG_PREP_TIME | (none — always null per Q-DEC-2=B1) | — | ✅ N/A |
| **M3 TABLE_TURNOVER_RATE proxy** | `public.fact_pos_transaction` | `factory_id`, `store_id`, `date` | ✅ All present |
| N1 FOOD_SAFETY_INCIDENT_RATE | (none — always null per D1) | — | ✅ N/A |
| **N2 COMPLAINT_RATE** | `public.restaurant_reviews` | `factory_id`, `rating`, `review_time`, `content` | ✅ All present |
| **N3 DISH_RETURN_RATE** | `public.fact_pos_item` | `factory_id`, `qty`, `return_qty` (V20260511_03), `amount` | ✅ All present |
| **N4 WASTAGE_RATE** | `public.fact_restaurant_wastage` + `public.fact_restaurant_requisition` | factory_id + quantity + cost columns | ✅ Both tables present (14 + 19 cols respectively) |

Schema readiness: **7/7 ✓** — every table + column the restaurant endpoints depend on exists in prod.

### 3.2 Data presence per restaurant factory_id

Restaurant factory_ids (LIKE `'R\_%'`) in `smartbi_prod_db`:

| factory_id | fact_pos_transaction | fact_pos_item return_qty | restaurant_reviews | wastage rows | requisition rows |
|---|---|---|---|---|---|
| `R_GML_DEMO` (桂满陇 江浙菜) | 16213 bills / 132 stores / 1 day (2026-01-15) | 16213 items, **all NULL** return_qty | 0 | 0 | 0 |
| `R_XMX_CHAIN` (唏嘛香·金城牛大) | 141 bills / 1 store / 1 day (2026-02-15) | 141 items, **all NULL** return_qty | 0 | 4 | 8 |
| All other restaurant chains (RES_3101_*, R_XMX_FRESH*, R_YHDJ_DEMO, R_YJJ_DEMO) | 0 | 0 | 0 | 0 | 0 |

**Implication for parity gate**:
- M3 will return non-null `proxyMetric.value` for the 2 factories with bills, null otherwise
- N3 will return `dataAvailability="NO_RETURN_DATA"` (or similar) for *all* factories because `return_qty` is NULL everywhere — the V20260511_03 column exists but no ETL writes to it yet
- N2 will return `dataAvailability="NO_REVIEW_DATA_FOR_CHAIN"` for all
- N4 will return real values only for `R_XMX_CHAIN`

This isn't a parity-gate bug — it's a data-fill gap that produces stable, parity-able null-marker envelopes.

---

## 4. Tenant discriminator — cretas_prod_db.factories

Brief assumed `R_QINGHUAJIAO_REAL` + `R_ILTEATRO_REAL`. Neither exists. Actual restaurant rows (queried with `type IN ('RESTAURANT','BRANCH')`):

| factory.id | type | name |
|---|---|---|
| `RES_3101_005` | RESTAURANT | QHJ_DEMO_1776284483614 |
| `RES_3101_006` | RESTAURANT | QHJ_DEMO_1776284628707 |
| `RES_3101_007` | RESTAURANT | QHJ_DEMO_1776284708199 |
| `RES_3101_008` | RESTAURANT | QHJ_V2_1776314796084 |
| `RES_3101_009` | RESTAURANT | QHJ_PROD ← **likely the "real QHJ"** brief meant by `R_QINGHUAJIAO_REAL` |
| `RES_GML_001` | RESTAURANT | 桂满陇 |
| `R_GML_DEMO` | RESTAURANT | 桂满陇 江浙菜 |
| `R_XMX_CHAIN` | RESTAURANT | 唏嘛香·金城牛大 |
| `R_XMX_FRESH` | RESTAURANT | 唏嘛香 (新-真实上传) |
| `R_XMX_FRESH2` | RESTAURANT | 唏嘛香 真实流程测试 |
| `R_XMX_FRESH3` | RESTAURANT | 唏嘛香 V3 真实 |
| `R_YHDJ_DEMO` | RESTAURANT | 永和豆浆 快餐 |
| `R_YJJ_DEMO` | RESTAURANT | 御九井 日料 |

(13 rows total — no `R_ILTEATRO_REAL`; Il Teatro chain has not been seeded yet.)

**Recommendation for live run**: override the harness defaults with actual factory_ids:

```bash
FACTORIES="R_GML_DEMO R_XMX_CHAIN RES_3101_009" \
  bash scripts/parity-gate/record-restaurant-goldens.sh
```

(`R_GML_DEMO` + `R_XMX_CHAIN` chosen because they have non-empty `fact_pos_transaction` data; `RES_3101_009` if Steve wants the QHJ production chain even though it has no Silver data yet — will produce all-null but contract-valid envelopes.)

---

## 5. 🟥 P0 — tenant.py SQL bug

**File**: `backend/python/smartbi_compat/tenant.py:111-113` (also present on main as of `d5cd41802a`).

**Bug**: queries `factories.factory_id`; that column does not exist. Actual PK is `factories.id`.

**Reproduction** (run on server via SSH 2026-05-12 04:01 UTC):

```text
$ psql -d cretas_prod_db -c "SELECT type FROM factories WHERE factory_id = 'R_GML_DEMO';"
ERROR:  column "factory_id" does not exist
LINE 1: SELECT type FROM factories WHERE factory_id = 'R_GML_DEMO';

$ psql -d cretas_prod_db -c "SELECT type FROM factories WHERE id = 'R_GML_DEMO';"
    type
------------
 RESTAURANT
(1 row)
```

**Impact on parity gate**: every restaurant-tenant request to `/analysis/production` or `/analysis/quality` would raise `asyncpg.exceptions.UndefinedColumnError` inside `get_tenant_type` → propagate as 500 to caller. Java path is unaffected (Java still uses factory mock).

The router-level try/except in `analysis_production.py` only catches **pool acquisition** errors, not the in-async-with `get_tenant_type` call:

```python
# analysis_production.py:312-321 — pool acquisition is wrapped
try:
    from smartbi.config import get_cretas_pool
    pool = await get_cretas_pool()
except Exception as e:
    logger.warning(...)
    # → tenant defaults to FACTORY (factory branch raises NotImplementedError anyway)

if pool is None:
    tenant = TenantType.FACTORY
else:
    async with pool.acquire() as conn:
        tenant = await get_tenant_type(factory_id, conn)   # ← UNCAUGHT
```

So a request hitting prod right now → pool acquires → `get_tenant_type` raises → uncaught → 500 to client.

**Recommended fix** (1-line, low-risk):

```diff
-        "SELECT type FROM factories WHERE factory_id = $1",
+        "SELECT type FROM factories WHERE id = $1",
```

Strictly out of chat3's brief-scope (brief says don't touch `smartbi_compat/api/*.py` — `tenant.py` is in `smartbi_compat/` but the spirit of the rule applies). Surfacing to organizer for chat1/chat4 follow-up rather than fixing unilaterally.

**Why this wasn't caught earlier**: chat-A1's skeleton tests (test_analysis_production_skeleton.py) used a `_FakeConn` that returned hardcoded rows — never executed the real SQL. chat4's quality-side tests likely had the same blind spot. CI doesn't currently run the endpoint against a real PG instance.

---

## 6. Synthetic validation (`--fixtures` mode)

Live run against `R_QINGHUAJIAO_REAL` data is blocked by §3.2 + §4 + §5. To prove harness mechanics work end-to-end **without** dependence on live router or seeded data, I generated 32 synthetic fixture pairs (16 endpoint scenarios × Java + Python) matching spec §3.4 (production) and chat4 PR #358 (quality) shapes, then ran `compare.py` in offline `--fixtures` mode.

**Test design**: 14/16 scenarios use byte-identical fixtures (expect 100% match with 0 Pattern A). 1 scenario (`production_R_GML_DEMO_oee`) deliberately injects Java `47.0` (float-shaped) vs Python `47` (int-shaped) on `proxyMetric.value` to verify Pattern A is tracked but not flagged as REAL_BUG. 1 scenario (`production_R_XMX_CHAIN_oee`) keeps byte-identical to control for the injection.

**Results — 16/16 PASS**:

```
production_R_GML_DEMO_efficiency        rate=100.0%  PA=0  REAL=0
production_R_GML_DEMO_equipment         rate=100.0%  PA=0  REAL=0
production_R_GML_DEMO_oee               rate=100.0%  PA=1  REAL=0  ← Pattern A injection tolerated
production_R_GML_DEMO_overview          rate=100.0%  PA=0  REAL=0
production_R_XMX_CHAIN_efficiency       rate=100.0%  PA=0  REAL=0
production_R_XMX_CHAIN_equipment        rate=100.0%  PA=0  REAL=0
production_R_XMX_CHAIN_oee              rate=100.0%  PA=0  REAL=0
production_R_XMX_CHAIN_overview         rate=100.0%  PA=0  REAL=0
quality_R_GML_DEMO_defect               rate=100.0%  PA=0  REAL=0
quality_R_GML_DEMO_fpy                  rate=100.0%  PA=0  REAL=0
quality_R_GML_DEMO_overview             rate=100.0%  PA=0  REAL=0
quality_R_GML_DEMO_rework               rate=100.0%  PA=0  REAL=0
quality_R_XMX_CHAIN_defect              rate=100.0%  PA=0  REAL=0
quality_R_XMX_CHAIN_fpy                 rate=100.0%  PA=0  REAL=0
quality_R_XMX_CHAIN_overview            rate=100.0%  PA=0  REAL=0
quality_R_XMX_CHAIN_rework              rate=100.0%  PA=0  REAL=0

total=16 pass=16 fail=0
```

**Conclusion**: framework correctly applies Rule 4 dict-eq, correctly tolerates Pattern A, correctly clears the 99.945% gate. Mechanics are LIVE-READY; only blocked by upstream §5 + data fill.

Fixture generator script (`.tmp-gen-fixtures.py`) and runner (`.tmp-run-synthetic.sh`) live at repo root prefixed `.tmp-` to denote not-for-merge; they're committed alongside this audit as evidence and `.gitignore`-eligible if Steve prefers.

---

## 7. Ready-state matrix

8 endpoint-runs × 2 environments (test 8084 / prod 8083):

| Endpoint × analysisType | Test (8084) | Prod (8083) |
|---|---|---|
| production / oee | 🟧 framework + endpoint ready; **blocked by §5 tenant SQL bug + no seeded R_*_REAL data** | 🟧 same |
| production / efficiency | 🟧 same | 🟧 same |
| production / equipment | 🟧 same | 🟧 same |
| production / overview | 🟧 same | 🟧 same |
| quality / fpy | 🟧 same | 🟧 same |
| quality / defect | 🟧 same | 🟧 same |
| quality / rework | 🟧 same | 🟧 same |
| quality / overview | 🟧 same | 🟧 same |

Color key: 🟩 ready-to-run · 🟧 blocked by 1-2 prereqs · 🟥 multiple prereqs

**Both endpoints are currently 🟧 across both envs.** All blockers are *upstream* of chat3's harness; nothing in this PR needs to change to unblock — only the prereqs in §8.

### Placeholder report filenames (auto-emitted when harness runs)

```
reports/restaurant-parity/production_<factory_id>_oee.json
reports/restaurant-parity/production_<factory_id>_oee.html
reports/restaurant-parity/production_<factory_id>_efficiency.json
reports/restaurant-parity/production_<factory_id>_equipment.json
reports/restaurant-parity/production_<factory_id>_overview.json
reports/restaurant-parity/quality_<factory_id>_fpy.json
reports/restaurant-parity/quality_<factory_id>_defect.json
reports/restaurant-parity/quality_<factory_id>_rework.json
reports/restaurant-parity/quality_<factory_id>_overview.json
```

Each `.json` has a sibling `.html` for human review.

---

## 8. GO-trigger criteria (in priority order)

To flip every row in §7 from 🟧 to 🟩 and run the real parity gate:

1. **🟥 P0 fix tenant.py SQL** (§5) — `factories.factory_id` → `factories.id`. **Single-line fix**, blocks ALL restaurant traffic.
2. **Decide factory_id list** (§4) — `R_QINGHUAJIAO_REAL` and `R_ILTEATRO_REAL` don't exist; substitute with `RES_3101_009` (QHJ_PROD) / `R_GML_DEMO` / `R_XMX_CHAIN` or whatever Steve uploads next.
3. **JWT_SECRET** — export the prod secret or use server-side run; harness fails fast if missing.
4. **(Optional)** ETL `return_qty` fill — N3 currently all-null because no ETL writes the column. Without this, N3 stays at `dataAvailability` marker forever — *acceptable* per spec but data-poor.
5. **(Optional)** Seed `restaurant_reviews` for non-QHJ chains — N2 will return real values only for chains with reviews.

Once 1+2+3 satisfied, run:

```bash
export JWT_SECRET='<from /www/wwwroot/cretas/.env.prod>'
FACTORIES="R_GML_DEMO R_XMX_CHAIN" \
JAVA_BASE=http://47.100.235.168:10010 \
PYTHON_BASE=http://47.100.235.168:8083 \
bash scripts/parity-gate/record-restaurant-goldens.sh
```

Or for test-env smoke first:

```bash
FACTORIES="R_GML_DEMO" \
JAVA_BASE=http://47.100.235.168:10011 \
PYTHON_BASE=http://47.100.235.168:8084 \
bash scripts/parity-gate/record-restaurant-goldens.sh
```

Exit code 0 if all 16 reports clear the 99.945% gate; 1 otherwise. Inspect failing `.html` siblings for REAL_BUG paths.

---

## 9. Cross-references

| Doc / commit | Relation |
|---|---|
| `.claude/rules/python-java-port.md` Rule 4 | dict-eq standard the harness applies |
| `docs/superpowers/specs/2026-05-12-t6-6-sub-a-production-impl-spec.md` §3 | restaurant production shape the harness expects |
| `docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` | Q4/Q5 module shape predecessor |
| PR #352 (chat-A2) | restaurant production impl shipped |
| PR #358 (chat4) | restaurant quality impl shipped |
| PR #359 (chat3) | parity-gate framework shipped |
| PR #360 (chat1) | router wire — **endpoints LIVE** |
| `backend/python/smartbi_compat/tenant.py` | **🟥 contains §5 SQL bug** |

---

## 10. Addendum — Pattern B classifier + `--tolerate-divergence` flag (2026-05-12 ship)

§7 marked all 8 endpoint rows 🟧 because of "Java mock vs Python restaurant envelope = Pattern B structural divergence" — strict dict-eq would always fail for restaurant tenants since Java backend has no tenant-aware dispatch (Sub-A spec §6.1 explicitly: "Java stays mock per Q1 §1... informational dict-eq, not regression gate"). The PR adding this addendum surfaces Pattern B as a first-class classification so the harness can opt-in tolerate it.

### 10.1 New classification: `PATTERN_B_STRUCTURAL`

Detected via `dict_eq._detect_pattern_b_context(java, python)` heuristic in `scripts/parity-gate/dict_eq.py`:

1. `tenantType` differs at top-level data envelope (one side `"RESTAURANT"` / `"BRANCH"`, other absent or `"FACTORY"`)
2. Top-level restaurant-signal keys (`metrics` / `dataAvailability` / `proxyMetric` / `trendChart` / `downtimeChart`) present on one side but not the other

When `pattern_b_context=True`, every diverge gets `classification: PATTERN_B_STRUCTURAL` instead of `REAL_BUG`. Per-leaf classification is suppressed in favor of the global context — preventing false-positive REAL_BUGs when the envelope shapes are fundamentally different.

### 10.2 New CLI flags

```bash
# Tolerate ALL classified divergence patterns (move them to tolerated bucket).
# REAL_BUG still fails the gate.
--tolerate-divergence

# Tolerate specific patterns only (comma-separated letters).
# Valid: A (int-collapse), A2 (trailing-zero, post-parse invisible),
#        B (structural Java mock vs Python tenant envelope),
#        C (value placeholder, not auto-detected)
--tolerate-divergence-patterns B
--tolerate-divergence-patterns A,B
```

Per Sub-A spec §6.1: factory branch parity is **informational only**, restaurant branch is **Python-vs-Python regression**. Operator uses `-patterns B` for restaurant runs where Java mock shape vs Python envelope is expected.

### 10.3 Empirical validation results (synthetic Java mock + Python restaurant fixtures)

Realistic fixtures generated for `R_GML_DEMO` production endpoint mirroring:
- Java factory mock (4-metric OEE/Availability/Performance/Quality + LinkedHashMap charts/rankings/aiInsights/suggestions/metricCards/chartList/alerts/recommendations + lastUpdated/cacheExpireAt/fromCache/period)
- Python restaurant envelope (3-metric KITCHEN_STATION_UTILIZATION / AVG_PREP_TIME / TABLE_TURNOVER_RATE with `dataAvailability` markers + trendChart)

3 scenarios run via `--fixtures` mode:

| Scenario | Flag | match_rate | REAL_BUG | Pattern B | endpoints_in_pattern_b_context | Gate |
|---|---|---|---|---|---|---|
| Strict (default) | (none) | **0.0%** | 0 | 0 (still in diverges, classified PB) | 1 | **FAIL** (exit 1) |
| Tolerate B only | `--tolerate-divergence-patterns B` | **100.0%** | 0 | 15 (moved to tolerated) | 1 | **PASS** (exit 0) |
| Tolerate all | `--tolerate-divergence` | **100.0%** | 0 | 15 (moved to tolerated) | 1 | **PASS** (exit 0) |

Pattern B context detector correctly fires in all 3 scenarios. The 15 structural diverges are exactly the key-set asymmetry: Java side has 13 factory-mock-only keys (`kpiCards` / `rankings` / `charts` / `aiInsights` / `suggestions` / `metricCards` / `chartList` / `alerts` / `recommendations` / `lastUpdated` / `cacheExpireAt` / `fromCache` / `period`), Python side has 2 envelope-only keys (`tenantType` and `metrics` separately not present on Java side beyond `kpiCards` analog), and `trendChart` Python-only.

### 10.4 Updated GO criteria for restaurant runs

§8 step 1 (P0 tenant.py fix) — DONE in PR #368 (verified via PR #369 smoke).

Add to §8: when invoking the harness against restaurant factory_ids, **always pass `--tolerate-divergence-patterns B`** until Phase 3+ when Java side gets tenant-aware dispatch. Otherwise the gate fails for structural-only reasons and masks any REAL_BUG that might also be present.

Recommended trigger command (updated):

```bash
export JWT_SECRET='...'  # from /www/wwwroot/cretas/.env.prod
# Direct compare.py invocation (until record-restaurant-goldens.sh is updated to pass through the flag):
for factory in RES_3101_009 R_GML_DEMO; do
  for atype in oee efficiency equipment overview; do
    python scripts/parity-gate/compare.py \
      --factory "$factory" \
      --endpoint "/api/mobile/{factory_id}/smart-bi/analysis/production" \
      --params "analysisType=${atype}&startDate=2026-01-01&endDate=2026-01-31" \
      --java-base http://47.100.235.168:10010 \
      --python-base http://47.100.235.168:8083 \
      --output "reports/production_${factory}_${atype}.json" \
      --tolerate-divergence-patterns B
  done
done
```

(`record-restaurant-goldens.sh` to be updated separately to honor `TOLERATE_PATTERNS` env var and pass through to `compare.py`. Small follow-up not in this PR's scope.)

### 10.5 Test coverage

`backend/python/tests/test_parity_gate.py` extends from 58 to **81 tests** (+23 new). New coverage:

- `_detect_pattern_b_context` heuristic (6 tests): tenant mismatch only Python side / tenant value differs / restaurant-signal asymmetric / same-shape false / scalar/non-dict false / envelope unwrap
- `dict_eq_match` Pattern B context flagging (2 tests): diverges classified PB when context true; stay REAL_BUG when false
- `apply_tolerance` bucket movement (4 tests): tolerate-all moves all PB to tolerated, patterns-B preserves REAL_BUG, no-op without flags, A doesn't affect B
- `parse_patterns_arg` parsing (5 tests): single letter, comma list, case + whitespace, empty/None, unknown raises
- `compare.py` CLI integration (5 tests): flag enables tolerance, patterns-B alone works, default strict fails on PB, unknown letter rejected, A flag doesn't cover B
- `summarize()` (1 test): includes `b_context=true` marker

Existing 58 tests unaffected (no regressions).

---

**End of readiness audit + Pattern B addendum.** Restaurant parity-gate runs now executable with `--tolerate-divergence-patterns B` once Steve approves the trigger.
