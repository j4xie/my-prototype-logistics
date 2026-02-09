-- =====================================================
-- Sprint 2 S2-4: 生产批次拍照证据字段
-- 用途: 为生产批次添加拍照要求和SOP关联
-- =====================================================

-- 1. 添加拍照相关字段到生产批次表
ALTER TABLE production_batches
    ADD COLUMN IF NOT EXISTS photo_required BOOLEAN DEFAULT FALSE COMMENT '是否需要拍照证据',
    ADD COLUMN IF NOT EXISTS sop_config_id VARCHAR(50) NULL COMMENT '关联的SOP配置ID',
    ADD COLUMN IF NOT EXISTS photo_completed_stages JSON NULL COMMENT '已完成拍照的环节列表';

-- 2. 添加索引
CREATE INDEX IF NOT EXISTS idx_batch_sop ON production_batches(sop_config_id);
CREATE INDEX IF NOT EXISTS idx_batch_photo_required ON production_batches(photo_required);
