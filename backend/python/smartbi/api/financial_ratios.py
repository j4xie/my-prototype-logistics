"""
Financial Ratios Analysis API

Computes key financial ratios from SmartBI finance data:
- Profitability: ROE, ROA, Gross Margin, Net Margin
- Liquidity: Current, Quick, Cash ratios
- Efficiency: Inventory/AR/Asset turnover
- Leverage: Debt ratio, Interest coverage, Equity multiplier
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

router = APIRouter()
logger = logging.getLogger(__name__)


def _get_db_connection():
    """Get database connection from smartbi config."""
    try:
        from smartbi.database.connection import get_connection, is_postgres_enabled
        if is_postgres_enabled():
            return get_connection()
    except Exception as e:
        logger.warning(f"DB connection failed: {e}")
    return None


def _safe_div(a: float, b: float, default: float = 0.0) -> float:
    return round(a / b, 2) if b != 0 else default


def _status(value: float, benchmark: float, higher_is_better: bool = True) -> str:
    if higher_is_better:
        if value >= benchmark * 1.1:
            return "good"
        elif value >= benchmark * 0.8:
            return "warning"
        return "danger"
    else:
        if value <= benchmark * 0.9:
            return "good"
        elif value <= benchmark * 1.2:
            return "warning"
        return "danger"


@router.get("/financial-ratios")
async def get_financial_ratios(
    factory_id: Optional[str] = Query(None, alias="factoryId"),
    start_date: Optional[str] = Query(None, alias="startDate"),
    end_date: Optional[str] = Query(None, alias="endDate"),
):
    """
    Compute financial ratios from finance data.
    Falls back to demo data if DB unavailable.
    """
    try:
        conn = _get_db_connection()
        if conn and factory_id:
            result = _compute_ratios_from_db(conn, factory_id, start_date, end_date)
            if result:
                return JSONResponse(content={"success": True, "data": result, "message": "财务比率分析完成"})
    except Exception as e:
        logger.warning(f"Ratio computation failed, using demo: {e}")

    return JSONResponse(content={
        "success": True,
        "data": _generate_demo_ratios(),
        "message": "财务比率分析（演示数据）",
    })


def _compute_ratios_from_db(conn, factory_id: str, start_date: Optional[str], end_date: Optional[str]):
    """Try to compute real ratios from smartbi_finance_data."""
    try:
        cursor = conn.cursor()
        query = """
        SELECT
            COALESCE(SUM(CASE WHEN metric_type = 'revenue' THEN amount END), 0) as revenue,
            COALESCE(SUM(CASE WHEN metric_type = 'cost' THEN amount END), 0) as cost,
            COALESCE(SUM(CASE WHEN metric_type = 'net_profit' THEN amount END), 0) as net_profit,
            COALESCE(SUM(CASE WHEN metric_type = 'total_assets' THEN amount END), 0) as total_assets,
            COALESCE(SUM(CASE WHEN metric_type = 'total_equity' THEN amount END), 0) as total_equity,
            COALESCE(SUM(CASE WHEN metric_type = 'total_liabilities' THEN amount END), 0) as total_liabilities,
            COALESCE(SUM(CASE WHEN metric_type = 'current_assets' THEN amount END), 0) as current_assets,
            COALESCE(SUM(CASE WHEN metric_type = 'current_liabilities' THEN amount END), 0) as current_liabilities,
            COALESCE(SUM(CASE WHEN metric_type = 'inventory' THEN amount END), 0) as inventory,
            COALESCE(SUM(CASE WHEN metric_type = 'cash' THEN amount END), 0) as cash
        FROM smartbi_finance_data
        WHERE factory_id = %s AND deleted_at IS NULL
        """
        params = [factory_id]
        if start_date:
            query += " AND record_date >= %s"
            params.append(start_date)
        if end_date:
            query += " AND record_date <= %s"
            params.append(end_date)

        cursor.execute(query, params)
        row = cursor.fetchone()

        if not row or row[0] == 0:
            cursor.close()
            return None

        cols = ["revenue", "cost", "net_profit", "total_assets", "total_equity",
                "total_liabilities", "current_assets", "current_liabilities", "inventory", "cash"]
        data = dict(zip(cols, [float(v or 0) for v in row]))

        gross_profit = data["revenue"] - data["cost"]

        categories = [
            {
                "title": "盈利能力", "icon": "trending-up", "color": "#10B981",
                "ratios": [
                    {"name": "ROE (净资产收益率)", "value": _safe_div(data["net_profit"], data["total_equity"]) * 100,
                     "unit": "%", "benchmark": 12.0, "status": "", "description": "每单位净资产创造的净利润"},
                    {"name": "ROA (总资产收益率)", "value": _safe_div(data["net_profit"], data["total_assets"]) * 100,
                     "unit": "%", "benchmark": 6.5, "status": "", "description": "每单位总资产创造的净利润"},
                    {"name": "毛利率", "value": _safe_div(gross_profit, data["revenue"]) * 100,
                     "unit": "%", "benchmark": 30.0, "status": "", "description": "销售毛利占销售收入的比率"},
                    {"name": "净利率", "value": _safe_div(data["net_profit"], data["revenue"]) * 100,
                     "unit": "%", "benchmark": 8.0, "status": "", "description": "净利润占销售收入的比率"},
                ]
            },
            {
                "title": "流动性", "icon": "water", "color": "#3B82F6",
                "ratios": [
                    {"name": "流动比率", "value": _safe_div(data["current_assets"], data["current_liabilities"]),
                     "unit": "", "benchmark": 2.0, "status": "", "description": "流动资产/流动负债"},
                    {"name": "速动比率", "value": _safe_div(data["current_assets"] - data["inventory"], data["current_liabilities"]),
                     "unit": "", "benchmark": 1.0, "status": "", "description": "(流动资产-存货)/流动负债"},
                    {"name": "现金比率", "value": _safe_div(data["cash"], data["current_liabilities"]),
                     "unit": "", "benchmark": 0.5, "status": "", "description": "现金及等价物/流动负债"},
                ]
            },
            {
                "title": "运营效率", "icon": "cog-sync", "color": "#F59E0B",
                "ratios": [
                    {"name": "存货周转率", "value": _safe_div(data["cost"], data["inventory"]),
                     "unit": "次", "benchmark": 6.0, "status": "", "description": "年销售成本/平均存货"},
                    {"name": "总资产周转率", "value": _safe_div(data["revenue"], data["total_assets"]),
                     "unit": "次", "benchmark": 1.2, "status": "", "description": "年销售收入/平均总资产"},
                ]
            },
            {
                "title": "偿债能力", "icon": "shield-account", "color": "#EF4444",
                "ratios": [
                    {"name": "资产负债率", "value": _safe_div(data["total_liabilities"], data["total_assets"]) * 100,
                     "unit": "%", "benchmark": 50.0, "status": "", "description": "总负债/总资产"},
                    {"name": "权益乘数", "value": _safe_div(data["total_assets"], data["total_equity"]),
                     "unit": "", "benchmark": 2.0, "status": "", "description": "总资产/净资产"},
                ]
            },
        ]

        # Compute status for each ratio
        for cat in categories:
            for r in cat["ratios"]:
                higher = not (r["name"] == "资产负债率")
                r["status"] = _status(r["value"], r["benchmark"], higher)

        return {"categories": categories, "analysisDate": datetime.now().strftime("%Y-%m-%d")}

    except Exception as e:
        logger.error(f"Ratio SQL error: {e}")
        return None
    finally:
        try:
            cursor.close()
        except Exception:
            pass


def _generate_demo_ratios():
    """Generate demo financial ratios data."""
    return {
        "categories": [
            {
                "title": "盈利能力", "icon": "trending-up", "color": "#10B981",
                "ratios": [
                    {"name": "ROE (净资产收益率)", "value": 15.8, "unit": "%", "benchmark": 12.0, "status": "good",
                     "description": "每单位净资产创造的净利润"},
                    {"name": "ROA (总资产收益率)", "value": 8.2, "unit": "%", "benchmark": 6.5, "status": "good",
                     "description": "每单位总资产创造的净利润"},
                    {"name": "毛利率", "value": 35.6, "unit": "%", "benchmark": 30.0, "status": "good",
                     "description": "销售毛利占销售收入的比率"},
                    {"name": "净利率", "value": 12.3, "unit": "%", "benchmark": 8.0, "status": "good",
                     "description": "净利润占销售收入的比率"},
                ]
            },
            {
                "title": "流动性", "icon": "water", "color": "#3B82F6",
                "ratios": [
                    {"name": "流动比率", "value": 1.85, "unit": "", "benchmark": 2.0, "status": "warning",
                     "description": "流动资产/流动负债"},
                    {"name": "速动比率", "value": 1.2, "unit": "", "benchmark": 1.0, "status": "good",
                     "description": "(流动资产-存货)/流动负债"},
                    {"name": "现金比率", "value": 0.65, "unit": "", "benchmark": 0.5, "status": "good",
                     "description": "现金及等价物/流动负债"},
                ]
            },
            {
                "title": "运营效率", "icon": "cog-sync", "color": "#F59E0B",
                "ratios": [
                    {"name": "存货周转率", "value": 8.5, "unit": "次", "benchmark": 6.0, "status": "good",
                     "description": "年销售成本/平均存货"},
                    {"name": "应收账款周转率", "value": 12.3, "unit": "次", "benchmark": 10.0, "status": "good",
                     "description": "年销售收入/平均应收账款"},
                    {"name": "总资产周转率", "value": 1.5, "unit": "次", "benchmark": 1.2, "status": "good",
                     "description": "年销售收入/平均总资产"},
                ]
            },
            {
                "title": "偿债能力", "icon": "shield-account", "color": "#EF4444",
                "ratios": [
                    {"name": "资产负债率", "value": 42.5, "unit": "%", "benchmark": 50.0, "status": "good",
                     "description": "总负债/总资产"},
                    {"name": "利息保障倍数", "value": 5.8, "unit": "倍", "benchmark": 3.0, "status": "good",
                     "description": "EBIT/利息支出"},
                    {"name": "权益乘数", "value": 1.74, "unit": "", "benchmark": 2.0, "status": "good",
                     "description": "总资产/净资产"},
                ]
            },
        ],
        "analysisDate": datetime.now().strftime("%Y-%m-%d"),
    }
