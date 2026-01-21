-- =============================================================================
-- Migration: V2_0__recommendation_upgrade.sql
-- Description: Recommendation system upgrade - User clustering and behavior tracking
-- Author: System
-- Date: 2026-01-19
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. User Clusters Table
-- Purpose: Store cluster definitions for user segmentation (K-Means)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_clusters (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cluster_name VARCHAR(64) COMMENT '聚类名称，如"火锅店采购"',
    description TEXT COMMENT '聚类描述',
    centroid_vector JSON COMMENT '质心向量 (16维)',
    member_count INT DEFAULT 0 COMMENT '成员数量',
    avg_distance DOUBLE COMMENT '聚类内平均距离',
    feature_labels JSON COMMENT '主要特征标签',
    recommend_categories JSON COMMENT '推荐品类',
    version INT DEFAULT 1 COMMENT '聚类版本号',
    active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
    last_cluster_time DATETIME COMMENT '最后聚类时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_version_active (version, active),
    INDEX idx_member_count (member_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户聚类表';

-- -----------------------------------------------------------------------------
-- 2. User Cluster Assignments Table
-- Purpose: Map users to their assigned clusters with membership scores
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_cluster_assignments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    wx_user_id VARCHAR(64) NOT NULL COMMENT '微信用户ID',
    cluster_id BIGINT NOT NULL COMMENT '聚类ID',
    feature_vector JSON COMMENT '用户特征向量 (16维)',
    distance_to_centroid DOUBLE COMMENT '到聚类中心的距离',
    confidence DOUBLE COMMENT '分配置信度 0-1',
    second_nearest_cluster_id BIGINT COMMENT '次近聚类ID',
    distance_to_second_nearest DOUBLE COMMENT '到次近聚类的距离',
    version INT DEFAULT 1 COMMENT '聚类版本号',
    boundary_user BOOLEAN DEFAULT FALSE COMMENT '是否边界用户',
    assignment_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '分配时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_wx_user_version (wx_user_id, version),
    INDEX idx_cluster_id (cluster_id),
    INDEX idx_confidence (confidence),
    INDEX idx_boundary_user (boundary_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户聚类分配表';

-- -----------------------------------------------------------------------------
-- 3. Add sequence_no column to user_behavior_events
-- Purpose: Track event sequence within a session for behavior analysis
-- -----------------------------------------------------------------------------
-- Check if column exists before adding (safe for re-runs)
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'user_behavior_events'
               AND COLUMN_NAME = 'sequence_no');

SET @sqlstmt := IF(@exist = 0,
    'ALTER TABLE user_behavior_events ADD COLUMN sequence_no INT DEFAULT 0 COMMENT ''会话内序号'' AFTER session_id',
    'SELECT ''Column sequence_no already exists''');

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create index for sequence queries (if not exists)
SET @exist_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
                   WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME = 'user_behavior_events'
                   AND INDEX_NAME = 'idx_session_sequence');

SET @sqlstmt := IF(@exist_idx = 0,
    'CREATE INDEX idx_session_sequence ON user_behavior_events(session_id, sequence_no)',
    'SELECT ''Index idx_session_sequence already exists''');

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================================================
-- End of Migration V2_0
-- =============================================================================
