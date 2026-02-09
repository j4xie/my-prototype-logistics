-- =====================================================
-- Sprint 2 S2-1: ProductType 添加 formTemplateId 字段
-- 用途: 关联产品类型与特定表单模板
-- =====================================================

-- 1. 添加 form_template_id 字段 (nullable，后续可补充默认值)
ALTER TABLE product_types
ADD COLUMN form_template_id VARCHAR(100) NULL COMMENT '关联的表单模板ID';

-- 2. 添加索引以优化查询
CREATE INDEX idx_product_form_template ON product_types(form_template_id);

-- 3. 添加外键约束 (如果 form_templates 表存在)
-- 注意: 外键约束是可选的，取决于 form_templates 表是否已存在
-- ALTER TABLE product_types
-- ADD CONSTRAINT fk_product_form_template
-- FOREIGN KEY (form_template_id) REFERENCES form_templates(id);

-- 4. 添加注释
ALTER TABLE product_types MODIFY COLUMN form_template_id VARCHAR(100) NULL
    COMMENT '关联的表单模板ID，用于产品类型专属表单';
