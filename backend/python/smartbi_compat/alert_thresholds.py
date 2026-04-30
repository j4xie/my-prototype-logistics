"""Threshold loader mirroring Java RecommendationServiceImpl.loadAlertThresholds.

Bundled JSON copy lives at smartbi_compat/config/alert_thresholds.json (CI guard
verifies parity against Java's classpath copy at
backend/java/cretas-api/src/main/resources/config/smartbi/alert_thresholds.json).

Falls back to hardcoded Java defaults (RecommendationServiceImpl line 65-79) when
file is unreadable — matches Java behavior on IOException at startup.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

logger = logging.getLogger(__name__)

_JSON_PATH = Path(__file__).parent / "config" / "alert_thresholds.json"

ALERT_SEVERITY = {"GREEN": 0, "YELLOW": 1, "RED": 2, "CRITICAL": 3}


@dataclass(frozen=True)
class SalesThresholds:
    completion_red: Decimal
    completion_yellow: Decimal
    growth_red: Decimal
    growth_yellow: Decimal


@dataclass(frozen=True)
class FinanceThresholds:
    aging_red: int
    aging_yellow: int
    cost_variance_red: Decimal
    cost_variance_yellow: Decimal
    amount_red: Decimal
    amount_yellow: Decimal


@dataclass(frozen=True)
class DepartmentThresholds:
    per_capita_red: Decimal
    per_capita_yellow: Decimal


@dataclass(frozen=True)
class Thresholds:
    sales: SalesThresholds
    finance: FinanceThresholds
    department: DepartmentThresholds


_DEFAULTS = Thresholds(
    sales=SalesThresholds(
        completion_red=Decimal("60"),
        completion_yellow=Decimal("80"),
        growth_red=Decimal("-20"),
        growth_yellow=Decimal("-10"),
    ),
    finance=FinanceThresholds(
        aging_red=90,
        aging_yellow=60,
        cost_variance_red=Decimal("20"),
        cost_variance_yellow=Decimal("10"),
        amount_red=Decimal("1000000"),
        amount_yellow=Decimal("500000"),
    ),
    department=DepartmentThresholds(
        per_capita_red=Decimal("50000"),
        per_capita_yellow=Decimal("80000"),
    ),
)


def load_thresholds() -> Thresholds:
    """Load thresholds from bundled JSON; fall back to Java defaults on read error."""
    try:
        with open(_JSON_PATH, encoding="utf-8") as f:
            cfg = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("alert_thresholds.json unreadable, using defaults: %s", e)
        return _DEFAULTS

    sales_cfg = cfg.get("sales", {})
    finance_cfg = cfg.get("finance", {})
    dept_cfg = cfg.get("department", {})

    return Thresholds(
        sales=SalesThresholds(
            completion_red=_dec(sales_cfg, "completion_rate", "red", _DEFAULTS.sales.completion_red),
            completion_yellow=_dec(sales_cfg, "completion_rate", "yellow", _DEFAULTS.sales.completion_yellow),
            growth_red=_dec(sales_cfg, "growth_rate", "red", _DEFAULTS.sales.growth_red),
            growth_yellow=_dec(sales_cfg, "growth_rate", "yellow", _DEFAULTS.sales.growth_yellow),
        ),
        finance=FinanceThresholds(
            aging_red=_int(finance_cfg, "aging_days", "red", _DEFAULTS.finance.aging_red),
            aging_yellow=_int(finance_cfg, "aging_days", "yellow", _DEFAULTS.finance.aging_yellow),
            cost_variance_red=_dec(finance_cfg, "cost_variance", "red", _DEFAULTS.finance.cost_variance_red),
            cost_variance_yellow=_dec(finance_cfg, "cost_variance", "yellow", _DEFAULTS.finance.cost_variance_yellow),
            amount_red=_dec(finance_cfg, "receivable_amount", "red", _DEFAULTS.finance.amount_red),
            amount_yellow=_dec(finance_cfg, "receivable_amount", "yellow", _DEFAULTS.finance.amount_yellow),
        ),
        department=DepartmentThresholds(
            per_capita_red=_dec(dept_cfg, "per_capita_sales", "red", _DEFAULTS.department.per_capita_red),
            per_capita_yellow=_dec(dept_cfg, "per_capita_sales", "yellow", _DEFAULTS.department.per_capita_yellow),
        ),
    )


def _dec(parent: dict, key: str, level: str, default: Decimal) -> Decimal:
    sub = parent.get(key)
    if not isinstance(sub, dict) or level not in sub:
        return default
    return Decimal(str(sub[level]))


def _int(parent: dict, key: str, level: str, default: int) -> int:
    sub = parent.get(key)
    if not isinstance(sub, dict) or level not in sub:
        return default
    return int(sub[level])
