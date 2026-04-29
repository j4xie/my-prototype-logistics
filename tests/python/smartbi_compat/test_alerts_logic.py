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


# ─── Finance generator tests (C1) ──────────────────────────────────────────────


def test_query_finance_data_returns_empty_when_postgres_disabled(monkeypatch):
    monkeypatch.setenv("POSTGRES_ENABLED", "false")
    from smartbi_compat.api.analysis import _query_finance_data
    from smartbi_compat.date_range import DateRange
    assert _query_finance_data("F999", DateRange.by_period("month")) == []


def test_finance_aging_red_alert():
    """receivable=5000, aging=100 days -> > red(90) -> RED alert per record."""
    from smartbi_compat.api.analysis import _generate_finance_alerts
    import smartbi_compat.api.analysis as mod
    rows = [
        SimpleNamespace(customer_name="客户A", receivable_amount=Decimal("5000"),
                        aging_days=100, budget_amount=None, actual_amount=None),
    ]
    orig = mod._query_finance_data
    mod._query_finance_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_finance_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_finance_data = orig

    aging = [a for a in alerts if a["title"] == "应收账款严重逾期"]
    assert len(aging) == 1
    assert aging[0]["level"] == "RED"
    assert "客户A" in aging[0]["message"]


def test_finance_aging_yellow_alert():
    """aging=70 between 60-90 -> YELLOW alert."""
    from smartbi_compat.api.analysis import _generate_finance_alerts
    import smartbi_compat.api.analysis as mod
    rows = [
        SimpleNamespace(customer_name="客户Y", receivable_amount=Decimal("5000"),
                        aging_days=70, budget_amount=None, actual_amount=None),
    ]
    orig = mod._query_finance_data
    mod._query_finance_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_finance_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_finance_data = orig

    aging = [a for a in alerts if a["title"] == "应收账款即将逾期"]
    assert len(aging) == 1
    assert aging[0]["level"] == "YELLOW"


def test_finance_aging_skips_zero_receivable():
    """receivable=0 -> skip aging alert even if aging > red threshold."""
    from smartbi_compat.api.analysis import _generate_finance_alerts
    import smartbi_compat.api.analysis as mod
    rows = [
        SimpleNamespace(customer_name="客户Z", receivable_amount=Decimal("0"),
                        aging_days=200, budget_amount=None, actual_amount=None),
    ]
    orig = mod._query_finance_data
    mod._query_finance_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_finance_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_finance_data = orig

    assert all(a["title"] not in ("应收账款严重逾期", "应收账款即将逾期") for a in alerts)


def test_finance_cost_variance_red_alert():
    """budget=100, actual=150 -> variance=50% > red(20) -> RED alert."""
    from smartbi_compat.api.analysis import _generate_finance_alerts
    import smartbi_compat.api.analysis as mod
    rows = [
        SimpleNamespace(customer_name=None, receivable_amount=None, aging_days=None,
                        budget_amount=Decimal("100"), actual_amount=Decimal("150")),
    ]
    orig = mod._query_finance_data
    mod._query_finance_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_finance_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_finance_data = orig

    variance = [a for a in alerts if a["title"] == "成本严重超支"]
    assert len(variance) == 1
    assert variance[0]["level"] == "RED"


def test_finance_large_receivable_red_alert():
    """sum(receivable) > red(1,000,000) -> RED alert."""
    from smartbi_compat.api.analysis import _generate_finance_alerts
    import smartbi_compat.api.analysis as mod
    rows = [
        SimpleNamespace(customer_name="客户B", receivable_amount=Decimal("1500000"),
                        aging_days=10, budget_amount=None, actual_amount=None),
    ]
    orig = mod._query_finance_data
    mod._query_finance_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_finance_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_finance_data = orig

    total = [a for a in alerts if a["title"] == "应收账款总额过高"]
    assert len(total) == 1
    assert total[0]["level"] == "RED"


