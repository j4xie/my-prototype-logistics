"""gRPC client for Java embedding-service (port 9090).

Service: EmbeddingService.Encode(EncodeRequest) → EncodeResponse
- EncodeRequest: { text: str }
- EncodeResponse: { embedding: List[float], success: bool, error_message: str }

Service is always-up via systemd `cretas-embedding.service` per
.claude/rules/server-operations.md. Cold restart window is ~15s
(RestartSec=15). Our retry policy tolerates 3s of unavailability.

If service down (RpcError) or returns success=false, retry up to
AI_EMBEDDING_RETRY_ATTEMPTS (default 3). All retries fail → return None,
caller (ai/matcher/semantic.py) handles None by skipping stage 5 and falling
through to stage 6 (CLASSIFIER).

Stub regen: see scripts/phase2b/regen-embedding-stub.sh — run when
backend/java/embedding-service/.../embedding.proto changes.
"""
from __future__ import annotations

import asyncio
import contextvars
import logging
from typing import List, Optional

import grpc

from ai.config import default_config

logger = logging.getLogger(__name__)


# Request-scoped embedding cache (β CR-2 fix from audit)
# FastAPI middleware initializes a fresh dict per request to prevent cross-request leak.
# Stage 5 SEMANTIC (α) and SemanticRouter (β C1) share results via this cache.
_request_embedding_cache: contextvars.ContextVar[dict] = contextvars.ContextVar(
    "_request_embedding_cache", default={}
)


# Lazy-init globals: channel + stub created on first call. Channel is reused
# for the process lifetime (gRPC client multiplexes requests over single
# HTTP/2 connection). close_channel() resets globals on shutdown.
_channel: Optional[grpc.aio.Channel] = None
_stub: Optional[object] = None


async def _get_stub():
    """Return the gRPC stub, lazy-init the channel.

    Imports the protobuf-generated stub at first call (not at module top)
    so a missing stub file does not crash module import — only the eventual
    stage 5 SEMANTIC matcher call. Caller (semantic matcher) catches the
    resulting failure and falls through to stage 6 (CLASSIFIER).
    """
    global _channel, _stub
    if _stub is None:
        _channel = grpc.aio.insecure_channel(default_config.embedding_grpc_endpoint)
        from grpc_stubs.embedding import embedding_pb2_grpc
        _stub = embedding_pb2_grpc.EmbeddingServiceStub(_channel)
    return _stub


async def get_embedding(text: str) -> Optional[List[float]]:
    """Compute embedding for query text.

    Returns the vector on success, None if all retries fail.

    Two failure modes are treated as retryable:
        1. grpc.RpcError — service unreachable / timed out / etc.
        2. EncodeResponse.success == false — server-side failure
           (e.g. model not loaded). Retried because cold-start can recover.
    """
    cfg = default_config
    last_error: Optional[Exception] = None
    for attempt in range(1, cfg.embedding_retry_attempts + 1):
        try:
            stub = await _get_stub()
            from grpc_stubs.embedding import embedding_pb2
            request = embedding_pb2.EncodeRequest(text=text)
            response = await stub.Encode(request)
            if not response.success:
                err = response.error_message or "unknown"
                last_error = RuntimeError(
                    f"EmbeddingService returned success=false: {err}"
                )
                logger.warning(
                    "Embedding gRPC attempt %d/%d returned success=false: %s",
                    attempt, cfg.embedding_retry_attempts, err,
                )
                if attempt < cfg.embedding_retry_attempts:
                    await asyncio.sleep(cfg.embedding_retry_delay_s)
                continue
            return list(response.embedding)
        except grpc.RpcError as e:
            last_error = e
            logger.warning(
                "Embedding gRPC attempt %d/%d failed: %s",
                attempt, cfg.embedding_retry_attempts, e,
            )
            if attempt < cfg.embedding_retry_attempts:
                await asyncio.sleep(cfg.embedding_retry_delay_s)
    logger.error(
        "Embedding gRPC failed after %d attempts: %s",
        cfg.embedding_retry_attempts, last_error,
    )
    return None


async def get_embedding_cached(text: str) -> Optional[List[float]]:
    """Request-scoped cached version of get_embedding.

    Useful when multiple stages need embedding for same text within one request.
    Cache scope is per asyncio context (set via FastAPI middleware in api.py).
    Failures (None return) are NOT cached so retry can succeed.
    """
    cache = _request_embedding_cache.get()
    if text in cache:
        return cache[text]
    vec = await get_embedding(text)
    if vec is not None:
        cache[text] = vec
    return vec


async def close_channel():
    """Cleanup on shutdown."""
    global _channel, _stub
    if _channel is not None:
        await _channel.close()
        _channel = None
        _stub = None
