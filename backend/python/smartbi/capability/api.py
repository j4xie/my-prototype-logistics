"""Capability FastAPI router — full impl per 数据织网/02-A-能力驱动渲染.md §4.

Wires CapabilityCalculator (calculator.py) + compute_template_status / suggest_unlocks
(template_status.py) behind GET /api/smartbi/capability/{factory_id}.

Singleton calculator: lazy-initialized on first request (uses smartbi.config.get_pg_pool).
For lifespan-managed alternative, see spec §13 O3.
"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, HTTPException, Request

from smartbi.capability.calculator import CapabilityCalculator
from smartbi.capability.template_status import (
    compute_template_status,
    suggest_unlocks,
)

router = APIRouter(prefix="/api/smartbi/capability", tags=["Capability"])

# Module-level singleton (lazy). Multi-worker → see spec §3.4.
_calculator: Optional[CapabilityCalculator] = None


async def _get_calculator() -> CapabilityCalculator:
    """Lazy init from smartbi.config.get_pg_pool() singleton."""
    global _calculator
    if _calculator is None:
        from smartbi.config import get_pg_pool
        pool = await get_pg_pool()
        if pool is None:
            raise HTTPException(503, "Database pool not initialized")
        _calculator = CapabilityCalculator(pool)
    return _calculator


def _check_factory_access(request: Request, factory_id: str) -> None:
    """Common cross-tenant guard. spec §4.1 S4: use request.state.factory_id pattern."""
    user_factory_id = getattr(request.state, "factory_id", None)
    if not user_factory_id:
        raise HTTPException(401, "Tenant context not set")
    if user_factory_id != factory_id:
        raise HTTPException(403, "Cross-tenant access denied")


@router.get("/{factory_id}")
async def get_capability(factory_id: str, request: Request):
    """返回 factory 当前可用的 canonical 字段 + 模板解锁状态.

    Note: card_status 不在此返回, FE 用本地 manifest 自行计算 (spec §2.2.3).
    time_coverage v1.0 returns null; B 阶段 Sheet Merger backfill 后填真实数据 (spec §11).
    """
    _check_factory_access(request, factory_id)

    calc = await _get_calculator()
    available = await calc.get_capabilities(factory_id)
    template_status = compute_template_status(available)
    suggestions = suggest_unlocks(available, template_status)

    return {
        "factory_id": factory_id,
        "available_fields": sorted(available),
        "template_status": template_status,
        "unlock_suggestions": suggestions,
        "time_coverage": None,
    }


@router.post("/{factory_id}/invalidate")
async def invalidate_cache(factory_id: str, request: Request):
    """Triggered after upload completion / deletion. spec §3.2."""
    _check_factory_access(request, factory_id)
    calc = await _get_calculator()
    calc.invalidate(factory_id)
    return {"status": "ok"}