def test_finance_empty_returns_empty():
    from smartbi_compat.api.analysis import _generate_finance_alerts
    import smartbi_compat.api.analysis as mod
    orig = mod._query_finance_data
    mod._query_finance_data = lambda f, r: []
    try:
        from smartbi_compat.date_range import DateRange
        assert _generate_finance_alerts("F999", DateRange.by_period("month")) == []
    finally:
        mod._query_finance_data = orig


# ─── Department generator tests (D1) ───────────────────────────────────────────


def test_query_department_data_returns_empty_when_postgres_disabled(monkeypatch):
    monkeypatch.setenv("POSTGRES_ENABLED", "false")
    from smartbi_compat.api.analysis import _query_department_data
    from smartbi_compat.date_range import DateRange
    assert _query_department_data("F999", DateRange.by_period("month")) == []


def test_department_per_capita_red_alert():
    """sales=10, headcount=1 -> per_capita=10 < red(50000) -> RED."""
    from smartbi_compat.api.analysis import _generate_department_alerts
    import smartbi_compat.api.analysis as mod
    rows = [SimpleNamespace(department="研发部", sales_amount=Decimal("10"), headcount=1)]
    orig = mod._query_department_data
    mod._query_department_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_department_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_department_data = orig

    assert len(alerts) == 1
    assert alerts[0]["level"] == "RED"
    assert "研发部" in alerts[0]["title"]


def test_department_per_capita_yellow_alert():
    """sales=70000, headcount=1 -> per_capita=70000 (between red=50K and yellow=80K) -> YELLOW."""
    from smartbi_compat.api.analysis import _generate_department_alerts
    import smartbi_compat.api.analysis as mod
    rows = [SimpleNamespace(department="销售部", sales_amount=Decimal("70000"), headcount=1)]
    orig = mod._query_department_data
    mod._query_department_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_department_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_department_data = orig

    assert len(alerts) == 1
    assert alerts[0]["level"] == "YELLOW"


def test_department_alerts_sorted_by_name():
    """Multiple departments -> output sorted alphabetically (matches Java TreeMap fix)."""
    from smartbi_compat.api.analysis import _generate_department_alerts
    import smartbi_compat.api.analysis as mod
    rows = [
        SimpleNamespace(department="销售部", sales_amount=Decimal("10"), headcount=1),
        SimpleNamespace(department="研发部", sales_amount=Decimal("10"), headcount=1),
        SimpleNamespace(department="行政部", sales_amount=Decimal("10"), headcount=1),
    ]
    orig = mod._query_department_data
    mod._query_department_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_department_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_department_data = orig

    departments = [a["title"].split()[0] for a in alerts]
    assert departments == sorted(departments)
    assert len(alerts) == 3


def test_department_empty_returns_empty():
    from smartbi_compat.api.analysis import _generate_department_alerts
    import smartbi_compat.api.analysis as mod
    orig = mod._query_department_data
    mod._query_department_data = lambda f, r: []
    try:
        from smartbi_compat.date_range import DateRange
        assert _generate_department_alerts("F999", DateRange.by_period("month")) == []
    finally:
        mod._query_department_data = orig


# ─── Aggregator tests (E1) ─────────────────────────────────────────────────────


def test_aggregator_concat_and_sort_by_severity():
    """All 3 generators contribute -> output sorted by severity DESC."""
    from smartbi_compat.api.analysis import _generate_all_alerts
    import smartbi_compat.api.analysis as mod
    sales_rows = [SimpleNamespace(salesperson_name=None, amount=Decimal("100"),
                                  monthly_target=Decimal("1000"))]  # YELLOW completion
    finance_rows = [SimpleNamespace(customer_name="X", receivable_amount=Decimal("5000"),
                                    aging_days=100, budget_amount=None, actual_amount=None)]  # RED aging
    dept_rows = [SimpleNamespace(department="研发部", sales_amount=Decimal("10"),
                                 headcount=1)]  # RED per-capita
    orig_s = mod._query_sales_data
    orig_f = mod._query_finance_data
    orig_d = mod._query_department_data
    mod._query_sales_data = lambda f, r: sales_rows if r.start_date.day == 1 else []
    mod._query_finance_data = lambda f, r: finance_rows
    mod._query_department_data = lambda f, r: dept_rows
    try:
        from smartbi_compat.date_range import DateRange
        alerts = _generate_all_alerts("F999", DateRange.by_period("month"))
    finally:
        mod._query_sales_data = orig_s
        mod._query_finance_data = orig_f
        mod._query_department_data = orig_d

    levels = [a["level"] for a in alerts]
    last_red_idx = max((i for i, l in enumerate(levels) if l == "RED"), default=-1)
    first_yellow_idx = next((i for i, l in enumerate(levels) if l == "YELLOW"), len(levels))
    assert last_red_idx < first_yellow_idx, f"levels not severity-sorted: {levels}"


