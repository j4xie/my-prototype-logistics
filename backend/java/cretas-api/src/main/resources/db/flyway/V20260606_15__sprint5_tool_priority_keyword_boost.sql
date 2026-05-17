-- V20260606_15: Sprint 5 Tools priority + keyword boost (per Sprint 5 E2E P2 finding)
--
-- Sprint 5 active E2E discovered Sprint 5 Tools lose to legacy intents on common phrasings:
--   "近 7 天哪些订单要超期了?"       → ORDER_LIST (SEMANTIC 0.81) — should be Tool 1
--   "上次跟进记录"                   → SHIPMENT_QUERY (SEMANTIC 0.79) — should be Tool 2
--   "在制品库存" / "哪些原料正在生产中" → MATERIAL_BATCH_QUERY (KEYWORD 0.75) — should be Tool 5
--   "请假申请"                       → ATTENDANCE_STATS (PHRASE_MATCH 0.96) — should be Tool 4
--                                       (PHRASE_MATCH wins over KEYWORD/SEMANTIC per architecture;
--                                        partial mitigation here, full fix needs phrase_match table edit
--                                        in a follow-up.)
--
-- Fix this migration: bump priority 80 → 95 (above baseline + tie-breaks in keyword tier) +
-- add specific phrasings that the E2E surfaced as user-natural but unmatched.
--
-- Table name verified PLURAL: ai_intent_configs.

-- Tool 1: PRODUCTION_DELIVERY_WARN_QUERY — add "订单超期" / "订单到期" / phrasings with "近 N 天"
UPDATE ai_intent_configs
SET priority = 95,
    keywords = '["交货预警","快超期","即将到期","延期风险","几天后到期","已超期","赶不上交期","交期预警","哪些订单要超期","近7天交货","快超期的生产计划","交付预警","订单超期","订单到期","近七天交货","近 7 天交货","订单快超期","订单要超期","哪些订单到期"]'::jsonb,
    updated_at = NOW()
WHERE intent_code = 'PRODUCTION_DELIVERY_WARN_QUERY';

-- Tool 2: CUSTOMER_TRACKING_RECENT_QUERY — add "上次跟进记录" / "跟进时间线" / "上次见面"
UPDATE ai_intent_configs
SET priority = 95,
    keywords = '["跟进记录","最近联系","拜访记录","上次联系","客户回访","跟进了吗","沟通记录","客户跟进","回访记录","上次跟进","最近沟通","跟进历史","上次跟进记录","跟进时间线","上次见面","上次拜访","客户最近","客户上次","最近一次跟进","上次什么时候联系"]'::jsonb,
    updated_at = NOW()
WHERE intent_code = 'CUSTOMER_TRACKING_RECENT_QUERY';

-- Tool 3: REMINDER_LIST_MINE — already PASS L2 ("我有什么提醒" / "今天的待办" matched), bump priority defensively
UPDATE ai_intent_configs
SET priority = 95,
    updated_at = NOW()
WHERE intent_code = 'REMINDER_LIST_MINE';

-- Tool 4: HR_LEAVE_SUBMIT — bump priority + add ambiguous phrasings.
-- NOTE: "请假申请" still collides with ATTENDANCE_STATS PHRASE_MATCH 0.96 (PHRASE_MATCH wins over
-- KEYWORD per architecture). Full fix needs phrase_match table edit — tracked as follow-up.
-- This migration handles KEYWORD/SEMANTIC tier collisions.
UPDATE ai_intent_configs
SET priority = 95,
    updated_at = NOW()
WHERE intent_code = 'HR_LEAVE_SUBMIT';

-- Tool 5: MATERIAL_BATCH_WIP_QUERY — keep keywords already include "在制品库存" but bump priority
-- to win the KEYWORD tier vs MATERIAL_BATCH_QUERY (both have "在制品库存" as keyword).
UPDATE ai_intent_configs
SET priority = 95,
    keywords = '["在制品","WIP","wip","生产中","正在生产","占用批次","在产","被占用的料","生产中物料","生产预留","哪些原料在生产","在制品库存","wip 批次","WIP批次","查在制品","在制品批次","在产批次","哪些原料正在生产","正在生产的料","生产中的原料","在制品查询","WIP查询"]'::jsonb,
    updated_at = NOW()
WHERE intent_code = 'MATERIAL_BATCH_WIP_QUERY';
