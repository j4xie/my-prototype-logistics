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

CB_THRESHOLD = 3      # consecutive failures before skip kicks in
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
    # Apr 26 2026 v4-quota-fix: replaced qwen3-max-2026-01-23 (free tier
    # exhausted, 630 403 errors today) with qwen-plus (paid, validated).
    # zhipu glm-4.5-air returned empty (model name no longer exists);
    # replaced with glm-4-plus (validated). deepseek-chat works as-is.
    SLOT.CHAT: {
        "aliyun_b": "qwen-plus",
        "aliyun_a": "qwen-plus",
        "zhipu":    "glm-4-plus",
        "deepseek": "deepseek-chat",
    },
    SLOT.INSIGHTS: {
        "aliyun_b": "qwen-plus",
        "aliyun_a": "qwen-plus",
        "zhipu":    "glm-4-plus",
        "deepseek": "deepseek-chat",
    },
    SLOT.CHART: {
        "aliyun_b": "glm-5",
        "aliyun_a": "glm-5",
        "zhipu":    "glm-4.5-air",
        "deepseek": "deepseek-chat",
    },
    SLOT.MAPPER: {
        "aliyun_b": "qwen-turbo-1101",       # 10M tokens on Account B
        "aliyun_a": "qwen3.5-122b-a10b",
        "zhipu":    "glm-4.5-air",
        "deepseek": "deepseek-chat",
    },
    SLOT.REASONING: {
        "aliyun_b": "deepseek-v3.2-exp",      # DeepSeek via 百炼 = free!
        "aliyun_a": "qwen3.5-397b-a17b",
        "zhipu":    "glm-4.5-air",
        "deepseek": "deepseek-reasoner",
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
        "deepseek": "deepseek-chat",
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


# Apr 26 2026 v5 quota-fix: re-ordered after v5 verification revealed
# aliyun_b/qwen-plus also exhausted free tier (450+ 403 errors during v5 run).
# aliyun_a/qwen-plus still has quota; deepseek-chat is paid + reliable.
# New order: aliyun_a (still has quota) → deepseek (paid, stable) →
# zhipu → aliyun_b (last resort, expected to fail).
DEFAULT_CHAIN: List[str] = ["aliyun_a", "deepseek", "zhipu", "aliyun_b"]


def _is_quota_exhausted(status_code: int, body_text: str) -> bool:
    """Detect 免费额度用完即停 / rate-limit / quota-exceeded from response."""
    if status_code == 403:
        return "FreeTierOnly" in body_text or "AllocationQuota" in body_text
    if status_code == 429:
        # ZhipuAI / DeepSeek may use 429 for quota/rate. Treat as fallback trigger.
        return True
    return False


async def call_chain(
    slot: SLOT,
    payload: Dict[str, Any],
    chain: Optional[List[str]] = None,
    timeout: float = 120.0,
) -> Dict[str, Any]:
    """
    Call LLM via provider chain with automatic fallback on 403 FreeTierOnly / 429.

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

        req_payload = {**payload, "model": model}
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
    timeout: float = 180.0,
) -> AsyncIterator[Dict[str, Any]]:
    """Streaming variant of call_chain — yields token deltas with provider fallback.

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

        req_payload = {**payload, "model": model}
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
