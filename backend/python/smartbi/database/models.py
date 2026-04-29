"""
SQLAlchemy Models for SmartBI PostgreSQL Tables

These models mirror the Java entities for cross-platform compatibility.
Uses PostgreSQL JSONB for flexible schema storage.
"""

from datetime import datetime
from typing import Dict, List, Any, Optional

from sqlalchemy import Column, BigInteger, String, Integer, DateTime, Text, Boolean, Numeric, Enum as SAEnum, UniqueConstraint, ForeignKey
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
    agg_strategy = Column(String(20), nullable=False, default="sum")

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
            "aggStrategy": self.agg_strategy,
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


class SmartBiDashboardLayout(Base):
    """
    Dashboard layout persistence.
    Stores user-customized chart layout (position, size) per upload/sheet.
    """
    __tablename__ = "smart_bi_dashboard_layouts"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    factory_id = Column(String(50), nullable=False, index=True)
    upload_id = Column(BigInteger, nullable=False, index=True)
    sheet_index = Column(Integer, nullable=False, default=0)
    user_id = Column(BigInteger)

    layout_name = Column(String(100))
    layout_data = Column(JSONB, nullable=False)  # Full DashboardLayout JSON

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "factoryId": self.factory_id,
            "uploadId": self.upload_id,
            "sheetIndex": self.sheet_index,
            "userId": self.user_id,
            "layoutName": self.layout_name,
            "layoutData": self.layout_data,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


# ═══════════════════════════════════════════════════════════════
# W5.1 — 餐饮 BOM Layer 2+3 持久化模型
# Week 4.4 SkuFormManager + MonthlyPurchaseCalibrator 的 DB 版本
# ═══════════════════════════════════════════════════════════════


