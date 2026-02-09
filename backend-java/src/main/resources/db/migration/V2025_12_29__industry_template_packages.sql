-- 行业模板包表
-- 用于存储预定义的行业配置模板，工厂可以快速导入

CREATE TABLE IF NOT EXISTS industry_template_packages (
    id VARCHAR(50) PRIMARY KEY,
    industry_code VARCHAR(50) NOT NULL COMMENT '行业代码 (seafood_processing, prepared_food, etc.)',
    industry_name VARCHAR(100) NOT NULL COMMENT '行业中文名 (水产加工, 预制菜加工, etc.)',
    description TEXT COMMENT '行业模板描述',
    templates_json JSON NOT NULL COMMENT '包含多个EntityType的Schema配置',
    version INT DEFAULT 1 COMMENT '模板版本',
    is_default BOOLEAN DEFAULT FALSE COMMENT '是否为默认模板',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_industry_code (industry_code),
    INDEX idx_is_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='行业模板包';

-- 初始化水产加工行业模板
INSERT INTO industry_template_packages (id, industry_code, industry_name, description, templates_json, is_default) VALUES
('TPL-SEAFOOD-001', 'seafood_processing', '水产加工',
 '适用于水产品加工企业，包含原料收购、加工生产、质量检验等环节的配置模板。',
 JSON_OBJECT(
   'QUALITY_CHECK', JSON_OBJECT(
     'properties', JSON_OBJECT(
       'temperature', JSON_OBJECT(
         'type', 'number',
         'title', '温度(°C)',
         'x-component', 'NumberPicker',
         'x-component-props', JSON_OBJECT('min', -30, 'max', 100, 'precision', 1),
         'x-decorator', 'FormItem',
         'required', true
       ),
       'bacteriaCount', JSON_OBJECT(
         'type', 'number',
         'title', '菌落总数(CFU/g)',
         'x-component', 'NumberPicker',
         'x-component-props', JSON_OBJECT('min', 0),
         'x-decorator', 'FormItem'
       ),
       'histamine', JSON_OBJECT(
         'type', 'number',
         'title', '组胺(mg/kg)',
         'description', '鱼类组胺检测',
         'x-component', 'NumberPicker',
         'x-component-props', JSON_OBJECT('min', 0, 'max', 200),
         'x-decorator', 'FormItem'
       ),
       'freshness', JSON_OBJECT(
         'type', 'string',
         'title', '新鲜度评级',
         'x-component', 'Select',
         'enum', JSON_ARRAY(
           JSON_OBJECT('label', '优', 'value', 'A'),
           JSON_OBJECT('label', '良', 'value', 'B'),
           JSON_OBJECT('label', '合格', 'value', 'C'),
           JSON_OBJECT('label', '不合格', 'value', 'D')
         ),
         'x-decorator', 'FormItem'
       )
     )
   ),
   'MATERIAL_BATCH', JSON_OBJECT(
     'properties', JSON_OBJECT(
       'frozenType', JSON_OBJECT(
         'type', 'string',
         'title', '冻品类型',
         'x-component', 'Select',
         'enum', JSON_ARRAY(
           JSON_OBJECT('label', '鲜活', 'value', 'fresh'),
           JSON_OBJECT('label', '冷藏', 'value', 'chilled'),
           JSON_OBJECT('label', '冷冻', 'value', 'frozen')
         ),
         'x-decorator', 'FormItem'
       ),
       'catchDate', JSON_OBJECT(
         'type', 'string',
         'title', '捕捞日期',
         'x-component', 'DatePicker',
         'x-decorator', 'FormItem'
       ),
       'originPort', JSON_OBJECT(
         'type', 'string',
         'title', '产地/港口',
         'x-component', 'Input',
         'x-decorator', 'FormItem'
       )
     )
   )
 ),
 true
);

-- 初始化预制菜加工行业模板
INSERT INTO industry_template_packages (id, industry_code, industry_name, description, templates_json) VALUES
('TPL-PREPARED-001', 'prepared_food', '预制菜加工',
 '适用于预制菜生产企业，包含配料管理、烹饪工艺、包装检验等环节的配置模板。',
 JSON_OBJECT(
   'QUALITY_CHECK', JSON_OBJECT(
     'properties', JSON_OBJECT(
       'centralTemp', JSON_OBJECT(
         'type', 'number',
         'title', '中心温度(°C)',
         'description', '食品中心温度检测',
         'x-component', 'NumberPicker',
         'x-component-props', JSON_OBJECT('min', -30, 'max', 200, 'precision', 1),
         'x-decorator', 'FormItem',
         'required', true
       ),
       'spicyLevel', JSON_OBJECT(
         'type', 'number',
         'title', '辣度评分',
         'description', '1-5分，3分以上为辣',
         'x-component', 'Rate',
         'x-component-props', JSON_OBJECT('count', 5),
         'x-decorator', 'FormItem'
       ),
       'tasteScore', JSON_OBJECT(
         'type', 'number',
         'title', '口味评分',
         'x-component', 'Rate',
         'x-component-props', JSON_OBJECT('count', 5),
         'x-decorator', 'FormItem'
       ),
       'packagingIntegrity', JSON_OBJECT(
         'type', 'string',
         'title', '包装完整性',
         'x-component', 'Radio.Group',
         'enum', JSON_ARRAY(
           JSON_OBJECT('label', '完好', 'value', 'intact'),
           JSON_OBJECT('label', '轻微破损', 'value', 'minor_damage'),
           JSON_OBJECT('label', '严重破损', 'value', 'major_damage')
         ),
         'x-decorator', 'FormItem'
       )
     )
   ),
   'PRODUCTION_BATCH', JSON_OBJECT(
     'properties', JSON_OBJECT(
       'cookingMethod', JSON_OBJECT(
         'type', 'string',
         'title', '烹饪方式',
         'x-component', 'Select',
         'enum', JSON_ARRAY(
           JSON_OBJECT('label', '蒸', 'value', 'steam'),
           JSON_OBJECT('label', '炒', 'value', 'stir_fry'),
           JSON_OBJECT('label', '炸', 'value', 'deep_fry'),
           JSON_OBJECT('label', '烤', 'value', 'roast'),
           JSON_OBJECT('label', '煮', 'value', 'boil')
         ),
         'x-decorator', 'FormItem'
       ),
       'cookingTime', JSON_OBJECT(
         'type', 'number',
         'title', '烹饪时长(分钟)',
         'x-component', 'NumberPicker',
         'x-component-props', JSON_OBJECT('min', 0),
         'x-decorator', 'FormItem'
       )
     )
   )
 )
);

-- 在 form_templates 表添加版本字段（如果不存在）
-- 这样可以追踪配置的变更历史
ALTER TABLE form_templates
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 COMMENT '模板版本',
ADD COLUMN IF NOT EXISTS previous_version_id VARCHAR(50) NULL COMMENT '上一版本ID',
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual' COMMENT '来源: manual, ai_assistant, template_import';

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_form_templates_version ON form_templates (factory_id, entity_type, version);
