# 黑牛食品溯源系统 - 后端服务

## 🎯 项目概述

黑牛食品溯源系统后端服务，提供完整的多租户认证、用户管理、白名单管理和平台管理功能。采用现代化的Node.js + Express + Prisma技术栈，支持JWT认证和基于角色的权限控制。

## ✨ 核心功能

### 🔐 认证系统
- **多租户架构**: 支持多个工厂的数据隔离
- **白名单注册**: 邀请制用户注册流程
- **双重身份**: 平台管理员和工厂用户分离
- **JWT认证**: 无状态认证 + 刷新令牌
- **会话管理**: 数据库存储的会话控制

### 👥 用户管理
- **4级权限体系**: 平台管理员 → 工厂超管 → 部门管理员 → 普通用户
- **用户激活流程**: 注册后需管理员审核激活
- **权限精细化**: 支持按部门和功能的权限分配
- **批量操作**: 支持批量用户管理

### 📱 白名单管理
- **手机号白名单**: 基于手机号的邀请注册
- **批量导入**: 支持Excel/CSV批量上传
- **状态管理**: 待注册/已注册/已过期状态流转
- **过期处理**: 自动处理过期白名单

### 🏭 平台管理
- **工厂管理**: 工厂创建、状态控制、信息管理
- **超级管理员**: 自动为新工厂创建超管账户
- **统计监控**: 平台级和工厂级数据统计

## 🏗️ 技术架构

### 技术栈
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.18+
- **Database**: MySQL 8.0+ / MariaDB 10.6+
- **ORM**: Prisma 5.5+
- **Authentication**: JWT + bcrypt
- **Validation**: Zod
- **Environment**: dotenv

### 项目结构
```
backend/
├── src/
│   ├── controllers/     # 业务逻辑控制器
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── whitelistController.js
│   │   └── platformController.js
│   ├── middleware/      # 中间件
│   │   ├── auth.js
│   │   ├── validation.js
│   │   └── errorHandler.js
│   ├── routes/          # 路由定义
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── whitelist.js
│   │   └── platform.js
│   ├── utils/           # 工具类
│   │   ├── jwt.js
│   │   └── password.js
│   └── index.js         # 应用入口
├── prisma/
│   └── schema.prisma    # 数据库模型
├── scripts/             # 管理脚本
│   ├── init-platform-admin.js
│   ├── seed-database.js
│   ├── test-api-endpoints.js
│   └── startup-check.js
├── .env.example         # 环境变量示例
└── package.json
```

## 🚀 快速开始

### 1. 环境准备

**系统要求**:
- Node.js 18.0+
- NPM 8.0+ 或 Yarn 1.22+
- MySQL 8.0+ 或 MariaDB 10.6+

**克隆项目**:
```bash
cd backend
npm install
```

### 2. 环境配置

**创建环境配置**:
```bash
cp .env.example .env
```

**编辑 .env 文件**:
```env
# 数据库配置
DATABASE_URL="mysql://username:password@localhost:3306/heiniu_db"

# JWT配置
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_SECRET="your-refresh-secret-here"
JWT_REFRESH_EXPIRES_IN="7d"

# 服务器配置
PORT=3001
NODE_ENV=development

# CORS配置
CORS_ORIGIN="http://localhost:3000"

# 密码加密
BCRYPT_SALT_ROUNDS=12
```

### 3. 数据库初始化

**生成Prisma客户端**:
```bash
npm run generate
```

**运行数据库迁移**:
```bash
npm run migrate
```

**创建平台管理员**:
```bash
npm run init-admin
```

**生成测试数据** (可选):
```bash
npm run seed
```

### 4. 启动服务

**开发环境**:
```bash
npm run dev
```

**生产环境**:
```bash
npm start
```

**系统检查**:
```bash
npm run check
```

**API测试**:
```bash
npm run test-api
```

### 5. 验证安装

访问以下地址验证服务是否正常:
- 健康检查: http://localhost:3001/health
- API信息: http://localhost:3001/api
- 服务根目录: http://localhost:3001/

## 📡 API接口

### 认证模块 (`/api/auth`)

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| POST | `/verify-phone` | 手机号验证 | 无 |
| POST | `/register` | 用户注册 | 无 |
| POST | `/login` | 工厂用户登录 | 无 |
| POST | `/platform-login` | 平台管理员登录 | 无 |
| POST | `/logout` | 用户登出 | 需要 |
| GET | `/me` | 获取当前用户信息 | 需要 |
| POST | `/refresh` | 刷新令牌 | 无 |
| PUT | `/password` | 修改密码 | 需要 |
| GET | `/status` | 检查认证状态 | 可选 |

### 白名单管理 (`/api/whitelist`)

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| POST | `/` | 添加白名单 | 管理员 |
| GET | `/` | 获取白名单列表 | 管理员 |
| GET | `/stats` | 获取白名单统计 | 管理员 |
| PUT | `/:id` | 更新白名单状态 | 管理员 |
| DELETE | `/:id` | 删除白名单记录 | 管理员 |
| DELETE | `/batch` | 批量删除白名单 | 管理员 |
| PUT | `/expired` | 更新过期白名单 | 管理员 |

