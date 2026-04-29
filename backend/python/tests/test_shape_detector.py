"""Unit tests for ShapeDetector — rule path + LLM fallback path."""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from smartbi.canonical.shape_detector import (
    DetectionResult,
    FileShape,
    ShapeDetector,
)


# --- Rule path -----------------------------------------------------------


async def test_rule_bill_flow_high_confidence():
    """Bill flow rule: 账单号 + 营业日期 + 商品信息 → BILL_FLOW @0.95."""
    detector = ShapeDetector()
    result = await detector.detect(
        sample_rows=[],
        column_names=["账单号", "营业日期", "商品信息", "金额"],
    )
    assert result.shape == FileShape.BILL_FLOW
    assert result.confidence == 0.95
    assert "rule" in result.reasoning


async def test_rule_product_summary():
    """商品名称 + 销售金额, no 账单号 → PRODUCT_SUMMARY @0.90."""
    detector = ShapeDetector()
    result = await detector.detect(
        sample_rows=[],
        column_names=["商品名称", "销售金额", "数量"],
    )
    assert result.shape == FileShape.PRODUCT_SUMMARY
    assert result.confidence == 0.90


async def test_rule_review():
    """评分 + 评论 → REVIEW @0.92."""
    detector = ShapeDetector()
    result = await detector.detect(
        sample_rows=[],
        column_names=["评分", "评论", "门店"],
    )
    assert result.shape == FileShape.REVIEW
    assert result.confidence == 0.92


async def test_rule_finance():
    """凭证号 + 科目 → FINANCE @0.88."""
    detector = ShapeDetector()
    result = await detector.detect(
        sample_rows=[],
        column_names=["凭证号", "科目", "借方", "贷方"],
    )
    assert result.shape == FileShape.FINANCE
    assert result.confidence == 0.88


async def test_rule_inventory():
    """库存量 + 食材 → INVENTORY @0.85. 0.85 not > 0.85 so falls through to LLM —
    pin LLM mock to verify rule still classifies correctly."""
    detector = ShapeDetector()
    # Confidence 0.85 is exactly the threshold (not strictly greater) so LLM
    # is invoked. Stub it to return the same shape with higher confidence.
    detector._llm_detect = AsyncMock(  # type: ignore[method-assign]
        return_value=DetectionResult(FileShape.INVENTORY, 0.90, "LLM agreed"),
    )
    result = await detector.detect(
        sample_rows=[],
        column_names=["库存量", "食材", "门店"],
    )
    assert result.shape == FileShape.INVENTORY


def test_rule_inventory_returns_correct_shape_directly():
    """Cross-check the rule path itself returns INVENTORY @0.85."""
    detector = ShapeDetector()
    result = detector._rule_detect(["库存量", "食材", "门店"])
    assert result.shape == FileShape.INVENTORY
    assert result.confidence == 0.85


async def test_rule_unknown_falls_to_llm(monkeypatch):
    """Empty/random columns → low rule confidence → LLM call. Mock LLM returns SCHEDULE."""
    import smartbi.services.insights.llm_client as llm_client

    fake_response = (
        '{"shape": "schedule", "confidence": 0.92, "reasoning": "员工+班次+日期"}'
    )
    monkeypatch.setattr(
        llm_client,
        "call_llm",
        AsyncMock(return_value=fake_response),
    )

    detector = ShapeDetector()
    result = await detector.detect(
        sample_rows=[{"员工": "张三", "班次": "早", "日期": "2026-04-26"}],
        column_names=["员工", "班次", "日期"],
    )
    assert result.shape == FileShape.SCHEDULE
    assert result.confidence == 0.92
    assert "LLM" in result.reasoning


async def test_llm_failure_returns_unknown(monkeypatch):
    """LLM raises Exception → DetectionResult(UNKNOWN, 0.0, ...)."""
    import smartbi.services.insights.llm_client as llm_client

    async def raising(*args, **kwargs):
        raise RuntimeError("provider exhausted")

    monkeypatch.setattr(llm_client, "call_llm", raising)

    detector = ShapeDetector()
    result = await detector.detect(
        sample_rows=[],
        column_names=["foo", "bar"],
    )
    assert result.shape == FileShape.UNKNOWN
    assert result.confidence == 0.0
    assert "LLM error" in result.reasoning


async def test_llm_empty_returns_unknown(monkeypatch):
    """LLM returns "" → UNKNOWN with reasoning saying empty."""
    import smartbi.services.insights.llm_client as llm_client

    monkeypatch.setattr(llm_client, "call_llm", AsyncMock(return_value=""))

    detector = ShapeDetector()
    result = await detector.detect(
        sample_rows=[],
        column_names=["foo", "bar"],
    )
    assert result.shape == FileShape.UNKNOWN
    assert result.confidence == 0.0
    assert "empty" in result.reasoning


async def test_llm_invalid_json_returns_unknown(monkeypatch):
    """LLM returns non-JSON text → UNKNOWN with parse error reasoning."""
    import smartbi.services.insights.llm_client as llm_client

    monkeypatch.setattr(
        llm_client,
        "call_llm",
        AsyncMock(return_value="not json at all"),
    )

    detector = ShapeDetector()
    result = await detector.detect(
        sample_rows=[],
        column_names=["foo", "bar"],
    )
    assert result.shape == FileShape.UNKNOWN
    assert result.confidence == 0.0
    assert "parse error" in result.reasoning


def test_detection_result_is_frozen():
    """DetectionResult is frozen — assigning attributes raises."""
    import dataclasses
    r = DetectionResult(FileShape.UNKNOWN, 0.5, "x")
    with pytest.raises((dataclasses.FrozenInstanceError, AttributeError)):
        r.shape = FileShape.BILL_FLOW  # type: ignore[misc]


def test_file_shape_has_all_eight_values():
    """FileShape covers all 7 shapes + UNKNOWN."""
    expected = {
        "bill_flow", "product_summary", "review", "finance",
        "inventory", "schedule", "member", "unknown",
    }
    assert {s.value for s in FileShape} == expected
