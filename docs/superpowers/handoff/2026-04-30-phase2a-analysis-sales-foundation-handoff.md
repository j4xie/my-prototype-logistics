# Phase 2A `/analysis/sales` Foundation Handoff (next chat — implementation)

| Field | Value |
|---|---|
| **Status** | Plan-driven kickoff complete; ready for foundation implementation |
| **Branch** | `phase2a/t5-poc` (19 commits ahead of origin/main, NOT pushed) |
| **Worktree** | `C:\Users\Steve\my-prototype-logistics\.worktrees\phase2a-t5-poc` |
| **Last commit** | `473d36f9a` foundation plan |
| **Phase 2A counter** | 5/50 endpoints shipped pre-port; sales port is endpoint #6 |

---

## What was done tonight

Single chat covered: brainstorming → 7 design sections → 5 specs (with self-review + Q1=C completion + Q3=B 4-spec decomposition + Q5=B new file + Q7 Gold path port discovery → 5th spec added + Q8 calibration goldens approved) → foundation plan.

| Artifact | Size | Path |
|---|---|---|
| foundation spec | 743 LOC | `docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-foundation-design.md` |
| overview spec | 633 LOC | `docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-overview-design.md` |
| rankings spec | 628 LOC | `docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-rankings-design.md` |
| trend spec | 455 LOC | `docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-trend-design.md` |
| gold spec | 489 LOC | `docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-gold-design.md` |
| foundation plan | 2377 LOC | `docs/superpowers/plans/2026-04-30-phase2a-analysis-sales-foundation.md` |
| **Total** | **5325 LOC** | 4 commits on `phase2a/t5-poc` |

Commits added tonight:
```
473d36f9a docs(phase2a): foundation plan for /analysis/sales port
015d464b3 docs(phase2a): lock Q8=yes (calibration goldens approved)
9a3602759 docs(phase2a): add gold sub-spec for /analysis/sales (4 specs → 5 specs)
082021cb0 docs(phase2a): 4 sub-specs for /analysis/sales port
```

---

## How to start the new chat

Paste this into a fresh chat:

```
Phase 2A foundation 实施 — 跟 alerts marathon chat 2 一样的 subagent-driven 模式.

当前在 phase2a/t5-poc 分支
(C:\Users\Steve\my-prototype-logistics\.worktrees\phase2a-t5-poc),
HEAD=473d36f9a (foundation plan committed).

读这两个文件入手:
- docs/superpowers/handoff/2026-04-30-phase2a-analysis-sales-foundation-handoff.md
- docs/superpowers/plans/2026-04-30-phase2a-analysis-sales-foundation.md (2377 行 22 tasks)

任务: 用 superpowers:subagent-driven-development 跑完 foundation plan 的
22 tasks. F999 contract test PASS = 完成. 估时 3-4h.

开始时确认 worktree + branch + clean status (per plan pre-flight check),
然后从 Task A.1 派第一个 subagent.
```

---

## Key context the new chat needs

### 1. Worktree pre-flight (plan §pre-flight check)

```bash
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc
pwd                              # /c/Users/.../.worktrees/phase2a-t5-poc
git rev-parse --abbrev-ref HEAD  # phase2a/t5-poc
git log --oneline -1             # 473d36f9a docs(phase2a): foundation plan
git status --short               # (no output)
```

If any check fails, STOP and reconcile before proceeding.

### 2. The 5 architectural decisions locked tonight (Q1-Q8)

| Q | Decision | Reason |
|---|---|---|
| Q1 | **C "完整"** — full byte-shape match on F999 + F001 (real business logic, not stubs) | User goal |
| Q3 | **B 4-spec decomposition** — foundation + overview + rankings + trend (later expanded to 5 with gold) | Logical units, plan-fits-in-context |
| Q4 | **B** — write all specs tonight + foundation plan only; sibling plans deferred to their exec chats | Calibration: alerts marathon kickoff did same |
| Q5 | **B** — new file `analysis_sales.py` (not append to `analysis.py`) | concurrent-edit-safety + clean separation |
| Q7 | **(a)** — port Gold path, NOT recreate F001 golden with Gold disabled | Match prod fidelity (Q1 implication) |
| Q8 | **YES** — seed synthetic `smart_bi_sales_data` rows for F001 so rankings/trend can byte-test non-empty paths | Approved 2026-04-30 |

