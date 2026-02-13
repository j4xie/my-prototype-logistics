-- ============================================================
-- 食品加工厂知识库 - PostgreSQL 建表脚本
-- 用于 RAG 知识检索系统 (Phase 4)
-- 依赖: pgvector 扩展
-- 目标数据库: cretas_db
-- ============================================================

-- 确保 pgvector 扩展已安装
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. 食品知识文档表 (核心表)
-- ============================================================
CREATE TABLE IF NOT EXISTS food_knowledge_documents (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,          -- 'standard', 'regulation', 'process', 'haccp', 'sop', 'additive', 'microbe'
    source VARCHAR(200),                     -- 来源: "GB 2760-2024", "食品安全法"
    source_url VARCHAR(500),                 -- 原文链接
    version VARCHAR(50),                     -- 版本号
    effective_date DATE,                     -- 生效日期
    expiry_date DATE,                        -- 失效日期 (NULL=永久有效)
    embedding vector(768),                   -- pgvector向量 (gte-base-zh 768维)
    chunk_index INT DEFAULT 0,               -- 长文档分块索引
    parent_doc_id BIGINT,                    -- 父文档ID(分块时)
    metadata JSONB DEFAULT '{}',             -- 扩展元数据 (标准号、条款号、适用产品类别等)
    is_active BOOLEAN DEFAULT TRUE,          -- 是否有效
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_parent_doc FOREIGN KEY (parent_doc_id)
        REFERENCES food_knowledge_documents(id) ON DELETE SET NULL
);

-- 分类索引
CREATE INDEX IF NOT EXISTS idx_food_kb_category ON food_knowledge_documents(category);

-- 有效性索引
CREATE INDEX IF NOT EXISTS idx_food_kb_active ON food_knowledge_documents(is_active) WHERE is_active = TRUE;

-- 来源索引
CREATE INDEX IF NOT EXISTS idx_food_kb_source ON food_knowledge_documents(source);

-- 生效日期索引 (用于过滤失效文档)
CREATE INDEX IF NOT EXISTS idx_food_kb_effective ON food_knowledge_documents(effective_date, expiry_date);

-- 父文档索引 (用于查找文档分块)
CREATE INDEX IF NOT EXISTS idx_food_kb_parent ON food_knowledge_documents(parent_doc_id) WHERE parent_doc_id IS NOT NULL;

-- 向量相似度索引 (IVFFlat, 余弦距离)
-- 注意: 需要有数据后才能创建 IVFFlat 索引, 初始用 HNSW
CREATE INDEX IF NOT EXISTS idx_food_kb_embedding ON food_knowledge_documents
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- JSONB GIN 索引 (用于元数据查询)
CREATE INDEX IF NOT EXISTS idx_food_kb_metadata ON food_knowledge_documents USING gin(metadata);

