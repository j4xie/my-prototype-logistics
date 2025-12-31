-- 创建设备注册表
-- 用于存储用户设备的推送通知 Token

CREATE TABLE IF NOT EXISTS device_registrations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
    push_token VARCHAR(255) NOT NULL UNIQUE COMMENT 'Expo Push Token',
    device_id VARCHAR(100) NOT NULL COMMENT '设备唯一标识符',
    platform VARCHAR(20) NOT NULL COMMENT '平台类型 (ios/android)',
    device_name VARCHAR(100) COMMENT '设备名称',
    device_model VARCHAR(100) COMMENT '设备型号',
    os_version VARCHAR(50) COMMENT '操作系统版本',
    app_version VARCHAR(50) COMMENT '应用版本',
    last_active_at DATETIME COMMENT '最后活跃时间',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否启用推送',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at DATETIME COMMENT '软删除时间',

    -- 唯一约束：同一工厂的同一设备只能注册一次
    UNIQUE KEY uk_device_factory (device_id, factory_id),

    -- 索引
    INDEX idx_user_id (user_id),
    INDEX idx_factory_id (factory_id),
    INDEX idx_push_token (push_token),
    INDEX idx_last_active (last_active_at),

    -- 外键
    CONSTRAINT fk_device_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='设备注册表';
