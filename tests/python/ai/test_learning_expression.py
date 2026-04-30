"""ExpressionLearner — async cron learn expressions from high-conf matches (β C6)."""
from __future__ import annotations
from unittest.mock import AsyncMock, MagicMock, patch
import pytest


@pytest.mark.asyncio
async def test_expression_learner_inserts_high_conf_query():
    """High-conf row → embedding computed → INSERT executed."""
    from ai.learning.expression_learner import ExpressionLearner

    sample_row = {
        "query": "查 F001 工厂的库存",
        "intent_code": "INVENTORY_QUERY",
        "factory_id": "F001",
    }
    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=[sample_row])
    fake_conn.execute = AsyncMock()
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock()
    fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    with patch("ai.learning.expression_learner.get_embedding",
               new=AsyncMock(return_value=[0.1] * 768)):
        learner = ExpressionLearner(fake_pool)
        count = await learner.run_once(min_confidence=0.95)

    assert count == 1
    fake_conn.execute.assert_called_once()


@pytest.mark.asyncio
async def test_expression_learner_skips_when_embedding_fails():
    """Embedding gRPC fail → row skipped, count 0."""
    from ai.learning.expression_learner import ExpressionLearner

    sample_row = {"query": "x", "intent_code": "X", "factory_id": "F"}
    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=[sample_row])
    fake_conn.execute = AsyncMock()
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock(); fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    with patch("ai.learning.expression_learner.get_embedding",
               new=AsyncMock(return_value=None)):
        learner = ExpressionLearner(fake_pool)
        count = await learner.run_once(min_confidence=0.95)

    assert count == 0
    fake_conn.execute.assert_not_called()


@pytest.mark.asyncio
async def test_expression_learner_handles_db_failure():
    """DB fetch error → return 0 gracefully."""
    from ai.learning.expression_learner import ExpressionLearner

    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(side_effect=Exception("table missing"))
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock(); fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    learner = ExpressionLearner(fake_pool)
    count = await learner.run_once(min_confidence=0.95)
    assert count == 0


@pytest.mark.asyncio
async def test_expression_learner_handles_empty_results():
    """0 rows → count 0, no embedding calls."""
    from ai.learning.expression_learner import ExpressionLearner

    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=[])
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock(); fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    with patch("ai.learning.expression_learner.get_embedding",
               new=AsyncMock(return_value=[0.1] * 768)) as mock_emb:
        learner = ExpressionLearner(fake_pool)
        count = await learner.run_once(min_confidence=0.95)

    assert count == 0
    mock_emb.assert_not_called()
