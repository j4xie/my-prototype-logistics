-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2025_12_30_1__create_notifications_table.sql
-- Conversion date: 2026-01-26 18:46:10
-- WARNING: This file requires manual review!
-- ============================================

-- 创建通知表
-- 用于存储调度预案、告警、系统消息等的 App 内推送通知

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY COMMENT '通知ID',
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    user_id BIGINT DEFAULT NULL COMMENT '目标用户ID，NULL表示发送给工厂所有用户',
    title VARCHAR(200) NOT NULL COMMENT '通知标题',
    content TEXT NOT NULL COMMENT '通知内容',
    type VARCHAR(20) NOT NULL DEFAULT 'INFO' COMMENT '通知类型：ALERT, INFO, WARNING, SUCCESS, SYSTEM',
    is_read BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否已读',
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL COMMENT '阅读时间',
    source VARCHAR(50) DEFAULT NULL COMMENT '来源：SCHEDULING, ALERT, BATCH, QUALITY, SYSTEM',
    source_id VARCHAR(100) DEFAULT NULL COMMENT '关联的业务ID（如调度计划ID、告警ID）',
    action_url VARCHAR(500) DEFAULT NULL COMMENT '点击跳转的URL',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL COMMENT '软删除时间',

    -- 索引
    INDEX idx_notification_factory (factory_id),
    INDEX idx_notification_user (user_id),
    INDEX idx_notification_read (is_read),
    INDEX idx_notification_type (type),
    INDEX idx_notification_source (source),
    INDEX idx_notification_created (created_at DESC),

    -- 外键约束
    CONSTRAINT fk_notification_factory FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE,
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
