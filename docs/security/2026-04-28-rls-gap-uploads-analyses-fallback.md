# 🚨 P0 Security Finding — RLS Gap on 3 Factory-Scoped Tables

**Date**: 2026-04-28
**Severity**: P0 (Critical) — cross-tenant data exposure + write
**Discovered by**: qa-prompt v2.4 Phase 9 cross-tenant RLS verify
**Affects**: Both prod (`smartbi_prod_db`) and test (`smartbi_db`) databases

---

## Vulnerability

3 factory-scoped tables have **no Row-Level Security enabled** in PostgreSQL:

| Table | RLS Enabled | Force RLS | Sensitivity |
|---|---|---|---|
| `smart_bi_pg_excel_uploads` | ❌ | ❌ | Customer Excel uploads (raw business data) |
| `smart_bi_pg_analysis_results` | ❌ | ❌ | Materialized analytics + AI insights |
| `smart_bi_llm_fallback_log` | ❌ | ❌ | LLM query history + AI answers + user feedback |

For comparison, 3 cache tables DO have RLS:

| Table | RLS Enabled | Force RLS |
|---|---|---|
| `narrative_cache` | ✅ | ✅ |
| `smart_bi_chat_session` | ✅ | ✅ |
| `smart_bi_llm_answer_cache` | ✅ | ✅ |

## Reproducer

```sql
-- As smartbi_user with credentials shared across all factory tenants
SET app.factory_id='F001';
SELECT COUNT(*) FROM smart_bi_pg_excel_uploads WHERE factory_id='F001';
-- 3 rows visible (correct)

SET app.factory_id='F002';   -- impersonate F002
SELECT COUNT(*) FROM smart_bi_pg_excel_uploads WHERE factory_id='F001';
-- 3 rows STILL visible — should be 0 (RLS should filter)

DELETE FROM smart_bi_pg_excel_uploads WHERE factory_id='F001';
-- DELETE 3 succeeded — F002 wiped F001 uploads (data loss)
```

Verified Apr 28 2026 22:20 on test env. Prod has identical schema state.

## Impact

Any factory tenant's `smartbi_user` credential, if leaked or misused:

1. **READ**: All other factories' Excel uploads, analysis results, LLM query/answer history
2. **WRITE/DELETE**: Wipe other factories' uploads (data loss) or insert/modify their analysis results
3. **Bypass**: F11/F12 fixes (set GUC for `tenant_isolation` policy) are no-ops on these 3 tables — there is no policy to apply

## Why F11/F12 Audits Missed This

F11/F12 (Apr 27 2026) addressed cases where RLS was already enabled but query sites forgot to set `app.factory_id` GUC → silent zero-row return. The reviewer audited **the files we changed**, not the **table-level RLS state** for tables that were never RLS-enabled.

Rule 17 backend antipattern checklist did not include "factory-scoped table missing RLS policy" — this is a gap in the static-scan rules. Rule 17 should be extended.

## Why Existing Code "Works"

All Java/Python query sites pass `factory_id` as an explicit `WHERE factory_id = $X` parameter. This relies on application-layer trust — never on RLS as a defense-in-depth layer. A bug, refactor, or compromised dependency that drops the WHERE clause would silently expose all tenants.

## Mitigation Options

**A. Enable RLS now (recommended)**: migration + ~20 query site audit + prod deploy. ~1 hour scoped, immediate closure.

**B. Document and defer**: this file. Acceptable only if business risk is bounded by a hard network boundary (`smartbi_user` only reachable from app servers). Not a true mitigation.

**C. DB-level write trigger**: REFUSE INSERT/UPDATE/DELETE WHERE factory_id != current_setting('app.factory_id'). Cheaper than RLS for write protection but doesn't cover SELECT.

**Decision (Apr 28 2026)**: User authorized **B then A** — this document is B. A migration follows.

## Migration Plan (Plan A)

1. `V20260428_07__enable_rls_uploads_analyses_fallback.sql`:
   - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY`
   - `CREATE POLICY tenant_isolation USING (factory_id = current_setting('app.factory_id', true))`
   - For `smart_bi_llm_fallback_log` add `WITH CHECK` for INSERT/UPDATE
2. Audit query sites that set GUC vs ones that don't:
   - `grep -rn 'smart_bi_pg_excel_uploads\|smart_bi_pg_analysis_results\|smart_bi_llm_fallback_log' backend/python` and Java equivalent
   - For each: ensure `SELECT set_config('app.factory_id', $1, true)` before query, or `factory_id` explicit WHERE filter (defense-in-depth, but RLS now also enforces)
3. Test env apply + verify cross-tenant SELECT/DELETE returns 0
4. Prod apply during low-traffic window

## Related

- F11 commit `3fb03e2d7` (RLS GUC for cache_session + llm_answer_cache)
- F12 same commit (budget_tracker + narrative_cache)
- qa-prompt v2.4 Rule 9 `数据类页面 byte-match 不够` — this finding extends Rule 9 from "data-shape-correctness" to "tenant-isolation-correctness"
