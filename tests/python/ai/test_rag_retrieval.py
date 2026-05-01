"""RAG retrieval reads existing tables (β C5, audit fix CR-3)."""
from __future__ import annotations
from unittest.mock import AsyncMock, MagicMock, patch
import pytest


@pytest.mark.asyncio
async def test_rag_retrieval_returns_top_k_from_intent_match_records():
    from ai.rag.retrieval import RAGRetriever, RAGCase

    fake_rows = [
        {"query": "查 F001 库存", "intent_code": "INVENTORY_QUERY", "confidence": 0.95,
         "factory_id": "F001", "similarity": 0.91, "source": "match_record"},
        {"query": "看一下库存", "intent_code": "INVENTORY_QUERY", "confidence": 0.88,
         "factory_id": None, "similarity": 0.85, "source": "match_record"},
    ]
    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=fake_rows)
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock()
    fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    with patch("ai.rag.retrieval.get_embedding_cached",
               new=AsyncMock(return_value=[0.1] * 768)):
        retriever = RAGRetriever(fake_pool)
        cases = await retriever.retrieve(query="查库存", factory_id="F001", top_k=5)
    assert len(cases) == 2
    assert cases[0].similarity == 0.91
    assert isinstance(cases[0], RAGCase)
    assert cases[0].source == "match_record"


@pytest.mark.asyncio
async def test_rag_retrieval_returns_empty_when_embedding_unavailable():
    from ai.rag.retrieval import RAGRetriever
    fake_pool = MagicMock()

    with patch("ai.rag.retrieval.get_embedding_cached", new=AsyncMock(return_value=None)):
        retriever = RAGRetriever(fake_pool)
        cases = await retriever.retrieve(query="x", factory_id="F001", top_k=5)
    assert cases == []


@pytest.mark.asyncio
async def test_rag_retrieval_returns_empty_when_db_fails():
    """DB error → return [] gracefully (degrade not crash)."""
    from ai.rag.retrieval import RAGRetriever

    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(side_effect=Exception("table missing"))
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock()
    fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    with patch("ai.rag.retrieval.get_embedding_cached",
               new=AsyncMock(return_value=[0.1] * 768)):
        retriever = RAGRetriever(fake_pool)
        cases = await retriever.retrieve(query="x", factory_id="F", top_k=5)
    assert cases == []


@pytest.mark.asyncio
async def test_rag_retrieval_handles_empty_results():
    """0 results from DB → empty cases (cold-start safe)."""
    from ai.rag.retrieval import RAGRetriever

    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=[])
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock()
    fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    with patch("ai.rag.retrieval.get_embedding_cached",
               new=AsyncMock(return_value=[0.1] * 768)):
        retriever = RAGRetriever(fake_pool)
        cases = await retriever.retrieve(query="x", factory_id="F", top_k=5)
    assert cases == []
