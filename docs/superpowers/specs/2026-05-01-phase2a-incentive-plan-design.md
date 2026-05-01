# Phase 2A `/incentive-plan/{targetType}/{targetId}` Design

| Field | Value |
|---|---|
| **Type** | Single endpoint per-type (Wave 2 Tier 1, spec + impl in one PR) |
| **Status** | Drafted |
| **Endpoint** | `GET /api/mobile/{factoryId}/smart-bi/incentive-plan/{targetType}/{targetId}` |
| **Java reference** | `SmartBIAnalysisController.getIncentivePlan` line 641-673; `RecommendationServiceImpl.generateIncentivePlan/generateSalespersonIncentivePlan/generateDepartmentIncentivePlan` line 686-790 |
| **DTOs** | `IncentivePlan` (16 fields), `IncentiveLevel` (9 fields) |
| **Branch** | `phase2a/incentive-plan` (worktree at `.worktrees/phase2a-incentive-plan`) |
| **Sister chats** | Chat 1 receivable impl (no overlap — disjoint module + goldens) |

---

## §1. Why this sub-spec

The endpoint is a *thin Tier 1 read* — Java does no heavy aggregation, just sums sales rows by name and emits a hard-coded 4-tier (salesperson) or 3-tier (department) ladder. The reasons it merits a spec instead of a one-shot impl:

1. **Two non-deterministic fields** in the response DTO (`id = UUID.randomUUID()` and `createdAt = LocalDateTime.now()`) must be stripped from byte-shape compare. This is the main trap.
2. **Java has a latent bug** in the `region` targetType path that we must mirror byte-for-byte (Phase 2A is not the place to fix Java).
3. **`String.format("%.0f%%-%.0f%%", from, null)`** with `null` second arg produces the literal `"120%-%"` in the recorded F999 golden — matching Java's actual runtime behavior, not source-code intent. Python equivalent must produce the same string.
4. The 4 motivational-message branches have distinct format strings with `%.1f` / `%.0f` percentage formatting — these are subject to Rule 4 (`_decimal_to_number`) and the Java `BigDecimal.doubleValue()` vs Python `Decimal → float` rounding edge.

Goldens for `salesperson` targetType (F999/F001, both empty-data path) are already recorded at `tests/fixtures/java-smartbi-golden/incentive-plan-salesperson-{F999,F001}.json` (recorded 2026-04-29 to 04-30). `department` and `region` goldens are deferred (see §8); contract tests for those branches use synthetic mocked data and assert dict structure rather than golden equality.

---

## §2. Scope

### In-scope (this PR OWNS)

1. `backend/python/smartbi_compat/api/incentive_plan.py` — new module with single route
2. Three private helper functions:
   - `_generate_salesperson_plan(factory_id, salesperson_id, range_) -> dict`
   - `_generate_department_plan(factory_id, department_id, range_) -> dict`
   - `_generate_default_plan(factory_id, target_type, range_) -> dict` (mirrors Java `generateIncentivePlan(factoryId, targetType)` fall-through)
3. Pure helpers (no DB):
   - `_new_incentive_level_dict(...)` — 9-key level factory
   - `_new_incentive_plan_dict(...)` — 16-key plan factory (id/createdAt set per-call to satisfy field presence; volatile)
   - `_calculate_completion_rate(performance, goal) -> Decimal` mirrors Java line 139-146
   - `_calculate_gap_amount(performance, goal) -> Decimal` mirrors Java line 151-157
   - `_update_current_level(plan_dict)` mirrors Java line 163-201 (mutates dict in place)
   - `_generate_motivational_message(plan_dict)` mirrors Java line 207-234
   - `_format_completion_rate_desc(from_, to_) -> str` mirrors `IncentiveLevel.ofCompletionRate.description`
