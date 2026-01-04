-- ========================================
-- MallCenter V5.2 数据库迁移脚本
-- 补全商户表表单字段
-- 对齐 Merchant.java 实体定义与小程序注册表单
-- ========================================

-- 添加公司类型字段
ALTER TABLE `merchant`
ADD COLUMN IF NOT EXISTS `company_type` VARCHAR(50) NULL COMMENT '公司类型' AFTER `address`;

-- 添加职位字段
ALTER TABLE `merchant`
ADD COLUMN IF NOT EXISTS `position` VARCHAR(50) NULL COMMENT '联系人职位' AFTER `company_type`;

-- 添加采购量字段
ALTER TABLE `merchant`
ADD COLUMN IF NOT EXISTS `purchase_volume` VARCHAR(50) NULL COMMENT '预估采购量' AFTER `position`;

-- 添加备注字段
ALTER TABLE `merchant`
ADD COLUMN IF NOT EXISTS `remarks` TEXT NULL COMMENT '备注信息' AFTER `purchase_volume`;

-- ========================================
-- 完成
-- ========================================
SELECT 'V5.2 Migration completed - Merchant form fields added!' AS status;




























