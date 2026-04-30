# Phase 2A `/alerts` Spec + Plan Complete — Handoff

> **For chat 2**: copy the fenced block at the bottom into a fresh chat as your first message.

---

## What was done in this session (2026-04-29 evening, /alerts marathon kickoff)

This chat used `superpowers:brainstorming` → `superpowers:writing-plans` to produce a complete spec + plan for the `/alerts` full port. **No implementation** — chat scope was locked at "spec + plan only" via Q1 decision.

### Commits on `phase2a/t5-poc`

| SHA | Description | Lines |
|-----|-------------|-------|
| `38f4c1ccf` | `docs(phase2a): /alerts full port design spec (brainstorm output)` | 499 |
| `41f41fe2e` | `docs(phase2a): /alerts full port implementation plan (writing-plans output)` | 2445 |

### Files produced

- **Spec**: `docs/superpowers/specs/2026-04-29-alerts-full-port-design.md` — 11 sections (status / context / goals / architecture / components / testing / plan structure / risks / deferrals / cross-refs / acceptance criteria)
- **Plan**: `docs/superpowers/plans/2026-04-29-alerts-full-port.md` — 14 tasks across 5 phases, ~120 TDD steps with full code snippets (write failing test → run fail → implement → run pass → commit)

### Brainstorm decisions captured (5 Qs answered)

| # | Question | Choice | Rationale |
|---|----------|--------|-----------|
| Q1 | Scope of this chat? | (a) Full spec + plan, no code | Apr 28 餐饮 B-1 marathon (33 subagent calls) showed spec stability matters more than fast start |
| Q2/Q3 | Factory for golden recording? | (a) Synthetic F999 + ADR | F001 has no smart_bi seed (verified); DEMO_FACTORY has data but no factories row → JWT auth fails. F999 is cleanest precedent for the ~10 remaining 1000+ LOC analysis-subdomain endpoints. |
| (mechanical) | Threshold strategy? | Bundle JSON + CI diff guard | Java's runtime path reads `classpath:config/smartbi/alert_thresholds.json`, NOT the `smart_bi_alert_thresholds` PG table (verified: values diverge — JSON has `growth_red=-20`, PG has `-10`; `aging_red=90` vs `60`; etc). Two parallel systems, must match Java's actual behavior. |
| Q5 | Byte-shape under HashMap iteration? | (b) Sort-before-emit (TreeMap) + Python sort + ADR | Goldens stay stable across JVM restarts; eliminates latent customer-facing non-determinism; small Java change aligns with Phase 2A "small touch-ups OK" pattern (handoff §1 enum bug fix already planned). |
| (approach) | Marathon sequencing? | (2) Sales-first as deep precedent + bulk rest | Calibrates Phase 2A 256h estimate in chat 2 (1 full generator + foundation = real wallclock); chat 3 (finance+dept+aggregator) follows proven pattern. |

### Findings worth tracking (discovered during code exploration)

1. **Threshold system disconnect** (Java codebase):
   - `RecommendationServiceImpl.loadAlertThresholds()` reads `classpath:config/smartbi/alert_thresholds.json` (file exists, 2988 bytes).
   - `smart_bi_alert_thresholds` PG table (migration `V2026_01_21_02`) has different values + different metric naming + extra PRODUCTION/QUALITY categories.
   - Two unrelated alert systems coexist in Java codebase. Python port mirrors the JSON-file system to match Java's actual `/alerts` behavior.

2. **DEMO_FACTORY / F_DEMO mismatch** (Java latent bug):
   - `V2026_01_18_02__smart_bi_sample_data.sql` seeds rich data under `factory_id='DEMO_FACTORY'`.
   - But `SmartBIPublicDemoController.java:41` defines `DEMO_FACTORY_ID = "F_DEMO"` (string mismatch).
   - And no `INSERT INTO factories ('DEMO_FACTORY', ...)` exists anywhere → DEMO_FACTORY data is orphaned (Java demo path likely returns empty).
   - Out of scope for /alerts marathon; track for Phase 3 cleanup.

3. **HashMap iteration risk** (only 2 sites in `RecommendationServiceImpl`):
   - Sales generator line ~236: `Collectors.groupingBy(::salespersonName, Collectors.reducing(...))` → HashMap → non-deterministic per-salesperson alert order
   - Department generator line ~392: same pattern with `::department`
   - Finance generator iterates a List from repository → already stable
   - Aggregator already sorts by `AlertLevel.severity` DESC → deterministic at outer layer
   - Fix: TreeMap supplier in groupingBy. 2 single-arg additions per site.

