"""Phase 2A `/smart-bi/incentive-plan/{targetType}/{targetId}` port (Wave 2 Tier 1).

Java reference:
  - Controller: SmartBIAnalysisController.getIncentivePlan (line 641-673)
  - Service: RecommendationServiceImpl.{generateIncentivePlan,
    generateSalespersonIncentivePlan, generateDepartmentIncentivePlan}
    (line 686-790)
  - DTOs: IncentivePlan (16 fields), IncentiveLevel (9 fields)

Spec: docs/superpowers/specs/2026-05-01-phase2a-incentive-plan-design.md

Surface traps (see spec §5):
  A — `id` and `createdAt` are non-deterministic; tests strip them.
  B — `targetType="region"` falls through to first-salesperson path
      (Java bug, byte-shape parity demands we mirror).
  C — `IncentiveLevel.targetTo=None` produces "120%-%" in description.
  D — `motivationalMessage` rounding: quantize before `%.1f`/`%.0f`
      to match Java BigDecimal.doubleValue + ROUND_HALF_UP.
  E — `_decimal_to_number(Decimal("0.0000"))` returns int(0) — matches
      golden `"completionRate": 0`.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from fastapi import APIRouter, Depends

from smartbi_compat._rbac_role import require_analytics_read
from smartbi_compat._rbac_strip import strip_price_for_role
from smartbi_compat.auth import AuthContext
from smartbi_compat.date_range import DateRange
from smartbi_compat.schema_compat import _java_isoformat, wrap_response
from smartbi_compat.api.analysis_finance import _decimal_to_number

logger = logging.getLogger(__name__)
router = APIRouter()

# ============================================================
# Section 1: Constants — Java line 744-784 hard-coded ladders
# ============================================================

_SALESPERSON_DEFAULT_TARGET = Decimal("100000")  # Java line 738
_DEPARTMENT_DEFAULT_TARGET = Decimal("500000")   # Java line 773

# Each tuple: (level_name, target_from, target_to_or_None, reward_amount)
_SALESPERSON_LEVELS: list[tuple[str, Decimal, Optional[Decimal], Decimal]] = [
    ("铜牌", Decimal("60"),  Decimal("80"),  Decimal("500")),
    ("银牌", Decimal("80"),  Decimal("100"), Decimal("1000")),
    ("金牌", Decimal("100"), Decimal("120"), Decimal("2000")),
    ("钻石", Decimal("120"), None,           Decimal("5000")),
]
_DEPARTMENT_LEVELS: list[tuple[str, Decimal, Optional[Decimal], Decimal]] = [
    ("达标", Decimal("80"),  Decimal("100"), Decimal("5000")),
    ("优秀", Decimal("100"), Decimal("120"), Decimal("10000")),
    ("卓越", Decimal("120"), None,           Decimal("20000")),
]


# ============================================================
# Section 2: Pure helpers
# ============================================================


def _to_decimal(v: Any) -> Decimal:
    """Null-safe Decimal cast. Returns Decimal("0") for None per Java
    null-handling in calculateCompletionRate / sumField."""
    if v is None:
        return Decimal("0")
    if isinstance(v, Decimal):
        return v
    try:
        return Decimal(str(v))
    except Exception:
        return Decimal("0")


def _format_completion_rate_desc(from_: Decimal, to_: Optional[Decimal]) -> str:
    """Mirror Java IncentiveLevel.ofCompletionRate.description (DTO line 86):
        String.format("完成率达到 %.0f%%-%.0f%%", from, to)

    When `to` is None, Java empirically produces "完成率达到 120%-%"
    (see Trap C in spec §5). `%.0f` on Decimal uses ROUND_HALF_UP via
    BigDecimal.doubleValue + Formatter conversion; for our integer
    thresholds the result is identity (int truncation suffices).
    """
    from_str = f"{int(from_)}"
    to_str = f"{int(to_)}" if to_ is not None else ""
    return f"完成率达到 {from_str}%-{to_str}%"


def _new_incentive_level_dict(
    name: str,
    target_from: Decimal,
    target_to: Optional[Decimal],
    reward_amount: Decimal,
) -> dict:
    """9-key IncentiveLevel dict in Java field-declaration order.

    Mirrors IncentiveLevel.ofCompletionRate (DTO line 79-88) — only sets
    name/description/targetFrom/targetTo/rewardAmount; `current`,
    `achieved` default to false; `rewardRate`, `gap` default to null.
    """
    return {
        "levelName": name,
        "description": _format_completion_rate_desc(target_from, target_to),
        "targetFrom": _decimal_to_number(target_from),
        "targetTo": _decimal_to_number(target_to) if target_to is not None else None,
        "rewardAmount": _decimal_to_number(reward_amount),
        "rewardRate": None,
        "current": False,
        "achieved": False,
        "gap": None,
    }


def _new_incentive_plan_dict(
    *,
    target_type: Optional[str],
    target_id: Optional[str] = None,
    target_name: Optional[str] = None,
    current_performance: Optional[Decimal] = None,
    target_goal: Optional[Decimal] = None,
    motivational_message: Optional[str] = None,
) -> dict:
    """16-key IncentivePlan dict in Java field-declaration order.

    `id` and `createdAt` are volatile (random UUID and now() per call);
    contract tests strip them via `_strip_volatile`. See spec §5 Trap A.

    `gapAmount`/`completionRate` are computed when both `current_performance`
    and `target_goal` are present (mirrors `IncentivePlan.forSalesperson` /
    `forDepartment` static factories which call `calculateGapAmount` and
    `calculateCompletionRate` after build).
    """
    plan: dict = {
        "id": str(uuid.uuid4()),
        "targetType": target_type,
        "targetId": target_id,
        "targetName": target_name,
        "currentPerformance": (
            _decimal_to_number(current_performance)
            if current_performance is not None
            else None
        ),
        "targetGoal": (
            _decimal_to_number(target_goal) if target_goal is not None else None
        ),
        "gapAmount": None,
        "completionRate": None,
        "levels": [],
        "currentLevelName": None,
        "nextLevelName": None,
        "gapToNextLevel": None,
        "motivationalMessage": motivational_message,
        "estimatedReward": None,
        "potentialReward": None,
        "createdAt": _java_isoformat(datetime.now()),
    }
    if current_performance is not None and target_goal is not None:
        # IncentivePlan.calculateGapAmount (DTO line 151-157)
        plan["gapAmount"] = _decimal_to_number(target_goal - current_performance)
        # IncentivePlan.calculateCompletionRate (DTO line 139-146)
        plan["completionRate"] = _decimal_to_number(
            _calculate_completion_rate(current_performance, target_goal)
        )
    return plan


def _calculate_completion_rate(perf: Decimal, goal: Decimal) -> Decimal:
    """Mirror IncentivePlan.calculateCompletionRate (DTO line 139-146).

    Java:
        if (goal != null && goal > 0 && perf != null) {
            this.completionRate = perf.divide(goal, 4, HALF_UP).multiply(100);
        } else {
            this.completionRate = ZERO;
        }
    """
    if goal is not None and goal > 0 and perf is not None:
        # divide(goal, 4, HALF_UP) → scale 4; .multiply(Decimal("100")) → scale 4+0=4
        ratio = (perf / goal).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        return ratio * Decimal("100")
    return Decimal("0")


def _update_current_level(plan: dict) -> None:
    """Mirror IncentivePlan.updateCurrentLevel (DTO line 163-201).

    Iterates levels in order, sets `current=true,achieved=true` on the
    matching level, sets `achieved=true` on already-passed levels, and
    populates currentLevelName / nextLevelName / gapToNextLevel /
    estimatedReward / potentialReward fields.
    """
    if not plan["levels"] or plan["completionRate"] is None:
        return

    rate = _to_decimal(plan["completionRate"])
    current = None
    next_lvl = None

    for i, lvl in enumerate(plan["levels"]):
        from_ = _to_decimal(lvl["targetFrom"]) if lvl["targetFrom"] is not None else None
        to_ = _to_decimal(lvl["targetTo"]) if lvl["targetTo"] is not None else None
        # IncentiveLevel.isInRange (DTO line 111-118):
        #   aboveFrom = (from is null) || (value >= from)
        #   belowTo   = (to   is null) || (value <  to)
        above_from = from_ is None or rate >= from_
        below_to = to_ is None or rate < to_
        in_range = above_from and below_to
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

    if current is not None:
        plan["currentLevelName"] = current["levelName"]
        plan["estimatedReward"] = current["rewardAmount"]
    if next_lvl is not None:
        plan["nextLevelName"] = next_lvl["levelName"]
        next_from = _to_decimal(next_lvl["targetFrom"])
        plan["gapToNextLevel"] = _decimal_to_number(next_from - rate)
        plan["potentialReward"] = next_lvl["rewardAmount"]


def _generate_motivational_message(plan: dict) -> None:
    """Mirror IncentivePlan.generateMotivationalMessage (DTO line 207-234).

    Java uses `String.format("%.1f%%", rate)` and `String.format("%.0f", gap)`
    which call BigDecimal.doubleValue + Formatter ROUND_HALF_UP. We pre-quantize
    via Decimal to avoid Python float-rounding edge cases (Trap D).
    """
    rate = (
        _to_decimal(plan["completionRate"])
        if plan["completionRate"] is not None
        else None
    )
    name = plan["targetName"]
    gap = _to_decimal(plan["gapAmount"]) if plan["gapAmount"] is not None else Decimal("0")

    if rate is None:
        plan["motivationalMessage"] = "继续努力，您一定可以的！"
        return

    rate_q = rate.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    gap_q = gap.quantize(Decimal("1"), rounding=ROUND_HALF_UP)

    if rate >= Decimal("100"):
        plan["motivationalMessage"] = (
            f"太棒了！{name} 已完成目标 {rate_q:.1f}%！继续保持这种势头！"
        )
    elif rate >= Decimal("80"):
        plan["motivationalMessage"] = (
            f"距离目标只差 {gap_q:.0f} 元，{name} 加把劲就能达成！"
        )
    elif rate >= Decimal("60"):
        plan["motivationalMessage"] = (
            f"{name} 已完成 {rate_q:.1f}%，继续努力，下一个等级的奖励在等着你！"
        )
    else:
        plan["motivationalMessage"] = (
            f"{name} 当前完成率 {rate_q:.1f}%，需要加速冲刺！每一笔订单都是向目标迈进！"
        )


# ============================================================
# Section 3: DB query seams (mock points for tests)
# ============================================================


async def _get_cretas_pool():
    """Lazy import to avoid module-load cycle. Mirrors profit/cost pattern.

    Uses cretas pool because incentive_plan queries smart_bi_sales_data /
    smart_bi_department_data which live in cretas_prod_db (not smartbi_prod_db).
    See spec 2026-05-05-phase2a-db-pool-wiring-fix §2.2.4.
    """
    try:
        from smartbi.config import get_cretas_pool  # type: ignore
        return await get_cretas_pool()
    except Exception as e:
        logger.warning("[incentive-plan] cretas pool acquisition failed: %s", e)
        return None


async def _query_salesperson_sales(
    factory_id: str, range_: DateRange, salesperson_id: str
) -> list[dict]:
    """Rows from smart_bi_sales_data filtered by salesperson_name.

    Mirrors Java line 729-733: `findByFactoryIdAndOrderDateBetween` then
    in-memory `.filter(salesperson_name == salesperson_id)`. We push the
    filter to SQL for efficiency — same result.
    """
    if range_.start_date is None or range_.end_date is None:
        raise ValueError(
            f"_query_salesperson_sales: start/end required (got {range_})"
        )
    pool = await _get_cretas_pool()
    if pool is None:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM smart_bi_sales_data
            WHERE factory_id = $1
              AND order_date BETWEEN $2 AND $3
              AND salesperson_name = $4
              AND deleted_at IS NULL
            """,
            factory_id,
            range_.start_date,
            range_.end_date,
            salesperson_id,
        )
        return [dict(r) for r in rows]


