-- 微信开放平台第三方平台支持
-- merchant 表增加授权字段 + parent_id（商城层级）

-- 1. 商户层级关系（商城主 vs 入驻商户）
ALTER TABLE merchant ADD COLUMN IF NOT EXISTS parent_id BIGINT;
COMMENT ON COLUMN merchant.parent_id IS '上级商城ID，NULL=商城主，有值=入驻商户';

-- 2. 微信小程序授权信息
ALTER TABLE merchant ADD COLUMN IF NOT EXISTS wx_authorizer_appid VARCHAR(64);
ALTER TABLE merchant ADD COLUMN IF NOT EXISTS wx_authorizer_refresh_token VARCHAR(512);
ALTER TABLE merchant ADD COLUMN IF NOT EXISTS wx_authorization_status INT DEFAULT 0;
COMMENT ON COLUMN merchant.wx_authorizer_appid IS '商户授权的小程序AppID';
COMMENT ON COLUMN merchant.wx_authorizer_refresh_token IS '授权刷新令牌';
COMMENT ON COLUMN merchant.wx_authorization_status IS '0未授权 1已授权 2已过期';

-- 3. 小程序发布状态
ALTER TABLE merchant ADD COLUMN IF NOT EXISTS wx_mini_version VARCHAR(32);
ALTER TABLE merchant ADD COLUMN IF NOT EXISTS wx_mini_status INT DEFAULT 0;
ALTER TABLE merchant ADD COLUMN IF NOT EXISTS wx_mini_audit_id BIGINT;
COMMENT ON COLUMN merchant.wx_mini_version IS '当前小程序版本号';
COMMENT ON COLUMN merchant.wx_mini_status IS '0未部署 1已上传 2审核中 3已发布 4审核失败';
COMMENT ON COLUMN merchant.wx_mini_audit_id IS '最近一次审核ID';

-- 4. 第三方平台全局配置表
CREATE TABLE IF NOT EXISTS wx_open_platform_config (
    id SERIAL PRIMARY KEY,
    component_appid VARCHAR(64) NOT NULL,
    component_appsecret VARCHAR(128) NOT NULL,
    component_verify_ticket VARCHAR(512),
    component_access_token VARCHAR(512),
    component_access_token_expires TIMESTAMP,
    msg_verify_token VARCHAR(128),
    msg_encrypt_key VARCHAR(128),
    status INT DEFAULT 1,
    create_time TIMESTAMP DEFAULT NOW(),
    update_time TIMESTAMP DEFAULT NOW()
);
COMMENT ON TABLE wx_open_platform_config IS '微信开放平台第三方平台配置';

-- 5. 小程序代码模板表
CREATE TABLE IF NOT EXISTS wx_mini_template (
    id SERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL,
    template_type INT DEFAULT 0,
    user_version VARCHAR(64),
    user_desc VARCHAR(512),
    source_miniprogram_appid VARCHAR(64),
    create_time TIMESTAMP DEFAULT NOW()
);
COMMENT ON TABLE wx_mini_template IS '小程序代码模板';

-- 索引
CREATE INDEX IF NOT EXISTS idx_merchant_parent_id ON merchant(parent_id);
CREATE INDEX IF NOT EXISTS idx_merchant_wx_appid ON merchant(wx_authorizer_appid);
