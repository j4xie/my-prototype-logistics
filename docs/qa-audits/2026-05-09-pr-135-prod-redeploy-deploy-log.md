# PR #135 prod redeploy — Rule 4 fix + sister sweeps shipped

**Date**: 2026-05-09 ~06:08 CST (deploy) + ~06:10 CST (smoke verify)
**Trigger**: Chat 1 smoke re-verify per MO `2026-05-09-pr-135-prod-deploy-marching-order.md` Step 5 surfaced Rule 4 violation in F001 finance State A; investigation revealed the fix already existed in main but was never deployed
**Deploy command**: `./scripts/deploy/deploy-smartbi-python.sh --env prod`
**Prod commit before**: `2e90a2016` (PR #135, deployed 2026-05-07 11:36 CST via N=2 cutover)
**Prod commit after**: current `origin/main` (rsync delivered 3 missing commits)
**Outcome**: ✅ All smoke verifications GREEN; Rule 4 violation eliminated; sales-side Pattern B 3-state firing on prod for the first time

---

## §1 Background — discovery sequence

| Time | Event |
|---|---|
| 2026-05-07 11:36 CST | N=2 cutover deploys `2e90a2016` (PR #135). Prod runs Pattern B 3-state finance dispatcher. |
| 2026-05-07 21:32 CST | (Original PR #135 commit timestamp.) |
| 2026-05-07 22:50 CST | PR #137 (`5cc0e1837`) merges — adds **5 `_decimal_to_number(...)` calls** in `_build_finance_overview_from_gold` (Rule 4 fix for State A `rawValue`). **Not deployed.** |
| 2026-05-08 → 05-09 | PR #139 (Rule 12 procurement + Rule 10/11/12 sweep dept/region/procurement) and PR #149 (K-1 sales overview Pattern B 3-state mirror) merge. **Not deployed.** |
| 2026-05-09 ~05:33 CST | Chat 1 smoke under MO Step 5 catches: `F001` finance `rawValue` returned as JSON **string** `"20639884.52"` instead of **number** `20639884.52`. STOP-and-ping per dispatch ⛔ rule. |
| 2026-05-09 ~05:50 CST | Investigation: `git log 2e90a2016..origin/main -- backend/python/` returns 3 commits (PR #137, #139, #149). Server-side file mtime + `grep` confirms prod still on `2e90a2016`. The MO's "Step 3 Python deploy = NO-OP" assumption was incorrect; PR #135 deployed at 11:36 predated PR #137 merge by ~11 hours. |
| 2026-05-09 ~06:08 CST | Organizer GO for redeploy. Deploy executed. |

This is a "stop-pattern catch" — the 11h timing gap between PR #135 deploy and PR #137 merge created a silent prod/main drift that the MO's static "PR #135 deployed = current code" assumption did not capture. Future MOs with similar phrasing should verify prod commit vs `git log` server-side before assuming no-op.

---

## §2 Deploy execution stages

| Step | Result | Notes |
|---|---|---|
| 1/5 Local file check | ✓ | |
| 2/5 Remote dirs created | ✓ | |
| 3/5 rsync `backend/python/` | ✓ | rsync over SSH worked despite `feedback_deploy_pipeline.md` rsync-RST risk (Python deploy is small, ~few MB) |
| 3.5/5 Smartbi migrations runner | ✓ | 35 already applied, 0 new (PR #137/#139/#149 add 0 V*.sql files) |
| 4/5 Install dependencies | ✓ | All `requirements.txt` already satisfied (no new deps) |
| 4.5/5 `systemctl restart cretas-python` | ✓ | New `MainPID=2111052`, ActiveSince `2026-05-09 06:08:07 CST` |
| 5/5 Health check | ⚠️ | **30s wait timed out** — script polled `HTTP=000` 3× (10s/20s/30s); ONNX warmup × 2 sequential workers needs ~60s. Python recovered to 200/active by ~60s post-restart. WARN, non-blocker. |

**Follow-up**: deploy script's 30s health-check wait is too short for N=2 worker mode. Recommend lengthening to 90s (or making it `MAX_WAIT_SEC=$((30 * WORKERS_N))` dynamic). Reasoning: ONNX warmup is per-worker sequential; with N=2, ~60s is observed minimum; 90s gives 30s headroom. Filed as separate deploy-pipeline TODO.

---

## §3 Commits shipped

| Commit | PR | Scope |
|---|---|---|
| `5cc0e1837` | [#137](https://github.com/j4xie/my-prototype-logistics/pull/137) | Pattern B PR-C v2 — **Rule 4 fix for State A `rawValue`** (5 `_decimal_to_number` sites in `_build_finance_overview_from_gold`) + 16 tests + 3-state goldens |
| `dd376eeb4` | [#139](https://github.com/j4xie/my-prototype-logistics/pull/139) | Rule 12 procurement MoM `formattedValue` (banker's rounding fix) + Rule 10/11/12 sweep dept/region/procurement |
| `7e6c35495` | [#149](https://github.com/j4xie/my-prototype-logistics/pull/149) | K-1 sales overview flag gate — Pattern B 3-state dispatcher mirror (sales-side equivalent of PR #135 finance) + 17 new tests |

Total `backend/python/` lines changed in deploy: ~50 net additions across 5+ files.

---

## §4 Smoke verify — before/after

### Rule 4 transition (the headline fix)

| Field | Pre-deploy (`2e90a2016`) | Post-deploy (current main) |
|---|---|---|
| F001 `total_revenue.rawValue` | `"20639884.52"` (**string**) | `20639884.52` (**number**, float) |
| F001 `bill_count.rawValue` | `"140541"` (**string**) | `140541` (**number**, int) |
| F001 `avg_bill_value.rawValue` | `"146.86"` (**string**) | `146.86` (**number**, float) |
| F001 `store_count.rawValue` | `"8"` (**string**) | `8` (**number**, int) |

`jq '.kpiCards[].rawValue | type'` confirms all 4 cards now return `"number"`. Pre-deploy was `"string"`. Phase 2A dict-eq gate now passes for State A `rawValue` parity with Java BigDecimal serialization.

### State B preserved

F999 finance: `kpiCards_len=0 charts_keys=[]` ✓ — empty stub still works (no regression on empty path).

### Sales 3-state freshly live on prod (PR #149)

F001 sales: returns 4-KPI overview shape (`total_revenue / bill_count / avg_bill_value / store_count`) plus `customerRanking / dateRange / generatedAt / productRanking / salespersonRanking / trendChart`. Pre-deploy, Python sales endpoint had no flag gate — sales-side was reading Gold unconditionally without the State A/B/C dispatcher. Post-deploy, sales mirrors finance Pattern B exactly.

### Worker count

Post-deploy `ps --no-headers --ppid <MainPID>`: 3 children = 2 `pt_main_thread` workers + 1 `python` helper. `ss -tlnp :8083` lists 2 worker PIDs as listeners — N=2 healthy. (See §7 follow-up about grep amendment iteration.)

### Raw response evidence preserved

- Pre-deploy: `47:/tmp/pr-135-smoke-1778276000/` (16 files)
- Post-deploy: `47:/tmp/pr-135-postdeploy-1778278233/` (3 files: F001-finance, F999-finance, F001-sales)

---

## §5 PR #135 dispatcher selectivity (organizer Playwright finding, baked here for clarity)

PR #135 patches the **finance overview composite path** only — not the analysisType sub-paths. Verified by organizer Playwright MCP probe on F001 (post-deploy):

| `analysisType` query param | Path | Result |
|---|---|---|
| (omitted) / overview / cashflow | `_get_comprehensive_finance_analysis` → `_get_finance_overview` (Pattern B 3-state) | F001 returns State A: `kpiCards=4`, `rawValue=number` ✓ |
| `cashflow` | (composite path) | Same as above ✓ |
| `profit` | `_get_profit_analysis` (sub-endpoint) | State B-shape: `kpiCards=0`. Sub-endpoint's own logic returns the empty/partial shape; **not patched** by PR #135. |
| `cost` | `_get_cost_analysis` (sub-endpoint) | Same as profit — `kpiCards=0`, sub-endpoint not patched by PR #135. |

**This is design intent of PR #135**, not a bug. PR #135 scope was the composite path's `_get_finance_overview` only. Sub-endpoints (profit/cost/budget/receivable/payable per-type) have their own separate Phase 2A specs (PRs #18 / #21 / #22 / #25 / #38 / #42) and follow their own rules.

T6.4 cutover for the 14 customer factories will route **all** analysisType variants through Python. The empty State B shape from sub-endpoints (profit/cost) will be the post-cutover behavior for customers — same as Java legacy when its Gold table is empty. No regression vs current Java behavior.

---

## §6 Issue #1 status (Java Gold cross-factory leak — NOT a code bug)

Per PR [#170](https://github.com/j4xie/my-prototype-logistics/pull/170) (`8dd48e5c7`), the Issue #1 finding (RES_3101_009 returning F001's identical revenue numbers via Java 10010) is **NOT a code bug** — it's a deliberate Apr 23 data seed where multiple factories were intentionally populated with the same Gold POS sample data for Phase B Dashboard UI testing.

Implication for this redeploy: **no Java side action needed**. Java side untouched by this Python deploy. T6.4 cutover routing RES_3101_009 to Python will return State B empty stub (Python's Gold has no data for RES_3101_009) — that's the correct customer-facing behavior. The Apr 23 seed data is only visible through Java's path.

---

## §7 Follow-up TODOs (non-blocking, filed for tracking)

1. **Deploy script wait time**: `deploy-smartbi-python.sh` health-check 30s timeout → recommend 90s (or `MAX_WAIT_SEC=$((30 * WORKERS_N))` dynamic per N=2 worker mode).
2. **Worker-count grep amendment iteration 2**: PR #164 amendment changed grep to `ps --no-headers --ppid $PID | wc -l`, expects 2. Real prod returns 3 (2 `pt_main_thread` + 1 `python` helper). Need pattern-match `pt_main_thread` specifically, OR `wc -l` minus 1, OR grep on `ss -tlnp :8083` listener entries.
3. **smartbi_migrations psql heredoc auth gap**: Step 1 pre-flight `set -a; source .env.prod; set +a` followed by `PGPASSWORD="$SMARTBI_DB_PASSWORD" psql -U cretas_user` returns "password authentication failed" inside SSH heredoc. Quoting / variable expansion gap with the heredoc; works in interactive shell. Migration runner uses different auth path — non-blocker for deploy, just for ad-hoc tracker checks.
4. **MO no-op assumption discipline**: future MOs claiming "Step X is no-op because Y was already deployed" should verify prod commit vs main with `ssh ... git log -1 --oneline` before phrasing as no-op. The Apr 23 → May 7 → May 9 timing gaps in this project surface this pattern; static assumptions decay over hours/days.

---

## §8 Cross-references

- MO: `docs/superpowers/dispatch/2026-05-09-pr-135-prod-deploy-marching-order.md` (amended via PR #164 for worker grep + Amendment History typo)
- PR [#135](https://github.com/j4xie/my-prototype-logistics/pull/135) (`2e90a2016`) — Pattern B PR-B v2 impl
- PR [#137](https://github.com/j4xie/my-prototype-logistics/pull/137) (`5cc0e1837`) — Pattern B PR-C v2 (Rule 4 fix for State A `rawValue` shipped here)
- PR [#139](https://github.com/j4xie/my-prototype-logistics/pull/139) (`dd376eeb4`) — Rule 10/11/12 sweep dept/region/procurement
- PR [#149](https://github.com/j4xie/my-prototype-logistics/pull/149) (`7e6c35495`) — K-1 sales overview Pattern B 3-state mirror
- PR [#157](https://github.com/j4xie/my-prototype-logistics/pull/157) (`45a71487b`) — flag-flip investigation establishing Apr 23 Phase B baseline
- PR [#164](https://github.com/j4xie/my-prototype-logistics/pull/164) — MO worker-grep + Amendment History typo amendment
- PR [#170](https://github.com/j4xie/my-prototype-logistics/pull/170) (`8dd48e5c7`) — Issue #1 (Java Gold cross-factory) RCA: deliberate Apr 23 data seed, not a code bug
- Memory `project_2026_05_07_uvicorn_n2_path_x_lite.md` — N=2 leader-gate prod state context
- Memory `feedback_deploy_pipeline.md` — deploy script v4.2 channels + double-env defensive ping
- Hard rule `.claude/rules/python-java-port.md` Rule 4 — `_decimal_to_number` for BigDecimal-as-number serialization
- Server file: `backend/python/smartbi_compat/api/analysis_finance.py:1746-1832` (`_build_finance_overview_from_gold`)

---

## §9 Memory update reference (organizer to handle)

This deploy resolves the Rule 4 violation discovered during Chat 1 smoke. Suggested memory update keywords for organizer:
- `project_2026_05_07_t6_1_dryrun_in_flight.md` — note PR #137 deploy timing gap closed 2026-05-09
- `feedback_deploy_pipeline.md` — note 30s ONNX warmup wait insufficient for N=2 mode (follow-up #1)
- New entry candidate: "Stop-pattern catch — MO no-op assumption discipline" referencing this deploy log

Chat 1 does not write directly to organizer memory; organizer to update at their discretion.
