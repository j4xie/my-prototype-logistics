-- 更新 PlatformRole 枚举，添加 system_developer
ALTER TABLE platform_admins 
MODIFY COLUMN role ENUM('platform_super_admin', 'platform_operator', 'system_developer') 
DEFAULT 'platform_operator';