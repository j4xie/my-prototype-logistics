-- LLM call metrics — per-request usage tracking
-- Source: Python common/llm_metrics.py event_hook on shared httpx client
-- Purpose: observe 百炼 free-quota burn rate per model + caller
CREATE TABLE IF NOT EXISTS smart_bi_llm_usage (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMP NOT NULL DEFAULT NOW(),
    provider VARCHAR(32) NOT NULL,              -- dashscope / deepseek / minimax / glm
    model VARCHAR(128) NOT NULL,                -- qwen3-max-2026-01-23 / glm-5 / ...
    caller VARCHAR(64),                         -- semantic_mapper / insights / chart / chat / reasoning / review
    input_tokens INT NOT NULL DEFAULT 0,
    output_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    latency_ms INT,
    status_code INT,
    factory_id VARCHAR(64),
    error_snippet TEXT                          -- first 200 chars of error if status != 200
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_ts ON smart_bi_llm_usage (ts DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_model_ts ON smart_bi_llm_usage (model, ts DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_caller_ts ON smart_bi_llm_usage (caller, ts DESC);
