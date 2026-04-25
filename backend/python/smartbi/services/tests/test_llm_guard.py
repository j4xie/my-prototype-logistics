"""Unit tests for llm_guard — detect numeric hallucinations in LLM answers."""
from __future__ import annotations

from smartbi.services.llm_guard import (
    ACTION_REC_GUARD_CLAUSE,
    LABELING_GUARD_CLAUSE,
    NUMERIC_GUARD_CLAUSE,
    detect_numeric_hallucination,
    extract_max_agg_value,
)


# ─── extract_max_agg_value ──────────────────────────────────────────────────


def test_extract_max_empty_none():
    assert extract_max_agg_value(None) == 0.0
    assert extract_max_agg_value([]) == 0.0
    assert extract_max_agg_value(["", None]) == 0.0


def test_extract_max_picks_biggest_on_line():
    lines = ["- 实收金额 总计: 29,498,641.23 (行数=140541)"]
    # 29.5M wins over 140k row count
    assert extract_max_agg_value(lines) == 29498641.23


def test_extract_max_across_lines():
    lines = [
        "- 总营收: 29,498,641.23",
        "- 券面值合计: 88,600,000.00",
        "- 行数: 140,541",
    ]
    assert extract_max_agg_value(lines) == 88_600_000.00


def test_extract_max_scans_inline_totals():
    lines = [
        "## 标题没数字",
        "- Top by 门店: 青花椒=9,500,000.00, 大丸=2,000,000.00",
    ]
    assert extract_max_agg_value(lines) == 9_500_000.00


# ─── detect_numeric_hallucination — the real observed case ──────────────────


def test_detect_3point4yi_on_36m_total_is_caught():
    """The case that triggered this work: 9× inflation of 36M → 3.4亿."""
    lines = ["- 实收金额 总计: 36,180,000.00 (行数=140,541)"]
    answer = "Top 5 门店合计达到 3.4 亿元，占总营收约 94%。"
    v = detect_numeric_hallucination(answer, lines)
    assert v is not None
    assert "3.4 亿" in v


def test_detect_clean_answer_no_yi_unit_passes():
    lines = ["- 总营收 总计: 36,180,000.00"]
    answer = "总营收 3,618 万元。Top 5 门店合计 9,500 万元，占比约 26%。"
    assert detect_numeric_hallucination(answer, lines) is None


def test_detect_legitimate_yi_when_agg_big_enough():
    # 150M actual — claiming 1.2亿 is under 2× threshold, not flagged.
    lines = ["- 总营收: 150,000,000.00"]
    answer = "全年实现营收 1.2 亿元，同比增长 12%。"
    assert detect_numeric_hallucination(answer, lines) is None


def test_detect_empty_agg_skip():
    # Nothing to compare against → return None (conservative).
    assert detect_numeric_hallucination("收入 5 亿元", []) is None
    assert detect_numeric_hallucination("收入 5 亿元", None) is None


def test_detect_tiny_agg_skip():
    # max_agg < 10k baseline → skip.
    lines = ["- 样本量: 300"]
    assert detect_numeric_hallucination("共 2 亿条记录", lines) is None


def test_detect_qianwan_unit_overshoot():
    lines = ["- 总营收: 10,000,000.00"]  # 1000万 = 1e7
    answer = "本月合计 5 千万元，远超预期。"  # 5e7, 5× overshoot
    v = detect_numeric_hallucination(answer, lines)
    assert v is not None
    assert "千万" in v


def test_detect_qianwan_within_range_passes():
    lines = ["- 总营收: 50,000,000.00"]  # 5000万
    answer = "总营收 5 千万元，月均约 417 万元。"  # exactly matches
    assert detect_numeric_hallucination(answer, lines) is None


def test_detect_multiple_violations_all_listed():
    lines = ["- 总营收: 30,000,000.00"]
    answer = "合计 3 亿元。其中门店A 1.5 亿，门店B 1.2 亿。"
    v = detect_numeric_hallucination(answer, lines)
    assert v is not None
    assert "3 亿" in v
    assert "1.5 亿" in v
    assert "1.2 亿" in v


def test_detect_empty_answer_skip():
    lines = ["- 总营收: 100,000,000.00"]
    assert detect_numeric_hallucination("", lines) is None
    assert detect_numeric_hallucination(None, lines) is None  # type: ignore[arg-type]


# ─── NUMERIC_GUARD_CLAUSE sanity ────────────────────────────────────────────


def test_guard_clause_non_empty_and_mentions_key_constraints():
    assert len(NUMERIC_GUARD_CLAUSE) > 100
    assert "亿" in NUMERIC_GUARD_CLAUSE
    assert "外推" in NUMERIC_GUARD_CLAUSE
    assert "此数据未提供" in NUMERIC_GUARD_CLAUSE


# ─── ACTION_REC_GUARD_CLAUSE sanity (Apr 25 2026 C-rec 8+9) ─────────────────


def test_action_rec_clause_has_four_components():
    """Action recommendations must be 具体/数字化/前置条件/时间窗 — verify the
    clause text covers all 4 spec §4.3 dimensions."""
    assert len(ACTION_REC_GUARD_CLAUSE) > 200
    # (a) 具体对象
    assert "具体店名" in ACTION_REC_GUARD_CLAUSE
    # (b) 数字化收益
    assert "收益区间" in ACTION_REC_GUARD_CLAUSE
    # (c) 前置条件
    assert "前置条件" in ACTION_REC_GUARD_CLAUSE
    # (d) 时间窗口
    assert "时间" in ACTION_REC_GUARD_CLAUSE


def test_action_rec_clause_bans_vague_phrases():
    """The clause must explicitly call out the most common 空泛建议 patterns
    so the LLM has examples of what NOT to write."""
    assert "加强营销" in ACTION_REC_GUARD_CLAUSE
    assert "提高服务质量" in ACTION_REC_GUARD_CLAUSE
    # Must mark vague phrases as invalid output
    assert "无效" in ACTION_REC_GUARD_CLAUSE or "不合格" in ACTION_REC_GUARD_CLAUSE


def test_action_rec_clause_includes_data_insufficient_fallback():
    """When data is insufficient, the LLM must say so honestly rather than
    invent a generic recommendation."""
    assert "数据不足" in ACTION_REC_GUARD_CLAUSE or "无法推荐" in ACTION_REC_GUARD_CLAUSE
    assert "补充" in ACTION_REC_GUARD_CLAUSE


def test_labeling_clause_still_intact():
    """Sanity check — LABELING_GUARD_CLAUSE didn't get clobbered when adding
    ACTION_REC_GUARD_CLAUSE below it."""
    assert "毛" in LABELING_GUARD_CLAUSE
    assert "净" in LABELING_GUARD_CLAUSE
    assert "按营业额" in LABELING_GUARD_CLAUSE
