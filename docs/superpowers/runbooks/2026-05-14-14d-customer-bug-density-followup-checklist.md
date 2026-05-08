# 14-day Customer Bug-Density Follow-Up — Checklist (May 14 trigger)

**Window**: 2026-04-30 (R67-R83 ship to prod) → 2026-05-14 (this trigger fires).
**Trigger**: scheduled agent `trig_01T8zgazMfatrg27vqsqRoZX` fires 2026-05-14T13:00Z (≈ 21:00 CST May 14).
**Predecessor scope**: R67-R83 QA marathon (PR [#27](https://github.com/j4xie/my-prototype-logistics/pull/27) `bef0e6912`, tag `qa-marathon-r76-r83`) addressed Apr 15 customer report 13/16 bug-density modules within scope (SmartBI + 数据分析 excluded — those tracked through Phase 2A T6 cutover thread).
**Goal**: assess whether R67-R83 fixes held up over 14 days of real customer usage; whether new bugs surfaced; whether T6.3+T6.4 cutover (May 8-14) introduced regressions in the SmartBI/数据分析 paths.
**Author**: organizer chat
**Date**: 2026-05-08

This is **doc-only checklist** for the May 14 trigger to consume. The trigger itself runs an agent that picks up this checklist verbatim — no human-in-the-loop required for the standard happy-path GREEN scenario, but YELLOW/RED scenarios escalate per §5.

⛔ **HOLD blocks**: Do NOT execute pre-trigger. Do NOT touch prod / customer data during draft. This is a checklist artifact only.

---

## §1. Pre-flight scope

### §1.1 In-scope modules (per Apr 15 customer report)

Per memory `project_apr30_r67_r75_complete_ship.md` "R76+ Backlog" + `project_apr30_r76_dashboard_fakes_strip.md` "Why this round mattered":

> Apr 15 customer report: 13/16 customer bugs in modules with `none` E2E coverage (SmartBI / 系统管理 / 日常管理 / 数据分析 / 经营驾驶舱). User excluded SmartBI + 数据分析, so 经营驾驶舱 was highest-value target.

**In-scope** (R67-R83 fixed these):
| Module | R67-R83 PR coverage | Status post-ship |
|---|---|---|
| 经营驾驶舱 (Dashboard) | R76 dashboard fakes strip — 4 P0 fake-data sites + 6 P1 silent failures fixed | Live since 2026-04-30 |
| 系统管理 (System Management) | R77 system mgmt sweep | Live since 2026-04-30 |
| 日常管理 (Daily Operations) | R78 equipment cluster + various | Live since 2026-04-30 |
| Controllers / Catch / Wrapper | R79 controller catch + R80 wrapper sweep | Live since 2026-04-30 |
| Final cleanup / type fixes | R81 + R82 + R83 final cleanup | Live since 2026-04-30 |

**Out of scope** (per Apr 15 client exclusion list):
- **SmartBI** — currently in Phase 2A T6.4 cutover window (May 10-14 staged); customer-facing bugs in this scope tracked through T6.4 5-stage MO PR [#144](https://github.com/j4xie/my-prototype-logistics/pull/144) + customer comms PR [#141](https://github.com/j4xie/my-prototype-logistics/pull/141)
- **数据分析 (Data Analysis)** — same as SmartBI, Phase 2A scope

### §1.2 Cutover overlap with this window

The 14-day follow-up window (April 30 → May 14) overlaps with:
- 2026-04-23: `SMARTBI_GOLD_READ_PRIMARY_ENABLED=true` set on prod (Phase B Dashboard Gold UI port intentional; per PR [#157](https://github.com/j4xie/my-prototype-logistics/pull/157) `45a71487b` Bug #417 dependency, legacy scan 53s → 228ms when Gold authoritative)
- 2026-05-07 04:01 CST: T6.2 F001 canary cutover live
- 2026-05-07 11:36 CST: PR-3 cretas-python N=2 multi-worker live + **PR #135 Pattern B 3-state branching code already on prod** (commit `2e90a2016` per PR #157 investigation — N=2 cutover deployed it; subsequent PR [#145](https://github.com/j4xie/my-prototype-logistics/pull/145) deploy MO **amended to smoke re-verify** rather than new deploy)
- 2026-05-08: T6.3 61 test factories cutover live
- 2026-05-09: T6.3 24h soak GO + PR #135 smoke re-verify (per PR #157 amendment)
- 2026-05-10 → 2026-05-14: T6.4 5-stage cutover (per PR [#144](https://github.com/j4xie/my-prototype-logistics/pull/144))

**Implication**: any customer-reported SmartBI bug between 2026-05-07 and 2026-05-14 needs cross-reference to:
- Which T6.x cutover stage was active when the bug was reported
- Whether the customer's factoryId is in the cutover scope (Python-served) or out (still Java-served)
- Whether the bug is in the **State A path** (flag=true + Gold-populated, e.g., F001) vs **State B path** (flag=true + Gold null, e.g., factories without POS data) vs **State C path** (legacy fallback). The flag has been ON in prod since 2026-04-23 (per PR #157), so all 14 customers route through the 3-state dispatcher; State distribution depends on per-factory Gold POS data presence.
- Customer comms log per PR #141 channel hierarchy (电话 / 微信 / 钉钉 / 邮件 / 工单)

### §1.3 14d follow-up agent meta

| Field | Value |
|---|---|
| Trigger ID | `trig_01T8zgazMfatrg27vqsqRoZX` |
| Fire time | 2026-05-14T13:00Z (≈ 21:00 CST May 14) |
| Source | `MEMORY.md` index entry for R67-R83 ship + this checklist |
| Action mode | Read-only data audit + report generation; escalates per §5 if RED-tier bug surfaces |

---

## §2. Data sources to query

When the trigger fires, the agent runs the following queries in order. Each command is a copy-paste-ready bash block.

### §2.1 Java prod logs (server 47, port 10010)

```bash
ssh root@47.100.235.168 "
echo '=== Java prod log — last 14 days, ERROR/WARN/EXCEPTION level ==='
journalctl -u cretas-backend --since '14 days ago' --no-pager 2>/dev/null \
  | grep -iE 'ERROR|WARN|exception|Traceback' \
  | wc -l
echo
echo '=== Top 20 unique error patterns (last 14 days) ==='
journalctl -u cretas-backend --since '14 days ago' --no-pager 2>/dev/null \
  | grep -iE 'ERROR|exception' \
  | sed -E 's/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.+]*//; s/[a-f0-9]{32}//g; s/[0-9]+/N/g' \
  | sort | uniq -c | sort -rn | head -20
echo
echo '=== Per-factory error count (cutover-scope correlation) ==='
journalctl -u cretas-backend --since '14 days ago' --no-pager 2>/dev/null \
  | grep -oE 'factoryId=[A-Z0-9_]+' \
  | sort | uniq -c | sort -rn | head -15
"
```

### §2.2 Python prod logs (server 47, port 8083)

```bash
ssh root@47.100.235.168 "
echo '=== Python prod log — last 14 days ==='
# Note: Python prod live since 2026-05-07 04:01 CST (T6.2), so 14-day window
# only captures ~7-8 days of Python data depending on trigger fire time
journalctl -u cretas-python --since '14 days ago' --no-pager 2>/dev/null \
  | grep -iE 'ERROR|exception|Traceback' \
  | wc -l
echo
echo '=== Pattern B exception scan (analysis_finance.py) ==='
journalctl -u cretas-python --since '14 days ago' --no-pager 2>/dev/null \
  | grep -iE '_build_finance_overview_(from_gold|legacy|empty)' \
  | wc -l
echo
echo '=== Java fallback rate per cutover scope ==='
journalctl -u cretas-backend --since '14 days ago' --no-pager 2>/dev/null \
  | grep -iE 'fallback.*python|python.*unavailable' \
  | wc -l
"
```

### §2.3 Customer ticket / channel system

Per PR [#141](https://github.com/j4xie/my-prototype-logistics/pull/141) §"Channel hierarchy": 电话 / 微信群 / 钉钉 / 邮件 / 工单. The agent does NOT have direct access to customer ticket system; instead, query the **internal status logs** salseslead maintains. If sales team uses a ticket DB, the agent should request access via organizer ping (see §5.1).

**Deferred**: production ticket system query is **manual** — sales lead provides a 14-day issue summary at trigger fire time; agent ingests that summary as additional input.

### §2.4 T6.3 24h soak data + PR #135 smoke re-verify

Per PR [#148](https://github.com/j4xie/my-prototype-logistics/pull/148) (PR #135 24h soak monitoring runbook) — repurposed as smoke re-verify per PR [#157](https://github.com/j4xie/my-prototype-logistics/pull/157) finding (PR #135 was already deployed May 7 at N=2 cutover). At trigger fire time, T6.3 24h soak GO + PR #135 smoke re-verify both concluded; data in `docs/qa-audits/2026-05-09-*.md`.

```bash
# Read T6.3 soak GO summary + PR #135 smoke re-verify
ls docs/qa-audits/ | grep -E "(t6-3|pr-135)" | head -5
# Expected files post-2026-05-09:
#   docs/qa-audits/2026-05-09-pr-135-prod-deploy.md (or smoke-reverify variant per PR #157 amendment)
#   docs/superpowers/runbooks/2026-05-09-pr-135-prod-soak-monitoring.md
#   docs/qa-audits/2026-05-08-flag-flip-investigation.md (PR #157 root-cause artifact)
```

### §2.5 T6.4 per-stage soak data

Per PR [#144](https://github.com/j4xie/my-prototype-logistics/pull/144) — 5 stage MOs at `docs/superpowers/dispatch/2026-05-1{0..4}-t6-4-stage-{1..5}-marching-order.md`. Each stage produces an audit log per `feedback_organizer_admin_merge_verify.md` discipline.

```bash
# At trigger fire time (2026-05-14T13:00Z = late Stage 4 / early Stage 5):
ls docs/qa-audits/ | grep -E "t6-4-stage-[1-5]" | head -10
# Expected: stage 1 / 2 / 3 / 4 audit logs already shipped; stage 5 may be in flight
```

### §2.6 Baseline metrics from PR #143

```bash
ls tests/fixtures/t6-4-baseline/manifest.tsv
# 56 Java + 56 Python captures + manifest.tsv
# Use as comparison reference for any post-cutover anomaly
```

---

## §3. Bug density computation

### §3.1 Per-customer per-endpoint per-pattern breakdown

For each customer factoryId (per PR #141 14-customer roster):
- F002 / F003 / F004 / F006 (4 F-numeric)
- R001 (示范餐厅)
- RES_3101_009 (QHJ_PROD)
- RES_GML_001 (桂满陇)
- R_GML_DEMO / R_XMX_CHAIN / R_XMX_FRESH/2/3 / R_YHDJ_DEMO / R_YJJ_DEMO (7 real customer pilots)

For each endpoint group (in-scope modules, NOT SmartBI/数据分析):
- 经营驾驶舱 endpoints (Dashboard*Controller + executive views)
- 系统管理 endpoints
- 日常管理 endpoints
- Cross-cutting: Controllers / Catch / Wrapper sweep (R79/R80)

**Bug rate formula** (per endpoint per customer):
```
bug_rate = (5xx_count + 4xx_business_failure_count) / total_request_count
```

Where `4xx_business_failure_count` includes BusinessException-typed failures (per R67-R75 typed contract: actionHint + severity + hintTarget structured response).

### §3.2 Pattern classification

For each bug, classify into:

| Pattern | Description | Example |
|---|---|---|
| **A — fake-data regression** | Customer report says "数字不对" / "数据看起来是假的" → check if R76 fix held (no Math.random() in dashboard) | DashboardHR/Warehouse/sku-margin |
| **B — silent failure regression** | Customer report says "页面 KPI 全是 0" → check if R76-R80 Promise.allSettled / catch-return-error fix held | DashboardAdmin/Production/HR |
| **C — controller catch anti-pattern** | HTTP 200 + success:false (R79 anti-pattern) → check if BusinessException sweep held | ProductionProgressDashboard / BehaviorCalibration |
| **D — typed contract drift** | actionHint / severity / hintTarget missing or wrong type | per R67-R75 typed BusinessException contract |
| **E — cutover-related (SmartBI scope)** | Customer factoryId in T6.4 cutover scope + reports SmartBI bug | Cross-reference T6.4 stage logs |
| **F — new latent surface** | Bug not matching any A-E pattern; entirely new failure mode | New module / new endpoint / new edge case |

### §3.3 Action thresholds

| Bug rate per customer per endpoint group | Tier | Action |
|---|---|---|
| **< 0.5%** | GREEN | No action — log baseline reading; trigger continues passive monitor |
| **0.5%-1%** | YELLOW | Open investigation ticket; tag relevant R-round (R67-R83) for regression analysis; ping organizer with summary |
| **> 1%** | RED | P1 escalation per §5; immediate intervention candidate; do NOT wait for organizer review (auto-page on-call) |

Cross-reference baseline metrics from PR #143 for cutover-scope endpoints (SmartBI/数据分析). For non-cutover modules (经营驾驶舱 / 系统管理 / 日常管理), R67-R83 ship date 2026-04-30 is the baseline reference — any rate > 0 today vs baseline of 0 (post-fix) is a regression signal.

---

## §4. Output format

The agent generates `docs/qa-audits/2026-05-14-14d-customer-bug-density-followup.md` with this structure:

```markdown
# 14-day Customer Bug-Density Follow-Up — 2026-05-14 trigger

**Window**: 2026-04-30 → 2026-05-14 (14 days)
**Trigger**: trig_01T8zgazMfatrg27vqsqRoZX fired at <ISO timestamp>
**Verdict overall**: GREEN / YELLOW / RED (highest tier hit)

## §1. Per-customer summary table

| Factory | 经营驾驶舱 | 系统管理 | 日常管理 | SmartBI (T6.4 stage) | Total bugs (14d) | Tier |
|---|---|---|---|---|---|---|
| F002 | 0 | 0 | 0 | <stage>:0 | 0 | GREEN |
| F003 | <count> | ... | ... | ... | <total> | <tier> |
| ... (14 rows) ...

## §2. Per-pattern breakdown (Patterns A-F)

| Pattern | Count | Affected customers | Affected modules |
|---|---|---|---|
| A — fake-data regression | <N> | <list> | <list> |
| B — silent failure regression | <N> | <list> | <list> |
| ... (6 rows) ...

## §3. Trend line vs Apr 15 baseline

| Module | Apr 15 bug count | Today's count | Trend |
|---|---|---|---|
| 经营驾驶舱 | 13 of 16 (81%) | <N> | Δ <±N> |
| 系统管理 | <N> | <N> | Δ |
| 日常管理 | <N> | <N> | Δ |
| (SmartBI/数据分析 excluded per Apr 15 client comms scope)

## §4. Top 3 affected modules (current 14-day window)

1. <module>: <count> bugs (<top affected customers>)
2. <module>: <count>
3. <module>: <count>

## §5. Cutover correlation (SmartBI/数据分析 only)

For each customer factoryId in T6.4 cutover scope, cross-reference:
- Cutover stage at time of bug report
- Java vs Python serving status
- T6.4 stage MO audit log entry

## §6. Recommended actions

[GREEN: continue passive monitor]
[YELLOW: per §5.2 escalation]
[RED: per §5.3 emergency escalation]
```

---

## §5. Escalation paths

### §5.1 GREEN tier — no action

- Log baseline reading to deploy artifact log
- Continue passive monitor
- Schedule next 14d follow-up trigger (suggest May 28)
- Ping organizer with 1-line summary: "14d follow-up GREEN, X total bugs across N customers, no regressions"

### §5.2 YELLOW tier — investigation ticket

For each YELLOW-tier customer:
- Open investigation ticket in internal tracker
- Tag with: relevant R-round (R67-R83) where the original fix landed
- Tag with: customer factoryId + module
- Cross-reference: Apr 15 baseline rate for that module (if available)
- Include log excerpts (last 100 error lines for that customer's factoryId)
- Assign to ops on-call rotation per PR #141 sign-off section §14
- Sales lead notified via 钉钉 / 微信 per PR #141 channel hierarchy
- Do NOT auto-rollback — investigation precedes any code change

### §5.3 RED tier — P1 escalation per PR #141

Per PR #141 §"P1 escalation":
- 客户报 P1 → 销售 5min ack → ops 12min rollback decision → 客户 15min recovery confirm

For RED tier from this 14d follow-up:
1. **Immediate**: 销售 lead notified via 电话 (PR #141 P1 channel) within 5 min of trigger fire
2. **Decision**: ops decides within 12 min:
   - **Rollback path 1**: code-level — R67-R83 era bug → emergency revert of relevant R-round PR (each R-round has independent commit on `e2e/v1-framework`, can be cherry-picked-revert via `git revert <commit>`)
   - **Rollback path 2**: cutover-related (SmartBI/数据分析 scope) → emergency T6.x rollback per PR [#142](https://github.com/j4xie/my-prototype-logistics/pull/142) §"emergency rollback procedure" + per-stage MO from PR #144
3. **Recovery confirm**: customer-facing recovery within 15 min of P1 ack
4. **Postmortem**: write incident audit doc within 24h of resolution

### §5.4 Cross-tier issues (multi-module / multi-customer)

If single bug affects:
- 3+ customers AND 2+ modules → cross-tier issue
- ANY of 14 customers + cutover scope module + after T6.4 stage cutover → cutover regression candidate

Cross-tier paths:
- Ping organizer immediately (do NOT wait for §5.1-§5.3 routine resolution)
- Organizer review determines whether to:
  - Roll back cutover stage
  - Roll back R-round PR
  - Hot-patch via dedicated PR

---

## §6. Resumption checklist (May 14 13:00 UTC trigger fires → agent picks up)

When the trigger `trig_01T8zgazMfatrg27vqsqRoZX` fires:

1. ✅ Read this checklist end-to-end (don't skim — §3.3 thresholds + §5 escalation paths are non-negotiable)
2. ✅ Read latest state of these supporting docs:
   - `MEMORY.md` index for any post-2026-05-08 entries
   - `project_apr30_r67_r75_complete_ship.md` and sister `project_apr30_r76_*.md` through `project_apr30_r81_r82_r83_final_cleanup.md`
   - PR [#143](https://github.com/j4xie/my-prototype-logistics/pull/143) baseline metrics
   - PR [#144](https://github.com/j4xie/my-prototype-logistics/pull/144) T6.4 5-stage MOs (check which stages have shipped)
   - PR [#148](https://github.com/j4xie/my-prototype-logistics/pull/148) PR #135 24h soak runbook
3. ✅ Run §2.1 + §2.2 + §2.4 + §2.5 + §2.6 queries in single SSH session
4. ✅ Request §2.3 customer ticket summary from sales lead via 钉钉 / 微信
5. ✅ Compute §3.1 + §3.2 per-customer per-endpoint per-pattern breakdown
6. ✅ Apply §3.3 thresholds → assign per-customer tier
7. ✅ Generate §4 output report at `docs/qa-audits/2026-05-14-14d-customer-bug-density-followup.md`
8. ✅ Engage §5 escalation matching highest tier hit
9. ✅ Schedule next 14d follow-up trigger if GREEN (suggest 2026-05-28)
10. ✅ Ping organizer with summary (1 line for GREEN, full audit doc link for YELLOW/RED)

### §6.1 Escalation contact list

(at time of writing — verify currency at trigger fire time)

| Role | Contact via | Primary | Backup |
|---|---|---|---|
| 销售 lead | 电话 / 钉钉 | per PR #141 §14 sign-off | per PR #141 §14 |
| Ops on-call | 电话 / 钉钉 / journalctl pager | per PR #141 §14 | systemd auto-restart fallback |
| Organizer (this chat lineage) | 微信 / 工单 / Claude Code session | continuation chat | new chat session |

### §6.2 Time-of-day considerations

Trigger fires 21:00 CST May 14 (after typical workday). Sales lead may not be immediately available for §5.3 P1 escalation if RED. **If RED at trigger time and sales unavailable**:
- Auto-defer P1 channel to email + 微信 with explicit "P1 — please ack within 5 min of next online" message
- Ops on-call activates regardless (24/7 rotation)
- Customer impact mitigation: emergency rollback can proceed without sales ack if ops on-call deems necessary; sales catches up in their next window

---

## §7. ⛔ HOLD blocks

This checklist is **doc-only**. The May 14 trigger consumes it as input; this PR (the checklist itself) does NOT execute any data query or write to prod.

- DO NOT pre-execute §2 queries during this checklist's draft
- DO NOT touch prod / customer data during this checklist's draft
- DO NOT trigger sales channels until trigger fire time + RED tier
- DO NOT rebase / amend without organizer ping (this checklist doc is referenced by trigger config)

---

## §8. Cross-references

- Memory `project_apr30_r67_r75_complete_ship.md` — R67-R75 ship details
- Memory `project_apr30_r76_dashboard_fakes_strip.md` — dashboard fakes strip rationale + customer-report context
- Memory `project_apr30_r77_system_mgmt_sweep.md` — system management module
- Memory `project_apr30_r78_equipment_cluster_sweep.md` — equipment / 日常管理
- Memory `project_apr30_r79_controller_catch_sweep.md` — controller catch anti-pattern sweep
- Memory `project_apr30_r80_wrapper_sweep.md` — wrapper / typed contract
- Memory `project_apr30_r81_r82_r83_final_cleanup.md` — final cleanup
- PR [#27](https://github.com/j4xie/my-prototype-logistics/pull/27) `bef0e6912` — R67-R83 QA marathon ship to main (tag `qa-marathon-r76-r83`)
- PR [#141](https://github.com/j4xie/my-prototype-logistics/pull/141) `068ebd8b8` — customer comms plan + escalation chain
- PR [#142](https://github.com/j4xie/my-prototype-logistics/pull/142) `41552a96221d70365162c76dc29280874f5dc5e3` — rollback rehearsal + backup mislabel finding
- PR [#143](https://github.com/j4xie/my-prototype-logistics/pull/143) `8b8f758752` — 14-customer baseline metrics (cross-reference for cutover-scope endpoints)
- PR [#144](https://github.com/j4xie/my-prototype-logistics/pull/144) `0c8f85af7` — T6.4 5-stage cutover MOs (May 10-14)
- PR [#145](https://github.com/j4xie/my-prototype-logistics/pull/145) `63a44d1d0` — PR #135 prod deploy MO
- PR [#148](https://github.com/j4xie/my-prototype-logistics/pull/148) `883472557` — PR #135 24h soak runbook (repurposed smoke re-verify per PR #157)
- PR [#151](https://github.com/j4xie/my-prototype-logistics/pull/151) `66e9455bf` — Phase 2A retrospective
- PR [#155](https://github.com/j4xie/my-prototype-logistics/pull/155) — frontend impact verification (sister artifact)
- PR [#157](https://github.com/j4xie/my-prototype-logistics/pull/157) `45a71487b` — `SMARTBI_GOLD_READ_PRIMARY_ENABLED` flag flip investigation (Apr 23 Phase B intentional + PR #135 already deployed May 7) — **critical context for SmartBI/数据分析 cutover correlation in §3.2 Pattern E**
- PR [#158](https://github.com/j4xie/my-prototype-logistics/pull/158) `d7959715f` — PR #135 prod deploy MO pre-flight rehearsal AMBER finding (chat 3 amend per PR #157 root-cause)
- `MEMORY.md` index entry: "Apr 30 2026 — R67-R83 QA marathon SHIPPED" (mentions 14d follow-up agent fires 2026-05-14T13:00Z)

---

## Caveats

- **Memory drift risk**: 14 days post-checklist-draft, memory files may have new entries. The agent should verify each cited memory file is current at trigger fire time (per `feedback_organizer_projection_bug.md`: "Memory records can become stale over time").
- **Trigger config tied to this doc**: if this checklist is moved or renamed, the trigger needs reconfiguration. **Path stability**: `docs/superpowers/runbooks/2026-05-14-14d-customer-bug-density-followup-checklist.md` is intended to remain stable.
- **Customer roster currency**: 14-customer roster from PR #141 is current as of 2026-05-08; if customer churn / additions happen during the 14-day window, sales lead provides updated roster at trigger fire time.
- **Cutover stage tracking**: T6.4 5-stage cutover (May 10-14) is in flight when trigger fires; some stages may have completed, some pending. Agent must check `gh pr list --search "t6-4-stage" merged:>=2026-05-10` for current state.

Generated 2026-05-08 by organizer chat for May 14 trigger consumption. Doc-only deliverable; no prod state mutation during draft.
