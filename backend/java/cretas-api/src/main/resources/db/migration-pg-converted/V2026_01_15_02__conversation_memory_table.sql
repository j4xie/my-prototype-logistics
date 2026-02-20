-- ============================================
-- Converted from MySQL to PostgreSQL
-- Original file: V2026_01_15_02__conversation_memory_table.sql
-- Conversion date: 2026-01-26 18:48:30
-- WARNING: This file requires manual review!
-- ============================================

-- ============================================================
-- V2026_01_15_02: 对话记忆表
--
-- 功能: 对话上下文记忆服务
-- 特性:
--   - 实体槽位记忆（批次、供应商、客户等）
--   - 滑动窗口消息历史
--   - 对话摘要（长期记忆压缩）
--   - 用户偏好设置
--
-- 作者: Cretas Team
-- 日期: 2026-01-15
-- ============================================================

-- 创建对话记忆表
CREATE TABLE IF NOT EXISTS conversation_memory (
    -- 主键
    id BIGSERIAL NOT NULL PRIMARY KEY COMMENT '自增ID',

    -- 基础信息
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    session_id VARCHAR(36) NOT NULL COMMENT '会话ID (UUID)',

    -- 实体槽位 (JSON)
    -- 格式: {"BATCH": {"type": "BATCH", "id": "...", "name": "...", ...}, ...}
    entity_slots JSON COMMENT '实体槽位数据',

    -- 最近消息 (JSON)
    -- 格式: [{"role": "user/assistant", "content": "...", "timestamp": "...", ...}]
    recent_messages JSON COMMENT '最近消息列表 (滑动窗口)',

    -- 对话摘要
    conversation_summary TEXT COMMENT '对话摘要 (LLM生成)',
    summary_updated_at TIMESTAMP WITH TIME ZONE COMMENT '摘要最后更新时间',

    -- 用户偏好 (JSON)
    -- 格式: {"defaultTimeRange": "week", "favoriteQueries": [...]}
    user_preferences JSON COMMENT '用户偏好设置',

    -- 状态信息
    message_count INT DEFAULT 0 COMMENT '消息计数',
    last_intent_code VARCHAR(100) COMMENT '最后识别的意图代码',
    last_active_at TIMESTAMP WITH TIME ZONE COMMENT '最后活跃时间',

    -- 审计字段 (BaseEntity)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL COMMENT '软删除时间',

    -- 唯一约束
    UNIQUE KEY uk_cm_session_id (session_id),

    -- 索引
    INDEX idx_cm_factory_user (factory_id, user_id),
    INDEX idx_cm_last_active (last_active_at),
    INDEX idx_cm_deleted_at (deleted_at)
)
;

-- ============================================================
-- 说明:
--
-- 1. 实体槽位类型 (entity_slots):
--    - BATCH: 批次
--    - SUPPLIER: 供应商
--    - CUSTOMER: 客户
--    - PRODUCT: 产品
--    - TIME_RANGE: 时间范围
--    - WAREHOUSE: 仓库
--    - EQUIPMENT: 设备
--    - EMPLOYEE: 员工
--    - ORDER: 订单
--
-- 2. 实体槽位数据结构:
--    {
--      "type": "BATCH",
--      "id": "BATCH-001",
--      "name": "20260115-001",
--      "displayValue": "批次 20260115-001",
--      "metadata": {...},
--      "mentionedAt": "2026-01-15T10:00:00",
--      "mentionCount": 3
--    }
--
-- 3. 消息数据结构:
--    {
--      "role": "user" / "assistant",
--      "content": "消息内容",
--      "timestamp": "2026-01-15T10:00:00",
--      "intentCode": "BATCH_QUERY",
--      "metadata": {...}
--    }
--
-- 4. 指代消解映射:
--    - "这批"、"那批"、"该批次" -> BATCH 槽位
--    - "这家"、"那个供应商" -> SUPPLIER 槽位
--    - "这个客户"、"对方" -> CUSTOMER 槽位
--    - "这个产品"、"这种货" -> PRODUCT 槽位
--    - "那段时间"、"同期" -> TIME_RANGE 槽位
--    - "那个仓库"、"这里" -> WAREHOUSE 槽位
--
-- 5. 滑动窗口策略:
--    - 保留最近 6 轮原始消息 (12条)
--    - 超过阈值时触发摘要更新
--
-- 6. 摘要更新条件:
--    - messageCount > 10
--    - 距离上次摘要 > 5 条消息
--
-- ============================================================
