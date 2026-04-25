"""Capability FastAPI router — Day 2 skeleton.

Full integration with CapabilityCalculator + template_status lands Day 4.
Per spec 数据织网/02-A-能力驱动渲染.md §4.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/api/smartbi/capability", tags=["Capability"])


@router.get("/{factory_id}")
async def get_capability(factory_id: str, request: Request):
    """返回 factory 当前可用的 canonical 字段 + 模板解锁状态.

    Day 2: returns stub. Day 4: wires CapabilityCalculator + compute_template_status
    + suggest_unlocks.

    Note: card_status 不在此返回, FE 用本地 manifest 自行计算 (spec §2.2.3).
    """
    user_factory_id = getattr(request.state, "factory_id", None)
    if not user_factory_id:
        raise HTTPException(401, "Tenant context not set")
    if user_factory_id != factory_id:
        raise HTTPException(403, "Cross-tenant access denied")

    # Day 4: replace with real CapabilityCalculator call
    return {
        "factory_id": factory_id,
        "available_fields": [],
        "template_status": {},
        "unlock_suggestions": [],
        "time_coverage": None,  # spec §11 — B backfills, A v1.0 returns null
    }


@router.post("/{factory_id}/invalidate")
async def invalidate_cache(factory_id: str, request: Request):
    """Day 4: wires CapabilityCalculator.invalidate."""
    user_factory_id = getattr(request.state, "factory_id", None)
    if user_factory_id != factory_id:
        raise HTTPException(403)
    # Day 4: calc.invalidate(factory_id)
    return {"status": "ok"}