### 3. Critical findings from Java exploration

- **F001 is a restaurant tenant** — KPI cards are 餐饮: total_revenue / bill_count / avg_bill_value / store_count (NOT 制造 metrics)
- **F001 overview comes from Gold path** (`GoldDashboardBuilder.buildFromGoldWithCharts`), not legacy `getSalesOverview`
- **Python Gold infrastructure ALREADY EXISTS** — `backend/python/smartbi/gold/queries.py` (`finance_summary` / `daily_trend` / `top_products` / `kpi_summary`). gold spec adapter just calls these via direct import (no HTTP self-call).
- **F001 legacy SQL window has 0 rows in 2025** — that's why F001 golden's salesperson/product/customer ranking + trendChart.data are all `[]`
- **Java HashMap iteration ≠ Java result.put() order** — F999 golden composite key order: `overview / customerRanking / productRanking / dateRange / salespersonRanking / generatedAt / trendChart`. Python must construct dict in this exact order (insertion-ordered).
- **RankingItem has 6 declared fields, NO derived getters** (rankings agent direct file read): rank/name/value/target/completionRate/alertLevel. completionRate is dual-purpose (target completion for salesperson, share-of-total percentage for product/customer; product/customer leave target null).
- **ChartConfig key uses lowercase** `xaxisField` / `yaxisField` (not `xAxisField`) — Jackson demangles Lombok getter `getXAxisField()` to `"xaxisField"`. F999 golden confirms.
- **WEEK bucket key format** is Monday-of-week date `YYYY-MM-DD`, NOT ISO `YYYY-Www`. Java uses `previousOrSame(MONDAY).toString()`. (trend spec only ports DAY anyway, but documented for future.)
- **Java BigDecimal scale**: `SCALE=4` intermediate, `DISPLAY_SCALE=2` final, `ROUND_HALF_UP`. Python `Decimal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)` matches.

### 4. Cross-cutting changes propagated across all 5 specs

- **All sub-services + composite + route are `async def`** — gold spec needs `await` for Gold queries. Sync SQLAlchemy calls wrapped via `await asyncio.to_thread(...)` (foundation Phase B.6 confirms strategy).
- **KPICard factory in foundation, NOT overview** — gold + overview both consume; foundation owns to break dependency cycle.

### 5. Foundation merge gate

Foundation merge is complete when `tests/python/smartbi_compat/test_analysis_sales_contract.py::TestEnvelope::test_F999_empty_state_byte_shape` PASSES. This is the single most important assertion.

---

## Plan structure summary

22 tasks across 6 phases, 3-4h estimate:

```
Phase A — Pre-impl verification (4 tasks, 30-45 min)
  A.1: psql verify F001 Gold data + legacy 0 rows
  A.2: Verify DateRange has days/valid; add if missing
  A.3: javap 5 Java DTOs (DashboardResponse / RankingItem / ChartConfig / AIInsight / KPICard)
  A.4: Async/sync bridge smoke test

Phase B — SQL helper extension (1 task, 15 min)
  B.1: Extend _query_sales_data with order_date column + regression check

Phase C — DTO factories (8 tasks, 60-90 min) — TDD throughout
  C.1: Scaffold analysis_sales.py module
  C.2: _strip_volatile shared helper
  C.3: _new_date_range_dict factory (7 fields)
  C.4: _new_dashboard_response_dict factory (16 fields)
  C.5: _new_ranking_item_dict factory (6 fields)
  C.6: _new_chart_config_dict factory (7 fields)
  C.7: _new_ai_insight_dict factory (5 fields)
  C.8: _new_kpi_card_dict factory (13 fields)

Phase D — Stubs + composite + route (4 tasks, 30-45 min)
  D.1: 5 async sub-service stubs (F999 empty shape)
  D.2: _get_comprehensive_sales_analysis composite (Jackson key order)
  D.3: Async route handler
  D.4: Register router in main.py

Phase E — F999 contract test (3 tasks, 30 min)
  E.1: test_analysis_sales_contract.py skeleton + fixtures
  E.2: 4 envelope tests (route/JWT/isolation/dimension)
  E.3: F999 byte-shape gate test (THE merge criterion)

Phase F — Verification (3 tasks, 15-30 min)
  F.1: scripts/phase2a/record-analysis-sales-goldens.sh
  F.2: Full pytest + 0-regression check
  F.3: Optional test env deploy + smoke
```

