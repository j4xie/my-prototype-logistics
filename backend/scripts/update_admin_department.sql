-- 更新所有 department 为 'admin' 的用户为 'management'
UPDATE users SET department = 'management' WHERE department = 'admin';

-- 查看更新结果
SELECT id, username, department, role_code FROM users WHERE username = 'factory_admin';