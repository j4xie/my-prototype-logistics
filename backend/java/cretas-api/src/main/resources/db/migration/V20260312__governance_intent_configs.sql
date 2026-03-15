-- AI Governance 元工具意图配置
-- 让用户可以通过 AI 对话管理 Tool/Skill/Workflow

-- 1. 工具使用模式分析
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category,
  tool_name, keywords, is_active, sensitivity_level, description, example_queries,
  created_at, updated_at)
VALUES (gen_random_uuid(), 'GOVERNANCE_PATTERN_DISCOVERY', '工具使用模式分析', 'SYSTEM',
  'governance_pattern_discovery',
  '["工具模式","共现分析","哪些工具一起用","工具组合推荐","skill推荐","使用模式","工具使用","经常一起","共现","共同使用"]',
  true, 'LOW',
  '分析工具使用模式，发现频繁共用的工具组合，推荐可组合为Skill的模式',
  '["哪些工具经常一起使用","查看工具使用模式","推荐skill组合","最近30天工具共现分析","有什么推荐的skill"]',
  NOW(), NOW())
ON CONFLICT (intent_code) DO NOTHING;

-- 2. Skill 创建/组合
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category,
  tool_name, keywords, is_active, sensitivity_level, description, example_queries,
  created_at, updated_at)
VALUES (gen_random_uuid(), 'GOVERNANCE_SKILL_COMPOSE', '创建Skill组合', 'SYSTEM',
  'governance_skill_compose',
  '["创建skill","组合工具","新建技能","组合成skill","创建技能","把工具组合","skill组合","新skill"]',
  true, 'MEDIUM',
  '将多个Tool组合成一个Skill，通过对话创建新的技能组合',
  '["创建一个skill叫库存质检联查","把material_batch_query和quality_check_query组合成skill","创建推荐的skill"]',
  NOW(), NOW())
ON CONFLICT (intent_code) DO NOTHING;

-- 3. Skill/Tool 管理
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category,
  tool_name, keywords, is_active, sensitivity_level, description, example_queries,
  created_at, updated_at)
VALUES (gen_random_uuid(), 'GOVERNANCE_SKILL_MANAGE', 'Skill和Tool管理', 'SYSTEM',
  'governance_skill_manage',
  '["列出skill","查看技能","有多少工具","搜索skill","禁用skill","工具列表","skill列表","所有技能","工具数量","查看工具"]',
  true, 'LOW',
  '查看和管理已注册的Skill和Tool，包括列表、搜索、启用/禁用等操作',
  '["列出所有skill","有多少个工具注册了","搜索关于库存的skill","禁用某个skill","查看工具列表"]',
  NOW(), NOW())
ON CONFLICT (intent_code) DO NOTHING;
