-- 更新所有 role_code 为 'developer' 的用户为 'factory_super_admin'
UPDATE users SET role_code = 'factory_super_admin' WHERE role_code = 'developer';

-- 查看更新结果
SELECT id, username, role_code, department FROM users WHERE username = 'developer';