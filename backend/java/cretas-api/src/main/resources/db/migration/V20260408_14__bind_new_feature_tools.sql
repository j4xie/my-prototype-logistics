-- V14: 把 V13 插入的 C4 周转耗材 intent 绑定到新建的 Tool
-- B8 production_progress_dashboard 已在 V13 绑定

UPDATE ai_intent_configs SET tool_name='reusable_container_query', updated_at=NOW()
  WHERE intent_code='REUSABLE_CONTAINER_QUERY';

UPDATE ai_intent_configs SET tool_name='reusable_container_ship_out', updated_at=NOW()
  WHERE intent_code='REUSABLE_CONTAINER_SHIP_OUT';

UPDATE ai_intent_configs SET tool_name='reusable_container_return_in', updated_at=NOW()
  WHERE intent_code='REUSABLE_CONTAINER_RETURN';

UPDATE ai_intent_configs SET tool_name='reusable_container_loss', updated_at=NOW()
  WHERE intent_code='REUSABLE_CONTAINER_LOSS';