### 用户管理 (`/api/users`)

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| GET | `/` | 获取用户列表 | 管理员 |
| GET | `/pending` | 获取待激活用户 | 管理员 |
| GET | `/stats` | 获取用户统计 | 管理员 |
| POST | `/:userId/activate` | 激活用户 | 管理员 |
| PUT | `/:userId` | 更新用户信息 | 管理员 |
| PUT | `/:userId/status` | 启用/停用用户 | 管理员 |
| POST | `/:userId/reset-password` | 重置用户密码 | 管理员 |

### 平台管理 (`/api/platform`)

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| POST | `/factories` | 创建工厂 | 平台管理员 |
| GET | `/factories` | 获取工厂列表 | 平台管理员 |
| GET | `/factories/stats` | 获取工厂统计 | 平台管理员 |
| PUT | `/factories/:id` | 更新工厂信息 | 平台管理员 |
| PUT | `/factories/:id/status` | 启用/停用工厂 | 平台管理员 |
| POST | `/factories/:id/super-admin` | 创建工厂超管 | 平台管理员 |

## 🔒 权限体系

### 用户角色层级

1. **Platform Admin (平台管理员)**
   - 权限级别: 0
   - 管理范围: 全平台
   - 主要功能: 工厂管理、平台用户管理

2. **Super Admin (工厂超级管理员)**
   - 权限级别: 0 (工厂内)
   - 管理范围: 单个工厂
   - 主要功能: 工厂内所有管理功能

3. **Permission Admin (权限管理员)**
   - 权限级别: 5
   - 管理范围: 单个工厂
   - 主要功能: 用户权限分配、角色管理

4. **Department Admin (部门管理员)**
   - 权限级别: 10
   - 管理范围: 单个部门
   - 主要功能: 部门用户管理、部门业务

5. **User (普通用户)**
   - 权限级别: 50
   - 管理范围: 个人
   - 主要功能: 业务操作、数据录入

### 权限分类

**管理权限**:
- `admin:read` - 管理后台查看
- `admin:write` - 管理后台操作
- `admin:delete` - 管理后台删除

**用户权限**:
- `user:read` - 用户信息查看
- `user:write` - 用户信息编辑
- `user:delete` - 用户删除

**白名单权限**:
- `whitelist:read` - 白名单查看
- `whitelist:write` - 白名单管理
- `whitelist:delete` - 白名单删除

**业务权限**:
- `farming:*` - 养殖业务权限
- `processing:*` - 加工业务权限
- `logistics:*` - 物流业务权限
- `quality:*` - 质量业务权限

## 🛠️ 开发指南

### 数据库操作

**查看数据库状态**:
```bash
npm run studio
```

**重置数据库**:
```bash
npx prisma migrate reset
npm run seed
```

**生成新迁移**:
```bash
npx prisma migrate dev --name "migration-name"
```

### 测试

**运行系统检查**:
```bash
npm run check
```

**运行API测试**:
```bash
npm run test-api
```

**手动测试认证**:
```bash
# 平台管理员登录
curl -X POST http://localhost:3001/api/auth/platform-login \
  -H "Content-Type: application/json" \
  -d '{"username":"platform_admin","password":"Admin@123456"}'

# 工厂用户登录
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin","password":"SuperAdmin@123","factoryId":"TEST_2024_001"}'
```

### 日志和调试

**查看应用日志**:
```bash
# 开发环境（自动重启）
npm run dev

# 生产环境
npm start

# PM2部署（推荐生产环境）
pm2 start src/index.js --name "heiniu-backend"
pm2 logs heiniu-backend
```

## 📋 常见问题

### Q: 数据库连接失败
A: 检查 `.env` 文件中的 `DATABASE_URL` 配置，确保数据库服务已启动，用户名密码正确。

### Q: JWT令牌验证失败
A: 检查 `JWT_SECRET` 配置，确保开发和生产环境使用不同的密钥。

### Q: 权限验证不通过
A: 检查用户的角色和权限配置，确认API路由的权限要求设置正确。

### Q: 跨域请求被拒绝
A: 检查 `CORS_ORIGIN` 配置，确保包含前端应用的域名。

### Q: 平台管理员无法创建
A: 运行 `npm run init-admin --force` 强制重新创建平台管理员。

## 🚀 部署指南

### Docker部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run generate
EXPOSE 3001
CMD ["npm", "start"]
```

### 环境变量 (生产环境)

```env
NODE_ENV=production
DATABASE_URL="mysql://prod_user:prod_pass@db_host:3306/heiniu_prod"
JWT_SECRET="production-jwt-secret-very-long-and-secure"
JWT_REFRESH_SECRET="production-refresh-secret-very-long-and-secure"
CORS_ORIGIN="https://your-frontend-domain.com"
```

### Nginx配置

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📚 更多信息

- [API文档详细版](docs/api/)
- [数据库设计文档](docs/database/)
- [部署指南](docs/deployment/)
- [开发规范](docs/development/)

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/new-feature`)
3. 提交更改 (`git commit -am 'Add new feature'`)
4. 推送到分支 (`git push origin feature/new-feature`)
5. 创建 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件。

---

**版本**: v1.0.0  
**更新日期**: 2024年7月  
**维护者**: Steve  
**联系方式**: [GitHub Issues](https://github.com/your-repo/issues)