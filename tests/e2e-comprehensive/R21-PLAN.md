# R21 — Comprehensive Re-Verify of All 20 Rounds (Live DevTools Sweep)

**Date**: 2026-04-16
**Trigger**: User requested re-verification of ALL 20 rounds' content via real browser window + devtools-level console monitoring.
**Skills**: `depth-first-e2e` (Rules 1-11) + `e2e-web-admin` (Layer 1-4 model).

---

## Part 1: Complete Round Inventory (R1-R20)

### Two work-lines, 20 rounds

```
┌─ Main line (R1-R20) ─────────────────────────────────────────────┐
│ R1-R5: L1/L2/L3/L4 framework buildout (12 roles × 94 routes)    │
│ R6+ : Deep-focused rounds, each targeting one workflow/bug      │
└─────────────────────────────────────────────────────────────────┘
┌─ Upload line (parallel) ──────────────────────────────────────────┐
│ upload-R1-R4: 500MB Excel upload depth E2E                       │
└─────────────────────────────────────────────────────────────────┘
```

### R1-R5 (Framework rounds — L1/L2/L3/L4 scripts)

| Round | Layer | What it tested | Script | Status |
|-------|-------|---------------|--------|--------|
| R1 | L1 | 12 accounts × 94 routes SPA navigation (router.push permission matrix) | `e2e-L1-spa-nav.mjs`, `e2e-L1-fast.mjs`, `e2e-L1-admin-only.mjs` | ✅ 12/12 accounts match permission matrix exactly |
| R1 | L2 | Dashboard + 6 module list tables (Customer/Supplier CRUD) | `e2e-L2-crud.mjs` | ✅ 9P/0F/2W |
| R1 | L3 | Customer→SO dropdown, Supplier→PO dropdown | `e2e-L3L4-flows.mjs` | ✅ 4/6 PASS (67%) |
| R1 | L4 | Finance/Analytics/SmartBI dashboards | `e2e-L3L4-flows.mjs` | ✅ 3/4 PASS (75%) |
| R2 | L2 | Customer create validation + Supplier persistence | `e2e-L2-crud.mjs` | ✅ 87.5% |
| R2 | L3 | 6 cross-module tests (expanded from 2) | `e2e-L3L4-flows.mjs` | ✅ 100% (12P/0F) |
| R2 | L4 | SO/PO creation + field verification | `e2e-L3L4-flows.mjs` | ✅ 100% (9P/0F) |
| R3 | — | L4-2 self-fulfilling prophecy fix per Critic | (in-suite) | ✅ commit `cdc53303d` |
| R4 | L2/L3L4 | Framework stability rerun | `e2e-L2-R4.json`, `e2e-L3L4-R4.json` | ✅ |
| R5 | L2/L3L4 | 91/91 PASS × 3 runs (framework closure) | `e2e-L2-R5.json`, `e2e-L3L4-R5.json` | ✅ |

**R1-R5 combined coverage**: 30+ L4 tests covering sales/purchase/finance/analytics smoke+medium.

### R6-R20 (Deep-focused rounds)

| Round | Focus | Script | Status | Key finding/fix |
|-------|-------|--------|--------|-----------------|
| R6 | Deep L4 standard (12-step checklist) — found customer rating null bug | `e2e-R6-deep.mjs` | ✅ | **Real bug caught**: `#rating < 1 OR #rating > 5` SpEL null-guard missing |
| R7 | Rating bug Rule 8 retroactive sweep — 13 broken + 5 defense-in-depth | (docs only) | ✅ | See `case-r7-rating-bug-sweep.md` |
| R8 | SO creation deep L4 (12 steps + product dropdown + multi-product) | `e2e-R8-so-chain.mjs` | ✅ | SO=¥5,000 verified |
| R9 | SO state machine: DRAFT→CONFIRMED, DRAFT→CANCELLED | `e2e-R9-so-state-machine.mjs` | ✅ R9-deep-7, R9-deep-9 |
| R9-deep-8 | CONFIRMED→PENDING_FINANCE_REVIEW→FINANCE_APPROVED | `e2e-R9-deep-8-finance-review.mjs` | ✅ |
| R10 | PO creation chain (supplier→PO + multi-material) | `e2e-R10-po-chain.mjs` | ✅ |
| R11 | Finance loop: SO→invoice→payment (¥5,000 consistent across 5 entities) | `e2e-R11-finance-loop.mjs` | ✅ |
| R12 | Multi-role auth-cache (TS→mjs port + rate-limit guard) | `e2e-R12-multirole-auth.mjs` | ✅ 13/13 |
| R13 | (skipped — promoted to R7 sweep) | — | — |
| R14 | SO finance REJECT path (symmetric to R9-deep-8) | `e2e-R14-so-finance-reject.mjs` | ✅ 14/14 |
| R15 | SO delivery Stage 1 (DRAFT delivery record) | `e2e-R15-so-delivery.mjs` | ✅ discovery: 3-stage architecture |
| R16 | SO delivery Stage 2/3 (ship + delivered) | `e2e-R16-so-ship-delivered.mjs` | ⚠ found **P0 batch-allocation UI gap** + P1 list.vue payload |
| R17 | Full 3-stage with FG batch allocation | `e2e-R17-so-full-3stage.mjs` | ✅ 15/15 after seed + M2 UI fix |
| R18 | Breadth — 16 customer bugs reproduction | `e2e-R18-breadth-16bugs.mjs` | 3 REPRO + Rule 11 created |
| R19 action | 10 bugs action-level probes | `e2e-R19-action-probes.mjs` | Agent 2 scope-crept → fixed Bug #5 + #9 |
| R19 breadth | 5 never-touched modules smoke | `e2e-R19-breadth-5modules.mjs` | ✅ 14/15 PASS (1 timeout) |
| R20 | MCP browser button-sweep — **NEW bugs found** | (live MCP, doc in `e2e-R20-mcp-button-sweep.md`) | F1 canvas F001 + F2 workflow 766 📦 |

