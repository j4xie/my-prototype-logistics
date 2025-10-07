# 🛠️ Backend Scripts 使用指南

## 📁 目录结构

```
scripts/
├── README.md              # 本文档
├── init/                  # 初始化脚本
├── admin/                 # 管理脚本
├── test/                  # 测试脚本
├── maintenance/           # 维护脚本
└── sql/                   # SQL脚本
```

---

## 🚀 init/ - 初始化脚本

**用途**: 首次搭建环境、创建测试数据

### 核心脚本

#### `init-admin-only.js`
**功能**: 仅初始化平台管理员账号
**使用场景**: 快速创建管理员进行测试
```bash
node scripts/init/init-admin-only.js
```

#### `init-platform-admin.js`
**功能**: 初始化平台管理员（完整版）
```bash
node scripts/init/init-platform-admin.js
```

#### `init-production-db.js`
**功能**: 初始化生产环境数据库
**注意**: ⚠️ 谨慎使用，会重置数据库
```bash
node scripts/init/init-production-db.js
```

#### `create-test-factory.js`
**功能**: 创建测试工厂
```bash
node scripts/init/create-test-factory.js
```

#### `create-test-users.js`
**功能**: 创建测试用户
```bash
node scripts/init/create-test-users.js
```

#### `create-test-data.js`
**功能**: 创建完整测试数据（工厂+用户+批次等）
```bash
node scripts/init/create-test-data.js
```

#### `seed-database.js`
**功能**: 数据库种子数据填充
```bash
node scripts/init/seed-database.js
```

#### `seed-all-modules.js`
**功能**: 填充所有模块的测试数据
```bash
node scripts/init/seed-all-modules.js
```

#### `unified-seed.js`
**功能**: 统一的数据种子脚本
```bash
node scripts/init/unified-seed.js
```

#### `setup-database.js`
**功能**: 数据库完整安装
```bash
node scripts/init/setup-database.js
```

#### `setup-local-env.js`
**功能**: 本地开发环境配置
```bash
node scripts/init/setup-local-env.js
```

### 推荐初始化流程

```bash
# 1. 初始化数据库
node scripts/init/setup-database.js

# 2. 创建平台管理员
node scripts/init/init-platform-admin.js

# 3. 创建测试工厂和用户
node scripts/init/create-test-data.js

# 4. 填充模块数据（可选）
node scripts/init/seed-all-modules.js
```

---

## 👤 admin/ - 管理脚本

**用途**: 用户管理、账号维护

### 核心脚本

#### `check-accounts.js`
**功能**: 检查所有账号状态
```bash
node scripts/admin/check-accounts.js
```

#### `show-all-accounts.js`
**功能**: 显示所有账号详细信息
```bash
node scripts/admin/show-all-accounts.js
```

#### `reset-test-passwords.js`
**功能**: 重置测试账号密码
```bash
node scripts/admin/reset-test-passwords.js
```

#### `reset-to-123456.js`
**功能**: 重置所有密码为 123456
**注意**: ⚠️ 仅用于开发环境
```bash
node scripts/admin/reset-to-123456.js
```

#### `simple-reset.js`
**功能**: 简单密码重置
```bash
node scripts/admin/simple-reset.js
```

#### `add-test-whitelist.js`
**功能**: 添加测试白名单
```bash
node scripts/admin/add-test-whitelist.js
```

#### `check-valid-accounts.js`
**功能**: 检查有效账号
```bash
node scripts/admin/check-valid-accounts.js
```

#### `create-complete-test-users.js`
**功能**: 创建完整的测试用户集
```bash
node scripts/admin/create-complete-test-users.js
```

#### `create-factory-super-admin.js`
**功能**: 为工厂创建超级管理员
```bash
node scripts/admin/create-factory-super-admin.js
```

---

## 🧪 test/ - 测试脚本

**用途**: 功能测试、集成测试

### 核心测试脚本

#### 综合测试
- `comprehensive-test.js` - 综合功能测试
- `comprehensive-login-test.js` - 登录功能综合测试
- `enhanced-backend-test.js` - 增强后端测试

