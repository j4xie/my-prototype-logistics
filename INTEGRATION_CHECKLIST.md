# 🎯 认证系统对接检查清单

**最后更新**: 2025-11-22 03:02
**对接状态**: ✅ 已完成 (需要服务器密码更新)

---

## 📋 前端配置 (✅ 完成)

- [x] API基础地址配置
  - 文件：`src/constants/config.ts`
  - 地址：`http://139.196.165.140:10010` (生产)
  - 状态：✅ 已配置

- [x] HTTP客户端实现
  - 文件：`src/services/api/apiClient.ts`
  - 功能：Axios基础配置 + 请求/响应拦截器
  - 状态：✅ 已实现

- [x] 认证服务
  - 文件：`src/services/auth/authService.ts`
  - 方法：login, register, logout, resetPassword, changePassword 等
  - 状态：✅ 已实现

- [x] Token管理
  - 文件：`src/services/tokenManager.ts`
  - 功能：保存、刷新、验证、清除Token
  - 状态：✅ 已实现

- [x] 存储服务
  - 文件：`src/services/storage/storageService.ts`
  - 功能：SecureStore + AsyncStorage 两层存储
  - 状态：✅ 已实现

- [x] 网络管理
  - 文件：`src/services/networkManager.ts`
  - 功能：自动重试 + 指数退避
  - 状态：✅ 已实现

---

## 🔧 后端配置 (✅ 完成)

- [x] JWT配置
  - 文件：`src/main/resources/application.properties`
  - 密钥：`cretas-food-traceability-system-secret-key-2025-do-not-change-in-production`
  - AccessToken有效期：24小时
  - RefreshToken有效期：30天
  - 状态：✅ 已配置

- [x] 认证接口
  - 文件：`src/main/java/.../controller/MobileController.java`
  - 端点：`/api/mobile/auth/unified-login` (登录)
  - 状态：✅ 已实现

- [x] Token工具
  - 文件：`src/main/java/.../util/JwtUtil.java`
  - 功能：生成、验证、解析JWT
  - 状态：✅ 已实现

- [x] 请求拦截
  - 文件：`src/main/java/.../config/JwtAuthInterceptor.java`
  - 功能：自动提取和验证Token
  - 状态：✅ 已实现

- [x] 业务服务
  - 文件：`src/main/java/.../service/MobileService.java`
  - 功能：登录、注册、密码重置等业务逻辑
  - 状态：✅ 已实现

---

## 💾 数据库配置 (✅ 完成)

- [x] 用户表
  - 表名：`users`
  - 字段：username, password_hash, factory_id, role_code 等
  - 状态：✅ 已创建

- [x] 平台管理员表
  - 表名：`platform_admins`
  - 字段：username, password_hash
  - 状态：✅ 已创建

- [x] 测试用户
  - super_admin / 123456 (工厂超级管理员)
  - dept_admin / 123456 (部门管理员)
  - operator1 / 123456 (操作员)
  - platform_admin / 123456 (平台管理员)
  - 状态：⚠️ 本地已更新，**服务器待更新**

---

## 🚀 服务部署 (⚠️ 待处理)

### 本地后端

```bash
# ✅ 验证配置
✅ Java版本：OpenJDK 11.0.29
✅ Maven版本：3.9.11
✅ MySQL：localhost:3306
✅ 数据库：cretas_db

# ✅ 启动命令
cd backend-java
mvn spring-boot:run
# 后端应该在 http://localhost:10010 启动
```

### 服务器后端

```
✅ 服务器IP：139.196.165.140
✅ 端口：10010
✅ JAR位置：/www/wwwroot/cretas/cretas-backend-system-1.0.0.jar
⚠️ 状态：运行中，但**密码未更新**
```

**待做**：
1. 通过MySQL更新服务器上的用户密码
2. 重启后端服务

---

## 🧪 测试状态

### 本地测试

```bash
# ✅ 本地测试脚本已创建
bash test-auth-api.sh 本地 super_admin 123456

# ✅ 结果
✅ 连接正常
✅ 登录成功
✅ Token生成成功
```

### 服务器测试

```bash
# ⚠️ 服务器测试脚本已创建
bash test-auth-api.sh 服务器 super_admin 123456

# ❌ 当前结果
❌ 登录失败（密码不匹配）
```

**根本原因**: 服务器数据库中的密码哈希值与本地不同

---

## 🔧 需要立即处理的问题

### 问题1️⃣ : 服务器密码不匹配

**现象**:
```
POST http://139.196.165.140:10010/api/mobile/auth/unified-login
{
  "code": 400,
  "message": "用户名或密码错误"
}
```

**原因**: 服务器数据库中的密码哈希值与本地测试用密码不同

**解决方案**:
```bash
# 方案1: 通过本地MySQL直接更新（如果可以访问）
mysql -u root cretas_db < fix-server-passwords.sql

# 方案2: 通过宝塔面板执行SQL
# 使用宝塔面板 → 数据库 → 执行SQL命令

# 方案3: 通过SSH登录服务器执行
ssh root@139.196.165.140
mysql -u root cretas_db < fix-server-passwords.sql
```

