"""Financial Dashboard Service — Orchestrates chart generation and AI analysis."""
import logging
from typing import Dict, List, Optional, Any
import pandas as pd
from .financial.registry import registry, ChartBuilderRegistry
from .financial_data_normalizer import FinancialDataNormalizer, ColumnMapping
from .financial.base import _sanitize_for_json

logger = logging.getLogger(__name__)

class FinancialDashboardService:
    def __init__(self):
        self.normalizer = FinancialDataNormalizer()
        self.registry = registry

    def generate_chart(self, chart_type: str, raw_data: pd.DataFrame,
                       year: int = 2026, period_type: str = "year",
                       start_month: int = 1, end_month: int = 12) -> Dict:
        """Generate a single chart."""
        column_mapping = self.normalizer.detect_columns(
            raw_data.columns.tolist(), raw_data
        )
        column_mapping.year = year

        df = self.normalizer.normalize(raw_data, column_mapping, {
            "period_type": period_type,
            "start_month": start_month,
            "end_month": end_month,
        })

        period = {
            "year": year,
            "period_type": period_type,
            "start_month": start_month,
            "end_month": end_month,
            "label": self.normalizer.get_months_label(start_month, end_month, year),
        }

        if chart_type == "all":
            return self.generate_dashboard(raw_data, year, period_type, start_month, end_month)

        builder = self.registry.get(chart_type)
        if not builder:
            available = self.registry.list_all()
            return {
                "success": False,
                "error": f"Unknown chart type: {chart_type}",
                "availableTypes": available,
            }

        if not builder.can_build(column_mapping):
            return {
                "success": False,
                "error": f"Insufficient data columns for {chart_type}. Required: {builder.required_columns}",
                "detectedColumns": {
                    "budget": len(column_mapping.budget_cols) > 0,
                    "actual": len(column_mapping.actual_cols) > 0,
                    "last_year": len(column_mapping.last_year_cols) > 0,
                    "category": column_mapping.category_col is not None,
                    "item": column_mapping.item_col is not None or column_mapping.label_col is not None,
                },
            }

        result = builder.build(df, column_mapping, period, year)
        result['success'] = True
        return _sanitize_for_json(result)

    def generate_dashboard(self, raw_data: pd.DataFrame,
                           year: int = 2026, period_type: str = "year",
                           start_month: int = 1, end_month: int = 12) -> Dict:
        """Generate all available charts."""
        column_mapping = self.normalizer.detect_columns(
            raw_data.columns.tolist(), raw_data
        )
        column_mapping.year = year

        df = self.normalizer.normalize(raw_data, column_mapping, {
            "period_type": period_type,
            "start_month": start_month,
            "end_month": end_month,
        })

        period = {
            "year": year,
            "period_type": period_type,
            "start_month": start_month,
            "end_month": end_month,
            "label": self.normalizer.get_months_label(start_month, end_month, year),
        }

        charts = self.registry.build_all_available(df, column_mapping, period, year)
        available = self.registry.list_available(column_mapping)

        return _sanitize_for_json({
            "success": True,
            "charts": charts,
            "availableTypes": available,
            "period": period,
            "totalCharts": len(charts),
            "successCount": sum(1 for c in charts if c.get('success', False)),
        })

    def list_templates(self) -> List[Dict]:
        """List all registered chart types."""
        return self.registry.list_all()