4. Two query seams (mock points for tests):
   - `_query_salesperson_sales(factory_id, range_, salesperson_id)` — sums `amount`, `monthly_target` for matching rows
   - `_query_department_data(factory_id, range_, department_id)` — sums `sales_amount`, `sales_target` for matching rows
5. `main.py` registration entry (one new `app.include_router` call inside the existing `try` block)
6. `tests/python/smartbi_compat/test_incentive_plan_contract.py` — 5 contract tests (see §7)

### Out-of-scope (PUNT)

| Item | Reason |
|---|---|
| Per-target-type goldens for `department` / `region` | F999/F001 production data has no department `D001` row matching test month; recording deferred. Tests synthesize. |
| Java-side bug fixes (region fall-through; `120%-%` description) | Phase 2A is byte-shape parity, not behavior fix. |
| `IncentiveRule` cache lookup (Java has `IncentiveRuleService` that COULD override hard-coded levels) | Java code path 723-790 ignores `IncentiveRuleService` — only `RecommendationServiceImpl.generate*IncentivePlan` is called from the controller. We mirror only the `RecommendationServiceImpl` path. |
| Sales/Department repositories' OTHER fields | We only read `salesperson_name`/`amount`/`monthly_target` and `department`/`sales_amount`/`sales_target`. SELECT * is fine; we use `dict.get(col_name)` pattern. |
| Strict-byte gate (Phase 3+) | Phase 2A gate is dict-eq with `_strip_volatile`. |

---

## §3. Architecture

```
HTTP GET /api/mobile/{factory_id}/smart-bi/incentive-plan/{target_type}/{target_id}
   │
   ▼
get_incentive_plan(factory_id, target_type, target_id, auth)
   │
   ├─ range_ = DateRange.by_period("month")
   │
   ├─ target_type == "salesperson"
   │     → plan = _generate_salesperson_plan(factory_id, target_id, range_)
   │
   ├─ target_type == "department"
   │     → plan = _generate_department_plan(factory_id, target_id, range_)
   │
   ├─ target_type == "region"
   │     → plan = _generate_default_plan(factory_id, "region", range_)
   │              (Java bug: falls through to first-salesperson path,
   │               targetId from URL is IGNORED. Returns minimal plan
   │               with targetType="region" + "暂无可用数据..." message
   │               ONLY if both salesperson and department queries return [])
   │
   └─ else:
         → wrap_response(None, message=f"Unsupported target type: {target_type}",
                         success=False, code=200)   # Java line 665 returns 200/success=false
   │
   ▼
return wrap_response(plan, message="操作成功")
```

### `_generate_salesperson_plan` flow (Java line 726-757)

```python
sales_rows = await _query_salesperson_sales(factory_id, range_, salesperson_id)
current_perf = sum(amount of rows)              # Decimal("0") if empty
target = sum(monthly_target of rows)            # Decimal("0") if empty/null
if target == 0:
    target = Decimal("100000")                   # Java line 738 default

plan = _new_incentive_plan_dict(
    target_type="salesperson",
    target_id=salesperson_id,
    target_name=salesperson_id,                  # Java line 741 uses salesperson_id as both
    current_performance=current_perf,
    target_goal=target,
)
# levels appended in order — matters for next-level lookup
plan["levels"] = [
    _new_incentive_level_dict("铜牌", Decimal("60"), Decimal("80"), Decimal("500")),
    _new_incentive_level_dict("银牌", Decimal("80"), Decimal("100"), Decimal("1000")),
    _new_incentive_level_dict("金牌", Decimal("100"), Decimal("120"), Decimal("2000")),
    _new_incentive_level_dict("钻石", Decimal("120"), None, Decimal("5000")),  # ← null targetTo
]
_update_current_level(plan)
_generate_motivational_message(plan)
return plan
```

### `_generate_department_plan` flow (Java line 761-790)

Same shape; differences:
- `_query_department_data(factory_id, range_, department_id)` instead
- Sums `sales_amount`, `sales_target`
- Default target = `Decimal("500000")` (Java line 773)
- 3-level ladder: 达标(80–100, 5000) / 优秀(100–120, 10000) / 卓越(120–null, 20000)