#### 模块测试
- `alert-system-comprehensive-test.js` - 告警系统测试
- `equipment-monitoring-comprehensive-test.js` - 设备监控测试
- `quality-detection-comprehensive-test.js` - 质检系统测试
- `production-flow-integration-test.js` - 生产流程集成测试

#### 权限和用户测试
- `role-permission-matrix-test.js` - 角色权限矩阵测试
- `user-management-comprehensive-test.js` - 用户管理综合测试
- `user-management-fixed-test.js` - 用户管理修复测试

#### 数据和性能测试
- `comprehensive-data-model-test.js` - 数据模型测试
- `data-validation-constraint-test.js` - 数据验证约束测试
- `performance-optimization-test.js` - 性能优化测试

#### 其他测试
- `multi-factory-isolation-test.js` - 多工厂隔离测试
- `relationship-integrity-test.js` - 关系完整性测试
- `cron-jobs-test.js` - 定时任务测试
- `test-api.js` - API测试
- `test-error-messages.js` - 错误信息测试
- `test-login-routes.js` - 登录路由测试
- `test-middleware-utils.js` - 中间件工具测试

### 运行测试

```bash
# 运行综合测试
node scripts/test/comprehensive-test.js

# 运行登录测试
node scripts/test/comprehensive-login-test.js

# 运行权限测试
node scripts/test/role-permission-matrix-test.js

# 运行性能测试
node scripts/test/performance-optimization-test.js
```

---

## 🔧 maintenance/ - 维护脚本

**用途**: 系统维护、数据库维护

### 核心脚本

#### `check-mysql-status.js`
**功能**: 检查MySQL数据库状态
```bash
node scripts/maintenance/check-mysql-status.js
```

#### `migrate-role-values.js`
**功能**: 迁移角色数据
```bash
node scripts/maintenance/migrate-role-values.js
```

#### `run-cron-job.js`
**功能**: 手动运行定时任务
```bash
node scripts/maintenance/run-cron-job.js
```

#### `startup-check.js`
**功能**: 启动检查（健康检查）
```bash
node scripts/maintenance/startup-check.js
```

#### `healthcheck.js`
**功能**: 系统健康检查
```bash
node scripts/maintenance/healthcheck.js
```

#### Shell 脚本

- `configure-mysql.sh` - 配置MySQL
- `install-mysql-ubuntu.sh` - Ubuntu安装MySQL

---

## 📊 sql/ - SQL脚本

**用途**: 数据库结构调整、数据修复

### SQL脚本列表

- `add_invited_by_column.sql` - 添加邀请人字段
- `add_platform_admin_role.sql` - 添加平台管理员角色
- `check_users.sql` - 检查用户数据

### 执行SQL脚本

```bash
# 使用MySQL命令行
mysql -u root -p cretas_db < scripts/sql/add_invited_by_column.sql

# 或者使用Prisma
npx prisma db execute --file scripts/sql/add_invited_by_column.sql
```

---

## 📋 常用操作速查

### 首次环境搭建
```bash
# 1. 安装数据库
node scripts/init/setup-database.js

# 2. 初始化管理员
node scripts/init/init-platform-admin.js

# 3. 创建测试数据
node scripts/init/create-test-data.js
```

### 重置开发环境
```bash
# 1. 重置密码
node scripts/admin/reset-to-123456.js

# 2. 检查账号
node scripts/admin/check-accounts.js
```

### 运行测试
```bash
# 综合测试
node scripts/test/comprehensive-test.js

# 登录测试
node scripts/test/comprehensive-login-test.js
```

### 系统维护
```bash
# 检查MySQL状态
node scripts/maintenance/check-mysql-status.js

# 系统健康检查
node scripts/maintenance/healthcheck.js
```

---

## ⚠️ 注意事项

1. **生产环境谨慎使用**:
   - `init-production-db.js` 会重置数据库
   - `reset-to-123456.js` 仅用于开发环境

2. **执行顺序**:
   - 初始化脚本有依赖关系，按推荐流程执行

3. **权限要求**:
   - 某些脚本需要数据库管理员权限

4. **备份数据**:
   - 执行破坏性操作前先备份数据库

---

**最后更新**: 2025-10-05
**维护者**: Cretas 开发团队
