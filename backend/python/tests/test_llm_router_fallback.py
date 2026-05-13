"""Audit tests for free-quota fallback in common/llm_router.py.

Goal: verify the new SLOT_MODELS dict + DEFAULT_CHAIN ([b, a, zhipu, deepseek])
auto-detect model exhaustion and switch to the next provider as expected.

These mock httpx so no real API calls happen — pure routing-logic verification.

Failure-trigger cases per `_is_quota_exhausted`:
- 403 + body containing "AllocationQuota.FreeTierOnly"  → quota exhausted
- 403 + body containing "AllocationQuota"               → quota exhausted
- 429 (any body)                                        → rate-limited / quota
- Other status codes                                    → still falls through
                                                          (treated as transient)
"""
from __future__ import annotations

from typing import Dict, List, Tuple
from unittest.mock import MagicMock

import pytest

from common import llm_router
from common.llm_router import SLOT, call_chain


@pytest.fixture(autouse=True)
def _reset_cb():
    """Reset circuit-breaker state between tests so they don't bleed."""
    llm_router._CB_FAILURES.clear()
    llm_router._CB_LAST_FAIL.clear()
    yield
    llm_router._CB_FAILURES.clear()
    llm_router._CB_LAST_FAIL.clear()


def _fake_response(status_code: int, body: str = "", json_payload: Dict | None = None):
    """Build a minimal fake httpx.Response."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.text = body
    resp.json = MagicMock(return_value=json_payload or {})
    return resp


class _ScriptedClient:
    """httpx-AsyncClient stand-in that returns a queued sequence of responses
    based on which provider's base_url is hit. Lets tests assert which providers
    were tried and in what order.
    """

    def __init__(self, route_responses: Dict[str, MagicMock]):
        self.route_responses = route_responses
        self.call_log: List[Tuple[str, str]] = []  # (account-host, model)

    async def post(self, url: str, headers=None, json=None, timeout=None):
        # Find which account this URL belongs to by host substring
        account = None
        if "dashscope.aliyuncs.com" in url:
            # Both aliyun_a + aliyun_b share host; differentiate by api_key in headers
            api_key = (headers or {}).get("Authorization", "")
            if "key_b" in api_key:
                account = "aliyun_b"
            elif "key_a" in api_key:
                account = "aliyun_a"
        elif "open.bigmodel.cn" in url:
            account = "zhipu"
        elif "api.deepseek.com" in url:
            account = "deepseek"

        model = (json or {}).get("model", "?")
        self.call_log.append((account or "unknown", model))

        if account in self.route_responses:
            return self.route_responses[account]
        return _fake_response(500, "no canned response")


def _patch_provider_keys(monkeypatch):
    """Set fake API keys for all 4 providers so _provider_config returns them."""
    monkeypatch.setenv("LLM_ALIYUN_A_API_KEY", "key_a_fake")
    monkeypatch.setenv("LLM_ALIYUN_B_API_KEY", "key_b_fake")
    monkeypatch.setenv("LLM_ZHIPU_API_KEY", "key_zhipu_fake")
    monkeypatch.setenv("LLM_DEEPSEEK_API_KEY", "key_deepseek_fake")


# ────────────────────────────────────────────────────────────────────────
# Test 1: aliyun_b 403 FreeTierOnly → falls back to aliyun_a (success)
# ────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_b_quota_exhausted_falls_back_to_a(monkeypatch):
    _patch_provider_keys(monkeypatch)

    success_payload = {"choices": [{"message": {"content": "ok from a"}}]}
    client = _ScriptedClient({
        "aliyun_b": _fake_response(
            403,
            body='{"code":"AllocationQuota.FreeTierOnly","message":"quota out"}',
        ),
        "aliyun_a": _fake_response(200, json_payload=success_payload),
    })

    monkeypatch.setattr(llm_router, "get_llm_http_client", lambda: client)

    result = await call_chain(SLOT.CHAT, {"messages": [{"role": "user", "content": "hi"}]})

    # Verify result came from aliyun_a, not aliyun_b
    assert result == success_payload
    # Verify both providers were tried in correct order
    accounts_tried = [a for a, _ in client.call_log]
    assert accounts_tried == ["aliyun_b", "aliyun_a"]
    # Verify the new model names were used
    models_tried = [m for _, m in client.call_log]
    assert models_tried[0] == "qwen3.6-flash"  # aliyun_b CHAT model (free, version-pinned)
    assert models_tried[1] == "qwen3.5-plus-2026-04-20"  # aliyun_a CHAT model (free, post-fix)


# ────────────────────────────────────────────────────────────────────────
# Test 2: 429 also triggers fallback (rate-limit branch)
# ────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_429_triggers_fallback(monkeypatch):
    _patch_provider_keys(monkeypatch)

    success_payload = {"choices": [{"message": {"content": "ok"}}]}
    client = _ScriptedClient({
        "aliyun_b": _fake_response(429, body="rate limit hit"),
        "aliyun_a": _fake_response(200, json_payload=success_payload),
    })
    monkeypatch.setattr(llm_router, "get_llm_http_client", lambda: client)

    result = await call_chain(SLOT.MAPPER, {"messages": []})

    assert result == success_payload
    accounts_tried = [a for a, _ in client.call_log]
    assert accounts_tried == ["aliyun_b", "aliyun_a"]
    models_tried = [m for _, m in client.call_log]
    assert models_tried[0] == "qwen-turbo"  # NEW: was qwen-turbo-1101 (broken)
    assert models_tried[1] == "qwen3.5-122b-a10b"  # aliyun_a MAPPER


# ────────────────────────────────────────────────────────────────────────
# Test 3: Cascade — b 403 + a 429 → falls through to zhipu
# ────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_full_cascade_to_zhipu(monkeypatch):
    _patch_provider_keys(monkeypatch)

    success_payload = {"choices": [{"message": {"content": "ok zhipu"}}]}
    client = _ScriptedClient({
        "aliyun_b": _fake_response(403, body='AllocationQuota.FreeTierOnly'),
        "aliyun_a": _fake_response(429),
        "zhipu":    _fake_response(200, json_payload=success_payload),
    })
    monkeypatch.setattr(llm_router, "get_llm_http_client", lambda: client)

    result = await call_chain(SLOT.REASONING, {"messages": []})

    assert result == success_payload
    accounts_tried = [a for a, _ in client.call_log]
    assert accounts_tried == ["aliyun_b", "aliyun_a", "zhipu"]
    models_tried = [m for _, m in client.call_log]
    assert models_tried[0] == "deepseek-r1"           # NEW: was deepseek-v3.2-exp (broken)
    assert models_tried[1] == "qwen3.5-397b-a17b"     # unchanged
    assert models_tried[2] == "glm-4.5-air"           # unchanged


# ────────────────────────────────────────────────────────────────────────
# Test 4: All providers exhausted → RuntimeError
# ────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_all_exhausted_raises(monkeypatch):
    _patch_provider_keys(monkeypatch)

    client = _ScriptedClient({
        "aliyun_b": _fake_response(403, body='AllocationQuota.FreeTierOnly'),
        "aliyun_a": _fake_response(403, body='AllocationQuota.FreeTierOnly'),
        "zhipu":    _fake_response(429),
        "deepseek": _fake_response(403, body='AllocationQuota'),
    })
    monkeypatch.setattr(llm_router, "get_llm_http_client", lambda: client)

    with pytest.raises(RuntimeError, match="All providers exhausted"):
        await call_chain(SLOT.CHAT, {"messages": []})

    # Verify all 4 providers in chain order were tried
    accounts_tried = [a for a, _ in client.call_log]
    assert accounts_tried == ["aliyun_b", "aliyun_a", "zhipu", "deepseek"]


# ────────────────────────────────────────────────────────────────────────
# Test 5: Non-quota 5xx error also walks chain (transient-error path)
# ────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_5xx_also_falls_through(monkeypatch):
    _patch_provider_keys(monkeypatch)

    success_payload = {"choices": [{"message": {"content": "ok"}}]}
    client = _ScriptedClient({
        "aliyun_b": _fake_response(503, body="service unavailable"),
        "aliyun_a": _fake_response(200, json_payload=success_payload),
    })
    monkeypatch.setattr(llm_router, "get_llm_http_client", lambda: client)

    result = await call_chain(SLOT.INSIGHTS, {"messages": []})

    assert result == success_payload
    assert [a for a, _ in client.call_log] == ["aliyun_b", "aliyun_a"]


# ────────────────────────────────────────────────────────────────────────
# Test 6: Verify NEW chain order is b → a → zhipu → deepseek
#         (this is the headline fix — was deepseek → a → zhipu → b before)
# ────────────────────────────────────────────────────────────────────────
def test_default_chain_order_is_free_first():
    assert llm_router.DEFAULT_CHAIN == ["aliyun_b", "aliyun_a", "zhipu", "deepseek"]


# ────────────────────────────────────────────────────────────────────────
# Test 7: Verify all NEW model picks are free-quota SKUs per audit
# ────────────────────────────────────────────────────────────────────────
def test_new_slot_models_match_free_audit():
    """Sanity check: each model in SLOT_MODELS for aliyun_b/aliyun_a matches
    the free-quota audit done on bailian.console May 9 2026.
    """
    sm = llm_router.SLOT_MODELS

    # aliyun_b — free-quota mine
    assert sm[SLOT.CHAT]["aliyun_b"] == "qwen3.6-flash"
    assert sm[SLOT.INSIGHTS]["aliyun_b"] == "qwen3.6-flash"
    assert sm[SLOT.CHART]["aliyun_b"] == "glm-5"
    assert sm[SLOT.MAPPER]["aliyun_b"] == "qwen-turbo"
    assert sm[SLOT.REASONING]["aliyun_b"] == "deepseek-r1"
    assert sm[SLOT.VL]["aliyun_b"] == "qwen-vl-plus-2025-05-07"
    assert sm[SLOT.REVIEW]["aliyun_b"] == "deepseek-r1-distill-qwen-32b"

    # aliyun_a — only version-suffixed SKUs are free
    assert sm[SLOT.CHAT]["aliyun_a"] == "qwen3.5-plus-2026-04-20"
    assert sm[SLOT.INSIGHTS]["aliyun_a"] == "qwen3.6-flash-2026-04-16"
    assert sm[SLOT.CHART]["aliyun_a"] == "glm-5"
    assert sm[SLOT.MAPPER]["aliyun_a"] == "qwen3.5-122b-a10b"
    assert sm[SLOT.REASONING]["aliyun_a"] == "qwen3.5-397b-a17b"
    assert sm[SLOT.VL]["aliyun_a"] == "qwen3-vl-flash"
    assert sm[SLOT.REVIEW]["aliyun_a"] == "qwen3.5-397b-a17b"

    # No bare PAID aliases left in aliyun_a/aliyun_b configs
    for slot, providers in sm.items():
        for acc in ("aliyun_a", "aliyun_b"):
            m = providers.get(acc)
            if m is None:
                continue
            # Bare aliases known to be PAID on aliyun_a (audit May 9 2026):
            # qwen-plus / qwen-turbo-1101 / deepseek-v3.2 / deepseek-v3.2-exp / deepseek-v3
            assert m not in {
                "qwen-plus",
                "qwen-turbo-1101",
                "deepseek-v3.2",
                "deepseek-v3.2-exp",
                "deepseek-v3",
            }, f"{slot.value}/{acc}: {m} is a known PAID/missing SKU per audit"


# ────────────────────────────────────────────────────────────────────────
# Test 8: _is_quota_exhausted detection matrix
# ────────────────────────────────────────────────────────────────────────
def test_quota_exhausted_detection():
    is_q = llm_router._is_quota_exhausted

    # 403 with FreeTierOnly → quota
    assert is_q(403, '{"code":"AllocationQuota.FreeTierOnly"}')
    # 403 with bare AllocationQuota → quota
    assert is_q(403, "AllocationQuota")
    # 403 with unrelated → NOT quota (caller treats as transient http error)
    assert not is_q(403, "permission denied")
    # 429 always → quota (rate-limit treated same as exhaustion)
    assert is_q(429, "")
    assert is_q(429, "anything")
    # Other codes → not quota
    assert not is_q(500, "FreeTierOnly")
    assert not is_q(401, "AllocationQuota")
    assert not is_q(200, "FreeTierOnly")


# ────────────────────────────────────────────────────────────────────────
# Test 8b: 402 'Insufficient Balance' counts as quota exhaustion (issue #581)
# ────────────────────────────────────────────────────────────────────────
def test_402_insufficient_balance_is_quota_exhausted():
    """DeepSeek-official balance-0 returns 402 + body 'Insufficient Balance'.
    Predicate must flag this as quota exhausted so the chain logs WARNING and
    falls back cleanly instead of surfacing as generic ERROR."""
    is_q = llm_router._is_quota_exhausted

    # The exact DeepSeek shape: JSON body with the Insufficient Balance message.
    assert is_q(402, '{"error":{"message":"Insufficient Balance","type":"insufficient_quota"}}')
    # Body-only substring check is sufficient — match regardless of surrounding JSON.
    assert is_q(402, "Insufficient Balance")


# ────────────────────────────────────────────────────────────────────────
# Test 8c: 402 must NOT trigger fallback on unrelated bodies / wrong codes
# ────────────────────────────────────────────────────────────────────────
def test_402_other_cases_not_quota_exhausted():
    """Regression guard: only 402 + 'Insufficient Balance' substring counts.
    Other 402 bodies stay on the generic-error path, and the 'Insufficient
    Balance' string on non-402 statuses must not accidentally trigger fallback."""
    is_q = llm_router._is_quota_exhausted

    # 402 + unrelated body → not quota (generic-error path, logged as ERROR).
    assert not is_q(402, "Payment Required")
    assert not is_q(402, "")
    assert not is_q(402, '{"error":"some other 402 reason"}')
    # The substring must not accidentally trigger on non-402 statuses.
    assert not is_q(200, "Insufficient Balance")
    assert not is_q(500, "Insufficient Balance")
    assert not is_q(401, "Insufficient Balance")


