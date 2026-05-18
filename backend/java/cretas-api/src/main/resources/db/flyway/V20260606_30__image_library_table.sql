-- P2 #80 C-IMAGE-LIB-1 — 公共图片库 (策划层, 建于 attachments 之上)
--
-- 功能: 把已上传的 attachment (image/*) 收录至图片库, 支持 title/description/tags/category +
-- 跨工厂共享 (isPublic) + 使用计数 (usageCount).
-- spec: docs/superpowers/dispatch/28-BACKLOG-STATUS-AUDIT.md line 204
--
-- 跨工厂可见规则 (Service 层 enforce, 见 ImageLibraryRepository.findVisibleById):
--   visible(F, img) ⇔ img.factory_id = F  OR  img.factory_id IS NULL  OR  img.is_public = true.

CREATE TABLE IF NOT EXISTS image_library (
    id                  VARCHAR(191) PRIMARY KEY,
    attachment_id       VARCHAR(191) NOT NULL,
    factory_id          VARCHAR(50),                 -- nullable: NULL 表示平台公共图片
    title               VARCHAR(200) NOT NULL,
    description         TEXT,
    tags                JSONB        NOT NULL DEFAULT '[]'::jsonb,
    category            VARCHAR(32)  NOT NULL DEFAULT 'OTHER',
    uploader_user_id    BIGINT       NOT NULL,
    is_public           BOOLEAN      NOT NULL DEFAULT FALSE,
    usage_count         BIGINT       NOT NULL DEFAULT 0,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMP,
    CONSTRAINT chk_imglib_category
        CHECK (category IN ('PRODUCT','MARKETING','LOGO','EVENT','OTHER')),
    CONSTRAINT chk_imglib_usage_count_nonneg
        CHECK (usage_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_imglib_factory_category
    ON image_library(factory_id, category);

CREATE INDEX IF NOT EXISTS idx_imglib_factory_public
    ON image_library(factory_id, is_public);

CREATE INDEX IF NOT EXISTS idx_imglib_public
    ON image_library(is_public)
    WHERE is_public = TRUE;

CREATE INDEX IF NOT EXISTS idx_imglib_attachment
    ON image_library(attachment_id);

CREATE INDEX IF NOT EXISTS idx_imglib_uploader
    ON image_library(factory_id, uploader_user_id);

CREATE INDEX IF NOT EXISTS idx_imglib_usage
    ON image_library(factory_id, usage_count DESC);

-- jsonb GIN 加速 tag 检索 (Java 内存过滤是 fallback, 数据量大时可改用 jsonb @> 操作符)
CREATE INDEX IF NOT EXISTS idx_imglib_tags_gin
    ON image_library USING GIN (tags);

-- 软删过滤辅助 — 业务查询都带 deleted_at IS NULL, 此 partial index 加速
CREATE INDEX IF NOT EXISTS idx_imglib_active
    ON image_library(factory_id, created_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE image_library IS
    '公共图片库 (P2 #80 C-IMAGE-LIB-1). 策划层 — 引用 attachments.id, 提供分类/标签/搜索/计数.';
COMMENT ON COLUMN image_library.factory_id IS
    'NULL = 平台公共图片 (全工厂可见). 非 NULL = 本工厂私有, isPublic=true 时也跨工厂可见.';
COMMENT ON COLUMN image_library.is_public IS
    'true 时即使 factory_id 非 NULL 也允许其他工厂引用.';
COMMENT ON COLUMN image_library.usage_count IS
    '使用次数累计 — recordUsage endpoint 原子自增. 用于"热门"排序.';
COMMENT ON COLUMN image_library.tags IS
    'jsonb 字符串数组. 例: ["促销","春季","新品"]. GIN 索引覆盖.';
