-- ============================================
-- v32: 添加 business_type 列到 ai_intent_configs
-- 用于业态隔离（工厂 vs 餐饮意图路由）
-- ============================================
-- 使用方式:
--   测试: psql -h 127.0.0.1 -U cretas_user -d cretas_db -f add_business_type_column.sql
--   生产: psql -h 127.0.0.1 -U cretas_user -d cretas_prod_db -f add_business_type_column.sql

BEGIN;

-- 1. 新增列（默认 COMMON）
ALTER TABLE ai_intent_configs ADD COLUMN IF NOT EXISTS business_type VARCHAR(30) DEFAULT 'COMMON';

-- 2. 标记餐饮专属意图
UPDATE ai_intent_configs SET business_type = 'RESTAURANT'
WHERE intent_code LIKE 'RESTAURANT_%';

-- 3. 标记工厂专属意图（排除通用意图）
UPDATE ai_intent_configs SET business_type = 'FACTORY'
WHERE intent_code NOT LIKE 'RESTAURANT_%'
  AND intent_code NOT LIKE 'SYSTEM_%'
  AND intent_code NOT IN ('FOOD_KNOWLEDGE_QUERY', 'GREETING', 'OUT_OF_DOMAIN', 'CONTEXT_CONTINUE');

-- 4. 通用意图保持 COMMON
UPDATE ai_intent_configs SET business_type = 'COMMON'
WHERE intent_code LIKE 'SYSTEM_%'
   OR intent_code IN ('FOOD_KNOWLEDGE_QUERY', 'GREETING', 'OUT_OF_DOMAIN', 'CONTEXT_CONTINUE');

-- 5. 验证
SELECT business_type, COUNT(*) as cnt
FROM ai_intent_configs
GROUP BY business_type
ORDER BY business_type;

COMMIT;
