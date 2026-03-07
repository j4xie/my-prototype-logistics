-- 创建商户页面配置表
-- 用于店铺装修系统持久化存储
-- 执行: PGPASSWORD=cretas psql -U cretas -h localhost -d mall_center -f create_merchant_page_config.sql

CREATE TABLE IF NOT EXISTS merchant_page_config (
    id              BIGSERIAL PRIMARY KEY,
    merchant_id     BIGINT,                          -- 商户ID (NULL=通用默认)
    page_type       VARCHAR(50) NOT NULL DEFAULT 'home', -- 页面类型: home/category/product_list 等
    page_name       VARCHAR(100),                    -- 页面名称
    template_id     BIGINT,                          -- 使用的模板ID
    theme_preset_id BIGINT,                          -- 主题预设ID (关联 decoration_theme_preset)
    theme_code      VARCHAR(50),                     -- 主题编码 (如 fresh_green)
    custom_theme    TEXT,                             -- 自定义主题配置 JSON
    modules_config  TEXT,                             -- 模块列表配置 JSON
    page_config     TEXT,                             -- 页面配置 JSON
    shop_name       VARCHAR(100),                    -- 店铺名称
    logo_url        VARCHAR(500),                    -- Logo URL
    slogan          VARCHAR(200),                    -- 宣传语
    notice_texts    TEXT,                             -- 通知文字 JSON array
    banner_config   TEXT,                             -- 轮播图配置 JSON
    seo_title       VARCHAR(200),                    -- SEO标题
    seo_keywords    VARCHAR(500),                    -- SEO关键词
    seo_description TEXT,                             -- SEO描述
    status          INTEGER NOT NULL DEFAULT 0,       -- 0=草稿 1=已发布
    version         INTEGER NOT NULL DEFAULT 1,       -- 版本号
    published_at    TIMESTAMP,                       -- 发布时间
    create_by       BIGINT,                          -- 创建人
    create_time     TIMESTAMP DEFAULT NOW(),
    update_time     TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_mpc_merchant_page ON merchant_page_config(merchant_id, page_type);
CREATE INDEX IF NOT EXISTS idx_mpc_status ON merchant_page_config(status);

COMMENT ON TABLE merchant_page_config IS '商户页面装修配置';
COMMENT ON COLUMN merchant_page_config.merchant_id IS '商户ID, NULL表示通用默认配置';
COMMENT ON COLUMN merchant_page_config.theme_code IS '主题编码, 对应decoration_theme_preset.code';
COMMENT ON COLUMN merchant_page_config.custom_theme IS 'JSON: {primaryColor, secondaryColor, backgroundColor, textColor, ...}';
COMMENT ON COLUMN merchant_page_config.notice_texts IS 'JSON数组: ["通知1", "通知2", ...]';
COMMENT ON COLUMN merchant_page_config.status IS '0=草稿 1=已发布';

-- 插入默认通用配置
INSERT INTO merchant_page_config (merchant_id, page_type, page_name, theme_code, custom_theme, shop_name, logo_url, slogan, notice_texts, status, version)
VALUES (
    NULL,
    'home',
    '首页',
    'fresh_green',
    '{"primaryColor":"#52c41a","secondaryColor":"#1a1a1a","backgroundColor":"#f5f5f5","textColor":"#333333","accentColor":"#52c41a","primaryLight":"#d7f0db","primaryDark":"#389e0d","noticeBg":"#d7f0db","noticeText":"#389e0d","darkBg":"#1a1a1a","darkSecondary":"#2d2d2d","borderColor":"#52c41a"}',
    '白垩纪食品溯源商城',
    '/public/img/logo-duxianlai.png',
    '新鲜直达，品质生活',
    '["欢迎使用白垩纪食品溯源商城","扫码即可查看商品溯源信息","联系电话：13916928096"]',
    1,
    1
)
ON CONFLICT DO NOTHING;
