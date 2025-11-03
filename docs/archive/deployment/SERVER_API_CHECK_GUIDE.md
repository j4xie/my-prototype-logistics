# 服务器API检查和对接指南

## 🚨 当前问题

**症状**: 前端显示"使用Mock数据 - 工厂列表"
**原因**: 无法连接到服务器 `http://47.251.121.76:10010`

---

## ✅ 问题1: 导航错误 - 已修复

**错误**: `The action 'NAVIGATE' with payload {"name":"UserManagement"} was not handled`

**解决**: 已将 `UserManagement` 和 `WhitelistManagement` 添加到 `PlatformStackNavigator`

**修改文件**: [PlatformStackNavigator.tsx](frontend/CretasFoodTrace/src/navigation/PlatformStackNavigator.tsx)

---

## 🔍 问题2: 为什么使用Mock数据？

### 现状分析

**服务器无法访问的可能原因**:

1. **服务器未启动**
   - Spring Boot后端可能没有运行
   - 检查命令: `ps aux | grep cretas-backend-system`

2. **网络/防火墙问题**
   - 端口10010可能未开放
   - 服务器IP可能不对

3. **服务器地址配置错误**
   - 文档中有两个地址：
     - `106.14.165.234:10010` (宝塔面板服务器)
     - `47.251.121.76:10010` (应用服务器)

---

## 📋 检查服务器状态步骤

### 步骤1: 检查Spring Boot是否运行

SSH登录到服务器后执行：

```bash
# 检查进程
ps aux | grep cretas-backend-system

# 查看日志
tail -f /www/wwwroot/cretas/cretas-backend.log

# 检查端口是否监听
netstat -tuln | grep 10010
```

### 步骤2: 测试两个服务器地址

```bash
# 测试应用服务器
curl -X POST "http://47.251.121.76:10010/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testadmin","password":"123456","factoryId":"FISH_2025_001"}'

# 测试宝塔面板服务器
curl -X POST "http://106.14.165.234:10010/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testadmin","password":"123456","factoryId":"FISH_2025_001"}'
```

### 步骤3: 如果服务器未运行，启动它

```bash
cd /www/wwwroot/cretas
bash restart.sh
```

或手动启动：

```bash
cd /www/wwwroot/cretas
nohup java -jar cretas-backend-system-1.0.0.jar --server.port=10010 > cretas-backend.log 2>&1 &
```

---

## 🔧 当前配置情况

### API配置文件

**文件**: `frontend/CretasFoodTrace/src/constants/config.ts`

**当前配置**:
```typescript
export const API_BASE_URL = 'http://47.251.121.76:10010';
```

### 三种可能的解决方案

#### 方案1: 使用宝塔面板服务器（如果应用服务器不可用）

```typescript
// config.ts
export const API_BASE_URL = 'http://106.14.165.234:10010';
```

#### 方案2: 使用应用服务器（推荐）

```typescript
// config.ts
export const API_BASE_URL = 'http://47.251.121.76:10010';
```

前提：需要确保Spring Boot后端在应用服务器上运行

#### 方案3: 暂时使用Mock数据（开发阶段）

保持现状，继续使用Mock数据开发前端，等服务器配置好后再切换。

---

## 📊 各模块API对接状态

### ✅ 已准备好的API客户端（一旦服务器可用即可使用）

| 模块 | API客户端 | 服务器端点 | 状态 |
|-----|----------|-----------|------|
| 用户管理 | userApiClient.ts | `/api/{factoryId}/users/*` | ✅ 已实现 |
| 白名单管理 | whitelistApiClient.ts | `/api/{factoryId}/whitelist/*` | ✅ 已实现 |
| AI配额管理 | platformApiClient.ts | `/api/platform/ai-quota` | ⚠️ 有Mock兜底 |

### ❌ 使用Mock数据的模块（服务器API未确认）

| 模块 | Mock位置 | 需要的API | 状态 |
|-----|---------|----------|------|
| 工厂管理 | FactoryManagementScreen.tsx:19 | `/api/platform/factories` | ❓ 待确认 |

---

## 🚀 快速验证API可用性

创建一个测试脚本验证所有API：

