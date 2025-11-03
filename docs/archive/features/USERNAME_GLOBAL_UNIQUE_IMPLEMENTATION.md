# 用户名全局唯一实现完成

**实现时间**: 2025-11-03
**目的**: 工厂用户登录时无需提供factoryId

---

## ✅ 已完成的修改

### 1. 数据库层修改

**修改内容**: 将用户名唯一约束从`(factory_id, username)`改为`(username)`

**修改前**:
```sql
UNIQUE KEY `UKj23xwpgj9f33pl1t5uu18ajoa` (`factory_id`,`username`)
```
- 允许不同工厂有相同的用户名
- 例如：F001的proc_admin 和 F002的proc_admin 可以共存

**修改后**:
```sql
UNIQUE KEY `idx_username_unique` (`username`)
```
- **用户名全局唯一**
- 例如：proc_admin只能存在一个，无论在哪个工厂

---

### 2. Java实体类修改

**文件**: `User.java`

**修改位置**: `@Table` 注解

**修改前**:
```java
@Table(name = "users",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = {"factory_id", "username"})
       },
       // ...
)
```

**修改后**:
```java
@Table(name = "users",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = {"username"})  // 全局唯一
       },
       indexes = {
           @Index(name = "idx_factory_username", columnList = "factory_id, username"),
           @Index(name = "idx_active_users", columnList = "is_active, factory_id"),
           @Index(name = "idx_username", columnList = "username")  // 加速查询
       }
)
```

---

## 🎯 效果

### 修改前（需要factoryId）

```bash
# ❌ 不提供factoryId - 如果有多个同名用户会报错
curl -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -d '{"username":"proc_admin","password":"123456"}'
# 返回：存在多个同名用户，请提供工厂ID进行登录

# ✅ 必须提供factoryId
curl -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -d '{"username":"proc_admin","password":"123456","factoryId":"F001"}'
```

---

### 修改后（不需要factoryId）

```bash
# ✅ 不提供factoryId - 自动找到唯一的用户
curl -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -d '{"username":"proc_admin","password":"123456"}'
  
# 响应：
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "userId": 1,
    "username": "proc_admin",
    "factoryId": "F001",  // ✅ 自动推断
    "factoryName": "测试工厂",
    "role": "department_admin",
    "token": "eyJhbGci..."
  }
}
```

---

## 📋 数据库迁移SQL

**文件**: `fix-document/add-global-username-unique.sql`

```sql
USE cretas;

-- 1. 检查重复用户名（应该没有）
SELECT username, COUNT(*) as count, GROUP_CONCAT(factory_id) as factories
FROM users
GROUP BY username
HAVING COUNT(*) > 1;

-- 2. 删除旧的组合唯一约束
ALTER TABLE users 
DROP INDEX UKj23xwpgj9f33pl1t5uu18ajoa;

-- 3. 添加新的全局唯一约束
ALTER TABLE users
ADD UNIQUE INDEX idx_username_unique (username);

-- 4. 验证
SHOW CREATE TABLE users;
```

**执行状态**: ✅ 已在本地数据库执行成功

---

## 🔄 登录逻辑流程

### 统一登录API: `/api/mobile/auth/unified-login`

```
请求体: {"username":"proc_admin","password":"123456"}
         ↓
1. 检查是否为平台管理员（platform_admins表）
   ├─ 是 → 平台管理员登录
   └─ 否 → 继续
         ↓
2. 检查是否为工厂用户（users表）
   ├─ factoryId提供？
   │   ├─ 是 → 直接查找该工厂的用户
   │   └─ 否 → 查找所有同名用户
   │            ├─ 找到1个 → ✅ 自动推断factoryId
   │            ├─ 找到0个 → ❌ 用户不存在
   │            └─ 找到>1个 → ❌ 现在不可能（已强制唯一）
```

---

## ✅ 测试结果

### 测试1: 工厂用户不提供factoryId

**请求**:
```bash
POST /api/mobile/auth/unified-login
{"username":"proc_admin","password":"123456"}
```

**响应**: ✅ 200 成功
```json
{
  "code": 200,
  "data": {
    "username": "proc_admin",
    "factoryId": "F001",  // 自动推断
    "role": "department_admin"
  }
}
```

---

### 测试2: 平台管理员不提供factoryId

**请求**:
```bash
POST /api/mobile/auth/unified-login
{"username":"platform_admin","password":"123456"}
```

**响应**: ✅ 200 成功
```json
{
  "code": 200,
  "data": {
    "username": "platform_admin",
    "factoryId": null,  // 平台管理员无factoryId
    "role": "super_admin"
  }
}
```

---

### 测试3: 尝试创建重复用户名

**SQL**:
```sql
INSERT INTO users (factory_id, username, password_hash, full_name, is_active, created_at, updated_at)
VALUES ('F002', 'proc_admin', 'test', '重复用户', true, NOW(), NOW());
```

**结果**: ❌ 失败（符合预期）
```
ERROR 1062 (23000): Duplicate entry 'proc_admin' for key 'idx_username_unique'
```

---

## 📊 影响范围

### ✅ 优点

1. **简化前端登录逻辑**
   - 工厂用户登录表单不再需要factoryId字段
   - 减少用户输入，提升用户体验

2. **保证数据一致性**
   - 数据库层面强制用户名唯一
   - 避免运行时错误

3. **简化代码逻辑**
   - 后端不需要处理"多个同名用户"的边界情况
   - 减少if-else判断

### ⚠️ 注意事项

1. **用户名命名规范**
   - 需要为不同工厂的用户设计唯一的用户名
   - 建议格式：`{工厂代码}_{角色}` 或 `{角色}_{序号}`
   - 例如：`f001_admin`, `proc_admin_1`, `proc_admin_2`

2. **现有数据影响**
   - 已检查：当前数据库无重复用户名 ✅
   - 未来创建用户时需要确保用户名唯一

3. **跨工厂用户转移**
   - 如果用户需要转移到另一个工厂，直接更新factory_id即可
   - 用户名保持不变

---

## 🔄 与远程服务器同步

**远程服务器**: 139.196.165.140

### 需要执行的操作

1. **执行SQL脚本**:
```bash
mysql -h <远程数据库> -u <用户> -p < fix-document/add-global-username-unique.sql
```

2. **部署新JAR**:
   - 包含更新后的User.java实体类
   - 确保JPA能正确识别新的唯一约束

---

## 📁 修改的文件

1. **Java代码**:
   - `src/main/java/com/cretas/aims/entity/User.java`

2. **数据库脚本**:
   - `fix-document/add-global-username-unique.sql`

3. **文档**:
   - `USERNAME_GLOBAL_UNIQUE_IMPLEMENTATION.md` (本文档)

---

## 🎯 总结

### ✅ 实现完成

- [x] 数据库添加用户名全局唯一约束
- [x] Java实体类更新
- [x] 本地测试通过
- [x] 登录无需factoryId工作正常

### 📝 后续任务

- [ ] 更新用户注册逻辑（确保用户名唯一性检查）
- [ ] 更新前端登录表单（移除factoryId输入框）
- [ ] 同步到远程服务器

---

**实现时间**: 2025-11-03 01:05
**状态**: ✅ 完成
**测试**: ✅ 通过