**SQL语句**:
```sql
UPDATE users SET password_hash = '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse'
WHERE username IN ('super_admin', 'dept_admin', 'operator1');

UPDATE platform_admins SET password_hash = '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse'
WHERE username = 'platform_admin';
```

**验证**:
```bash
# 更新后重新测试
bash test-auth-api.sh 服务器 super_admin 123456

# 预期输出
✅ 登录成功
```

---

## 📂 文件清单

### 前端相关

| 文件 | 状态 |
|------|------|
| `src/constants/config.ts` | ✅ 配置完成 |
| `src/services/api/apiClient.ts` | ✅ 实现完成 |
| `src/services/auth/authService.ts` | ✅ 实现完成 |
| `src/services/tokenManager.ts` | ✅ 实现完成 |
| `src/services/storage/storageService.ts` | ✅ 实现完成 |
| `src/services/networkManager.ts` | ✅ 实现完成 |
| `src/store/authStore.ts` | ✅ 实现完成 |

### 后端相关

| 文件 | 状态 |
|------|------|
| `src/main/resources/application.properties` | ✅ 配置完成 |
| `src/main/java/.../controller/MobileController.java` | ✅ 实现完成 |
| `src/main/java/.../util/JwtUtil.java` | ✅ 实现完成 |
| `src/main/java/.../config/JwtAuthInterceptor.java` | ✅ 实现完成 |
| `src/main/java/.../service/MobileService.java` | ✅ 实现完成 |

### 文档和脚本

| 文件 | 说明 |
|------|------|
| `AUTH_INTEGRATION_SUMMARY.md` | ✅ 完成总结 |
| `test-auth-api.sh` | ✅ 快速测试脚本 |
| `fix-server-passwords.sql` | ✅ 密码修复脚本 |
| `INTEGRATION_CHECKLIST.md` | 📄 本文件 |

---

## 📊 对接进度统计

```
前端配置:    ████████████████████ 100% (✅ 完成)
后端配置:    ████████████████████ 100% (✅ 完成)
数据库配置:  ████████████████████ 100% (✅ 完成)
本地测试:    ████████████████████ 100% (✅ 完成)
服务器配置:  ████████████░░░░░░░░  80% (⚠️ 需更新密码)
服务器测试:  ████████░░░░░░░░░░░░  40% (⏳ 等待密码更新)
--------
总进度:      ████████████████░░░░  85% (⏳ 即将完成)
```

---

## 🎯 立即可执行的步骤

### Step 1: 更新服务器密码 (必须)

**在有MySQL访问权限的机器上执行**:
```bash
# 方案A: 如果你有本地MySQL访问到服务器数据库
mysql -h 139.196.165.140 -u root cretas_db < fix-server-passwords.sql

# 方案B: 通过宝塔面板
# 1. 打开宝塔面板: https://139.196.165.140:16435
# 2. 进入"数据库"页面
# 3. 打开"phpmyadmin"或"执行SQL"
# 4. 执行fix-server-passwords.sql中的SQL语句

# 方案C: 通过SSH登录服务器
ssh root@139.196.165.140
cd /www/wwwroot/cretas
mysql -u root cretas_db < fix-server-passwords.sql
```

### Step 2: 重启后端服务

```bash
# 通过SSH或宝塔面板执行
bash /www/wwwroot/cretas/restart.sh
```

### Step 3: 验证对接

```bash
# 在本地执行测试脚本
bash test-auth-api.sh 服务器 super_admin 123456

# 预期输出: ✅ 登录成功
```

### Step 4: 启动前端应用

```bash
cd frontend/CretasFoodTrace
npm start

# 输入账号: super_admin
# 输入密码: 123456
# 预期结果: 成功登录，跳转到首页
```

---

## ✅ 完成指标

当以下条件都满足时，认证系统对接完全完成：

- [ ] 服务器数据库密码已更新
- [ ] 后端服务已重启
- [ ] `bash test-auth-api.sh 服务器 super_admin 123456` 返回✅ 成功
- [ ] 前端应用可以成功登录
- [ ] Token已正确保存在SecureStore
- [ ] 登出功能正常工作
- [ ] Token刷新机制工作正常

---

## 📞 支持

遇到问题？参考以下文档：

1. [AUTH_INTEGRATION_SUMMARY.md](./AUTH_INTEGRATION_SUMMARY.md) - 完整集成指南
2. [CLAUDE.md](./CLAUDE.md) - 项目开发规范
3. [backend-java/README.md](./backend-java/README.md) - 后端文档
4. [frontend/CretasFoodTrace/README.md](./frontend/CretasFoodTrace/README.md) - 前端文档

---

**最后提醒**: 在执行任何修改前，请先备份数据库！

```bash
# 备份数据库
mysqldump -u root cretas_db > cretas_db_backup_$(date +%Y%m%d_%H%M%S).sql
```

