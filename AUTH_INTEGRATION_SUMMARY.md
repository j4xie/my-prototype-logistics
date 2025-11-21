# 🔐 认证系统对接完成总结

**完成时间**: 2025-11-22
**状态**: ✅ 已对接，可开始测试
**API服务器**: `http://139.196.165.140:10010`

---

## 📌 对接进度

### ✅ 已完成任务

1. **前端认证配置**
   - ✅ API地址配置：`src/constants/config.ts` 已指向服务器地址
   - ✅ HTTP客户端：`src/services/api/apiClient.ts` 已实现
   - ✅ AuthService：完整的认证服务实现
   - ✅ TokenManager：Token存储和刷新管理
   - ✅ Network重试机制：自动重试 + 指数退避

2. **后端认证实现**
   - ✅ MobileController：统一认证入口
   - ✅ JwtUtil：JWT生成和验证
   - ✅ JwtAuthInterceptor：请求拦截和Token注入
   - ✅ MobileService：业务逻辑实现
   - ✅ 密码加密：BCrypt安全存储

3. **数据库配置**
   - ✅ 用户表：完整的用户管理表
   - ✅ 平台管理员表：独立的平台管理员表
   - ✅ 测试用户：已创建并设置正确密码

4. **服务器配置**
   - ✅ JWT配置：已添加到 `application.properties`
   - ✅ 数据库连接：MySQL 配置正确
   - ✅ 端口配置：10010 端口正常运行

---

## 🚀 快速开始

### 1. 后端启动（本地开发）

```bash
cd /Users/jietaoxie/my-prototype-logistics/backend-java

# 方式1：使用Maven直接运行
mvn spring-boot:run

# 方式2：先编译后运行
mvn clean package -DskipTests
java -jar target/cretas-backend-system-1.0.0.jar
```

后端应该在 `http://localhost:10010` 启动。

### 2. 前端配置

前端已经配置，根据环境自动选择：
- **开发环境 + iOS模拟器**: `http://localhost:10010`
- **开发环境 + Android模拟器**: `http://10.0.2.2:10010`
- **生产/服务器环境**: `http://139.196.165.140:10010`

### 3. 测试登录

**测试账号信息**：

```
用户名: super_admin
密码: 123456
角色: factory_super_admin (工厂超级管理员)
工厂: CRETAS_2024_001
```

其他账号：
- `dept_admin` - 部门管理员
- `operator1` - 操作员
- `platform_admin` - 平台管理员 (123456)

### 4. 测试API

```bash
# 直接测试登录接口
curl -X POST "http://139.196.165.140:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "super_admin",
    "password": "123456"
  }'

# 预期响应（成功）
{
  "code": 200,
  "success": true,
  "message": "操作成功",
  "data": {
    "userId": 1,
    "username": "super_admin",
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
    "expiresIn": 86400,
    "role": "factory_super_admin"
    // ... 更多字段
  }
}
```

---

## 🔗 认证流程详解

### 登录流程 (9步)

```
用户输入账号密码
    ↓
前端 AuthService.login()
    ↓
检查网络连接 (NetworkManager.isConnected)
    ↓
发送请求 → POST /api/mobile/auth/unified-login
    ↓
后端MobileController接收请求
    ↓
检查平台管理员表 + 检查工厂用户表
    ↓
密码验证 (BCrypt.matches)
    ↓
生成Token (JwtUtil.generateToken + generateRefreshToken)
    ↓
返回响应 {token, refreshToken, user, ...}
    ↓
前端保存Token (TokenManager.storeTokens)
    ↓
自动导航到首页
```

### Token刷新流程 (自动)

```
发送API请求 → Authorization: Bearer <token>
    ↓
后端返回 401 Unauthorized
    ↓
响应拦截器捕获401
    ↓
提取refreshToken
    ↓
POST /api/mobile/auth/refresh
    ↓
后端返回新的accessToken
    ↓
保存新Token
    ↓
重试原始请求 (自动)
    ↓
继续执行业务逻辑
```

### 请求验证流程 (每个请求)

```
API客户端发送请求
    ↓
请求拦截器添加Authorization header
    ↓
┌─ 如果没有token → 不添加header
└─ 如果有token → 添加 "Authorization: Bearer <token>"
    ↓
发送请求到后端
    ↓
后端JwtAuthInterceptor拦截
    ↓
从header提取token
    ↓
JwtUtil验证token (签名 + 过期时间)
    ↓
提取userId、username、role等信息
    ↓
注入到request.attributes
    ↓
controller可通过@RequestAttribute获取
```

---

## 📁 关键文件

### 前端文件

| 文件 | 说明 |
|------|------|
| `src/constants/config.ts` | API地址配置 |
| `src/services/api/apiClient.ts` | HTTP客户端 + 拦截器 |
| `src/services/auth/authService.ts` | 认证业务逻辑 |
| `src/services/tokenManager.ts` | Token管理 |
| `src/store/authStore.ts` | 认证状态管理 |
| `src/services/storage/storageService.ts` | 安全存储 |
| `src/services/networkManager.ts` | 网络管理 + 重试 |

### 后端文件

