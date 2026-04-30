"""gRPC client for Java embedding-service (port 9090).

Service is always-up via systemd `cretas-embedding.service` per
.claude/rules/server-operations.md. Cold restart window is ~15s
(RestartSec=15). Our retry policy tolerates 3s of unavailability.

If all retries fail, return None — caller (ai/matcher/semantic.py) handles
None by skipping stage 5 and falling through to stage 6 (CLASSIFIER).

NOTE: Real EmbeddingServiceStub wiring requires protobuf-generated Python
module. Run:
  python -m grpc_tools.protoc -I=proto --python_out=. --grpc_python_out=. embedding.proto
from the embedding-service .proto. This is a Phase 2B-α integration sub-task
captured as R-WIRING in spec §11. The retry/error semantics here do not
depend on stub class — tests mock _get_stub so the placeholder works.
"""
from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

import grpc

from ai.config import default_config

logger = logging.getLogger(__name__)


# Lazy-init globals
_channel: Optional[grpc.aio.Channel] = None
_stub: Optional[object] = None


async def _get_stub():
    """Return the gRPC stub, lazy-init the channel.

    Real implementation must reference the protobuf-generated stub class.
    Phase 2A reference: see backend/python/embedding_pb2_grpc.py if exists,
    else regenerate from the .proto in
    backend/java/embedding-service/src/main/proto/.

    For now this raises NotImplementedError so the caller-flow contract
    is testable (via mocking) but bare invocation forces the integrator
    to wire the stub. See R-WIRING note in spec §11.
    """
    global _channel, _stub
    if _stub is None:
        _channel = grpc.aio.insecure_channel(default_config.embedding_grpc_endpoint)
        # TODO[wiring]: import and instantiate the real stub here, e.g.:
        #   from embedding_pb2_grpc import EmbeddingServiceStub
        #   _stub = EmbeddingServiceStub(_channel)
        raise NotImplementedError(
            "Wire EmbeddingServiceStub here. See backend/java/embedding-service/.proto"
        )
    return _stub


async def get_embedding(text: str) -> Optional[List[float]]:
    """Compute embedding for query text.

    Returns the vector on success, None if all retries fail.
    """
    cfg = default_config
    last_error: Optional[Exception] = None
    for attempt in range(1, cfg.embedding_retry_attempts + 1):
        try:
            stub = await _get_stub()
            # Real call signature depends on .proto. Placeholder uses
            # GetEmbedding(text) returning {vector: [float]}.
            response = await stub.GetEmbedding(text)
            return list(response.vector)
        except grpc.RpcError as e:
            last_error = e
            logger.warning(
                "Embedding gRPC attempt %d/%d failed: %s",
                attempt, cfg.embedding_retry_attempts, e,
            )
            if attempt < cfg.embedding_retry_attempts:
                await asyncio.sleep(cfg.embedding_retry_delay_s)
        except NotImplementedError:
            # Stub not wired yet — propagate for clear error in test/dev
            raise
    logger.error(
        "Embedding gRPC failed after %d attempts: %s",
        cfg.embedding_retry_attempts, last_error,
    )
    return None


async def close_channel():
    """Cleanup on shutdown."""
    global _channel, _stub
    if _channel is not None:
        await _channel.close()
        _channel = None
        _stub = None
