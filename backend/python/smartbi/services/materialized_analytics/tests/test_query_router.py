"""test_query_router.py"""
from smartbi.services.materialized_analytics.query_router import (
    match_template, format_cached_as_sse,
)


def test_dish_sales_query():
    assert match_template("哪些菜品一个月的销量") == "dish_sales_top_n"
    assert match_template("商品销量最高的是什么") == "dish_sales_top_n"
    assert match_template("菜品销售 Top") == "dish_sales_top_n"


def test_dish_slow_query():
    # "滞销" keyword triggers the more specific template
    assert match_template("哪些菜品卖得不好") == "dish_slow_movers"
    assert match_template("滞销菜品有哪些") == "dish_slow_movers"


def test_time_slot_query():
    assert match_template("上午和下午每个区域的营业额") == "time_slot_revenue"


def test_member_query():
    assert match_template("会员每月消费金额和频次") == "member_consumption"


def test_refund_query():
    assert match_template("哪些菜品退菜次数多") == "refund_analysis"


def test_category_query():
    assert match_template("某一分类的销量") == "dish_category_breakdown"


def test_table_type_query():
    # Pure table-type comparison (no dish/点单 keyword) routes to table_type_comparison.
    # When the query ALSO mentions 菜品/点单/点菜/偏好 the more specific
    # dish_by_table_type wins (Apr 24 2026 W4 routing per query_router.py:44 comment).
    assert match_template("包厢和大厅客单价对比") == "table_type_comparison"
    assert match_template("包厢跟大厅客人的点单数量") == "dish_by_table_type"


def test_weekday_weekend_query():
    assert match_template("工作日和周末的营业额对比") == "weekday_weekend_pattern"


def test_generic_trend_query():
    # period_comparison_trend was added in W4 (Apr 22 2026) and is intentionally
    # more specific — it claims any query carrying 月度/同比/环比 OR 趋势 keyword.
    # monthly_trend is the broader fallback for 走势/变化 phrasing combined with a
    # period dim (日/周/时间) but without 趋势/月度 — those are now period_comparison_trend.
    assert match_template("营业额的月度走势如何") == "period_comparison_trend"
    assert match_template("每日销售走势") == "monthly_trend"


def test_no_match_returns_none():
    assert match_template("今天天气怎么样") is None
    assert match_template("") is None


def test_format_cached_as_sse_builds_answer():
    tpl = {
        "code": "dish_sales_top_n",
        "title": "菜品销量 Top 20",
        "insight_text": "招牌青花椒鱼销量 Top 1,卖出 100 份。",
        "chart_config": {"type": "bar", "series": []},
        "kpis": {"top_dish": "招牌青花椒鱼", "top_qty": 100, "top_revenue": 5800.50},
    }
    payload = format_cached_as_sse(tpl, "菜品销量")
    assert "菜品销量 Top 20" in payload["answer"]
    assert "招牌青花椒鱼" in payload["answer"]
    assert payload["charts"][0]["type"] == "bar"
    assert payload["template_code"] == "dish_sales_top_n"
    assert payload["source"] == "materialized_cache"


def test_format_cached_no_chart_config():
    tpl = {
        "code": "anomaly_detection", "title": "异常值检测",
        "insight_text": "发现 0 条异常。",
        "chart_config": None, "kpis": {"outlier_count": 0},
    }
    payload = format_cached_as_sse(tpl, "异常")
    assert payload["charts"] == []
    assert "异常值检测" in payload["answer"]
