-- V20260421_03__disable_global_fermentation_trigger_chain.sql
-- Bug #296 fix: the global trigger chain `fermentation_complete_quality_check`
-- (factory_id=NULL, from V20260410_18) matches BatchCompletedEvent for ALL
-- factories. SupplyChainOrchestrator.onBatchCompleted line 205-208 early-returns
-- whenever `hasConfiguredChain(factoryId, "BatchCompletedEvent")` is true,
-- which causes the hardcoded handler (auto-FG creation, plan progress update,
-- auto-quality task) to be SKIPPED for every factory — not just brewery ones.
--
-- Fix: Disable the chain globally. Brewery-specific factories can re-enable it
-- per-factory with a factory_id scoped to them (not NULL). For the proper
-- long-term fix, `SupplyChainOrchestrator.onBatchCompleted` should run the
-- hardcoded handler additively alongside any configured chain (not replace).
--
-- Same anti-pattern as Bug #295 (V20260421_01/02): brewery template seeds
-- with factory_id=NULL leak into non-brewery factories.

UPDATE factory_trigger_chains
SET enabled = false
WHERE factory_id IS NULL
  AND chain_code = 'fermentation_complete_quality_check'
  AND enabled = true;
