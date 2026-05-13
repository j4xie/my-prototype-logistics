"""Audit tests for free-quota fallback in common/llm_router.py.

Goal: verify the SLOT_MODELS dict + DEFAULT_CHAIN
([aliyun_b, aliyun_a, zhipu, aliyun_a_deepseek]) auto-detect model
exhaustion and switch to the next provider as expected.

These mock httpx so no real API calls happen — pure routing-logic verification.

Failure-trigger cases per `_is_quota_exhausted`:
- 403 + body containing "AllocationQuota.FreeTierOnly"  → quota exhausted
- 403 + body containing "AllocationQuota"               → quota exhausted
- 429 (any body)                                        → rate-limited / quota
- Other status codes                                    → still falls through
                                                          (treated as transient)

History:
- Initial chain pre-#577: [aliyun_b, aliyun_a, zhipu, deepseek-official]
- Post-#578: 5-provider with aliyun_a_deepseek inserted before deepseek-official
- Post-#580 Option 2 (this file's current shape): 4-provider, deepseek-official
  dropped since aliyun_a_deepseek covers DeepSeek-class quality on free tier.
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

    Note: `aliyun_a` and `aliyun_a_deepseek` share the same DashScope endpoint
    AND the same API key. We differentiate by the `model` name in the request
    payload — DeepSeek-class models route to `aliyun_a_deepseek`, qwen-*
    models route to `aliyun_a`.
    """

    def __init__(self, route_responses: Dict[str, MagicMock]):
        self.route_responses = route_responses
        self.call_log: List[Tuple[str, str]] = []  # (account, model)

    async def post(self, url: str, headers=None, json=None, timeout=None):
        model = (json or {}).get("model", "?")
        # Find which account this URL+model belongs to
        account = None
        if "dashscope.aliyuncs.com" in url:
            # Differentiate aliyun_a vs aliyun_b by api_key, then split
            # aliyun_a vs aliyun_a_deepseek by model class.
            api_key = (headers or {}).get("Authorization", "")
            if "key_b" in api_key:
                account = "aliyun_b"
            elif "key_a" in api_key:
                # Same endpoint+key serves both `aliyun_a` (qwen-*) and
                # `aliyun_a_deepseek` (deepseek-*). Route by model name.
                if model.startswith("deepseek-"):
                    account = "aliyun_a_deepseek"
                else:
                    account = "aliyun_a"
        elif "open.bigmodel.cn" in url:
            account = "zhipu"

        self.call_log.append((account or "unknown", model))

        if account in self.route_responses:
            return self.route_responses[account]
        return _fake_response(500, "no canned response")


def _patch_provider_keys(monkeypatch):
    """Set fake API keys for all 4 providers so _provider_config returns them."""
    monkeypatch.setenv("LLM_ALIYUN_A_API_KEY", "key_a_fake")
    monkeypatch.setenv("LLM_ALIYUN_B_API_KEY", "key_b_fake")
    monkeypatch.setenv("LLM_ZHIPU_API_KEY", "key_zhipu_fake")


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
    # Verify the new model names were used (post-PR-#578 picks)
    models_tried = [m for _, m in client.call_log]
    assert models_tried[0] == "qwen-max"             # aliyun_b CHAT
    assert models_tried[1] == "qwen3.6-max-preview"  # aliyun_a CHAT


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
    assert models_tried[0] == "qwen3.5-122b-a10b"   # aliyun_b MAPPER (post-#578)
    assert models_tried[1] == "qwen3.5-122b-a10b"   # aliyun_a MAPPER


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
    assert models_tried[0] == "qwen3.5-397b-a17b"   # aliyun_b REASONING (post-#578)
    assert models_tried[1] == "qwen3.5-397b-a17b"   # aliyun_a REASONING
    assert models_tried[2] == "glm-4.5-air"         # zhipu REASONING


# ────────────────────────────────────────────────────────────────────────
# Test 4: Full cascade to aliyun_a_deepseek (4th and final provider)
# ────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_cascade_to_aliyun_a_deepseek(monkeypatch):
    """When aliyun_b/aliyun_a/zhipu all exhaust, chain reaches the 4th
    provider — aliyun_a_deepseek — which routes deepseek-v4-pro via the
    DashScope free pool.
    """
    _patch_provider_keys(monkeypatch)

    success_payload = {"choices": [{"message": {"content": "ok ds"}}]}
    client = _ScriptedClient({
        "aliyun_b":          _fake_response(403, body='AllocationQuota.FreeTierOnly'),
        "aliyun_a":          _fake_response(429),
        "zhipu":             _fake_response(429),
        "aliyun_a_deepseek": _fake_response(200, json_payload=success_payload),
    })
    monkeypatch.setattr(llm_router, "get_llm_http_client", lambda: client)

    result = await call_chain(SLOT.CHAT, {"messages": []})

    assert result == success_payload
    accounts_tried = [a for a, _ in client.call_log]
    assert accounts_tried == ["aliyun_b", "aliyun_a", "zhipu", "aliyun_a_deepseek"]
    models_tried = [m for _, m in client.call_log]
    assert models_tried[3] == "deepseek-v4-pro"


# ────────────────────────────────────────────────────────────────────────
# Test 5: All providers exhausted → RuntimeError
# ────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_all_exhausted_raises(monkeypatch):
    _patch_provider_keys(monkeypatch)

    client = _ScriptedClient({
        "aliyun_b":          _fake_response(403, body='AllocationQuota.FreeTierOnly'),
        "aliyun_a":          _fake_response(403, body='AllocationQuota.FreeTierOnly'),
        "zhipu":             _fake_response(429),
        "aliyun_a_deepseek": _fake_response(403, body='AllocationQuota'),
    })
    monkeypatch.setattr(llm_router, "get_llm_http_client", lambda: client)

    with pytest.raises(RuntimeError, match="All providers exhausted"):
        await call_chain(SLOT.CHAT, {"messages": []})

    # Verify all 4 providers in chain order were tried
    accounts_tried = [a for a, _ in client.call_log]
    assert accounts_tried == ["aliyun_b", "aliyun_a", "zhipu", "aliyun_a_deepseek"]


