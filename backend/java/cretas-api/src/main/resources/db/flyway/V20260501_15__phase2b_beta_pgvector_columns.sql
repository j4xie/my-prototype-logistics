-- V20260501_15__phase2b_beta_pgvector_columns.sql
-- β Phase 2B-β: ADDITIVE migration adding pgvector columns for Python β C5 RAG.
--
-- Strategy: Java side keeps BLOB embedding columns. We add NEW pgvector columns
-- alongside, populated by Python β code. Java is undisturbed; Python writes to
-- new vector columns when generating embeddings. Backfill from BLOB → vector is
-- out of scope (legacy data has only BLOB until separate backfill task).
--
-- Tables affected:
-- - intent_match_records: ADD query_embedding_vec vector(768)
-- - ai_learned_expressions: ADD embedding_vec vector(768)
--
-- Indexes: ivfflat on each new column for cosine similarity (β C5 RAG retrieval).
--
-- Post-W0 fix-pass: F1 audit replaced V20260501_15__phase2b_beta_indexes.sql
-- (which referenced non-existent columns query_embedding on intent_match_records
-- and the wrong table name learned_expressions) with this additive migration.

-- Ensure pgvector extension exists (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add pgvector column to intent_match_records
ALTER TABLE intent_match_records
ADD COLUMN IF NOT EXISTS query_embedding_vec vector(768);

CREATE INDEX IF NOT EXISTS idx_intent_match_records_query_embedding_vec
ON intent_match_records
USING ivfflat (query_embedding_vec vector_cosine_ops)
WITH (lists = 100)
WHERE query_embedding_vec IS NOT NULL;

-- Add pgvector column to ai_learned_expressions
ALTER TABLE ai_learned_expressions
ADD COLUMN IF NOT EXISTS embedding_vec vector(768);

CREATE INDEX IF NOT EXISTS idx_ai_learned_expressions_embedding_vec
ON ai_learned_expressions
USING ivfflat (embedding_vec vector_cosine_ops)
WITH (lists = 50)
WHERE embedding_vec IS NOT NULL;
