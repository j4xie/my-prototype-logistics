# 新服务器初始化指南

## 服务器信息

**新服务器地址**: `http://139.196.165.140:10010`
**前端已配置**: ✅ 已更新 `frontend/CretasFoodTrace/src/constants/config.ts`

---

## 当前状态

### ✅ 前端配置已完成

**文件**: `frontend/CretasFoodTrace/src/constants/config.ts`

```typescript
export const API_BASE_URL = 'http://139.196.165.140:10010';
export const DEFAULT_FACTORY_ID = 'F001';
```

### ❌ 后端数据库需要初始化

**测试结果**:
```bash
curl -X POST "http://139.196.165.140:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"proc_admin","password":"123456","factoryId":"F001"}'

# 响应:
{"code":400,"message":"用户名或密码错误","data":null}
```

**原因**: 数据库中还没有测试账户

---

## 数据库初始化步骤

### 方案1: SSH登录服务器手动执行SQL

#### 步骤1: SSH登录服务器
```bash
ssh root@139.196.165.140
```

#### 步骤2: 上传SQL文件

**本地SQL文件位置**:
```
~/Downloads/cretas-backend-system-main/fix-document/init-final-users.sql
```

**上传命令** (在本地执行):
```bash
scp ~/Downloads/cretas-backend-system-main/fix-document/init-final-users.sql \
  root@139.196.165.140:/www/wwwroot/cretas/
```

#### 步骤3: 登录MySQL
```bash
mysql -u root -p
```

输入MySQL root密码后：
```sql
-- 选择数据库
USE cretas;

-- 执行SQL文件
SOURCE /www/wwwroot/cretas/init-final-users.sql;

-- 验证数据
SELECT id, factory_id, username, role_code, department FROM users;
SELECT id, name, address FROM factories WHERE id = 'F001';

-- 退出
EXIT;
```

#### 步骤4: 验证后端服务
```bash
# 检查Spring Boot是否运行
ps aux | grep cretas-backend-system

# 如果未运行，启动它
cd /www/wwwroot/cretas
bash restart.sh

# 或手动启动
nohup java -jar cretas-backend-system-1.0.0.jar --server.port=10010 > cretas-backend.log 2>&1 &

# 查看日志
tail -f /www/wwwroot/cretas/cretas-backend.log
```

---

### 方案2: 使用宝塔面板MySQL管理

#### 步骤1: 登录宝塔面板
- 打开浏览器访问宝塔面板: `https://139.196.165.140:8888`
- 输入宝塔面板账号密码登录

#### 步骤2: 进入数据库管理
1. 左侧菜单点击"数据库"
2. 找到 `cretas` 数据库
3. 点击"管理"按钮进入phpMyAdmin

#### 步骤3: 导入SQL文件
1. 选择 `cretas` 数据库
2. 点击顶部"导入"标签
3. 点击"选择文件"
4. 选择本地文件: `~/Downloads/cretas-backend-system-main/fix-document/init-final-users.sql`
5. 点击"执行"按钮

#### 步骤4: 验证数据
在SQL标签中执行：
```sql
SELECT id, factory_id, username, role_code, department FROM users;
SELECT id, name, address FROM factories WHERE id = 'F001';
```

---

## 初始化后的测试账户

执行SQL后，以下账户将可用：

### 工厂用户 (Factory Users)

| 用户名 | 密码 | 工厂ID | 角色 | 部门 | 用途 |
|--------|------|--------|------|------|------|
| `proc_admin` | `123456` | `F001` | department_admin | processing | 加工部主管 |
| `perm_admin` | `123456` | `F001` | permission_admin | management | 权限管理员 |
| `farm_admin` | `123456` | `F001` | department_admin | farming | 养殖部主管 |
| `logi_admin` | `123456` | `F001` | department_admin | logistics | 物流部主管 |
| `proc_user` | `123456` | `F001` | operator | processing | 加工操作员 |

### 平台用户 (Platform Users)

| 用户名 | 密码 | 角色 | 用途 |
|--------|------|------|------|
| `admin` | `123456` | platform_super_admin | 平台超级管理员 |
| `developer` | `123456` | system_developer | 系统开发者 |
| `platform_admin` | `123456` | platform_super_admin | 平台管理员 |

### 白名单 (Whitelist)

