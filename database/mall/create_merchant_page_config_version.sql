-- 商户页面配置版本快照表
CREATE TABLE IF NOT EXISTS merchant_page_config_version (
    id              BIGSERIAL PRIMARY KEY,
    config_id       BIGINT,
    merchant_id     BIGINT,
    page_type       VARCHAR(50) NOT NULL DEFAULT 'home',
    version_no      INTEGER NOT NULL DEFAULT 1,
    theme_code      VARCHAR(50),
    custom_theme    TEXT,
    modules_config  TEXT,
    shop_name       VARCHAR(200),
    slogan          VARCHAR(500),
    notice_texts    TEXT,
    change_source   VARCHAR(50),
    change_description VARCHAR(500),
    create_time     TIMESTAMP DEFAULT NOW()
);

-- 索引：商户+页面类型查询
CREATE INDEX IF NOT EXISTS idx_pcv_merchant_page
    ON merchant_page_config_version (merchant_id, page_type, version_no DESC);

COMMENT ON TABLE merchant_page_config_version IS '商户页面配置版本快照';
COMMENT ON COLUMN merchant_page_config_version.change_source IS '变更来源: chat/template/manual';