# ────────────────────────────────────────────────────────────────────────
# Test 9: DeepSeek monthly USD cap removes it from chain when over budget
# ────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_deepseek_skipped_when_over_budget(monkeypatch):
    """When MTD spend exceeds LLM_DEEPSEEK_MAX_USD_PER_MONTH, deepseek is
    skipped exactly like a circuit-breaker open state — the chain still
    succeeds via earlier providers, fails cleanly only if every other
    provider also exhausts."""
    from common import llm_budget

    _patch_provider_keys(monkeypatch)
    monkeypatch.setenv("LLM_DEEPSEEK_MAX_USD_PER_MONTH", "0.50")
    llm_budget.reset_for_tests()
    # Push MTD past cap and pin the cache so over_budget skips DB
    import time
    llm_budget._cached_cost_usd = 1.0
    llm_budget._cached_at = time.time()

    # Every free provider exhausts so we'd normally fall to deepseek.
    client = _ScriptedClient({
        "aliyun_b": _fake_response(403, body="AllocationQuota.FreeTierOnly"),
        "aliyun_a": _fake_response(403, body="AllocationQuota.FreeTierOnly"),
        "zhipu":    _fake_response(429),
        # deepseek would respond 200 if asked, but budget gate prevents the call.
        "deepseek": _fake_response(200, json_payload={"choices": [{"message": {"content": "x"}}]}),
    })
    monkeypatch.setattr(llm_router, "get_llm_http_client", lambda: client)

    with pytest.raises(RuntimeError) as exc:
        await call_chain(SLOT.CHAT, {"messages": []})

    # deepseek should NOT have been called — gate skipped it
    accounts_tried = [a for a, _ in client.call_log]
    assert "deepseek" not in accounts_tried
    assert accounts_tried == ["aliyun_b", "aliyun_a", "zhipu"]
    # Error message records the budget reason
    assert "budget_exceeded" in str(exc.value)


