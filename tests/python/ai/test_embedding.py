"""ai/embedding.py — gRPC client + retry.

Mocks _get_stub so tests don't need a real embedding-service running. The
mocked stub.Encode mimics the real EmbeddingServiceStub.Encode signature:
takes an EncodeRequest, returns an EncodeResponse with `embedding` (List[float]),
`success` (bool), `error_message` (str).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import grpc
import pytest


def _make_response(embedding: list, success: bool = True, error: str = "") -> MagicMock:
    """Build a MagicMock that quacks like grpc_stubs.embedding.EncodeResponse."""
    r = MagicMock()
    r.embedding = embedding
    r.success = success
    r.error_message = error
    return r


@pytest.mark.asyncio
async def test_get_embedding_success_returns_vector():
    """Happy path: gRPC Encode returns vector with success=True, function returns it."""
    fake_response = _make_response(embedding=[0.1, 0.2, 0.3, 0.4], success=True)

    with patch("ai.embedding._get_stub") as mock_get_stub:
        mock_stub = MagicMock()
        mock_stub.Encode = AsyncMock(return_value=fake_response)
        mock_get_stub.return_value = mock_stub

        from ai.embedding import get_embedding
        vec = await get_embedding("查询库存")
        assert vec == [0.1, 0.2, 0.3, 0.4]


@pytest.mark.asyncio
async def test_get_embedding_retries_on_transient_error():
    """RpcError once then success → returns vector after retry."""
    fake_ok = _make_response(embedding=[0.5, 0.5], success=True)
    transient_error = grpc.RpcError("transient")

    with patch("ai.embedding._get_stub") as mock_get_stub:
        mock_stub = MagicMock()
        mock_stub.Encode = AsyncMock(side_effect=[transient_error, fake_ok])
        mock_get_stub.return_value = mock_stub

        with patch("asyncio.sleep", new=AsyncMock()):
            from ai.embedding import get_embedding
            vec = await get_embedding("test")
            assert vec == [0.5, 0.5]
            assert mock_stub.Encode.call_count == 2


@pytest.mark.asyncio
async def test_get_embedding_returns_none_after_all_retries_fail():
    """All retries fail → return None (caller skips stage 5)."""
    with patch("ai.embedding._get_stub") as mock_get_stub:
        mock_stub = MagicMock()
        mock_stub.Encode = AsyncMock(side_effect=grpc.RpcError("permanent"))
        mock_get_stub.return_value = mock_stub

        with patch("asyncio.sleep", new=AsyncMock()):
            from ai.embedding import get_embedding
            vec = await get_embedding("test")
            assert vec is None


@pytest.mark.asyncio
async def test_get_embedding_treats_success_false_as_retry():
    """Service returns success=false on first attempt → retry, then succeed.

    Models the cold-start scenario where the embedding-service is up but
    the model is still loading; second attempt succeeds.
    """
    fake_fail = _make_response(embedding=[], success=False, error="model not loaded")
    fake_ok = _make_response(embedding=[1.0, 2.0], success=True)

    with patch("ai.embedding._get_stub") as mock_get_stub:
        mock_stub = MagicMock()
        mock_stub.Encode = AsyncMock(side_effect=[fake_fail, fake_ok])
        mock_get_stub.return_value = mock_stub

        with patch("asyncio.sleep", new=AsyncMock()):
            from ai.embedding import get_embedding
            vec = await get_embedding("test")
            assert vec == [1.0, 2.0]
            assert mock_stub.Encode.call_count == 2


@pytest.mark.asyncio
async def test_get_embedding_returns_none_when_all_attempts_return_success_false():
    """All attempts return success=false → return None (no infinite retry)."""
    fake_fail = _make_response(embedding=[], success=False, error="permanent fail")

    with patch("ai.embedding._get_stub") as mock_get_stub:
        mock_stub = MagicMock()
        mock_stub.Encode = AsyncMock(return_value=fake_fail)
        mock_get_stub.return_value = mock_stub

        with patch("asyncio.sleep", new=AsyncMock()):
            from ai.embedding import get_embedding
            vec = await get_embedding("test")
            assert vec is None
            # Should have tried embedding_retry_attempts times (default 3)
            assert mock_stub.Encode.call_count == 3


def test_vec_to_pgvector_text_format():
    """Centralized vector→pgvector text literal helper (F3 — was triplicated).

    Format: '[v1,v2,...]' consumable by SQL `$N::vector` cast. Used by
    semantic.py / rag/retrieval.py / expression_learner.py — single shared
    definition lives in ai.embedding.
    """
    from ai.embedding import vec_to_pgvector_text
    text = vec_to_pgvector_text([0.1, 0.2, 0.3])
    assert text.startswith("[") and text.endswith("]")
    assert "0.1" in text and "0.2" in text and "0.3" in text
    # Float coercion: int input → float repr
    assert vec_to_pgvector_text([1, 2, 3]) == "[1.0,2.0,3.0]"
