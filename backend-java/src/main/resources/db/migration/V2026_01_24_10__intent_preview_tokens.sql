-- ============================================
-- 意图预览令牌表 - TCC (Try-Confirm-Cancel) 模式
-- 用于实现预览-确认机制，防止误操作
-- ============================================

CREATE TABLE IF NOT EXISTS intent_preview_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    -- 令牌值 (UUID)
    token VARCHAR(64) NOT NULL UNIQUE,

    -- 工厂和用户
    factory_id VARCHAR(50) NOT NULL,
    user_id BIGINT NOT NULL,
    username VARCHAR(100),

    -- 意图信息
    intent_code VARCHAR(100) NOT NULL,
    intent_name VARCHAR(200),

    -- 操作目标
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    operation VARCHAR(20),

    -- 预览数据 (JSON)
    preview_data TEXT,
    current_values TEXT,
    new_values TEXT,

    -- 状态: PENDING, CONFIRMED, CANCELLED, EXPIRED, FAILED
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    resolved_at DATETIME,

    -- 结果描述
    resolution_message VARCHAR(500),

    -- 客户端信息 (安全验证)
    client_info VARCHAR(200),

    -- 索引
    INDEX idx_ipt_token (token),
    INDEX idx_ipt_factory_user (factory_id, user_id),
    INDEX idx_ipt_status (status),
    INDEX idx_ipt_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='意图预览令牌表 - TCC模式支持';

-- 添加注释
ALTER TABLE intent_preview_tokens
    MODIFY COLUMN token VARCHAR(64) NOT NULL UNIQUE COMMENT '令牌值(UUID)',
    MODIFY COLUMN factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    MODIFY COLUMN user_id BIGINT NOT NULL COMMENT '用户ID',
    MODIFY COLUMN username VARCHAR(100) COMMENT '用户名',
    MODIFY COLUMN intent_code VARCHAR(100) NOT NULL COMMENT '意图代码',
    MODIFY COLUMN intent_name VARCHAR(200) COMMENT '意图名称',
    MODIFY COLUMN entity_type VARCHAR(50) COMMENT '实体类型',
    MODIFY COLUMN entity_id VARCHAR(100) COMMENT '实体ID',
    MODIFY COLUMN operation VARCHAR(20) COMMENT '操作类型(CREATE/UPDATE/DELETE)',
    MODIFY COLUMN preview_data TEXT COMMENT '预览数据JSON',
    MODIFY COLUMN current_values TEXT COMMENT '当前值快照JSON',
    MODIFY COLUMN new_values TEXT COMMENT '新值JSON',
    MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态',
    MODIFY COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    MODIFY COLUMN expires_at DATETIME NOT NULL COMMENT '过期时间',
    MODIFY COLUMN resolved_at DATETIME COMMENT '处理时间',
    MODIFY COLUMN resolution_message VARCHAR(500) COMMENT '处理结果描述',
    MODIFY COLUMN client_info VARCHAR(200) COMMENT '客户端信息';
