-- V20260516_01: C-ATT-1 通用附件表 (多态: entity_type + entity_id)
--
-- 业务背景: 五大场景 (客户跟踪 / 采购订单 / 质检 / 生产证据 / 财务凭证) 需要附件挂载.
-- 客户原话 (六扇门第三次 May7 part2 行 546): "拍照也可以留个单据... 留个附件类似一个拍照
-- 然后一个附件也可以的呀".
--
-- spec: 宏见竞品分析/01-客户档案/SCHEMA_DESIGN.md §2.3 (行 537-595, byte-for-byte copy)
-- 决策: 多态关联不强外键, 仅存 file_url (不存 BLOB), 权限跟随 entity, 下载通过 OSS
--      pre-signed URL 实现细粒度控制.
--
-- 关联文件:
-- - backend/java/cretas-api/src/main/java/com/cretas/aims/entity/Attachment.java (JPA Entity)
-- - backend/java/cretas-api/src/main/java/com/cretas/aims/repository/AttachmentRepository.java
--
-- 新增 entity_type 值时务必同步:
-- (1) entity/Attachment.java EntityType enum
-- (2) 本 migration 的 chk_att_entity_type CHECK constraint (新建 ALTER migration)

CREATE TABLE attachments (
    id              VARCHAR(191) PRIMARY KEY,
    factory_id      VARCHAR(50) NOT NULL,

    -- 多态关联
    entity_type     VARCHAR(50) NOT NULL,                            -- CUSTOMER / PURCHASE_ORDER / QUALITY_CHECK / PRODUCTION_BATCH / PAYMENT_VOUCHER / ... 见 CHECK
    entity_id       VARCHAR(191) NOT NULL,                           -- 关联实体 ID (字符串兼容 UUID / Long.toString)

    -- 文件元数据
    file_name       VARCHAR(255) NOT NULL,                           -- 原文件名
    file_url        VARCHAR(1000) NOT NULL,                          -- OSS / R2 完整 URL
    thumbnail_url   VARCHAR(1000),                                   -- 缩略图 URL (图片才有)
    file_size       BIGINT NOT NULL,                                 -- bytes
    file_type       VARCHAR(50) NOT NULL,                            -- MIME type (image/jpeg, application/pdf, video/mp4 ...)
    file_category   VARCHAR(32) NOT NULL DEFAULT 'OTHER',            -- PHOTO/VIDEO/DOCUMENT/VOUCHER/SIGNATURE/OTHER
    file_storage    VARCHAR(20) NOT NULL DEFAULT 'OSS',              -- OSS / R2 / LOCAL
    file_hash       VARCHAR(64),                                     -- SHA256, 用于去重

    -- 业务标签
    business_tag    VARCHAR(50),                                     -- CONTRACT_SCAN / DELIVERY_PROOF / WEIGHT_TICKET / 任何业务自定义
    description     VARCHAR(500),

    -- 上传信息
    uploaded_by     BIGINT NOT NULL,
    uploaded_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    upload_source   VARCHAR(20) NOT NULL DEFAULT 'WEB',              -- WEB/MOBILE/DINGTALK/API

    -- 软删除 + 审计 (BaseEntity 字段)
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP,

    CONSTRAINT chk_att_entity_type CHECK (entity_type IN (
        'CUSTOMER', 'CUSTOMER_TRACKING', 'PURCHASE_ORDER', 'PURCHASE_RECEIPT',
        'QUALITY_CHECK', 'PRODUCTION_BATCH', 'PAYMENT_VOUCHER', 'INVOICE',
        'RD_SAMPLE', 'RECEIPT', 'RETURN_ORDER', 'SHIPMENT',
        'WASTAGE_RECORD', 'GROUP_LEADER_REPORT', 'EXPENSE_REPORT',
        'LEAVE_REQUEST', 'TIMECLOCK_PHOTO', 'GENERIC'
    )),
    CONSTRAINT chk_att_category CHECK (file_category IN ('PHOTO', 'VIDEO', 'DOCUMENT', 'VOUCHER', 'SIGNATURE', 'OTHER')),
    CONSTRAINT chk_att_storage CHECK (file_storage IN ('OSS', 'R2', 'LOCAL')),
    CONSTRAINT chk_att_size_positive CHECK (file_size > 0)
);

-- 核心查询: 某实体的所有附件 (列表 / 详情页用)
CREATE INDEX idx_att_entity ON attachments (factory_id, entity_type, entity_id) WHERE deleted_at IS NULL;

-- 按上传人查 (审计 / 用户主页)
CREATE INDEX idx_att_uploader ON attachments (factory_id, uploaded_by, uploaded_at DESC) WHERE deleted_at IS NULL;

-- 按业务标签查 (报表场景)
CREATE INDEX idx_att_tag ON attachments (factory_id, business_tag) WHERE business_tag IS NOT NULL AND deleted_at IS NULL;

-- 去重 (file_hash 在 factory 内唯一性查询)
CREATE INDEX idx_att_hash ON attachments (factory_id, file_hash) WHERE file_hash IS NOT NULL;

-- 按文件分类查 (列表筛选 / 图标渲染)
CREATE INDEX idx_att_category ON attachments (factory_id, file_category) WHERE deleted_at IS NULL;

COMMENT ON TABLE attachments IS '通用附件表 (多态: entity_type + entity_id) — C-ATT-1';
COMMENT ON COLUMN attachments.entity_type IS '关联实体类型, 白名单约束 (CHECK chk_att_entity_type) 与 Java Attachment.EntityType 枚举同步';
COMMENT ON COLUMN attachments.file_hash IS 'SHA256 客户端计算, 同 factory 同 hash 视为同一文件 (register 时触发去重)';
COMMENT ON COLUMN attachments.uploaded_by IS '上传者 user.id; 软删除时校验 uploaded_by = current user OR admin';
