-- Phase 3 RAG template embedding index.
--
-- For each (template_code, sample_query) pair, store the DashScope
-- text-embedding-v3 vector. At router time, embed the user's query and
-- pgvector-cosine-search this table to find the template whose sample
-- queries are semantically nearest.
--
-- Populated at startup (Python lifespan hook) from every registered
-- AnalysisTemplate's sample_queries class attribute. Rebuilt on template
-- changes via the /admin/template-embeddings/rebuild endpoint.

CREATE TABLE IF NOT EXISTS smart_bi_template_embeddings (
    id BIGSERIAL PRIMARY KEY,
    template_code VARCHAR(100) NOT NULL,
    sample_query TEXT NOT NULL,
    query_embedding vector(768) NOT NULL,
    -- Embedding model + version so re-embeds on upgrade are explicit.
    embedding_model VARCHAR(50) DEFAULT 'text-embedding-v3',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique (template_code, sample_query) — idempotent upsert on re-populate.
CREATE UNIQUE INDEX IF NOT EXISTS uq_template_emb_code_query
    ON smart_bi_template_embeddings (template_code, sample_query);

-- Cosine ANN search. HNSW is fine for < 1M rows.
CREATE INDEX IF NOT EXISTS idx_template_emb_hnsw
    ON smart_bi_template_embeddings
    USING hnsw (query_embedding vector_cosine_ops);

-- For admin listing
CREATE INDEX IF NOT EXISTS idx_template_emb_code
    ON smart_bi_template_embeddings (template_code);

-- Rollback:
--   DROP INDEX IF EXISTS idx_template_emb_code;
--   DROP INDEX IF EXISTS idx_template_emb_hnsw;
--   DROP INDEX IF EXISTS uq_template_emb_code_query;
--   DROP TABLE IF EXISTS smart_bi_template_embeddings;
