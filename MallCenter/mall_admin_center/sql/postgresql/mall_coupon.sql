/*
 优惠券系统数据表 - PostgreSQL 版本
 Date: 2024-12-25
 Converted from MySQL
*/

-- ----------------------------
-- Table structure for mall_coupon
-- ----------------------------
DROP TABLE IF EXISTS mall_coupon CASCADE;
CREATE TABLE mall_coupon (
  id VARCHAR(32) NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  min_amount DECIMAL(10,2) DEFAULT NULL,
  discount_amount DECIMAL(10,2) DEFAULT NULL,
  discount_percent DECIMAL(5,2) DEFAULT NULL,
  max_discount DECIMAL(10,2) DEFAULT NULL,
  total_count INT DEFAULT 0,
  received_count INT DEFAULT 0,
  used_count INT DEFAULT 0,
  applicable_spu_ids TEXT,
  applicable_category_ids TEXT,
  start_time TIMESTAMP DEFAULT NULL,
  expire_time TIMESTAMP DEFAULT NULL,
  status CHAR(1) DEFAULT '1',
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE INDEX idx_mall_coupon_status ON mall_coupon(status);
CREATE INDEX idx_mall_coupon_expire_time ON mall_coupon(expire_time);
CREATE INDEX idx_mall_coupon_type ON mall_coupon(type);

COMMENT ON TABLE mall_coupon IS '优惠券表';
COMMENT ON COLUMN mall_coupon.id IS '优惠券ID';
COMMENT ON COLUMN mall_coupon.name IS '优惠券名称';
COMMENT ON COLUMN mall_coupon.type IS '类型: FIXED-满减券, PERCENT-折扣券, AMOUNT-现金券';
COMMENT ON COLUMN mall_coupon.min_amount IS '满减门槛金额';
COMMENT ON COLUMN mall_coupon.discount_amount IS '折扣金额';
COMMENT ON COLUMN mall_coupon.discount_percent IS '折扣百分比 (如: 8.5表示85折)';
COMMENT ON COLUMN mall_coupon.max_discount IS '最大优惠金额';
COMMENT ON COLUMN mall_coupon.total_count IS '总发行量';
COMMENT ON COLUMN mall_coupon.received_count IS '已领取数量';
COMMENT ON COLUMN mall_coupon.used_count IS '已使用数量';
COMMENT ON COLUMN mall_coupon.applicable_spu_ids IS '适用商品ID (逗号分隔，空表示全部)';
COMMENT ON COLUMN mall_coupon.applicable_category_ids IS '适用分类ID (逗号分隔，空表示全部)';
COMMENT ON COLUMN mall_coupon.start_time IS '生效时间';
COMMENT ON COLUMN mall_coupon.expire_time IS '失效时间';
COMMENT ON COLUMN mall_coupon.status IS '状态: 0-禁用, 1-启用';
COMMENT ON COLUMN mall_coupon.create_time IS '创建时间';
COMMENT ON COLUMN mall_coupon.update_time IS '更新时间';

-- Trigger for update_time auto-update
CREATE OR REPLACE FUNCTION update_mall_coupon_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.update_time = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mall_coupon_update_time
    BEFORE UPDATE ON mall_coupon
    FOR EACH ROW
    EXECUTE FUNCTION update_mall_coupon_updated_at();

-- ----------------------------
-- Table structure for mall_user_coupon
-- ----------------------------
DROP TABLE IF EXISTS mall_user_coupon CASCADE;
CREATE TABLE mall_user_coupon (
  id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  coupon_id VARCHAR(32) NOT NULL,
  status CHAR(1) DEFAULT '0',
  receive_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  use_time TIMESTAMP DEFAULT NULL,
  order_id VARCHAR(32) DEFAULT NULL,
  expire_time TIMESTAMP DEFAULT NULL,
  PRIMARY KEY (id)
);

CREATE INDEX idx_mall_user_coupon_user_id ON mall_user_coupon(user_id);
CREATE INDEX idx_mall_user_coupon_coupon_id ON mall_user_coupon(coupon_id);
CREATE INDEX idx_mall_user_coupon_status ON mall_user_coupon(status);
CREATE INDEX idx_mall_user_coupon_expire_time ON mall_user_coupon(expire_time);

COMMENT ON TABLE mall_user_coupon IS '用户优惠券表';
COMMENT ON COLUMN mall_user_coupon.id IS '用户优惠券ID';
COMMENT ON COLUMN mall_user_coupon.user_id IS '用户ID';
COMMENT ON COLUMN mall_user_coupon.coupon_id IS '优惠券ID';
COMMENT ON COLUMN mall_user_coupon.status IS '状态: 0-未使用, 1-已使用, 2-已过期';
COMMENT ON COLUMN mall_user_coupon.receive_time IS '领取时间';
COMMENT ON COLUMN mall_user_coupon.use_time IS '使用时间';
COMMENT ON COLUMN mall_user_coupon.order_id IS '使用的订单ID';
COMMENT ON COLUMN mall_user_coupon.expire_time IS '过期时间';

-- ----------------------------
-- Sample data for testing
-- ----------------------------
INSERT INTO mall_coupon (id, name, type, min_amount, discount_amount, discount_percent, max_discount, total_count, received_count, used_count, applicable_spu_ids, applicable_category_ids, start_time, expire_time, status) VALUES
('coupon_001', '新人立减10元', 'FIXED', 50.00, 10.00, NULL, NULL, 1000, 0, 0, NULL, NULL, NOW(), NOW() + INTERVAL '30 days', '1'),
('coupon_002', '全场85折', 'PERCENT', 100.00, NULL, 8.50, 50.00, 500, 0, 0, NULL, NULL, NOW(), NOW() + INTERVAL '30 days', '1'),
('coupon_003', '满200减30', 'FIXED', 200.00, 30.00, NULL, NULL, 300, 0, 0, NULL, NULL, NOW(), NOW() + INTERVAL '15 days', '1');
