-- v4 H3 (Apr 26 2026): enable RLS on chat_session + llm_answer_cache.
--
-- Pattern matches narrative_cache (2026_05_27_agent_layer.sql) and
-- tenant_rls_smoke: ENABLE + FORCE RLS, single FOR ALL policy on
-- factory_id matching app.factory_id session setting (set per-connection
-- by asyncpg pool setup callback).
--
-- BONUS (vs narrative_cache): also add a DELETE-only "prune_expired" policy
-- so the cron pruner can DELETE expired rows without needing per-tenant
-- context. Without this, pruner's DELETE WHERE expires_at < NOW() returns
-- 0 rows because app.factory_id is set to '__internal__' sentinel which
-- doesn't match any real factory.

-- ─── smart_bi_chat_session ───
ALTER TABLE smart_bi_chat_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_chat_session FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON smart_bi_chat_session;
CREATE POLICY tenant_isolation ON smart_bi_chat_session
    FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

DROP POLICY IF EXISTS allow_prune_expired ON smart_bi_chat_session;
CREATE POLICY allow_prune_expired ON smart_bi_chat_session
    FOR DELETE
    USING (expires_at < NOW());

-- ─── smart_bi_llm_answer_cache ───
ALTER TABLE smart_bi_llm_answer_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_bi_llm_answer_cache FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON smart_bi_llm_answer_cache;
CREATE POLICY tenant_isolation ON smart_bi_llm_answer_cache
    FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));

DROP POLICY IF EXISTS allow_prune_expired ON smart_bi_llm_answer_cache;
CREATE POLICY allow_prune_expired ON smart_bi_llm_answer_cache
    FOR DELETE
    USING (expires_at < NOW());

GRANT SELECT, INSERT, UPDATE, DELETE ON smart_bi_chat_session TO smartbi_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON smart_bi_llm_answer_cache TO smartbi_user;

COMMENT ON POLICY tenant_isolation ON smart_bi_chat_session IS
    'v4 H3: cross-tenant isolation. asyncpg pool setup callback sets app.factory_id from contextvar.';
COMMENT ON POLICY allow_prune_expired ON smart_bi_chat_session IS
    'v4 H3: lets cron pruner DELETE expired rows without per-tenant context.';
COMMENT ON POLICY tenant_isolation ON smart_bi_llm_answer_cache IS
    'v4 H3: cross-tenant isolation. asyncpg pool setup callback sets app.factory_id from contextvar.';
COMMENT ON POLICY allow_prune_expired ON smart_bi_llm_answer_cache IS
    'v4 H3: lets cron pruner DELETE expired rows without per-tenant context.';
