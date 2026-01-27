"""
Database Repository Layer

Provides data access methods for SmartBI PostgreSQL tables.
Uses SQLAlchemy with native JSONB queries for efficient aggregation.
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from decimal import Decimal

from sqlalchemy import text, func
from sqlalchemy.orm import Session

from .models import SmartBiDynamicData, SmartBiPgFieldDefinition, SmartBiPgExcelUpload

logger = logging.getLogger(__name__)


class DynamicDataRepository:
    """Repository for dynamic data operations"""

    def __init__(self, db: Session):
        self.db = db

    def get_by_upload_id(self, factory_id: str, upload_id: int) -> List[Dict[str, Any]]:
        """Get all data rows for an upload as list of row_data dicts"""
        results = self.db.query(SmartBiDynamicData).filter(
            SmartBiDynamicData.factory_id == factory_id,
            SmartBiDynamicData.upload_id == upload_id
        ).order_by(SmartBiDynamicData.row_index).all()

        return [r.row_data for r in results]

    def get_entities_by_upload_id(self, factory_id: str, upload_id: int) -> List[SmartBiDynamicData]:
        """Get all data entities for an upload"""
        return self.db.query(SmartBiDynamicData).filter(
            SmartBiDynamicData.factory_id == factory_id,
            SmartBiDynamicData.upload_id == upload_id
        ).order_by(SmartBiDynamicData.row_index).all()

    def aggregate(
        self,
        factory_id: str,
        upload_id: int,
        group_field: str,
        measure_field: str,
        agg_func: str = "SUM"
    ) -> List[Dict[str, Any]]:
        """
        Dynamic aggregation using PostgreSQL JSONB operators.

        Args:
            factory_id: Factory ID
            upload_id: Upload record ID
            group_field: Field to group by (from row_data)
            measure_field: Field to aggregate (from row_data)
            agg_func: Aggregation function (SUM, AVG, COUNT, MIN, MAX)

        Returns:
            List of {group: str, value: float} dicts
        """
        # Validate agg_func to prevent SQL injection
        valid_funcs = {"SUM", "AVG", "COUNT", "MIN", "MAX"}
        agg_func = agg_func.upper()
        if agg_func not in valid_funcs:
            agg_func = "SUM"

        query = text(f"""
            SELECT
                row_data->>:group_field as group_value,
                {agg_func}(CAST(NULLIF(row_data->>:measure_field, '') AS DECIMAL(18,2))) as value
            FROM smart_bi_dynamic_data
            WHERE factory_id = :factory_id AND upload_id = :upload_id
              AND row_data->>:group_field IS NOT NULL
            GROUP BY row_data->>:group_field
            ORDER BY value DESC
        """)

        results = self.db.execute(query, {
            "factory_id": factory_id,
            "upload_id": upload_id,
            "group_field": group_field,
            "measure_field": measure_field
        }).fetchall()

        return [
            {"group": r[0], "value": float(r[1]) if r[1] else 0}
            for r in results
        ]

    def aggregate_multi_measure(
        self,
        factory_id: str,
        upload_id: int,
        group_field: str,
        measure_fields: List[str],
        agg_func: str = "SUM"
    ) -> List[Dict[str, Any]]:
        """
        Aggregate multiple measures by a single dimension.

        Returns:
            List of {group: str, field1: float, field2: float, ...} dicts
        """
        valid_funcs = {"SUM", "AVG", "COUNT", "MIN", "MAX"}
        agg_func = agg_func.upper()
        if agg_func not in valid_funcs:
            agg_func = "SUM"

        # Build measure columns dynamically
        measure_cols = []
        for i, field in enumerate(measure_fields):
            measure_cols.append(
                f"{agg_func}(CAST(NULLIF(row_data->>:measure_{i}, '') AS DECIMAL(18,2))) as value_{i}"
            )

        query = text(f"""
            SELECT
                row_data->>:group_field as group_value,
                {', '.join(measure_cols)}
            FROM smart_bi_dynamic_data
            WHERE factory_id = :factory_id AND upload_id = :upload_id
              AND row_data->>:group_field IS NOT NULL
            GROUP BY row_data->>:group_field
            ORDER BY value_0 DESC
        """)

        params = {
            "factory_id": factory_id,
            "upload_id": upload_id,
            "group_field": group_field
        }
        for i, field in enumerate(measure_fields):
            params[f"measure_{i}"] = field

        results = self.db.execute(query, params).fetchall()

        data = []
        for r in results:
            item = {"group": r[0]}
            for i, field in enumerate(measure_fields):
                item[field] = float(r[i + 1]) if r[i + 1] else 0
            data.append(item)

        return data

    def get_distinct_values(
        self,
        factory_id: str,
        upload_id: int,
        field_name: str
    ) -> List[str]:
        """Get distinct values for a field (for filter dropdowns)"""
        query = text("""
            SELECT DISTINCT row_data->>:field_name as value
            FROM smart_bi_dynamic_data
            WHERE factory_id = :factory_id AND upload_id = :upload_id
              AND row_data->>:field_name IS NOT NULL
            ORDER BY value
        """)

        results = self.db.execute(query, {
            "factory_id": factory_id,
            "upload_id": upload_id,
            "field_name": field_name
        }).fetchall()

        return [r[0] for r in results if r[0]]

    def sum_field(self, factory_id: str, upload_id: int, measure_field: str) -> Optional[float]:
        """Calculate sum of a numeric field"""
        query = text("""
            SELECT SUM(CAST(NULLIF(row_data->>:measure_field, '') AS DECIMAL(18,2)))
            FROM smart_bi_dynamic_data
            WHERE factory_id = :factory_id AND upload_id = :upload_id
        """)

        result = self.db.execute(query, {
            "factory_id": factory_id,
            "upload_id": upload_id,
            "measure_field": measure_field
        }).scalar()

        return float(result) if result else None

    def avg_field(self, factory_id: str, upload_id: int, measure_field: str) -> Optional[float]:
        """Calculate average of a numeric field"""
        query = text("""
            SELECT AVG(CAST(NULLIF(row_data->>:measure_field, '') AS DECIMAL(18,2)))
            FROM smart_bi_dynamic_data
            WHERE factory_id = :factory_id AND upload_id = :upload_id
        """)

        result = self.db.execute(query, {
            "factory_id": factory_id,
            "upload_id": upload_id,
            "measure_field": measure_field
        }).scalar()

        return float(result) if result else None

    def min_max_field(
        self,
        factory_id: str,
        upload_id: int,
        measure_field: str
    ) -> Tuple[Optional[float], Optional[float]]:
        """Get min and max of a numeric field"""
        query = text("""
            SELECT
                MIN(CAST(NULLIF(row_data->>:measure_field, '') AS DECIMAL(18,2))),
                MAX(CAST(NULLIF(row_data->>:measure_field, '') AS DECIMAL(18,2)))
            FROM smart_bi_dynamic_data
            WHERE factory_id = :factory_id AND upload_id = :upload_id
        """)

        result = self.db.execute(query, {
            "factory_id": factory_id,
            "upload_id": upload_id,
            "measure_field": measure_field
        }).fetchone()

        if result:
            return (
                float(result[0]) if result[0] else None,
                float(result[1]) if result[1] else None
            )
        return None, None

    def aggregate_by_period(
        self,
        factory_id: str,
        upload_id: int,
        measure_field: str
    ) -> List[Dict[str, Any]]:
        """Time series aggregation using the period column"""
        query = text("""
            SELECT
                period,
                SUM(CAST(NULLIF(row_data->>:measure_field, '') AS DECIMAL(18,2))) as value
            FROM smart_bi_dynamic_data
            WHERE factory_id = :factory_id AND upload_id = :upload_id
              AND period IS NOT NULL
            GROUP BY period
            ORDER BY period
        """)

        results = self.db.execute(query, {
            "factory_id": factory_id,
            "upload_id": upload_id,
            "measure_field": measure_field
        }).fetchall()

        return [
            {"period": r[0], "value": float(r[1]) if r[1] else 0}
            for r in results
        ]

    def find_by_json_contains(
        self,
        factory_id: str,
        json_filter: Dict[str, Any]
    ) -> List[SmartBiDynamicData]:
        """
        Find rows where row_data contains the specified JSON.
        Uses PostgreSQL @> operator with GIN index.
        """
        import json
        query = text("""
            SELECT * FROM smart_bi_dynamic_data
            WHERE factory_id = :factory_id
              AND row_data @> CAST(:json_filter AS jsonb)
        """)

        results = self.db.execute(query, {
            "factory_id": factory_id,
            "json_filter": json.dumps(json_filter)
        }).fetchall()

        # Convert to model instances
        return [
            SmartBiDynamicData(
                id=r.id,
                factory_id=r.factory_id,
                upload_id=r.upload_id,
                sheet_name=r.sheet_name,
                row_index=r.row_index,
                row_data=r.row_data,
                period=r.period,
                category=r.category,
                created_at=r.created_at
            )
            for r in results
        ]


class FieldDefinitionRepository:
    """Repository for field definition operations"""

    def __init__(self, db: Session):
        self.db = db

    def get_by_upload_id(self, upload_id: int) -> List[SmartBiPgFieldDefinition]:
        """Get all field definitions for an upload"""
        return self.db.query(SmartBiPgFieldDefinition).filter(
            SmartBiPgFieldDefinition.upload_id == upload_id
        ).order_by(SmartBiPgFieldDefinition.display_order).all()

    def get_measures(self, upload_id: int) -> List[SmartBiPgFieldDefinition]:
        """Get measure fields for an upload"""
        return self.db.query(SmartBiPgFieldDefinition).filter(
            SmartBiPgFieldDefinition.upload_id == upload_id,
            SmartBiPgFieldDefinition.is_measure == True
        ).order_by(SmartBiPgFieldDefinition.display_order).all()

    def get_dimensions(self, upload_id: int) -> List[SmartBiPgFieldDefinition]:
        """Get dimension fields for an upload"""
        return self.db.query(SmartBiPgFieldDefinition).filter(
            SmartBiPgFieldDefinition.upload_id == upload_id,
            SmartBiPgFieldDefinition.is_dimension == True
        ).order_by(SmartBiPgFieldDefinition.display_order).all()

    def get_time_fields(self, upload_id: int) -> List[SmartBiPgFieldDefinition]:
        """Get time fields for an upload"""
        return self.db.query(SmartBiPgFieldDefinition).filter(
            SmartBiPgFieldDefinition.upload_id == upload_id,
            SmartBiPgFieldDefinition.is_time == True
        ).all()


class UploadRepository:
    """Repository for upload record operations"""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, upload_id: int) -> Optional[SmartBiPgExcelUpload]:
        """Get upload record by ID"""
        return self.db.query(SmartBiPgExcelUpload).filter(
            SmartBiPgExcelUpload.id == upload_id
        ).first()

    def get_by_factory(self, factory_id: str, limit: int = 20) -> List[SmartBiPgExcelUpload]:
        """Get recent uploads for a factory"""
        return self.db.query(SmartBiPgExcelUpload).filter(
            SmartBiPgExcelUpload.factory_id == factory_id
        ).order_by(SmartBiPgExcelUpload.created_at.desc()).limit(limit).all()

    def get_by_table_type(
        self,
        factory_id: str,
        table_type: str
    ) -> List[SmartBiPgExcelUpload]:
        """Get uploads by detected table type"""
        return self.db.query(SmartBiPgExcelUpload).filter(
            SmartBiPgExcelUpload.factory_id == factory_id,
            SmartBiPgExcelUpload.detected_table_type == table_type
        ).order_by(SmartBiPgExcelUpload.created_at.desc()).all()
