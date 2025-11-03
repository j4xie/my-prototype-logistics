# 测试账号信息

## 🏭 工厂信息

- **工厂ID**: `F001`
- **工厂名称**: 测试工厂
- **地址**: 北京市朝阳区建国路XX号
- **联系人**: 张经理
- **联系电话**: 010-12345678

---

## 👥 测试账号列表

**所有账号统一密码**: `123456`

### 1. 工厂用户 (Factory Users)

| 用户名 | 密码 | 角色 | 部门 | 职位 | 权限描述 |
|--------|------|------|------|------|---------|
| `perm_admin` | `123456` | permission_admin | management | 权限管理 | 权限管理员，可管理用户权限 |
| `proc_admin` | `123456` | department_admin | processing | 加工部主管 | 加工部门管理员 |
| `farm_admin` | `123456` | department_admin | farming | 养殖部主管 | 养殖部门管理员 |
| `logi_admin` | `123456` | department_admin | logistics | 物流部主管 | 物流部门管理员 |
| `proc_user` | `123456` | operator | processing | 加工操作员 | 加工部门操作员 |

### 2. 平台用户 (Platform Users)

| 用户名 | 密码 | 角色 | 邮箱 | 电话 | 权限描述 |
|--------|------|------|------|------|---------|
| `admin` | `123456` | super_admin | admin@cretas.com | 18800000001 | 超级管理员，拥有所有权限 |
| `developer` | `123456` | developer | developer@cretas.com | 18800000002 | 系统开发者账号 |
| `platform_admin` | `123456` | platform_admin | platform@cretas.com | 18800000003 | 平台管理员账号 |

---

## 🧪 推荐测试账号

### React Native App测试

#### 推荐账号1: 加工管理员 (最常用)
```
用户名: proc_admin
密码: 123456
工厂ID: F001
角色: department_admin
权限: 加工部门所有功能，包括Dashboard
```

**适用场景**:
- ✅ 测试Dashboard功能
- ✅ 测试生产批次管理
- ✅ 测试原材料管理
- ✅ 测试质检功能

#### 推荐账号2: 加工操作员
```
用户名: proc_user
密码: 123456
工厂ID: F001
角色: operator
权限: 基础操作功能
```

**适用场景**:
- ✅ 测试打卡功能
- ✅ 测试生产操作
- ✅ 测试普通用户视图

#### 推荐账号3: 权限管理员
```
用户名: perm_admin
密码: 123456
工厂ID: F001
角色: permission_admin
权限: 用户和权限管理
```

**适用场景**:
- ✅ 测试用户管理
- ✅ 测试白名单管理
- ✅ 测试权限分配

---

## 📱 React Native登录步骤

1. **打开应用**
2. **输入用户名**: `proc_admin`
3. **输入密码**: `123456`
4. **点击登录**

**注意**: 不需要输入工厂ID，系统会自动使用 `F001`

---

## 🔗 API测试

### 登录API测试

```bash
# 加工管理员登录
curl -X POST "http://106.14.165.234:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"proc_admin","password":"123456","factoryId":"F001"}'

# 平台管理员登录
curl -X POST "http://106.14.165.234:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'
```

### Dashboard API测试 (需要先登录获取Token)

```bash
# 1. 登录获取Token
TOKEN=$(curl -s -X POST "http://106.14.165.234:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"proc_admin","password":"123456","factoryId":"F001"}' \
  | jq -r '.data.accessToken')

# 2. 测试Dashboard Overview
curl -X GET "http://106.14.165.234:10010/api/mobile/F001/processing/dashboard/overview" \
  -H "Authorization: Bearer $TOKEN"

# 3. 测试Dashboard Production
curl -X GET "http://106.14.165.234:10010/api/mobile/F001/processing/dashboard/production" \
  -H "Authorization: Bearer $TOKEN"

# 4. 测试Dashboard Equipment
curl -X GET "http://106.14.165.234:10010/api/mobile/F001/processing/dashboard/equipment" \
  -H "Authorization: Bearer $TOKEN"

# 5. 测试Dashboard Quality
curl -X GET "http://106.14.165.234:10010/api/mobile/F001/processing/dashboard/quality" \
  -H "Authorization: Bearer $TOKEN"
```

---

## ⚠️ 注意事项

1. **工厂ID必须使用 `F001`**
   - ❌ 错误: `FISH_2025_001`
   - ✅ 正确: `F001`

2. **密码加密**
   - 数据库存储: BCrypt Hash
   - 原始密码: `123456`
   - Hash值: `$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW`

3. **角色命名**
   - 后端使用: `permission_admin`, `department_admin`, `operator`
   - 前端显示: 根据roleNameMap映射

4. **权限检查**
   - Dashboard接口需要至少 `operator` 角色
   - 用户管理需要 `permission_admin` 角色
   - 平台功能需要平台管理员角色

---

## 🔧 数据库初始化

如果账号不存在，使用以下SQL初始化：

```bash
# SSH到服务器
ssh root@106.14.165.234

# 连接数据库
mysql -u root -p cretas

# 执行初始化脚本
source /www/wwwroot/cretas/init-final-users.sql
```

---

## 📊 账号权限矩阵

| 功能模块 | proc_admin | perm_admin | proc_user | admin |
|---------|-----------|-----------|----------|-------|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| 生产批次管理 | ✅ | ❌ | ⚠️ (只读) | ✅ |
| 原材料管理 | ✅ | ❌ | ⚠️ (只读) | ✅ |
| 质检管理 | ✅ | ❌ | ⚠️ (只读) | ✅ |
| 用户管理 | ❌ | ✅ | ❌ | ✅ |
| 白名单管理 | ❌ | ✅ | ❌ | ✅ |
| 平台管理 | ❌ | ❌ | ❌ | ✅ |
| 考勤打卡 | ✅ | ✅ | ✅ | ❌ |
| 个人中心 | ✅ | ✅ | ✅ | ✅ |

---

**最后更新**: 2025-11-02
**工厂ID**: F001
**统一密码**: 123456
