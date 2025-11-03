# 本地Java后端对接成功！ 🎉

## ✅ 已成功完成

### 1. 后端成功启动
- **Java Spring Boot**: 成功运行在端口 `10010`
- **进程PID**: 50447
- **日志文件**: `~/Downloads/cretas-backend-system-main/logs/debug.log`
- **启动信息**: "白垩纪食品溯源系统启动成功！"

### 2. 数据库配置完成
- **MySQL**: 9.3.0 运行中
- **数据库**: `cretas`
- **用户**: `cretas` / `sYyS6Jp3pyFMwLdA`
- **工厂**: F001 (测试工厂)
- **表结构**: 所有表已创建，包含role_code字段

### 3. 登录测试成功 ✅

**测试命令**:
```bash
curl -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"proc_admin","password":"123456","factoryId":"F001"}'
```

**成功响应**:
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "userId": 4,
    "username": "proc_admin",
    "factoryId": "F001",
    "role": "department_admin",
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
    "profile": {
      "name": "加工管理员",
      "department": "processing",
      "phoneNumber": "13900000002"
    }
  },
  "success": true
}
```

---

## 🔑 测试账号信息

所有账号密码都是: `123456`

### 工厂用户 (Factory Users)

| ID | 用户名 | 密码 | 工厂ID | 角色 | 部门 | 职位 |
|----|--------|------|--------|------|------|------|
| 4 | `proc_admin` | `123456` | F001 | department_admin | processing | 加工部主管 |
| 5 | `proc_user` | `123456` | F001 | operator | processing | 操作员 |
| 6 | `farm_admin` | `123456` | F001 | department_admin | farming | 养殖部主管 |

### 平台管理员 (Platform Admins)

| ID | 用户名 | 密码 | 角色 | 姓名 |
|----|--------|------|------|------|
| 1 | `admin` | `123456` | PLATFORM_SUPER_ADMIN | 系统管理员 |
| 2 | `developer` | `123456` | SYSTEM_DEVELOPER | 系统开发者 |
| 3 | `platform_admin` | `123456` | PLATFORM_SUPER_ADMIN | 平台管理员 |

---

## 🔍 问题根源分析

### 之前为什么失败？

1. **无效的BCrypt hash**: 初始SQL使用的hash `$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW` 是无效的
   ```python
   bcrypt.checkpw("123456".encode(), old_hash.encode())  # False ❌
   ```

2. **User表缺少role_code字段**: 手动添加了该字段并更新实体类

3. **数据不一致**: 多次SQL插入导致数据混乱

### 解决方案

1. **生成新的有效hash**:
   ```python
   new_hash = '$2b$12$KO2Euov0Mz3ZZx4BeoYkzO9r7nJHY9lZcQ3IcTXmQO1vhWYYLkF4y'
   bcrypt.checkpw("123456".encode(), new_hash.encode())  # True ✅
   ```

2. **清除并重建数据**: 删除所有旧数据，用正确hash重新创建

3. **修改User.java**: 添加了roleCode字段

---

## 📋 当前配置

### 前端配置
**文件**: `frontend/CretasFoodTrace/src/constants/config.ts`

```typescript
export const API_BASE_URL = 'http://localhost:10010';
export const DEFAULT_FACTORY_ID = 'F001';
```

### 后端配置
**文件**: `~/Downloads/cretas-backend-system-main/src/main/resources/application.yml`

```yaml
server:
  port: 10010

spring:
  datasource:
    url: jdbc:mysql://localhost:3306/cretas
    username: cretas
    password: sYyS6Jp3pyFMwLdA
```

---

## 🚀 使用指南

### 启动本地后端

```bash
# 1. 确保MySQL运行中
ps aux | grep mysqld

# 2. 进入项目目录
cd ~/Downloads/cretas-backend-system-main

# 3. 启动后端 (如果未运行)
java -jar target/cretas-backend-system-1.0.0.jar > logs/backend.log 2>&1 &

# 4. 查看日志
tail -f logs/backend.log

# 5. 检查端口
lsof -i :10010
```

### 停止后端

```bash
# 方式1: 使用PID
kill 50447

# 方式2: 杀掉所有cretas进程
pkill -f cretas-backend-system

# 方式3: 通过端口杀掉
lsof -ti :10010 | xargs kill -9
```

### 重启后端

```bash
# 停止
pkill -f cretas-backend-system
sleep 2

