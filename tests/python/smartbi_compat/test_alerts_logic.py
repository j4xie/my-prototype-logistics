"""Task B1 TDD tests for sales alert generator helpers and logic.

Grows across B/C/D phases — only sales tests in B1.
"""
from decimal import Decimal
from types import SimpleNamespace
from smartbi_compat.api.analysis import _sum_field, _calculate_rate, _calculate_growth_rate


def test_sum_field_skips_nulls():
    rows = [
        SimpleNamespace(amount=Decimal("100")),
        SimpleNamespace(amount=None),
        SimpleNamespace(amount=Decimal("50.5")),
    ]
    assert _sum_field(rows, "amount") == Decimal("150.5")

def test_sum_field_empty_list():
    assert _sum_field([], "amount") == Decimal("0")

def test_calculate_rate_zero_denominator_returns_zero():
    assert _calculate_rate(Decimal("100"), Decimal("0")) == Decimal("0")

def test_calculate_rate_normal():
    # 50/200 * 100 = 25.0000 (scale 4)
    assert _calculate_rate(Decimal("50"), Decimal("200")) == Decimal("25.0000")

def test_calculate_growth_rate_zero_previous_returns_zero():
    assert _calculate_growth_rate(Decimal("100"), Decimal("0")) == Decimal("0")

def test_calculate_growth_rate_decline():
    # (80 - 100) / 100 * 100 = -20.0000
    assert _calculate_growth_rate(Decimal("80"), Decimal("100")) == Decimal("-20.0000")


def test_query_sales_data_returns_empty_when_postgres_disabled(monkeypatch):
    monkeypatch.setenv("POSTGRES_ENABLED", "false")
    from smartbi_compat.api.analysis import _query_sales_data
    from smartbi_compat.date_range import DateRange
    r = DateRange.by_period("month")
    rows = _query_sales_data("F999", r)
    # Lazy import inside _query_sales_data should detect disabled state and return []
    assert rows == []


def _build_alert_dict_keys():
    """Java-shape Alert: 13 declared fields + 2 derived getters (levelName, urgent)."""
    return [
        "id", "level", "category", "title", "message", "metric",
        "value", "threshold", "gapPercent", "suggestion",
        "relatedEntityId", "relatedEntityName", "createdAt",
        "levelName", "urgent",
    ]

def test_sales_completion_red_alert():
    """sum=600 / target=2000 = 30% -> below red(60) -> RED alert."""
    from smartbi_compat.api.analysis import _generate_sales_alerts
    rows = [
        SimpleNamespace(salesperson_name=None, amount=Decimal("600"),
                        monthly_target=Decimal("2000")),
    ]
    # Monkey-patch the seam
    import smartbi_compat.api.analysis as mod
    orig = mod._query_sales_data
    mod._query_sales_data = lambda f, r: rows if r.start_date.day == 1 else []
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_sales_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_sales_data = orig

    # Should produce 1 RED completion alert (and possibly growth alert if previous-month query returned [])
    completion = [a for a in alerts if a["title"] == "销售目标严重滞后"]
    assert len(completion) == 1
    a = completion[0]
    assert a["level"] == "RED"
    assert a["category"] == "sales"
    assert a["metric"] == "目标完成率"
    # value rounded to 1 decimal in title (Java: "%.1f%%"), but stored as scale 4 Decimal
    assert "30.0%" in a["message"]
    # All 15 keys must be present (13 declared + 2 derived getLevelName/isUrgent)
    assert list(a.keys()) == _build_alert_dict_keys()


def test_sales_completion_yellow_alert():
    """rate=70% -> red(60) <= rate < yellow(80) -> YELLOW alert."""
    from smartbi_compat.api.analysis import _generate_sales_alerts
    rows = [
        SimpleNamespace(salesperson_name=None, amount=Decimal("700"),
                        monthly_target=Decimal("1000")),
    ]
    import smartbi_compat.api.analysis as mod
    orig = mod._query_sales_data
    mod._query_sales_data = lambda f, r: rows if r.start_date.day == 1 else []
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_sales_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_sales_data = orig

    completion = [a for a in alerts if "目标" in a["title"]]
    assert len(completion) == 1
    assert completion[0]["level"] == "YELLOW"


def test_sales_completion_no_alert_when_above_yellow():
    """rate=90% -> above yellow(80) -> no alert."""
    from smartbi_compat.api.analysis import _generate_sales_alerts
    rows = [
        SimpleNamespace(salesperson_name=None, amount=Decimal("900"),
                        monthly_target=Decimal("1000")),
    ]
    import smartbi_compat.api.analysis as mod
    orig = mod._query_sales_data
    mod._query_sales_data = lambda f, r: rows if r.start_date.day == 1 else []
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_sales_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_sales_data = orig
    assert all("目标" not in a["title"] for a in alerts)


def test_sales_empty_returns_empty_list():
    from smartbi_compat.api.analysis import _generate_sales_alerts
    import smartbi_compat.api.analysis as mod
    orig = mod._query_sales_data
    mod._query_sales_data = lambda f, r: []
    try:
        from smartbi_compat.date_range import DateRange
        assert _generate_sales_alerts("F999", DateRange.by_period("month")) == []
    finally:
        mod._query_sales_data = orig


def test_sales_growth_rate_red_alert():
    """current=79, previous=100 -> growth=-21% -> below red(-20) -> RED alert."""
    from smartbi_compat.api.analysis import _generate_sales_alerts
    import smartbi_compat.api.analysis as mod
    orig = mod._query_sales_data

    def fake_query(factory_id, range_):
        # Current month: 79; previous month: 100 -> growth = -21% < -20 red threshold
        from datetime import date
        if range_.start_date.month == date.today().month:
            return [SimpleNamespace(salesperson_name=None,
                                    amount=Decimal("79"),
                                    monthly_target=Decimal("100"))]
        else:
            return [SimpleNamespace(salesperson_name=None,
                                    amount=Decimal("100"),
                                    monthly_target=Decimal("100"))]
    mod._query_sales_data = fake_query
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_sales_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_sales_data = orig

    growth = [a for a in alerts if a["title"] == "销售额大幅下降"]
    assert len(growth) == 1
    assert growth[0]["level"] == "RED"


def test_sales_per_salesperson_alerts_sorted_by_name():
    """Multiple salespeople below red threshold -> alerts sorted alphabetically by name."""
    from smartbi_compat.api.analysis import _generate_sales_alerts
    import smartbi_compat.api.analysis as mod
    orig = mod._query_sales_data

    rows = [
        SimpleNamespace(salesperson_name="王五", amount=Decimal("100"),
                        monthly_target=Decimal("10000")),
        SimpleNamespace(salesperson_name="李四", amount=Decimal("100"),
                        monthly_target=Decimal("10000")),
        SimpleNamespace(salesperson_name="张三", amount=Decimal("100"),
                        monthly_target=Decimal("10000")),
    ]
    mod._query_sales_data = lambda f, r: rows if r.start_date.day == 1 else []
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_sales_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_sales_data = orig

    per_person = [a for a in alerts if a["relatedEntityName"] is not None]
    names = [a["relatedEntityName"] for a in per_person]
    # Python str sort on Chinese: 张/李/王 by unicode (matches Java TreeMap natural order)
    assert names == sorted(names)
    assert len(per_person) == 3  # all 3 below red threshold
