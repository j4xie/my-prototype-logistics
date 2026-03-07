-- P4 Tool Coverage: Insert missing ai_intent_configs for tool categories scoring 0%
-- These tools exist in Java but have no DB intent entries for routing
-- Schema: id(varchar36 UUID), intent_code, intent_name, intent_category, is_active(bool), keywords(jsonb), priority(int), etc.

-- =============================================
-- TC_dictionary: DICTIONARY_ADD, DICTIONARY_BATCH_IMPORT, DICTIONARY_LIST
-- =============================================
INSERT INTO ai_intent_configs (id, factory_id, intent_code, intent_name, description, intent_category, keywords, is_active, priority, created_at, updated_at)
VALUES
(gen_random_uuid()::text, 'F001', 'DICTIONARY_LIST', '查看字典', '查看系统字典列表，包括部门名称、区域名称等可识别的同义词映射',
 'SYSTEM', '["字典","词条","查看字典","字典列表","支持哪些","哪些部门","哪些区域","能识别哪些","同义词列表"]'::jsonb,
 true, 50, NOW(), NOW()),
(gen_random_uuid()::text, 'F001', 'DICTIONARY_ADD', '添加字典词条', '向系统字典添加新的同义词映射，如部门别名、区域别名等',
 'SYSTEM', '["加到字典","添加到字典","也叫","也叫做","也可以叫","识别为","同义词","别名","添加别名"]'::jsonb,
 true, 50, NOW(), NOW()),
(gen_random_uuid()::text, 'F001', 'DICTIONARY_BATCH_IMPORT', '批量导入字典', '批量导入字典词条，支持部门、区域等分类的批量同义词导入',
 'SYSTEM', '["批量导入字典","批量导入部门","批量导入区域","导入到字典","批量添加同义词"]'::jsonb,
 true, 50, NOW(), NOW())
ON CONFLICT (intent_code, factory_id) DO NOTHING;

-- =============================================
-- TC_sop: SOP_PARSE_DOCUMENT, SOP_ANALYZE_COMPLEXITY, SKU_UPDATE_COMPLEXITY
-- =============================================
INSERT INTO ai_intent_configs (id, factory_id, intent_code, intent_name, description, intent_category, keywords, is_active, priority, created_at, updated_at)
VALUES
(gen_random_uuid()::text, 'F001', 'SOP_PARSE_DOCUMENT', '解析SOP文档', '解析SOP标准操作程序文档，提取工序步骤、参数要求等信息',
 'PRODUCTION', '["解析SOP","分析SOP文件","SOP文档解析","解析工序文件","SOP文件","SOP解析","上传SOP"]'::jsonb,
 true, 50, NOW(), NOW()),
(gen_random_uuid()::text, 'F001', 'SOP_ANALYZE_COMPLEXITY', '分析SOP复杂度', '评估SOP的复杂度等级，包含工序步骤数、参数数量、质检要求等维度',
 'PRODUCTION', '["SOP复杂度","分析SOP","评估SOP","工序复杂度","SOP复杂等级","SOP难度"]'::jsonb,
 true, 50, NOW(), NOW()),
(gen_random_uuid()::text, 'F001', 'SKU_UPDATE_COMPLEXITY', '更新SKU复杂度', '根据SOP分析结果更新SKU的工序复杂度评分',
 'PRODUCTION', '["SKU复杂度","更新SKU复杂度","设置SKU复杂度","SKU工序复杂","产品复杂度"]'::jsonb,
 true, 50, NOW(), NOW())
ON CONFLICT (intent_code, factory_id) DO NOTHING;

