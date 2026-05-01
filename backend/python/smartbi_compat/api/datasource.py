"""Phase 2A /datasource GET endpoints port (Wave 2 Tier 1).

Implements 2 GET endpoints:
  - GET /api/mobile/{factoryId}/smart-bi/datasource/{datasourceId}/fields
  - GET /api/mobile/{factoryId}/smart-bi/datasource/{datasourceId}/history

/preview endpoint deferred to Wave 3 (separate chat) — see spec §1.2.

Java reference:
  - Controller: SmartBIAnalysisController.java line 747-780
  - Service: SmartBiSchemaServiceImpl.java line 225-298

Spec: docs/superpowers/specs/2026-05-01-phase2a-datasource-gets-design.md
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.schema_compat import wrap_response

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Section 1: SQL helpers (cretas_db pool, mirrors PR #23 pattern)
# ============================================================


async def _get_cretas_pool():
    """Lazy import to avoid module-load cycle. Mirrors profit/cost pattern."""
    try:
        from smartbi.config import get_cretas_pool  # type: ignore
        return await get_cretas_pool()
    except Exception as e:
        logger.warning("[datasource] cretas pool acquisition failed: %s", e)
        return None


# ============================================================
# Section 2: DTO transformers (snake_case DB → camelCase JSON)
# Key order matches golden recording (Lombok @Data getter reflection order)
# ============================================================


# (transformers added in B.1 + C.1)


# ============================================================
# Section 3: Route handlers
# ============================================================


# (handlers added in B.1 + C.1)
