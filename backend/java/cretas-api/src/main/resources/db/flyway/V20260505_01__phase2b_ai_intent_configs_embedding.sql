-- V20260505_01__phase2b_ai_intent_configs_embedding.sql
-- Phase 2B Stage 4 follow-up: add pgvector embedding column to ai_intent_configs.
--
-- Background: Stage 5 SEMANTIC matcher (backend/python/ai/matcher/semantic.py)
-- expects ai_intent_configs.embedding (vector(768)). Column was never added by
-- prior migration, so Stage 5 fails gracefully and matcher falls through to
-- Stage 6/8 (LLM). After this migration + backfill, Stage 5 returns kNN
-- candidates and avoids the slower LLM path for semantically-similar queries.
--
-- Vector dim = 768 (gte-base-zh model via cretas-embedding gRPC service).
-- Index: ivfflat with lists=20 (rows ~500, sqrt(N) ≈ 22, rounded down for
-- a small fixed dataset that grows slowly).
-- Backfill: handled separately by scripts/phase2b/backfill-intent-embeddings.py
-- (calls embedding-service for each row, populates the new column).

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE ai_intent_configs
ADD COLUMN IF NOT EXISTS embedding vector(768);

CREATE INDEX IF NOT EXISTS idx_ai_intent_configs_embedding
ON ai_intent_configs
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 20)
WHERE embedding IS NOT NULL;