---

## Subagent-driven execution recipe

For each task in the plan:

1. **Read the task** in plan file (e.g. Task C.4 with all 5 steps)
2. **Dispatch fresh subagent** with prompt:
   - "Execute Task C.4 from `docs/superpowers/plans/2026-04-30-phase2a-analysis-sales-foundation.md`. Follow ALL 5 steps verbatim. Use TDD (write failing test, implement, run test, commit). Use `git commit ... -- <paths>` (--only mode) per concurrent-edit-safety rule 5b. Report which steps passed and any deviations."
3. **Review the subagent's output**:
   - Did the test fail before implementation? (TDD compliance)
   - Did the test pass after implementation?
   - Did the commit message match plan + scope only the listed paths?
4. **Run a verification command** to confirm reality (e.g. `git log -1 --stat` + `pytest <file>`)
5. **Move to next task**

If a task fails or surfaces a new issue (e.g. javap reveals more KPICard fields than spec assumed), pause and either:
- Fix inline (small drift)
- Update spec + plan + re-commit (large drift) before continuing

---

## Sibling spec sequence (post-foundation)

Foundation merge → execute in this order:

1. **gold spec** (~2-3h) — Gold-path adapter; F001 overview byte-shape achievable
2. **overview spec** (~3-4h) — Legacy fallback path (only fires if Gold returns null/error)
3. **rankings spec** (~2-3h) — 3 ranking sub-services + Python-side sort fix + Q8 synthetic data seed + F001 golden re-record
4. **trend spec** (~1.5-2.5h) — DAY-only port + Q8 synthetic data seed + F001 golden re-record

**Each in own chat** (per concurrent-edit-safety rule 2 / sub-worktree alternative). Recommend gold first because it unblocks F001 byte test for overview field.

Total endpoint scope: 11.5-16.5h after foundation lands.

---

## Risk register quick-reference

| # | Risk | Owner |
|---|---|---|
| R1 | Java HashMap unstable sort → F001 golden tie order varies | rankings spec (Python secondary key fix) |
| R2 | KPICard derived getters may differ from spec assumption | foundation Task A.3 (javap) |
| R3 | BigDecimal precision drift | overview/rankings (Decimal.quantize HALF_UP) |
| R4 | Chinese AI insight string templates | overview spec (1:1 port) |
| R5/R11/R12 | F001 data shape (Gold path + empty legacy SQL) | gold + rankings + trend |
| R6 | Concurrent edit on `analysis_sales.py` | sequential execution recommended |
| R7 | Foundation freeze breaking sibling specs | gate before sibling specs proceed |
| R8 | `_query_sales_data` extension may break alerts | regression check Task B.1 step 3 |
| R9 | Composite key order = F999 Jackson order, not Java put order | foundation §3 + Task D.2 step 1 test |
| R10 | period/lastUpdated subtle nulls | overview spec (Java source read) |
| R13 | Async signatures cascade | foundation §5 + Task A.4 bridge confirm |

---

## Memory checkpoint for tonight's session

Tonight's session is a self-contained plan-driven kickoff modeled on alerts marathon's chat 1. Total artifacts: 5 specs (2948 LOC) + 1 plan (2377 LOC) = 5325 LOC across 4 commits, all on `phase2a/t5-poc` branch (NOT pushed origin). Foundation implementation gates F999 contract test PASS. Sibling specs ready but plans deferred until their respective execution chats.

End of handoff.
