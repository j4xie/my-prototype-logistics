"""Tests for the N/frequency/role intent extractor.

Apr 24 2026 — C-quality.md C-rec 12 + Direction 1 backlog.
"""
from smartbi.services.intent.query_intent_extractor import (
    extract_intent,
    role_to_column,
)


# ── N extraction ───────────────────────────────────────────────────

def test_extract_n_chinese_qian():
    assert extract_intent("前 5 名菜品").get('n') == 5
    assert extract_intent("前3员工").get('n') == 3
    assert extract_intent("前 10 个店铺").get('n') == 10
    assert extract_intent("首5个店铺").get('n') == 5
    assert extract_intent("前7位服务员").get('n') == 7


def test_extract_n_english_top():
    assert extract_intent("Top 10 stores").get('n') == 10
    assert extract_intent("top-5 dishes").get('n') == 5
    assert extract_intent("TOP_3 餐饮").get('n') == 3
    assert extract_intent("top  20 results").get('n') == 20


def test_extract_n_chinese_pai():
    assert extract_intent("排前5的菜品").get('n') == 5
    assert extract_intent("排名10").get('n') == 10


def test_extract_n_sanity_bound_high():
    # 999 should be rejected (>100 ceiling)
    assert 'n' not in extract_intent("Top 999 stores")
    assert 'n' not in extract_intent("前 500 名")


def test_extract_n_sanity_bound_low():
    # 0 / negative don't make sense for top-N
    assert 'n' not in extract_intent("Top 0 stores")


def test_extract_n_no_match():
    assert 'n' not in extract_intent("员工业绩排名")
    assert 'n' not in extract_intent("销售情况")


# ── Frequency extraction ───────────────────────────────────────────

def test_extract_frequency_monthly():
    assert extract_intent("按月销售趋势").get('frequency') == 'monthly'
    assert extract_intent("每月营业额").get('frequency') == 'monthly'
    assert extract_intent("月度报表").get('frequency') == 'monthly'
    assert extract_intent("按月份统计").get('frequency') == 'monthly'


def test_extract_frequency_weekly():
    assert extract_intent("按周营业额").get('frequency') == 'weekly'
    assert extract_intent("每周订单数").get('frequency') == 'weekly'
    assert extract_intent("weekly trend").get('frequency') == 'weekly'


def test_extract_frequency_daily():
    assert extract_intent("按日订单").get('frequency') == 'daily'
    assert extract_intent("日均订单数").get('frequency') == 'daily'
    assert extract_intent("daily revenue").get('frequency') == 'daily'


def test_extract_frequency_yearly():
    assert extract_intent("年度业绩").get('frequency') == 'yearly'
    assert extract_intent("按年统计").get('frequency') == 'yearly'


def test_extract_frequency_no_match():
    assert 'frequency' not in extract_intent("销售情况")
    assert 'frequency' not in extract_intent("Top 10 stores")


# ── Role extraction ────────────────────────────────────────────────

def test_extract_role_waiter():
    assert extract_intent("Top 5 服务员").get('role') == 'staff:waiter'
    assert extract_intent("服务员业绩").get('role') == 'staff:waiter'
    assert extract_intent("前厅人员排名").get('role') == 'staff:waiter'


def test_extract_role_cashier():
    assert extract_intent("收银员业绩").get('role') == 'staff:cashier'
    assert extract_intent("Top 3 收银").get('role') == 'staff:cashier'


def test_extract_role_chef():
    assert extract_intent("厨师效率").get('role') == 'staff:chef'
    assert extract_intent("后厨表现").get('role') == 'staff:chef'
    assert extract_intent("主厨排名").get('role') == 'staff:chef'


def test_extract_role_manager():
    assert extract_intent("店长业绩").get('role') == 'staff:manager'
    assert extract_intent("经理排名").get('role') == 'staff:manager'


def test_extract_role_no_match():
    assert 'role' not in extract_intent("销售情况")
    assert 'role' not in extract_intent("Top 5 菜品")


def test_extract_role_specificity_order():
    # 收银员 must NOT be misclassified as waiter despite both being staff
    assert extract_intent("收银员").get('role') == 'staff:cashier'
    # 经理 must NOT match 服务员 even though both are staff terms
    assert extract_intent("经理").get('role') == 'staff:manager'


# ── Combined intent ────────────────────────────────────────────────

def test_combined_n_role():
    intent = extract_intent("Top 5 服务员")
    assert intent['n'] == 5
    assert intent['role'] == 'staff:waiter'
    assert 'frequency' not in intent


def test_combined_n_role_freq():
    intent = extract_intent("Top 5 服务员按月业绩")
    assert intent['n'] == 5
    assert intent['role'] == 'staff:waiter'
    assert intent['frequency'] == 'monthly'


def test_combined_chinese_n_role():
    intent = extract_intent("前 3 名厨师")
    assert intent['n'] == 3
    assert intent['role'] == 'staff:chef'


def test_combined_freq_only():
    intent = extract_intent("按月销售趋势")
    assert intent.get('frequency') == 'monthly'
    assert 'n' not in intent
    assert 'role' not in intent


