"""Tests for ai.config — env-driven AIConfig dataclass."""

import os
from unittest.mock import patch


def test_default_config_values():
    from ai.config import AIConfig
    cfg = AIConfig()
    assert cfg.semantic_threshold == 0.85
    assert cfg.fusion_threshold == 0.70
    assert cfg.min_confidence_default == 0.70
    assert cfg.llm_timeout_s == 30
    assert cfg.cache_ttl_s == 300
    assert cfg.cache_max_size == 1000
    assert cfg.config_refresh_s == 300
    assert cfg.embedding_grpc_endpoint == "localhost:9090"
    assert cfg.embedding_retry_attempts == 3
    assert cfg.embedding_retry_delay_s == 1.0


def test_env_override():
    with patch.dict(os.environ, {"AI_SEMANTIC_THRESHOLD": "0.90", "AI_LLM_TIMEOUT_S": "60"}):
        from ai.config import AIConfig
        cfg = AIConfig.from_env()
        assert cfg.semantic_threshold == 0.90
        assert cfg.llm_timeout_s == 60


def test_from_env_falls_back_to_defaults_when_env_empty():
    """Confirm AIConfig.from_env() returns spec defaults when AI_* env vars unset."""
    with patch.dict(os.environ, {}, clear=True):
        from ai.config import AIConfig
        cfg = AIConfig.from_env()
        assert cfg.semantic_threshold == 0.85
        assert cfg.fusion_threshold == 0.70
        assert cfg.min_confidence_default == 0.70
        assert cfg.llm_timeout_s == 30
        assert cfg.cache_ttl_s == 300
        assert cfg.cache_max_size == 1000
        assert cfg.config_refresh_s == 300
        assert cfg.embedding_grpc_endpoint == "localhost:9090"
        assert cfg.embedding_retry_attempts == 3
        assert cfg.embedding_retry_delay_s == 1.0
