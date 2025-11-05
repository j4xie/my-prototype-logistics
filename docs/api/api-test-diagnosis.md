# API测试诊断报告

**测试时间**: 2025-01-18
**测试服务器**: http://47.251.121.76:10010
**本地数据库**: cretas_db

---

## 🔍 问题诊断

### 发现的问题

#### 问题1: Factory ID配置不一致

**现状**:
- 代码中使用: `TEST_2024_001`
- 数据库实际: `CRETAS_2024_001`

**位置**:
- `frontend/CretasFoodTrace/src/constants/config.ts` - DEFAULT_FACTORY_ID
- 所有API Client中的DEFAULT_FACTORY_ID常量

**影响**: 所有需要factoryId的API调用都会失败

**已修复**: ✅ 测试时已使用正确的CRETAS_2024_001

---

#### 问题2: 远程服务器密码未知

**测试账号**（您提供）:
```
platform_admin / 123456
super_admin / 123456
dept_admin / 123456
operator1 / 123456
```

**数据库查询结果**（本地）:
```sql
-- users表
username: super_admin, role: factory_super_admin, factory_id: CRETAS_2024_001 ✅
username: dept_admin, role: department_admin, factory_id: CRETAS_2024_001 ✅
username: operator1, role: operator, factory_id: CRETAS_2024_001 ✅

-- platform_admins表
username: platform_admin, role: platform_admin ✅
```

**Seed脚本确认**:
```javascript
const password = '123456';  ✅ 本地数据库密码确实是123456
const hashedPassword = await bcrypt.hash(password, 12);
```

**登录测试结果**（远程服务器）:
```
platform_admin / 123456 → ❌ "工厂ID不能为空"
super_admin / 123456 / CRETAS_2024_001 → ❌ "用户名或密码错误"
dept_admin / 123456 / CRETAS_2024_001 → ❌ "用户名或密码错误"
operator1 / 123456 / CRETAS_2024_001 → ❌ "用户名或密码错误"
```

**结论**:
- ✅ 远程服务器API正常运行
- ✅ 请求格式正确
- ❌ **远程服务器的密码不是"123456"**
- ❌ 或者远程服务器的用户名不同

---

### 问题3: 平台管理员登录必须要factoryId？

**API返回**: "工厂ID不能为空"

**分析**:
- 平台管理员理论上不应该需要factoryId
- 但远程服务器要求提供factoryId

**可能原因**:
- 远程服务器的后端代码版本不同
- 或者平台管理员也需要关联一个默认工厂

---

## 💡 解决方案

### 方案A: 获取远程服务器的正确密码（推荐）

**操作**:
1. 联系远程服务器管理员
2. 获取47.251.121.76:10010的实际测试账号密码
3. 或者让管理员重置密码为"123456"

**优点**:
- 可以测试真实的远程API
- 验证前端代码与远程后端的兼容性

---

### 方案B: 使用本地后端服务器测试

**操作**:
```bash
# 1. 启动本地MySQL
mysql.server start

# 2. 运行seed脚本（密码是123456）
cd backend
node seed-final-4-users.js

# 3. 启动本地后端
npm run dev

# 4. 更新前端API_BASE_URL
// frontend/CretasFoodTrace/src/constants/config.ts
export const API_BASE_URL = 'http://localhost:3001/api';

# 5. 使用账号测试
用户名: super_admin
密码: 123456
工厂ID: CRETAS_2024_001
```

**优点**:
- 完全控制测试环境
- 密码已知且可重置
- 可以查看后端日志调试

**缺点**:
- 需要启动本地服务

---

### 方案C: 使用Mock数据测试前端（快速验证）

**操作**:
```typescript
// 已创建Mock数据文件
import MockData from '@/services/mockData';

// 在API Client中添加Mock模式
if (__DEV__ && USE_MOCK_DATA) {
  return { success: true, data: MockData.users };
}
```

**优点**:
- 不依赖后端
- 可以立即测试所有Screen功能
- 快速验证UI和交互逻辑

**缺点**:
- 不能验证真实API集成

---

### 方案D: 重置远程服务器密码（需要后端配合）

**SQL脚本**（后端执行）:
```sql
-- 重置所有测试账号密码为123456
-- bcrypt哈希需要在Node.js中生成

-- 或者创建新的测试用户
INSERT INTO users (username, password_hash, full_name, factory_id, role_code, department, is_active)
VALUES ('test_user', '$2b$12$[bcrypt_hash_of_123456]', '测试用户', 'CRETAS_2024_001', 'operator', 'processing', 1);
```

---

## 🎯 推荐行动

### 立即行动（选择一个）

**选项1**: 您告诉我远程服务器的正确密码
- 我立即用正确密码测试所有API
- 验证所有Screen功能

**选项2**: 使用本地后端测试
```bash
# 我帮您：
1. 启动本地后端服务器
2. 更新前端配置指向localhost:3001
3. 使用密码"123456"测试所有功能
```

**选项3**: 先用Mock数据测试前端
- 验证所有Screen的UI和交互
- 等后端密码确认后再实际对接

---

## 📋 已发现的配置问题清单

| 问题 | 位置 | 当前值 | 应该是 | 状态 |
|------|------|--------|--------|------|
| DEFAULT_FACTORY_ID | frontend常量 | TEST_2024_001 | CRETAS_2024_001 | ⚠️ 需修复 |
| 远程服务器密码 | - | 未知 | ? | ❓ 需确认 |
| platform_admin需要factoryId | 远程API | 需要 | 不需要？ | ❓ 需确认 |

---

## 🔧 需要您决定

请告诉我您希望：

**A**: 给我远程服务器(47.251.121.76:10010)的正确账号密码
   → 我立即测试所有API

**B**: 使用本地后端测试
   → 我启动本地服务并配置前端

**C**: 先用Mock数据验证前端功能
   → 我集成Mock数据到所有Screen

选择哪个方案，我马上执行！
