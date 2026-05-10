"""Tests for common.llm_budget — DeepSeek monthly USD soft gate."""
from __future__ import annotations

import asyncio

import pytest

from common import llm_budget
from common.llm_budget import (
    deepseek_over_budget,
    estimate_cost_usd,
    record_local,
    reset_for_tests,
)


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    """Reset module state and force cap=$1 for predictable trip points."""
    reset_for_tests()
    monkeypatch.setenv("LLM_DEEPSEEK_MAX_USD_PER_MONTH", "1.0")
    yield
    reset_for_tests()


def test_estimate_cost_unknown_model_returns_zero():
    assert estimate_cost_usd("qwen-plus", 1_000_000, 1_000_000) == 0.0
    assert estimate_cost_usd("glm-5", 1_000_000, 0) == 0.0


def test_estimate_cost_v4_flash_all_cache_miss():
    # 1M input miss + 1M output = 0.14 + 0.28 = $0.42
    cost = estimate_cost_usd("deepseek-v4-flash", 1_000_000, 1_000_000, cached_tokens=0)
    assert cost == pytest.approx(0.42, rel=1e-6)


def test_estimate_cost_v4_flash_split_cache_hit():
    # 800K cached + 200K miss + 1M output
    # 0.8 * 0.0028 + 0.2 * 0.14 + 1.0 * 0.28 = 0.00224 + 0.028 + 0.28 = $0.31024
    cost = estimate_cost_usd("deepseek-v4-flash", 1_000_000, 1_000_000, cached_tokens=800_000)
    assert cost == pytest.approx(0.31024, rel=1e-6)


def test_estimate_cost_v4_pro_discounted():
    # 1M miss + 1M output at v4-pro discounted rates: 0.435 + 0.87 = $1.305
    cost = estimate_cost_usd("deepseek-v4-pro", 1_000_000, 1_000_000)
    assert cost == pytest.approx(1.305, rel=1e-6)


def test_estimate_cost_legacy_aliases_match_new_skus():
    new = estimate_cost_usd("deepseek-v4-flash", 100_000, 50_000, 20_000)
    legacy = estimate_cost_usd("deepseek-chat", 100_000, 50_000, 20_000)
    assert new == legacy

    new_pro = estimate_cost_usd("deepseek-v4-pro", 100_000, 50_000, 20_000)
    legacy_pro = estimate_cost_usd("deepseek-reasoner", 100_000, 50_000, 20_000)
    assert new_pro == legacy_pro


def test_record_local_accumulates():
    record_local("deepseek-v4-flash", 1_000_000, 1_000_000)  # +$0.42
    record_local("deepseek-v4-flash", 1_000_000, 0)          # +$0.14
    # Read internal cached value directly — public API requires async
    assert llm_budget._cached_cost_usd == pytest.approx(0.56, rel=1e-6)


def test_record_local_ignores_non_deepseek_models():
    record_local("qwen-plus", 1_000_000, 1_000_000)
    assert llm_budget._cached_cost_usd == 0.0


def _stamp_cache_fresh():
    """Mark cache as just-refreshed so over_budget skips DB query."""
    import time
    llm_budget._cached_at = time.time()


def test_over_budget_below_cap_returns_false():
    _stamp_cache_fresh()
    record_local("deepseek-v4-flash", 1_000_000, 0)  # $0.14, well below $1 cap
    assert asyncio.run(deepseek_over_budget()) is False


def test_over_budget_above_cap_returns_true():
    _stamp_cache_fresh()
    # Push past $1 cap: 3 calls × $0.42 = $1.26
    for _ in range(3):
        record_local("deepseek-v4-flash", 1_000_000, 1_000_000)
    assert asyncio.run(deepseek_over_budget()) is True


def test_over_budget_disabled_when_cap_zero(monkeypatch):
    monkeypatch.setenv("LLM_DEEPSEEK_MAX_USD_PER_MONTH", "0")
    _stamp_cache_fresh()
    # Even way over what would normally trip — gate is disabled
    for _ in range(100):
        record_local("deepseek-v4-pro", 1_000_000, 1_000_000)
    assert asyncio.run(deepseek_over_budget()) is False


def test_over_budget_handles_invalid_env(monkeypatch):
    monkeypatch.setenv("LLM_DEEPSEEK_MAX_USD_PER_MONTH", "not_a_number")
    _stamp_cache_fresh()
    # Falls back to $10 default; one $0.42 call shouldn't trip
    record_local("deepseek-v4-flash", 1_000_000, 1_000_000)
    assert asyncio.run(deepseek_over_budget()) is False