### `_generate_default_plan` flow (Java line 686-722)

```python
# Java only handles "department" and "salesperson"/default in inner switch.
# "region" hits default branch.
target_type_lower = target_type.lower() if target_type else "salesperson"

if target_type_lower == "department":
    dept_rows = await _query_all_department_rows(factory_id, range_)
    if dept_rows:
        first_dept = dept_rows[0]["department"]
        return await _generate_department_plan(factory_id, first_dept, range_)
else:  # salesperson, region, anything-else → all default to salesperson path
    sales_rows = await _query_all_sales_rows(factory_id, range_)
    if sales_rows:
        first_sp = next(
            (r["salesperson_name"] for r in sales_rows
             if r.get("salesperson_name") is not None),
            "未知"
        )
        return await _generate_salesperson_plan(factory_id, first_sp, range_)

# Empty-data branch (Java line 718-721)
return _new_incentive_plan_dict(
    target_type=target_type,                     # ← preserves URL target_type
    motivational_message="暂无可用数据生成激励方案",
)
```

⚠️ **Critical**: when `target_type="region"` and salesperson data exists, the response has `targetType="salesperson"` (overwritten by `_generate_salesperson_plan`), `targetId=<first SP name>`. URL `targetId` is silently lost. **This is the byte-shape contract** even though it's a Java bug.

---

## §4. Java reference flow

| Java code | Python equivalent |
|---|---|
| `SmartBIAnalysisController.getIncentivePlan` (line 641-673) | `incentive_plan.get_incentive_plan` |
| `switch (targetType)` controller dispatch (line 654-666) | `if/elif/else` chain in route handler |
| `recommendationService.generateSalespersonIncentivePlan` (line 726-757) | `_generate_salesperson_plan` |
| `recommendationService.generateDepartmentIncentivePlan` (line 761-790) | `_generate_department_plan` |
| `recommendationService.generateIncentivePlan` (line 686-722, fall-through) | `_generate_default_plan` |
| `IncentivePlan.forSalesperson` static (DTO line 239-251) | `_new_incentive_plan_dict(target_type="salesperson", ...)` + auto-calc completion/gap |
| `IncentivePlan.calculateCompletionRate` (DTO line 139-146) | `_calculate_completion_rate` |
| `IncentivePlan.calculateGapAmount` (DTO line 151-157) | `_calculate_gap_amount` |
| `IncentivePlan.updateCurrentLevel` (DTO line 163-201) | `_update_current_level` |
| `IncentivePlan.generateMotivationalMessage` (DTO line 207-234) | `_generate_motivational_message` |
| `IncentiveLevel.ofCompletionRate` (DTO line 79-88) | `_new_incentive_level_dict` + `_format_completion_rate_desc` |
| `IncentiveLevel.isInRange` (DTO line 111-118) | inline in `_update_current_level` |
| `RecommendationServiceImpl.sumField` helper | `sum(_to_decimal(r["col"]) for r in rows if r.get("col") is not None)` per Rule 1 |

---

## §5. Surface traps (brainstorm output, A→F)

### Trap A — `id` and `createdAt` are non-deterministic

**Symptom**: F999 golden has `"id": "eb5449aa-..."` and `"createdAt": "2026-04-30T06:34:45.291581472"`. Each request produces different values.

**Mitigation**:
- Python sets `id = uuid.uuid4().hex` (or any string) and `createdAt = datetime.now().isoformat()`
- Tests use `_strip_volatile({"id", "createdAt"})` before dict-eq
- Envelope `timestamp` already in standard `_VOLATILE` set

### Trap B — `region` falls through to salesperson path (Java bug)

