# Phase 2A Batch 2 Complete — Handoff

> **For the next chat**: copy the fenced block at the bottom into a fresh chat as your first message.

---

## What was done in this session (Apr 29 2026, batch 2)

The chat re-scoped the Apr 29 PoC handoff candidates after investigation, then shipped 2 endpoints + the foundational unblocks needed to test against the production main:app and emit a Java-byte-shape envelope.

### Commits on `origin/main` (in chronological order)

| SHA | Message |
|-----|---------|
| `5668da4de` | fix(phase2a): unblock main:app for contract tests |
| `8851e32c3` | feat(phase2a): full 5-key envelope fidelity (I-6) |
| `b15b71dc3` | docs(phase2a): scheduled deferred endpoints from Apr 29 batch chat |
| `29e0ee773` | feat(phase2a): port GET /query-templates (T5b) |
| `455f27501` | fix(phase2a): add row_to_dict unit tests (T5b spec-review fix) |
| `a339b4de6` | fix(phase2a): annotate _row_to_dict row param (T5b code-review I1) |
| `86aff34ef` | feat(phase2a): port GET /smart-bi/datasource/list (T5c) |

7 commits, all on `origin/main`. Test suite: **18 passed** (5 jwt middleware + 3 aggregator + 10 contract + smartbi_compat helpers).

### Foundational unblocks landed

1. **`backend/python/main.py:755` try/except wrap** — `llm_router_admin` lives on a parallel branch; without the guard `from main import app` failed at import time. Now optional, same pattern as the SmartBI compat block at line 898.

2. **Test fixture: production main:app via importlib by absolute path** — `from main import app` was ambiguous because pytest's conftest adds `backend/python/smartbi/` to sys.path and that directory also contains a legacy `main.py`. Resolving by absolute path forces the production entry point regardless of sys.path order.

3. **5-key envelope fidelity (I-6)** — `wrap_response` and `wrap_error` in `schema_compat.py` now emit `{code, message, data, timestamp, success}` matching Java's `ApiResponse.success()` / `error()` shape exactly. Recorder (`scripts/phase2a/record-java-golden.mjs`) updated to capture `code` and `timestamp` for future re-records.

### Endpoints ported

- `GET /api/mobile/{factory_id}/smart-bi/query-templates` — list saved query templates from `smart_bi_query_templates` (BaseEntity + 7 fields, 11-key Jackson order, `deleted` derived from `deletedAt is not None`).
- `GET /api/mobile/{factory_id}/smart-bi/datasource/list` — list active datasources from `smart_bi_datasource` (BaseEntity + 14 fields, 17-key Jackson order, `fieldDefinitions` always `[]` because the `@OneToMany` is lazy and never loaded).

Both follow the dashboard.py PoC pattern: route handler + module-level `_query_*` DB seam (lazy `smartbi.database.connection` import, `is_postgres_enabled()` gate) + `_*_row_to_dict` helper (Jackson key order). All in `backend/python/smartbi_compat/api/analysis.py`.

### Workflow used

1. `superpowers:using-superpowers` (system load)
2. `superpowers:test-driven-development` (each impl)
3. `superpowers:subagent-driven-development` for the batch:
   - Endpoint 1: implementer → spec reviewer (DONE_WITH_CONCERNS, raised tautology issue) → fix-loop subagent (added `_row_to_dict` direct unit tests) → spec re-review (✅) → code-quality reviewer (Approve with fixes; raised I1 row typing) → fix-loop subagent (added `: Any` annotation). Total 6 subagent calls.
   - Endpoint 2: implementer → spec reviewer (✅) → code-quality reviewer (✅ Approve, 0 Critical/Important). Total 3 subagent calls. Implementer carried over endpoint 1's lessons; no fix loops.

---

## Scope reality discovered this chat

The original handoff (Apr 29 PoC complete) listed 4 candidate endpoints for batch 2:
1. `/alerts`
2. `/analysis/finance/budget-achievement`
3. `/analysis/finance/yoy-mom`
4. `/analysis/finance/category-comparison`

All four turned out to be far more complex than T0 estimated:

- `/alerts` — backed by `RecommendationServiceImpl` 998 LOC; 3 alert generators × ~200 LOC each + threshold config. Empty-pass-through port would be a sham (would silently break for any factory with real data after T6 cutover).
- The 3 finance endpoints — Java exposes them as GET with query params; Python `smartbi/api/analysis.py` already has POST routes with the SAME path and DIFFERENT request body shape (`BudgetAchievementByPeriodRequest` etc.). The "Python equivalent already exists" hint in the original handoff did not mean "thin proxy" — it meant "parallel implementation with different shape." Alias would need GET→POST bridging + response reshape into Java's `ChartConfig` envelope.

When I went looking for replacement Z-class candidates, **only 2 truly thin endpoints existed in the corpus**:
- `GET /query-templates` (shipped)
- `GET /smart-bi/datasource/list` (shipped)

