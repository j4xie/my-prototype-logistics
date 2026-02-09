"""
Analysis Persistence Service

Automatically persists LLM-generated chart configurations and insights to PostgreSQL.
Prevents data loss on service restart and avoids redundant LLM calls.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from smartbi.database.connection import get_db_context, is_postgres_enabled
from smartbi.database.models import SmartBiPgAnalysisResult, SmartBiPgExcelUpload

logger = logging.getLogger(__name__)


class AnalysisPersistenceService:
    """
    Persists analysis results (chart configs, insights, KPIs) to PostgreSQL.

    Key features:
    - Auto-merges new results with existing records
    - Supports factory_id + upload_id composite key lookup
    - Falls back gracefully when PostgreSQL is unavailable
    """

    def save_chart_configs(
        self,
        factory_id: str,
        upload_id: int,
        sheet_name: Optional[str],
        chart_configs: List[Dict[str, Any]],
        request_params: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Save chart configurations to database.

        Args:
            factory_id: Factory identifier
            upload_id: Excel upload record ID
            sheet_name: Sheet name (optional, for context)
            chart_configs: List of chart configuration objects
            request_params: Original request parameters (for debugging)

        Returns:
            True if saved successfully, False otherwise
        """
        if not is_postgres_enabled():
            logger.warning("PostgreSQL not enabled, chart configs not persisted")
            return False

        if not chart_configs:
            logger.debug("No chart configs to save")
            return True

        try:
            with get_db_context() as db:
                # Find existing record for this upload
                result = db.query(SmartBiPgAnalysisResult).filter(
                    SmartBiPgAnalysisResult.factory_id == factory_id,
                    SmartBiPgAnalysisResult.upload_id == upload_id,
                    SmartBiPgAnalysisResult.analysis_type == "chart_recommendation"
                ).first()

                if result:
                    # Merge with existing chart configs
                    existing = result.chart_configs or []
                    # Deduplicate by chart type + title
                    existing_keys = {
                        (c.get("chartType"), c.get("title"))
                        for c in existing
                    }
                    new_configs = [
                        c for c in chart_configs
                        if (c.get("chartType"), c.get("title")) not in existing_keys
                    ]
                    result.chart_configs = existing + new_configs
                    if request_params:
                        result.request_params = request_params
                    logger.info(f"Updated chart configs for upload {upload_id}: +{len(new_configs)} charts")
                else:
                    # Create new record
                    result = SmartBiPgAnalysisResult(
                        factory_id=factory_id,
                        upload_id=upload_id,
                        analysis_type="chart_recommendation",
                        analysis_result={"sheet_name": sheet_name},
                        chart_configs=chart_configs,
                        request_params=request_params
                    )
                    db.add(result)
                    logger.info(f"Created chart configs for upload {upload_id}: {len(chart_configs)} charts")

                # Commit handled by get_db_context
                return True

        except Exception as e:
            logger.error(f"Failed to save chart configs: {e}", exc_info=True)
            return False

    def save_insights(
        self,
        factory_id: str,
        upload_id: int,
        insights: List[Dict[str, Any]],
        analysis_context: Optional[str] = None
    ) -> bool:
        """
        Save AI-generated insights to database.

        Args:
            factory_id: Factory identifier
            upload_id: Excel upload record ID
            insights: List of insight objects
            analysis_context: Analysis context description

        Returns:
            True if saved successfully, False otherwise
        """
        if not is_postgres_enabled():
            logger.warning("PostgreSQL not enabled, insights not persisted")
            return False

        if not insights:
            logger.debug("No insights to save")
            return True

        try:
            with get_db_context() as db:
                # Find existing record for this upload
                result = db.query(SmartBiPgAnalysisResult).filter(
                    SmartBiPgAnalysisResult.factory_id == factory_id,
                    SmartBiPgAnalysisResult.upload_id == upload_id,
                    SmartBiPgAnalysisResult.analysis_type == "insight_generation"
                ).first()

                if result:
                    # Merge with existing insights
                    existing = result.insights or []
                    # Deduplicate by insight text (first 100 chars)
                    existing_texts = {
                        i.get("text", "")[:100]
                        for i in existing
                    }
                    new_insights = [
                        i for i in insights
                        if i.get("text", "")[:100] not in existing_texts
                    ]
                    result.insights = existing + new_insights
                    logger.info(f"Updated insights for upload {upload_id}: +{len(new_insights)} insights")
                else:
                    # Create new record
                    result = SmartBiPgAnalysisResult(
                        factory_id=factory_id,
                        upload_id=upload_id,
                        analysis_type="insight_generation",
                        analysis_result={"context": analysis_context},
                        insights=insights
                    )
                    db.add(result)
                    logger.info(f"Created insights for upload {upload_id}: {len(insights)} insights")

                return True

        except Exception as e:
            logger.error(f"Failed to save insights: {e}", exc_info=True)
            return False

    def save_kpi_values(
        self,
        factory_id: str,
        upload_id: int,
        kpi_values: Dict[str, Any]
    ) -> bool:
        """
        Save calculated KPI values to database.

        Args:
            factory_id: Factory identifier
            upload_id: Excel upload record ID
            kpi_values: Dictionary of KPI values

        Returns:
            True if saved successfully, False otherwise
        """
        if not is_postgres_enabled():
            logger.warning("PostgreSQL not enabled, KPI values not persisted")
            return False

        if not kpi_values:
            logger.debug("No KPI values to save")
            return True

        try:
            with get_db_context() as db:
                # Find existing record for this upload
                result = db.query(SmartBiPgAnalysisResult).filter(
                    SmartBiPgAnalysisResult.factory_id == factory_id,
                    SmartBiPgAnalysisResult.upload_id == upload_id,
                    SmartBiPgAnalysisResult.analysis_type == "kpi_calculation"
                ).first()

                if result:
                    # Merge KPI values
                    existing = result.kpi_values or {}
                    existing.update(kpi_values)
                    result.kpi_values = existing
                    logger.info(f"Updated KPI values for upload {upload_id}")
                else:
                    # Create new record
                    result = SmartBiPgAnalysisResult(
                        factory_id=factory_id,
                        upload_id=upload_id,
                        analysis_type="kpi_calculation",
                        analysis_result={},
                        kpi_values=kpi_values
                    )
                    db.add(result)
                    logger.info(f"Created KPI values for upload {upload_id}")

                return True

        except Exception as e:
            logger.error(f"Failed to save KPI values: {e}", exc_info=True)
            return False

    def get_cached_chart_configs(
        self,
        factory_id: str,
        upload_id: int
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Retrieve cached chart configurations from database.

        Args:
            factory_id: Factory identifier
            upload_id: Excel upload record ID

        Returns:
            List of chart configs if found, None otherwise
        """
        if not is_postgres_enabled():
            return None

        try:
            with get_db_context() as db:
                result = db.query(SmartBiPgAnalysisResult).filter(
                    SmartBiPgAnalysisResult.factory_id == factory_id,
                    SmartBiPgAnalysisResult.upload_id == upload_id,
                    SmartBiPgAnalysisResult.analysis_type == "chart_recommendation"
                ).first()

                if result and result.chart_configs:
                    logger.debug(f"Cache hit: {len(result.chart_configs)} chart configs for upload {upload_id}")
                    return result.chart_configs

                return None

        except Exception as e:
            logger.error(f"Failed to get cached chart configs: {e}")
            return None

    def get_cached_insights(
        self,
        factory_id: str,
        upload_id: int
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Retrieve cached insights from database.

        Args:
            factory_id: Factory identifier
            upload_id: Excel upload record ID

        Returns:
            List of insights if found, None otherwise
        """
        if not is_postgres_enabled():
            return None

        try:
            with get_db_context() as db:
                result = db.query(SmartBiPgAnalysisResult).filter(
                    SmartBiPgAnalysisResult.factory_id == factory_id,
                    SmartBiPgAnalysisResult.upload_id == upload_id,
                    SmartBiPgAnalysisResult.analysis_type == "insight_generation"
                ).first()

                if result and result.insights:
                    logger.debug(f"Cache hit: {len(result.insights)} insights for upload {upload_id}")
                    return result.insights

                return None

        except Exception as e:
            logger.error(f"Failed to get cached insights: {e}")
            return None

    def get_latest_upload_id(self, factory_id: str) -> Optional[int]:
        """
        Get the most recent successful upload ID for a factory.

        Args:
            factory_id: Factory identifier

        Returns:
            Upload ID if found, None otherwise
        """
        if not is_postgres_enabled():
            return None

        try:
            with get_db_context() as db:
                upload = db.query(SmartBiPgExcelUpload).filter(
                    SmartBiPgExcelUpload.factory_id == factory_id,
                    SmartBiPgExcelUpload.upload_status == "COMPLETED"
                ).order_by(SmartBiPgExcelUpload.created_at.desc()).first()

                if upload:
                    return upload.id

                return None

        except Exception as e:
            logger.error(f"Failed to get latest upload ID: {e}")
            return None


# Global singleton instance
_persistence_service: Optional[AnalysisPersistenceService] = None


def get_persistence_service() -> AnalysisPersistenceService:
    """Get or create the persistence service singleton."""
    global _persistence_service
    if _persistence_service is None:
        _persistence_service = AnalysisPersistenceService()
    return _persistence_service
