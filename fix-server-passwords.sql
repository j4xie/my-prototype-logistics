-- 修复服务器上的用户密码
-- 将所有测试账号密码设置为 123456
-- BCrypt哈希值: $2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse

USE cretas_db;

-- 更新工厂用户表
UPDATE users SET password_hash = '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse'
WHERE username IN ('super_admin', 'dept_admin', 'operator1', 'testuser1', 'testuser2');

-- 更新平台管理员表
UPDATE platform_admins SET password_hash = '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse'
WHERE username = 'platform_admin';

-- 验证更新
SELECT '✅ 工厂用户密码已更新' AS Status;
SELECT username, LEFT(password_hash, 20) as password_hash_prefix FROM users WHERE username IN ('super_admin', 'dept_admin', 'operator1');

SELECT '✅ 平台管理员密码已更新' AS Status;
SELECT username, LEFT(password_hash, 20) as password_hash_prefix FROM platform_admins WHERE username = 'platform_admin';