# ────────────────────────────────────────────────────────────────────────
# Test 6: Non-quota 5xx error also walks chain (transient-error path)
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
# Test 7: Verify chain order is the 4-provider all-free chain
# ────────────────────────────────────────────────────────────────────────
def test_default_chain_order_is_4_free_providers():
    assert llm_router.DEFAULT_CHAIN == [
        "aliyun_b",
        "aliyun_a",
        "zhipu",
        "aliyun_a_deepseek",
    ]


# ────────────────────────────────────────────────────────────────────────
# Test 8: Verify all SLOT_MODELS picks (current state per PR #578 + #580)
# ────────────────────────────────────────────────────────────────────────
def test_slot_models_match_current_audit():
    """Sanity check: each model in SLOT_MODELS matches the May 13 2026 audit
    (live-probe + Steve console-screenshot fused — see
    tests/qa-llm-quota/audit-matrix.md).
    """
    sm = llm_router.SLOT_MODELS

    # aliyun_b
    assert sm[SLOT.CHAT]["aliyun_b"] == "qwen-max"
    assert sm[SLOT.INSIGHTS]["aliyun_b"] == "qwen3.6-35b-a3b"
    assert sm[SLOT.CHART]["aliyun_b"] == "glm-5"
    assert sm[SLOT.MAPPER]["aliyun_b"] == "qwen3.5-122b-a10b"
    assert sm[SLOT.REASONING]["aliyun_b"] == "qwen3.5-397b-a17b"
    assert sm[SLOT.VL]["aliyun_b"] == "qwen3-vl-plus-2025-12-19"
    assert sm[SLOT.REVIEW]["aliyun_b"] == "deepseek-r1-distill-qwen-32b"

    # aliyun_a
    assert sm[SLOT.CHAT]["aliyun_a"] == "qwen3.6-max-preview"
    assert sm[SLOT.INSIGHTS]["aliyun_a"] == "qwen3.6-35b-a3b"
    assert sm[SLOT.CHART]["aliyun_a"] == "glm-5"
    assert sm[SLOT.MAPPER]["aliyun_a"] == "qwen3.5-122b-a10b"
    assert sm[SLOT.REASONING]["aliyun_a"] == "qwen3.5-397b-a17b"
    assert sm[SLOT.VL]["aliyun_a"] == "qwen3-vl-plus-2025-12-19"
    assert sm[SLOT.REVIEW]["aliyun_a"] == "qwen3.5-397b-a17b"

    # zhipu (all on glm-4.5-air pool except VL on glm-4.6v)
    for slot in (SLOT.CHAT, SLOT.INSIGHTS, SLOT.CHART, SLOT.MAPPER, SLOT.REASONING, SLOT.REVIEW):
        assert sm[slot]["zhipu"] == "glm-4.5-air", f"{slot.value}/zhipu wrong"
    assert sm[SLOT.VL]["zhipu"] == "glm-4.6v"

    # aliyun_a_deepseek (deepseek-v4-pro everywhere except VL/REVIEW which are None)
    for slot in (SLOT.CHAT, SLOT.INSIGHTS, SLOT.CHART, SLOT.MAPPER, SLOT.REASONING):
        assert sm[slot]["aliyun_a_deepseek"] == "deepseek-v4-pro", f"{slot.value}/aliyun_a_deepseek wrong"
    assert sm[SLOT.VL]["aliyun_a_deepseek"] is None
    assert sm[SLOT.REVIEW]["aliyun_a_deepseek"] is None


# ────────────────────────────────────────────────────────────────────────
# Test 9: No deepseek-official chain entry remains (post-#580 Option 2)
# ────────────────────────────────────────────────────────────────────────
def test_no_deepseek_official_anywhere():
    """Ensure deepseek-official was fully removed in #580 Option 2 — no
    SLOT key, no chain entry, no _provider_config mapping.
    """
    assert "deepseek" not in llm_router.DEFAULT_CHAIN
    for slot, providers in llm_router.SLOT_MODELS.items():
        assert "deepseek" not in providers, f"{slot.value} still has 'deepseek' key"
    url, key = llm_router._provider_config("deepseek")
    assert url == "" and key == "", "_provider_config('deepseek') should return empty tuple"


# ────────────────────────────────────────────────────────────────────────
# Test 10: _is_quota_exhausted detection matrix
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
# Test 11: 402 'Insufficient Balance' counts as quota exhaustion (issue #581)
# ────────────────────────────────────────────────────────────────────────
def test_402_insufficient_balance_is_quota_exhausted():
    """402 + body 'Insufficient Balance' must flag as quota exhausted so the
    chain logs WARNING and falls back cleanly instead of surfacing as generic
    ERROR. Historically this was DeepSeek-official's balance-0 shape (#581);
    after #580 Option 2 deepseek-official is no longer in the chain, but the
    detection stays as defensive infra for any future provider that returns
    this shape."""
    is_q = llm_router._is_quota_exhausted

    # The exact DeepSeek shape: JSON body with the Insufficient Balance message.
    assert is_q(402, '{"error":{"message":"Insufficient Balance","type":"insufficient_quota"}}')
    # Body-only substring check is sufficient — match regardless of surrounding JSON.
    assert is_q(402, "Insufficient Balance")


# ────────────────────────────────────────────────────────────────────────
# Test 12: 402 must NOT trigger fallback on unrelated bodies / wrong codes
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