**Symptom**: Java controller `case "region"` calls `generateIncentivePlan(factoryId, "region")` which has inner switch only for `department`/`salesperson`. `region` hits `default` → grabs first salesperson row → calls `generateSalespersonIncentivePlan` which sets `targetType="salesperson"` via `IncentivePlan.forSalesperson`. URL's `targetId` is lost.

**Mitigation**: Mirror exactly. Tests assert this behavior with comment `# byte-shape parity with Java bug — see spec §5 Trap B`.

### Trap C — `targetTo=null` produces `"120%-%"` in description

**Symptom**: F999 golden 钻石 level: `"description": "完成率达到 120%-%"` — Java `String.format("%.0f%%-%.0f%%", 120, null)` somehow yields this string instead of NPE.

**Investigation**: This is consistent with Java's `Formatter` using the implicit conversion path that treats `null` Number args as the empty string when the format width is unspecified — though formal docs say NPE. The empirical golden is ground truth.

**Mitigation**: Implement `_format_completion_rate_desc(from_, to_)`:
```python
def _format_completion_rate_desc(from_: Decimal, to_: Optional[Decimal]) -> str:
    from_str = f"{int(from_)}"
    to_str = f"{int(to_)}" if to_ is not None else ""
    return f"完成率达到 {from_str}%-{to_str}%"
```
This produces `"完成率达到 60%-80%"` for the bronze tier and `"完成率达到 120%-%"` for the diamond tier — matches goldens byte-for-byte.

### Trap D — `motivationalMessage` `%.1f` Java vs Python rounding

**Symptom**: Java `String.format("%.1f", BigDecimal)` calls `BigDecimal.doubleValue()` then formats — uses ROUND_HALF_UP. Python `f"{Decimal:.1f}"` uses ROUND_HALF_EVEN due to float imprecision.

**Edge cases**:
- `0` → both produce `"0.0"` ✓
- `75.5000` → both produce `"75.5"` ✓ (no rounding needed)
- `75.55` → Java `"75.6"`, Python via float `"75.5"` ✗

**Mitigation**: Quantize to `Decimal("0.1")` with ROUND_HALF_UP before format:
```python
rate_q = rate.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
rate_str = f"{rate_q:.1f}"   # already at scale 1, format is identity
```

For `gapAmount` `%.0f`: same pattern with `Decimal("1")`.

### Trap E — `completionRate` scale 4 but golden shows integer `0`

**Symptom**: Java `currentPerformance(0).divide(targetGoal(100000), 4, HALF_UP) = BigDecimal("0.0000")`, then `.multiply(100) = BigDecimal("0.0000")` (scale 4). Yet golden shows `"completionRate": 0`.