-- =============================================
-- TC_dahua: DAHUA intents missing entirely (MySQL migration failed on PG)
-- Insert all 3 DAHUA intents with both brand and generic keywords
-- =============================================
INSERT INTO ai_intent_configs (id, factory_id, intent_code, intent_name, description, intent_category, keywords, is_active, priority, sensitivity_level, quota_cost, required_roles, created_at, updated_at)
VALUES
(gen_random_uuid()::text, 'F001', 'DAHUA_DEVICE_DISCOVERY', '设备发现', '自动发现局域网内的摄像头设备，支持Dahua协议自动搜索',
 'CAMERA',
 '["大华发现","发现大华","扫描大华","搜索大华摄像头","大华设备搜索","扫描摄像头","发现摄像头","局域网摄像头","摄像头设备扫描","扫描网络设备","网络摄像头","搜索摄像头","设备扫描","发现设备"]'::jsonb,
 true, 88, 'LOW', 1, '["factory_super_admin","department_admin"]'::jsonb, NOW(), NOW()),
(gen_random_uuid()::text, 'F001', 'DAHUA_DEVICE_MANAGE', '设备管理', '管理摄像头/NVR设备，支持添加、删除、修改、抓拍、获取视频流等操作',
 'CAMERA',
 '["大华设备列表","添加大华设备","大华摄像头","大华视频流","大华设备管理","摄像头连接测试","视频流地址","码流地址","摄像头通道","监控设备添加","删除摄像头","摄像头管理","摄像头列表","查看摄像头"]'::jsonb,
 true, 87, 'MEDIUM', 2, '["factory_super_admin","department_admin"]'::jsonb, NOW(), NOW()),
(gen_random_uuid()::text, 'F001', 'DAHUA_SMART_CONFIG', '智能分析配置', '配置摄像头智能分析功能，支持越界检测、入侵检测、人脸检测等',
 'CAMERA',
 '["大华越界检测","大华入侵检测","大华智能分析","配置大华摄像头","越界检测配置","人脸检测配置","区域入侵检测","入侵检测启用","人脸检测启用","智能检测配置","智能分析","行为分析"]'::jsonb,
 true, 86, 'MEDIUM', 2, '["factory_super_admin","department_admin"]'::jsonb, NOW(), NOW())
ON CONFLICT (intent_code, factory_id) DO NOTHING;

-- =============================================
-- TC_system: Add "调度" synonyms to SCHEDULING_SET_* and feature toggle keywords
-- These intents exist with factory_id IS NULL
-- =============================================
UPDATE ai_intent_configs
SET keywords = keywords || '["调度自动","自动调度","切换自动调度","调度模式自动","调度改成自动"]'::jsonb,
    updated_at = NOW()
WHERE intent_code = 'SCHEDULING_SET_AUTO' AND factory_id IS NULL;

UPDATE ai_intent_configs
SET keywords = keywords || '["调度手动","手动调度","切换手动调度","调度模式手动","调度改成手动"]'::jsonb,
    updated_at = NOW()
WHERE intent_code = 'SCHEDULING_SET_MANUAL' AND factory_id IS NULL;

UPDATE ai_intent_configs
SET keywords = keywords || '["停用调度","关闭调度","调度停掉","禁用调度","调度暂停"]'::jsonb,
    updated_at = NOW()
WHERE intent_code = 'SCHEDULING_SET_DISABLED' AND factory_id IS NULL;

UPDATE ai_intent_configs
SET keywords = keywords || '["追溯功能","质检模块","预警系统","功能开启","功能关闭","启用模块","禁用模块","开启追溯","关闭预警"]'::jsonb,
    updated_at = NOW()
WHERE intent_code = 'FACTORY_FEATURE_TOGGLE' AND factory_id IS NULL;

-- =============================================
-- TC_config: Add stronger keywords for conversion rate and rule config
-- These intents exist with factory_id IS NULL
-- =============================================
UPDATE ai_intent_configs
SET keywords = keywords || '["更新转化率","设置转换率","修改转化率","原料转换比例","产出转化率"]'::jsonb,
    updated_at = NOW()
WHERE intent_code = 'CONVERSION_RATE_UPDATE' AND factory_id IS NULL;

UPDATE ai_intent_configs
SET keywords = keywords || '["创建质检规则","添加业务规则","新增规则","配置检测规则","规则名称"]'::jsonb,
    updated_at = NOW()
WHERE intent_code = 'RULE_CONFIG' AND factory_id IS NULL;
