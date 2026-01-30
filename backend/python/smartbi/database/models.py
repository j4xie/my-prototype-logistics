"""
SQLAlchemy Models for SmartBI PostgreSQL Tables

These models mirror the Java entities for cross-platform compatibility.
Uses PostgreSQL JSONB for flexible schema storage.
"""

from datetime import datetime
from typing import Dict, List, Any, Optional

from sqlalchemy import Column, BigInteger, String, Integer, DateTime, Text, Boolean, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class SmartBiPgExcelUpload(Base):
    """
    Excel upload record with metadata.
    Stores detected table type and field mappings.
    """
    __tablename__ = "smart_bi_pg_excel_uploads"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    factory_id = Column(String(50), nullable=False, index=True)
    file_name = Column(String(255))
    sheet_name = Column(String(100))

    # Detected metadata (stored as JSONB)
    detected_table_type = Column(String(50), index=True)
    detected_structure = Column(JSONB)
    field_mappings = Column(JSONB)
    context_info = Column(JSONB)

    row_count = Column(Integer)
    column_count = Column(Integer)

    upload_status = Column(String(20), default="PENDING")
    error_message = Column(Text)
    uploaded_by = Column(BigInteger)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "factoryId": self.factory_id,
            "fileName": self.file_name,
            "sheetName": self.sheet_name,
            "detectedTableType": self.detected_table_type,
            "detectedStructure": self.detected_structure,
            "fieldMappings": self.field_mappings,
            "contextInfo": self.context_info,
            "rowCount": self.row_count,
            "columnCount": self.column_count,
            "uploadStatus": self.upload_status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class SmartBiDynamicData(Base):
    """
    Dynamic data storage using JSONB.
    Each row stores complete Excel row as JSON document.
    """
    __tablename__ = "smart_bi_dynamic_data"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    factory_id = Column(String(50), nullable=False, index=True)
    upload_id = Column(BigInteger, nullable=False, index=True)
    sheet_name = Column(String(100))
    row_index = Column(Integer)

    # Complete row data as JSONB (enables GIN index queries)
    row_data = Column(JSONB, nullable=False)

    # Extracted dimensions for quick filtering
    period = Column(String(50), index=True)
    category = Column(String(100), index=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "factoryId": self.factory_id,
            "uploadId": self.upload_id,
            "sheetName": self.sheet_name,
            "rowIndex": self.row_index,
            "rowData": self.row_data,
            "period": self.period,
            "category": self.category,
        }


class SmartBiPgFieldDefinition(Base):
    """
    Field definition for dynamic data.
    Defines schema metadata for each upload.
    """
    __tablename__ = "smart_bi_pg_field_definitions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    upload_id = Column(BigInteger, nullable=False, index=True)

    original_name = Column(String(255))
    standard_name = Column(String(100))
    field_type = Column(String(50))
    semantic_type = Column(String(50))
    chart_role = Column(String(50))

    is_dimension = Column(Boolean, default=False)
    is_measure = Column(Boolean, default=False)
    is_time = Column(Boolean, default=False)

    sample_values = Column(JSONB)
    statistics = Column(JSONB)
    display_order = Column(Integer, default=0)
    format_pattern = Column(String(50))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "originalName": self.original_name,
            "standardName": self.standard_name,
            "fieldType": self.field_type,
            "semanticType": self.semantic_type,
            "chartRole": self.chart_role,
            "isDimension": self.is_dimension,
            "isMeasure": self.is_measure,
            "isTime": self.is_time,
            "sampleValues": self.sample_values,
            "statistics": self.statistics,
            "displayOrder": self.display_order,
            "formatPattern": self.format_pattern,
        }


class SmartBiPgAnalysisResult(Base):
    """
    Cached analysis results.
    Stores AI-generated insights and chart configurations.
    """
    __tablename__ = "smart_bi_pg_analysis_results"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    upload_id = Column(BigInteger, nullable=False, index=True)
    factory_id = Column(String(50), nullable=False, index=True)

    analysis_type = Column(String(50), index=True)
    analysis_result = Column(JSONB, nullable=False)
    chart_configs = Column(JSONB)
    kpi_values = Column(JSONB)
    insights = Column(JSONB)
    request_params = Column(JSONB)

    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "uploadId": self.upload_id,
            "factoryId": self.factory_id,
            "analysisType": self.analysis_type,
            "analysisResult": self.analysis_result,
            "chartConfigs": self.chart_configs,
            "kpiValues": self.kpi_values,
            "insights": self.insights,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
