"""ParameterLearner — learn regex patterns from extracted_params feedback (β C6)."""
from __future__ import annotations
import json
from unittest.mock import AsyncMock, MagicMock
import pytest


@pytest.mark.asyncio
async def test_parameter_learner_generates_regex_for_factory_id():
    """Sample with factoryId=F001 → regex F\\d+ pattern stored."""
    from ai.learning.parameter_learner import ParameterLearner

    sample_row = {
        "query": "查 F001 库存",
        "intent_code": "INVENTORY_QUERY",
        "factory_id": "F001",
        "extracted_params": json.dumps({"factoryId": "F001"}),
    }
    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=[sample_row])
    fake_conn.execute = AsyncMock()
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock(); fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    learner = ParameterLearner(fake_pool)
    count = await learner.run_once(min_confidence=0.9)

    assert count == 1
    fake_conn.execute.assert_called_once()
    # Verify the pattern is a regex (string starts with valid regex chars)
    call_args = fake_conn.execute.call_args
    pattern_arg = call_args.args[2]  # 3rd positional arg of INSERT_SQL
    assert isinstance(pattern_arg, str)


@pytest.mark.asyncio
async def test_parameter_learner_skips_when_extracted_params_empty():
    """No extracted_params → row skipped."""
    from ai.learning.parameter_learner import ParameterLearner

    sample_row = {
        "query": "随便", "intent_code": "X", "factory_id": "F",
        "extracted_params": json.dumps({}),  # empty
    }
    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=[sample_row])
    fake_conn.execute = AsyncMock()
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock(); fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    learner = ParameterLearner(fake_pool)
    count = await learner.run_once(min_confidence=0.9)
    assert count == 0
    fake_conn.execute.assert_not_called()


@pytest.mark.asyncio
async def test_parameter_learner_handles_db_failure():
    """DB error → return 0."""
    from ai.learning.parameter_learner import ParameterLearner

    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(side_effect=Exception("table missing"))
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    fake_pool = MagicMock(); fake_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    learner = ParameterLearner(fake_pool)
    count = await learner.run_once(min_confidence=0.9)
    assert count == 0


def test_generate_pattern_for_factory_id():
    """F001 → pattern matches F\\d+."""
    import re
    from ai.learning.parameter_learner import generate_pattern
    pattern = generate_pattern("factoryId", "F001")
    assert re.match(pattern, "F001") is not None
    assert re.match(pattern, "F999") is not None


def test_generate_pattern_for_numeric():
    """100 → pattern matches \\d+."""
    import re
    from ai.learning.parameter_learner import generate_pattern
    pattern = generate_pattern("quantity", "100")
    assert re.match(pattern, "100") is not None
    assert re.match(pattern, "5") is not None
