-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_30_2__add_feedback_stage_type.sql
-- Conversion date: 2026-01-26 18:46:11
-- ============================================

-- =====================================================
-- 工人分配反馈表添加工艺维度字段
-- Phase 3: 个人效率分解系统数据收集增强
-- 版本: V2025_12_30_2
-- 作者: Cretas Team
-- 创建时间: 2025-12-30
-- =====================================================

-- 1. 添加工艺类型字段
-- 用于区分不同工艺的效率表现，支持个人效率分解计算
ALTER TABLE worker_allocation_feedbacks
ADD COLUMN IF NOT EXISTS stage_type VARCHAR(30) DEFAULT NULL
COMMENT '工艺类型 (ProcessingStageType枚举值)';

-- 2. 添加团队成员组成字段
-- 记录同一任务的所有参与工人，用于个人效率分解
ALTER TABLE worker_allocation_feedbacks
ADD COLUMN IF NOT EXISTS team_composition JSON DEFAULT NULL
COMMENT '团队成员ID列表 (JSON数组格式: [1,2,3,4,5])';

-- 3. 添加工厂+工艺类型复合索引
-- 用于按工艺类型分组查询效率数据
CREATE INDEX IF NOT EXISTS idx_waf_factory_stage
ON worker_allocation_feedbacks (factory_id, stage_type);

-- 4. 添加工艺类型有效性检查约束 (可选，因为JPA @Enumerated已做限制)
-- 有效值: SLICING, DICING, MINCING, MARINATING, COATING, FRYING, STEAMING,
--         GRILLING, BAKING, FREEZING, THAWING, PACKAGING, LABELING, WEIGHING,
--         QUALITY_CHECK, SORTING, MIXING, GRINDING, CURING, SMOKING, DRYING,
--         VACUUM_SEALING, PASTEURIZATION, STORAGE, SHIPPING, OTHER

-- =====================================================
-- 数据迁移说明
-- =====================================================
-- 现有记录的 stage_type 和 team_composition 将为 NULL
-- 这是预期行为，因为历史数据没有这些信息
-- 后续新创建的反馈记录将填充这些字段

-- 验证SQL (可在部署后手动运行):
-- SELECT
--   COUNT(*) as total,
--   COUNT(stage_type) as with_stage_type,
--   COUNT(team_composition) as with_team
-- FROM worker_allocation_feedbacks;
