"""ai/embedding.py — gRPC client + retry."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_get_embedding_success_returns_vector():
    """Happy path: gRPC returns vector, function returns it."""
    fake_response = MagicMock()
    fake_response.vector = [0.1, 0.2, 0.3, 0.4]

    with patch("ai.embedding._get_stub") as mock_get_stub:
        mock_stub = MagicMock()
        mock_stub.GetEmbedding = AsyncMock(return_value=fake_response)
        mock_get_stub.return_value = mock_stub

        from ai.embedding import get_embedding
        vec = await get_embedding("查询库存")
        assert vec == [0.1, 0.2, 0.3, 0.4]


@pytest.mark.asyncio
async def test_get_embedding_retries_on_transient_error():
    """RpcError once then success → returns vector after retry."""
    import grpc

    fake_ok = MagicMock()
    fake_ok.vector = [0.5, 0.5]

    transient_error = grpc.RpcError("transient")

    with patch("ai.embedding._get_stub") as mock_get_stub:
        mock_stub = MagicMock()
        mock_stub.GetEmbedding = AsyncMock(side_effect=[transient_error, fake_ok])
        mock_get_stub.return_value = mock_stub

        with patch("asyncio.sleep", new=AsyncMock()):
            from ai.embedding import get_embedding
            vec = await get_embedding("test")
            assert vec == [0.5, 0.5]
            assert mock_stub.GetEmbedding.call_count == 2


@pytest.mark.asyncio
async def test_get_embedding_returns_none_after_all_retries_fail():
    """All retries fail → return None (caller skips stage 5)."""
    import grpc

    with patch("ai.embedding._get_stub") as mock_get_stub:
        mock_stub = MagicMock()
        mock_stub.GetEmbedding = AsyncMock(side_effect=grpc.RpcError("permanent"))
        mock_get_stub.return_value = mock_stub

        with patch("asyncio.sleep", new=AsyncMock()):
            from ai.embedding import get_embedding
            vec = await get_embedding("test")
            assert vec is None