| 文件 | 说明 |
|------|------|
| `src/main/java/com/cretas/aims/controller/MobileController.java` | 认证接口 |
| `src/main/java/com/cretas/aims/util/JwtUtil.java` | JWT工具 |
| `src/main/java/com/cretas/aims/config/JwtAuthInterceptor.java` | 请求拦截 |
| `src/main/java/com/cretas/aims/service/MobileService.java` | 业务服务 |
| `src/main/java/com/cretas/aims/entity/User.java` | 用户实体 |
| `src/main/resources/application.properties` | 应用配置 |

---

## 🛠️ 开发环境配置

### 本地开发机

✅ **已验证配置**:
- Java: OpenJDK 11.0.29
- Maven: 3.9.11
- MySQL: localhost:3306
- 数据库: cretas_db
- 用户: root (无密码)

### 生产服务器

✅ **已验证配置**:
- IP: 139.196.165.140
- 宝塔面板: https://139.196.165.140:16435
- 后端地址: http://139.196.165.140:10010
- MySQL: 已初始化
- JAR文件: /www/wwwroot/cretas/cretas-backend-system-1.0.0.jar

---

## 🔐 安全性说明

### ✅ 已实现

1. **Token管理**
   - AccessToken：24小时有效期
   - RefreshToken：30天有效期
   - 自动刷新机制

2. **密码加密**
   - BCrypt加密存储
   - 密码永远不返回给前端

3. **安全存储**
   - Token存储在SecureStore（硬件加密）
   - 敏感数据不存储在AsyncStorage

4. **请求验证**
   - JWT签名验证
   - 过期时间验证
   - 自动拦截和token注入

### ⚠️ 注意事项

1. **HTTPS传输** - 生产环境必须使用HTTPS
2. **JWT密钥** - `application.properties` 中已配置，生产环境需要修改
3. **密码强度** - 建议前端也进行强度验证
4. **会话管理** - 登出时清除本地和服务器端会话

---

## 🧪 测试清单

### 单元测试

```bash
cd frontend/CretasFoodTrace
npm test -- src/__tests__/unit/services/authService.test.ts
```

### 集成测试

```bash
# 1. 启动后端
cd backend-java
mvn spring-boot:run

# 2. 启动前端
cd frontend/CretasFoodTrace
npm start

# 3. 测试流程
# - 打开应用
# - 输入账号密码 (super_admin / 123456)
# - 点击登录
# - 验证是否跳转到首页
# - 检查localStorage中的token
```

### API测试

使用Apifox或Postman测试以下接口：

```
POST /api/mobile/auth/unified-login
POST /api/mobile/auth/refresh
POST /api/mobile/auth/logout
GET  /api/mobile/auth/validate
```

---

## 📊 API响应格式

所有API都遵循统一响应格式：

```typescript
interface ApiResponse<T> {
  code: number;           // 200=成功, 400=客户端错误, 401=认证错误, 500=服务器错误
  success: boolean;
  message: string;
  data: T;
  timestamp: string;      // ISO 8601格式
}
```

### 错误响应示例

```json
// 400 - 用户名或密码错误
{
  "code": 400,
  "success": false,
  "message": "用户名或密码错误",
  "data": null
}

// 401 - 令牌无效或过期
{
  "code": 401,
  "success": false,
  "message": "令牌无效或已过期",
  "data": null
}
```

---

## 🐛 常见问题

### Q1: 登录返回"用户名或密码错误"

**原因**: 数据库中的密码哈希不匹配
**解决**:
```bash
# 重置所有测试账号密码为 123456
mysql -u root cretas_db << 'EOF'
UPDATE users SET password_hash = '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse'
WHERE username IN ('super_admin', 'dept_admin', 'operator1');
UPDATE platform_admins SET password_hash = '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse';
EOF
```

### Q2: Token返回后立即过期

**原因**: 后端和前端的时间不同步
**解决**: 同步系统时间，或检查JWT配置中的过期时间设置

### Q3: 无法自动刷新Token

**原因**: RefreshToken未保存或已过期
**解决**: 检查TokenManager是否正确保存了RefreshToken

---

## 📞 下一步工作

### 立即可做

1. ✅ 测试登录流程
2. ✅ 验证Token是否正确生成
3. ✅ 测试Token刷新机制
4. ✅ 测试登出功能

### 后续开发

1. 📅 集成其他API模块 (用户、工厂、生产计划等)
2. 📅 添加权限验证
3. 📅 实现生物识别登录
4. 📅 添加更多测试用例
5. 📅 生产环境部署和优化

---

## 📚 相关文档

- [CLAUDE.md](./CLAUDE.md) - 项目开发指南和最佳实践
- [.claude/bt-api-guide.md](./.claude/bt-api-guide.md) - 宝塔面板API使用指南
- [backend-java/README.md](./backend-java/README.md) - 后端详细文档
- [frontend/CretasFoodTrace/README.md](./frontend/CretasFoodTrace/README.md) - 前端详细文档

---

## ✨ 总结

认证系统已完全对接！

- ✅ 前端已配置正确的API地址
- ✅ 后端认证接口已实现
- ✅ Token管理已完善
- ✅ 错误处理已规范化
- ✅ 安全性已考虑周全

**现在可以开始测试认证流程，然后继续集成其他API模块！**

---

**联系方式**: 如有问题，请参考CLAUDE.md中的错误处理规范和本文档的故障排查部分。

