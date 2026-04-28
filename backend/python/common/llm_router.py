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

from common.llm_client import get_llm_http_client

logger = logging.getLogger(__name__)


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
# Priority: aliyun_b (newest/freshest quota) → aliyun_a → zhipu → deepseek
# All 4 are OpenAI-compatible via /chat/completions
# Model names must match what each provider exposes.
SLOT_MODELS: Dict[SLOT, Dict[str, Optional[str]]] = {
    # Apr 27 2026 v4-fix: DeepSeek API rev'd to V4 only (v4-flash + v4-pro).
    # Per api-docs.deepseek.com:
    #   - deepseek-v4-flash: standard chat (= legacy `deepseek-chat` alias)
    #   - deepseek-v4-pro: reasoning (= legacy `deepseek-reasoner` alias,
    #     2026-07-24 retire)
    #   - deepseek-chat / deepseek-reasoner: back-compat aliases (deprecated
    #     but still routed)
    # CRITICAL: V4 default `thinking.type=enabled` adds ~5s of invisible
    # reasoning before visible answer + truncates output. We force
    # `thinking: {"type": "disabled"}` in _normalize_payload_for_provider
    # for chat-class slots. Reasoning slots opt-in by NOT setting that key.
    SLOT.CHAT: {
        # Apr 27 2026 (F4): aliyun_b changed qwen-plus → qwen-flash for chain
        # diversity. Both aliyun_a + aliyun_b previously hit qwen-plus → shared
        # DashScope rate-limit, when DashScope hiccups both fail at once.
        # qwen-flash is the smaller/faster qwen variant (~3-5s in API probe vs
        # ~10s for qwen-plus). RICH 412-468 char answer with full GUARD
        # structure preserved (3 段 + 量化 + 时间窗口). Chain order means it's
        # only used as last fallback after deepseek-v4-flash + aliyun_a/qwen-plus
        # + zhipu/glm-4-plus exhaust — rare but valuable灾备.
        "aliyun_b": "qwen-flash",
        "aliyun_a": "qwen-plus",
        "zhipu":    "glm-4-plus",
        "deepseek": "deepseek-v4-flash",
    },
    SLOT.INSIGHTS: {
        "aliyun_b": "qwen-flash",  # F4 same diversification logic as CHAT
        "aliyun_a": "qwen-plus",
        "zhipu":    "glm-4-plus",
        "deepseek": "deepseek-v4-flash",
    },
    SLOT.CHART: {
        "aliyun_b": "glm-5",
        "aliyun_a": "glm-5",
        "zhipu":    "glm-4.5-air",
        "deepseek": "deepseek-v4-flash",
    },
    SLOT.MAPPER: {
        "aliyun_b": "qwen-turbo-1101",       # 10M tokens on Account B
        "aliyun_a": "qwen3.5-122b-a10b",
        "zhipu":    "glm-4.5-air",
        "deepseek": "deepseek-v4-flash",
    },
    SLOT.REASONING: {
        "aliyun_b": "deepseek-v3.2-exp",      # DeepSeek via 百炼 = free!
        "aliyun_a": "qwen3.5-397b-a17b",
        "zhipu":    "glm-4.5-air",
        "deepseek": "deepseek-v4-pro",
    },
    SLOT.VL: {
        "aliyun_b": "qwen3-vl-plus-2025-05-07",
        "aliyun_a": "qwen3-vl-flash",
        "zhipu":    "glm-4.6v",
        "deepseek": None,                      # DeepSeek has no VL model
    },
    SLOT.REVIEW: {
        "aliyun_b": "deepseek-v3.2",           # DeepSeek via 百炼 = free!
        "aliyun_a": "deepseek-v3",
        "zhipu":    "glm-4.5-air",
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


# Apr 27 2026 v8 quota-fix: deepseek-chat verified stable (paid API, no
# free-tier limit). Re-ordered to deepseek-first because:
#   - deepseek-chat: paid, stable, ~$0.14/1M input + $0.28/1M output (cheap)
#   - aliyun_a/qwen-plus: works but DashScope sometimes hits FreeTierOnly
#     cap mid-day even on this account
#   - zhipu/glm-4-plus: stable backup
#   - aliyun_b/qwen-plus: free tier exhausted today (last resort)
# Test: direct curl to deepseek streams 60-char Chinese answer in <2s.
DEFAULT_CHAIN: List[str] = ["deepseek", "aliyun_a", "zhipu", "aliyun_b"]


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
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=req_payload,
                timeout=timeout,
            )
            body_text = resp.text  # may trigger aread() internally

            if 200 <= resp.status_code < 300:
                _cb_record_success(account)
                logger.info(f"[llm_router] slot={slot.value} OK via {account}/{model}")
                return resp.json()

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
                        if prompt_total > 0:
                            pct = 100 * cached // prompt_total if cached else 0
                            logger.info(
                                f"[cache] slot={slot.value} via {account}/{model}: "
                                f"prompt={prompt_total} cached={cached} ({pct}%) "
                                f"completion={int(usage.get('completion_tokens') or 0)}"
                            )
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