Every other read-path GET in `SmartBIAnalysisController` is backed by a 1000+ LOC service:
- `/analysis/procurement` — `ProcurementAnalysisServiceImpl` 1144 LOC
- `/analysis/region` — `RegionAnalysisServiceImpl` 1209 LOC
- `/recommendations` — `RecommendationServiceImpl` 998 LOC
- `/alerts` — same service, different generators
- `/analysis/department` `/analysis/sales` `/analysis/finance` `/analysis/production` `/analysis/quality` `/analysis/inventory` — each its own large service generating `DashboardResponse`

**Implication**: the original Phase 2A 256h estimate is likely **off by 2-3×** for the analysis subdomain. T0 classified these as Z because the controller method bodies are short — but the services they delegate to are not thin. The right model is "1 endpoint = 1-2 days" for analysis-domain endpoints, not "1 endpoint = 30-60 min."

Documented in `docs/superpowers/plans/2026-04-29-phase2a-batch-deferred-endpoints.md` §4 (updated this chat).

---

## Next chat — pick ONE of these three workstreams

The deferred plan doc lists 6 sections of work; below are the three highest-leverage starting points.

### Option A — Java enum bug fix (cheapest, unblocks 2 endpoints)

**What**: `GET /uploads` and `GET /uploads-missing-fields` recorded as Java errors:
- `Get upload history failed: No enum constant [内部错误]`
- `Diagnose failed: No enum constant [内部错误]`

`Enum.valueOf()` is being called on a free-text Chinese string from the DB. Fix path: locate the call site in `SmartBiUploadController` / its service, switch to `safeValueOf` or `EnumUtils.getEnum`, add a unit test with a row that has the trigger value, re-record both goldens via `node scripts/phase2a/record-java-golden.mjs`, then port the Python aliases (probably 30-60 min each, both are list endpoints).

**Estimate**: 1-2 hours Java fix + 1 hour re-record + 1 hour Python port = half a day.

**Deliverable**: 2 more endpoints shipped + a documented fix on the Java side that benefits both the alias and any direct Java consumers.

### Option B — Test data seed scaffolding (medium cost, unblocks 4 endpoints)

**What**: 4 endpoints rely on a real `smart_bi_pg_excel_uploads` row in the test DB:
- `POST /generate-adaptive-charts`
- `POST /generate-chart`
- `POST /retry-sheet/{uploadId}`
- `POST /upload/confirm`

Recorder used `uploadId: '1'` as a placeholder, which doesn't exist for F001 → goldens are all "Upload not found: 1" errors.

**Approach**: add a pre-record bootstrap to `scripts/phase2a/record-java-golden.mjs` that uploads a small fixture Excel via the multipart endpoint, captures the returned uploadId, threads it through the 4 endpoint definitions. Cleanup afterward (or use a dedicated test factory whose state can be reset).

**Estimate**: 2-3 hours seed scaffolding + 30-60 min Python alias each (4 endpoints) = a full day.

**Deliverable**: 4 more endpoints shipped + reusable upload-seed fixture for the rest of the batch.

### Option C — `/alerts` full port as a real-business-logic precedent

**What**: Port `RecommendationServiceImpl.generateAllAlerts` to Python, faithfully (not a stub). 3 generators (sales / finance / department), each ~200 LOC business logic with threshold config.

**Approach**: 1 generator at a time, separate commits. Externalise thresholds (Java reads `salesCompletionRedThreshold` etc. from `application.yml` — Python should read from same env / config layer or a Phase 2A config helper). Add contract tests against factories WITH data, not just F001's empty case.

**Estimate**: ~1 week (3 generators × 1-2 days each + threshold config story + ADR for "factory-with-data" golden recording).

**Deliverable**: 1 more endpoint shipped + a precedent for porting the other ~10 large-service analysis endpoints + an ADR covering "factory-with-synthetic-data" golden recording.

---

## Carried-over backlog from the PoC

These were flagged in the Apr 29 PoC review and not addressed in this batch (the batch was the wrong place for them):