### Open backlog (none — clean close-out)

This chat produced no code. There are no open backlog items from spec/plan work itself. All implementation work tracked in the plan as Phase A → E tasks.

---

## State to verify at chat 2 start

```bash
cd C:\Users\Steve\my-prototype-logistics\.worktrees\phase2a-t5-poc
git status --short                     # expect clean
git log --oneline -10                  # last 2 commits should be 41f41fe2e + 38f4c1ccf
ls docs/superpowers/specs/2026-04-29-alerts-full-port-design.md
ls docs/superpowers/plans/2026-04-29-alerts-full-port.md
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -v
# Expect: 18 passed (no regressions from spec/plan commits — only docs changed)
```

If `git status` shows untracked or modified files: another session was active during your chat start; investigate before doing anything destructive (per `.claude/rules/concurrent-edit-safety.md`).

---

## Reference reading (read before starting chat 2)

In order:
1. `docs/superpowers/specs/2026-04-29-alerts-full-port-design.md` (499 lines) — full spec
2. `docs/superpowers/plans/2026-04-29-alerts-full-port.md` (2445 lines) — implementation plan
3. `docs/superpowers/handoff/2026-04-29-phase2a-batch-2-handoff.md` — prior chat's handoff (Phase 2A foundations: main:app try/except, importlib fixture, 5-key envelope I-6 fidelity)

---

## Phase 2A counter

- Currently shipped: **3 of 50** endpoints (data-date-range PoC + query-templates + datasource-list)
- After /alerts marathon (chat 2 + chat 3): **3 of 50** still — `/alerts` is 1 endpoint with 4 entry points; all share one route (counted as 1 in the 50)
- After: **4 of 50** with calibration data point that refines remaining 46 estimates

---

## Fenced block to paste into chat 2

```
继续 Phase 2A /alerts marathon — chat 2 (Phase A + B). Spec + plan 已完，本 chat 实施 foundation + sales generator。

## 状态
工作目录：`C:\Users\Steve\my-prototype-logistics\.worktrees\phase2a-t5-poc`
分支：`phase2a/t5-poc`

## 输入文档（读这两份）
- Spec: `docs/superpowers/specs/2026-04-29-alerts-full-port-design.md` (499 行)
- Plan: `docs/superpowers/plans/2026-04-29-alerts-full-port.md` (2445 行 / 14 task / ~6-8 commit)
- Prior handoff: `docs/superpowers/handoff/2026-04-29-phase2a-alerts-spec-plan-handoff.md`

## 本 chat 范围（plan Phase A + B = 9 task）
Phase A (foundation, 6 task):
- A1: F999 migration (factories + users + smart_bi seed copy from DEMO_FACTORY)
- A2: Java sort fix (TreeMap supplier on sales + department generators) + 2 unit tests
- A3: Bundle alert_thresholds.json to Python + CI parity guard workflow step
- A4: Python alert_thresholds.py loader + 3 unit tests
- A5: Python date_range.py (month period only) + 5 unit tests
- A6: Deploy test env + 4-way smoke verify

Phase B (sales generator + chat 2 close, 3 task):
- B1: Sales generator port (3 alert types via TDD, ~17 plan steps)
- B2: Sales route + contract test + golden record (SSH tunnel + recorder wrapper)
- B3: F999 ADR

Total: ~6-8 commits, finishing with `superpowers:verification-before-completion` skill on chat 2 milestone.

## 执行模式选择
a) **subagent-driven** (推荐) — 每 task 一个 fresh subagent，task 间 review，快速迭代
b) **inline** — 用 `superpowers:executing-plans` skill 内联跑 + checkpoint review

## 关键 rules
- 并发安全：每个 commit 后 `git show --stat HEAD` 自检 scope，path-explicit `git commit -- file1 file2`
- TDD 严格：write fail test → run fail → implement → run pass → commit (per task 5 步)
- F999 password 走 env var：`PHASE2A_TEST_USER_PASSWORD_HASH` 在 `.env.test` 是 bcrypt hash，`.env.prod` 是 `DISABLED`

## 当前状态验证

```bash
cd C:\Users\Steve\my-prototype-logistics\.worktrees\phase2a-t5-poc
git status --short                     # expect clean
git log --oneline -3                   # 41f41fe2e plan / 38f4c1ccf spec / e3174f787 batch-2 handoff
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -v
# Expect: 18 passed
```

请告诉我你选 (a) subagent-driven 还是 (b) inline，然后开始 A1。
```
