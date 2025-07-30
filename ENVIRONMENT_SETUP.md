# 环境配置指南

## 快速开始

### 1. 后端环境配置

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件，配置以下必需项：

```env
# 数据库配置（必需）
DATABASE_URL="mysql://root:your_password@localhost:3306/logistics_db"

# JWT密钥（必需，生产环境请更换）
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-refresh-secret-change-in-production"
```

### 2. 前端环境配置

```bash
cd frontend/web-app-next
cp .env.example .env.local
```

编辑 `.env.local` 文件：

```env
# API配置
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_USE_MOCK_API=false
```

### 3. 数据库初始化

```bash
cd backend

# 生成Prisma客户端
npm run generate

# 运行数据库迁移
npm run migrate

# 插入初始数据
npm run seed-initial
```

### 4. 启动服务

```bash
# 启动后端（在backend目录）
npm run dev

# 启动前端（在frontend/web-app-next目录）
npm run dev
```

## 环境变量详解

### 后端环境变量

| 变量名 | 默认值 | 说明 | 必需 |
|--------|--------|------|------|
| `PORT` | 3001 | 后端服务端口 | 否 |
| `DATABASE_URL` | - | MySQL数据库连接字符串 | 是 |
| `JWT_SECRET` | - | JWT签名密钥 | 是 |
| `JWT_EXPIRES_IN` | 24h | JWT过期时间 | 否 |
| `BCRYPT_SALT_ROUNDS` | 12 | 密码加密轮数 | 否 |
| `CORS_ORIGIN` | http://localhost:3000 | 允许的跨域源 | 否 |

### 前端环境变量

| 变量名 | 默认值 | 说明 | 必需 |
|--------|--------|------|------|
| `NEXT_PUBLIC_API_URL` | http://localhost:3001 | 后端API地址 | 是 |
| `NEXT_PUBLIC_USE_MOCK_API` | false | 是否使用Mock API | 否 |
| `NEXT_PUBLIC_MOCK_DELAY` | 300 | Mock API延迟(ms) | 否 |

## 测试账号

系统初始化后会创建以下测试账号：

### 平台管理员
- 用户名：`platform_admin`
- 密码：`Admin@123456`
- 权限：平台最高权限

### 工厂用户
- 超级管理员：`factory_admin` / `SuperAdmin@123`
- 养殖主管：`farming_admin` / `Test@123456`
- 加工主管：`processing_admin` / `Test@123456`
- 物流主管：`logistics_admin` / `Test@123456`
- 测试用户：`test_user` / `Test@123456`

### 白名单测试手机号
以下手机号可用于注册测试：
- 13800138001 (张三 - 养殖技术员)
- 13800138002 (李四 - 质检员)
- 13800138003 (王五 - 配送员)
- 13800138004 (赵六 - 主管)
- 13800138005 (钱七 - 检验员)

## 故障排除

### 1. 数据库连接失败
```bash
# 检查MySQL服务状态
mysql --version
mysql -u root -p

# 确认数据库存在
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS logistics_db;"
```

### 2. 前端API连接失败
- 确认后端服务已启动（localhost:3001）
- 检查 `NEXT_PUBLIC_API_URL` 配置
- 查看浏览器控制台网络请求

### 3. JWT认证失败
- 确认 `JWT_SECRET` 已设置
- 清除浏览器本地存储
- 重新登录获取新令牌

### 4. 权限访问被拒绝
- 确认用户账号已激活
- 检查用户角色和权限配置
- 联系管理员激活账号

## 生产环境配置

### 安全配置项
```env
# 生产环境必须更换的配置
JWT_SECRET="production-super-secret-key-min-32-chars"
JWT_REFRESH_SECRET="production-refresh-secret-key-min-32-chars"
DEFAULT_PLATFORM_ADMIN_PASSWORD="StrongPassword@2024"

# 生产数据库
DATABASE_URL="mysql://prod_user:strong_password@prod_host:3306/logistics_prod"

# 生产CORS
CORS_ORIGIN="https://yourdomain.com"
```

### 部署检查清单
- [ ] 更换所有默认密码
- [ ] 配置生产数据库
- [ ] 设置HTTPS证书
- [ ] 配置防火墙规则
- [ ] 启用日志监控
- [ ] 设置备份策略