### upload-R1-R4 (Parallel upload-line rounds)

| Round | Script | Focus | Status |
|-------|--------|-------|--------|
| upload-R1 | `e2e-upload-R1.mjs` | 500MB Excel baseline (5 smoke + 4 medium + 1 deep) | ✅ |
| upload-R2 | `e2e-upload-R2.mjs` | R1 follow-up | ✅ |
| upload-R3 | `e2e-upload-R3.mjs` | Upload depth extension | ✅ |
| upload-R4 | `e2e-upload-R4.mjs` | Upload chain closure | ✅ |

---

## Part 2: Bug fixes consolidated

### 16-bug customer report (2026-04-15) — fix status at R20

| # | Bug | Fix commit(s) | Deployed | Live R21 verify needed |
|---|-----|--------------|----------|------------------------|
| 1 | canvas-editor 403 | `5df51ffee` + `81246da78` (F1 sub-fix) | ✅ | YES |
| 2 | SmartBI 财务看板 canceled | `d176fbd9c` + `9bda316fe` | ✅ | YES |
| 3 | 经营驾驶舱 上传失败 | `d176fbd9c` (UX only; Java TBD) | ✅ partial | YES (UX + check BG error log) |
| 4 | 销售订单 role permission | — | — | NOT REPRO in our env |
| 5 | 出货记录 新建无反应 | `321897f82` | ✅ | ✅ already R20-verified |
| 6 | 角色管理 查看权限 404 | `53bd75d0a` | ✅ | ✅ already R20-verified |
| 7 | 工作流设计器 | `53bd75d0a` stub + `ef599eb41` + `f6c1bf23c` + `e11e767fe` (F2 root cause) | ✅ | YES (R20 found F2) |
| 8 | 手动同步 (POS) | — | — | P2 decision |
| 9 | 异常预警 解决 | `db3fef19e` | ✅ | ✅ already R20-verified |
| 10 | 新增配方 | `d176fbd9c` | ✅ | YES |
| 11 | 盘点 null | `d176fbd9c` | ✅ | YES |
| 12 | SmartBI 演示数据 | fixed by #2 | ✅ | YES |
| 13 | 导出报表 | `d176fbd9c` | ✅ | YES (do actual export click) |
| 14 | AI 问答超时 | `53bd75d0a` | ✅ | YES (issue actual query) |
| 15 | 查询模板 loading | `d176fbd9c` | ✅ | YES |

Plus **R20 findings**: F1 + F2 both deployed, must live-verify.

### Self-discovered bugs (non-customer) from R6-R20

- R6: customer rating null-guard in SpEL (fixed + Rule 8 swept in R7)
- R16: batch-allocation UI missing + list.vue quick-ship payload gap (fixed in M1+M2)
- R20: canvas-editor F001 hardcoded + workflow-designer 766 empty 📦 (fixed in R20-F1/F2)

---

## Part 3: R21 Live Sweep Plan

### Design principles (skill-compliant)

