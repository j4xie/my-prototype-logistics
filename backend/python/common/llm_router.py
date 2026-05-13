"""
Multi-provider LLM router with 403 AllocationQuota.FreeTierOnly fallback.

Chain (priority order): aliyun_b → aliyun_a → zhipu → deepseek

No client-side quota estimation — we rely on Aliyun's 免费额度用完即停 toggle
which returns 403 when free quota exhausts. This is the HARD guarantee that
accounts will never be charged beyond free tier.

The metrics hook in common/llm_metrics.py records each attempt (including
failed fallback attempts) so we have per-account usage visibility.

Usage:
    from common.llm_router import call_chain, SLOT
    with llm_caller_context("chart", factory_id="F001"):
        resp_json = await call_chain(SLOT.CHART, payload)

    # Streaming variant (Apr 25 2026, E2a):
    from common.llm_router import call_chain_stream, SLOT
    with llm_caller_context("chat"):
        async for event in call_chain_stream(SLOT.CHAT, payload):
            if event["type"] == "delta":
                print(event["text"], end="")
            elif event["type"] == "usage":
                total = event["tokens"]
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from enum import Enum
from threading import Lock
from typing import Any, AsyncIterator, Dict, List, Optional, Tuple

import httpx

from common.llm_budget import deepseek_over_budget, record_local
from common.llm_client import get_llm_http_client

logger = logging.getLogger(__name__)


def _log_cache_and_record_budget(slot_value: str, account: str, model: str, body: Dict[str, Any]) -> None:
    """Parse usage from a successful response: log cache-hit ratio + record
    DeepSeek MTD spend. Mirrors the streaming path's [cache] log line so
    observability is uniform across both paths.

    DeepSeek emits both `prompt_tokens_details.cached_tokens` and the legacy
    `prompt_cache_hit_tokens`; DashScope emits the former only. Read both.
    """
    try:
        usage = (body or {}).get("usage") or {}
        prompt_total = int(usage.get("prompt_tokens") or 0)
        completion = int(usage.get("completion_tokens") or 0)
        details = usage.get("prompt_tokens_details") or {}
        cached = int(
            details.get("cached_tokens")
            or usage.get("prompt_cache_hit_tokens")
            or 0
        )
        if prompt_total > 0:
            pct = 100 * cached // prompt_total if cached else 0
            logger.info(
                f"[cache] slot={slot_value} via {account}/{model}: "
                f"prompt={prompt_total} cached={cached} ({pct}%) completion={completion}"
            )
        if account == "deepseek":
            record_local(model, prompt_total, completion, cached)
    except Exception as e:
        logger.debug(f"[cache] parse failed (non-fatal): {e}")


# ─── Per-account circuit breaker (J1 — Apr 24 2026) ───
# When aliyun_b/glm-5 rate-limits, every chart-recommend currently pays the
# full cascade (aliyun_b → aliyun_a → zhipu → deepseek = 28s observed in prod).
# After CB_THRESHOLD consecutive failures of a provider, skip it for
# CB_COOLDOWN seconds. Resets on first success or after cooldown expires.
_CB_FAILURES: Dict[str, int] = {}        # provider name → consecutive failure count
_CB_LAST_FAIL: Dict[str, float] = {}     # provider name → unix ts of last failure
_CB_LOCK = Lock()

CB_THRESHOLD = 2      # consecutive failures before skip kicks in (Apr 28 was 3)
CB_COOLDOWN = 60.0    # seconds to skip after threshold reached


def _cb_should_skip(provider: str) -> bool:
    """Return True if the provider is currently in cooldown.

    Auto-resets the failure counter when cooldown elapses so the provider
    gets one re-probe attempt; if that probe fails the counter starts again.
    """
    with _CB_LOCK:
        fails = _CB_FAILURES.get(provider, 0)
        if fails < CB_THRESHOLD:
            return False
        last = _CB_LAST_FAIL.get(provider, 0.0)
        if (time.time() - last) < CB_COOLDOWN:
            return True
        # Cooldown elapsed — reset and allow a re-probe
        _CB_FAILURES[provider] = 0
        return False


def _cb_record_failure(provider: str) -> None:
    """Increment failure counter and stamp the failure time."""
    with _CB_LOCK:
        _CB_FAILURES[provider] = _CB_FAILURES.get(provider, 0) + 1
        _CB_LAST_FAIL[provider] = time.time()


def _cb_record_success(provider: str) -> None:
    """Reset failure counter on a clean success."""
    with _CB_LOCK:
        if _CB_FAILURES.get(provider):
            _CB_FAILURES[provider] = 0


def get_cb_stats() -> Dict[str, Any]:
    """Snapshot of circuit-breaker state for ops visibility."""
    with _CB_LOCK:
        now = time.time()
        skip_now = [
            p for p, n in _CB_FAILURES.items()
            if n >= CB_THRESHOLD and (now - _CB_LAST_FAIL.get(p, 0.0)) < CB_COOLDOWN
        ]
        return {
            "failures": dict(_CB_FAILURES),
            "last_fail": dict(_CB_LAST_FAIL),
            "skip_now": skip_now,
            "threshold": CB_THRESHOLD,
            "cooldown_seconds": CB_COOLDOWN,
        }


class SLOT(str, Enum):
    """Logical slot that maps to a specific model per provider."""
    CHAT = "chat"
    INSIGHTS = "insights"
    CHART = "chart"
    MAPPER = "mapper"
    REASONING = "reasoning"
    VL = "vl"
    REVIEW = "review"


# ─── Slot → per-provider model name ───
# May 13 2026 mid-month re-audit (after prod incident "All providers exhausted
# for chat"): live SKU probe vs prod keys (audit matrix in
# tests/qa-llm-quota/audit-matrix.md).
#
# Exhausted (403/429/402) on May 13:
#   - aliyun_b: qwen3.6-flash, qwen3.5-flash, qwen-plus  (free 1M used up)
#   - aliyun_a: qwen3.6-flash-2026-04-16, qwen3-vl-flash (free 1M used up)
#   - zhipu:    glm-4-plus, glm-4-air, glm-3-turbo, glm-4 (entire pool 余额 0)
#   - deepseek: ALL SKUs (account balance 0)
#
# Still working (verified 200):
#   - aliyun_b: qwen-flash, qwen-turbo, qwen3.6-35b-a3b, glm-5, deepseek-r1,
#               deepseek-r1-distill-qwen-32b, qwen-vl-plus-2025-05-07
#   - aliyun_a: qwen3.5-plus-2026-04-20 (log "ReadTimeout" was transient),
#               qwen-flash, qwen3.5-plus, qwen3.5-122b-a10b, qwen3.5-397b-a17b,
#               glm-5, qwen3.5-flash
#   - zhipu:    glm-4-flash, glm-4.5-air
#
# Changes vs May 9 picks:
#   CHAT/INSIGHTS aliyun_b: qwen3.6-flash → qwen-flash (free still active)
#   INSIGHTS aliyun_a:      qwen3.6-flash-2026-04-16 → qwen3.5-flash
#   CHAT/INSIGHTS zhipu:    glm-4-plus → glm-4-flash
#   VL aliyun_a:            qwen3-vl-flash → qwen-vl-plus-2025-05-07 (DashScope
#                            compatible-mode lets same SKU id work on both
#                            accounts; A's flash VL exhausted)
#
# May 9 note about "bare aliases on A are PAID" no longer holds — bare
# qwen-flash on A returned 200 with no payment-required error on May 13. Aliyun
# may have rotated free-tier policy. Keep version-suffixed picks where they
# already work to avoid churn; only switch where the version-suffix SKU broke.
#
# Chain order unchanged: free providers first (b > a > zhipu) → paid official
# last. Each provider's 403/429 still triggers fallback per
# `_is_quota_exhausted`. DeepSeek-official is balance-0 across all SKUs but
# 402 falls through "Other errors" path harmlessly to next provider (which is
# end-of-chain, so the chain just exhausts cleanly).
SLOT_MODELS: Dict[SLOT, Dict[str, Optional[str]]] = {
    # CRITICAL: deepseek-v4 default `thinking.type=enabled` adds ~5s of
    # invisible reasoning before visible answer + truncates output. We force
    # `thinking: {"type": "disabled"}` in _normalize_payload_for_provider
    # for the deepseek-official provider. Reasoning slots opt-in by NOT
    # setting that key. DeepSeek models routed via aliyun_b (DashScope
    # compatible-mode) are NOT touched by that hook — DashScope handles
    # thinking semantics itself per its own API contract.
    SLOT.CHAT: {
        "aliyun_b": "qwen-flash",                  # ✅ B free OK May 13 (was qwen3.6-flash 403)
        "aliyun_a": "qwen3.5-plus-2026-04-20",     # ✅ A free OK May 13 (log ReadTimeout was transient)
        "zhipu":    "glm-4-flash",                 # ✅ zhipu free OK May 13 (was glm-4-plus 429)
        "deepseek": "deepseek-v4-flash",           # paid last-resort (balance 0 May 13)
    },
    SLOT.INSIGHTS: {
        "aliyun_b": "qwen-flash",                  # ✅ B free OK May 13 (was qwen3.6-flash 403)
        "aliyun_a": "qwen3.5-flash",               # ✅ A free OK May 13 (was qwen3.6-flash-2026-04-16 403)
        "zhipu":    "glm-4-flash",                 # ✅ zhipu free OK May 13 (was glm-4-plus 429)
        "deepseek": "deepseek-v4-flash",
    },
    SLOT.CHART: {
        "aliyun_b": "glm-5",                        # ✅ B free OK May 13 (unchanged)
        "aliyun_a": "glm-5",                        # ✅ A free OK May 13 (unchanged, expires 2026/05/17)
        "zhipu":    "glm-4.5-air",                  # ✅ zhipu OK May 13 (unchanged)
        "deepseek": "deepseek-v4-flash",
    },
    SLOT.MAPPER: {
        "aliyun_b": "qwen-turbo",                  # ✅ B free OK May 13 (unchanged)
        "aliyun_a": "qwen3.5-122b-a10b",           # ✅ A free OK May 13 (unchanged)
        "zhipu":    "glm-4.5-air",                  # ✅ zhipu OK May 13 (unchanged)
        "deepseek": "deepseek-v4-flash",
    },
    SLOT.REASONING: {
        "aliyun_b": "deepseek-r1",                 # ✅ B free OK May 13 (unchanged)
        "aliyun_a": "qwen3.5-397b-a17b",           # ✅ A free OK May 13 (unchanged)
        "zhipu":    "glm-4.5-air",                  # ✅ zhipu OK May 13 (unchanged)
        "deepseek": "deepseek-v4-pro",             # paid reasoning-grade
    },
    SLOT.VL: {
        "aliyun_b": "qwen-vl-plus-2025-05-07",     # ✅ B free OK May 13 (unchanged)
        "aliyun_a": "qwen-vl-plus-2025-05-07",     # ✅ A free OK May 13 (was qwen3-vl-flash 403; same SKU id works on both accts via DashScope compat-mode)  # noqa: E501
        "zhipu":    "glm-4.6v",                     # ⚠️ payload format incompatible with image_url (zhipu needs different shape)  # noqa: E501
        "deepseek": None,                           # DeepSeek has no VL model
    },
    SLOT.REVIEW: {
        "aliyun_b": "deepseek-r1-distill-qwen-32b",  # ✅ B free OK May 13 (unchanged)
        "aliyun_a": "qwen3.5-397b-a17b",            # ✅ A free OK May 13 (unchanged)
        "zhipu":    "glm-4.5-air",                  # ✅ zhipu OK May 13 (unchanged)
        "deepseek": "deepseek-v4-pro",
    },
}


def _provider_config(account: str) -> Tuple[str, str]:
    """Return (base_url, api_key) for a provider account."""
    mapping = {
        "aliyun_a": (
            os.getenv("LLM_ALIYUN_A_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
            os.getenv("LLM_ALIYUN_A_API_KEY") or os.getenv("LLM_API_KEY", ""),
        ),
        "aliyun_b": (
            os.getenv("LLM_ALIYUN_B_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
            os.getenv("LLM_ALIYUN_B_API_KEY", ""),
        ),
        "zhipu": (
            os.getenv("LLM_ZHIPU_BASE_URL", "https://open.bigmodel.cn/api/paas/v4"),
            os.getenv("LLM_ZHIPU_API_KEY", ""),
        ),
        "deepseek": (
            os.getenv("LLM_DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),
            os.getenv("LLM_DEEPSEEK_API_KEY") or os.getenv("DEEPSEEK_API_KEY", ""),
        ),
    }
    return mapping.get(account, ("", ""))


# May 9 2026 free-first re-order: bailian.console audit confirmed aliyun_b
# is a free-quota mine (~all SKUs have 1M tokens/month free, vector tab even
# has 20M async-embed). Per-SLOT model picks above were also fixed to use
# free SKUs.
# Chain order: free providers first (b > a > zhipu) → paid official last.
# Each provider's 403/AllocationQuota.FreeTierOnly + 429 still triggers
# fallback per `_is_quota_exhausted`, so prod safety unchanged when free
# quotas exhaust mid-month — chain naturally walks to paid tail.
#
# May 13 2026 mid-month re-audit (PR fix/llm-router-quota-switch):
# Picks were refreshed after prod log reported all 4 providers exhausted
# for CHAT slot. Several version-suffixed SKUs exhausted free quota
# mid-month and were swapped to alternate working SKUs on the same
# provider. Chain order unchanged. Re-audit recommended ~every 2 weeks or
# when "All providers exhausted" log line reappears.
DEFAULT_CHAIN: List[str] = ["aliyun_b", "aliyun_a", "zhipu", "deepseek"]


def _is_quota_exhausted(status_code: int, body_text: str) -> bool:
    """Detect 免费额度用完即停 / rate-limit / quota-exceeded from response."""
    if status_code == 403:
        return "FreeTierOnly" in body_text or "AllocationQuota" in body_text
    if status_code == 429:
        # ZhipuAI / DeepSeek may use 429 for quota/rate. Treat as fallback trigger.
        return True
    return False


def _normalize_payload_for_provider(payload: Dict[str, Any], account: str) -> Dict[str, Any]:
    """Adjust payload per provider's accepted schema.

    Apr 27 2026: DeepSeek V4 (api-docs.deepseek.com) defaults thinking.type
    to "enabled" with reasoning_effort "high". On v4-flash that adds ~5s of
    invisible reasoning before the visible answer (observed: 8.2s LLM with
    only 25-76 char visible output vs 3.8s + 449 chars on v3 alias).
    For chat/insights slots we want thinking OFF — explicit answer first.

    Also: DashScope/Aliyun-style payloads use `enable_thinking` (which we
    historically set everywhere) but DeepSeek's API doesn't recognize that
    key. Strip it so DeepSeek doesn't 400 — and replace with the official
    `thinking: {"type": "disabled"}` form.
    """
    out = {**payload}
    if account == "deepseek":
        out.pop("enable_thinking", None)
        # Caller must explicitly opt into thinking for v4 reasoner-style use.
        # Default OFF for chat-class fast paths.
        out.setdefault("thinking", {"type": "disabled"})
    return out


async def call_chain(
    slot: SLOT,
    payload: Dict[str, Any],
    chain: Optional[List[str]] = None,
    timeout: float = 30.0,
) -> Dict[str, Any]:
    """
    Call LLM via provider chain with automatic fallback on 403 FreeTierOnly / 429.

    Per-call timeout: 30s default (Apr 28 2026 optimization, was 120s).
    Worst-case full chain (4 providers) = 120s instead of 480s. DeepSeek-flash
    typical 5-15s, qwen-plus 15-30s, so 30s is comfortable margin while
    failing fast on overloaded providers.

    The payload's `model` field is OVERWRITTEN per-provider based on SLOT_MODELS.
    Other fields (messages, temperature, max_tokens, etc.) are preserved.

    Returns parsed JSON response from the first successful provider.
    Raises RuntimeError if all providers exhaust.
    """
    chain = chain or DEFAULT_CHAIN
    client = get_llm_http_client()
    errors: List[str] = []

    for account in chain:
        model = SLOT_MODELS.get(slot, {}).get(account)
        if not model:
            continue

        # Circuit breaker — skip provider if in cooldown after CB_THRESHOLD fails
        if _cb_should_skip(account):
            logger.info(
                f"[llm_router] slot={slot.value} skipping {account} "
                f"(circuit breaker open, cooldown {CB_COOLDOWN}s)"
            )
            errors.append(f"{account}: cb_open")
            continue

        # Monthly USD budget gate — defense-in-depth for paid deepseek slot
        if account == "deepseek" and await deepseek_over_budget():
            errors.append(f"{account}: budget_exceeded")
            continue

        base_url, api_key = _provider_config(account)
        if not api_key:
            logger.debug(f"[llm_router] {account}: no API key, skip")
            continue

        req_payload = _normalize_payload_for_provider({**payload, "model": model}, account)
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            logger.debug(f"[llm_router] slot={slot.value} try {account}/{model}")
            # Apr 28 2026 (post-review P1, then reviewer round 2 correction):
            # API consistency only — bare `timeout=timeout` and
            # `timeout=httpx.Timeout(timeout)` are EQUIVALENT in httpx (a bare
            # float is shorthand that sets connect=read=write=pool=value, all
            # independent budgets). Phase timeouts are NOT summed. The earlier
            # commit message claim about "TOTAL timeout / 7.5s per phase" was
            # wrong. Keeping the explicit form matches `call_chain_stream`
            # below for readability — no behavior change.
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=req_payload,
                timeout=httpx.Timeout(timeout),
            )
            body_text = resp.text  # may trigger aread() internally

            if 200 <= resp.status_code < 300:
                _cb_record_success(account)
                body_json = resp.json()
                _log_cache_and_record_budget(slot.value, account, model, body_json)
                logger.info(f"[llm_router] slot={slot.value} OK via {account}/{model}")
                return body_json

            if _is_quota_exhausted(resp.status_code, body_text):
                _cb_record_failure(account)
                fails = _CB_FAILURES.get(account, 0)
                logger.warning(
                    f"[llm_router] slot={slot.value} {account}/{model} "
                    f"quota exhausted (status={resp.status_code}, "
                    f"cb_fails={fails}/{CB_THRESHOLD}), falling back"
                )
                errors.append(f"{account}/{model}: quota {resp.status_code}")
                continue

            # Other errors: don't blindly fallback — log and raise
            _cb_record_failure(account)
            fails = _CB_FAILURES.get(account, 0)
            logger.error(
                f"[llm_router] slot={slot.value} {account}/{model} "
                f"error status={resp.status_code} (cb_fails={fails}/{CB_THRESHOLD}): "
                f"{body_text[:200]}"
            )
            errors.append(f"{account}/{model}: http {resp.status_code}")
            # Non-quota errors still fall through to next provider since the
            # endpoint may transiently be broken. Net: we try all providers.
            continue

        except asyncio.TimeoutError:
            _cb_record_failure(account)
            fails = _CB_FAILURES.get(account, 0)
            logger.warning(
                f"[llm_router] {account}/{model} timeout "
                f"(cb_fails={fails}/{CB_THRESHOLD})"
            )
            errors.append(f"{account}/{model}: timeout")
            continue
        except Exception as e:
            _cb_record_failure(account)
            fails = _CB_FAILURES.get(account, 0)
            logger.warning(
                f"[llm_router] {account}/{model} exception "
                f"(cb_fails={fails}/{CB_THRESHOLD}): {e}"
            )
            errors.append(f"{account}/{model}: {type(e).__name__}")
            continue

    raise RuntimeError(f"[llm_router] All providers exhausted for {slot.value}: {'; '.join(errors)}")


# ---------------------------------------------------------------------------
# Streaming variant (Apr 25 2026, E2a)
# ---------------------------------------------------------------------------

async def call_chain_stream(
    slot: SLOT,
    payload: Dict[str, Any],
    chain: Optional[List[str]] = None,
    timeout: float = 45.0,
) -> AsyncIterator[Dict[str, Any]]:
    """Streaming variant of call_chain — yields token deltas with provider fallback.

    Per-call timeout: 45s default (Apr 28 2026 optimization, was 180s).
    Streaming completion can take longer than non-streaming (token-by-token),
    so cap is higher than call_chain. Worst-case 4-provider chain = 180s.
    Mid-stream timeouts after first delta still propagate (no retry by design).

    The payload's `model` field is OVERWRITTEN per-provider based on SLOT_MODELS.
    `stream=True` is forced. Other fields preserved.

    Yielded events:
      - {"type": "delta", "text": "..."}  — many events, one per content chunk
      - {"type": "usage", "tokens": N}    — at most one event, when upstream
                                            reports usage on the final [DONE]
                                            (requires stream_options.include_usage)

    Fallback semantics: provider-level fallback occurs ONLY before the first
    delta has been yielded. Once we've started streaming content from a
    provider, mid-stream errors are propagated as a final delta(text=err)
    + StopIteration to keep the SSE contract intact (caller has already
    sent partial output). This matches existing behavior of the surfaces
    being migrated.

    Pre-stream failures (HTTP error from response.raise_for_status, 403/429,
    timeout connecting, or connection error) trigger fallback to next provider.

    Raises RuntimeError if all providers exhaust BEFORE any delta is yielded.
    """
    chain = chain or DEFAULT_CHAIN
    client = get_llm_http_client()
    errors: List[str] = []
    payload = {**payload, "stream": True}

    # When stream_options is missing the upstream may not report usage.
    # Add include_usage opportunistically — most upstreams ignore unknown
    # flags. AgentOrchestrator already sets this; chat path does not need it.
    payload.setdefault("stream_options", {"include_usage": True})

    for account in chain:
        model = SLOT_MODELS.get(slot, {}).get(account)
        if not model:
            continue

        # Circuit breaker — skip provider if in cooldown after CB_THRESHOLD fails
        if _cb_should_skip(account):
            logger.info(
                f"[llm_router_stream] slot={slot.value} skipping {account} "
                f"(circuit breaker open, cooldown {CB_COOLDOWN}s)"
            )
            errors.append(f"{account}: cb_open")
            continue

        # Monthly USD budget gate — defense-in-depth for paid deepseek slot
        if account == "deepseek" and await deepseek_over_budget():
            errors.append(f"{account}: budget_exceeded")
            continue

        base_url, api_key = _provider_config(account)
        if not api_key:
            logger.debug(f"[llm_router_stream] {account}: no API key, skip")
            continue

        req_payload = _normalize_payload_for_provider({**payload, "model": model}, account)
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        first_delta_yielded = False
        try:
            logger.debug(f"[llm_router_stream] slot={slot.value} try {account}/{model}")
            async with client.stream(
                "POST",
                f"{base_url}/chat/completions",
                headers=headers,
                json=req_payload,
                timeout=httpx.Timeout(timeout),
            ) as resp:
                # Pre-stream error branch — fallback before content yielded
                if resp.status_code >= 400:
                    body_text = (await resp.aread()).decode("utf-8", errors="replace")
                    _cb_record_failure(account)
                    fails = _CB_FAILURES.get(account, 0)
                    if _is_quota_exhausted(resp.status_code, body_text):
                        logger.warning(
                            f"[llm_router_stream] slot={slot.value} {account}/{model} "
                            f"quota exhausted (status={resp.status_code}, "
                            f"cb_fails={fails}/{CB_THRESHOLD}), falling back"
                        )
                        errors.append(f"{account}/{model}: quota {resp.status_code}")
                        continue
                    logger.error(
                        f"[llm_router_stream] slot={slot.value} {account}/{model} "
                        f"error status={resp.status_code} (cb_fails={fails}/{CB_THRESHOLD}): "
                        f"{body_text[:200]}"
                    )
                    errors.append(f"{account}/{model}: http {resp.status_code}")
                    continue

                logger.info(f"[llm_router_stream] slot={slot.value} streaming via {account}/{model}")

                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    # OpenAI SSE format: "data: {...}" or "data:{...}"
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                    elif line.startswith("data: "):
                        data_str = line[6:]
                    else:
                        continue

                    if data_str == "[DONE]":
                        break
                    try:
                        obj = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    choices = obj.get("choices") or []
                    if choices:
                        delta = choices[0].get("delta") or {}
                        content = delta.get("content")
                        if content:
                            first_delta_yielded = True
                            yield {"type": "delta", "text": content}

                    usage = obj.get("usage")
                    if usage:
                        total = int(usage.get("total_tokens") or 0)
                        # Apr 27 2026 (F8 audit): log cache hit on streaming
                        # path so prod cache behavior is observable.
                        # DeepSeek emits prompt_tokens_details.cached_tokens
                        # AND prompt_cache_hit_tokens; DashScope emits
                        # prompt_tokens_details.cached_tokens. Read both.
                        prompt_total = int(usage.get("prompt_tokens") or 0)
                        details = usage.get("prompt_tokens_details") or {}
                        cached = int(
                            details.get("cached_tokens")
                            or usage.get("prompt_cache_hit_tokens")
                            or 0
                        )
                        completion = int(usage.get("completion_tokens") or 0)
                        if prompt_total > 0:
                            pct = 100 * cached // prompt_total if cached else 0
                            logger.info(
                                f"[cache] slot={slot.value} via {account}/{model}: "
                                f"prompt={prompt_total} cached={cached} ({pct}%) "
                                f"completion={completion}"
                            )
                        if account == "deepseek":
                            record_local(model, prompt_total, completion, cached)
                        if total:
                            yield {"type": "usage", "tokens": total}
                # Successful stream — record CB success and return
                _cb_record_success(account)
                return

        except (asyncio.TimeoutError, httpx.TimeoutException):
            if first_delta_yielded:
                # Mid-stream errors don't trip CB (we got partial value from this provider)
                logger.warning(
                    f"[llm_router_stream] {account}/{model} mid-stream timeout — "
                    "propagating partial result (no fallback)"
                )
                return
            _cb_record_failure(account)
            fails = _CB_FAILURES.get(account, 0)
            logger.warning(
                f"[llm_router_stream] {account}/{model} pre-stream timeout, "
                f"falling back (cb_fails={fails}/{CB_THRESHOLD})"
            )
            errors.append(f"{account}/{model}: timeout")
            continue
        except Exception as e:
            if first_delta_yielded:
                # Mid-stream errors don't trip CB (we got partial value from this provider)
                logger.warning(
                    f"[llm_router_stream] {account}/{model} mid-stream exception {type(e).__name__}: {e} — "
                    "propagating partial result (no fallback)"
                )
                return
            _cb_record_failure(account)
            fails = _CB_FAILURES.get(account, 0)
            logger.warning(
                f"[llm_router_stream] {account}/{model} pre-stream exception "
                f"(cb_fails={fails}/{CB_THRESHOLD}): {e}"
            )
            errors.append(f"{account}/{model}: {type(e).__name__}")
            continue

    raise RuntimeError(
        f"[llm_router_stream] All providers exhausted for {slot.value}: {'; '.join(errors)}"
    )
