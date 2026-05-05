-- V20260505_02__drop_ai_intent_embedding_ivfflat.sql
-- Drop the ivfflat index on ai_intent_configs.embedding.
--
-- Background: V20260505_01 created ivfflat (lists=20) for the new column,
-- following the V20260501_15 pattern from larger pgvector tables. With only
-- ~325 active rows, ivfflat's APPROXIMATE kNN scan (default probes=1 → only
-- ~5% of vectors examined) caused real top-1 matches to be ranked outside
-- the top-10 returned by ORDER BY embedding <=> $1 LIMIT 10.
--
-- Empirical evidence (2026-05-05, after backfill with BGE-base-zh-v1.5):
-- - With ivfflat: "成本趋势" query top-1 = RESTAURANT_INGREDIENT_COST_TREND (0.55)
-- - Without index (sequential scan): top-1 = COST_TREND_ANALYSIS (0.58) ✓ correct
-- - 325 rows × 768 dims = ~3MB scan, completes in <10ms (acceptable)
--
-- If this table grows past ~5000 rows, reconsider HNSW index (better recall
-- than ivfflat for small-to-medium tables) — not ivfflat which needs more
-- data per list to be useful.

DROP INDEX IF EXISTS idx_ai_intent_configs_embedding;
