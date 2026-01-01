-- ========================================
-- MallCenter V5.1 数据库迁移脚本
-- 补充商户表的推荐相关字段
-- 对齐 Merchant.java 实体定义
-- ========================================

-- 检查并添加 referral_code 字段
ALTER TABLE `merchant`
ADD COLUMN IF NOT EXISTS `referral_code` VARCHAR(50) NULL COMMENT '推荐码（来源推荐人的推荐码）' AFTER `status`;

-- 检查并添加 referrer_id 字段
ALTER TABLE `merchant`
ADD COLUMN IF NOT EXISTS `referrer_id` BIGINT NULL COMMENT '推荐人ID' AFTER `referral_code`;

-- 添加索引以优化推荐查询
CREATE INDEX IF NOT EXISTS `idx_referral_code` ON `merchant` (`referral_code`);
CREATE INDEX IF NOT EXISTS `idx_referrer_id` ON `merchant` (`referrer_id`);

-- ========================================
-- 完成
-- ========================================
SELECT 'V5.1 Migration completed - Merchant referral fields added!' AS status;

















