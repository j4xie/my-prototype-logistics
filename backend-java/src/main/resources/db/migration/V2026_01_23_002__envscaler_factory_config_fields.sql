-- Add synthetic data configuration fields to factory_ai_learning_config table
-- For EnvScaler adaptive synthetic data generation control

ALTER TABLE factory_ai_learning_config
    ADD COLUMN synthetic_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用合成数据生成',
    ADD COLUMN synthetic_disabled_reason VARCHAR(500) NULL COMMENT '禁用合成数据的原因',
    ADD COLUMN synthetic_disabled_at DATETIME NULL COMMENT '禁用合成数据的时间',
    ADD COLUMN synthetic_max_ratio DECIMAL(3,2) DEFAULT 0.80 COMMENT '合成数据最大占比(0-1)',
    ADD COLUMN synthetic_weight DECIMAL(3,2) DEFAULT 0.50 COMMENT '合成数据权重(0-1)';

-- Add index for efficient filtering by synthetic_enabled status
CREATE INDEX idx_falc_synthetic_enabled ON factory_ai_learning_config(synthetic_enabled);
