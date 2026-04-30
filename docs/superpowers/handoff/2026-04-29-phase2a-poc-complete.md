# Phase 2A PoC Complete — Handoff to Next Batch Chat

> **For the next chat: copy the fenced block at the bottom into a fresh chat as your first message.**

---

## What was done in this session

PoC of Phase 2A T5a: ONE Python alias route end-to-end (`GET /api/mobile/{factory_id}/smart-bi/data-date-range`) to validate the full migration chain (JWT → alias route → DB seam → response envelope → contract test against Java golden).

### Commits on origin/main (after this session)

| SHA | Message |
|-----|---------|
| `a216742c7` | feat(phase2a): T5a PoC — /data-date-range alias + contract test |
| `38bc44e9e` | fix(phase2a): T5a PoC review fixes — numeric type-strict, null-wildcard doc, no-data test (I-1/I-2/I-3) |
| `<this commit>` | docs(phase2a): T5a PoC complete handoff |

### Tests on `phase2a/t5-poc` (merged to main)

- 5 jwt middleware
- 3 aggregator
- **4 contract** (1 main + 2 type-check + 1 no-data)
- **12 passed total**

### Workflow used

1. `superpowers:using-superpowers` (system load)
2. `superpowers:executing-plans` (plan critical review, raised 4 concerns)
3. `superpowers:using-git-worktrees` (created `.worktrees/phase2a-t5-poc` from `main` HEAD)
4. `superpowers:subagent-driven-development` for the PoC:
   - implementer subagent → DONE_WITH_CONCERNS, 1 commit
   - spec reviewer subagent → ✅ spec compliant
   - code quality reviewer subagent → 0 Critical / 7 Important / 6 Minor; "Yes with fixes I-1/I-2/I-3"
   - implementer subagent (fix round) → DONE, 1 commit
   - code quality reviewer subagent (re-review) → ✅ accepted
5. `superpowers:finishing-a-development-branch` (this handoff + merge to main)

---

## Key discoveries that change Phase 2A scope estimate

### 1. T0 classification overestimated effort

T0 estimated `data-date-range` (Z-class) as 3h; actual port was ~50 lines of Python in ~30 min. Granularity inference (`_infer_granularity` boundaries 1/7/31/93) was byte-faithful to Java with no surprises. Description string `"数据范围 X 至 Y"` rendered identical from Python f-string.

**Implication:** The 256h Phase 2A total estimate likely overshoots reality, possibly by 30-50%. Real number won't be known until 5-10 endpoints are done.

### 2. Python smartbi already has many "X-class" equivalents

`backend/python/smartbi/api/analysis.py` already exposes `/finance/overview`, `/finance/profit-trend`, `/finance/cost-structure`, `/sales/kpis`, `/department/ranking`, `/region/ranking`, etc. T0 classified the corresponding Java endpoints as Z/X based on syntactic patterns (if/switch on params, JPA-only services), but the actual migration is closer to "thin proxy to existing Python" (Y-equivalent) for many.

**Implication:** T0 classification needs a re-pass during the next batch. Endpoint-by-endpoint, check whether Python already has business logic before implementing fresh.

### 3. `from main import app` test fixture pattern is BROKEN on phase2a worktree

`backend/python/main.py:755` imports `smartbi.api.llm_router_admin` which is an **untracked file** on a parallel branch (likely `e2e/v1-framework`), not on `main`. On `phase2a/t5-poc`, `from main import app` raises `ModuleNotFoundError`. Implementer worked around by creating a minimal app fixture that mounts only `smartbi_compat.api.dashboard.router` (mirrors `test_jwt_middleware.py` pattern). Documented in test module + fixture docstrings.

