"""SmartBI Prometheus metrics for v2/v4 cache + chat-session features.

Audit P0 (docs/plans/2026-04-26-smartbi-optimization-audit.md §E):
- E1: chat_session lookup hit rate
- E2: cache_intent_classifier reject reasons
- E3: LLM 25s soft-timeout frequency
- E4: chat_session turn_count distribution + llm_answer_cache hit_count

Exposed via the existing Instrumentator-mounted /metrics endpoint
(main.py line ~498). Use these counters/histograms in service code:

    from smartbi.services.smartbi_metrics import (
        CHAT_SESSION_LOOKUP, CACHE_REJECT, LLM_SOFT_TIMEOUT,
        CHAT_SESSION_TURN, LLM_CACHE_LOOKUP,
    )

    CHAT_SESSION_LOOKUP.labels(outcome='hit').inc()
    LLM_SOFT_TIMEOUT.labels(silent='true').inc()

Failure-safe — if prometheus_client is missing, all metric calls become no-ops.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

try:
    from prometheus_client import Counter, Histogram

    # ─── E1: chat_session lookup ───
    CHAT_SESSION_LOOKUP = Counter(
        'smartbi_chat_session_lookup_total',
        'v2 conversation memory lookup attempts',
        ['outcome'],  # hit | miss_no_session | miss_expired | miss_factory | error
    )

    CHAT_SESSION_TURN = Histogram(
        'smartbi_chat_session_turn_count',
        'turn_count value when v2 session lookup hits',
        buckets=[1, 2, 3, 5, 10, 20],
    )

    # ─── E2: cache_intent_classifier reject reasons ───
    CACHE_REJECT = Counter(
        'smartbi_cache_reject_total',
        'cache rejected by Phase 6 P1 intent classifier',
        ['reason'],  # domain_mismatch | top_n_unsuitable | classifier_error
    )

    CACHE_HIT_KEPT = Counter(
        'smartbi_cache_hit_kept_total',
        'cache hits that intent classifier allowed',
        ['template_code'],
    )

    # ─── E3: LLM soft-timeout (25s cut-off) ───
    LLM_SOFT_TIMEOUT = Counter(
        'smartbi_llm_soft_timeout_total',
        'LLM 25s soft cut-off triggered',
        ['silent', 'has_parent_ctx'],  # silent: 'true'/'false', has_parent_ctx: 'true'/'false'
    )

    # ─── E4: LLM-answer cache (v4 B2-B) ───
    LLM_CACHE_LOOKUP = Counter(
        'smartbi_llm_answer_cache_lookup_total',
        'LLM-answer cache lookup attempts',
        ['outcome'],  # hit | miss | error
    )

    LLM_CACHE_HIT_AGE = Histogram(
        'smartbi_llm_answer_cache_hit_count_observed',
        'hit_count value at the moment of a cache hit (how many times this entry has been served)',
        buckets=[1, 2, 3, 5, 10, 50, 100],
    )

    LLM_CACHE_WRITE = Counter(
        'smartbi_llm_answer_cache_write_total',
        'LLM answers written to cache',
        ['outcome'],  # ok | skipped_short | error
    )

    # ─── Pruner success/failure ───
    PRUNER_RUNS = Counter(
        'smartbi_pruner_runs_total',
        'background pruner cron executions',
        ['table', 'outcome'],  # table: chat_session/llm_cache/narrative_cache, outcome: ok/error
    )

    PRUNER_DELETED = Counter(
        'smartbi_pruner_deleted_rows_total',
        'expired rows deleted by pruners',
        ['table'],
    )

    _METRICS_ENABLED = True
    logger.info("[smartbi-metrics] prometheus metrics loaded")

except ImportError:
    # Fallback no-op stubs if prometheus_client unavailable.
    class _NoOpMetric:
        def labels(self, *args, **kwargs): return self
        def inc(self, n=1): pass
        def observe(self, v): pass

    CHAT_SESSION_LOOKUP = _NoOpMetric()
    CHAT_SESSION_TURN = _NoOpMetric()
    CACHE_REJECT = _NoOpMetric()
    CACHE_HIT_KEPT = _NoOpMetric()
    LLM_SOFT_TIMEOUT = _NoOpMetric()
    LLM_CACHE_LOOKUP = _NoOpMetric()
    LLM_CACHE_HIT_AGE = _NoOpMetric()
    LLM_CACHE_WRITE = _NoOpMetric()
    PRUNER_RUNS = _NoOpMetric()
    PRUNER_DELETED = _NoOpMetric()
    _METRICS_ENABLED = False
    logger.warning("[smartbi-metrics] prometheus_client missing — using no-op stubs")
