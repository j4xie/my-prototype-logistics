"""
SmartBI E2E Test Fixtures

Provides:
- httpx async client for API testing
- Excel ground truth data from Test.xlsx
- PostgreSQL connection for data accuracy tests
"""
import os
import sys
from pathlib import Path

import pytest
import httpx
import pandas as pd

# ── Paths ──────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent  # my-prototype-logistics/
PYTHON_ROOT = PROJECT_ROOT / "backend" / "python"
EXCEL_PATH = PROJECT_ROOT / "Test.xlsx"

# Add python backend to sys.path so imports work
sys.path.insert(0, str(PYTHON_ROOT))
sys.path.insert(0, str(PYTHON_ROOT / "smartbi"))

# ── Config ─────────────────────────────────────────────────────
PYTHON_BASE = os.getenv("SMARTBI_PYTHON_URL", "http://localhost:8083")
JAVA_BASE = os.getenv("SMARTBI_JAVA_URL", "http://localhost:10010")
PG_DSN = os.getenv(
    "SMARTBI_PG_DSN",
    "postgresql://smartbi_user:smartbi_pass@localhost:5432/smartbi_db",
)


# ── httpx Client Fixtures ──────────────────────────────────────
@pytest.fixture(scope="session")
def base_url():
    return PYTHON_BASE


@pytest.fixture(scope="session")
def java_url():
    return JAVA_BASE


@pytest.fixture
async def client(base_url):
    """Async httpx client pointed at the Python service."""
    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as c:
        yield c


@pytest.fixture
async def java_client(java_url):
    """Async httpx client pointed at the Java backend."""
    async with httpx.AsyncClient(base_url=java_url, timeout=30.0) as c:
        yield c


@pytest.fixture(scope="session")
def sync_client(base_url):
    """Synchronous httpx client for non-async tests."""
    with httpx.Client(base_url=base_url, timeout=30.0) as c:
        yield c


# ── Excel Ground Truth ─────────────────────────────────────────
@pytest.fixture(scope="session")
def excel_ground_truth():
    """
    Read Test.xlsx and produce per-sheet ground truth:
      {
        "SheetName": {
          "row_count": int,
          "col_count": int,
          "columns": [...],
          "numeric_sums": {"col": sum_float, ...},
          "sample_rows": [{...}, ...],   # first 3 rows
        }
      }
    """
    if not EXCEL_PATH.exists():
        pytest.skip(f"Test.xlsx not found at {EXCEL_PATH}")

    xls = pd.ExcelFile(EXCEL_PATH)
    ground_truth = {}

    for sheet in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet)
        numeric_cols = df.select_dtypes(include="number").columns
        ground_truth[sheet] = {
            "row_count": len(df),
            "col_count": len(df.columns),
            "columns": list(df.columns),
            "numeric_sums": {
                c: float(df[c].sum()) for c in numeric_cols
            },
            "sample_rows": df.head(3).to_dict("records"),
        }

    return ground_truth


# ── PostgreSQL Engine (lazy) ───────────────────────────────────
@pytest.fixture(scope="session")
def pg_engine():
    """SQLAlchemy engine for smartbi_db, skips if unavailable."""
    try:
        from sqlalchemy import create_engine, text

        engine = create_engine(PG_DSN, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return engine
    except Exception as exc:
        pytest.skip(f"PostgreSQL unavailable: {exc}")


# ── Sample Data Fixtures ───────────────────────────────────────
@pytest.fixture
def sample_bar_data():
    """Sample bar chart data with an outlier for anomaly detection."""
    return [
        {"category": "A", "value": 100},
        {"category": "B", "value": 120},
        {"category": "C", "value": 110},
        {"category": "D", "value": 130},
        {"category": "E", "value": 115},
        {"category": "F", "value": 125},
        {"category": "G", "value": 9999},  # outlier
    ]


@pytest.fixture
def sample_line_data():
    """Sample time series data for line chart + forecast."""
    return [
        {"month": "2024-01", "revenue": 1000},
        {"month": "2024-02", "revenue": 1100},
        {"month": "2024-03", "revenue": 1050},
        {"month": "2024-04", "revenue": 1200},
        {"month": "2024-05", "revenue": 1300},
        {"month": "2024-06", "revenue": 1250},
        {"month": "2024-07", "revenue": 1400},
        {"month": "2024-08", "revenue": 1500},
        {"month": "2024-09", "revenue": 1450},
        {"month": "2024-10", "revenue": 1600},
    ]


@pytest.fixture
def sample_profit_data():
    """Sample profit data for insight generation."""
    return [
        {"产品": "产品A", "营业收入": 5000, "成本": 3000, "利润": 2000},
        {"产品": "产品B", "营业收入": 8000, "成本": 5500, "利润": 2500},
        {"产品": "产品C", "营业收入": 3000, "成本": 2800, "利润": 200},
        {"产品": "产品D", "营业收入": 12000, "成本": 7000, "利润": 5000},
        {"产品": "产品E", "营业收入": 6000, "成本": 4500, "利润": 1500},
    ]


@pytest.fixture
def sample_quick_summary_data():
    """3-row data for quick-summary sum verification."""
    return [
        {"name": "Alice", "revenue": 1000, "cost": 500},
        {"name": "Bob", "revenue": 1500, "cost": 700},
        {"name": "Carol", "revenue": 2000, "cost": 900},
    ]