# ── Edge cases ─────────────────────────────────────────────────────

def test_no_signals_empty():
    assert extract_intent("") == {}
    assert extract_intent(None) == {}
    assert extract_intent("   ") == {}


def test_no_signals_irrelevant():
    assert extract_intent("hello world") == {}
    assert extract_intent("一般查询无关键词") == {}


def test_extra_whitespace():
    intent = extract_intent("  Top 5  服务员  ")
    assert intent['n'] == 5
    assert intent['role'] == 'staff:waiter'


def test_dish_top_n_no_role():
    # "畅销品 Top 5" should set N but NOT mistakenly set a role
    intent = extract_intent("畅销品 Top 5")
    assert intent['n'] == 5
    assert 'role' not in intent


# ── role_to_column helper ──────────────────────────────────────────

def test_role_to_column_known():
    assert role_to_column('staff:waiter') == '服务员'
    assert role_to_column('staff:cashier') == '收银员'
    assert role_to_column('staff:chef') == '厨师'
    assert role_to_column('staff:manager') == '店长'


def test_role_to_column_unknown():
    assert role_to_column(None) is None
    assert role_to_column('') is None
    assert role_to_column('staff:bogus') is None


# ── format_cached_as_sse integration ───────────────────────────────
# These guard the wiring between extractor → cached SSE renderer so a
# regression in either side fails fast.

def _make_cached_template(role_col: str = '服务员', n_ranking: int = 10):
    """Build a minimal cached template_result dict mimicking what
    persistence.load_materialization_results returns."""
    ranking = [
        {'staff': f'员工{i}', 'orders': 100 - i, 'revenue': 10000 - i * 100}
        for i in range(n_ranking)
    ]
    rev = [r['revenue'] for r in ranking]
    names = [r['staff'] for r in ranking]
    return {
        'code': 'staff_performance',
        'title': '员工业绩排名',
        'insight_text': f'{role_col} Top 1: {names[0]}',
        'data': {'role_type': role_col, 'ranking': ranking},
        'kpis': {'role_type': role_col, 'top_staff': names[0]},
        'chart_config': {
            'type': 'bar',
            'title': {'text': f'{role_col}业绩排名 Top {n_ranking}'},
            'yAxis': {'type': 'category', 'data': names[::-1]},
            'series': [{'name': '营收', 'type': 'bar', 'data': rev[::-1]}],
        },
    }


def test_format_cached_reslices_topn():
    from smartbi.services.materialized_analytics.query_router import (
        format_cached_as_sse,
    )
    tpl = _make_cached_template(n_ranking=10)
    result = format_cached_as_sse(tpl, '前 3 名服务员', intent_signals={'n': 3})
    chart_data = result['charts'][0]['option']['series'][0]['data']
    # 3 entries (was 10), highest 3 preserved (in horizontal-bar reversed
    # order: lowest of top-3 first, top first last).
    assert len(chart_data) == 3
    # Original revenues for top-3 are 10000, 9900, 9800 — those should be
    # the surviving values.
    assert sorted(chart_data, reverse=True) == [10000, 9900, 9800]
    # Title rewritten
    assert 'Top 3' in result['charts'][0]['option']['title']['text']


def test_format_cached_no_n_keeps_full_ranking():
    from smartbi.services.materialized_analytics.query_router import (
        format_cached_as_sse,
    )
    tpl = _make_cached_template(n_ranking=10)
    result = format_cached_as_sse(tpl, '员工业绩', intent_signals={})
    chart_data = result['charts'][0]['option']['series'][0]['data']
    assert len(chart_data) == 10  # untouched


def test_format_cached_role_mismatch_annotation():
    from smartbi.services.materialized_analytics.query_router import (
        format_cached_as_sse,
    )
    # Cache has 服务员 but user asked 收银员 → answer should explain
    tpl = _make_cached_template(role_col='服务员')
    result = format_cached_as_sse(
        tpl, '收银员业绩', intent_signals={'role': 'staff:cashier'},
    )
    assert '收银员' in result['answer']
    assert '服务员' in result['answer']
    assert '提示' in result['answer']


def test_format_cached_role_match_no_annotation():
    from smartbi.services.materialized_analytics.query_router import (
        format_cached_as_sse,
    )
    # Cache has 服务员 and user asked 服务员 → no extra hint
    tpl = _make_cached_template(role_col='服务员')
    result = format_cached_as_sse(
        tpl, '服务员业绩', intent_signals={'role': 'staff:waiter'},
    )
    assert '提示' not in result['answer']


def test_format_cached_n_doesnt_widen_beyond_cache():
    from smartbi.services.materialized_analytics.query_router import (
        format_cached_as_sse,
    )
    tpl = _make_cached_template(n_ranking=5)
    # Cache only has 5; user asks for 10 → cache stays 5, no error
    result = format_cached_as_sse(tpl, 'Top 10 员工', intent_signals={'n': 10})
    chart_data = result['charts'][0]['option']['series'][0]['data']
    assert len(chart_data) == 5
