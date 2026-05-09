"""Tests for J2 (Apr 24 2026) — conditional multi-model voting in StructureDetector.

A-inventory.md A-quick-5: Layer 4 multi-model voting (3-model vote) used to run
on EVERY upload when settings.enable_multi_model_enhancement=True (the default).
Refactor: voting is now CONDITIONAL on the best prior layer (rules/llm_fast/llm_vl)
confidence — skip voting when single model already passes
multi_model_voting_confidence_threshold (default 0.85).

Tests verify the 4 paths through the new gating:
  1. Default + high prior confidence  → voting SKIPPED, prior result returned
  2. Default + low prior confidence   → voting INVOKED
  3. Force True                       → voting always INVOKED regardless of confidence
  4. Force False                      → voting always SKIPPED regardless of confidence

The detector's settings.use_llm_first must be False to exercise rule-first mode
where Layer 4 voting lives. We patch the per-instance settings shim to switch
modes without touching environment variables.
"""
from __future__ import annotations

from io import BytesIO
from unittest.mock import AsyncMock, MagicMock

import pandas as pd
import pytest

from services.structure_detector import (
    StructureDetectionResult,
    StructureDetector,
)


def _build_simple_xlsx() -> bytes:
    df = pd.DataFrame(
        {
            "Date": ["2024-01-01", "2024-01-02", "2024-01-03"],
            "Product": ["A", "B", "C"],
            "Sales": [100, 200, 150],
        }
    )
    buf = BytesIO()
    df.to_excel(buf, index=False, engine="openpyxl")
    return buf.getvalue()


def _make_detector(
    *,
    enable_multi_model_enhancement: bool = True,
    voting_threshold: float = 0.85,
    use_llm_first: bool = False,
    structure_threshold: float = 0.7,
) -> StructureDetector:
    """StructureDetector with stubbed settings to exercise rule-first Layer 4 path.

    Returns a detector whose `.settings` returns our MagicMock — this avoids
    booting the real pydantic Settings (which loads env vars) and lets each
    test pin the exact gating inputs it cares about.
    """
    detector = StructureDetector()
    fake = MagicMock()
    fake.use_llm_first = use_llm_first
    fake.enable_multi_model_enhancement = enable_multi_model_enhancement
    fake.multi_model_voting_confidence_threshold = voting_threshold
    fake.structure_detection_confidence_threshold = structure_threshold
    fake.max_self_correction_rounds = 1
    detector._settings = fake
    return detector


def _stub_layer(
    detector: StructureDetector,
    *,
    rule_conf: float = 0.0,
    llm_fast_conf: float = 0.0,
    llm_vl_conf: float = 0.0,
    multi_model_conf: float = 0.95,
) -> AsyncMock:
    """Stub layers 1-4 so we can drive the gating logic without real LLM calls.

    Returns the multi-model AsyncMock so tests can assert call_count.
    """

    def _mk(method_name: str, conf: float) -> StructureDetectionResult:
        return StructureDetectionResult(
            success=True,
            confidence=conf,
            method=method_name,
            sheet_name="Sheet1",
            total_rows=4,
            total_cols=3,
            header_row_count=1,
            data_start_row=1,
        )

    detector._detect_with_rules = MagicMock(  # type: ignore[method-assign]
        return_value=_mk("rule", rule_conf)
    )
    detector._detect_with_llm_fast = AsyncMock(  # type: ignore[method-assign]
        return_value=_mk("llm_fast", llm_fast_conf)
    )
    detector._detect_with_llm_vl = AsyncMock(  # type: ignore[method-assign]
        return_value=_mk("llm_vl", llm_vl_conf)
    )
    multi_model_mock = AsyncMock(return_value=_mk("multi_model", multi_model_conf))
    detector._detect_with_multi_model = multi_model_mock  # type: ignore[method-assign]
    # Skip the "complex header" pre-check so we always go through layers 1→4.
    detector._is_complex_header = MagicMock(return_value=False)  # type: ignore[method-assign]
    return multi_model_mock


@pytest.fixture
def xlsx_bytes() -> bytes:
    return _build_simple_xlsx()


# ---------------------------------------------------------------------------
# 1. Default (None) + high prior confidence → voting SKIPPED
# ---------------------------------------------------------------------------
async def test_default_high_confidence_skips_voting(xlsx_bytes: bytes):
    detector = _make_detector()
    multi_model_mock = _stub_layer(
        detector,
        rule_conf=0.5,        # below structure_threshold 0.7 → fall through
        llm_fast_conf=0.92,   # above structure_threshold but ALSO above voting_threshold 0.85
        llm_vl_conf=0.0,      # not reached because llm_fast already passed
    )

    # llm_fast returns 0.92 ≥ structure_threshold (0.7), so detect() returns
    # immediately at Layer 2 — voting is never even a consideration.
    # This confirms the existing fast-path is preserved.
    result = await detector.detect(xlsx_bytes, enable_multi_model_enhancement=None)

    assert result.method == "llm_fast"
    assert result.confidence == pytest.approx(0.92)
    assert multi_model_mock.call_count == 0


