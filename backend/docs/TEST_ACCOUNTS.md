# 测试账号清单

**统一密码**: `123456`

## 🏢 平台用户账号 (Platform Users)

### 1. 系统开发者 (System Developer)
```
用户名: developer
密码: 123456
角色: system_developer
权限级别: -1 (最高)
邮箱: dev@cretas.com
```
**权限**: 全系统所有权限

---

### 2. 平台超级管理员 (Platform Super Admin)
```
用户名: platform_admin
密码: 123456
角色: platform_super_admin
权限级别: 0
邮箱: platform@cretas.com
```
**权限**: 管理所有工厂、平台用户管理

---

### 3. 平台操作员 (Platform Operator)
```
用户名: admin
密码: 123456
角色: platform_operator
权限级别: 1
邮箱: admin@cretas.com
```
**权限**: 查看所有工厂数据、基础平台操作

---

## 🏭 工厂用户账号 (Factory Users)

**工厂ID**: `TEST_FACTORY_001`
**工厂名称**: 测试工厂

### 1. 工厂超级管理员 (Factory Super Admin)
```
用户名: super_admin
密码: 123456
角色: factory_super_admin
权限级别: 0
部门: management (管理部)
工厂ID: TEST_FACTORY_001
```
**权限**: 工厂内所有权限

---

### 2. 权限管理员 (Permission Admin)
```
用户名: perm_admin
密码: 123456
角色: permission_admin
权限级别: 5
部门: management (管理部)
工厂ID: TEST_FACTORY_001
```
**权限**: 用户权限管理、角色分配

---

### 3. 加工部管理员 (Processing Department Admin)
```
用户名: proc_admin
密码: 123456
角色: department_admin
权限级别: 10
部门: processing (加工部)
工厂ID: TEST_FACTORY_001
```
**权限**: 加工部门管理

---

### 4. 养殖部管理员 (Farming Department Admin)
```
用户名: farm_admin
密码: 123456
角色: department_admin
权限级别: 10
部门: farming (养殖部)
工厂ID: TEST_FACTORY_001
```
**权限**: 养殖部门管理

---

### 5. 物流部管理员 (Logistics Department Admin)
```
用户名: logi_admin
密码: 123456
角色: department_admin
权限级别: 10
部门: logistics (物流部)
工厂ID: TEST_FACTORY_001
```
**权限**: 物流部门管理

---

### 6. 加工操作员 (Processing Operator)
```
用户名: proc_user
密码: 123456
角色: operator
权限级别: 30
部门: processing (加工部)
工厂ID: TEST_FACTORY_001
```
**权限**: 基础业务操作、数据录入

---

## 🏭 其他工厂

### 黑牛食品测试工厂
```
工厂ID: TEST_2024_001
工厂名称: 黑牛食品测试工厂
状态: 激活
```

---

## 🔐 登录方式

### 平台用户登录
```bash
# API: POST /api/auth/platform-login
curl -X POST http://localhost:3001/api/auth/platform-login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "developer",
    "password": "123456"
  }'
```

### 工厂用户登录
```bash
# API: POST /api/auth/login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "super_admin",
    "password": "123456",
    "factoryId": "TEST_FACTORY_001"
  }'
```

### 移动端统一登录
```bash
# API: POST /api/mobile/auth/unified-login
curl -X POST http://localhost:3001/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "super_admin",
    "password": "123456",
    "deviceInfo": {
      "deviceId": "test-device-123",
      "deviceModel": "Test Device",
      "platform": "ios",
      "osVersion": "17.0"
    }
  }'
```

---

## 📱 React Native 测试建议

### 1. 平台用户测试
测试账号: `developer` / `123456`
- 应该看到: 8个Tab (包括developer tab)
- 可以访问: 所有功能

### 2. 平台管理员测试
测试账号: `platform_admin` / `123456`
- 应该看到: 2个Tab (home, platform)
- 可以访问: 工厂管理、用户管理

### 3. 工厂超管测试
测试账号: `super_admin` / `123456`
- 工厂ID: `TEST_FACTORY_001`
- 应该看到: 6个Tab (home, farming, processing, logistics, trace, admin)
- 可以访问: 工厂所有业务功能

### 4. 部门管理员测试
测试账号: `proc_admin` / `123456`
- 工厂ID: `TEST_FACTORY_001`
- 应该看到: 5个Tab (home, farming, processing, logistics, trace)
- 可以访问: 加工部门业务

### 5. 操作员测试
测试账号: `proc_user` / `123456`
- 工厂ID: `TEST_FACTORY_001`
- 应该看到: 4个Tab (home, farming, processing, logistics)
- 可以访问: 基础业务操作

---

## 🔄 重置密码

如果需要重置所有测试账号密码为 `123456`:

```bash
cd backend
node scripts/reset-to-123456.js
```

或者使用其他密码:
```bash
node scripts/reset-test-passwords.js
```

---

## 📊 角色权限对照表

| 账号 | 角色 | 级别 | 用户类型 | Tab数量 | 可见Tab |
|------|------|------|----------|---------|---------|
| developer | system_developer | -1 | platform | 8 | 全部 |
| platform_admin | platform_super_admin | 0 | platform | 2 | home, platform |
| admin | platform_operator | 1 | platform | 2 | home, platform |
| super_admin | factory_super_admin | 0 | factory | 6 | home, farming, processing, logistics, trace, admin |
| perm_admin | permission_admin | 5 | factory | 6 | home, farming, processing, logistics, trace, admin |
| proc_admin | department_admin | 10 | factory | 5 | home, farming, processing, logistics, trace |
| farm_admin | department_admin | 10 | factory | 5 | home, farming, processing, logistics, trace |
| logi_admin | department_admin | 10 | factory | 5 | home, farming, processing, logistics, trace |
| proc_user | operator | 30 | factory | 4 | home, farming, processing, logistics |

---

## 🧪 测试用例

### 用例1: 开发者登录
```javascript
{
  username: "developer",
  password: "123456"
}
// 预期: 成功登录,看到所有Tab
```

### 用例2: 工厂超管登录
```javascript
{
  username: "super_admin",
  password: "123456",
  factoryId: "TEST_FACTORY_001"  // 移动端会自动处理
}
// 预期: 成功登录,看到6个Tab
```

### 用例3: 操作员登录
```javascript
{
  username: "proc_user",
  password: "123456"
}
// 预期: 成功登录,看到4个Tab
```

### 用例4: 错误的工厂ID
```javascript
{
  username: "super_admin",
  password: "123456",
  factoryId: "WRONG_FACTORY"
}
// 预期: 登录失败,提示工厂不存在
```

---

**更新时间**: 2025-01-03
**密码策略**: 所有测试账号统一使用 `123456` 便于测试
**生产环境**: 请务必修改为强密码!
