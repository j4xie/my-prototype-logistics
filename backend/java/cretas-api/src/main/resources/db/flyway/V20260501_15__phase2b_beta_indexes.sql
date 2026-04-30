-- V20260501_15__phase2b_beta_indexes.sql
-- β Phase 2B-β: pgvector ivfflat indexes for RAG retrieval performance.
-- Speeds up RAGRetriever.retrieve top-K cosine similarity queries.
--
-- Tables already exist (created by Java pipeline). This migration only adds
-- indexes if missing — IF NOT EXISTS clauses keep it idempotent.

CREATE INDEX IF NOT EXISTS idx_intent_match_records_query_embedding
ON intent_match_records
USING ivfflat (query_embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_learned_expressions_expression_embedding
ON learned_expressions
USING ivfflat (expression_embedding vector_cosine_ops)
WITH (lists = 50);
