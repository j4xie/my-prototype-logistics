-- U-FEED-1 (Sprint 4 Wave 2 Chat L) — system-wide release notes feed.

CREATE TABLE IF NOT EXISTS release_notes (
    id            VARCHAR(36)  PRIMARY KEY,
    version       VARCHAR(32)  NOT NULL,
    title         VARCHAR(200) NOT NULL,
    body          TEXT         NOT NULL,
    severity      VARCHAR(32)  NOT NULL DEFAULT 'info',
    published_at  DATE         NOT NULL,
    expires_at    DATE         NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMP    NULL
);

CREATE INDEX IF NOT EXISTS idx_release_notes_published_at ON release_notes (published_at);
CREATE INDEX IF NOT EXISTS idx_release_notes_severity ON release_notes (severity);

COMMENT ON TABLE release_notes IS 'U-FEED-1 系统升级日志 (跨租户)';

-- Seed: announce U-VIEW-1 / U-NEW-1 / U-ICON-1 / U-MARKER-1 / U-FEED-1.
INSERT INTO release_notes (id, version, title, body, severity, published_at)
VALUES
    (
        gen_random_uuid()::text,
        'Sprint 4 Wave 2 Chat L',
        '列表新模式与行内交互上线',
        E'本次升级带来以下改进:\n\n' ||
        E'- **列表视图 5 模式切换**: 表格 / 卡片 / 看板 / 时间线 / 日历 (后两者 Sprint 5 完善)\n' ||
        E'- **创建对话框 4 模式**: 普通 / 一维快速 / 二维表格 / BOM 展开\n' ||
        E'- **行内 7 图标工具**: 复制 / 标记 / 锁定 / 转发 / 打印 / 删除 / 审计\n' ||
        E'- **5 色行标**: 红 / 橙 / 黄 / 绿 / 蓝 标记重要单据\n' ||
        E'- **应用内升级日志**: 你正在看的这个就是 :)\n\n' ||
        E'当前覆盖: 销售订单 + 采购订单列表。其他模块 Sprint 5 跟进。',
        'info',
        CURRENT_DATE
    )
ON CONFLICT DO NOTHING;