Per `depth-first-e2e`:
- **Rule 1**: every R21 finding gets a `depth` label (smoke/medium/deep)
- **Rule 2**: R21 must produce at least 1 new deep L4 test (candidate: a module not yet at `deep` — e.g., procurement/suppliers CRUD roundtrip)
- **Rule 3**: every test answered with "could this catch backend 500 / frontend crash / real bug?"
- **Rule 8**: if R21 catches a new bug, same-cause sweep MANDATORY before commit
- **Rule 11**: breadth coverage matrix updated for any module visited

Per `e2e-web-admin`:
- **Layer 1**: every route in coverage-matrix + newly-discovered = ~40-50 routes
- **Layer 2**: "新建" dialog smoke on each module (open + close, no submit)
- **Layer 3**: 3 proven cross-module points (customer→SO dropdown, supplier→PO dropdown, FG batch→delivery)
- **Layer 4**: live SO full 3-stage chain (R17 re-verify on live browser)

### DevTools-level monitoring

Every page visit captures via `page.on(...)`:
- `console` → errors/warnings only (filter Google Fonts noise)
- `response` → all status ≥ 400 (exclude 401 on initial nav)
- `pageerror` → uncaught exceptions
- `requestfailed` → aborted requests

Per-page record:
```
== /module/label ==
Console:  N errors, M warnings
Network:  X 4xx, Y 5xx (urls)
Page errors: Z
State: { menuRendered, tableRendered, has403, has404, title }
Actions taken: [click button X, filled field Y, ...]
Anomalies: [...]
```

### Coverage target

| Layer | R21 target | Pages/tests |
|-------|------------|-------------|
| Layer 1 page-scan | 40-50 routes | Every covered module + procurement/suppliers, smart-bi/overview, smart-bi/dashboard, /system/users, /system/settings, /system/ai-intents, /system/skill-tools, /rd/samples, /transfer/requests, /scheduling/plans, etc. |
| Layer 2 CRUD smoke | 15-20 dialogs | Every module with 新建 button: customers, orders, shipments, suppliers (PO), materials, recipes (expect 403 on FACTORY), stocktaking (same), employees, departments, quality inspections, equipment, etc. |
| Layer 3 cross-module | 3 flows | SO dropdown → customer+product, PO dropdown → supplier, Delivery → FG batch FIFO |
| Layer 4 business chain | 1 full SO flow | Customer → SO → confirm → delivery → batch → ship → delivered |
| Bug re-verify | 16 bugs | Every open `YES` row in §Part 2 table |

### Exit criteria

R21 is complete when:
1. Every route in consolidated coverage list visited in live Chrome ≥ once
2. Every bug fix in §Part 2 has REPRO / NOT_REPRO / PASS verdict recorded
3. R21-specific findings (new bugs surfaced) → written with severity + file:line + repro steps
4. `coverage-matrix.md` updated with R21 depth upgrades
5. Results saved to `results/e2e-R21-devtools-sweep.md`
6. At least 1 new deep L4 test documented (Rule 2)

### Rule 11 matrix update semantics

After R21:
- Any module that showed: page load OK + interactive button-click OK → stays at current depth or upgrades to `smoke-interactive`
- Any module with actual CRUD submit success → upgrades to `medium`
- SO full 3-stage live on browser → remains `deep` (R17 scripted already covered)

---

## Part 4: Execution TodoList

See Claude Task system #T1-#T6. Plan doc cross-referenced.

**Order of execution**:
1. **T1 — Deploy verify** (R20-F1 + R20-F2 live check). If FAIL, redeploy before continuing (Rule 10).
2. **T2 — Layer 1 page scan** (40-50 routes, batched 5-10 pages between console flushes).
3. **T3 — Layer 2 CRUD smoke** (open dialog, inspect, close — don't create data).
4. **T4 — Layer 3 cross-module dropdown verification**.
5. **T5 — Layer 4 full SO business chain live-walk**.
6. **T6 — R21 report + coverage-matrix update + commit**.

### Context efficiency

Per-page snapshot = ~500-1000 tokens. 40 pages = 20-40k context. Will batch-report every 5-10 pages to avoid context bloat.

Use `browser_evaluate` returning compact structured data (not full snapshots) for per-page inspection when snapshot not needed.

---

## Changes from prior R21-PLAN.md

Previous version only acknowledged "R1-R20" superficially. This version properly enumerates:
- R1-R5 framework rounds (L1/L2/L3/L4 scripts + JSON results)
- R6-R20 deep rounds (16 scripts + JSON results + key findings)
- upload-R1-R4 parallel line
- All 16 customer bugs + their fix commits + deploy status
- R20 F1/F2 findings

Total scope captured: **20 rounds + 4 upload rounds + 16 customer bugs + 4 self-discovered bugs**.