- **I-4** sham route registration test — add `tests/python/smartbi_compat/test_route_registration_smoke.py` parametrised over alias paths. Cheap, catches typo / refactor breakage.
- **I-5** lazy import inside `_query_*` defeats module-level mocking. Move imports to module top with `try/except ImportError` so tests can monkey-patch `dashboard.get_db_context`. (Not strictly needed because the current pattern `monkey-patches `_query_*` itself, not the underlying module — but flagged.)
- **I-7** Java 200/success=false vs Python 500 — add route-level try/except mirroring Java's `ApiResponse.error(...)` shape, gated on whether the golden has `_serverSuccessFalse=true`. Becomes load-bearing if we port the Java-broken endpoints (uploads, uploads-missing-fields) before Java is fixed.

These are ~1 hour each. Bundle into a single cleanup commit at the start of the next chat or the end of whichever workstream you pick.

### Plus from endpoint 2 code review (Minor only, all tracking)

- **M-1** SQL `is_active = TRUE` semantics differ from Java on NULL — defensible but worth a 1-line comment.
- **M-2** Contract test message comparison may pass for the wrong reason on Windows console encoding garbling. Verified shape is correct in production; the issue is human-eyeball-only.
- **M-3** `connectionConfig` may diverge from Java if SQLAlchemy reads the JSON column as `dict` (not string) under the project's PG driver. Add a third unit test with a `dict` mock-row to catch.
- **M-4** Add a "module convention" header comment to `analysis.py` codifying the "triplet pattern" (helper / seam / route) for endpoint 3+.
- **M-5** `List[dict]` return type is loose. A `TypedDict` for each entity shape would catch dict-key drift at type-check time.
- **M-6** Docstring inconsistency between `analysis.py:69` and `dashboard.py:57` on the production-call sentence — fold to a shared module-level note when a third endpoint lands.

---

## State to verify on chat start

```bash
cd C:\Users\Steve\my-prototype-logistics\.worktrees\phase2a-t5-poc
git status --short                          # expect clean
git log --oneline -8                        # last 7 commits should match table above
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -v
# Expect: 18 passed
```

If `git status` shows untracked or modified files: another session was active during your chat start; investigate before doing anything destructive (per `.claude/rules/concurrent-edit-safety.md`).

---

## Fenced block to paste into next chat

```
继续 Phase 2A SmartBI 迁移 batch rollout。下面是完整背景。

## 项目

Cretas 食品溯源系统 Python migration Phase 2A：把 50 个 Java SmartBI 端点切到 Python alias 实现。

工作目录：`C:\Users\Steve\my-prototype-logistics\.worktrees\phase2a-t5-poc`
当前分支：`phase2a/t5-poc` （已 merged 到 origin/main）

## 已完成 (Apr 29 batch 2)

7 commits 已 ship origin/main：
- `5668da4de` fix(phase2a): unblock main:app for contract tests
- `8851e32c3` feat(phase2a): full 5-key envelope fidelity (I-6)
- `b15b71dc3` docs(phase2a): scheduled deferred endpoints
- `29e0ee773` feat(phase2a): port GET /query-templates (T5b)
- `455f27501` fix(phase2a): add row_to_dict unit tests
- `a339b4de6` fix(phase2a): annotate _row_to_dict row param
- `86aff34ef` feat(phase2a): port GET /smart-bi/datasource/list (T5c)

测试：18 passed (5 jwt + 3 aggregator + 10 contract/unit). 总进度: 3 of 50 endpoints (data-date-range PoC + query-templates + datasource-list).

## 关键 scope reality (Apr 29 chat 发现)

T0 把许多 /analysis/* 标 Z 因为 controller 方法体短，但服务层 1000+ LOC：
- /analysis/procurement → ProcurementAnalysisServiceImpl 1144 LOC
- /analysis/region → RegionAnalysisServiceImpl 1209 LOC
- /recommendations → RecommendationServiceImpl 998 LOC
- /alerts → 同上, 3 generators × 200 LOC
- /analysis/finance/* → Python 已有同名 POST 但 request shape 不同, 需 GET→POST bridge

Phase 2A 256h 估算对 analysis subdomain 可能低估 2-3×。

详见：
- `docs/superpowers/plans/2026-04-29-phase2a-batch-deferred-endpoints.md` (deferred 列表 §1-§5)
- `docs/superpowers/handoff/2026-04-29-phase2a-batch-2-handoff.md` (本文档)

## 第一步必做

读上面 2 个 doc, 然后在 3 个 workstream 中选一:

A) **Java enum bug fix** — 修 SmartBiUpload 服务的 Enum.valueOf 失败, 重录 uploads + uploads-missing-fields golden, 然后 port. 半天.

B) **Test data seed scaffolding** — 加 record-java-golden.mjs 的 upload-seed 步骤, 解锁 4 个 multipart-prereq endpoint. 全天.

C) **/alerts full port** — 真业务逻辑 port (3 generators), 每 generator 单独 commit + threshold config + factory-with-data golden. 一周.

## 关键 rules

- 并发安全：`git status` 后 `git commit -m "..." -- file1 file2` (path-explicit)，commit 后 `git show --stat HEAD` 自检
- 新文件先 `git add <file>` 再 commit (path-explicit form 不 stage untracked)
- 4 个未修 review backlog (I-4 sham route test / I-5 lazy import / I-7 Java 200/success=false + 6 Minor M-1..M-6) 见 handoff doc

## 当前状态验证

```bash
cd C:\Users\Steve\my-prototype-logistics\.worktrees\phase2a-t5-poc
git status --short
git log --oneline -8
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -v
# Expect: 18 passed
```

请告诉我你选 A/B/C, 或者你想再讨论什么。
```
