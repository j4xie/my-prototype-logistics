-- 添加 platform_admins 表的 role 列
ALTER TABLE platform_admins 
ADD COLUMN role ENUM('platform_super_admin', 'platform_operator') 
NOT NULL DEFAULT 'platform_operator' 
AFTER full_name;

-- 创建索引
CREATE INDEX idx_platform_role ON platform_admins(role);