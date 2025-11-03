# 服务器500错误修复指南

## 当前状态

**服务器**: `http://139.196.165.140:10010`
**错误**: 所有登录请求返回 `500 - 系统内部错误`

```json
{
    "code": 500,
    "message": "系统内部错误，请联系管理员",
    "data": null,
    "timestamp": "2025-11-03T10:44:53.178094095",
    "success": false
}
```

---

## 问题诊断步骤

### 步骤1: 查看后端日志（最重要！）

SSH登录服务器后执行：

```bash
# 查看最新的错误日志
tail -100 /www/wwwroot/cretas/cretas-backend.log

# 实时查看日志
tail -f /www/wwwroot/cretas/cretas-backend.log

# 过滤500错误相关日志
tail -200 /www/wwwroot/cretas/cretas-backend.log | grep -E "(ERROR|Exception|500)"

# 查找数据库相关错误
tail -200 /www/wwwroot/cretas/cretas-backend.log | grep -E "(MySQL|Connection|SQLException)"
```

**常见错误信息**:
- `Connection refused` - 数据库连接失败
- `Table doesn't exist` - 表不存在或SQL未完全执行
- `Duplicate entry` - 重复的主键（SQL执行了一部分）
- `Foreign key constraint fails` - 外键约束失败

---

## 可能的原因和解决方案

### 原因1: 数据库连接失败 ⭐ 最有可能

**症状**:
- 所有API都返回500
- 之前是400错误，执行SQL后变成500

**检查方法**:
```bash
# 1. 检查MySQL是否运行
systemctl status mysql
# 或
service mysql status

# 2. 检查MySQL端口
netstat -tuln | grep 3306

# 3. 测试MySQL连接
mysql -u root -p
```

**解决方案**:
```bash
# 如果MySQL未运行，启动它
systemctl start mysql
# 或
service mysql start

# 重启Spring Boot应用
cd /www/wwwroot/cretas
bash restart.sh
```

---

### 原因2: SQL执行不完整或出错

**症状**:
- SQL只执行了一部分
- 表结构不完整
- 数据插入失败

**检查方法**:
```bash
# 登录MySQL
mysql -u root -p

# 检查数据库和表
USE cretas;
SHOW TABLES;

# 检查关键表是否存在
DESCRIBE factories;
DESCRIBE users;
DESCRIBE platform_admins;
DESCRIBE user_whitelist;

# 检查是否有数据
SELECT COUNT(*) FROM factories;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM platform_admins;
```

**解决方案A: 重新执行SQL**

如果表存在但数据不完整：
```sql
-- 1. 清理可能的残留数据
DELETE FROM users WHERE factory_id = 'F001';
DELETE FROM factories WHERE id = 'F001';
DELETE FROM user_whitelist WHERE factory_id = 'F001';
DELETE FROM platform_admins WHERE username IN ('admin', 'developer', 'platform_admin');

-- 2. 重新执行SQL
SOURCE /www/wwwroot/cretas/init-final-users.sql;

-- 3. 验证数据
SELECT id, username, factory_id, role_code FROM users;
SELECT id, name FROM factories WHERE id = 'F001';
```

**解决方案B: 表不存在 - 运行完整建表SQL**

如果核心表不存在，需要先运行Prisma migrations或建表SQL：
```bash
# 如果有Prisma Schema，运行migrations
cd /www/wwwroot/cretas
# （需要有package.json和prisma配置）

# 或者需要完整的建表SQL文件
```

---

### 原因3: Spring Boot配置问题

**症状**:
- 数据库连接配置错误
- application.properties配置不正确

**检查配置文件**:
```bash
# 查找配置文件
find /www/wwwroot/cretas -name "application*.properties" -o -name "application*.yml"

# 查看配置
cat /www/wwwroot/cretas/application.properties
```

**关键配置检查**:
```properties
# 数据库配置
spring.datasource.url=jdbc:mysql://localhost:3306/cretas?useSSL=false&serverTimezone=UTC
spring.datasource.username=root
spring.datasource.password=YOUR_PASSWORD

# JPA配置
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
```

**如果配置错误**:
- 修正数据库连接信息
- 重启Spring Boot应用

---

### 原因4: Spring Boot应用崩溃

**症状**:
- 进程不存在或异常
- 内存溢出

**检查进程**:
```bash
# 检查Java进程
ps aux | grep cretas-backend-system

# 检查端口
netstat -tuln | grep 10010
```