def test_aggregator_empty_when_all_generators_empty():
    from smartbi_compat.api.analysis import _generate_all_alerts
    import smartbi_compat.api.analysis as mod
    orig_s = mod._query_sales_data
    orig_f = mod._query_finance_data
    orig_d = mod._query_department_data
    mod._query_sales_data = lambda f, r: []
    mod._query_finance_data = lambda f, r: []
    mod._query_department_data = lambda f, r: []
    try:
        from smartbi_compat.date_range import DateRange
        assert _generate_all_alerts("F999", DateRange.by_period("month")) == []
    finally:
        mod._query_sales_data = orig_s
        mod._query_finance_data = orig_f
        mod._query_department_data = orig_d


# ─── /recommendations tests ────────────────────────────────────────────────────


def test_recommendations_sales_product_concentration_red():
    """Single product > 60% concentration → PRODUCT_FOCUS priority 2."""
    from smartbi_compat.api.analysis import _generate_recommendations
    import smartbi_compat.api.analysis as mod
    rows = [
        SimpleNamespace(salesperson_name=None, amount=Decimal("700"), monthly_target=None,
                        product_category="A", customer_name=None),
        SimpleNamespace(salesperson_name=None, amount=Decimal("100"), monthly_target=None,
                        product_category="B", customer_name=None),
        SimpleNamespace(salesperson_name=None, amount=Decimal("100"), monthly_target=None,
                        product_category="C", customer_name=None),
    ]
    orig = mod._query_sales_data
    mod._query_sales_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        recs = _generate_recommendations("F999", DateRange.by_period("month"), "sales")
    finally:
        mod._query_sales_data = orig

    pf = [r for r in recs if r["type"] == "PRODUCT_FOCUS"]
    assert len(pf) == 1
    assert pf[0]["priority"] == 2
    assert pf[0]["typeName"] == "产品聚焦"
    assert pf[0]["highPriority"] is True


def test_recommendations_sales_variance_topseller():
    """Salesperson variance > 3x → SALES_IMPROVEMENT priority 1 with topSeller."""
    from smartbi_compat.api.analysis import _generate_recommendations
    import smartbi_compat.api.analysis as mod
    rows = [
        SimpleNamespace(salesperson_name="王五", amount=Decimal("100"), monthly_target=None,
                        product_category=None, customer_name=None),
        SimpleNamespace(salesperson_name="陈涛秀", amount=Decimal("1000"), monthly_target=None,
                        product_category=None, customer_name=None),
    ]
    orig = mod._query_sales_data
    mod._query_sales_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        recs = _generate_recommendations("F999", DateRange.by_period("month"), "sales")
    finally:
        mod._query_sales_data = orig

    si = [r for r in recs if r["type"] == "SALES_IMPROVEMENT"]
    assert len(si) == 1
    assert si[0]["priority"] == 1
    assert "陈涛秀" in si[0]["actionItems"][0]


def test_recommendations_cost_material_ratio_red():
    """Material cost > 60% of total → COST_REDUCTION priority 2."""
    from smartbi_compat.api.analysis import _generate_recommendations
    import smartbi_compat.api.analysis as mod
    rows = [
        SimpleNamespace(material_cost=Decimal("700"), labor_cost=Decimal("200"),
                        overhead_cost=Decimal("100"), receivable_amount=None, aging_days=None,
                        budget_amount=None, actual_amount=None, customer_name=None),
    ]
    orig = mod._query_finance_data
    mod._query_finance_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        recs = _generate_recommendations("F999", DateRange.by_period("month"), "finance")
    finally:
        mod._query_finance_data = orig

    cr = [r for r in recs if r["type"] == "COST_REDUCTION"]
    assert len(cr) == 1
    assert cr[0]["priority"] == 2
    assert cr[0]["typeName"] == "成本优化"


