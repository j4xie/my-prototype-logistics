"""Phase 2A: /analysis/department composite real impl.

Mirrors Java SmartBIServiceImpl.getComprehensiveAnalysis "department" case
(line 586-591) + envelope (line 612-613) + 4 DepartmentAnalysisServiceImpl
sub-services. Composite path always taken in prod; ?department=filter is
dead code, ignored.

See spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-department-design.md
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from smartbi_compat.api.analysis_finance import (
    _get_period_key,         # post-PR #30 calendar-year fix (Rule 2 compliant)
    _strip_volatile,         # already covers "generatedAt" key
    VOLATILE_KEYS,
    _decimal_to_number,      # FastAPI Decimal serialization parity (Rule 4)
    _to_decimal,             # safe Decimal coercion
    _utc_now_iso,            # ISO timestamp for generatedAt (volatile, stripped)
)
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.schema_compat import wrap_response

# T1 lock — inline const, NOT alert_thresholds.py 80 (different concept for /alerts)
_DEPARTMENT_TARGET_COMPLETION_RED    = Decimal("60")
_DEPARTMENT_TARGET_COMPLETION_YELLOW = Decimal("85")

# SCALE constants matching Java DepartmentAnalysisServiceImpl line 52-54
_SCALE             = Decimal("0.0001")    # SCALE=4 中间精度
_DISPLAY_SCALE     = Decimal("0.01")      # DISPLAY_SCALE=2 输出
_QUANTIZE_HALF_UP  = ROUND_HALF_UP


router = APIRouter()
