from __future__ import annotations
"""
LLM call infrastructure: non-streaming / streaming / streaming-text,
retry logic, timeout handling, and model selection.
"""
import asyncio
import json
import logging
from typing import Optional, AsyncGenerator

import httpx

from config import get_settings
from common.utils.llm_limiter import llm_rate_limit, get_semaphore
from .prompt_builder import get_scenario_system_role

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Timeout / retry constants
# ---------------------------------------------------------------------------

LLM_TIMEOUT_BASE = 60.0       # Base timeout in seconds
LLM_TIMEOUT_INCREMENT = 15.0  # Added per retry attempt
LLM_TIMEOUT_MAX = 120.0       # Hard cap (non-streaming)
LLM_TIMEOUT_STREAM = 180.0    # Streaming timeout (per-chunk read timeout in httpx).
                              # SSE streams can take longer than non-streaming because
                              # LLMs emit chunks gradually. Bug #14: 120s was too short
                              # for longer analyses -> raise to 180s.
LLM_MAX_RETRIES = 2


# ---------------------------------------------------------------------------
# Shared HTTP client
# ---------------------------------------------------------------------------

def _get_client() -> httpx.AsyncClient:
    from common.llm_client import get_llm_http_client
    return get_llm_http_client()


def _get_active_model(model_override: Optional[str] = None) -> str:
    """Return *model_override* if set, otherwise dedicated insight model from settings."""
    return model_override or get_settings().llm_insight_model


# ---------------------------------------------------------------------------
# Non-streaming LLM call with retry
# ---------------------------------------------------------------------------

async def call_llm(
    prompt: str,
    system_role: Optional[str] = None,
    *,
    enable_thinking: bool = False,
    max_tokens: int = 2500,
    model_override: Optional[str] = None,
) -> str:
    """Call LLM API with timeout and retry.

    Args:
        prompt: User message content.
        system_role: System message; defaults to general scenario role.
        enable_thinking: Whether to enable thinking mode (default False for speed).
        max_tokens: Maximum tokens for the response.
        model_override: Override the default model.

    Returns:
        The assistant's response text, or ``""`` on failure.
    """
    settings = get_settings()
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }

    if not system_role:
        system_role = get_scenario_system_role('general')

    system_content = system_role + " 严格以JSON格式回复，不要附加任何Markdown标记或解释文字。"
    payload = {
        "model": _get_active_model(model_override),
        "messages": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": system_content,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
        "max_tokens": max_tokens,
        "enable_thinking": enable_thinking,
    }

    client = _get_client()
    for attempt in range(LLM_MAX_RETRIES):
        try:
            timeout_secs = min(
                LLM_TIMEOUT_BASE + attempt * LLM_TIMEOUT_INCREMENT,
                LLM_TIMEOUT_MAX,
            )
            async with llm_rate_limit():
                response = await client.post(
                    f"{settings.llm_base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=httpx.Timeout(timeout_secs),
                )
            response.raise_for_status()

            result = response.json()
            # Log cache hit stats for monitoring
            usage = result.get("usage", {})
            prompt_details = usage.get("prompt_tokens_details", {})
            cached = prompt_details.get("cached_tokens", 0)
            total_prompt = usage.get("prompt_tokens", 0)
            if cached > 0:
                logger.info(
                    "[ContextCache] HIT cached=%d/%d tokens (%d%%)",
                    cached, total_prompt,
                    cached * 100 // max(total_prompt, 1),
                )
            return (
                result.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )

        except httpx.TimeoutException:
            logger.warning(
                "LLM call timeout (attempt %d/%d, timeout=%ss)",
                attempt + 1, LLM_MAX_RETRIES, timeout_secs,
            )
            if attempt < LLM_MAX_RETRIES - 1:
                await asyncio.sleep(2 ** attempt * 2)
            else:
                logger.error("LLM call failed after all retry attempts due to timeout")
                return ""
        except httpx.HTTPStatusError as e:
            logger.warning(
                "LLM call HTTP error %s (attempt %d/%d)",
                e.response.status_code, attempt + 1, LLM_MAX_RETRIES,
            )
            if attempt < LLM_MAX_RETRIES - 1:
                await asyncio.sleep(2 ** attempt * 2)
            else:
                logger.error("LLM call failed after all retry attempts: %s", e)
                return ""
    return ""


