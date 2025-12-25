/*
 优惠券系统数据表
 Date: 2024-12-25
*/

SET FOREIGN_KEY_CHECKS=0;

-- ----------------------------
-- Table structure for mall_coupon
-- ----------------------------
DROP TABLE IF EXISTS `mall_coupon`;
CREATE TABLE `mall_coupon` (
  `id` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '优惠券ID',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '优惠券名称',
  `type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '类型: FIXED-满减券, PERCENT-折扣券, AMOUNT-现金券',
  `min_amount` decimal(10,2) DEFAULT NULL COMMENT '满减门槛金额',
  `discount_amount` decimal(10,2) DEFAULT NULL COMMENT '折扣金额',
  `discount_percent` decimal(5,2) DEFAULT NULL COMMENT '折扣百分比 (如: 8.5表示85折)',
  `max_discount` decimal(10,2) DEFAULT NULL COMMENT '最大优惠金额',
  `total_count` int DEFAULT '0' COMMENT '总发行量',
  `received_count` int DEFAULT '0' COMMENT '已领取数量',
  `used_count` int DEFAULT '0' COMMENT '已使用数量',
  `applicable_spu_ids` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT '适用商品ID (逗号分隔，空表示全部)',
  `applicable_category_ids` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT '适用分类ID (逗号分隔，空表示全部)',
  `start_time` datetime DEFAULT NULL COMMENT '生效时间',
  `expire_time` datetime DEFAULT NULL COMMENT '失效时间',
  `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT '1' COMMENT '状态: 0-禁用, 1-启用',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_expire_time` (`expire_time`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='优惠券表';

-- ----------------------------
-- Table structure for mall_user_coupon
-- ----------------------------
DROP TABLE IF EXISTS `mall_user_coupon`;
CREATE TABLE `mall_user_coupon` (
  `id` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '用户优惠券ID',
  `user_id` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '用户ID',
  `coupon_id` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '优惠券ID',
  `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT '0' COMMENT '状态: 0-未使用, 1-已使用, 2-已过期',
  `receive_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
  `use_time` datetime DEFAULT NULL COMMENT '使用时间',
  `order_id` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '使用的订单ID',
  `expire_time` datetime DEFAULT NULL COMMENT '过期时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_coupon_id` (`coupon_id`),
  KEY `idx_status` (`status`),
  KEY `idx_expire_time` (`expire_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户优惠券表';

-- ----------------------------
-- Sample data for testing
-- ----------------------------
INSERT INTO `mall_coupon` (`id`, `name`, `type`, `min_amount`, `discount_amount`, `discount_percent`, `max_discount`, `total_count`, `received_count`, `used_count`, `applicable_spu_ids`, `applicable_category_ids`, `start_time`, `expire_time`, `status`) VALUES
('coupon_001', '新人立减10元', 'FIXED', 50.00, 10.00, NULL, NULL, 1000, 0, 0, NULL, NULL, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), '1'),
('coupon_002', '全场85折', 'PERCENT', 100.00, NULL, 8.50, 50.00, 500, 0, 0, NULL, NULL, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), '1'),
('coupon_003', '满200减30', 'FIXED', 200.00, 30.00, NULL, NULL, 300, 0, 0, NULL, NULL, NOW(), DATE_ADD(NOW(), INTERVAL 15 DAY), '1');

SET FOREIGN_KEY_CHECKS=1;
