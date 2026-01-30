-- Migration: Create tables for NVR video analysis, worker tracking, and scene understanding
-- Date: 2026-01-30
-- Description: Phase 3 (Recording Analysis), Phase 6 (Cross-camera Tracking), Phase 7 (Scene Understanding)

-- =====================================================================
-- Table 1: worker_tracking_features
-- Stores VL-extracted full-body features for cross-camera worker tracking
-- =====================================================================
CREATE TABLE IF NOT EXISTS worker_tracking_features (
    id VARCHAR(36) PRIMARY KEY COMMENT '主键 UUID',
    factory_id VARCHAR(20) NOT NULL COMMENT '工厂ID',
    tracking_id VARCHAR(36) NOT NULL COMMENT '临时追踪ID',
    worker_id BIGINT NULL COMMENT '关联的系统工人ID（如已确认）',

    -- VL 模型提取的多维度特征
    badge_number VARCHAR(20) NULL COMMENT '工牌编号（如识别到）',
    clothing_upper VARCHAR(100) NULL COMMENT '上衣颜色/样式描述',
    clothing_lower VARCHAR(100) NULL COMMENT '下装颜色/样式描述',
    body_type VARCHAR(20) NULL COMMENT '体型: THIN/MEDIUM/HEAVY',
    height_estimate VARCHAR(20) NULL COMMENT '身高估计: SHORT/MEDIUM/TALL',
    safety_gear JSON NULL COMMENT '安全装备详情 JSON',

    -- 位置和时间信息
    last_seen_camera VARCHAR(36) NULL COMMENT '最后出现的摄像头ID',
    last_seen_time DATETIME NULL COMMENT '最后出现时间',
    first_seen_time DATETIME NULL COMMENT '首次出现时间',
    total_sightings INT DEFAULT 0 COMMENT '总出现次数',

    -- 置信度
    feature_confidence DECIMAL(5,2) DEFAULT 0.00 COMMENT '特征提取置信度',

    -- 审计字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at DATETIME NULL COMMENT '软删除时间',

    INDEX idx_factory_id (factory_id),
    INDEX idx_tracking_id (tracking_id),
    INDEX idx_worker_id (worker_id),
    INDEX idx_badge_number (badge_number),
    INDEX idx_last_seen_camera (last_seen_camera),
    INDEX idx_last_seen_time (last_seen_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='工人追踪特征表 - 存储 VL 模型提取的全身特征';


-- =====================================================================
-- Table 2: worker_trajectory
-- Stores worker movement history across cameras
-- =====================================================================
CREATE TABLE IF NOT EXISTS worker_trajectory (
    id VARCHAR(36) PRIMARY KEY COMMENT '主键 UUID',
    factory_id VARCHAR(20) NOT NULL COMMENT '工厂ID',
    tracking_id VARCHAR(36) NOT NULL COMMENT '关联 tracking_features',
    camera_id VARCHAR(36) NOT NULL COMMENT '摄像头ID',

    -- 时间信息
    enter_time DATETIME NOT NULL COMMENT '进入摄像头视野时间',
    exit_time DATETIME NULL COMMENT '离开摄像头视野时间',

    -- 位置和动作
    position_in_frame VARCHAR(50) NULL COMMENT '在画面中的位置',
    action_description VARCHAR(200) NULL COMMENT '动作描述',

    -- 置信度和快照
    confidence DECIMAL(5,2) DEFAULT 0.00 COMMENT '识别置信度',
    snapshot_url VARCHAR(500) NULL COMMENT '快照图片URL',

    -- 审计字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    INDEX idx_factory_id (factory_id),
    INDEX idx_tracking_id (tracking_id),
    INDEX idx_camera_id (camera_id),
    INDEX idx_enter_time (enter_time),
    FOREIGN KEY (tracking_id) REFERENCES worker_tracking_features(tracking_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='工人轨迹表 - 记录工人在各摄像头之间的移动';


-- =====================================================================
-- Table 3: camera_topology
-- Stores spatial relationships between cameras
-- =====================================================================
CREATE TABLE IF NOT EXISTS camera_topology (
    id VARCHAR(36) PRIMARY KEY COMMENT '主键 UUID',
    factory_id VARCHAR(20) NOT NULL COMMENT '工厂ID',
    camera_a_id VARCHAR(36) NOT NULL COMMENT '摄像头A的ID',
    camera_b_id VARCHAR(36) NOT NULL COMMENT '摄像头B的ID',

    -- 拓扑信息
    transition_time_seconds INT DEFAULT 30 COMMENT '两摄像头之间的典型移动时间（秒）',
    direction VARCHAR(20) DEFAULT 'BIDIRECTIONAL' COMMENT '方向: A_TO_B / B_TO_A / BIDIRECTIONAL',
    distance_meters DECIMAL(10,2) NULL COMMENT '两摄像头之间的距离（米）',
    path_description VARCHAR(200) NULL COMMENT '路径描述',

    -- 审计字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at DATETIME NULL COMMENT '软删除时间',

    INDEX idx_factory_id (factory_id),
    INDEX idx_camera_a (camera_a_id),
    INDEX idx_camera_b (camera_b_id),
    UNIQUE KEY uk_camera_pair (factory_id, camera_a_id, camera_b_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='摄像头拓扑关系表 - 定义摄像头之间的空间关系';


-- =====================================================================
-- Table 4: camera_scene_understanding
-- Stores LLM-generated scene descriptions
-- =====================================================================
CREATE TABLE IF NOT EXISTS camera_scene_understanding (
    id VARCHAR(36) PRIMARY KEY COMMENT '主键 UUID',
    factory_id VARCHAR(20) NOT NULL COMMENT '工厂ID',
    camera_id VARCHAR(36) NOT NULL COMMENT '摄像头ID',

    -- LLM 动态生成的场景理解
    scene_description TEXT NULL COMMENT '场景自然语言描述',
    detected_equipment JSON NULL COMMENT '识别到的设备列表',
    detected_workstations JSON NULL COMMENT '识别到的工位',
    detected_zones JSON NULL COMMENT '识别到的区域划分',
    workflow_understanding TEXT NULL COMMENT '工作流理解',

    -- 参考帧
    reference_frame_url VARCHAR(500) NULL COMMENT '参考图片URL',

    -- 状态和置信度
    confidence DECIMAL(5,2) DEFAULT 0.00 COMMENT '场景理解置信度',
    is_current BOOLEAN DEFAULT TRUE COMMENT '是否为当前有效的理解',

    -- 时间信息
    captured_at DATETIME NOT NULL COMMENT '场景捕获时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_factory_id (factory_id),
    INDEX idx_camera_id (camera_id),
    INDEX idx_is_current (is_current),
    INDEX idx_captured_at (captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='摄像头场景理解表 - 存储 LLM 生成的场景分析';


-- =====================================================================
-- Table 5: scene_change_history
-- Stores detected scene changes
-- =====================================================================
CREATE TABLE IF NOT EXISTS scene_change_history (
    id VARCHAR(36) PRIMARY KEY COMMENT '主键 UUID',
    factory_id VARCHAR(20) NOT NULL COMMENT '工厂ID',
    camera_id VARCHAR(36) NOT NULL COMMENT '摄像头ID',

    -- LLM 分析结果
    change_summary TEXT NULL COMMENT '变化摘要（自然语言）',
    change_details JSON NULL COMMENT '详细变化列表',
    impact_assessment TEXT NULL COMMENT '影响评估',
    impact_level VARCHAR(20) DEFAULT 'low' COMMENT '影响级别: low/medium/high/critical',
    suggested_actions JSON NULL COMMENT 'LLM 建议的操作',

    -- 状态
    change_confidence DECIMAL(5,2) DEFAULT 0.00 COMMENT '变化检测置信度',
    applied BOOLEAN DEFAULT FALSE COMMENT '是否已应用建议的变化',
    applied_at DATETIME NULL COMMENT '应用时间',
    reviewed_by BIGINT NULL COMMENT '审核人ID',

    -- 时间信息
    detected_at DATETIME NOT NULL COMMENT '检测时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    INDEX idx_factory_id (factory_id),
    INDEX idx_camera_id (camera_id),
    INDEX idx_applied (applied),
    INDEX idx_impact_level (impact_level),
    INDEX idx_detected_at (detected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='场景变化历史表 - 记录 LLM 检测到的场景变化';


-- =====================================================================
-- Table 6: recording_analysis_tasks
-- Stores NVR recording analysis task status
-- =====================================================================
CREATE TABLE IF NOT EXISTS recording_analysis_tasks (
    id VARCHAR(36) PRIMARY KEY COMMENT '任务ID',
    factory_id VARCHAR(20) NOT NULL COMMENT '工厂ID',

    -- 录像信息
    playback_url VARCHAR(500) NOT NULL COMMENT 'RTSP 回放地址',
    device_id VARCHAR(36) NULL COMMENT '设备ID',
    channel_id INT NULL COMMENT '通道ID',
    camera_id VARCHAR(36) NULL COMMENT '摄像头ID（用于数据归档）',
    location VARCHAR(100) NULL COMMENT '位置描述',

    -- 分析配置
    analysis_types JSON NULL COMMENT '分析类型列表: efficiency, ocr, counting',
    sample_interval_seconds INT DEFAULT 60 COMMENT '采样间隔（秒）',
    max_frames INT DEFAULT 100 COMMENT '最大分析帧数',
    auto_submit BOOLEAN DEFAULT TRUE COMMENT '是否自动提交结果',

    -- 任务状态
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态: pending/running/completed/failed/cancelled',

    -- 进度信息
    total_frames INT DEFAULT 0 COMMENT '总帧数',
    analyzed_frames INT DEFAULT 0 COMMENT '已分析帧数',
    skipped_frames INT DEFAULT 0 COMMENT '跳过帧数',
    failed_frames INT DEFAULT 0 COMMENT '失败帧数',
    progress_percent DECIMAL(5,2) DEFAULT 0.00 COMMENT '进度百分比',

    -- 结果
    summary JSON NULL COMMENT '分析结果摘要',
    error_message TEXT NULL COMMENT '错误信息',

    -- 时间信息
    start_time VARCHAR(30) NULL COMMENT '分析开始时间（录像时间）',
    end_time VARCHAR(30) NULL COMMENT '分析结束时间（录像时间）',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    started_at DATETIME NULL COMMENT '任务开始时间',
    completed_at DATETIME NULL COMMENT '任务完成时间',

    INDEX idx_factory_id (factory_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='录像分析任务表 - 记录 NVR 历史录像分析任务';


-- =====================================================================
-- Table 7: efficiency_cost_records
-- Stores API call cost tracking
-- =====================================================================
CREATE TABLE IF NOT EXISTS efficiency_cost_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    factory_id VARCHAR(20) NULL COMMENT '工厂ID',

    -- 调用信息
    model_name VARCHAR(50) NOT NULL COMMENT '模型名称',
    analysis_type VARCHAR(30) NULL COMMENT '分析类型',
    camera_id VARCHAR(36) NULL COMMENT '摄像头ID',

    -- Token 和成本
    input_tokens INT DEFAULT 0 COMMENT '输入 Token 数',
    output_tokens INT DEFAULT 0 COMMENT '输出 Token 数',
    total_tokens INT DEFAULT 0 COMMENT '总 Token 数',
    cost_rmb DECIMAL(10,4) DEFAULT 0.0000 COMMENT '成本（人民币）',

    -- 优化信息
    skipped_by_preprocess BOOLEAN DEFAULT FALSE COMMENT '是否被本地预处理跳过',
    optimization_mode VARCHAR(20) NULL COMMENT '优化模式: economy/balanced/performance',

    -- 时间
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',

    INDEX idx_factory_id (factory_id),
    INDEX idx_model_name (model_name),
    INDEX idx_recorded_at (recorded_at),
    INDEX idx_optimization_mode (optimization_mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='效率分析成本记录表 - 记录 API 调用成本';


-- =====================================================================
-- Verification queries
-- =====================================================================
SELECT 'Tables created successfully:' AS info;
SHOW TABLES LIKE '%tracking%';
SHOW TABLES LIKE '%scene%';
SHOW TABLES LIKE '%recording%';
SHOW TABLES LIKE '%cost%';
SHOW TABLES LIKE '%topology%';
