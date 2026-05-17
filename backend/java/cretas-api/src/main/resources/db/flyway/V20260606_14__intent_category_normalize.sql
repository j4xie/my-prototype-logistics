-- V20260606_14: Normalize intent_category for Sprint 5 Tools 2/3/5
--
-- Per superpowers code review (audit Important #2): 3 Sprint 5 Tool intents shipped
-- with non-canonical intent_category values that fragment future routing/filter logic.
-- Canonical set: DATA_QUERY (read) / DATA_OPERATION (write) / ANALYSIS / FORM / SCHEDULE / SYSTEM.
--
-- Tool 2 (CUSTOMER_TRACKING_RECENT_QUERY): 'CRM' → 'DATA_QUERY' (domain → canonical category)
-- Tool 3 (REMINDER_LIST_MINE):              'DATA_OPERATION' → 'DATA_QUERY' (read-only Tool)
-- Tool 5 (MATERIAL_BATCH_WIP_QUERY):        'DATA_OPERATION' → 'DATA_QUERY' (read-only Tool)
--
-- Tool 1 (PRODUCTION_DELIVERY_WARN_QUERY)  already 'DATA_QUERY' ✓ (no change)
-- Tool 4 (HR_LEAVE_SUBMIT)                 correctly 'DATA_OPERATION' (WRITE Tool) ✓ (no change)
--
-- Table name verified PLURAL: ai_intent_configs (per #765/#796 hotfixes lesson).

UPDATE ai_intent_configs
SET intent_category = 'DATA_QUERY',
    updated_at = NOW()
WHERE intent_code IN (
    'CUSTOMER_TRACKING_RECENT_QUERY',
    'REMINDER_LIST_MINE',
    'MATERIAL_BATCH_WIP_QUERY'
)
  AND intent_category != 'DATA_QUERY';