**解决方案**:
```bash
# 重启应用
cd /www/wwwroot/cretas
bash restart.sh

# 或手动重启
ps aux | grep cretas-backend-system | grep -v grep | awk '{print $2}' | xargs -r kill -9
sleep 2
nohup java -jar cretas-backend-system-1.0.0.jar --server.port=10010 > cretas-backend.log 2>&1 &

# 查看启动日志
tail -f /www/wwwroot/cretas/cretas-backend.log
```

---

## 完整修复流程

### 方案1: 快速修复（推荐先尝试）

```bash
# 1. SSH登录
ssh root@139.196.165.140

# 2. 检查MySQL
systemctl status mysql

# 3. 如果MySQL未运行
systemctl start mysql

# 4. 重启Spring Boot
cd /www/wwwroot/cretas
bash restart.sh

# 5. 等待10秒后测试
sleep 10
curl -X POST "http://localhost:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"proc_admin","password":"123456","factoryId":"F001"}'
```

### 方案2: 完整诊断和修复

```bash
# 1. SSH登录
ssh root@139.196.165.140

# 2. 查看错误日志
tail -100 /www/wwwroot/cretas/cretas-backend.log

# 3. 根据错误信息采取行动：

# 如果是数据库连接错误：
systemctl start mysql
cd /www/wwwroot/cretas
bash restart.sh

# 如果是表不存在：
mysql -u root -p
USE cretas;
SHOW TABLES;
# 根据结果决定是否需要运行建表SQL

# 如果是数据不完整：
mysql -u root -p
USE cretas;
SOURCE /www/wwwroot/cretas/init-final-users.sql;
EXIT;

# 重启应用
cd /www/wwwroot/cretas
bash restart.sh

# 4. 验证修复
tail -f /www/wwwroot/cretas/cretas-backend.log
# 等待看到 "Started Application" 之类的成功启动信息

# 5. 测试API
curl -X POST "http://localhost:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"proc_admin","password":"123456","factoryId":"F001"}'
```

---

## 验证修复成功

修复后，应该看到以下结果：

### 1. 后端日志正常
```
Started Application in X.XXX seconds
Tomcat started on port(s): 10010 (http)
```

### 2. 登录API返回成功
```bash
curl -X POST "http://139.196.165.140:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"proc_admin","password":"123456","factoryId":"F001"}'
```

**期望响应**:
```json
{
    "code": 200,
    "message": "登录成功",
    "data": {
        "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "refreshToken": "...",
        "user": {
            "id": 1,
            "username": "proc_admin",
            "fullName": "加工管理员",
            "roleCode": "department_admin",
            "department": "processing"
        }
    },
    "success": true
}
```

### 3. Dashboard API正常
```bash
# 使用获取的token测试
bash /path/to/test_server_106.sh
```

应该看到Dashboard数据（即使是空数据也说明API正常）。

---

## 如果仍然失败

### 检查清单

- [ ] MySQL服务运行中
- [ ] MySQL端口3306可访问
- [ ] 数据库 `cretas` 存在
- [ ] 核心表存在（factories, users, platform_admins）
- [ ] 测试数据已插入
- [ ] Spring Boot应用运行中
- [ ] 端口10010可访问
- [ ] 后端日志无ERROR

### 获取帮助信息

收集以下信息用于进一步诊断：

```bash
# 1. MySQL状态
systemctl status mysql

# 2. Java进程
ps aux | grep cretas-backend-system

# 3. 端口监听
netstat -tuln | grep -E "(3306|10010)"

# 4. 最新日志
tail -100 /www/wwwroot/cretas/cretas-backend.log

# 5. 数据库表信息
mysql -u root -p -e "USE cretas; SHOW TABLES; SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM factories;"
```

---

## 常见错误信息对照表

| 错误信息 | 可能原因 | 解决方案 |
|---------|---------|---------|
| `Connection refused` | MySQL未启动 | `systemctl start mysql` |
| `Access denied for user` | 数据库密码错误 | 检查application.properties配置 |
| `Unknown database 'cretas'` | 数据库不存在 | `CREATE DATABASE cretas;` |
| `Table 'cretas.users' doesn't exist` | 表未创建 | 运行建表SQL或Prisma migrations |
| `Duplicate entry 'F001' for key 'PRIMARY'` | 重复插入数据 | 先DELETE再INSERT |
| `Cannot add or update a child row` | 外键约束失败 | 确保按正确顺序插入数据 |

---

**最后更新**: 2025-11-03
**当前状态**: 服务器返回500错误，需要查看日志诊断
**下一步**: SSH登录服务器查看 `/www/wwwroot/cretas/cretas-backend.log`