# ---------------------------------------------------------------------------
# Streaming LLM call (JSON output)
# ---------------------------------------------------------------------------

async def call_llm_stream(
    prompt: str,
    system_role: Optional[str] = None,
    *,
    max_tokens: int = 2500,
    model_override: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Call LLM API with SSE streaming -- yields text chunks as they arrive."""
    settings = get_settings()
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }
    if not system_role:
        system_role = get_scenario_system_role('general')
    system_content = system_role + " 严格以JSON格式回复，不要附加任何Markdown标记或解释文字。"
    payload = {
        "model": _get_active_model(model_override),
        "messages": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": system_content,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
        "max_tokens": max_tokens,
        "stream": True,
        "enable_thinking": False,
    }

    sem = get_semaphore()
    await sem.acquire()
    try:
        async with _get_client().stream(
            "POST",
            f"{settings.llm_base_url}/chat/completions",
            headers=headers,
            json=payload,
            timeout=httpx.Timeout(LLM_TIMEOUT_STREAM),
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
                except (json.JSONDecodeError, IndexError, KeyError):
                    continue
    except Exception as e:
        logger.error("LLM streaming call failed: %s", e)
    finally:
        sem.release()


# ---------------------------------------------------------------------------
# Streaming LLM call (plain-text / markdown output)
# ---------------------------------------------------------------------------

async def call_llm_stream_text(
    prompt: str,
    system_role: Optional[str] = None,
    *,
    max_tokens: int = 3000,
    temperature: float = 0.4,
    model_override: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Call LLM API with SSE streaming for plain-text (markdown) output -- no JSON constraint.

    Yields text chunks as they arrive.
    """
    settings = get_settings()
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }
    if not system_role:
        system_role = (
            "你是一位服务于食品加工企业的资深数据分析师。请用中文回复，使用Markdown格式。"
        )
    payload = {
        "model": _get_active_model(model_override),
        "messages": [
            {"role": "system", "content": system_role},
            {"role": "user", "content": prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
        "enable_thinking": False,
    }

    sem = get_semaphore()
    await sem.acquire()
    try:
        async with _get_client().stream(
            "POST",
            f"{settings.llm_base_url}/chat/completions",
            headers=headers,
            json=payload,
            timeout=httpx.Timeout(LLM_TIMEOUT_STREAM),
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
                except (json.JSONDecodeError, IndexError, KeyError):
                    continue
    except Exception as e:
        logger.error("LLM text streaming call failed: %s", e)
    finally:
        sem.release()


# ---------------------------------------------------------------------------
# Plain-text analysis (non-streaming, markdown output)
# ---------------------------------------------------------------------------

async def generate_text_analysis(
    text: str, *, model_override: Optional[str] = None
) -> str:
    """Analyze free-form text (e.g. cost data from Java) using LLM directly.

    Returns the analysis as plain text (not JSON).
    """
    settings = get_settings()
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": _get_active_model(model_override),
        "messages": [
            {
                "role": "system",
                "content": (
                    "你是一位服务于食品加工企业的资深分析师。"
                    "请根据提供的数据进行深入分析，给出关键发现和可执行建议。"
                    "要求：引用具体数字，分析因果关系，给出量化建议。"
                    "用中文回复，使用Markdown格式。"
                ),
            },
            {"role": "user", "content": text},
        ],
        "temperature": 0.4,
        "max_tokens": 2000,
        "enable_thinking": False,
    }
    try:
        async with llm_rate_limit():
            response = await _get_client().post(
                f"{settings.llm_base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=httpx.Timeout(LLM_TIMEOUT_BASE),
            )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error("Text analysis LLM call failed: %s", e)
        return ""