**Must be resolved before T6 nginx cutover** because production `main:app` needs to actually import for the Python service to start. Two paths:
- (a) Cherry-pick `llm_router_admin.py` from the parallel branch onto main (if it's wanted)
- (b) Make the import in `main.py:755` defensive (try/except ImportError → skip router registration)
- (c) Delete the unused import if `llm_router_admin` was abandoned

Recommend (b) with a logged warning, since main.py already does try/except for SmartBI compat routers (T4 commit).

### 4. Test harness `assert_schema_match` had subtle bugs

Original implementation used `isinstance(actual, type(expected))` which:
- Rejected JSON-equivalent int/float interchange (`42` vs `42.0`)
- Asymmetrically conflated `bool`/`int`

Fixed in `38bc44e9e` with a `_types_compatible(actual, expected)` helper (int/float interchangeable, bool distinct). 2 unit tests added.

`null-as-wildcard` semantics also documented as a known regression-hiding limitation; recorder must mark provenance ("Java emitted null" vs "Java omitted key") for the next round of fix.

---

## Open Important issues from code review (fix BEFORE wide rollout)

The reviewer flagged 7 Important issues; 3 were fixed in this PoC (I-1/I-2/I-3). Remaining 4 should be batched-fixed before scaling beyond ~3-5 endpoints:

- **I-4** (sham route registration test): add `test_route_registration_smoke.py` parametrized over alias paths. Cheap, catches typo/refactor breakage.
- **I-5** (lazy import inside `_query_date_range`): defeats module-level mocking. Move imports to module top with `try/except ImportError` so tests can monkey-patch `dashboard.get_db_context`.
- **I-6** (envelope fidelity): `wrap_response` returns 3 keys; Java emits 5 (`code` + `timestamp` extra). Pick: add the 2 keys for true byte-equivalence, OR document and signoff that Phase 2A endpoints intentionally omit them. Don't leave implicit.
- **I-7** (Java 200/success=false vs Python 500): add route-level try/except mirroring Java's `ApiResponse.error(...)` shape, gated on whether the golden has `_serverSuccessFalse=true`.

Plus 6 Minor observations (M-1 through M-6) that are polish.

Full review at: subagent output reviewed commits `a216742c7..38bc44e9e`.

---

## Reviewer's recommendations for the next batch

1. **Fix I-1 type strictness FIRST** — already done in PoC, verify pattern propagates.
2. **Decide on envelope fidelity (I-6)** before adding more endpoints.
3. **Standardize a "factory-with-no-data" golden per endpoint family** so the empty branch is always tested.
4. **Establish numeric-tolerance contract** — `BigDecimal` round-trip semantics need a more explicit type marker than 1% relative tolerance.
5. **Move DAO seams (`_query_*` functions) into a `smartbi_compat/dao/` submodule** when scaling — flat `dashboard.py` will become a 2k-line file at 50 endpoints.
6. **Add `test_route_registration_smoke.py`** (I-4) parametrized over the 50 alias paths.
7. **For Z-class endpoints, keep helper-pure separation** — `_infer_granularity` (pure function, no DB/IO) is the right pattern. Replicate.
8. **Lock `wrap_response` envelope as a contract** once decided.

---

## Recommended next-chat flow

```
新 chat 第一条消息：贴下方 fenced block。

新 chat 内的第一步：
1. 切到 worktree：cd C:\Users\Steve\my-prototype-logistics\.worktrees\phase2a-t5-poc
   - 确认仍在 phase2a/t5-poc 分支
   - 确认 12/12 tests pass: cd backend/python && python -m pytest ../../tests/python/smartbi_compat/

2. 决定 main:app 解决方案 (issue #3 above)
   - 推荐 (b) 把 main.py:755 改成 try/except ImportError + log warning
   - 改完用 from main import app 重写 contract test fixture，删 minimal-app workaround
   - 1 commit

3. 用 superpowers:subagent-driven-development 跑 batch
   - PoC 节奏证明：1 endpoint ≈ 30-60 min wallclock (含 review loops)
   - 单 chat 现实预期：5-8 endpoints
   - 先做剩 4 个最简 Z 端点 (data-date-range 已 done, 还有 alerts/data-date-range-no-data... 不对，只有 1 个 data-date-range)

4. 候选下批端点 (按简单度排序，从 T0 + Python 现有覆盖):
   - GET /alerts (Z) — 简单查询，Python recommendation_service 类似已有
   - GET /alerts (with category=sales) — 同上的 Z 分支
   - GET /analysis/finance/budget-achievement (X) — 但 Python /finance/budget-vs-actual 已有
   - GET /analysis/finance/yoy-mom (X) — 但 Python /finance/yoy-mom 已有
   - GET /analysis/finance/category-comparison (X) — 但 Python /finance/category-comparison 已有
   
5. 每个端点遵循 PoC 模板 (TDD: contract test → fail → impl → pass)
   - 用 path-explicit commit (`git commit -m "..." -- file1 file2`)
   - 每 5 endpoints 做一次 review checkpoint
```

---

## Fenced block to paste into next chat

```
继续 Phase 2A SmartBI 迁移 batch rollout。下面是完整背景。

## 项目

Cretas 食品溯源系统 Python migration Phase 2A：把 50 个 Java SmartBI 端点切到 Python alias 实现。

工作目录：`C:\Users\Steve\my-prototype-logistics\.worktrees\phase2a-t5-poc`
当前分支：`phase2a/t5-poc` （已 merged 到 origin/main，可以继续 commit + push 到 main）

## 已完成

PoC of T5a 已 ship 到 origin/main（3 commits）：
- `a216742c7` feat: /data-date-range alias + contract test (Java→Python full port)
- `38bc44e9e` fix: T5a PoC review fixes I-1/I-2/I-3 (类型严格 + null wildcard 文档 + no-data test)
- `<handoff sha>` docs: T5a PoC complete handoff

测试：12 passed (5 jwt + 3 aggregator + 4 contract)

## 关键背景

完整 PoC 完成报告 + 4 个 Important issue + reviewer 建议 + next-batch 候选端点：
读 `docs/superpowers/handoff/2026-04-29-phase2a-poc-complete.md`

T0 endpoint 分类：
读 `docs/superpowers/research/2026-04-29-smartbi-50-endpoints-classification.md`
注意：T0 估的 X-class 工作量被高估，实际很多 X 类的 Python 等价端点已存在于 `backend/python/smartbi/api/analysis.py`。

## 第一步必须先做

**修 main:app 阻塞**：`backend/python/main.py:755` import `smartbi.api.llm_router_admin` 在 phase2a 分支不存在，导致 PoC contract test fixture 不能用 `from main import app`，被迫 mount 单独 router。

推荐 (b) 改 main.py:755 为 try/except ImportError + log warning，比 cherry-pick 安全。

完成后用 `from main import app` 重写 `tests/python/smartbi_compat/test_contract_compat.py` 的 `app` fixture，删掉 minimal-app workaround。

## 第二步：batch rollout

用 `superpowers:subagent-driven-development` 跑 5-8 个端点 batch。每端点遵循 PoC 模板（TDD：contract test → fail → impl → pass）。

候选端点（按简单度排序）：
1. GET /alerts (Z) — Python recommendation_service 类似已有
2. GET /analysis/finance/budget-achievement (X 但实际 Y) — Python /finance/budget-vs-actual 已有
3. GET /analysis/finance/yoy-mom (X 但实际 Y) — Python /finance/yoy-mom 已有
4. GET /analysis/finance/category-comparison (X 但实际 Y) — Python /finance/category-comparison 已有

每个 endpoint 节奏：30-60 min wallclock 含 spec review + code quality review + fix loop。

## 关键 rules

- 并发安全：`git status` 后 `git commit -m "..." -- file1 file2` (path-explicit)，commit 后 `git show --stat HEAD` 自检
- Reviewer 留下 4 个 Important issues 在 PoC 没修：I-4 (sham route test) / I-5 (lazy import) / I-6 (envelope code+timestamp) / I-7 (Java 200/success=false)。在 batch 5-10 端点之后做一次集中 fix。

## 当前状态验证命令

```bash
cd C:\Users\Steve\my-prototype-logistics\.worktrees\phase2a-t5-poc
git log --oneline -5
git -C . status --short
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -v
# Expect: 12 passed
```

请告诉我你想：
- 直接修 main:app 阻塞 + 跑 batch (推荐)
- 还是先讨论 batch 范围 / 候选端点选择 / I-4..I-7 修复时机
```
