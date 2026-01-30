"""
Test Analysis Persistence Service

Tests for verifying chart configs and insights are properly saved to PostgreSQL.
"""

import sys
import os
import asyncio
import logging

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.analysis_persistence import get_persistence_service, AnalysisPersistenceService
from database.connection import is_postgres_enabled, get_db_context
from database.models import SmartBiPgAnalysisResult

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_postgres_connection():
    """Test PostgreSQL connection"""
    print("\n=== Testing PostgreSQL Connection ===")

    if not is_postgres_enabled():
        print("ERROR: PostgreSQL is not enabled or connection failed")
        return False

    print("SUCCESS: PostgreSQL is enabled and connected")
    return True


def test_save_chart_configs():
    """Test saving chart configurations"""
    print("\n=== Testing Chart Config Persistence ===")

    service = get_persistence_service()

    # Test data
    factory_id = "TEST_F001"
    upload_id = 99999  # Test upload ID
    sheet_name = "Test Sheet"

    chart_configs = [
        {
            "chartType": "line",
            "title": "Test Line Chart",
            "xField": "month",
            "yFields": ["revenue"],
            "reason": "Time series data detected"
        },
        {
            "chartType": "bar",
            "title": "Test Bar Chart",
            "xField": "department",
            "yFields": ["sales"],
            "reason": "Categorical comparison"
        }
    ]

    # Save chart configs
    result = service.save_chart_configs(
        factory_id=factory_id,
        upload_id=upload_id,
        sheet_name=sheet_name,
        chart_configs=chart_configs,
        request_params={"scenario": "test"}
    )

    if result:
        print(f"SUCCESS: Saved {len(chart_configs)} chart configs")
    else:
        print("ERROR: Failed to save chart configs")
        return False

    # Verify by retrieving
    cached = service.get_cached_chart_configs(factory_id, upload_id)
    if cached and len(cached) >= len(chart_configs):
        print(f"SUCCESS: Retrieved {len(cached)} cached chart configs")
    else:
        print(f"ERROR: Expected at least {len(chart_configs)} configs, got {len(cached) if cached else 0}")
        return False

    return True


def test_save_insights():
    """Test saving insights"""
    print("\n=== Testing Insight Persistence ===")

    service = get_persistence_service()

    # Test data
    factory_id = "TEST_F001"
    upload_id = 99999  # Test upload ID

    insights = [
        {
            "type": "trend",
            "text": "Revenue increased 15% in Q4 compared to Q3",
            "metric": "revenue",
            "changeRate": 0.15,
            "sentiment": "positive",
            "importance": 0.9
        },
        {
            "type": "anomaly",
            "text": "Unusual spike in costs in December",
            "metric": "cost",
            "sentiment": "negative",
            "importance": 0.8
        }
    ]

    # Save insights
    result = service.save_insights(
        factory_id=factory_id,
        upload_id=upload_id,
        insights=insights,
        analysis_context="Test analysis"
    )

    if result:
        print(f"SUCCESS: Saved {len(insights)} insights")
    else:
        print("ERROR: Failed to save insights")
        return False

    # Verify by retrieving
    cached = service.get_cached_insights(factory_id, upload_id)
    if cached and len(cached) >= len(insights):
        print(f"SUCCESS: Retrieved {len(cached)} cached insights")
    else:
        print(f"ERROR: Expected at least {len(insights)} insights, got {len(cached) if cached else 0}")
        return False

    return True


def test_save_kpi_values():
    """Test saving KPI values"""
    print("\n=== Testing KPI Value Persistence ===")

    service = get_persistence_service()

    # Test data
    factory_id = "TEST_F001"
    upload_id = 99998  # Different test upload ID

    kpi_values = {
        "total_revenue": 1500000.00,
        "gross_profit": 250000.00,
        "profit_margin": 0.167,
        "growth_rate": 0.12
    }

    # Save KPI values
    result = service.save_kpi_values(
        factory_id=factory_id,
        upload_id=upload_id,
        kpi_values=kpi_values
    )

    if result:
        print(f"SUCCESS: Saved {len(kpi_values)} KPI values")
    else:
        print("ERROR: Failed to save KPI values")
        return False

    return True


def cleanup_test_data():
    """Clean up test data from database"""
    print("\n=== Cleaning Up Test Data ===")

    if not is_postgres_enabled():
        print("PostgreSQL not enabled, skipping cleanup")
        return

    try:
        with get_db_context() as db:
            # Delete test records
            deleted = db.query(SmartBiPgAnalysisResult).filter(
                SmartBiPgAnalysisResult.factory_id.like("TEST_%")
            ).delete(synchronize_session='fetch')
            print(f"Deleted {deleted} test records")
    except Exception as e:
        print(f"Cleanup failed: {e}")


def verify_database_state():
    """Verify database state after tests"""
    print("\n=== Verifying Database State ===")

    if not is_postgres_enabled():
        print("PostgreSQL not enabled, skipping verification")
        return

    try:
        with get_db_context() as db:
            # Count analysis results
            count = db.query(SmartBiPgAnalysisResult).filter(
                SmartBiPgAnalysisResult.factory_id.like("TEST_%")
            ).count()
            print(f"Found {count} test analysis result records")

            # Show details
            results = db.query(SmartBiPgAnalysisResult).filter(
                SmartBiPgAnalysisResult.factory_id.like("TEST_%")
            ).all()

            for r in results:
                chart_count = len(r.chart_configs) if r.chart_configs else 0
                insight_count = len(r.insights) if r.insights else 0
                kpi_count = len(r.kpi_values) if r.kpi_values else 0
                print(f"  - upload_id={r.upload_id}, type={r.analysis_type}: "
                      f"charts={chart_count}, insights={insight_count}, kpis={kpi_count}")

    except Exception as e:
        print(f"Verification failed: {e}")


def main():
    """Run all tests"""
    print("=" * 60)
    print("Analysis Persistence Service Tests")
    print("=" * 60)

    # Run tests
    all_passed = True

    if not test_postgres_connection():
        print("\nSKIPPING remaining tests - PostgreSQL not available")
        return

    if not test_save_chart_configs():
        all_passed = False

    if not test_save_insights():
        all_passed = False

    if not test_save_kpi_values():
        all_passed = False

    # Verify final state
    verify_database_state()

    # Cleanup
    cleanup_test_data()

    # Summary
    print("\n" + "=" * 60)
    if all_passed:
        print("ALL TESTS PASSED")
    else:
        print("SOME TESTS FAILED")
    print("=" * 60)


if __name__ == "__main__":
    main()