async def test_default_high_confidence_below_structure_threshold_still_skips_voting(
    xlsx_bytes: bytes,
):
    """High enough to skip voting, but below structure_threshold so layers run to Layer 4 gate.

    rule=0.5, llm_fast=0.6, llm_vl=0.86 — each below structure_threshold (0.7) for the
    layer-pass shortcut, EXCEPT llm_vl which is at 0.86 ≥ structure_threshold (0.7) so
    it returns early. Tighten to drive past the early-return into the gate.
    """
    detector = _make_detector(structure_threshold=0.95)  # Force layers to fall through
    multi_model_mock = _stub_layer(
        detector,
        rule_conf=0.5,
        llm_fast_conf=0.6,
        llm_vl_conf=0.88,  # ≥ voting_threshold (0.85), but < structure_threshold (0.95)
    )

    result = await detector.detect(xlsx_bytes, enable_multi_model_enhancement=None)

    # Layer 4 gate sees best_prior=llm_vl@0.88 ≥ 0.85 → skips voting,
    # returns the best prior result instead of the fallback.
    assert multi_model_mock.call_count == 0
    assert result.method == "llm_vl"
    assert result.confidence == pytest.approx(0.88)


# ---------------------------------------------------------------------------
# 2. Default (None) + low prior confidence → voting INVOKED
# ---------------------------------------------------------------------------
async def test_default_low_confidence_triggers_voting(xlsx_bytes: bytes):
    detector = _make_detector(structure_threshold=0.95)  # Layers 1-3 all fall through
    multi_model_mock = _stub_layer(
        detector,
        rule_conf=0.4,
        llm_fast_conf=0.5,
        llm_vl_conf=0.6,        # best prior = 0.6 < voting_threshold 0.85
        multi_model_conf=0.92,  # voting wins
    )

    result = await detector.detect(xlsx_bytes, enable_multi_model_enhancement=None)

    assert multi_model_mock.call_count == 1
    assert result.method == "multi_model"
    assert result.confidence == pytest.approx(0.92)


# ---------------------------------------------------------------------------
# 3. Force True → voting always INVOKED
# ---------------------------------------------------------------------------
async def test_force_true_always_votes_even_with_high_prior(xlsx_bytes: bytes):
    # structure_threshold=0.999 so even llm_vl@0.95 falls through to Layer 4 gate
    # without Layer 3 short-circuit returning early.
    detector = _make_detector(structure_threshold=0.999)
    multi_model_mock = _stub_layer(
        detector,
        rule_conf=0.4,
        llm_fast_conf=0.5,
        llm_vl_conf=0.95,  # high enough that conditional path WOULD skip voting
        multi_model_conf=0.99,
    )

    result = await detector.detect(xlsx_bytes, enable_multi_model_enhancement=True)

    # Caller forced voting on, so it must run regardless of prior confidence.
    assert multi_model_mock.call_count == 1
    assert result.method == "multi_model"


async def test_force_true_votes_even_when_settings_flag_disabled(xlsx_bytes: bytes):
    """Caller's True overrides settings.enable_multi_model_enhancement=False.

    The settings flag is the global default for the conditional path; the caller
    parameter is an explicit override that takes precedence.
    """
    detector = _make_detector(
        enable_multi_model_enhancement=False,  # settings says off
        structure_threshold=0.95,
    )
    multi_model_mock = _stub_layer(
        detector, rule_conf=0.4, llm_fast_conf=0.5, llm_vl_conf=0.5
    )

    await detector.detect(xlsx_bytes, enable_multi_model_enhancement=True)

    assert multi_model_mock.call_count == 1


# ---------------------------------------------------------------------------
# 4. Force False → voting always SKIPPED
# ---------------------------------------------------------------------------
async def test_force_false_never_votes_even_with_low_prior(xlsx_bytes: bytes):
    detector = _make_detector(structure_threshold=0.95)
    multi_model_mock = _stub_layer(
        detector,
        rule_conf=0.3,
        llm_fast_conf=0.4,
        llm_vl_conf=0.5,  # below voting_threshold 0.85 — would normally trigger voting
    )

    result = await detector.detect(xlsx_bytes, enable_multi_model_enhancement=False)

    # Caller forced voting off, so it stays off.
    assert multi_model_mock.call_count == 0
    # Best prior (llm_vl@0.5) is returned instead of the fallback.
    assert result.method == "llm_vl"
    assert result.confidence == pytest.approx(0.5)


# ---------------------------------------------------------------------------
# 5. Conditional + settings flag off → voting SKIPPED (feature disabled)
# ---------------------------------------------------------------------------
async def test_settings_flag_off_skips_voting_in_conditional_mode(xlsx_bytes: bytes):
    """When settings.enable_multi_model_enhancement=False and caller=None (default),
    voting is skipped regardless of prior confidence — the global feature flag wins.
    """
    detector = _make_detector(
        enable_multi_model_enhancement=False,
        structure_threshold=0.95,
    )
    multi_model_mock = _stub_layer(
        detector, rule_conf=0.3, llm_fast_conf=0.4, llm_vl_conf=0.5
    )

    result = await detector.detect(xlsx_bytes, enable_multi_model_enhancement=None)

    assert multi_model_mock.call_count == 0
    assert result.method == "llm_vl"