| 手机号 | 工厂ID | 角色 | 有效期 |
|--------|--------|------|--------|
| `13900000001` | `F001` | operator | 2025-12-31 |
| `13900000002` | `F001` | department_admin | 2025-12-31 |
| `13900000003` | `F001` | factory_super_admin | 2025-12-31 |

---

## 验证步骤

### 步骤1: 测试登录API

在本地执行测试脚本：
```bash
cd /Users/jietaoxie/my-prototype-logistics
bash test_server_106.sh
```

**期望结果**:
```
✅ Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 步骤2: 测试Dashboard API

如果登录成功，脚本会自动测试Dashboard接口并显示数据：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "batchStatusDistribution": [...],
    "productTypeStats": [...],
    "dailyTrends": [...]
  }
}
```

### 步骤3: 测试React Native应用

```bash
cd frontend/CretasFoodTrace
npx expo start --clear
```

然后在应用中：
1. 使用 `proc_admin` / `123456` / `F001` 登录
2. 查看首页Dashboard
3. 确认数据正常显示（不是全0）

---

## SQL文件内容概览

**文件**: `~/Downloads/cretas-backend-system-main/fix-document/init-final-users.sql`
**大小**: 8.0KB (217行)

### 创建的数据

1. **1个测试工厂** (`F001`)
   - 名称: 测试工厂
   - 地址: 北京市朝阳区建国路XX号
   - AI配额: 20次/周

2. **5个工厂用户** (proc_admin, perm_admin, farm_admin, logi_admin, proc_user)
   - 所有密码: `123456`
   - BCrypt Hash: `$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW`

3. **3个平台管理员** (admin, developer, platform_admin)
   - 所有密码: `123456`

4. **3个白名单条目**
   - 用于测试注册流程
   - 有效期至2025-12-31

---

## 常见问题

### Q1: 如果SQL执行失败怎么办？

**可能原因**:
- 表已存在数据（重复的主键）
- 外键约束失败

**解决方案**:
```sql
-- 1. 先清空相关表（谨慎操作！）
DELETE FROM users WHERE factory_id = 'F001';
DELETE FROM factories WHERE id = 'F001';
DELETE FROM user_whitelist WHERE factory_id = 'F001';
DELETE FROM platform_admins WHERE username IN ('admin', 'developer', 'platform_admin');

-- 2. 重新执行SQL
SOURCE /www/wwwroot/cretas/init-final-users.sql;
```

### Q2: 登录仍然失败？

**检查步骤**:
```sql
-- 1. 确认用户存在
SELECT username, factory_id, role_code FROM users WHERE username = 'proc_admin';

-- 2. 确认工厂存在
SELECT id, name FROM factories WHERE id = 'F001';

-- 3. 检查密码hash
SELECT username, password_hash FROM users WHERE username = 'proc_admin';
-- 应该是: $2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW
```

### Q3: Dashboard仍然返回403？

**可能原因**:
- 用户角色权限不足
- Spring Security配置问题

**检查后端日志**:
```bash
tail -100 /www/wwwroot/cretas/cretas-backend.log | grep -E "(403|Forbidden|Access)"
```

### Q4: Dashboard返回全0数据？

**正常情况**: 新数据库没有生产数据，返回0是正常的

**解决方案**: 可以添加一些测试数据：
```sql
-- 添加测试生产批次
INSERT INTO processing_batch (factory_id, batch_code, status, quantity, created_at, updated_at)
VALUES ('F001', 'BATCH001', 'COMPLETED', 100.5, NOW(), NOW());

INSERT INTO processing_batch (factory_id, batch_code, status, quantity, created_at, updated_at)
VALUES ('F001', 'BATCH002', 'IN_PROGRESS', 85.0, NOW(), NOW());
```

---

## 成功标志

完成初始化后，您应该看到：

✅ **登录成功**
```bash
bash test_server_106.sh
# 输出: ✅ Token: eyJhbGci...
```

✅ **Dashboard API正常响应**
```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

✅ **React Native应用正常登录和显示**
- 登录页面成功登录
- 首页Dashboard显示数据（即使是0也说明API正常）
- 没有403错误

---

## 下一步

初始化完成后：

1. **前端开发**: 继续React Native功能开发
2. **添加测试数据**: 根据需要添加生产批次、设备、质检等测试数据
3. **集成测试**: 完整测试所有功能模块
4. **生产部署**: 准备生产环境部署

---

**最后更新**: 2025-11-03
**服务器**: 139.196.165.140:10010
**状态**: 等待数据库初始化
