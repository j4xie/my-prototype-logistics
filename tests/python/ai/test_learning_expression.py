"""ExpressionLearner — async cron learn expressions from high-conf matches (β C6).

Post-W0 fix-pass F1: rewritten with REAL Java schema:
- intent_match_records.user_input → query (SQL alias)
- intent_match_records.matched_intent_code → intent_code (SQL alias)
- intent_match_records.confidence_score (was: confidence)
- ai_learned_expressions has NOT NULL: id / expression_hash / source_type
- INSERT now passes 5 args: intent_code, expression, hash, vec_text, factory_id
- embedding_vec is new pgvector column (vec_text passed as text literal)
"""
from __future__ import annotations
from unittest.mock import AsyncMock, MagicMock, patch
import pytest


@pytest.mark.asyncio
async def test_expression_learner_inserts_high_conf_query():
    """High-conf row → embedding computed → INSERT executed with 5 args + vec_text + hash."""
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
    # Verify INSERT positional args order: intent_code, expression, hash, vec_text, factory_id
    call_args = fake_conn.execute.call_args
    assert call_args.args[1] == "INVENTORY_QUERY"  # $1 intent_code
    assert call_args.args[2] == "查 F001 工厂的库存"  # $2 expression
    # $3 expression_hash: SHA256 hex string (64 chars)
    assert isinstance(call_args.args[3], str)
    assert len(call_args.args[3]) == 64
    # $4 vec_text: pgvector text literal "[v1,v2,...]"
    vec_arg = call_args.args[4]
    assert isinstance(vec_arg, str)
    assert vec_arg.startswith("[") and vec_arg.endswith("]")
    # $5 factory_id
    assert call_args.args[5] == "F001"


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


def test_compute_expression_hash_sha256_hex():
    """Hash helper returns 64-char hex string (SHA256)."""
    from ai.learning.expression_learner import _compute_expression_hash
    h = _compute_expression_hash("查询库存")
    assert isinstance(h, str)
    assert len(h) == 64
    assert all(c in "0123456789abcdef" for c in h)
    # Same input → same hash (deterministic, SHA256 NOT NULL UNIQUE constraint compatible)
    assert _compute_expression_hash("查询库存") == h


def test_vec_to_pgvector_text_format():
    """Vector text literal: '[v1,v2,...]' format consumable by SQL ::vector cast."""
    from ai.learning.expression_learner import _vec_to_pgvector_text
    text = _vec_to_pgvector_text([0.1, 0.2, 0.3])
    assert text.startswith("[") and text.endswith("]")
    assert "0.1" in text and "0.2" in text and "0.3" in text