def test_recommendations_customer_top3_concentration_red():
    """Top 3 customers > 50% concentration → CUSTOMER_RETENTION priority 1."""
    from smartbi_compat.api.analysis import _generate_recommendations
    import smartbi_compat.api.analysis as mod
    rows = [
        SimpleNamespace(salesperson_name=None, amount=Decimal("1000"), monthly_target=None,
                        product_category=None, customer_name="A"),
        SimpleNamespace(salesperson_name=None, amount=Decimal("1000"), monthly_target=None,
                        product_category=None, customer_name="B"),
        SimpleNamespace(salesperson_name=None, amount=Decimal("1000"), monthly_target=None,
                        product_category=None, customer_name="C"),
        SimpleNamespace(salesperson_name=None, amount=Decimal("100"), monthly_target=None,
                        product_category=None, customer_name="D"),
        SimpleNamespace(salesperson_name=None, amount=Decimal("100"), monthly_target=None,
                        product_category=None, customer_name="E"),
    ]
    orig = mod._query_sales_data
    mod._query_sales_data = lambda f, r: rows
    try:
        from smartbi_compat.date_range import DateRange
        recs = _generate_recommendations("F999", DateRange.by_period("month"), "customer")
    finally:
        mod._query_sales_data = orig

    cr = [r for r in recs if r["type"] == "CUSTOMER_RETENTION"]
    assert len(cr) == 1
    assert cr[0]["priority"] == 1


def test_recommendations_all_aggregator_sort_by_priority():
    """All 3 generators concat → output sorted by priority ASC."""
    from smartbi_compat.api.analysis import _generate_recommendations
    import smartbi_compat.api.analysis as mod
    sales_rows = [
        SimpleNamespace(salesperson_name="A", amount=Decimal("100"), monthly_target=None,
                        product_category="X", customer_name="C1"),
        SimpleNamespace(salesperson_name="B", amount=Decimal("1000"), monthly_target=None,
                        product_category="X", customer_name="C1"),
    ]
    # Product X = 1100/1100 = 100% > 60% RED priority 2
    # Salesperson variance 1000/100 = 10x > 3 RED priority 1
    finance_rows = [
        SimpleNamespace(material_cost=Decimal("700"), labor_cost=Decimal("200"),
                        overhead_cost=Decimal("100"), receivable_amount=None, aging_days=None,
                        budget_amount=None, actual_amount=None, customer_name=None),
    ]
    # Material 70% > 60% RED priority 2
    orig_s = mod._query_sales_data
    orig_f = mod._query_finance_data
    mod._query_sales_data = lambda f, r: sales_rows
    mod._query_finance_data = lambda f, r: finance_rows
    try:
        from smartbi_compat.date_range import DateRange
        recs = _generate_recommendations("F999", DateRange.by_period("month"), None)
    finally:
        mod._query_sales_data = orig_s
        mod._query_finance_data = orig_f

    priorities = [r["priority"] for r in recs]
    assert priorities == sorted(priorities), f"not priority-ASC sorted: {priorities}"


def test_recommendations_empty_returns_empty():
    from smartbi_compat.api.analysis import _generate_recommendations
    import smartbi_compat.api.analysis as mod
    orig_s = mod._query_sales_data
    orig_f = mod._query_finance_data
    mod._query_sales_data = lambda f, r: []
    mod._query_finance_data = lambda f, r: []
    try:
        from smartbi_compat.date_range import DateRange
        assert _generate_recommendations("F999", DateRange.by_period("month"), "all") == []
    finally:
        mod._query_sales_data = orig_s
        mod._query_finance_data = orig_f
