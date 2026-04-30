"""AI module config.

Centralized constants and env-driven overrides. Avoids magic numbers in
matcher/orchestrator code.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class AIConfig:
    """Phase 2B AI module config.

    All thresholds tunable via env. Defaults match spec §6 / §7 baseline.
    """

    semantic_threshold: float = 0.85
    fusion_threshold: float = 0.70
    min_confidence_default: float = 0.70
    llm_timeout_s: int = 30
    cache_ttl_s: int = 300
    cache_max_size: int = 1000
    config_refresh_s: int = 300
    embedding_grpc_endpoint: str = "localhost:9090"
    embedding_retry_attempts: int = 3
    embedding_retry_delay_s: float = 1.0

    @classmethod
    def from_env(cls) -> "AIConfig":
        return cls(
            semantic_threshold=float(os.environ.get("AI_SEMANTIC_THRESHOLD", "0.85")),
            fusion_threshold=float(os.environ.get("AI_FUSION_THRESHOLD", "0.70")),
            min_confidence_default=float(os.environ.get("AI_MIN_CONFIDENCE", "0.70")),
            llm_timeout_s=int(os.environ.get("AI_LLM_TIMEOUT_S", "30")),
            cache_ttl_s=int(os.environ.get("AI_CACHE_TTL_S", "300")),
            cache_max_size=int(os.environ.get("AI_CACHE_MAX_SIZE", "1000")),
            config_refresh_s=int(os.environ.get("AI_CONFIG_REFRESH_S", "300")),
            embedding_grpc_endpoint=os.environ.get(
                "AI_EMBEDDING_GRPC_ENDPOINT", "localhost:9090"
            ),
            embedding_retry_attempts=int(os.environ.get("AI_EMBEDDING_RETRY_ATTEMPTS", "3")),
            embedding_retry_delay_s=float(os.environ.get("AI_EMBEDDING_RETRY_DELAY_S", "1.0")),
        )


default_config = AIConfig.from_env()