class RestaurantSkuForm(Base):
    """
    Layer 2: TOP 20 SKU 主料成本表
    客户填的 SKU 级成本清单, 精度 ±8%.
    """
    __tablename__ = "restaurant_sku_forms"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    factory_id = Column(String(64), nullable=False, index=True)
    store_id = Column(String(64), nullable=True)              # NULL = 工厂级
    sku_name = Column(String(255), nullable=False)            # 规范化后的菜品名
    category = Column(String(128), nullable=False)            # 招牌主菜 / 肉类 / ...

    total_cogs_amount = Column(Numeric(12, 2), nullable=False)  # 元/份
    selling_price = Column(Numeric(12, 2), nullable=True)
    monthly_sales_quantity = Column(Numeric(14, 2), nullable=True)

    # [{name, cost, weight_g, unit_price_per_kg}, ...]
    ingredients = Column(JSONB, nullable=True)

    uploaded_by = Column(String(64), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("factory_id", "store_id", "sku_name", name="uk_sku_forms_factory_store_sku"),
    )

    def to_dict(self) -> Dict[str, Any]:
        total_cogs = float(self.total_cogs_amount) if self.total_cogs_amount is not None else 0.0
        selling_price = float(self.selling_price) if self.selling_price is not None else None
        cogs_pct = total_cogs / selling_price if selling_price and selling_price > 0 else None
        return {
            "id": self.id,
            "factoryId": self.factory_id,
            "storeId": self.store_id,
            "skuName": self.sku_name,
            "category": self.category,
            "totalCogsAmount": round(total_cogs, 2),
            "sellingPrice": selling_price,
            "cogsPct": round(cogs_pct, 4) if cogs_pct is not None else None,
            "monthlySalesQuantity": float(self.monthly_sales_quantity) if self.monthly_sales_quantity is not None else None,
            "ingredients": self.ingredients or [],
            "uploadedBy": self.uploaded_by,
            "notes": self.notes,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class RestaurantMonthlyPurchase(Base):
    """
    Layer 3: 月度采购反推校准 (Layer A 自学习源数据)
    每月一条, 同 factory+store+period UNIQUE (重复上传 = 更新).
    """
    __tablename__ = "restaurant_monthly_purchases"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    factory_id = Column(String(64), nullable=False, index=True)
    store_id = Column(String(64), nullable=True)
    period = Column(String(16), nullable=False)               # "2026-02"

    total_purchase = Column(Numeric(14, 2), nullable=False)
    total_revenue = Column(Numeric(14, 2), nullable=False)

    # {"肉类": 180000, "海鲜": 55000, ...}
    category_breakdown = Column(JSONB, nullable=True)

    uploaded_by = Column(String(64), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("factory_id", "store_id", "period", name="uk_monthly_purchases_factory_store_period"),
    )

    @property
    def overall_ratio(self) -> float:
        """整店食材成本率 (0-1)"""
        if not self.total_revenue or float(self.total_revenue) <= 0:
            return 0.0
        return float(self.total_purchase) / float(self.total_revenue)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "factoryId": self.factory_id,
            "storeId": self.store_id,
            "period": self.period,
            "totalPurchase": float(self.total_purchase) if self.total_purchase is not None else 0.0,
            "totalRevenue": float(self.total_revenue) if self.total_revenue is not None else 0.0,
            "overallRatio": round(self.overall_ratio, 4),
            "categoryBreakdown": self.category_breakdown or {},
            "uploadedBy": self.uploaded_by,
            "notes": self.notes,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


# ═══════════════════════════════════════════════════════════════
# W6 — Restaurant Review Collection System
# ═══════════════════════════════════════════════════════════════


class RestaurantReviewSource(Base):
    """
    Customer's registered stores for review collection.
    Tracks scrape schedule and collection status per store/platform.
    """
    __tablename__ = "restaurant_review_sources"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    factory_id = Column(String(64), nullable=False, index=True)
    store_name = Column(String(255), nullable=False)
    city = Column(String(64), nullable=False, default="上海")
    platform = Column(String(32), nullable=False, default="dianping")
    shop_id = Column(String(128), nullable=True)
    scrape_schedule = Column(String(32), default="weekly")
    last_scrape_at = Column(DateTime, nullable=True)
    last_scrape_status = Column(String(32), nullable=True)
    total_reviews_collected = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("factory_id", "store_name", "platform", name="uk_review_source"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "factoryId": self.factory_id,
            "storeName": self.store_name,
            "city": self.city,
            "platform": self.platform,
            "shopId": self.shop_id,
            "scrapeSchedule": self.scrape_schedule,
            "lastScrapeAt": self.last_scrape_at.isoformat() if self.last_scrape_at else None,
            "lastScrapeStatus": self.last_scrape_status,
            "totalReviewsCollected": self.total_reviews_collected,
            "isActive": self.is_active,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class RestaurantReview(Base):
    """
    Collected reviews from upload or scrape.
    Dedup by (factory_id, store_name, review_id).
    """
    __tablename__ = "restaurant_reviews"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    factory_id = Column(String(64), nullable=False, index=True)
    source_id = Column(BigInteger, ForeignKey("restaurant_review_sources.id"), nullable=True)
    store_name = Column(String(255), nullable=False)
    review_id = Column(String(64), nullable=True)
    platform = Column(String(32), default="dianping")
    rating = Column(Numeric(3, 1), nullable=False)
    content = Column(Text, nullable=False)
    taste_score = Column(Numeric(3, 1), nullable=True)
    env_score = Column(Numeric(3, 1), nullable=True)
    service_score = Column(Numeric(3, 1), nullable=True)
    reviewer = Column(String(128), nullable=True)
    review_time = Column(DateTime, nullable=True)
    collection_source = Column(String(32), nullable=False)
    collected_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("factory_id", "store_name", "review_id", name="uk_review"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "factoryId": self.factory_id,
            "sourceId": self.source_id,
            "storeName": self.store_name,
            "reviewId": self.review_id,
            "platform": self.platform,
            "rating": float(self.rating) if self.rating is not None else None,
            "content": self.content,
            "tasteScore": float(self.taste_score) if self.taste_score is not None else None,
            "envScore": float(self.env_score) if self.env_score is not None else None,
            "serviceScore": float(self.service_score) if self.service_score is not None else None,
            "reviewer": self.reviewer,
            "reviewTime": self.review_time.isoformat() if self.review_time else None,
            "collectionSource": self.collection_source,
            "collectedAt": self.collected_at.isoformat() if self.collected_at else None,
        }