async def _query_department_data(
    factory_id: str, range_: DateRange, department_id: str
) -> list[dict]:
    """Rows from smart_bi_department_data filtered by department.

    Mirrors Java line 764-768: `findByFactoryIdAndRecordDateBetween` then
    in-memory filter. Pushed to SQL.
    """
    if range_.start_date is None or range_.end_date is None:
        raise ValueError(
            f"_query_department_data: start/end required (got {range_})"
        )
    pool = await _get_cretas_pool()
    if pool is None:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM smart_bi_department_data
            WHERE factory_id = $1
              AND record_date BETWEEN $2 AND $3
              AND department = $4
              AND deleted_at IS NULL
            """,
            factory_id,
            range_.start_date,
            range_.end_date,
            department_id,
        )
        return [dict(r) for r in rows]


async def _query_all_sales_rows(factory_id: str, range_: DateRange) -> list[dict]:
    """All sales rows for default-fallback path. Java line 704-705."""
    if range_.start_date is None or range_.end_date is None:
        raise ValueError(f"_query_all_sales_rows: start/end required (got {range_})")
    pool = await _get_cretas_pool()
    if pool is None:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM smart_bi_sales_data
            WHERE factory_id = $1
              AND order_date BETWEEN $2 AND $3
              AND deleted_at IS NULL
            """,
            factory_id,
            range_.start_date,
            range_.end_date,
        )
        return [dict(r) for r in rows]


