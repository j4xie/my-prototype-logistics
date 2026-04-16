-- Harden drools_rules.enabled so NULL can never reach the Java layer again.
--
-- 2026-04-16 11:35 UTC prod NPE:
--   SchedulingAIServiceImpl.onProductionPlanCreated → getAutoSchedulingMode
--   → `if (factoryRule.get().getEnabled())` unboxed a NULL Boolean.
-- Root cause: 4 F001 scheduling rules were inserted without an explicit
-- `enabled` value. Entity has `@Builder.Default = true` but DB had no
-- default, so direct INSERTs (tests / ad-hoc / seed scripts) landed NULL.
--
-- Idempotent: UPDATE is a no-op if prod was already backfilled manually
-- during the incident response (which it was).

UPDATE drools_rules SET enabled = TRUE WHERE enabled IS NULL;

ALTER TABLE drools_rules ALTER COLUMN enabled SET DEFAULT TRUE;
ALTER TABLE drools_rules ALTER COLUMN enabled SET NOT NULL;
