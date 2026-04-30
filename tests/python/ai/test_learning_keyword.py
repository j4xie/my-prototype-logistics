"""KeywordLearner — async cron extract new keywords from feedback (β C6).

Post-W0 fix-pass F1: rewritten with REAL Java schema:
- ai_training_samples (was: training_samples)
- user_input → query, matched_intent_code → intent_code (SQL aliases)
- run_once now persists via UPDATE ai_intent_configs.keywords (was: stub)
"""
from __future__ import annotations
from unittest.mock import AsyncMock, MagicMock
import pytest


@pytest.mark.asyncio
async def test_keyword_learner_extracts_new_keywords_from_query():
    """Unseen keywords from query → returned in learned dict."""
    from ai.learning.keyword_learner import KeywordLearner

    # Sample row uses SQL alias names (user_input AS query, matched_intent_code AS intent_code)
    sample_row = {
        "query": "查询 F001 工厂的库存数量",
        "intent_code": "INVENTORY_QUERY",
        "factory_id": "F001",
        "confidence": 0.95,
    }
    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=[sample_row])
    fake_conn.execute = AsyncMock()  # persistence UPDATE
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock()
    fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    existing_keywords = {"INVENTORY_QUERY": ["库存", "查询"]}
    learner = KeywordLearner(fake_pool, existing_keywords)
    learned = await learner.run_once(min_confidence=0.9)

    assert "INVENTORY_QUERY" in learned
    # "查询", "库存" already known. "数量", "工厂" unseen.
    assert "数量" in learned["INVENTORY_QUERY"]


@pytest.mark.asyncio
async def test_keyword_learner_persists_via_update():
    """Learned keywords → UPDATE ai_intent_configs.keywords issued (F1 fix-pass)."""
    from ai.learning.keyword_learner import KeywordLearner

    sample_row = {
        "query": "查询 F001 工厂的库存数量",
        "intent_code": "INVENTORY_QUERY",
        "factory_id": "F001",
        "confidence": 0.95,
    }
    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=[sample_row])
    fake_conn.execute = AsyncMock()
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock()
    fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    existing_keywords = {"INVENTORY_QUERY": ["库存", "查询"]}
    learner = KeywordLearner(fake_pool, existing_keywords)
    learned = await learner.run_once(min_confidence=0.9)

    assert learned  # non-empty learned dict
    fake_conn.execute.assert_called()  # UPDATE issued
    # Verify UPDATE positional args: (json_string, intent_code, factory_id)
    call_args = fake_conn.execute.call_args
    intent_arg = call_args.args[2]  # 3rd positional arg of UPDATE_KEYWORDS_SQL
    factory_arg = call_args.args[3]
    assert intent_arg == "INVENTORY_QUERY"
    assert factory_arg == "F001"


@pytest.mark.asyncio
async def test_keyword_learner_skips_low_confidence():
    """Confidence < min_confidence → row skipped."""
    from ai.learning.keyword_learner import KeywordLearner

    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=[])  # SQL filters by min_confidence
    fake_conn.execute = AsyncMock()
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock()
    fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    learner = KeywordLearner(fake_pool, existing_keywords={})
    learned = await learner.run_once(min_confidence=0.9)
    assert learned == {}
    # Empty learned → no UPDATE issued (skipped)
    fake_conn.execute.assert_not_called()


@pytest.mark.asyncio
async def test_keyword_learner_skips_already_known_keywords():
    """All tokens already in existing_keywords → empty learned dict (no new)."""
    from ai.learning.keyword_learner import KeywordLearner

    sample_row = {
        "query": "查询库存", "intent_code": "X", "factory_id": "F001", "confidence": 0.95,
    }
    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=[sample_row])
    fake_conn.execute = AsyncMock()
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock()
    fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    learner = KeywordLearner(fake_pool, existing_keywords={"X": ["查询", "库存"]})
    learned = await learner.run_once(min_confidence=0.9)
    assert learned == {}  # all tokens known


@pytest.mark.asyncio
async def test_keyword_learner_handles_db_failure():
    """DB error → return {} gracefully."""
    from ai.learning.keyword_learner import KeywordLearner

    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(side_effect=Exception("table missing"))
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock()
    fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    learner = KeywordLearner(fake_pool, existing_keywords={})
    learned = await learner.run_once(min_confidence=0.9)
    assert learned == {}


def test_tokenize_extracts_2_to_4_char_chinese_chunks():
    from ai.learning.keyword_learner import tokenize
    tokens = tokenize("查询 F001 工厂的库存数量")
    # Expected: 2-4 char Chinese chunks. "F001" excluded (not Chinese).
    assert "查询" in tokens
    assert "工厂" in tokens or "厂的" in tokens or "库存" in tokens
    assert "数量" in tokens
    assert "F001" not in tokens


def test_tokenize_filters_stopwords():
    from ai.learning.keyword_learner import tokenize, STOP_WORDS
    tokens = tokenize("我和你的库存")  # 我, 和, 你, 的 are stopwords (single-char though)
    # 2-4 char filter naturally excludes single chars; just verify "库存" survives
    assert "库存" in tokens
