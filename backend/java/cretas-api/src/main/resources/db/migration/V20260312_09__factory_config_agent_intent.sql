-- Factory Config Agent — Intent Config binding
INSERT INTO ai_intent_config (id, intent_code, intent_name, intent_category,
  tool_name, keywords, is_active, sensitivity_level)
VALUES
  (gen_random_uuid(), 'FACTORY_CONFIG_AGENT', '工厂配置向导', 'SYSTEM',
   'factory_config_agent',
   '["配置工厂","配置生产流程","工厂向导","生产流程配置","配置工作流","设置生产模式","工厂设置向导"]',
   true, 'MEDIUM')
ON CONFLICT DO NOTHING;
