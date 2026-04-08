-- Session Apr 8 次要修复 (第 4 轮核对发现)
-- N1: intent_code REUSABLE_CONTAINER_RETURN → REUSABLE_CONTAINER_RETURN_IN (命名统一)

UPDATE ai_intent_configs
   SET intent_code = 'REUSABLE_CONTAINER_RETURN_IN'
 WHERE intent_code = 'REUSABLE_CONTAINER_RETURN';