@pytest.mark.asyncio
async def test_deepseek_used_when_under_budget(monkeypatch):
    """Sanity: under-budget MTD doesn't accidentally skip deepseek."""
    from common import llm_budget

    _patch_provider_keys(monkeypatch)
    monkeypatch.setenv("LLM_DEEPSEEK_MAX_USD_PER_MONTH", "10.00")
    llm_budget.reset_for_tests()
    import time
    llm_budget._cached_cost_usd = 0.05  # well under $10 cap
    llm_budget._cached_at = time.time()

    deepseek_payload = {
        "choices": [{"message": {"content": "ds"}}],
        "usage": {"prompt_tokens": 100, "completion_tokens": 50},
    }
    client = _ScriptedClient({
        "aliyun_b": _fake_response(403, body="AllocationQuota.FreeTierOnly"),
        "aliyun_a": _fake_response(403, body="AllocationQuota.FreeTierOnly"),
        "zhipu":    _fake_response(429),
        "deepseek": _fake_response(200, json_payload=deepseek_payload),
    })
    monkeypatch.setattr(llm_router, "get_llm_http_client", lambda: client)

    result = await call_chain(SLOT.CHAT, {"messages": []})

    assert result == deepseek_payload
    accounts_tried = [a for a, _ in client.call_log]
    assert accounts_tried == ["aliyun_b", "aliyun_a", "zhipu", "deepseek"]
