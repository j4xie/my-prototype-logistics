"""
Tests for per-account circuit breaker in common/llm_router.py (J1 — Apr 24 2026).

Verifies:
- threshold: skip kicks in after CB_THRESHOLD consecutive failures
- cooldown: stale failures (older than CB_COOLDOWN) reset and allow re-probe
- success: a clean success resets the failure counter
"""
import time

from common.llm_router import (
    _CB_FAILURES,
    _CB_LAST_FAIL,
    _cb_record_failure,
    _cb_record_success,
    _cb_should_skip,
    CB_COOLDOWN,
    CB_THRESHOLD,
)


def test_cb_threshold_triggers_skip():
    """After CB_THRESHOLD consecutive failures, _cb_should_skip returns True."""
    _CB_FAILURES.clear()
    _CB_LAST_FAIL.clear()
    for _ in range(CB_THRESHOLD - 1):
        _cb_record_failure("aliyun_b")
    # One short of threshold — still allowed
    assert not _cb_should_skip("aliyun_b")
    _cb_record_failure("aliyun_b")
    # Threshold reached — must skip
    assert _cb_should_skip("aliyun_b")


def test_cb_cooldown_resets():
    """After CB_COOLDOWN seconds elapse, the breaker auto-resets for a re-probe."""
    _CB_FAILURES.clear()
    _CB_LAST_FAIL.clear()
    for _ in range(CB_THRESHOLD):
        _cb_record_failure("aliyun_a")
    assert _cb_should_skip("aliyun_a")
    # Backdate the last failure beyond the cooldown window
    _CB_LAST_FAIL["aliyun_a"] = time.time() - CB_COOLDOWN - 1
    assert not _cb_should_skip("aliyun_a")


def test_cb_success_resets_counter():
    """A clean success zeroes the failure counter."""
    _CB_FAILURES.clear()
    _CB_LAST_FAIL.clear()
    _cb_record_failure("zhipu")
    _cb_record_failure("zhipu")
    assert _CB_FAILURES["zhipu"] == 2
    _cb_record_success("zhipu")
    assert _CB_FAILURES["zhipu"] == 0