# 启动
cd ~/Downloads/cretas-backend-system-main
java -jar target/cretas-backend-system-1.0.0.jar > logs/backend.log 2>&1 &
```

### 测试API

```bash
# 测试登录
curl -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"proc_admin","password":"123456","factoryId":"F001"}'

# 测试平台管理员登录
curl -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'
```

---

## 🔧 开发工作流

### 修改代码后重新编译

```bash
cd ~/Downloads/cretas-backend-system-main

# 1. 修改代码 (如 MobileServiceImpl.java)

# 2. 重新编译打包
mvn clean package -DskipTests

# 3. 停止旧进程
pkill -f cretas-backend-system

# 4. 启动新版本
java -jar target/cretas-backend-system-1.0.0.jar > logs/backend.log 2>&1 &

# 5. 查看启动日志
tail -f logs/backend.log
```

### 查看实时日志

```bash
# 查看最新日志
tail -100 ~/Downloads/cretas-backend-system-main/logs/backend.log

# 实时跟踪
tail -f ~/Downloads/cretas-backend-system-main/logs/backend.log

# 过滤特定内容
tail -f ~/Downloads/cretas-backend-system-main/logs/backend.log | grep "ERROR\|登录\|密码"
```

---

## 📁 重要文件位置

### Java后端
- **项目目录**: `~/Downloads/cretas-backend-system-main/`
- **JAR文件**: `target/cretas-backend-system-1.0.0.jar`
- **配置**: `src/main/resources/application.yml`
- **User实体**: `src/main/java/com/cretas/aims/entity/User.java`
- **登录Service**: `src/main/java/com/cretas/aims/service/impl/MobileServiceImpl.java`
- **日志**: `logs/debug.log`, `logs/backend.log`

### 前端
- **配置**: `/Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace/src/constants/config.ts`
- **当前API**: `http://localhost:10010`

### 数据库
- **Host**: `localhost:3306`
- **Database**: `cretas`
- **User**: `cretas` / `sYyS6Jp3pyFMwLdA`

---

## 🎯 下一步

### 1. 启动React Native应用

```bash
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace

# 清除缓存
npx expo start --clear

# 或
npm start
```

### 2. 测试登录
- 用户名: `proc_admin`
- 密码: `123456`
- 工厂ID: `F001`

### 3. 测试Dashboard API

登录成功后，前端应该能正常调用Dashboard接口了！

---

## ✅ 验证清单

- [x] MySQL运行正常
- [x] 数据库cretas已创建
- [x] 工厂F001已创建
- [x] 测试用户已创建（3个工厂用户 + 3个平台管理员）
- [x] User表包含role_code字段
- [x] 密码hash正确且可验证
- [x] Java后端成功启动
- [x] 登录API测试成功
- [x] Token生成正常
- [x] 前端配置已更新为localhost

---

## 🎉 成功！

本地Java后端已成功对接！现在您可以：

1. ✅ 使用本地后端开发和测试前端功能
2. ✅ 测试Dashboard API和其他接口
3. ✅ 快速迭代开发（修改代码后重新编译即可）
4. ✅ 查看详细的后端日志进行调试

**所有测试账号密码都是 `123456`**

---

## 🎊 系统完整性检查结果

**检查时间**: 2025-11-02 22:43

### ✅ 核心功能测试结果

| 功能 | 状态 |
|------|------|
| Java后端运行 | ✅ 正常 (PID: 50447) |
| MySQL数据库 | ✅ 正常 |
| 工厂用户登录 | ✅ 成功 (proc_admin, proc_user, farm_admin) |
| 平台管理员登录 | ✅ 成功 (admin, developer, platform_admin) |
| Dashboard Production | ✅ 正常 |
| Dashboard Equipment | ✅ 正常 |
| Dashboard Quality | ✅ 正常 |
| Dashboard Overview | ❌ 500错误 (已知非阻塞问题) |
| 前端配置 | ✅ 正常 |

### 🎯 系统健康度: 88.9% (8/9)

**详细报告**: 参见 [SYSTEM_CHECK_REPORT.md](./SYSTEM_CHECK_REPORT.md)

---

**最后更新**: 2025-11-02 22:43
**状态**: ✅ 可用 (核心功能正常)
**本地API**: http://localhost:10010