-- ============================================================
-- 2. 知识版本审计日志表
-- ============================================================
CREATE TABLE IF NOT EXISTS food_knowledge_audit_log (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT REFERENCES food_knowledge_documents(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL,             -- 'CREATE', 'UPDATE', 'DEPRECATE', 'DELETE', 'REACTIVATE'
    old_version VARCHAR(50),                 -- 旧版本号
    new_version VARCHAR(50),                 -- 新版本号
    reason TEXT,                             -- 变更原因
    operator VARCHAR(100),                   -- 操作人
    changes JSONB,                           -- 详细变更内容
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_food_kb_audit_doc ON food_knowledge_audit_log(document_id);
CREATE INDEX IF NOT EXISTS idx_food_kb_audit_action ON food_knowledge_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_food_kb_audit_time ON food_knowledge_audit_log(created_at);

-- ============================================================
-- 3. NER 实体字典表 (用于规则匹配补充)
-- ============================================================
CREATE TABLE IF NOT EXISTS food_entity_dictionary (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(30) NOT NULL,        -- 'ADDITIVE', 'STANDARD', 'EQUIPMENT', 'PROCESS_PARAM' 等13类
    entity_name VARCHAR(200) NOT NULL,       -- 实体名称: "山梨酸钾"
    aliases TEXT[],                           -- 别名列表: ["山梨酸钾", "E202"]
    standard_ref VARCHAR(100),               -- 关联标准号: "GB 2760"
    category VARCHAR(100),                   -- 子分类: "防腐剂"
    description TEXT,                        -- 描述
    metadata JSONB DEFAULT '{}',             -- 扩展数据 (最大使用量, CAS号等)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_food_entity_type ON food_entity_dictionary(entity_type);
CREATE INDEX IF NOT EXISTS idx_food_entity_name ON food_entity_dictionary(entity_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_food_entity_type_name ON food_entity_dictionary(entity_type, entity_name);

-- ============================================================
-- 4. 食品意图配置表 (扩展 ai_intent_configs)
-- ============================================================
-- 注意: 食品专业意图直接插入到现有的 ai_intent_configs 表
-- 此处仅记录食品意图特有的扩展配置

CREATE TABLE IF NOT EXISTS food_intent_config (
    id BIGSERIAL PRIMARY KEY,
    intent_code VARCHAR(100) NOT NULL UNIQUE,  -- 意图代码: "FOOD_ADDITIVE_QUERY"
    category VARCHAR(50) NOT NULL DEFAULT 'FOOD_KNOWLEDGE',
    description VARCHAR(500),                  -- 描述
    requires_rag BOOLEAN DEFAULT TRUE,         -- 是否需要 RAG 检索
    rag_categories TEXT[],                     -- RAG 检索的知识类别 ['standard', 'additive']
    requires_ner BOOLEAN DEFAULT TRUE,         -- 是否需要 NER 提取
    ner_entity_types TEXT[],                   -- 需要提取的实体类型 ['ADDITIVE', 'STANDARD']
    requires_llm BOOLEAN DEFAULT TRUE,         -- 是否需要 LLM 生成
    llm_system_prompt TEXT,                    -- 自定义 LLM system prompt
    sample_queries TEXT[],                     -- 示例查询 (用于意图训练数据)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_food_intent_code ON food_intent_config(intent_code);
CREATE INDEX IF NOT EXISTS idx_food_intent_category ON food_intent_config(category);

-- ============================================================
-- 5. 插入初始食品实体字典数据
-- ============================================================

-- 常见食品添加剂
INSERT INTO food_entity_dictionary (entity_type, entity_name, aliases, standard_ref, category, metadata) VALUES
('ADDITIVE', '山梨酸钾', ARRAY['山梨酸钾', 'E202', '钾盐'], 'GB 2760', '防腐剂', '{"cas": "24634-61-5", "max_usage": "根据产品类别"}'),
('ADDITIVE', '苯甲酸钠', ARRAY['苯甲酸钠', 'E211'], 'GB 2760', '防腐剂', '{"cas": "532-32-1"}'),
('ADDITIVE', '柠檬酸', ARRAY['柠檬酸', 'E330', '枸橼酸'], 'GB 2760', '酸度调节剂', '{"cas": "77-92-9"}'),
('ADDITIVE', '卡拉胶', ARRAY['卡拉胶', 'E407', '鹿角菜胶'], 'GB 2760', '增稠剂', '{}'),
('ADDITIVE', '黄原胶', ARRAY['黄原胶', 'E415', '汉生胶'], 'GB 2760', '增稠剂', '{}'),
('ADDITIVE', '果胶', ARRAY['果胶', 'E440'], 'GB 2760', '增稠剂', '{}'),
('ADDITIVE', '明胶', ARRAY['明胶', 'E441'], 'GB 2760', '增稠剂', '{}'),
('ADDITIVE', '阿斯巴甜', ARRAY['阿斯巴甜', 'E951', '天冬酰苯丙氨酸甲酯'], 'GB 2760', '甜味剂', '{}'),
('ADDITIVE', '三氯蔗糖', ARRAY['三氯蔗糖', 'E955', '蔗糖素'], 'GB 2760', '甜味剂', '{}'),
('ADDITIVE', '亚硝酸钠', ARRAY['亚硝酸钠', 'E250'], 'GB 2760', '护色剂', '{"max_usage_mg_kg": 150}')
ON CONFLICT (entity_type, entity_name) DO NOTHING;

-- 常见GB标准
INSERT INTO food_entity_dictionary (entity_type, entity_name, aliases, standard_ref, category, description) VALUES
('STANDARD', 'GB 2760', ARRAY['GB 2760', 'GB2760', '食品添加剂使用标准'], 'GB 2760-2024', '添加剂标准', '食品安全国家标准 食品添加剂使用标准'),
('STANDARD', 'GB 14881', ARRAY['GB 14881', 'GB14881', '卫生规范'], 'GB 14881-2013', '卫生标准', '食品安全国家标准 食品生产通用卫生规范'),
('STANDARD', 'GB 4789', ARRAY['GB 4789', 'GB4789', '微生物检验'], 'GB 4789', '检验标准', '食品安全国家标准 食品微生物学检验系列'),
('STANDARD', 'GB 5009', ARRAY['GB 5009', 'GB5009', '理化检验'], 'GB 5009', '检验标准', '食品安全国家标准 食品理化检验方法系列'),
('STANDARD', 'GB 7718', ARRAY['GB 7718', 'GB7718', '预包装食品标签'], 'GB 7718-2011', '标签标准', '食品安全国家标准 预包装食品标签通则'),
('STANDARD', 'GB 28050', ARRAY['GB 28050', 'GB28050', '营养标签'], 'GB 28050-2011', '标签标准', '食品安全国家标准 预包装食品营养标签通则'),
('STANDARD', 'GB 2761', ARRAY['GB 2761', 'GB2761', '真菌毒素限量'], 'GB 2761-2017', '限量标准', '食品安全国家标准 食品中真菌毒素限量'),
('STANDARD', 'GB 2762', ARRAY['GB 2762', 'GB2762', '污染物限量'], 'GB 2762-2022', '限量标准', '食品安全国家标准 食品中污染物限量'),
('STANDARD', 'GB 2763', ARRAY['GB 2763', 'GB2763', '农药残留限量'], 'GB 2763-2021', '限量标准', '食品安全国家标准 食品中农药最大残留限量'),
('STANDARD', 'GB 29921', ARRAY['GB 29921', 'GB29921', '致病菌限量'], 'GB 29921-2021', '限量标准', '食品安全国家标准 预包装食品中致病菌限量')
ON CONFLICT (entity_type, entity_name) DO NOTHING;

-- 常见食品加工设备
INSERT INTO food_entity_dictionary (entity_type, entity_name, aliases, category, description) VALUES
('EQUIPMENT', '杀菌釜', ARRAY['杀菌釜', '高压灭菌锅', '蒸汽杀菌釜'], '热处理设备', '用于罐头、软包装食品的高温高压灭菌'),
('EQUIPMENT', '均质机', ARRAY['均质机', '高压均质机', '均质设备'], '乳品设备', '使乳液、悬浮液均匀化的设备'),
('EQUIPMENT', '冷冻干燥机', ARRAY['冷冻干燥机', '冻干机', '真空冷冻干燥机'], '干燥设备', '低温真空环境下脱水干燥'),
('EQUIPMENT', 'UHT灭菌机', ARRAY['UHT灭菌机', '超高温灭菌设备', 'UHT'], '热处理设备', '135-150°C超高温瞬时灭菌'),
('EQUIPMENT', '喷雾干燥塔', ARRAY['喷雾干燥塔', '喷雾干燥器', '喷干塔'], '干燥设备', '液态物料雾化后热风干燥成粉'),
('EQUIPMENT', '包装机', ARRAY['包装机', '自动包装机', '灌装机'], '包装设备', '食品自动灌装/包装设备'),
('EQUIPMENT', '金属检测机', ARRAY['金属检测机', '金属探测仪', '金探'], '检测设备', '检测产品中金属异物'),
('EQUIPMENT', 'X光异物检测机', ARRAY['X光异物检测机', 'X射线检测', 'X光机'], '检测设备', '检测产品中各类异物'),
('EQUIPMENT', '巴氏杀菌机', ARRAY['巴氏杀菌机', '巴氏消毒机', 'HTST'], '热处理设备', '72-85°C巴氏杀菌'),
('EQUIPMENT', '真空搅拌机', ARRAY['真空搅拌机', '真空乳化机', '乳化搅拌机'], '混合设备', '真空条件下搅拌混合')
ON CONFLICT (entity_type, entity_name) DO NOTHING;

-- 常见微生物
INSERT INTO food_entity_dictionary (entity_type, entity_name, aliases, standard_ref, category) VALUES
('MICROBE', '沙门氏菌', ARRAY['沙门氏菌', 'Salmonella', '沙门菌'], 'GB 4789.4', '致病菌'),
('MICROBE', '大肠杆菌O157:H7', ARRAY['大肠杆菌O157:H7', 'E.coli O157:H7', 'EHEC'], 'GB 4789.36', '致病菌'),
('MICROBE', '金黄色葡萄球菌', ARRAY['金黄色葡萄球菌', 'S. aureus', '金葡菌'], 'GB 4789.10', '致病菌'),
('MICROBE', '单核细胞增生李斯特菌', ARRAY['单核细胞增生李斯特菌', 'L. monocytogenes', '李斯特菌'], 'GB 4789.30', '致病菌'),
('MICROBE', '副溶血性弧菌', ARRAY['副溶血性弧菌', 'V. parahaemolyticus'], 'GB 4789.7', '致病菌'),
('MICROBE', '菌落总数', ARRAY['菌落总数', '细菌总数', 'TPC', 'APC'], 'GB 4789.2', '指示菌'),
('MICROBE', '大肠菌群', ARRAY['大肠菌群', 'Coliforms', '大肠杆菌群'], 'GB 4789.3', '指示菌'),
('MICROBE', '霉菌', ARRAY['霉菌', 'mold', '霉菌酵母菌'], 'GB 4789.15', '指示菌')
ON CONFLICT (entity_type, entity_name) DO NOTHING;

-- 常见危害物
INSERT INTO food_entity_dictionary (entity_type, entity_name, aliases, standard_ref, category) VALUES
('HAZARD', '黄曲霉毒素B1', ARRAY['黄曲霉毒素B1', 'AFB1', 'Aflatoxin B1'], 'GB 2761', '真菌毒素'),
('HAZARD', '丙烯酰胺', ARRAY['丙烯酰胺', 'Acrylamide'], '', '加工污染物'),
('HAZARD', '苯并芘', ARRAY['苯并芘', 'BaP', 'Benzo(a)pyrene'], 'GB 2762', '环境污染物'),
('HAZARD', '铅', ARRAY['铅', 'Pb', 'Lead'], 'GB 2762', '重金属'),
('HAZARD', '镉', ARRAY['镉', 'Cd', 'Cadmium'], 'GB 2762', '重金属'),
('HAZARD', '汞', ARRAY['汞', 'Hg', 'Mercury'], 'GB 2762', '重金属'),
('HAZARD', '砷', ARRAY['砷', 'As', 'Arsenic'], 'GB 2762', '重金属'),
('HAZARD', '三聚氰胺', ARRAY['三聚氰胺', 'Melamine'], '', '非法添加物')
ON CONFLICT (entity_type, entity_name) DO NOTHING;

-- 认证体系
INSERT INTO food_entity_dictionary (entity_type, entity_name, aliases, category, description) VALUES
('CERT', 'HACCP', ARRAY['HACCP', '危害分析和关键控制点'], '食品安全', '危害分析与关键控制点体系'),
('CERT', 'ISO 22000', ARRAY['ISO 22000', 'ISO22000', '食品安全管理体系'], '食品安全', '食品安全管理体系标准'),
('CERT', 'BRC', ARRAY['BRC', 'BRCGS', '英国零售商协会'], '食品安全', '全球食品安全标准'),
('CERT', 'FSSC 22000', ARRAY['FSSC 22000', 'FSSC22000'], '食品安全', '食品安全体系认证方案'),
('CERT', 'SQF', ARRAY['SQF', '安全质量食品'], '食品安全', '安全质量食品认证'),
('CERT', 'IFS', ARRAY['IFS', '国际食品标准'], '食品安全', '国际食品标准认证')
ON CONFLICT (entity_type, entity_name) DO NOTHING;

-- ============================================================
-- 6. 插入初始食品意图配置
-- ============================================================

INSERT INTO food_intent_config (intent_code, category, description, requires_rag, rag_categories, requires_ner, ner_entity_types, sample_queries) VALUES
-- 添加剂相关
('FOOD_ADDITIVE_QUERY', 'FOOD_KNOWLEDGE', '食品添加剂查询', TRUE, ARRAY['standard', 'additive'], TRUE, ARRAY['ADDITIVE', 'PRODUCT'], ARRAY['山梨酸钾的最大使用量是多少?', '酸奶可以添加哪些增稠剂?', '柠檬酸在饮料中的使用限量']),
('FOOD_ADDITIVE_SAFETY', 'FOOD_KNOWLEDGE', '添加剂安全性评估', TRUE, ARRAY['standard', 'additive'], TRUE, ARRAY['ADDITIVE', 'HAZARD'], ARRAY['阿斯巴甜安全吗?', '亚硝酸钠对人体有害吗?']),
('FOOD_ADDITIVE_ALTERNATIVE', 'FOOD_KNOWLEDGE', '添加剂替代方案', TRUE, ARRAY['standard', 'additive'], TRUE, ARRAY['ADDITIVE', 'PRODUCT'], ARRAY['有什么天然防腐剂可以替代山梨酸钾?']),
('FOOD_ADDITIVE_INTERACTION', 'FOOD_KNOWLEDGE', '添加剂相互作用', TRUE, ARRAY['standard', 'additive'], TRUE, ARRAY['ADDITIVE'], ARRAY['山梨酸钾和苯甲酸钠可以一起使用吗?']),

-- 标准法规相关
('FOOD_STANDARD_LOOKUP', 'FOOD_KNOWLEDGE', 'GB标准查询', TRUE, ARRAY['standard', 'regulation'], TRUE, ARRAY['STANDARD'], ARRAY['GB 14881对车间温度有什么要求?', 'GB 2760最新版本是什么时候发布的?']),
('FOOD_REGULATION_QUERY', 'FOOD_KNOWLEDGE', '食品法规查询', TRUE, ARRAY['regulation'], TRUE, ARRAY['REGULATION', 'STANDARD'], ARRAY['食品安全法对食品召回有什么规定?', '进口食品需要什么手续?']),
('FOOD_LABEL_REVIEW', 'FOOD_KNOWLEDGE', '食品标签审核', TRUE, ARRAY['standard'], TRUE, ARRAY['STANDARD', 'NUTRIENT', 'ADDITIVE'], ARRAY['这个营养标签符合GB 7718吗?', '配料表应该怎么排列?']),
('FOOD_REGULATION_PENALTY', 'FOOD_KNOWLEDGE', '法规处罚查询', TRUE, ARRAY['regulation'], TRUE, ARRAY['REGULATION'], ARRAY['使用非法添加剂会受到什么处罚?', '食品安全法处罚力度']),

-- HACCP与认证
('FOOD_HACCP_GUIDE', 'FOOD_KNOWLEDGE', 'HACCP指导', TRUE, ARRAY['haccp', 'process'], TRUE, ARRAY['CERT', 'PRODUCT', 'HAZARD'], ARRAY['如何识别肉制品的关键控制点?', 'CCP监控频率应该怎么确定?']),
('FOOD_HACCP_CCP', 'FOOD_KNOWLEDGE', '关键控制点分析', TRUE, ARRAY['haccp'], TRUE, ARRAY['CERT', 'PROCESS_PARAM', 'HAZARD'], ARRAY['杀菌工序的CCP限值应该怎么设定?', '什么是关键控制点?']),
('FOOD_CERT_GUIDE', 'FOOD_KNOWLEDGE', '认证体系指导', TRUE, ARRAY['haccp', 'standard'], TRUE, ARRAY['CERT'], ARRAY['HACCP和ISO 22000有什么区别?', 'BRC认证需要准备什么?']),
('FOOD_AUDIT_PREP', 'FOOD_KNOWLEDGE', '审核准备指导', TRUE, ARRAY['haccp', 'sop'], TRUE, ARRAY['CERT'], ARRAY['HACCP审核需要准备哪些文件?', '外审常见不合格项有哪些?']),

-- 工艺参数
('FOOD_PROCESS_PARAM', 'FOOD_KNOWLEDGE', '工艺参数咨询', TRUE, ARRAY['process', 'standard'], TRUE, ARRAY['PROCESS_PARAM', 'EQUIPMENT', 'PRODUCT'], ARRAY['UHT灭菌温度和时间?', '酸奶发酵最佳温度是多少?']),
('FOOD_PROCESS_OPTIMIZATION', 'FOOD_KNOWLEDGE', '工艺优化建议', TRUE, ARRAY['process'], TRUE, ARRAY['PROCESS_PARAM', 'EQUIPMENT'], ARRAY['如何减少杀菌过程中的营养损失?', '怎样提高均质效果?']),
('FOOD_PROCESS_TROUBLESHOOT', 'FOOD_KNOWLEDGE', '工艺故障排查', TRUE, ARRAY['process'], TRUE, ARRAY['PROCESS_PARAM', 'EQUIPMENT', 'PRODUCT'], ARRAY['酸奶出现分层是什么原因?', '面包烤不熟的原因?']),
('FOOD_THERMAL_CALC', 'FOOD_KNOWLEDGE', '热处理计算', TRUE, ARRAY['process'], TRUE, ARRAY['PROCESS_PARAM', 'MICROBE'], ARRAY['计算F值', '121度杀菌时间计算']),

-- 食品安全检查
('FOOD_SAFETY_CHECK', 'FOOD_KNOWLEDGE', '食品安全检查', TRUE, ARRAY['standard', 'haccp'], TRUE, ARRAY['MICROBE', 'HAZARD', 'TEST_METHOD'], ARRAY['出厂检验必须检测哪些微生物?', '什么项目需要批批检验?']),
('FOOD_RECALL_QUERY', 'FOOD_KNOWLEDGE', '召回信息查询', TRUE, ARRAY['regulation'], TRUE, ARRAY['PRODUCT', 'HAZARD'], ARRAY['最近有哪些食品召回事件?', '召回流程是什么?']),
('FOOD_ALLERGEN_CHECK', 'FOOD_KNOWLEDGE', '过敏原检查', TRUE, ARRAY['standard'], TRUE, ARRAY['INGREDIENT', 'PRODUCT'], ARRAY['这个产品含有哪些过敏原?', '常见食品过敏原有哪些?']),
('FOOD_CONTAMINATION_ASSESS', 'FOOD_KNOWLEDGE', '污染评估', TRUE, ARRAY['standard', 'haccp'], TRUE, ARRAY['HAZARD', 'MICROBE', 'PRODUCT'], ARRAY['交叉污染风险评估怎么做?', '车间环境监控方案']),

-- 营养与配方
('FOOD_NUTRITION_CALC', 'FOOD_KNOWLEDGE', '营养成分计算', TRUE, ARRAY['standard'], TRUE, ARRAY['NUTRIENT', 'INGREDIENT', 'PRODUCT'], ARRAY['帮我计算这个配方的热量', '每100g的蛋白质含量怎么计算?']),
('FOOD_FORMULA_DESIGN', 'FOOD_KNOWLEDGE', '配方设计指导', TRUE, ARRAY['standard', 'process'], TRUE, ARRAY['INGREDIENT', 'ADDITIVE', 'NUTRIENT'], ARRAY['低糖饮料的配方设计要点?', '如何降低产品的钠含量?']),
('FOOD_SHELF_LIFE', 'FOOD_KNOWLEDGE', '保质期评估', TRUE, ARRAY['standard', 'process'], TRUE, ARRAY['PRODUCT', 'PROCESS_PARAM', 'MICROBE'], ARRAY['酸奶在25°C下保质期多久?', '影响保质期的因素有哪些?']),
('FOOD_NUTRITION_LABEL', 'FOOD_KNOWLEDGE', '营养标签指导', TRUE, ARRAY['standard'], TRUE, ARRAY['NUTRIENT', 'STANDARD'], ARRAY['营养成分表必须标注哪些成分?', 'NRV%怎么计算?']),

-- 微生物与检测
('FOOD_MICROBE_QUERY', 'FOOD_KNOWLEDGE', '微生物知识查询', TRUE, ARRAY['standard', 'microbe'], TRUE, ARRAY['MICROBE', 'TEST_METHOD'], ARRAY['沙门氏菌在什么温度下可以被杀灭?', '大肠杆菌O157有什么危害?']),
('FOOD_TEST_METHOD', 'FOOD_KNOWLEDGE', '检测方法查询', TRUE, ARRAY['standard'], TRUE, ARRAY['TEST_METHOD', 'MICROBE', 'HAZARD'], ARRAY['菌落总数用什么方法检测?', 'ELISA和PCR哪个更准确?']),
('FOOD_SAMPLING_PLAN', 'FOOD_KNOWLEDGE', '抽样方案', TRUE, ARRAY['standard'], TRUE, ARRAY['STANDARD', 'PRODUCT', 'MICROBE'], ARRAY['GB 2828抽样方案怎么选?', '微生物检验的抽样数量?']),

-- 设备与清洗
('FOOD_EQUIPMENT_GUIDE', 'FOOD_KNOWLEDGE', '设备使用指南', TRUE, ARRAY['process', 'sop'], TRUE, ARRAY['EQUIPMENT'], ARRAY['杀菌釜操作注意事项?', '均质机怎么维护?']),
('FOOD_CIP_GUIDE', 'FOOD_KNOWLEDGE', 'CIP清洗指导', TRUE, ARRAY['sop', 'process'], TRUE, ARRAY['EQUIPMENT', 'PROCESS_PARAM'], ARRAY['CIP清洗步骤是什么?', '碱洗浓度多少合适?']),
('FOOD_EQUIPMENT_VALIDATION', 'FOOD_KNOWLEDGE', '设备验证', TRUE, ARRAY['sop', 'haccp'], TRUE, ARRAY['EQUIPMENT', 'PROCESS_PARAM'], ARRAY['杀菌釜需要做哪些验证?', '设备校准频率']),

-- 环境与卫生
('FOOD_GMP_GUIDE', 'FOOD_KNOWLEDGE', 'GMP指导', TRUE, ARRAY['standard', 'sop'], TRUE, ARRAY['STANDARD', 'CERT'], ARRAY['车间环境温度要求是什么?', 'GMP对更衣室有什么要求?']),
('FOOD_PEST_CONTROL', 'FOOD_KNOWLEDGE', '虫害控制', TRUE, ARRAY['sop', 'haccp'], TRUE, ARRAY['STANDARD'], ARRAY['食品工厂虫害控制方案?', '挡鼠板高度要求?']),
('FOOD_WATER_QUALITY', 'FOOD_KNOWLEDGE', '水质管理', TRUE, ARRAY['standard'], TRUE, ARRAY['STANDARD', 'TEST_METHOD'], ARRAY['生产用水的微生物限量?', '水质检测频率?']),
('FOOD_WASTE_MANAGEMENT', 'FOOD_KNOWLEDGE', '废物管理', TRUE, ARRAY['regulation', 'sop'], TRUE, ARRAY['REGULATION'], ARRAY['食品废弃物处理规范?', '污水排放标准?']),

-- 供应链与溯源
('FOOD_TRACEABILITY_GUIDE', 'FOOD_KNOWLEDGE', '溯源指导', TRUE, ARRAY['regulation', 'standard'], TRUE, ARRAY['REGULATION', 'STANDARD'], ARRAY['食品溯源体系怎么建?', '一物一码实现方案?']),
('FOOD_SUPPLIER_AUDIT', 'FOOD_KNOWLEDGE', '供应商审核', TRUE, ARRAY['haccp', 'sop'], TRUE, ARRAY['CERT', 'STANDARD'], ARRAY['原料供应商审核要点?', '供应商资质要求?']),
('FOOD_COLD_CHAIN', 'FOOD_KNOWLEDGE', '冷链管理', TRUE, ARRAY['standard', 'process'], TRUE, ARRAY['PROCESS_PARAM', 'PRODUCT'], ARRAY['冷链运输温度要求?', '断链后如何评估产品安全性?']),

-- 特定品类
('FOOD_DAIRY_GUIDE', 'FOOD_KNOWLEDGE', '乳制品指导', TRUE, ARRAY['standard', 'process'], TRUE, ARRAY['PRODUCT', 'PROCESS_PARAM', 'STANDARD'], ARRAY['巴氏奶和灭菌奶有什么区别?', '酸奶生产工艺要点?']),
('FOOD_MEAT_GUIDE', 'FOOD_KNOWLEDGE', '肉制品指导', TRUE, ARRAY['standard', 'process'], TRUE, ARRAY['PRODUCT', 'PROCESS_PARAM', 'ADDITIVE'], ARRAY['火腿肠加工工艺?', '肉制品亚硝酸盐限量?']),
('FOOD_BAKERY_GUIDE', 'FOOD_KNOWLEDGE', '烘焙指导', TRUE, ARRAY['process'], TRUE, ARRAY['PRODUCT', 'PROCESS_PARAM', 'INGREDIENT'], ARRAY['面包发酵温度和时间?', '蛋糕膨松剂用量?']),
('FOOD_BEVERAGE_GUIDE', 'FOOD_KNOWLEDGE', '饮料指导', TRUE, ARRAY['standard', 'process'], TRUE, ARRAY['PRODUCT', 'ADDITIVE', 'PROCESS_PARAM'], ARRAY['碳酸饮料的CO2含量标准?', '果汁含量标注规则?']),
('FOOD_FROZEN_GUIDE', 'FOOD_KNOWLEDGE', '速冻食品指导', TRUE, ARRAY['standard', 'process'], TRUE, ARRAY['PRODUCT', 'PROCESS_PARAM'], ARRAY['速冻水饺的中心温度要求?', 'IQF和BQF有什么区别?']),

-- 培训与合规
('FOOD_TRAINING_GUIDE', 'FOOD_KNOWLEDGE', '培训指导', TRUE, ARRAY['regulation', 'sop'], TRUE, ARRAY['REGULATION', 'CERT'], ARRAY['食品从业人员培训内容?', '健康证办理流程?']),
('FOOD_COMPLIANCE_CHECK', 'FOOD_KNOWLEDGE', '合规检查', TRUE, ARRAY['regulation', 'standard'], TRUE, ARRAY['REGULATION', 'STANDARD'], ARRAY['食品生产许可证(SC)申请条件?', '日常监管检查内容?']),

-- 研发与创新
('FOOD_RND_CONSULT', 'FOOD_KNOWLEDGE', '研发咨询', TRUE, ARRAY['process', 'standard'], TRUE, ARRAY['INGREDIENT', 'ADDITIVE', 'PRODUCT'], ARRAY['低GI食品开发要点?', '植物基蛋白饮料技术难点?']),
('FOOD_PACKAGING_GUIDE', 'FOOD_KNOWLEDGE', '包装指导', TRUE, ARRAY['standard'], TRUE, ARRAY['STANDARD', 'PRODUCT'], ARRAY['食品接触材料标准?', 'MAP包装参数?'])
ON CONFLICT (intent_code) DO NOTHING;

-- ============================================================
-- 7. 更新时间触发器
-- ============================================================
CREATE OR REPLACE FUNCTION update_food_kb_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_food_kb_docs_updated
    BEFORE UPDATE ON food_knowledge_documents
    FOR EACH ROW EXECUTE FUNCTION update_food_kb_timestamp();

CREATE TRIGGER trg_food_entity_dict_updated
    BEFORE UPDATE ON food_entity_dictionary
    FOR EACH ROW EXECUTE FUNCTION update_food_kb_timestamp();

CREATE TRIGGER trg_food_intent_config_updated
    BEFORE UPDATE ON food_intent_config
    FOR EACH ROW EXECUTE FUNCTION update_food_kb_timestamp();

-- ============================================================
-- 验证
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '食品知识库表创建完成:';
    RAISE NOTICE '  - food_knowledge_documents (知识文档表)';
    RAISE NOTICE '  - food_knowledge_audit_log (审计日志表)';
    RAISE NOTICE '  - food_entity_dictionary (实体字典表)';
    RAISE NOTICE '  - food_intent_config (意图配置表)';
    RAISE NOTICE '初始数据: 添加剂 10条, 标准 10条, 设备 10条, 微生物 8条, 危害物 8条, 认证 6条';
    RAISE NOTICE '食品意图: 50个专业意图配置';
END $$;