**Investigation**: Jackson's default `BigDecimalSerializer` writes via `JsonGenerator.writeNumber(BigDecimal)`. The recording script `record-java-golden.sh` then runs `json.load → json.dumps`, and Python's `json.dumps(0.0000)` strips trailing zeros for float (but NOT for explicit Decimal). Either way, the recorded golden is `0` (int) because Python `json.load` of `0.0000` yields `0` (int via JSON's number parser, since `0.0000 == 0`).

**Mitigation**: `_decimal_to_number(Decimal("0.0000"))` returns `int(0)` because `Decimal("0.0000") == Decimal("0.0000").to_integral_value()`. ✓ Matches golden.

### Trap F — `targetGoal` and `currentPerformance` numeric vs Decimal scale

**Symptom**: `targetGoal: 100000` (int) and `currentPerformance: 0` (int) — both scale-0. After computing `gapAmount = targetGoal - currentPerformance = 100000 - 0`, Java `BigDecimal.subtract` preserves max scale (`max(0, 0) = 0`), giving `100000`. Python Decimal: `Decimal("100000") - Decimal("0") = Decimal("100000")`. Via `_decimal_to_number` → `int(100000)`. ✓

**Note**: when sales rows have `amount = Decimal("123.45")` (scale 2), the sum is also scale 2, so `currentPerformance: 123.45` (float). `_decimal_to_number(Decimal("123.45"))` → `float(123.45)`. Phase 2A dict-eq tolerates `123.45` vs `123.45000`.

### Bonus trap — `default` switch arm in `generateIncentivePlan` includes `"salesperson"`

Java line 700-702:
```java
case "salesperson":
case "default":  // wait, no — actually:
default:
```

Source code uses fall-through `case "salesperson":` *immediately followed by* `default:`. Both labels share the same handler. So `"salesperson"`, `"region"`, `""`, `null`, anything-else all hit the same code. ✓ Already covered by Trap B mitigation.

---

## §6. Python implementation outline

```python
# backend/python/smartbi_compat/api/incentive_plan.py
"""Phase 2A /smart-bi/incentive-plan/{targetType}/{targetId} port (Wave 2 Tier 1)."""
from __future__ import annotations
import logging
import uuid
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from fastapi import APIRouter, Depends

from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.date_range import DateRange
from smartbi_compat.schema_compat import wrap_response
from smartbi_compat.api.analysis_finance import _decimal_to_number  # Rule 4

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Constants (Java line 744-784 hard-coded ladders) ─────────────────────
_SALESPERSON_DEFAULT_TARGET = Decimal("100000")     # Java line 738
_DEPARTMENT_DEFAULT_TARGET = Decimal("500000")      # Java line 773
_SALESPERSON_LEVELS = [
    ("铜牌",  Decimal("60"),  Decimal("80"),  Decimal("500")),
    ("银牌",  Decimal("80"),  Decimal("100"), Decimal("1000")),
    ("金牌",  Decimal("100"), Decimal("120"), Decimal("2000")),
    ("钻石",  Decimal("120"), None,           Decimal("5000")),
]
_DEPARTMENT_LEVELS = [
    ("达标",  Decimal("80"),  Decimal("100"), Decimal("5000")),
    ("优秀",  Decimal("100"), Decimal("120"), Decimal("10000")),
    ("卓越",  Decimal("120"), None,           Decimal("20000")),
]

# ── Pure helpers ──────────────────────────────────────────────────────────
def _to_decimal(v) -> Decimal: ...      # standard Java→Python null-safe cast
def _format_completion_rate_desc(from_, to_) -> str: ...
def _new_incentive_level_dict(name, from_, to_, reward) -> dict:
    return {
        "levelName": name,
        "description": _format_completion_rate_desc(from_, to_),
        "targetFrom": _decimal_to_number(from_),
        "targetTo": _decimal_to_number(to_) if to_ is not None else None,
        "rewardAmount": _decimal_to_number(reward),
        "rewardRate": None,
        "current": False,
        "achieved": False,
        "gap": None,
    }
def _new_incentive_plan_dict(*, target_type, target_id=None, target_name=None,
                              current_performance=None, target_goal=None,
                              motivational_message=None) -> dict:
    plan = {
        "id": uuid.uuid4().hex.replace(...UUID format...),  # volatile
        "targetType": target_type,
        "targetId": target_id,
        "targetName": target_name,
        "currentPerformance": _decimal_to_number(current_performance or Decimal("0"))
                              if current_performance is not None else None,
        "targetGoal": _decimal_to_number(target_goal) if target_goal is not None else None,
        "gapAmount": ...,             # computed if both present
        "completionRate": ...,        # computed if both present
        "levels": [],
        "currentLevelName": None,
        "nextLevelName": None,
        "gapToNextLevel": None,
        "motivationalMessage": motivational_message,
        "estimatedReward": None,
        "potentialReward": None,
        "createdAt": datetime.now().isoformat(),  # volatile
    }
    return plan

def _calculate_completion_rate(perf, goal) -> Decimal:
    # Java line 139-146
    if goal is not None and goal > 0 and perf is not None:
        return (perf / goal).quantize(Decimal("0.0001"), ROUND_HALF_UP) * Decimal("100")
    return Decimal("0")

def _calculate_gap_amount(perf, goal) -> Decimal:
    if goal is not None and perf is not None:
        return goal - perf
    return Decimal("0")

def _update_current_level(plan: dict) -> None:
    # Java line 163-201 — 1:1 port of for loop with isInRange + early break
    rate = _to_decimal(plan["completionRate"])
    if not plan["levels"] or plan["completionRate"] is None:
        return
    current = None
    next_lvl = None
    for i, lvl in enumerate(plan["levels"]):
        from_ = _to_decimal(lvl["targetFrom"])
        to_ = _to_decimal(lvl["targetTo"]) if lvl["targetTo"] is not None else None
        in_range = (from_ is None or rate >= from_) and (to_ is None or rate < to_)
        if in_range:
            current = lvl
            lvl["current"] = True
            lvl["achieved"] = True
            if i + 1 < len(plan["levels"]):
                next_lvl = plan["levels"][i + 1]
            break
        elif from_ is not None and rate < from_:
            next_lvl = lvl
            break
        else:
            lvl["achieved"] = True
    if current:
        plan["currentLevelName"] = current["levelName"]
        plan["estimatedReward"] = current["rewardAmount"]
    if next_lvl:
        plan["nextLevelName"] = next_lvl["levelName"]
        plan["gapToNextLevel"] = _decimal_to_number(
            _to_decimal(next_lvl["targetFrom"]) - rate
        )
        plan["potentialReward"] = next_lvl["rewardAmount"]

def _generate_motivational_message(plan: dict) -> None:
    # Java line 207-234, %.1f / %.0f use ROUND_HALF_UP via Decimal.quantize
    rate = _to_decimal(plan["completionRate"])
    name = plan["targetName"]
    gap = _to_decimal(plan["gapAmount"])
    rate_q = rate.quantize(Decimal("0.1"), ROUND_HALF_UP)
    gap_q = gap.quantize(Decimal("1"), ROUND_HALF_UP)
    if rate >= 100:
        plan["motivationalMessage"] = f"太棒了！{name} 已完成目标 {rate_q:.1f}%！继续保持这种势头！"
    elif rate >= 80:
        plan["motivationalMessage"] = f"距离目标只差 {gap_q:.0f} 元，{name} 加把劲就能达成！"
    elif rate >= 60:
        plan["motivationalMessage"] = f"{name} 已完成 {rate_q:.1f}%，继续努力，下一个等级的奖励在等着你！"
    else:
        plan["motivationalMessage"] = f"{name} 当前完成率 {rate_q:.1f}%，需要加速冲刺！每一笔订单都是向目标迈进！"

# ── DB query seams (mock points) ──────────────────────────────────────────
async def _query_salesperson_sales(factory_id, range_, salesperson_id) -> list[dict]:
    """Return rows from smart_bi_sales_data filtered by factory_id, order_date, salesperson_name."""
    # SELECT * FROM smart_bi_sales_data
    #   WHERE factory_id = $1 AND order_date BETWEEN $2 AND $3 AND salesperson_name = $4

async def _query_department_data(factory_id, range_, department_id) -> list[dict]:
    """Return rows from smart_bi_department_data filtered by factory_id, record_date, department."""

async def _query_all_sales_rows(factory_id, range_) -> list[dict]: ...
async def _query_all_department_rows(factory_id, range_) -> list[dict]: ...

# ── Core generators ───────────────────────────────────────────────────────
async def _generate_salesperson_plan(factory_id, salesperson_id, range_) -> dict:
    rows = await _query_salesperson_sales(factory_id, range_, salesperson_id)
    perf = sum((_to_decimal(r["amount"]) for r in rows if r.get("amount") is not None),
               Decimal("0"))
    target = sum((_to_decimal(r["monthly_target"]) for r in rows
                  if r.get("monthly_target") is not None),
                 Decimal("0"))
    if target == 0:
        target = _SALESPERSON_DEFAULT_TARGET
    plan = _new_incentive_plan_dict(
        target_type="salesperson",
        target_id=salesperson_id,
        target_name=salesperson_id,
        current_performance=perf,
        target_goal=target,
    )
    plan["levels"] = [_new_incentive_level_dict(*lvl) for lvl in _SALESPERSON_LEVELS]
    _update_current_level(plan)
    _generate_motivational_message(plan)
    return plan

async def _generate_department_plan(factory_id, department_id, range_) -> dict:
    # Same shape, _DEPARTMENT_DEFAULT_TARGET, _DEPARTMENT_LEVELS, "sales_amount"/"sales_target"
    ...

async def _generate_default_plan(factory_id, target_type, range_) -> dict:
    target_type_lower = (target_type or "salesperson").lower()
    if target_type_lower == "department":
        rows = await _query_all_department_rows(factory_id, range_)
        if rows:
            return await _generate_department_plan(factory_id, rows[0]["department"], range_)
    else:
        rows = await _query_all_sales_rows(factory_id, range_)
        if rows:
            first_sp = next(
                (r["salesperson_name"] for r in rows
                 if r.get("salesperson_name") is not None),
                "未知"
            )
            return await _generate_salesperson_plan(factory_id, first_sp, range_)
    return _new_incentive_plan_dict(
        target_type=target_type,
        motivational_message="暂无可用数据生成激励方案",
    )

# ── Route ─────────────────────────────────────────────────────────────────
@router.get("/api/mobile/{factory_id}/smart-bi/incentive-plan/{target_type}/{target_id}")
async def get_incentive_plan(
    factory_id: str,
    target_type: str,
    target_id: str,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict[str, Any]:
    range_ = DateRange.by_period("month")
    if target_type == "salesperson":
        plan = await _generate_salesperson_plan(auth.factory_id, target_id, range_)
    elif target_type == "department":
        plan = await _generate_department_plan(auth.factory_id, target_id, range_)
    elif target_type == "region":
        plan = await _generate_default_plan(auth.factory_id, target_type, range_)
    else:
        # Java line 665 — returns 200 / success=false
        return wrap_response(None, message=f"Unsupported target type: {target_type}",
                              success=False)
    return wrap_response(plan, message="操作成功")
```

LOC budget: ~280 (impl) + spec 540 (this doc) — within target.

---

## §7. Test plan — 5 contract tests

`tests/python/smartbi_compat/test_incentive_plan_contract.py`:

```python
VOLATILE = {"id", "createdAt", "timestamp"}

def _strip_volatile(obj):
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in VOLATILE}
    if isinstance(obj, list):
        return [_strip_volatile(x) for x in obj]
    return obj
```

| # | Test | Assertion |
|---|---|---|
| **T1** | `test_salesperson_empty_data_matches_F999_golden` | Mock `_query_salesperson_sales` → `[]`. GET `/incentive-plan/salesperson/SP001` for F999. `_strip_volatile(body["data"])` == `_strip_volatile(golden["response"]["data"])`. Asserts envelope `success/message/data` keys. |
| **T2** | `test_salesperson_empty_data_matches_F001_golden` | Same as T1 for F001 — separate fixture file, same shape. |
| **T3** | `test_salesperson_with_data_hits_silver_level` | Mock returns rows summing to `amount=85000`, `monthly_target=100000`. Assert `currentLevelName="银牌"`, `nextLevelName="金牌"`, `motivationalMessage` contains `"距离目标只差"` (`%.0f` branch), `estimatedReward=1000`, `potentialReward=2000`. |
| **T4** | `test_department_with_data_hits_excellent_level` | Mock `_query_department_data` → rows sum `sales_amount=600000`, `sales_target=500000` → completion 120% → 卓越 level (top tier). Assert `currentLevelName="卓越"`, `nextLevelName=None`, `gapToNextLevel=None`, `motivationalMessage` starts with `"太棒了！"`. |
| **T5** | `test_region_falls_through_to_first_salesperson` | Mock `_query_all_sales_rows` returns `[{"salesperson_name": "李四", ...}]`. GET `/incentive-plan/region/IGNORED_ID`. Assert response `targetType=="salesperson"` (Java bug), `targetId=="李四"`, NOT `"IGNORED_ID"`. |

Tests use `monkeypatch` on the seam helpers in the same module (`smartbi_compat.api.incentive_plan._query_salesperson_sales`, etc.) following the established pattern in `test_alerts_contract.py`.

### Stretch (not required, document only)

- **T6** (deferred): `test_diamond_level_description_format` — assert `levels[3]["description"] == "完成率达到 120%-%"` byte-for-byte. Probably already covered by T1/T2 since goldens have this string.

---

## §8. Golden recording

### Already recorded (use as-is)

| Golden | Factory | targetType | targetId | Path |
|---|---|---|---|---|
| `incentive-plan-salesperson-F999.json` | F999 | salesperson | SP001 | `tests/fixtures/java-smartbi-golden/` |
| `incentive-plan-salesperson-F001.json` | F001 | salesperson | SP001 | same |

Both record the empty-data branch (no row matches `salesperson_name=SP001`). They are sufficient for T1 + T2.

### Deferred (out-of-scope this PR)

- `incentive-plan-department-F999.json` — requires F999 `smart_bi_department_data` row with a known `department` value.
- `incentive-plan-region-F999.json` — requires F999 `smart_bi_sales_data` rows.

Recording command (for the impl chat that picks these up later):

```bash
JWT_SECRET=<from /www/wwwroot/cretas/.env.test> ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/incentive-plan/department/D001' \
    incentive-plan-department-F999.json
```

T3/T4/T5 do **not** rely on goldens — they synthesize input via mocks and assert specific output fields.

---

## §9. Open questions / risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `_query_salesperson_sales` SQL must exclude soft-deleted rows | Medium | Use `WHERE deleted_at IS NULL` per BaseEntity convention; verify against `SmartBiSalesData` `@Where` |
| `motivationalMessage` Decimal vs float rounding edge at exactly `.x5` | Low | Already mitigated by quantize-before-format (Trap D); add T3 case at `0.85 → 85.0%` if needed |
| F001/F999 envelope shape divergence (F001 has fewer keys than F999) | Low | Use `_strip_volatile` + dict-eq on `data` only; envelope tested separately via `_assert_envelope` |
| Java `BigDecimal("100000.00")` vs `100000` (scale 2 vs 0) when reading from DB | Low | `_decimal_to_number` returns int for both; dict-eq tolerates |
| Future Java fix to region fall-through bug breaks our parity test | Medium | T5 has explicit comment `# byte-shape parity with Java bug — fix in lockstep` |

---

## §10. PR plan

1. spec doc (this file) — committed first
2. `backend/python/smartbi_compat/api/incentive_plan.py` (~280 LOC)
3. `backend/python/main.py` — single line addition inside Phase 2A try block
4. `tests/python/smartbi_compat/test_incentive_plan_contract.py` (~200 LOC, 5 tests)

Single PR `--base main --head phase2a/incentive-plan`. Use `./scripts/safe-commit.sh` per `concurrent-edit-safety.md` Rule 5b.

---

## §11. 并行工作建议

### Subagent: ❌ — 单 module 顺序工作 (spec → impl → tests), 无独立并行机会
### 多 Chat: ✅ Chat 1 (receivable impl) 完全独立 (不同 module file `analysis_finance.py` vs new `incentive_plan.py`, 不同 goldens, 不同 tests). 冲突风险: 0 — 仅 `main.py` Phase 2A try block 共享, 用 `safe-commit.sh -- F1 F2` 隔离 commit scope.
