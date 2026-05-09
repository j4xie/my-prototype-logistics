"""Memory admin endpoints for diagnosing RSS growth.

GET  /api/smartbi/admin/memory/status  → current snapshot (RSS/LazyFree/gc)
POST /api/smartbi/admin/memory/trim    → force gc.collect + malloc_trim

Internal tooling — no JWT auth layer, but protected by the X-Internal-Secret
header check the rest of /admin/* uses. Do not wire into public routes.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, Request

from smartbi.services.memory_cleanup import (
    get_memory_snapshot,
    release_and_trim,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/status")
async def memory_status() -> Dict[str, Any]:
    """Read-only — safe to call from monitoring."""
    return {"ok": True, "snapshot": get_memory_snapshot()}


@router.post("/trim")
async def memory_trim(request: Request) -> Dict[str, Any]:
    """Force gc.collect + libc malloc_trim. Returns RSS delta."""
    label = request.query_params.get("label", "manual")
    result = release_and_trim(label=label)
    return {"ok": True, "result": result}
