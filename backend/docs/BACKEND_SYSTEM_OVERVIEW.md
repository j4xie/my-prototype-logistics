# 白垩纪食品溯源系统 - 后端系统全景图

生成时间: 2025-01-03

## 📋 目录

- [系统概述](#系统概述)
- [技术架构](#技术架构)
- [数据库设计](#数据库设计)
- [API接口](#api接口)
- [认证与权限](#认证与权限)
- [业务模块](#业务模块)
- [工具脚本](#工具脚本)
- [部署运维](#部署运维)

---

## 系统概述

### 🎯 项目定位
白垩纪食品溯源系统后端服务 - 提供完整的**多租户**、**多角色**、**权限精细化**的食品加工溯源管理平台。

### ✨ 核心特性
- 🏢 **多租户架构**: 支持多工厂独立数据隔离
- 👥 **8级角色体系**: 平台到工厂的完整权限层级
- 🔐 **安全认证**: JWT双令牌 + 设备绑定 + 生物识别支持
- 📱 **移动优先**: 专门的移动端API优化
- 🔄 **实时监控**: 设备监控、告警系统、数据分析
- 📊 **智能分析**: DeepSeek LLM集成的成本分析

---

## 技术架构

### 技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **Runtime** | Node.js | 18+ | JavaScript运行时 |
| **框架** | Express.js | 4.18+ | Web应用框架 |
| **数据库** | MySQL | 8.0+ | 关系型数据库 |
| **ORM** | Prisma | 5.5+ | 数据库ORM |
| **认证** | JWT | 9.0+ | 令牌认证 |
| **加密** | bcrypt | 6.0+ | 密码加密 |
| **验证** | Zod | 3.22+ | 数据验证 |
| **日志** | Winston | 3.11+ | 日志管理 |
| **定时任务** | node-cron | 3.0+ | 定时任务调度 |
| **文件处理** | multer | 2.0+ | 文件上传 |

### 项目结构

```
backend/
├── src/
│   ├── index.js                    # 应用入口
│   │
│   ├── config/                     # 配置文件
│   │   ├── database.js            # 数据库配置
│   │   ├── jwt.js                 # JWT配置
│   │   ├── permissions.js         # 权限配置
│   │   ├── industry-keywords.js   # 行业关键词
│   │   ├── region-keywords.js     # 区域关键词
│   │   └── mobile-regions.js      # 移动端配置
│   │
│   ├── controllers/                # 控制器 (15个)
│   │   ├── authController.js      # 认证控制器 ★核心
│   │   ├── platformController.js  # 平台管理控制器 ★核心
│   │   ├── userController.js      # 用户管理
│   │   ├── whitelistController.js # 白名单管理
│   │   ├── processingController.js# 加工业务 ★重要
│   │   ├── activationController.js# 激活管理
│   │   ├── timeclockController.js # 打卡管理
│   │   ├── timeStatsController.js # 工时统计
│   │   ├── workTypeController.js  # 工种管理
│   │   ├── equipmentController.js # 设备管理
│   │   ├── qualityController.js   # 质量控制
│   │   ├── alertController.js     # 告警系统
│   │   ├── reportController.js    # 报表生成
│   │   ├── dashboardController.js # 仪表板
│   │   └── systemController.js    # 系统管理
│   │
│   ├── middleware/                 # 中间件 (5个)
│   │   ├── auth.js                # 认证中间件 ★核心
│   │   ├── mobileAuth.js          # 移动端认证 ★核心
│   │   ├── permissions.js         # 权限检查
│   │   ├── validation.js          # 数据验证
│   │   └── errorHandler.js        # 错误处理
│   │
│   ├── routes/                     # 路由 (12个)
│   │   ├── auth.js                # 认证路由
│   │   ├── mobile.js              # 移动端路由 ★17907行
│   │   ├── platform.js            # 平台管理路由
│   │   ├── users.js               # 用户管理路由
│   │   ├── whitelist.js           # 白名单路由
│   │   ├── processing.js          # 加工业务路由
│   │   ├── activation.js          # 激活路由
│   │   ├── timeclock.js           # 打卡路由
│   │   ├── timeStats.js           # 统计路由
│   │   ├── workTypes.js           # 工种路由
│   │   ├── reports.js             # 报表路由
│   │   └── system.js              # 系统路由
│   │
│   ├── services/                   # 服务层
│   │   ├── cronJobs.js            # 定时任务
│   │   ├── factoryService.js      # 工厂服务
│   │   └── deepseekService.js     # DeepSeek LLM服务
│   │
│   └── utils/                      # 工具类 (8个)
│       ├── jwt.js                 # JWT工具
│       ├── password.js            # 密码工具
│       ├── logger.js              # 日志工具
│       ├── factory-id-generator.js# 工厂ID生成
│       ├── factory-context-handler.js # 工厂上下文
│       ├── securityEnhancer.js    # 安全增强
│       ├── performanceOptimizer.js# 性能优化
│       └── bigint-serializer.js   # BigInt序列化
│
├── prisma/
│   └── schema.prisma              # 数据库模型 (26个表)
│
├── scripts/                        # 管理脚本 (37个)
│   ├── init-platform-admin.js     # 初始化平台管理员
│   ├── unified-seed.js            # 统一种子数据
│   ├── startup-check.js           # 启动检查
│   ├── create-test-users.js       # 创建测试用户
│   └── ...                        # 35+ 个测试脚本
│
├── .env.example                    # 环境变量示例
├── package.json                    # 依赖配置
├── README.md                       # 项目文档
└── docker-compose.yml             # Docker配置
```

---

## 数据库设计

### 数据库模型 (26个表)

#### 核心模型

| 模型 | 用途 | 关键字段 | 关系 |
|------|------|---------|------|
| **Factory** | 工厂信息 | id, name, industry, regionCode | 1:N User, Session, 等 |
| **PlatformAdmin** | 平台管理员 | username, role, email | 1:N UserWhitelist |
| **User** | 工厂用户 | username, factoryId, role, department | N:1 Factory |
| **UserWhitelist** | 白名单 | phoneNumber, factoryId, status | N:1 Factory |
| **Session** | 会话管理 | userId, token, deviceId | N:1 User/PlatformAdmin |
| **FactorySettings** | 工厂配置 | factoryId, settings | 1:1 Factory |
| **UserRoleHistory** | 角色历史 | userId, oldRole, newRole | N:1 User |

#### 业务模型

| 模型 | 用途 | 关键字段 |
|------|------|---------|
| **ProcessingBatch** | 加工批次 | batchNumber, fishType, quantity, cost |
| **EmployeeWorkRecord** | 工作记录 | employeeId, workType, startTime, endTime |
| **EmployeeTimeClock** | 打卡记录 | employeeId, clockIn, clockOut, workType |
| **EmployeeWorkSession** | 工作会话 | employeeId, sessionStart, sessionEnd |
| **FactoryEquipment** | 设备管理 | name, status, location, lastMaintenance |
| **QualityInspection** | 质检记录 | batchId, inspector, result, issues |
| **MaterialReceipt** | 物料入库 | materialType, quantity, supplier |
| **MaterialUsage** | 物料使用 | batchId, materialType, quantity |

#### 系统模型

| 模型 | 用途 | 关键字段 |
|------|------|---------|
| **ActivationCode** | 激活码 | code, factoryId, status, expiresAt |
| **DeviceMonitoringData** | 设备监控 | deviceId, temperature, humidity |
| **AlertNotification** | 告警通知 | alertType, severity, message |
| **DashboardMetric** | 仪表板指标 | metricType, value, timestamp |
| **SystemLog** | 系统日志 | level, message, context |
| **ApiAccessLog** | API日志 | endpoint, method, userId, duration |
| **ReportTemplate** | 报表模板 | name, type, template |
| **WorkType** | 工种定义 | name, code, baseWage |

### 角色类型 (Enums)

```prisma
enum PlatformRole {
  system_developer      // 系统开发者
  platform_super_admin  // 平台超级管理员
  platform_operator     // 平台操作员
}

enum FactoryUserRole {
  factory_super_admin   // 工厂超级管理员
  permission_admin      // 权限管理员
  department_admin      // 部门管理员
  operator             // 操作员
  viewer               // 查看者
  unactivated          // 未激活
}

enum WhitelistStatus {
  PENDING              // 待注册
  REGISTERED           // 已注册
  EXPIRED              // 已过期
}
```

---

## API接口

### 接口分类

#### 1. 认证模块 (`/api/auth`)

| 端点 | 方法 | 功能 | 认证 | 控制器 |
|------|------|------|------|--------|
| `/verify-phone` | POST | 手机号验证 | 否 | authController |
| `/register` | POST | 用户注册 | 否 | authController |
| `/login` | POST | 工厂用户登录 | 否 | authController |
| `/platform-login` | POST | 平台管理员登录 | 否 | authController |
| `/logout` | POST | 登出 | 是 | authController |
| `/me` | GET | 获取当前用户 | 是 | authController |
| `/refresh` | POST | 刷新令牌 | 否 | authController |
| `/password` | PUT | 修改密码 | 是 | authController |

#### 2. 移动端API (`/api/mobile/*`)

**最重要的路由文件** - 17907行代码

| 端点 | 方法 | 功能 | 认证 |
|------|------|------|------|
| `/mobile/auth/unified-login` | POST | 统一登录 | 否 |
| `/mobile/auth/register-phase-one` | POST | 注册第一阶段 | 否 |
| `/mobile/auth/register-phase-two` | POST | 注册第二阶段 | 是(temp) |
| `/mobile/auth/bind-device` | POST | 绑定设备 | 是 |
| `/mobile/upload/mobile` | POST | 移动端上传 | 是 |
| `/mobile/analysis/deepseek` | POST | AI分析 | 是 |
| `/mobile/activation/activate` | POST | 激活应用 | 否 |
| `/mobile/health` | GET | 健康检查 | 否 |

#### 3. 平台管理 (`/api/platform`)

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/factories` | POST | 创建工厂 | platform_admin |
| `/factories` | GET | 工厂列表 | platform_admin |
| `/factories/stats` | GET | 工厂统计 | platform_admin |
| `/factories/:id` | PUT | 更新工厂 | platform_admin |
| `/factories/:id/status` | PUT | 工厂状态 | platform_admin |
| `/factories/:id/super-admin` | POST | 创建超管 | platform_admin |

#### 4. 用户管理 (`/api/users`)

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/` | GET | 用户列表 | admin |
| `/pending` | GET | 待激活用户 | admin |
| `/stats` | GET | 用户统计 | admin |
| `/:userId/activate` | POST | 激活用户 | admin |
| `/:userId` | PUT | 更新用户 | admin |
| `/:userId/status` | PUT | 用户状态 | admin |
| `/:userId/reset-password` | POST | 重置密码 | admin |

#### 5. 加工业务 (`/api/processing`)

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/batches` | POST | 创建批次 | operator+ |
| `/batches` | GET | 批次列表 | operator+ |
| `/batches/:id` | GET | 批次详情 | operator+ |
| `/batches/:id/complete` | PUT | 完成批次 | operator+ |
| `/work-records` | POST | 创建工作记录 | operator+ |
| `/work-records` | GET | 工作记录列表 | operator+ |
| `/materials/receipt` | POST | 物料入库 | operator+ |
| `/materials/usage` | POST | 物料使用 | operator+ |

#### 6. 打卡系统 (`/api/timeclock`)

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/clock-in` | POST | 上班打卡 | all |
| `/clock-out` | POST | 下班打卡 | all |
| `/current` | GET | 当前打卡状态 | all |
| `/history` | GET | 打卡历史 | all |
| `/work-types` | GET | 工种列表 | all |

#### 7. 其他模块

- **白名单** (`/api/whitelist`): 白名单CRUD、统计
- **激活** (`/api/activation`): 激活码管理
- **设备** (`/api/equipment`): 设备监控
- **质检** (`/api/quality`): 质量检测
- **告警** (`/api/alerts`): 告警管理
- **报表** (`/api/reports`): 报表生成
- **系统** (`/api/system`): 系统管理

---

## 认证与权限

### 认证流程

#### 1. JWT双令牌机制

```
用户登录
  ↓
验证用户名密码
  ↓
生成令牌对:
├─ Access Token (24小时)
│  └─ 用于API访问
└─ Refresh Token (7天)
   └─ 用于刷新Access Token
  ↓
返回用户信息 + 令牌
```

#### 2. 移动端认证流程

```
移动端登录
  ↓
统一登录API (/api/mobile/auth/unified-login)
  ├─ 自动识别平台用户/工厂用户
  ├─ 验证设备信息
  └─ 支持生物识别令牌
  ↓
返回:
├─ Access Token
├─ Refresh Token
├─ Device Token (设备绑定)
└─ Temp Token (临时令牌,用于注册)
```

#### 3. 设备绑定

```
首次登录
  ↓
提取设备信息:
├─ Device ID (Android ID / iOS Vendor ID)
├─ Device Model
├─ OS Version
└─ App Version
  ↓
绑定设备到Session
  ↓
后续登录验证设备
```

### 权限体系

#### 8级角色权限

| 角色 | 权限级别 | 用户类型 | 权限范围 |
|------|----------|----------|----------|
| **system_developer** | -1 | platform | 全系统 |
| **platform_super_admin** | 0 | platform | 所有工厂 |
| **platform_operator** | 1 | platform | 查看所有工厂 |
| **factory_super_admin** | 0 | factory | 单个工厂全部 |
| **permission_admin** | 5 | factory | 工厂权限管理 |
| **department_admin** | 10 | factory | 单个部门 |
| **operator** | 30 | factory | 业务操作 |
| **viewer** | 50 | factory | 只读访问 |

#### 权限检查中间件

```javascript
// src/middleware/permissions.js
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    next();
  };
};

// 使用示例
router.post('/factories',
  authenticate,
  requirePermission('platform:manage'),
  platformController.createFactory
);
```

---

## 业务模块

### 1. 加工管理模块

**核心功能**:
- 加工批次管理
- 工作记录跟踪
- 物料管理
- 成本核算
- DeepSeek AI成本分析

**数据流**:
```
创建批次
  ↓
记录员工工作
  ↓
记录物料使用
  ↓
质量检测
  ↓
批次完成
  ↓
成本分析 (AI)
  ↓
生成报表
```

### 2. 打卡系统

**核心功能**:
- 上下班打卡
- 工时统计
- 工种管理
- 加班计算

**打卡流程**:
```
员工打卡
  ↓
验证权限
  ↓
检查当前状态:
├─ 无打卡 → 创建上班记录
└─ 已上班 → 创建下班记录
  ↓
计算工时
  ↓
更新统计数据
```

### 3. 设备监控

**核心功能**:
- 设备状态监控
- 温湿度监控
- 设备维护记录
- 异常告警

### 4. 质量管理

**核心功能**:
- 批次质检
- 不合格品处理
- 质检报告
- 质量统计

### 5. 告警系统

**告警类型**:
- 设备异常
- 温度异常
- 质量异常
- 系统异常

**告警级别**:
- CRITICAL (严重)
- HIGH (高)
- MEDIUM (中)
- LOW (低)

---

## 工具脚本

### 核心脚本 (必备)

| 脚本 | 用途 | 命令 |
|------|------|------|
| `init-platform-admin.js` | 初始化平台管理员 | `npm run init-admin` |
| `unified-seed.js` | 统一种子数据 | `npm run seed` |
| `startup-check.js` | 启动检查 | `npm run check` |
| `create-test-users.js` | 创建测试用户 | `node scripts/create-test-users.js` |

### 测试脚本 (35+个)

**分类**:
- 认证测试: `comprehensive-login-test.js`
- 角色权限测试: `role-permission-matrix-test.js`
- 数据完整性测试: `data-validation-constraint-test.js`
- 性能测试: `performance-optimization-test.js`
- 集成测试: `production-flow-integration-test.js`
- 多租户测试: `multi-factory-isolation-test.js`

### 管理脚本

| 脚本 | 用途 |
|------|------|
| `reset-test-passwords.js` | 重置测试密码 |
| `show-all-accounts.js` | 显示所有账户 |
| `check-accounts.js` | 检查账户状态 |
| `migrate-role-values.js` | 迁移角色数据 |

---

## 部署运维

### 环境配置

```env
# 数据库
DATABASE_URL="mysql://user:password@localhost:3306/cretas_db"

# JWT
JWT_SECRET="your-secret-key-here"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_REFRESH_EXPIRES_IN="7d"

# 服务器
PORT=3001
NODE_ENV=production

# CORS
CORS_ORIGIN="https://yourdomain.com"

# 密码加密
BCRYPT_SALT_ROUNDS=12
```

### 部署流程

```bash
# 1. 安装依赖
npm ci --only=production

# 2. 生成Prisma客户端
npm run generate

# 3. 运行数据库迁移
npm run migrate

# 4. 初始化平台管理员
npm run init-admin

# 5. 启动服务
npm start
```

### Docker部署

```yaml
# docker-compose.yml
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: cretas_db
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql

  backend:
    build: .
    ports:
      - "3001:3001"
    depends_on:
      - mysql
    environment:
      DATABASE_URL: mysql://root:rootpassword@mysql:3306/cretas_db
      NODE_ENV: production

volumes:
  mysql-data:
```

### 性能优化

**已实现**:
- 数据库索引优化
- JWT令牌缓存
- 查询结果缓存
- API响应压缩
- 请求限流
- 连接池管理

**监控指标**:
- API响应时间
- 数据库查询时间
- 内存使用
- CPU使用
- 并发连接数

---

## 关键文件说明

### 最重要的文件

1. **src/routes/mobile.js** (17907行)
   - 移动端所有API路由
   - 认证、注册、上传、分析等核心功能

2. **src/controllers/authController.js** (34787行)
   - 认证核心逻辑
   - 登录、注册、令牌管理

3. **src/controllers/platformController.js** (54027行)
   - 平台管理核心
   - 工厂管理、平台用户管理

4. **src/controllers/processingController.js** (48957行)
   - 加工业务核心
   - 批次管理、成本核算

5. **prisma/schema.prisma**
   - 数据库模型定义
   - 26个表的完整结构

---

## 总结

### 系统规模

- **代码行数**: 约20万行
- **API端点**: 100+ 个
- **数据库表**: 26个
- **控制器**: 15个
- **中间件**: 5个
- **工具脚本**: 37个

### 技术亮点

1. ✅ **完整的多租户架构**
2. ✅ **8级精细化权限控制**
3. ✅ **移动端优化API**
4. ✅ **设备绑定安全机制**
5. ✅ **DeepSeek LLM集成**
6. ✅ **完善的测试体系**
7. ✅ **生产级部署方案**

### 待优化项

- [ ] API文档自动生成 (Swagger)
- [ ] 单元测试覆盖率提升
- [ ] 实时通知系统 (WebSocket)
- [ ] 缓存层完善 (Redis)
- [ ] 日志分析系统
- [ ] 性能监控dashboard

---

**文档版本**: v1.0.0
**最后更新**: 2025-01-03
**维护者**: Backend Team