async def _query_all_department_rows(factory_id: str, range_: DateRange) -> list[dict]:
    """All department rows for default-fallback path. Java line 694-695."""
    if range_.start_date is None or range_.end_date is None:
        raise ValueError(
            f"_query_all_department_rows: start/end required (got {range_})"
        )
    pool = await _get_cretas_pool()
    if pool is None:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM smart_bi_department_data
            WHERE factory_id = $1
              AND record_date BETWEEN $2 AND $3
              AND deleted_at IS NULL
            """,
            factory_id,
            range_.start_date,
            range_.end_date,
        )
        return [dict(r) for r in rows]


# ============================================================
# Section 4: Core generators
# ============================================================


async def _generate_salesperson_plan(
    factory_id: str, salesperson_id: str, range_: DateRange
) -> dict:
    """Mirror RecommendationServiceImpl.generateSalespersonIncentivePlan (line 726-757)."""
    rows = await _query_salesperson_sales(factory_id, range_, salesperson_id)
    perf = sum(
        (_to_decimal(r["amount"]) for r in rows if r.get("amount") is not None),
        Decimal("0"),
    )
    target = sum(
        (
            _to_decimal(r["monthly_target"])
            for r in rows
            if r.get("monthly_target") is not None
        ),
        Decimal("0"),
    )
    if target == 0:
        target = _SALESPERSON_DEFAULT_TARGET

    plan = _new_incentive_plan_dict(
        target_type="salesperson",
        target_id=salesperson_id,
        target_name=salesperson_id,  # Java line 741 uses id as both
        current_performance=perf,
        target_goal=target,
    )
    plan["levels"] = [_new_incentive_level_dict(*lvl) for lvl in _SALESPERSON_LEVELS]
    _update_current_level(plan)
    _generate_motivational_message(plan)
    return plan


async def _generate_department_plan(
    factory_id: str, department_id: str, range_: DateRange
) -> dict:
    """Mirror RecommendationServiceImpl.generateDepartmentIncentivePlan (line 761-790)."""
    rows = await _query_department_data(factory_id, range_, department_id)
    perf = sum(
        (
            _to_decimal(r["sales_amount"])
            for r in rows
            if r.get("sales_amount") is not None
        ),
        Decimal("0"),
    )
    target = sum(
        (
            _to_decimal(r["sales_target"])
            for r in rows
            if r.get("sales_target") is not None
        ),
        Decimal("0"),
    )
    if target == 0:
        target = _DEPARTMENT_DEFAULT_TARGET

    plan = _new_incentive_plan_dict(
        target_type="department",
        target_id=department_id,
        target_name=department_id,  # Java line 776 uses id as both
        current_performance=perf,
        target_goal=target,
    )
    plan["levels"] = [_new_incentive_level_dict(*lvl) for lvl in _DEPARTMENT_LEVELS]
    _update_current_level(plan)
    _generate_motivational_message(plan)
    return plan


async def _generate_default_plan(
    factory_id: str, target_type: str, range_: DateRange
) -> dict:
    """Mirror RecommendationServiceImpl.generateIncentivePlan (line 686-722).

    Java's inner switch only handles `department` and `salesperson`/default.
    `region` (or any other value) hits default → first salesperson path.
    URL targetId is silently ignored. See spec §5 Trap B.
    """
    target_type_lower = (target_type or "salesperson").lower()

    if target_type_lower == "department":
        rows = await _query_all_department_rows(factory_id, range_)
        if rows:
            first_dept = rows[0].get("department") or "未知"
            return await _generate_department_plan(factory_id, first_dept, range_)
    else:
        # salesperson, region, any unknown — all fall through to first-salesperson
        rows = await _query_all_sales_rows(factory_id, range_)
        if rows:
            first_sp = next(
                (
                    r["salesperson_name"]
                    for r in rows
                    if r.get("salesperson_name") is not None
                ),
                "未知",
            )
            return await _generate_salesperson_plan(factory_id, first_sp, range_)

    # Empty-data branch (Java line 718-721): preserves URL target_type
    return _new_incentive_plan_dict(
        target_type=target_type,
        motivational_message="暂无可用数据生成激励方案",
    )


# ============================================================
# Section 5: HTTP route
# ============================================================


@router.get("/api/mobile/{factory_id}/smart-bi/incentive-plan/{target_type}/{target_id}")
async def get_incentive_plan(
    factory_id: str,
    target_type: str,
    target_id: str,
    auth: AuthContext = Depends(require_analytics_read),
) -> dict[str, Any]:
    """Java-compatible alias: GET /smart-bi/incentive-plan/{targetType}/{targetId}.

    Java reference: SmartBIAnalysisController.getIncentivePlan (line 641-673).

    targetType branches:
      - salesperson: per-salesperson 4-tier ladder (铜/银/金/钻)
      - department:  per-department 3-tier ladder  (达标/优秀/卓越)
      - region:      falls through to first-salesperson plan (Java bug,
                     mirrored for byte-shape parity — spec §5 Trap B)
      - other:       returns 200 / success=false with "Unsupported target type"
    """
    range_ = DateRange.by_period("month")
    if target_type == "salesperson":
        plan = await _generate_salesperson_plan(auth.factory_id, target_id, range_)
    elif target_type == "department":
        plan = await _generate_department_plan(auth.factory_id, target_id, range_)
    elif target_type == "region":
        plan = await _generate_default_plan(auth.factory_id, target_type, range_)
    else:
        # Java line 665: ResponseEntity.ok(ApiResponse.error("Unsupported target type: ..."))
        return wrap_response(
            None,
            message=f"Unsupported target type: {target_type}",
            success=False,
        )
    return wrap_response(strip_price_for_role(plan, auth.role), message="操作成功")
