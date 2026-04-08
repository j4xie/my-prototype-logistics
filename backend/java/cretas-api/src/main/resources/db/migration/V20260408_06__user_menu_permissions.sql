-- P0-6 昆山六扇门: 用户级菜单权限覆盖 (role 默认之上的 GRANT/REVOKE)
CREATE TABLE IF NOT EXISTS user_menu_permissions (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    menu_code VARCHAR(128) NOT NULL,
    grant_type VARCHAR(16) NOT NULL,
    granted_by VARCHAR(64),
    remark VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP NULL,
    CONSTRAINT uk_user_menu UNIQUE (factory_id, user_id, menu_code)
);
CREATE INDEX IF NOT EXISTS idx_user_menu_perm_user ON user_menu_permissions(factory_id, user_id);
