"""
Shared LLM HTTP Client

Provides a process-wide httpx.AsyncClient singleton with connection pooling
for all DashScope LLM API calls. Eliminates per-request DNS+TLS handshake
overhead (~200ms savings on subsequent calls).

Usage:
    from common.llm_client import get_llm_http_client
    client = get_llm_http_client()
    resp = await client.post(url, json=payload, timeout=httpx.Timeout(30.0))
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_client: Optional[httpx.AsyncClient] = None


def get_llm_http_client() -> httpx.AsyncClient:
    """
    Return the shared LLM HTTP client.

    If init_llm_client() hasn't been called yet (e.g. during testing or
    lazy startup), creates a fallback client with default pool settings.
    """
    global _client
    if _client is None:
        logger.warning("Shared LLM client not initialized, creating fallback")
        _client = httpx.AsyncClient(
            limits=httpx.Limits(
                max_connections=20,
                max_keepalive_connections=10,
                keepalive_expiry=30,
            ),
            timeout=httpx.Timeout(120.0),
        )
    return _client


async def init_llm_client(base_url: str, api_key: str) -> None:
    """
    Initialize the shared LLM HTTP client with connection pool.

    Call once during application startup (lifespan).

    Args:
        base_url: DashScope API base URL (e.g. https://dashscope.aliyuncs.com/compatible-mode/v1)
        api_key: DashScope API key
    """
    global _client
    if _client is not None:
        await _client.aclose()

    _client = httpx.AsyncClient(
        limits=httpx.Limits(
            max_connections=20,
            max_keepalive_connections=10,
            keepalive_expiry=30,
        ),
        timeout=httpx.Timeout(120.0),
    )
    logger.info("Shared LLM HTTP client created (pool: 20 max, 10 keepalive)")

    # Warmup: send a minimal request to establish connection + TLS
    if api_key:
        try:
            resp = await _client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "qwen3.5-flash",
                    "messages": [{"role": "user", "content": "hi"}],
                    "max_tokens": 1,
                    "enable_thinking": False,
                },
                timeout=httpx.Timeout(10.0),
            )
            logger.info(f"LLM client warmup request: status={resp.status_code}")
        except Exception as e:
            logger.warning(f"LLM client warmup failed (non-fatal): {e}")


async def close_llm_client() -> None:
    """Close the shared LLM HTTP client. Call during application shutdown."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
        logger.info("Shared LLM HTTP client closed")
