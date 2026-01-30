from __future__ import annotations
"""
Analysis Services Module

Provides comprehensive business analysis capabilities:
- DepartmentAnalysisService: Department performance, efficiency matrix
- FinanceAnalysisService: Financial KPIs, AR/AP aging, budget analysis
- SalesAnalysisService: Sales KPIs, rankings, trends
- RegionAnalysisService: Regional hierarchy, heatmaps, opportunity scores
"""
from .department_analysis import DepartmentAnalysisService
from .finance_analysis import FinanceAnalysisService
from .sales_analysis import SalesAnalysisService
from .region_analysis import RegionAnalysisService

__all__ = [
    "DepartmentAnalysisService",
    "FinanceAnalysisService",
    "SalesAnalysisService",
    "RegionAnalysisService",
]
