-- Migration: Create tables for NVR video analysis, worker tracking, and scene understanding
-- Database: PostgreSQL (smartbi_db)
-- Date: 2026-01-30
-- Description: Phase 3 (Recording Analysis), Phase 6 (Cross-camera Tracking), Phase 7 (Scene Understanding)

-- =====================================================================
-- Table 1: worker_tracking_features
-- Stores VL-extracted full-body features for cross-camera worker tracking
-- =====================================================================
CREATE TABLE IF NOT EXISTS worker_tracking_features (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(20) NOT NULL,
    tracking_id VARCHAR(36) NOT NULL UNIQUE,
    worker_id BIGINT NULL,

    -- VL 模型提取的多维度特征
    badge_number VARCHAR(20) NULL,
    clothing_upper VARCHAR(100) NULL,
    clothing_lower VARCHAR(100) NULL,
    body_type VARCHAR(20) NULL,
    height_estimate VARCHAR(20) NULL,
    safety_gear JSONB NULL,

    -- 位置和时间信息
    last_seen_camera VARCHAR(36) NULL,
    last_seen_time TIMESTAMP NULL,
    first_seen_time TIMESTAMP NULL,
    total_sightings INT DEFAULT 0,

    -- 置信度
    feature_confidence DECIMAL(5,2) DEFAULT 0.00,

    -- 审计字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Indexes for worker_tracking_features
CREATE INDEX IF NOT EXISTS idx_wtf_factory_id ON worker_tracking_features(factory_id);
CREATE INDEX IF NOT EXISTS idx_wtf_tracking_id ON worker_tracking_features(tracking_id);
CREATE INDEX IF NOT EXISTS idx_wtf_worker_id ON worker_tracking_features(worker_id);
CREATE INDEX IF NOT EXISTS idx_wtf_badge_number ON worker_tracking_features(badge_number);
CREATE INDEX IF NOT EXISTS idx_wtf_last_seen_camera ON worker_tracking_features(last_seen_camera);
CREATE INDEX IF NOT EXISTS idx_wtf_last_seen_time ON worker_tracking_features(last_seen_time);

COMMENT ON TABLE worker_tracking_features IS '工人追踪特征表 - 存储 VL 模型提取的全身特征';


-- =====================================================================
-- Table 2: worker_trajectory
-- Stores worker movement history across cameras
-- =====================================================================
CREATE TABLE IF NOT EXISTS worker_trajectory (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(20) NOT NULL,
    tracking_id VARCHAR(36) NOT NULL REFERENCES worker_tracking_features(tracking_id) ON DELETE CASCADE,
    camera_id VARCHAR(36) NOT NULL,

    -- 时间信息
    enter_time TIMESTAMP NOT NULL,
    exit_time TIMESTAMP NULL,

    -- 位置和动作
    position_in_frame VARCHAR(50) NULL,
    action_description VARCHAR(200) NULL,

    -- 置信度和快照
    confidence DECIMAL(5,2) DEFAULT 0.00,
    snapshot_url VARCHAR(500) NULL,

    -- 审计字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for worker_trajectory
CREATE INDEX IF NOT EXISTS idx_wt_factory_id ON worker_trajectory(factory_id);
CREATE INDEX IF NOT EXISTS idx_wt_tracking_id ON worker_trajectory(tracking_id);
CREATE INDEX IF NOT EXISTS idx_wt_camera_id ON worker_trajectory(camera_id);
CREATE INDEX IF NOT EXISTS idx_wt_enter_time ON worker_trajectory(enter_time);

COMMENT ON TABLE worker_trajectory IS '工人轨迹表 - 记录工人在各摄像头之间的移动';


-- =====================================================================
-- Table 3: camera_topology
-- Stores spatial relationships between cameras
-- =====================================================================
CREATE TABLE IF NOT EXISTS camera_topology (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(20) NOT NULL,
    camera_a_id VARCHAR(36) NOT NULL,
    camera_b_id VARCHAR(36) NOT NULL,

    -- 拓扑信息
    transition_time_seconds INT DEFAULT 30,
    direction VARCHAR(20) DEFAULT 'BIDIRECTIONAL',
    distance_meters DECIMAL(10,2) NULL,
    path_description VARCHAR(200) NULL,

    -- 审计字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    UNIQUE (factory_id, camera_a_id, camera_b_id)
);

-- Indexes for camera_topology
CREATE INDEX IF NOT EXISTS idx_ct_factory_id ON camera_topology(factory_id);
CREATE INDEX IF NOT EXISTS idx_ct_camera_a ON camera_topology(camera_a_id);
CREATE INDEX IF NOT EXISTS idx_ct_camera_b ON camera_topology(camera_b_id);

COMMENT ON TABLE camera_topology IS '摄像头拓扑关系表 - 定义摄像头之间的空间关系';


-- =====================================================================
-- Table 4: camera_scene_understanding
-- Stores LLM-generated scene descriptions
-- =====================================================================
CREATE TABLE IF NOT EXISTS camera_scene_understanding (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(20) NOT NULL,
    camera_id VARCHAR(36) NOT NULL,

    -- LLM 动态生成的场景理解
    scene_description TEXT NULL,
    detected_equipment JSONB NULL,
    detected_workstations JSONB NULL,
    detected_zones JSONB NULL,
    workflow_understanding TEXT NULL,

    -- 参考帧
    reference_frame_url VARCHAR(500) NULL,

    -- 状态和置信度
    confidence DECIMAL(5,2) DEFAULT 0.00,
    is_current BOOLEAN DEFAULT TRUE,

    -- 时间信息
    captured_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for camera_scene_understanding
CREATE INDEX IF NOT EXISTS idx_csu_factory_id ON camera_scene_understanding(factory_id);
CREATE INDEX IF NOT EXISTS idx_csu_camera_id ON camera_scene_understanding(camera_id);
CREATE INDEX IF NOT EXISTS idx_csu_is_current ON camera_scene_understanding(is_current);
CREATE INDEX IF NOT EXISTS idx_csu_captured_at ON camera_scene_understanding(captured_at);

COMMENT ON TABLE camera_scene_understanding IS '摄像头场景理解表 - 存储 LLM 生成的场景分析';


-- =====================================================================
-- Table 5: scene_change_history
-- Stores detected scene changes
-- =====================================================================
CREATE TABLE IF NOT EXISTS scene_change_history (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(20) NOT NULL,
    camera_id VARCHAR(36) NOT NULL,

    -- LLM 分析结果
    change_summary TEXT NULL,
    change_details JSONB NULL,
    impact_assessment TEXT NULL,
    impact_level VARCHAR(20) DEFAULT 'low',
    suggested_actions JSONB NULL,

    -- 状态
    change_confidence DECIMAL(5,2) DEFAULT 0.00,
    applied BOOLEAN DEFAULT FALSE,
    applied_at TIMESTAMP NULL,
    reviewed_by BIGINT NULL,

    -- 时间信息
    detected_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for scene_change_history
CREATE INDEX IF NOT EXISTS idx_sch_factory_id ON scene_change_history(factory_id);
CREATE INDEX IF NOT EXISTS idx_sch_camera_id ON scene_change_history(camera_id);
CREATE INDEX IF NOT EXISTS idx_sch_applied ON scene_change_history(applied);
CREATE INDEX IF NOT EXISTS idx_sch_impact_level ON scene_change_history(impact_level);
CREATE INDEX IF NOT EXISTS idx_sch_detected_at ON scene_change_history(detected_at);

COMMENT ON TABLE scene_change_history IS '场景变化历史表 - 记录 LLM 检测到的场景变化';


-- =====================================================================
-- Table 6: recording_analysis_tasks
-- Stores NVR recording analysis task status
-- =====================================================================
CREATE TABLE IF NOT EXISTS recording_analysis_tasks (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(20) NOT NULL,

    -- 录像信息
    playback_url VARCHAR(500) NOT NULL,
    device_id VARCHAR(36) NULL,
    channel_id INT NULL,
    camera_id VARCHAR(36) NULL,
    location VARCHAR(100) NULL,

    -- 分析配置
    analysis_types JSONB NULL,
    sample_interval_seconds INT DEFAULT 60,
    max_frames INT DEFAULT 100,
    auto_submit BOOLEAN DEFAULT TRUE,

    -- 任务状态
    status VARCHAR(20) DEFAULT 'pending',

    -- 进度信息
    total_frames INT DEFAULT 0,
    analyzed_frames INT DEFAULT 0,
    skipped_frames INT DEFAULT 0,
    failed_frames INT DEFAULT 0,
    progress_percent DECIMAL(5,2) DEFAULT 0.00,

    -- 结果
    summary JSONB NULL,
    error_message TEXT NULL,

    -- 时间信息
    start_time VARCHAR(30) NULL,
    end_time VARCHAR(30) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL
);

-- Indexes for recording_analysis_tasks
CREATE INDEX IF NOT EXISTS idx_rat_factory_id ON recording_analysis_tasks(factory_id);
CREATE INDEX IF NOT EXISTS idx_rat_status ON recording_analysis_tasks(status);
CREATE INDEX IF NOT EXISTS idx_rat_created_at ON recording_analysis_tasks(created_at);

COMMENT ON TABLE recording_analysis_tasks IS '录像分析任务表 - 记录 NVR 历史录像分析任务';


-- =====================================================================
-- Table 7: efficiency_cost_records
-- Stores API call cost tracking
-- =====================================================================
CREATE TABLE IF NOT EXISTS efficiency_cost_records (
    id BIGSERIAL PRIMARY KEY,
    factory_id VARCHAR(20) NULL,

    -- 调用信息
    model_name VARCHAR(50) NOT NULL,
    analysis_type VARCHAR(30) NULL,
    camera_id VARCHAR(36) NULL,

    -- Token 和成本
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    total_tokens INT DEFAULT 0,
    cost_rmb DECIMAL(10,4) DEFAULT 0.0000,

    -- 优化信息
    skipped_by_preprocess BOOLEAN DEFAULT FALSE,
    optimization_mode VARCHAR(20) NULL,

    -- 时间
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficiency_cost_records
CREATE INDEX IF NOT EXISTS idx_ecr_factory_id ON efficiency_cost_records(factory_id);
CREATE INDEX IF NOT EXISTS idx_ecr_model_name ON efficiency_cost_records(model_name);
CREATE INDEX IF NOT EXISTS idx_ecr_recorded_at ON efficiency_cost_records(recorded_at);
CREATE INDEX IF NOT EXISTS idx_ecr_optimization_mode ON efficiency_cost_records(optimization_mode);

COMMENT ON TABLE efficiency_cost_records IS '效率分析成本记录表 - 记录 API 调用成本';


-- =====================================================================
-- Verification
-- =====================================================================
SELECT 'PostgreSQL tables created successfully' AS info;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'worker_tracking_features',
    'worker_trajectory',
    'camera_topology',
    'camera_scene_understanding',
    'scene_change_history',
    'recording_analysis_tasks',
    'efficiency_cost_records'
);