```bash
#!/bin/bash

# 设置服务器地址（二选一）
# SERVER="http://47.251.121.76:10010"
SERVER="http://106.14.165.234:10010"

echo "测试服务器: $SERVER"
echo ""

# 1. 测试登录
echo "1. 测试登录接口..."
LOGIN_RESP=$(curl -s -X POST "$SERVER/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testadmin","password":"123456","factoryId":"FISH_2025_001"}')

if [ -z "$LOGIN_RESP" ]; then
    echo "❌ 服务器无响应"
    exit 1
fi

echo "✅ 登录成功"
TOKEN=$(echo "$LOGIN_RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo "Token: ${TOKEN:0:30}..."
echo ""

# 2. 测试用户管理API
echo "2. 测试用户管理接口..."
USER_RESP=$(curl -s -X GET "$SERVER/api/FISH_2025_001/users?page=0&size=5" \
  -H "Authorization: Bearer $TOKEN")

if echo "$USER_RESP" | grep -q "content"; then
    echo "✅ 用户管理API可用"
else
    echo "❌ 用户管理API不可用"
fi
echo ""

# 3. 测试白名单API
echo "3. 测试白名单接口..."
WL_RESP=$(curl -s -X GET "$SERVER/api/FISH_2025_001/whitelist?page=0&size=5" \
  -H "Authorization: Bearer $TOKEN")

if echo "$WL_RESP" | grep -q "content"; then
    echo "✅ 白名单API可用"
else
    echo "❌ 白名单API不可用"
fi
echo ""

# 4. 测试工厂管理API
echo "4. 测试工厂管理接口..."
FAC_RESP=$(curl -s -X GET "$SERVER/api/platform/factories" \
  -H "Authorization: Bearer $TOKEN")

if [ ! -z "$FAC_RESP" ] && [ "$FAC_RESP" != "null" ]; then
    echo "✅ 工厂管理API可用"
else
    echo "⚠️ 工厂管理API未实现（使用Mock数据）"
fi
echo ""

# 5. 测试AI配额API
echo "5. 测试AI配额接口..."
AI_RESP=$(curl -s -X GET "$SERVER/api/platform/ai-quota" \
  -H "Authorization: Bearer $TOKEN")

if [ ! -z "$AI_RESP" ] && [ "$AI_RESP" != "null" ]; then
    echo "✅ AI配额API可用"
else
    echo "⚠️ AI配额API未实现（使用Mock数据）"
fi
```

---

## 💡 建议的解决方案

### 短期方案（立即可用）

1. **先确认哪个服务器可用**
   ```bash
   # 测试应用服务器
   curl -I http://47.251.121.76:10010/api/auth/login

   # 测试宝塔面板服务器
   curl -I http://106.14.165.234:10010/api/auth/login
   ```

2. **更新config.ts使用可用的服务器**
   ```typescript
   // 使用实际可用的服务器地址
   export const API_BASE_URL = 'http://可用的服务器地址:10010';
   ```

3. **重启React Native应用**
   ```bash
   cd frontend/CretasFoodTrace
   npx expo start --clear
   ```

### 长期方案（推荐）

1. **确保Spring Boot后端稳定运行**
   - 配置系统服务（systemd）
   - 设置自动重启
   - 配置监控和日志

2. **API完整性检查**
   - 确认所有API都已实现
   - 对于未实现的API，可以保持Mock数据

3. **环境配置**
   - 开发环境：使用Mock数据
   - 生产环境：使用真实API

---

## 📝 已修复的问题

### ✅ 导航配置已修复

**修改内容**:
- 添加了 `UserManagement` 路由
- 添加了 `WhitelistManagement` 路由
- 更新了类型定义

**受影响文件**:
- `frontend/CretasFoodTrace/src/navigation/PlatformStackNavigator.tsx`

**现在可用的导航**:
- ✅ 工厂管理
- ✅ 用户管理
- ✅ 白名单管理
- ✅ AI配额管理

---

## 🎯 下一步行动

1. **立即检查**: 确定哪个服务器地址可用
2. **更新配置**: 在 config.ts 中使用正确的服务器地址
3. **测试API**: 使用上述脚本测试所有API
4. **决定策略**:
   - 如果API可用 → 使用真实API
   - 如果API不可用 → 继续使用Mock数据开发

---

**最后更新**: 2025-11-02
**状态**: 等待服务器连接确认
