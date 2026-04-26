"""Shared types for B-stage Silver-layer MVP templates."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class TemplateResult:
    """Standalone template output. Compatible with materialized_analytics.TemplateResult
    where overlapping (code/title/data/chart_config/kpis/insight_text) — but no polars
    or AnalysisTemplate ABC dependency.
    """
    code: str
    title: str
    data: Dict[str, Any]
    kpis: Dict[str, Any] = field(default_factory=dict)
    chart_config: Optional[Dict[str, Any]] = None
    insight_text: Optional[str] = None
    applies: bool = True
    skip_reason: Optional[str] = None
