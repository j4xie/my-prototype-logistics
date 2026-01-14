-- 产线-车间主任关联表
-- 用于确定每条产线由哪个车间主任负责

CREATE TABLE IF NOT EXISTS production_line_supervisors (
    id VARCHAR(36) PRIMARY KEY,
    production_line_id VARCHAR(36) NOT NULL COMMENT '产线ID',
    supervisor_user_id BIGINT NOT NULL COMMENT '车间主任用户ID',
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    is_primary BOOLEAN DEFAULT TRUE COMMENT '是否为主要负责人',
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '分配时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_line_supervisor (production_line_id, supervisor_user_id),
    INDEX idx_factory_id (factory_id),
    INDEX idx_supervisor_id (supervisor_user_id),
    INDEX idx_line_id (production_line_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产线-车间主任关联表';

-- 给 line_schedules 表添加 supervisor_id 字段
ALTER TABLE line_schedules ADD COLUMN IF NOT EXISTS supervisor_id BIGINT COMMENT '负责的车间主任ID';
ALTER TABLE line_schedules ADD INDEX IF NOT EXISTS idx_supervisor_id (supervisor_id);
