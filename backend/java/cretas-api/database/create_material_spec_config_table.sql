-- 原材料规格配置表
-- 功能：存储每个工厂的原材料规格配置
-- 创建日期：2025-11-18

CREATE TABLE IF NOT EXISTS `material_spec_config` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `factory_id` VARCHAR(50) NOT NULL COMMENT '工厂ID',
  `category` VARCHAR(50) NOT NULL COMMENT '原材料类别（海鲜、肉类等）',
  `specifications` JSON NOT NULL COMMENT '规格选项列表 ["切片", "整条", "去骨"]',
  `is_system_default` BOOLEAN DEFAULT FALSE COMMENT '是否系统默认配置',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_factory_category` (`factory_id`, `category`) COMMENT '工厂+类别唯一索引',
  INDEX `idx_factory` (`factory_id`) COMMENT '工厂ID索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='原材料规格配置表';

-- 插入系统默认配置（用于新工厂初始化）
-- 注意：这些是示例数据，实际使用时应该在创建新工厂时动态插入

INSERT INTO `material_spec_config` (`factory_id`, `category`, `specifications`, `is_system_default`)
VALUES
  ('SYSTEM_DEFAULT', '海鲜', '["整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳"]', TRUE),
  ('SYSTEM_DEFAULT', '肉类', '["整块", "切片", "切丁", "绞肉", "排骨", "带骨", "去骨"]', TRUE),
  ('SYSTEM_DEFAULT', '蔬菜', '["整颗", "切段", "切丝", "切块", "切片"]', TRUE),
  ('SYSTEM_DEFAULT', '水果', '["整个", "切片", "切块", "去皮", "带皮"]', TRUE),
  ('SYSTEM_DEFAULT', '粉类', '["袋装", "散装", "桶装"]', TRUE),
  ('SYSTEM_DEFAULT', '米面', '["袋装", "散装", "包装"]', TRUE),
  ('SYSTEM_DEFAULT', '油类', '["瓶装", "桶装", "散装", "大桶", "小瓶"]', TRUE),
  ('SYSTEM_DEFAULT', '调料', '["瓶装", "袋装", "罐装", "散装", "盒装"]', TRUE),
  ('SYSTEM_DEFAULT', '其他', '["原装", "分装", "定制"]', TRUE)
ON DUPLICATE KEY UPDATE
  `specifications` = VALUES(`specifications`),
  `is_system_default` = VALUES(`is_system_default`),
  `updated_at` = CURRENT_TIMESTAMP;
