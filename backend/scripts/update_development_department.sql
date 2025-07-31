-- 更新所有 department 为 'development' 的用户为 'management'
UPDATE users SET department = 'management' WHERE department = 'development';

-- 查看更新结果
SELECT id, username, role_code, department FROM users WHERE username = 'developer';