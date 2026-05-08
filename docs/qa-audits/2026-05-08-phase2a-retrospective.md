# Phase 2A Retrospective — Java→Python SmartBI Byte-Shape Parity Port

**Window**: 2026-04-30 → 2026-05-08 (Phase 2A active development through T6.4 readiness)
**Scope**: 50 SmartBI analysis endpoints ported from Java (`backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/...`) to Python (`backend/python/smartbi_compat/api/...`) with byte-shape parity gate.
**Status**: T6.4 readiness 3/3 gates closed; cutover staged May 10-14 CST (Strategy B 5-stage stagger via PR [#144](https://github.com/j4xie/my-prototype-logistics/pull/144)). Phase 2A code work is **complete**; outstanding items are operational (deploy + soak + cutover execution).
**Author**: organizer chat
**Date**: 2026-05-08

This is a forward-looking retrospective — written *during* T6.4 readiness window so the lessons are still hot and the citations to PRs / commits / memories are verifiable. T6.5 (Java SmartBI deprecation) and Phase 3+ (strict-byte gate consideration) reference this doc as the Phase 2A milestone artifact per PR #144 §5 cross-reference.

---

## §1. Executive summary

| Dimension | Outcome |
|---|---|
| Endpoints ported | 50 SmartBI analysis endpoints (per `backend/python/smartbi_compat/api/analysis_*.py`) |
| Total PRs merged Apr 30 → May 8 | **135** (PRs #13 → #148, verified via `gh pr list --search "merged:>=2026-04-30 merged:<=2026-05-08"`) |
| Peak day | 2026-05-07 with **34 PRs** merged (T6 cutover preparation surge) |
| Today (2026-05-08) | **18 PRs** merged (#133 - #150, T6.4 readiness gates + PR #135 chain closure + K-1 sales fix + T6.5 spec) |
| Rules graduated | **12** in `.claude/rules/python-java-port.md` (Rule 1 - Rule 12, all confirmed via `grep -c '^## ⛔ Rule' .claude/rules/python-java-port.md`) |
| Final parity match rate | **99.945%** (T6.1 dryrun, 21,724 / 21,736 samples per `project_2026_05_07_t6_1_dryrun_in_flight.md`) |
| T6.1 dryrun outcome | GO with caveat — 99.945% > 99% gate, all 12 diverges explained (11 Pattern A int-collapse + 1 Pattern B legacy fallback gap, now ported in PR [#135](https://github.com/j4xie/my-prototype-logistics/pull/135)) |
| T6.2 canary outcome | F001 live since 2026-05-07 04:01 CST; 24h soak GO declared per `project_2026_05_07_t6_2_canary_live.md` |
| T6.3 cutover outcome | 61 test factories live since 2026-05-08; smoke 1159/1159 = **100% pass** in 55.4s wall-clock (per `project_2026_05_08_t6_3_cutover_live.md`); 24h soak ETA 12:05 May 9 CST |
| T6.4 readiness gates | 3/3 closed today: customer comms (#141), baseline metrics (#143), rollback rehearsal (#142) |
| Phase 2A dict-eq gate | Officially adopted as Rule 4 expansion (PR [#125](https://github.com/j4xie/my-prototype-logistics/pull/125), `2026-05-07`) — Pattern A int-collapse + Pattern A2 trailing-zero accepted; strict-byte deferred Phase 3+ |

**Bottom line**: Phase 2A delivered byte-shape parity at the dict-eq gate within an 8-day execution window, surfacing 12 codified language-quirk Rules in the process. The non-trivial open work is **operational** — PR #135 prod deploy + 24h soak (May 9-10), then T6.4 staged cutover (May 10-14), plus a P2 K-1 sales sister-endpoint follow-up captured today (PR [#147](https://github.com/j4xie/my-prototype-logistics/pull/147)).

---

## §2. T6 staged cutover journey

### §2.1 T6.0 — vhost prep (2026-05-06)

- nginx vhost backup: `api.cretaceousfuture.com.conf.bak.t6_0.20260506_034313` (per `project_2026_05_07_t6_2_canary_live.md`)
- 47-side: cretas-backend-test heap 768m → 1500m (commit `3661e736d`); systemd `Restart=always` to survive sister chat SIGTERMs

### §2.2 T6.1 dryrun — parity validation (2026-05-07 02:58 CST → 22:23 CST crash)

Launched with `duration=79200s` (22h target). Crashed at iter ~1060 / elapsed ~17h54min on a transient `JSONDecodeError` from a non-JSON response (later traced to `cretas-backend` (Java :10010) systemd stop at 22:23:18 CST May 7 — Blue-Green flipped 10010 → 10020 mid-dryrun, wrapper hardcoded `:10010`).

**Partial NDJSON yielded statistically definitive parity**:
- 21,736 lines, 19 endpoints × 1144 samples each (uniform)
- match: **21,724 (99.945%)**
- diverge: 12 (0.055%)
- compare_err: 0
- HTTP non-2xx: 0 each side
- p99 latency Python 33.7ms vs Java 25.0ms (1.35× ratio, well under 5× cap)

**12-diverge breakdown** (per PR [#119](https://github.com/j4xie/my-prototype-logistics/pull/119) commit `c501632bb`):
- 11 of 12 = `analysis/finance?analysisType=budget` with consistent +105…+108B Java-bigger gap → Pattern A int-collapse / Pattern A2 trailing-zero (dict-eq tolerable)
- 1 of 12 = `analysis/finance` composite at 2026-05-07T01:30 UTC with +4531B gap → **Pattern B**: Java legacy fallback path Python omitted

**T6.1 → Pattern A vs Pattern B distinction graduated** (PR [#125](https://github.com/j4xie/my-prototype-logistics/pull/125)):
- **Pattern A** (dict-eq tolerable): Decimal int-collapse / Lombok+Jackson serialization quirks / String.format vs banker's. **All accepted under Rule 4 dict-eq gate**.
- **Pattern B** (must-port): Java code path Python omits structurally. **NOT tolerable** — needs full impl. PR #135 chain (§3) closed this.

### §2.3 T6.2 — F001 canary (2026-05-07 04:01 CST)

10% canary cutover via 139 nginx vhost regex match on F001. Backup: `api.cretaceousfuture.com.conf.bak.t6_2_pre.20260507_035911`.

Per `project_2026_05_07_t6_2_canary_live.md` GO criteria (Python error <0.5%, p50 <200ms, p99 <2000ms, 0 Java fallback): all passed. 24h soak GO declared, unblocking T6.3 readiness.

### §2.4 PR-3 cretas-python.service N=2 multi-worker (2026-05-07 11:36 CST)

Required for T6.3 50% factories (concurrent load: c=10-15) where single-worker GIL would block JSON serialization on event loop. **6 PRs over single chat session** (per `project_2026_05_07_uvicorn_n2_path_x_lite.md`):

| PR | Commit | Purpose |
|---|---|---|
| [#99](https://github.com/j4xie/my-prototype-logistics/pull/99) | `8f397b9ff` | PR-1 spike — naive `--workers 4` catches PG slot exhaustion |
| [#101](https://github.com/j4xie/my-prototype-logistics/pull/101) | `c24ec43c7` | PR-1.5 SQLAlchemy sync pool 5+10 → 2+3 (hardening, not the real fix) |
| [#103](https://github.com/j4xie/my-prototype-logistics/pull/103) | `6a92b71464` | PR-2 file-lock leader gate for 5 background tasks |
| [#105](https://github.com/j4xie/my-prototype-logistics/pull/105) | `63a1abcf5` | re-spike report — root-cause re-diagnosed (asyncpg, not SQLAlchemy) |
| [#106](https://github.com/j4xie/my-prototype-logistics/pull/106) | `30e863863` | **PR-1.6 the real fix** — asyncpg pool 40→15 smartbi / 8→6 cretas (audit-driven) |
| [#107](https://github.com/j4xie/my-prototype-logistics/pull/107) | `6d02ad42` | N=2 + Path X-lite re-spike — all gates pass, GO for PR-3 |
| [#109](https://github.com/j4xie/my-prototype-logistics/pull/109) | (server-only systemd edit) | PR-3 cutover audit trail |

**N=2 leader gate verified post-cutover** (per `/var/log` excerpt in memory):
```
[leader] PID=665173 acquired /tmp/cretas-python-leader-prod.lock
[follower] PID=665172 BlockingIOError → leader handles 5 background tasks
```

**Lesson graduated** (per memory): "PR-1 misdiagnosed SQLAlchemy as bottleneck. PR-1.5 修了不对的层。Independent audit agent caught food_kb + completeness_calculator pools missed in math." → **always full-account every PG-using module before committing to a fix**.

### §2.5 T6.3 — 61 test factories cutover (2026-05-08)

Strategy B regex (per `project_2026_05_08_t6_3_cutover_live.md`):
```
(F001|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-8]|TEST_0000_001)
```
Hand-counted: 1+48+2+1+8+1 = **61** factories ✓.

| Metric | Value |
|---|---|
| Smoke calls | 1159 (61 × 19 endpoints) |
| Pass rate | 1159/1159 = **100.00%** |
| Wall clock | 55.4s (6-way parallel) |
| HTTP 5xx | 0 |
| Java fallback rate | 0 |

24h soak ETA: 2026-05-09 12:05 CST. Rollback target: `bak.t6_3_pre.20260508_032339` (BUT see §6.4 — this file is **mislabeled** per PR [#142](https://github.com/j4xie/my-prototype-logistics/pull/142)).

### §2.6 T6.4 readiness — 3/3 gates closed today

Per `project_2026_05_08_t6_4_readiness_gates.md`:

| Gate | PR | Commit | Outcome |
|---|---|---|---|
| Customer comms plan + bilingual templates | [#141](https://github.com/j4xie/my-prototype-logistics/pull/141) | `068ebd8b8` | 14-customer roster + 6 templates + escalation chain (5min ack / 12min decide / 15min recover) |
| 14-customer baseline metrics | [#143](https://github.com/j4xie/my-prototype-logistics/pull/143) | `8b8f758752` | 56 Java + 56 Python captures + manifest + audit doc; **finds Python doesn't mount /dashboard** (T6.4 nginx regex no adjustment needed); confirms 12/14 customers minimal data, F002+F006 inventory only, RES_3101_009 (QHJ_PROD) Gold POS via dashboard composite |
| Rollback rehearsal + timing measurements | [#142](https://github.com/j4xie/my-prototype-logistics/pull/142) | `41552a96221d70365162c76dc29280874f5dc5e3` | 36ms file-ops + <1s reload (massive headroom under <30s threshold); **CRITICAL find**: `bak.t6_3_pre.20260508_032339` is actually T6.2 state (F001-only regex), NOT T6.3 — see §6.4 |

Plus the deploy + cutover MOs:

| Artifact | PR | Commit | Purpose |
|---|---|---|---|
| 5-stage cutover MOs (May 10-14) | [#144](https://github.com/j4xie/my-prototype-logistics/pull/144) | `0c8f85af7` | 1 file per stage day under `docs/superpowers/dispatch/2026-05-1{0..4}-t6-4-stage-{1..5}-marching-order.md` |
| PR #135 prod deploy MO | [#145](https://github.com/j4xie/my-prototype-logistics/pull/145) | `63a44d1d0` | 624 LOC, 10 sections, 6 STOP conditions, 3 rollback paths, BG flow |
| PR #135 24h soak monitoring runbook | [#148](https://github.com/j4xie/my-prototype-logistics/pull/148) | `883472557` | 429 LOC, 11 sections, T+1h/T+6h/T+24h progressive thresholds, 7-path anomaly tree |

---

## §3. Pattern B chain end-to-end (PR #119/#124/#127/#131/#135/#137/#138)

The most complex single-thread arc of Phase 2A. Each PR resolves the next bottleneck.

| PR | Commit | Squash date | Content |
|---|---|---|---|
| [#119](https://github.com/j4xie/my-prototype-logistics/pull/119) | `c501632bb` | 2026-05-07 | T6.1 dryrun NDJSON analyze script + GO/no-go report. **Identifies 12-diverge breakdown** that motivates Pattern A vs B distinction. |
| [#124](https://github.com/j4xie/my-prototype-logistics/pull/124) | `f356e3168` | 2026-05-07 | finance composite +4531B root cause investigation. **Hypothesis A confirmed**: Java has legacy fallback path (line 149+) when Gold-primary HTTP throws IOException; Python's port lacks the equivalent → +4493B vs Python's empty stub at the dryrun's 01:30 UTC pressure window. |
| [#127](https://github.com/j4xie/my-prototype-logistics/pull/127) | `51dc1eabb` | 2026-05-07 | Pattern B Phase A spec. **Discovery surprise**: 7/7 Python primitives already exist (`_get_profit_metrics` etc.); only 3 composers + body rewrite needed (~150-250 LOC scope). |
| [#131](https://github.com/j4xie/my-prototype-logistics/pull/131) | `4caa2858d` | 2026-05-07 | Pattern B PR-B impl — State C only (legacy fallback). +185/-11 = 174 LOC net, within spec range. |
| [#135](https://github.com/j4xie/my-prototype-logistics/pull/135) | `2e90a2016` | 2026-05-08 | **Pattern B PR-B v2 — full 3-state branching** mirror Java line 111-189. PR-C pre-flight audit caught critical gap: PR #131 always emitted State C while Java prod default emits State A (Gold-populated) / State B (empty) / State C (legacy fallback). User pivoted to long-term right path. Total Pattern B impl: **322 LOC** (under 350 ceiling). |
| [#137](https://github.com/j4xie/my-prototype-logistics/pull/137) | `5cc0e1837` | 2026-05-08 | PR-C v2 — 3-state goldens + 16 tests + Rule 4 latent fix in PR #135 + main CI red fix. **Discovery (REVERTS task #24)**: F001 has Gold POS data populated. Real-data State A test possible (not mock-only). |
| [#138](https://github.com/j4xie/my-prototype-logistics/pull/138) | `6310f00278` | 2026-05-08 | Independent peer review + real env smoke verify. State C ✓ + State B ✓ on test env 8084. State A deferred (PR #137 covered via Gold mock + F001 real). Mock vs real env reconciliation MATCH. |

### §3.1 4-state matrix mirror Java line 111-189

| Flag | Gold result | State | Output | Bytes |
|---|---|---|---|---|
| `false` (default) | skipped | C — legacy | 10 KPIs + 3 charts + overdue + insights + suggestions | ~5-7 KB |
| `true` | populated | A — Gold | 4 KPIs (revenue/bills/avgBill/stores) + top_stores ranking | ~1-2 KB |
| `true` | revenue=0 AND bills=0 | B — empty | Empty `DashboardResponse` (Java line 135-142 mirror) | ~300 B |
| `true` | exception | C — legacy fallback | Same as flag=false (Java line 143-146 catch) | ~5-7 KB |

### §3.2 F001 Gold POS data discovery (reverts task #24)

PR #137 peer review against real F001 in test env confirmed Gold POS data populated. Task #24 prior finding "no factory has Gold data populated" no longer holds. Implication: **real-data State A test is now possible** (not mock-only); T6.4 cutover Pattern B 4-branch matrix on real customer factories has true baseline.

Resolves task #20 latent: `SMARTBI_GOLD_READ_PRIMARY_ENABLED` env var now read by Python (default `false` matches Java `@Value(":false")` line 77).

### §3.3 Critical cross-cutting decisions

- **Direct in-process call to `smartbi.gold.queries.finance_summary`** (PR #127 §1.2 cleaner option) instead of HTTP self-loop. Lazy import inside `_build_finance_overview_from_gold` matches existing pattern at `analysis_finance.py:1391+`.
- **Reuses existing `_format_kpi_value` at line 452** (no duplicate helper).
- **Existing primitive integrity preserved**: zero modifications to 6 primitives + 3 PR #131 composers (verified via grep in PR #135 review).
- **Rule 4 latent fix in PR #137** caught by chat 2 PR-C State A test against real F001 Gold POS data — KPI raw_value Decimal directly emitted → wrapped with `_decimal_to_number()` per Phase 2A dict-eq gate.

---

## §4. Rule 10/11/12 audit thread (7-file sweep, M=0 + M=1 fix)

**Rule 10/11/12 audit thread fully closed** (per `MEMORY.md` index entry "Rule 10/11/12 audit thread fully closed across 7 files (#139 chat 3 + #140 chat 2)"):

| Rule | Description | First hit | Latent sweep |
|---|---|---|---|
| 10 | `BigDecimal.divide(scale,rounding).multiply(K)` ≠ Python `(n/d*K).quantize(scale)` | PR-M-2 (#94 `d61e1b46b` 2026-05-06) — 4 sister chat each hit one (alerts/category-comparison/procurement/sales) | Latent sites: `analysis_finance.py:1666, 1679, 1695, 1832, 1896, 2095, 2163, 2195, 2636, 2651, 2830` |
| 11 | Java Jackson `LocalDateTime` drops trailing-zero microseconds | PR-M-7 (#93 `e2a527326` 2026-05-06) — datasource/list F001 7 timestamps; latent risk on ~50 endpoints | `_java_isoformat` helper landed in `schema_compat.py` |
| 12 | Java `String.format("%.Nf", d)` HALF_UP vs Python f-string `:.Nf` banker's rounding | PR-N-1 closer (organizer commit `0982195cf` 2026-05-06) — procurement supplier concentration 46.55 → "46.6" Java vs "46.5" Python | 12 defensive proactive fixes commit `69b46f4d5` 2026-05-07 across analysis_inventory.py + analysis_drilldown.py |

### §4.1 Today's sweep

| PR | Commit | Coverage | Outcome |
|---|---|---|---|
| [#140](https://github.com/j4xie/my-prototype-logistics/pull/140) | `281b71ac9` | `analysis_finance.py` Rule 10+11+12 audit | **M=0 baseline** (zero defects after PR-M-2/M-7/PR-N-1 sweep). 10 regression tests added + audit doc. |
| [#139](https://github.com/j4xie/my-prototype-logistics/pull/139) | `dd376eeb4` | `analysis_department.py` + `analysis_region.py` + `analysis_procurement.py` Rule 10+11+12 sweep | **M=1 fix** at `analysis_procurement.py:899` PROCUREMENT_MOM_GROWTH `formattedValue` (Rule 12 banker's rounding). |

### §4.2 Why M=1 mattered

PR-N-1 closer (commit `0982195cf` 2026-05-06) fixed `analysis_procurement.py:877` supplier_concentration formattedValue. PR #139 chat 3 cross-file sweep caught **same file, same pattern** at line 899 (sister site). This is a textbook **narrow-scope blind spot** — see §6.2.

7-file sweep coverage: `analysis_finance.py` + `analysis_inventory.py` + `analysis_drilldown.py` + `analysis_sales.py` (prior swept) + `analysis_department.py` + `analysis_region.py` + `analysis_procurement.py` (this batch). **Complete**.

### §4.3 T6.4 readiness boost

Proactive blind-spot catch BEFORE real customer factories surface the bug. Specifically: F002/F003/F004/F006 + 7 R_* customers' procurement endpoints would have hit the line 899 sister site at any mom_growth value ending in `.5` boundary. Pre-T6.4 sweep eliminates this class of failure.

---

## §5. K-1 sales latent (PR #146 + #147)

PR [#146](https://github.com/j4xie/my-prototype-logistics/pull/146) (`3bcf6f665`, 2026-05-08) — Pattern B sister-endpoint scan applies the **narrow-scope sister-site sweep rule** (per `feedback_narrow_scope_fix_sister_site_sweep.md`, see §6.2) to PR #135's flag-gate work. Found: `analysis_sales.py:_get_sales_overview` lacks the `SMARTBI_GOLD_READ_PRIMARY_ENABLED` flag gate even though `_get_finance_overview` was just hardened.

PR [#147](https://github.com/j4xie/my-prototype-logistics/pull/147) (`a687814bd`, 2026-05-08) — verify K-1 customer Gold state. **K-1 downgraded P2** (NOT T6.4 blocker) per customer Gold state verify: only F001 has Gold POS data populated; the 14 T6.4 customers + remaining factories have no Gold data, so the missing flag gate produces **State C-equivalent** (legacy aggregation) regardless. K-1 is a **defensive Phase B prep** ticket, not a T6.4 blocker.

This pattern — proactive sister scan after a PR ships → finding a related latent → verifying severity against real customer state → downgrading vs blocking — is the cleanest example of the narrow-scope sister-site sweep rule paying off in real time.

---

## §6. Lessons learned — organizer-side patterns

### §6.1 Organizer projection bug (verify-before-dispatch)

Per `feedback_organizer_projection_bug.md` (Audit history 2026-05-02 had 4 same-day cases). Pattern: dispatching a marching order assuming a PR/commit exists without `gh pr view --json state,mergeCommit` verify.

**Today's recurrences** (4 instances, per Steve's MO):
1. Pattern A2 follow-up notes — assumed work landed before it did
2. `analysis_finance.py` Rule 10/11/12 M=0 expectation set before PR #140 actually shipped
3. PR #133 already shipped — re-dispatched re-work
4. Cross-chat state lag from parallel-chat coordination

**Mitigation graduated**: every marching order this session opens with explicit `git fetch origin && git log origin/main --oneline -5` step before any work. PR #145 §1 has 6 STOP conditions including this verify — **organizer did not depend on chat discipline alone, baked into the MO itself**.

### §6.2 Narrow-scope fix sister-site sweep (graduated 2026-05-08)

Per `feedback_narrow_scope_fix_sister_site_sweep.md` graduated **today** from ≥2 occurrences:

1. **PR-N-1** (commit `0982195cf` 2026-05-06) fixed `analysis_procurement.py:877` Rule 12, missed sister at line 899 → caught by PR #139 chat 3 cross-file sweep.
2. **PR-M-2** (commit `d61e1b46b` 2026-05-06) fixed 4 specific Rule 10 sites, left 11 latent at `analysis_finance.py:1666, 1679, 1695, ...` per chat 4's documented latent list.

**Hard rule applied to all today's fixes**: any PR titled `fix Rule X at site Y` must `grep` same file same pattern, list every site, reviewer verifies scope is **file-complete or sub-set**. Graduated to project memory + applied to PR #139 / #140 review process.

### §6.3 Marching order separation (immediate vs queued)

Per `feedback_organizer_marching_order_separation.md`: future-conditional task definitions and immediate-execution definitions **must not appear in the same chat message**. Audit history 2026-05-02 had 3 cases where mixed messages caused chats to skip prereq verify and execute future-conditional work.

**Process baked**: every marching order opens with `⚡ IMMEDIATE` or `⏳ QUEUED — wait for X` label. Today's 16 marching orders all followed this format; no chat executed out-of-order work.

PR #144 (5-stage cutover MOs) is the cleanest example — each stage MO opens with `⏳ QUEUED — T6.4 Stage N — wait for trigger`, prereq gate listed before any work begins. Sister chat picking up Stage 2 cannot accidentally execute Stage 1's prereqs.

### §6.4 Admin merge file scope verify (per `feedback_organizer_admin_merge_verify.md`)

`gh pr view <N> --json files --jq '.files[] | "\(.additions)\t-\(.deletions)\t\(.path)"'` before any admin merge. **One catch in audit history** (2026-05-02): Chat 2 PR #56 region force-push showed -2587 lines deletions across `analysis_inventory.py` + `analysis_finance.py` + 6 plan/golden files. Direct admin merge would have reverted 5+ sister chat work. Caught because organizer ran the file-scope query as a routine check.

**Today**: 18 admin merges, all 0 sister-revert false positives. The discipline cost (~30s/merge × 18 = 9 min) is dwarfed by the cost of one inadvertent sister revert.

### §6.5 Main worktree branch isolation (per `feedback_main_worktree_branch_isolation.md`)

Per memory's audit history 2026-05-02 had 4 cases of main worktree branch contamination. Hard rule: **main worktree (`C:/Users/Steve/my-prototype-logistics`) stays on `e2e/v1-framework`**; all chat-specific work in `.worktrees/<task-name>/`.

**Today's 18 PRs all followed**: each marching order opened with `git worktree add .worktrees/<name> -b <branch> origin/main` and explicit `pwd && git branch --show-current` verify. Zero main-worktree contamination incidents today.

### §6.6 Pause before deploy/push (per `feedback_pause_before_deploy_or_push.md`)

Hard rule from 2026-05-07: any deploy script invocation or `git push` must STOP and ping Steve first so he can stash other worktrees. Today's PR sequence (16 admin-merged) followed this throughout — every PR ended with "ping me to push" before push, even doc-only work.

The discipline matters most for prod-touching work (deploy MOs). PR #145 / #148 explicitly stop before deploy step; PR #139 / #140 fixes were merged via admin merge (no direct push to main from PR branches).

### §6.7 `safe-commit.sh` pattern (path-pinned commit)

Per `feedback_concurrent_edit_safety.md` Rule 5b graduated 2026-04-28: commit with explicit paths (`git commit -m "msg" -- F1 F2`) prevents husky/lint-staged from auto-staging concurrent-session files into your commit. Today's 16 PR commits all path-pinned; zero scope-creep incidents.

---

## §7. 4-chat parallel coordination patterns

Phase 2A peaked at 4 chats running in parallel during T6 readiness window (2026-05-06 → 2026-05-08).

### §7.1 ⛔ HOLD blocks vs bullet "ping me"

Distinguish:
- **⛔ HOLD blocks**: hard prerequisites that must hold true before the chat can proceed at all (e.g., "T6.3 24h soak GO declared"). Listed at top of MO. Failed HOLD = STOP, ping organizer.
- **bullet "ping me" / "STOP and ping"**: soft pause points within an MO (e.g., "after deploy step, before pushing the audit log"). Lower severity, used to give organizer chance to intervene before next risky action.

PR #145 §"⛔ HOLD blocks" lists 5 hard prerequisites; PR #145 §10 ("Resumption checklist") has soft pause points. Different tools for different severity.

### §7.2 Stop-and-ping discipline

Per memory `project_2026_05_08_t6_3_cutover_live.md` and audit history: chat-side stop-and-ping discipline caught organizer projection × 3 today (sister-chat work assumed shipped that wasn't). Without this discipline, organizer projection would have caused real waste (chat starts wrong work, organizer notices later, chat re-does).

The organizer projection bug rule (§6.1) baked verify-before-dispatch into MO templates so chats don't have to be the last line of defense — but the chat discipline backup remains valuable for catching slip-throughs.

### §7.3 Specialty alignment

Today's 4-chat parallel had loose specialty assignment:
- **chat 4**: deploy/ops focus (BG dryrun, prod deploy MOs, scripts)
- **chat 2**: audit/spec writer (cutover runbook PR #110, #136; rollback rehearsal PR #142)
- **chat 3**: audit/sweep (Rule 10/11/12 cross-file at PR #139)
- **chat 1**: floater (peer review PR #138, baseline metrics PR #143, K-1 verify PR #147)

Specialty alignment reduced re-context-load cost — chat 4 didn't need to learn nginx-side every time; chat 2 didn't need to re-explore deploy script flow each cycle.

### §7.4 Single-session admin-merge throughput

18 PRs admin-merged in single organizer session today (#133 → #150). Sustained at ~1 PR per 20-30 min including verify (`gh pr view --json files --jq`), comms ("ping me to push"), and intermittent fresh-MO writing. The discipline overhead (file-scope verify, stop-and-ping, pause-before-push) was the budget for the throughput — fewer mistakes, fewer revert PRs, no production incidents.

---

## §8. Open follow-ups (P2, post-T6.4)

### §8.1 K-1 sales fix (SHIPPED PR #149, P2 closer)

Per PR [#147](https://github.com/j4xie/my-prototype-logistics/pull/147): `_get_sales_overview` lacks `SMARTBI_GOLD_READ_PRIMARY_ENABLED` flag gate (sister-endpoint scan finding from PR #146). Downgraded P2 because no factory currently has Gold POS sales data populated outside F001's finance side (Gold sales data is separate).

**Update during retrospective draft**: PR [#149](https://github.com/j4xie/my-prototype-logistics/pull/149) (`7e6c35495`, merged 2026-05-08 08:32 UTC) shipped the K-1 fix — `_get_sales_overview` now mirrors PR #135's Pattern B 3-state dispatcher. +338/-41 = net 297 LOC. Defensive Phase B prep done **before** flag flip becomes a Phase 3+ decision. T6.4 cutover safe regardless.

**Trigger**: Phase B `SMARTBI_GOLD_READ_PRIMARY_ENABLED=true` decision (separate Phase 3+ scope) — when it fires, sales path now returns correct State A/B/C output instead of legacy-only.

### §8.2 14d follow-up agent for customer bug-density (May 14 trigger)

Per `MEMORY.md` index entry "R67-R83 QA marathon SHIPPED main via PR #27 (squash bef0e6912, tag qa-marathon-r76-r83)" — 14d follow-up agent `trig_01T8zgazMfatrg27vqsqRoZX` fires 2026-05-14T13:00Z. Phase 2A retrospective (this doc) is one input the agent will check.

### §8.3 Cross-tenant `raw_material_type` schema 重构 (deferred, PM/business decision)

Not a Phase 2A scope issue. Surfaced during PR #114/116/123/126 raw material chain work. Decision deferred to PM/business per Steve.

### §8.4 Strict-byte gate Phase 3+ adoption decision

Per `.claude/rules/python-java-port.md` Rule 4 §"When to upgrade to strict-byte (Phase 3+)":
- Triggers: customer-facing frontend hash-compares raw JSON / third-party integration contract requires byte-identical / API contract specifies strict serialization
- Phase 2A explicitly does NOT have these constraints, so dict-eq gate is sufficient.

When (if) strict-byte becomes required, Pattern A int-collapse + Pattern A2 trailing-zero need re-engineering (likely require Java side rewrite or Python-side serialization wrapper). T6.5 (Java SmartBI deprecation) eliminates the comparison constraint entirely — at which point strict-byte becomes moot for SmartBI scope.

### §8.5 Latent T6.1 dryrun wrapper bugs (filed not blocking)

- task #23: `deploy-smartbi-python.sh` doesn't sync `scripts/` directory (caused stale `t6-dryrun-compare.sh` on server during T6.1 launch)
- T6.1 wrapper `scripts/t6-dryrun-compare.sh` hardcoded `:10010` — broke when Blue-Green flipped 10010 → 10020 mid-dryrun. Per PR [#128](https://github.com/j4xie/my-prototype-logistics/pull/128) (`66f6e6ff8`) shipped dynamic Java port detection (Blue-Green safe). Verified — this fix is in main.

---

## §9. Phase 2B / Phase 3+ next steps

### §9.1 T6.5 — Java SmartBI deprecation (spec SHIPPED PR #150)

After T6.4 cutover completes (~May 14 CST), all 75 factories on Python. Java SmartBI controller (`backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java`) becomes dead code. T6.5 scope: remove Java SmartBI controller + service implementations + tests; reduce Java jar size; eliminate Java-side dual-impl maintenance burden.

**Update during retrospective draft**: PR [#150](https://github.com/j4xie/my-prototype-logistics/pull/150) (`cf8cc48e8`, merged 2026-05-08 08:38 UTC) shipped the T6.5 spec — 4 phases over 58-day total with `GoldDashboardBuilder` KEEP per task #24 (Gold layer architecture lives in Java side as the producer; deprecation removes consumer paths only). +602 LOC spec doc. **Companion artifact to this retrospective.**

**Execution trigger**: T6.4 7-day soak GO (after Stage 5 completion ~May 14 + 7d = ~May 21 CST). Specific deprecation cycle owned by separate execution chats per the 4-phase plan in PR #150.

### §9.2 Strict-byte gate consideration (Phase 3+)

Frontend hash-compare scenario would require strict byte-identical serialization. Decision input: which (if any) frontend code paths actually hash raw JSON responses (vs parsing → dict-eq → compute). Surveying frontend `services/api/*.ts` would establish the answer.

If the answer is "no frontend hashes raw JSON" → strict-byte stays deferred indefinitely (dict-eq is sufficient and Pattern A/A2 acceptance permanent).

### §9.3 Rule audit extension to non-analysis files

12 Rules currently audit-swept in `backend/python/smartbi_compat/api/analysis_*.py`. Latent risk in:
- `backend/python/smartbi_compat/helpers/` (utility functions called from analysis files)
- `backend/python/smartbi/` (the producer side of the Gold layer dataflow per `reference_smartbi_gold_layer_architecture.md`)
- `scripts/phase2a/` (the analyze script PR #119 ships — though analyzer doesn't emit byte-shape responses, it logs which makes Rule 11 microsecond format relevant)

Cost-benefit: helpers/scripts have lower byte-shape exposure (don't directly serve customer requests). Rule audit extension is **lower priority than T6.4 + T6.5 execution**. Schedule when Phase 3+ kicks off.

---

## §10. Cross-references

### Memory files

- `project_2026_05_07_t6_1_dryrun_in_flight.md` — full T6.1 dryrun analysis + Pattern B chain narrative
- `project_2026_05_07_t6_2_canary_live.md` — T6.2 F001 canary cutover + GO criteria
- `project_2026_05_07_uvicorn_n2_path_x_lite.md` — N=2 multi-worker enablement journey + 6-PR sequence
- `project_2026_05_08_t6_3_cutover_live.md` — T6.3 61 test factories cutover live + smoke 1159/1159 = 100%
- `project_2026_05_08_t6_4_readiness_gates.md` — 3/3 readiness gates closed + handoff
- `feedback_organizer_projection_bug.md` — verify-before-dispatch rule (4 May 2 cases + 4 today)
- `feedback_narrow_scope_fix_sister_site_sweep.md` — graduated 2026-05-08 from ≥2 occurrences
- `feedback_organizer_marching_order_separation.md` — immediate vs queued labels (3 May 2 cases)
- `feedback_organizer_admin_merge_verify.md` — file-scope verify before merge (1 catch May 2)
- `feedback_main_worktree_branch_isolation.md` — `.worktrees/<name>/` isolation (4 May 2 incidents)
- `feedback_pause_before_deploy_or_push.md` — STOP and ping Steve before deploy/push
- `feedback_concurrent_edit_safety.md` Rule 5b — path-pinned commits (2026-04-28 graduate)
- `reference_blue_green_java_deploy.md` — BG mode internals (10010 ↔ 10020 nginx upstream switch)
- `reference_smartbi_gold_layer_architecture.md` — Pattern B State distribution (F001 has Gold POS data discovery)
- `reference_smartbi_migration_runner.md` — migration runner Step 3.5 + tracker PK=filename
- `feedback_deploy_pipeline.md` — deploy-backend.sh v4.2 channels (OSS/R2/SKIP_RSYNC) + double-env defensive ping

### Codified Rules

12 Rules in `.claude/rules/python-java-port.md` (verified count via `grep -c '^## ⛔ Rule'`):

| Rule | Topic |
|---|---|
| 1 | Null fallback `is not None` 三元 (not Python `or`) |
| 2 | WEEK period key calendar year (not ISO year) |
| 3 | Python signature 1:1 mirror Java (no DateRange wrapper) |
| 4 | BigDecimal serialization `_decimal_to_number` + Phase 2A dict-eq gate |
| 5 | Shared SQL helpers `SELECT *` (legacy single-record exception) |
| 6 | Input boundary None-check (no silent zero results) |
| 7 | Decimal threshold compare (float only for integer thresholds) |
| 8 | `Map.of(N)` Jackson key order (record golden, mirror Python literal) |
| 9 | Lombok + Jackson quirks (decapitalize / null emit / derived getters) |
| 10 | BigDecimal divide-then-multiply intermediate round (4-digit quantize) |
| 11 | Java Jackson LocalDateTime drops trailing-zero microseconds |
| 12 | Java `String.format("%.Nf", d)` HALF_UP vs Python f-string banker's |

### Today's PRs (18, all admin-merged 2026-05-08)

| PR | Commit | Title (truncated) |
|---|---|---|
| #133 | (squash) | chore(phase2a): Pattern A2 audit follow-up notes verify + defensive docs |
| #134 | (squash) | docs(phase2a): Rule 9 latent audit — Lombok @Data + Jackson 3 sub-patterns swept clean (M=0) |
| #135 | `2e90a2016` | feat(phase2a): _get_finance_overview full 3-state branching (Pattern B PR-B v2) |
| #136 | (squash) | docs(t6-4): real customers cutover readiness runbook |
| #137 | `5cc0e1837` | test(phase2a): Pattern B PR-C v2 — 3-state goldens + 16 tests + fix main CI red |
| #138 | `6310f00278` | audit(phase2a): PR #135 Pattern B 3-state smoke verify (peer review + 2/2 PASS) |
| #139 | `dd376eeb4` | fix(phase2a): Rule 12 procurement MoM formattedValue + Rule 10+11+12 sweep dept+region+procurement |
| #140 | `281b71ac9` | audit(phase2a): analysis_finance.py Rule 10+11+12 M=0 baseline + regression tests |
| #141 | `068ebd8b8` | docs(t6-4): customer comms plan + bilingual templates + per-customer customization |
| #142 | `41552a96221d70365162c76dc29280874f5dc5e3` | audit(t6-4): rollback rehearsal — timing measurements + critical backup target correction |
| #143 | `8b8f758752` | audit(t6-4): real customer baseline metrics + capture script |
| #144 | `0c8f85af7` | docs(t6-4): 5-stage cutover marching orders Strategy B (May 10-14 CST) |
| #145 | `63a44d1d0` | docs(deploy): PR #135 prod deploy marching order — Blue-Green Java + Pattern B 3-state smoke + 24h soak |
| #146 | `3bcf6f665` | audit(phase2a): Pattern B sister-endpoint scan — K-1 sales overview missing flag gate (T6.4) |
| #147 | `a687814bd` | audit(t6-4): K-1 customer Gold state verify — K-1 downgraded P2 (NOT T6.4 blocker) |
| #148 | `883472557` | docs(soak): PR #135 prod 24h soak monitoring runbook (May 9-10) |
| #149 | `7e6c35495` | fix(phase2a): K-1 sales overview flag gate (mirror PR #135 Pattern B 3-state dispatcher) |
| #150 | `cf8cc48e8` | spec(t6-5): Java SmartBI deprecation trigger — 4 phases with 58-day total + GoldDashboardBuilder KEEP per task #24 |

---

## Caveats

This retrospective is written *during* T6.4 readiness window — PR #135 prod deploy + 24h soak + Stage 1 cutover have NOT yet executed. Outcomes after May 9 (PR #135 deploy result) and May 10-14 (5-stage cutover execution) will produce a follow-up retrospective addendum.

The Pattern B chain narrative in §3 is the single most complex thread of Phase 2A — for any future similar work, the lesson is: **PR-C pre-flight audit catches the structural gap that initial impl missed**. PR #131 was technically correct for State C only; PR #135 (PR-B v2) was the long-term-right fix because PR-C audit caught that "default flag" doesn't equal "no Gold data" — the flag-gate matters even when defaulted.

Per `feedback_organizer_projection_bug.md`: cite PRs / commits / memory file names — never speculate beyond what's verifiable. This doc cites all PRs by number + squash commit (verified via `gh pr view --json mergeCommit`); all memory files cited exist in `~/.claude/projects/.../memory/` at time of writing.

Generated 2026-05-08 by organizer chat after admin-merging PR #150 (final PR of today's session — both K-1 sales fix #149 and T6.5 spec #150 shipped during retrospective draft, captured inline in §8.1, §9.1, §10).
