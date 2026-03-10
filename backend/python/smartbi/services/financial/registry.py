"""Chart Builder Registry — Auto-discovers and registers all builder classes."""
import importlib
import pkgutil
import logging
from typing import Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import pandas as pd

from .base import AbstractFinancialChartBuilder
from ..financial_data_normalizer import ColumnMapping

logger = logging.getLogger(__name__)

class ChartBuilderRegistry:
    """Registry for financial chart builders. Auto-discovers builder subclasses."""

    _instance: Optional['ChartBuilderRegistry'] = None
    _builders: Dict[str, AbstractFinancialChartBuilder] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._builders = {}
        return cls._instance

    def register(self, builder: AbstractFinancialChartBuilder):
        """Register a chart builder."""
        self._builders[builder.chart_type] = builder
        logger.info(f"Registered financial chart builder: {builder.chart_type} ({builder.display_name})")

    def get(self, chart_type: str) -> Optional[AbstractFinancialChartBuilder]:
        """Get a builder by chart type."""
        return self._builders.get(chart_type)

    def list_all(self) -> List[Dict]:
        """List all registered builders."""
        return [
            {
                "chartType": b.chart_type,
                "displayName": b.display_name,
                "requiredColumns": b.required_columns,
                "description": b.description,
            }
            for b in self._builders.values()
        ]

    def list_available(self, column_mapping: ColumnMapping) -> List[Dict]:
        """List builders that can build with given column mapping."""
        available = []
        for b in self._builders.values():
            if b.can_build(column_mapping):
                available.append({
                    "chartType": b.chart_type,
                    "displayName": b.display_name,
                    "description": b.description,
                })
        return available

    def build_all_available(self, df: pd.DataFrame, column_mapping: ColumnMapping,
                            period: Dict, year: int = 2026) -> List[Dict]:
        """Build all available charts in parallel."""
        results = []
        available_builders = [b for b in self._builders.values() if b.can_build(column_mapping)]

        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {}
            for builder in available_builders:
                future = executor.submit(self._safe_build, builder, df, column_mapping, period, year)
                futures[future] = builder.chart_type

            for future in as_completed(futures):
                chart_type = futures[future]
                try:
                    result = future.result()
                    if result:
                        results.append(result)
                except Exception as e:
                    logger.error(f"Failed to build {chart_type}: {e}", exc_info=True)
                    results.append({
                        "chartType": chart_type,
                        "error": str(e),
                        "success": False,
                    })

        # Sort by display_order attribute
        results.sort(key=lambda r: next(
            (b.display_order for b in self._builders.values() if b.chart_type == r.get('chartType')),
            999
        ))
        return results

    @staticmethod
    def _safe_build(builder, df, column_mapping, period, year):
        try:
            result = builder.build(df, column_mapping, period, year)
            result['success'] = True
            return result
        except Exception as e:
            logger.error(f"Builder {builder.chart_type} failed: {e}", exc_info=True)
            return {"chartType": builder.chart_type, "error": str(e), "success": False}

    def auto_discover(self):
        """Auto-discover and register all builder classes in this package."""
        import smartbi.services.financial as pkg
        for importer, modname, ispkg in pkgutil.iter_modules(pkg.__path__):
            if modname in ('__init__', 'registry', 'base'):
                continue
            try:
                module = importlib.import_module(f'.{modname}', package='smartbi.services.financial')
                # Find all AbstractFinancialChartBuilder subclasses
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if (isinstance(attr, type) and
                        issubclass(attr, AbstractFinancialChartBuilder) and
                        attr is not AbstractFinancialChartBuilder and
                        hasattr(attr, 'chart_type') and attr.chart_type):
                        builder = attr()
                        self.register(builder)
            except Exception as e:
                logger.warning(f"Failed to load builder module {modname}: {e}")

        logger.info(f"Financial chart registry: {len(self._builders)} builders registered")


# Singleton instance — auto-discover on first import
registry = ChartBuilderRegistry()
registry.auto_discover()
