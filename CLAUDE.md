# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is 白垩纪食品溯源系统 (Cretas Food Traceability System), focusing on **React Native mobile app** and **Spring Boot backend API** development:

1. **Spring Boot Backend** (Java 11 + Spring Boot 2.7.15 + MySQL + Spring Data JPA + Hibernate)
2. **React Native Mobile App** (Expo 53+ + TypeScript + React Navigation 7+ + Zustand)
3. **Python AI Service** (DeepSeek API integration for intelligent cost analysis)

## 🔧 Server Management & Deployment

### 宝塔面板API管理

本项目使用**宝塔面板API**进行服务器管理和应用部署。

**重要配置**:
- **宝塔面板地址**: `https://139.196.165.140:16435/a96c4c2e`
- **应用服务器**: 139.196.165.140:10010

**详细使用指南**: 参见 [`.claude/bt-api-guide.md`](./.claude/bt-api-guide.md)

**快速参考**:
```bash
# 1. 生成API签名
python3 << 'EOF'
import hashlib, time
api_sk = "YOUR_API_KEY"
request_time = str(int(time.time()))
md5_api_sk = hashlib.md5(api_sk.encode()).hexdigest()
request_token = hashlib.md5((request_time + md5_api_sk).encode()).hexdigest()
print(f"{request_time}|{request_token}")
EOF

# 2. 调用API (必须使用 -k 参数和 HTTPS)
curl -k -X POST "https://106.14.165.234:8888/system?action=GetSystemTotal" \
  -d "request_time=$REQUEST_TIME" \
  -d "request_token=$REQUEST_TOKEN"
```

### Spring Boot 后端部署

**部署位置**:
- JAR文件: `/www/wwwroot/cretas/cretas-backend-system-1.0.0.jar`
- 日志文件: `/www/wwwroot/cretas/cretas-backend.log`
- 端口: 10010

**部署步骤**:
1. 编译JAR: `mvn clean package -DskipTests`
2. 上传到服务器: `/www/wwwroot/cretas/`
3. 执行重启脚本: `bash /www/wwwroot/cretas/restart.sh`

**重启脚本** (`/www/wwwroot/cretas/restart.sh`):
```bash
#!/bin/bash
cd /www/wwwroot/cretas
ps aux | grep cretas-backend-system | grep -v grep | awk '{print $2}' | xargs -r kill -9
sleep 2
nohup java -jar cretas-backend-system-1.0.0.jar --server.port=10010 > cretas-backend.log 2>&1 &
echo "Started with PID: $!"
```

## 🎯 项目当前状态 (Current Project Status)

**项目阶段**: Phase 1-2 已完成 ✅ | Phase 3 核心完成 ✅🔨 | Phase 4 优化集成中 🔨

**总体完成度**: 约 75-80%

### 当前开发重点

**前后端开发状态**：
- ✅ **前端核心**: 24个页面完成 (Phase 1-2)
- ✅ **后端核心**: 30+ API控制器，85% 核心功能已实现
- ✅ **数据同步**: 离线存储基础设施完成 (70%)
- ✅ **AI分析**: DeepSeek成本分析完整实现 (95%)
- 🔨 **推送通知**: 后端API完成，前端集成中 (60%)
- 🔨 **高级功能**: 生物识别、物流追踪等待Phase 4-5
- ✅ **生产部署**: 服务器运行中 (139.196.165.140:10010)

**待完成功能**: 详见 `PENDING_FEATURES_TODO.md`

### 技术栈概览

**前端 (React Native)**:
- Expo 53+ with TypeScript
- React Navigation 7+ (权限路由)
- Zustand (状态管理)
- React Native Paper (UI组件)

**后端 (Spring Boot)**:
- Java 11 + Spring Boot 2.7.15
- MySQL + Spring Data JPA + Hibernate
- JWT 多角色认证系统
- DeepSeek AI 集成

**部署**:
- 服务器: 139.196.165.140:10010
- 宝塔面板: 自动化部署与管理
- 日志监控: `/www/wwwroot/cretas/cretas-backend.log`

### 📚 文档索引

**主要 PRD 文档**:
- 📘 **[PRD-白垩纪食品溯源系统-完整版.md](./docs/prd/PRD-白垩纪食品溯源系统-完整版.md)** (v5.0) - 超大完整PRD，包含所有功能模块和业务流程
- 📊 [PRD-完整业务流程与界面设计.html](./docs/prd/PRD-完整业务流程与界面设计.html) - 可视化业务流程图
- 🔐 [角色权限和页面访问速查表.md](./docs/prd/角色权限和页面访问速查表.md) - 快速查找权限规则
- 🧭 [导航架构实现指南.md](./docs/prd/导航架构实现指南.md) - 导航开发代码示例

**后端需求文档**:
- 🔧 [`backend/rn-update-tableandlogic.md`](./backend/rn-update-tableandlogic.md) - 前端提出的API和数据库需求清单

**历史归档文档** (已归档，仅供参考):
- 📋 [PRD-实现状态总览](./docs/prd/archive/source-docs/PRD-实现状态总览.md) (已归档)
- 📚 [PRD-系统产品需求文档-v4.0](./docs/prd/archive/source-docs/PRD-系统产品需求文档-v4.0.md) (已归档)
- 🛠️ [PRD-Phase3-完善计划](./docs/prd/archive/source-docs/PRD-Phase3-完善计划.md) (已归档)

---

## Development Commands

### 📱 React Native Development

```bash
cd frontend/CretasFoodTrace
npm install                   # Install dependencies
npm start                     # Start Expo (port 3010)
npx expo start --clear       # Start with cache cleared
npm run android              # Run on Android
npm run ios                  # Run on iOS (macOS only)
```

### 🔧 Backend Development (Spring Boot)

```bash
cd backend-java
mvn clean package -DskipTests           # Build JAR
mvn spring-boot:run                      # Run locally (port 10010)

# Deploy to server
scp target/*.jar root@139.196.165.140:/www/wwwroot/cretas/
ssh root@139.196.165.140 "bash /www/wwwroot/cretas/restart.sh"
```

### ⚠️ Port Configuration

| Service | Port | Environment |
|---------|------|-------------|
| React Native Dev | 3010 | Expo/Metro bundler |
| Spring Boot API | 10010 | Production server |
| MySQL Database | 3306 | Default |

### 🚀 Quick Start

**macOS/Linux**:
```bash
./start-system-macos.sh       # Start all services (macOS)
```

**Windows**:
```bash
# Start services manually (see Manual Setup below)
# Or use WSL2 with the macOS script
```

## Architecture Overview

### Backend Architecture (Spring Boot)
- **Framework**: Spring Boot 2.7.15 with Java 11
- **Database**: MySQL with Spring Data JPA + Hibernate
- **Authentication**: JWT with refresh tokens, 8-role permission system
- **Mobile Support**: Dedicated `/api/mobile/*` REST endpoints for React Native
- **Key Features**:
  - DeepSeek LLM integration for intelligent cost analysis
  - File upload with mobile optimization
  - Device binding and activation system
  - Multi-stage registration with phone verification
- **File Structure**:
  - `/backend-java/src/main/java/com/cretas/aims/`
    - `controller/` - REST controllers (@RestController)
    - `entity/` - JPA entities (@Entity)
    - `service/` - Business logic layer
    - `repository/` - Spring Data JPA repositories
    - `dto/` - Data Transfer Objects
    - `config/` - Spring configuration classes
    - `exception/` - Custom exception handlers
    - `mapper/` - Entity-DTO mapping

### React Native Architecture (Primary Focus)
- **Framework**: Expo 53+ with React Native 0.79+
- **Navigation**: React Navigation 7+ with permission-based routing
- **State Management**: Zustand with persistent storage
- **Authentication**: 
  - Multi-role system (developer, platform_admin, factory roles)
  - Biometric authentication with Expo LocalAuthentication
  - Device binding and secure token storage
- **Key Features**:
  - Camera integration for QR scanning and photo capture
  - GPS location tracking
  - DeepSeek AI analysis integration
  - Offline-first architecture with sync
  - Push notifications
- **Development Strategy**: 分阶段开发方法
  - **Phase 1-2** (已完成 ✅): 认证系统 + 核心业务模块前端 (24个页面)
  - **Phase 3** (开发中 🔨): Spring Boot 后端 API 实现
  - **Phase 4-5** (计划中 📅): 集成测试 + 生产部署 + 高级功能
- **Module Structure**:
  - `/src/components/` - UI components (auth, permissions, forms)
  - `/src/modules/` - Feature modules (auth, processing, farming, logistics, sales)
  - `/src/services/` - API clients and services (authService, activationService)
  - `/src/navigation/` - Smart navigation with permission guards
  - `/src/store/` - Zustand stores (authStore, navigationStore, permissionStore)
  - `/src/screens/` - Screen components organized by feature

## Database Schema

**MySQL + Spring Data JPA + Hibernate**

核心表：
- `factories` - 工厂信息
- `users` - 用户（8角色系统）
- `departments` - 部门
- `processing_batches` - 加工批次
- `quality_inspections` - 质检记录

**详细结构**: 查看 `backend-java/src/main/java/com/cretas/aims/entity/` 实体类

## Mobile API Architecture

**API 基础路径**: `/api/mobile/*`

**核心功能模块**:
- 认证与授权 (`/auth/*`) - 登录、注册、密码管理
- 文件上传 (`/upload`) - 移动端文件上传优化
- 应用激活 (`/activation/*`) - 设备激活管理
- 业务数据 (`/{factoryId}/*`) - 工厂相关业务接口

**详细 API 文档**:
- 📖 **Apifox**: API 设计与测试的唯一真实来源
- 🔧 **代码位置**: `backend-java/src/main/java/com/cretas/aims/controller/`
- 📋 **前端需求**: `backend/rn-update-tableandlogic.md` - 前端提出的API需求清单

## Authentication System (Mobile-Optimized)

### Multi-Stage Authentication Flow
1. **Phone Verification** → **Whitelist Check** → **Registration/Login**
2. **Smart User Detection**: System automatically detects platform vs factory users
3. **Device Binding**: Secure device registration with unique device IDs
4. **Biometric Integration**: Fingerprint/Face ID support via Expo LocalAuthentication
5. **Token Management**: AccessToken + RefreshToken + TempToken + DeviceToken

### Mobile Registration & Login
- **Two-Phase Registration**: Phone verification → Complete profile
- **Smart Login**: Automatic user type detection (platform/factory)
- **Post-Login**: Role-based navigation and permission routing

## Development Environment Setup

### React Native + Backend Setup (macOS/Linux)
**Recommended Approach**: Use `start-system-macos.sh` (macOS) or manual setup
1. Automatically starts MySQL service
2. Launches Spring Boot backend server (port 10010)
3. Starts Expo React Native development server (port 3010)
4. Opens new terminal windows for each service

### Manual Setup
```bash
# 1. 启动 MySQL 数据库
mysql.server start              # macOS
# OR
sudo systemctl start mysql      # Linux

# 2. 启动 Spring Boot 后端
cd backend-java
mvn clean package -DskipTests   # 首次运行需要编译
mvn spring-boot:run             # 启动后端服务 (端口 10010)

# 3. 启动 React Native (新终端)
cd frontend/CretasFoodTrace
npm install                     # 首次运行需要安装依赖
npm start                       # 启动 Expo (端口 3010)
```

## Key Development Patterns

### ⚠️ Code Quality Principles (CRITICAL)

**DO NOT Use Degradation/Fallback Patterns**

降级处理(Degradation/Fallback)是一种**治标不治本**的方法，在本项目中**严格禁止**使用。

**❌ 禁止的降级处理模式**:
```javascript
// ❌ BAD: 使用降级处理掩盖问题
try {
  const result = await apiCall();
  return result;
} catch (error) {
  console.log('API failed, using fallback');
  return mockData; // 降级到Mock数据
}

// ❌ BAD: 条件降级
if (feature.isAvailable()) {
  return feature.execute();
} else {
  return simplifiedVersion(); // 降级到简化版本
}
```

**✅ 正确的问题解决方法**:
```javascript
// ✅ GOOD: 找到并修复根本原因
try {
  const result = await apiCall();
  return result;
} catch (error) {
  logger.error('API call failed', error);
  // 1. 记录详细错误信息
  // 2. 向用户显示明确的错误提示
  // 3. 在backend/rn-update-tableandlogic.md中记录需要修复的问题
  throw new UserFacingError('数据加载失败，请稍后重试');
}

// ✅ GOOD: 实现完整功能或不实现
if (!feature.isAvailable()) {
  // 1. 记录为待实现功能
  // 2. 向用户明确说明功能未开放
  throw new FeatureNotAvailableError('该功能即将上线');
}
return feature.execute();
```

**为什么禁止降级处理**:
1. **掩盖问题**: 降级处理会隐藏真实的错误和问题
2. **延迟修复**: 让开发者忽略根本原因，问题永远得不到真正解决
3. **技术债务**: 积累大量的"临时方案"，最终导致代码难以维护
4. **用户体验**: 降级功能往往体验不佳，不如明确告知用户
5. **测试困难**: 增加了测试复杂度，难以发现问题

**正确的开发流程**:
1. **遇到问题** → **分析根本原因** → **记录问题**
2. **前端阶段**(Phase 1-2，已完成): 在`backend/rn-update-tableandlogic.md`中记录后端需求
3. **后端阶段**(Phase 3-4，进行中): 实现完整的后端功能，彻底解决问题
4. **用户交互**: 向用户明确显示错误信息或功能状态，不要用降级掩盖

**例外情况** (仅在以下场景允许):
- **离线模式**: App设计就是离线优先，本地存储是核心功能
- **网络优化**: 预加载、缓存等性能优化手段
- **优雅降级**: UI组件在旧设备上的渲染优化(如动画简化)

但即使在这些场景，也必须:
- 在设计文档中明确说明
- 向用户清晰展示当前状态(如"离线模式")
- 提供完整的功能切换机制

---

## 🚫 禁止的开发模式 (Anti-Patterns)

基于对项目代码的深入分析，发现了**8大类、67+个"治标不治本"的反模式实例**。以下是完整的禁止规范和正确做法。

### 1. 错误处理规范

#### ❌ 禁止做法

**1.1 捕获错误后静默失败或返回假数据**
```typescript
// ❌ BAD: 错误被吞掉，用户看到假数据
try {
  const data = await api.getStatistics();
  return data;
} catch (error) {
  console.error('加载失败:', error);
  // 返回全0数据，用户以为真的是0，实际是API失败
  return { todayOutput: 0, completedBatches: 0 };
}

// ❌ BAD: Promise.allSettled 掩盖关键API失败
const [r1, r2, r3] = await Promise.allSettled([api1(), api2(), api3()]);
const data1 = r1.status === 'fulfilled' ? r1.value : null;
// 只打印日志，用户不知道某些数据加载失败
if (r1.status === 'rejected') {
  console.warn('API失败:', r1.reason);
}
```

**1.2 泛型错误处理 - 所有错误同样对待**
```typescript
// ❌ BAD: 使用 any 类型，失去类型安全
catch (err: any) {
  console.error('操作失败:', err);
  Alert.alert('失败', err.message || '请重试');
  // 网络错误、认证错误、服务器错误都显示同样消息
}
```

**1.3 空catch块或只打印日志**
```typescript
// ❌ BAD: 错误被完全忽略
try {
  await criticalOperation();
} catch (error) {
  // 什么都不做，或只打印
  console.error(error);
}
```

#### ✅ 正确做法

**方案1: 明确显示错误，不返回假数据**
```typescript
// ✅ GOOD: 显示错误状态UI
try {
  const data = await api.getStatistics();
  setStatsData(data);
  setError(null);
} catch (error) {
  console.error('加载统计数据失败:', error);
  // 不返回假数据，设置错误状态
  setError({
    message: '无法加载统计数据，请稍后重试',
    canRetry: true,
    onRetry: () => loadStatistics(),
  });
  setStatsData(null); // 不显示假数据
}
```

---

### 2. 数据验证规范

#### ❌ 禁止做法

**2.1 使用 `as any` 绕过类型检查**
```typescript
// ❌ BAD: 关闭TypeScript保护
const data = (response as any).data || response;
const items = data.items || [];

// ❌ BAD: 参数使用any
function processData(item: any) {
  return item.value || 0;
}
```

**2.2 过度使用可选链和 `||` 默认值**
```typescript
// ❌ BAD: 误判合法的0、false、''
const count = data?.items?.length || 0;  // 如果length是0，还是返回0，无法区分
const value = obj?.prop?.subprop?.value || 'default';  // false、0、'' 都会用默认值

// ❌ BAD: 超过2层可选链，表明数据结构不明确
const deepValue = obj?.a?.b?.c?.d?.e || 'default';
```

**2.3 未验证API响应直接使用**
```typescript
// ❌ BAD: 直接使用，没有验证结构
const response = await api.getData();
// 后端返回格式变了，直接crash
const total = response.data.summary.total;
```

#### ✅ 正确做法

**方案1: 使用 `??` 替代 `||`**
```typescript
// ✅ GOOD: 只有 null/undefined 才用默认值，0是合法的
const count = data?.items?.length ?? 0;
const isEnabled = config?.feature?.enabled ?? false;  // false 是合法值
const username = user?.username ?? 'Guest';
```

---

### 3. 安全降级规范

#### ❌ 禁止做法

**3.1 SecureStore → AsyncStorage 静默降级**
```typescript
// ❌ BAD: 安全性大幅降低但用户不知情
try {
  await SecureStore.setItemAsync('access_token', token);
} catch (error) {
  console.warn('SecureStore unavailable, falling back to AsyncStorage');
  // 从硬件加密降级到明文存储，用户完全不知道！
  await AsyncStorage.setItem('access_token', token);
}
```

**3.2 功能降级不通知用户**
```typescript
// ❌ BAD: 双重逻辑路径，降级逻辑掩盖问题
if (record.status) {
  return getStatusFromField(record.status);
} else {
  // 降级：根据时间字段推断状态
  return inferStatusFromTime(record);
}
```

**3.3 API失败时静默使用Mock数据**
```typescript
// ❌ BAD: 用户以为API正常，实际用的假数据
try {
  const data = await api.getRealData();
  return data;
} catch (error) {
  console.error('API failed, using mock data');
  return mockData;  // 降级到假数据
}
```

#### ✅ 正确做法

**方案1: 不降级，直接抛错**
```typescript
// ✅ GOOD: SecureStore不可用时报错
static async storeTokens(tokens: AuthTokens): Promise<void> {
  try {
    await SecureStore.setItemAsync('access_token', tokens.accessToken);
    await SecureStore.setItemAsync('refresh_token', tokens.refreshToken);
  } catch (error) {
    // 不降级，直接抛出错误
    throw new SecurityError(
      'SecureStore不可用，无法安全存储令牌。请检查设备设置。',
      'SECURE_STORAGE_UNAVAILABLE'
    );
  }
}
```

---

### 4. 配置管理规范

#### ❌ 禁止做法

**4.1 硬编码超时时间、重试次数**
```typescript
// ❌ BAD: 魔法数字
setTimeout(() => retry(), 3000);
axios.get(url, { timeout: 30000 });
for (let i = 0; i < 3; i++) { retry(); }
```

**4.2 硬编码GPS坐标、URL**
```typescript
// ❌ BAD: 所有用户都显示在上海打卡
setGpsLocation({
  latitude: 31.2304,
  longitude: 121.4737,
});
```

**4.3 角色字符串直接比较**
```typescript
// ❌ BAD: 拼写错误风险
if (role === 'factory_super_admin' || role === 'department_admin') {
  // ...
}
```

#### ✅ 正确做法

**方案1: 配置集中管理**
```typescript
// ✅ GOOD: config/timeouts.ts
export const TIMEOUTS = {
  DEFAULT_API: 30_000,
  LONG_OPERATION: 60_000,
  FILE_UPLOAD: 120_000,
  NETWORK_CHECK: 5_000,
} as const;

export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY: 1_000,
  MAX_DELAY: 10_000,
} as const;

// 使用
axios.get(url, { timeout: TIMEOUTS.DEFAULT_API });
setTimeout(() => retry(), RETRY_CONFIG.BASE_DELAY);
```

---

### 5. TODO和未实现功能规范

#### ❌ 禁止做法

**5.1 生产代码包含TODO**
```typescript
// ❌ BAD: TODO堆积表明功能未完成
export class BiometricManager {
  static async authenticate(): Promise<boolean> {
    // TODO: 未来实现生物识别
    return false;  // 假实现
  }
}
```

**5.2 Mock数据假装API已实现**
```typescript
// ❌ BAD: 调用者以为API已经通了
/**
 * TODO: 后端API未实现，当前使用Mock数据
 */
async getFactories() {
  return mockFactories;
}
```

#### ✅ 正确做法

**方案1: 抛出 NotImplementedError**
```typescript
// ✅ GOOD: 明确告知功能未实现
class NotImplementedError extends Error {
  constructor(
    message: string,
    public featureName: string,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

export class BiometricManager {
  static async authenticate(): Promise<boolean> {
    throw new NotImplementedError(
      '生物识别功能尚未实现',
      'BIOMETRIC_AUTH',
      {
        plannedPhase: 'Phase 4-5',
        trackingIssue: '#123',
        estimatedDate: 'Q1 2026',
      }
    );
  }
}
```

---

### 6. 返回值和状态处理规范

#### ❌ 禁止做法

**6.1 返回null掩盖错误原因**
```typescript
// ❌ BAD: 调用者无法区分不同失败原因
function getUserId(): number | null {
  if (!user) return null;  // 用户未登录？
  if (isNaN(userId)) return null;  // ID格式错误？
  return userId;
}
```

**6.2 早期返回null导致静默失败**
```typescript
// ❌ BAD: 函数提前返回，没有错误提示
async function loadData() {
  if (!userId) {
    console.warn('用户ID不存在');
    return;  // 静默失败
  }
  // ...
}
```

#### ✅ 正确做法

**方案1: 使用Result类型**
```typescript
// ✅ GOOD: 明确区分成功和失败
type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

type UserIdError = 'NO_USER' | 'INVALID_ID' | 'PARSE_ERROR';

function getUserId(): Result<number, UserIdError> {
  if (!user) {
    return { ok: false, error: 'NO_USER' };
  }

  const userId = typeof user.id === 'string'
    ? parseInt(user.id, 10)
    : user.id;

  if (isNaN(userId)) {
    return { ok: false, error: 'INVALID_ID' };
  }

  return { ok: true, value: userId };
}

// 使用时可以针对性处理
const result = getUserId();
if (!result.ok) {
  switch (result.error) {
    case 'NO_USER':
      showError('请先登录');
      navigate('Login');
      break;
    case 'INVALID_ID':
      showError('用户ID格式错误');
      reportBug('INVALID_USER_ID', { user });
      break;
    case 'PARSE_ERROR':
      showError('数据解析失败');
      break;
  }
  return;
}

const userId = result.value;  // 类型安全的number
```

---

### 7. 代码质量强制要求

#### 强制规范

1. **TypeScript严格模式**
   - 所有生产代码必须通过 `strict: true`
   - 启用 `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`

2. **禁止使用 `any`**
   ```typescript
   // ❌ BAD
   function process(data: any) { }
   const result = response as any;

   // ✅ GOOD
   function process(data: unknown) {
     const validated = schema.parse(data);
     // ...
   }
   ```

   **例外情况**（必须注释说明）:
   ```typescript
   // ✅ ACCEPTABLE: 第三方库类型不完整
   // @ts-expect-error - react-native-paper类型定义缺失
   const theme = useTheme() as any;
   ```

3. **所有API调用必须有错误处理**
   ```typescript
   // ❌ BAD: 没有错误处理
   const data = await api.getData();

   // ✅ GOOD: 有错误处理
   try {
     const data = await api.getData();
     setData(data);
   } catch (error) {
     handleError(error);
   }
   ```

4. **关键功能必须有单元测试**
   - 认证相关函数
   - 数据验证函数
   - 业务逻辑计算
   - 覆盖率目标: >70%

---

## 📝 Code Review检查清单

### 错误处理 (Error Handling)
- [ ] 所有try-catch使用具体错误类型（不是 `any`）
- [ ] 错误有明确的用户提示（不只是console.log）
- [ ] 关键操作失败时通知用户
- [ ] 没有空的catch块或只打印日志的catch
- [ ] Promise.allSettled仅用于非关键数据，失败有提示

### 数据验证 (Data Validation)
- [ ] API响应有运行时验证（Zod/Yup）
- [ ] 没有 `as any` 类型断言（或有充分理由并注释）
- [ ] 可选链不超过2层
- [ ] 使用 `??` 而非 `||` 作为默认值
- [ ] TypeScript strict模式通过

### 降级处理 (Degradation)
- [ ] 降级时有用户通知（Alert/Toast）
- [ ] 降级事件被记录到Analytics
- [ ] 没有SecureStore静默降级到AsyncStorage
- [ ] Promise.allSettled失败有用户提示
- [ ] 区分开发/生产环境（Mock数据）

### 配置管理 (Configuration)
- [ ] 没有硬编码的超时/重试次数
- [ ] 没有硬编码的GPS/URL
- [ ] 角色判断使用枚举
- [ ] 没有魔法数字（使用常量）

### TODO和未实现功能
- [ ] 生产代码没有TODO/FIXME/HACK
- [ ] 未实现功能抛出NotImplementedError
- [ ] Mock数据仅在开发环境
- [ ] TODO关联Issue编号

### 安全性 (Security)
- [ ] 敏感数据使用SecureStore
- [ ] Token不存储在AsyncStorage
- [ ] 降级时有安全警告

### 类型安全 (Type Safety)
- [ ] TypeScript严格模式通过
- [ ] 没有滥用可选链
- [ ] API类型有明确定义
- [ ] 没有 `any` 类型（或有注释说明）
- [ ] 函数返回类型明确
- [ ] 使用Result类型或抛出错误（不返回null）

---

## ⚙️ ESLint自动化规则

创建 `.eslintrc.js` 自动检测反模式：

```javascript
module.exports = {
  extends: [
    '@react-native-community',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // 禁止使用any
    '@typescript-eslint/no-explicit-any': 'error',

    // 禁止空catch块
    'no-empty': ['error', { allowEmptyCatch: false }],

    // 限制console.log (生产环境)
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',

    // 禁止TODO注释 (生产环境)
    'no-warning-comments': process.env.NODE_ENV === 'production' ? ['error', {
      terms: ['TODO', 'FIXME', 'HACK', 'XXX'],
      location: 'anywhere'
    }] : 'warn',

    // 要求使用const
    'prefer-const': 'error',

    // 禁止魔法数字
    '@typescript-eslint/no-magic-numbers': ['warn', {
      ignore: [0, 1, -1],
      ignoreArrayIndexes: true,
      ignoreEnums: true,
      enforceConst: true,
    }],

    // 要求Promise有错误处理
    '@typescript-eslint/no-floating-promises': 'error',

    // 禁止未使用的变量
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
    }],

    // 要求明确的函数返回类型
    '@typescript-eslint/explicit-function-return-type': ['warn', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
    }],
  },
};
```

### 自定义ESLint插件检测项目特定反模式

```javascript
// eslint-plugin-cretas/rules/no-silent-degradation.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止静默降级处理',
      category: 'Best Practices',
    },
  },
  create(context) {
    return {
      // 检测SecureStore → AsyncStorage降级
      CatchClause(node) {
        const sourceCode = context.getSourceCode();
        const catchBody = node.body.body;

        const hasSecureStoreError = node.param &&
          node.param.name.toLowerCase().includes('securestore');
        const hasAsyncStorage = catchBody.some(stmt => {
          const code = sourceCode.getText(stmt);
          return code.includes('AsyncStorage');
        });
        const hasAlert = catchBody.some(stmt => {
          const code = sourceCode.getText(stmt);
          return code.includes('Alert') || code.includes('showToast');
        });

        if (hasSecureStoreError && hasAsyncStorage && !hasAlert) {
          context.report({
            node,
            message: '降级到AsyncStorage时必须通知用户（使用Alert或Toast）',
          });
        }
      },

      // 检测Promise.allSettled后的错误处理
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'Promise' &&
          node.callee.property.name === 'allSettled'
        ) {
          context.report({
            node,
            message: '使用Promise.allSettled时请确保失败情况有用户提示',
          });
        }
      },
    };
  },
};
```

### CI/CD集成

**GitHub Actions 工作流**（`.github/workflows/code-quality.yml`）:
- ESLint 检查：`npm run lint`
- TypeScript 严格模式：`npx tsc --noEmit --strict`
- 生产分支检测：禁止 TODO/FIXME/HACK 注释
- 代码审查：检测硬编码配置（GPS坐标等）

**参考**: 查看项目中的 `.github/workflows/` 目录获取完整配置

---

## Testing Strategy

### 📱 Frontend Testing (React Native)

**Framework**: React Native Testing Library + Jest

**Test Coverage**:
- ✅ Component rendering and UI behavior
- ✅ User interaction flows (navigation, forms, buttons)
- ✅ State management (Zustand stores)
- ✅ Permission-based routing
- ✅ Offline functionality and data sync

**命令**:
```bash
cd frontend/CretasFoodTrace
npm test                     # Run all tests
npm test -- --coverage       # With coverage report
```

### 🔧 Backend Testing (Spring Boot)

**Framework**: JUnit 5 + Spring Boot Test + Mockito

**Test Coverage**:
- ✅ Controller layer (API endpoints)
- ✅ Service layer (business logic)
- ✅ Repository layer (database operations)
- ✅ Integration tests (full request-response cycle)
- ✅ Security tests (authentication & authorization)

**命令**:
```bash
cd backend-java
mvn test                     # Run all tests
mvn test -Dtest=ClassName   # Run specific test class
```

### 🔗 Integration Testing

**End-to-End Testing**:
- API contract validation (frontend ↔ backend)
- User flow testing (login → operation → logout)
- Cross-platform testing (Android/iOS)
- Performance testing (load, stress)

**测试脚本**: See `/tests` directory for automated test scripts

## Security Considerations

### Mobile Security
- **Secure Storage**: Expo SecureStore for sensitive data (tokens, biometric settings)
- **Device Binding**: Unique device identification and registration
- **Token Security**: Multi-layer token system (access, refresh, temp, device)
- **Biometric Protection**: Secure biometric authentication with fallback

### API Security
- **Mobile Middleware**: Dedicated authentication for mobile endpoints
- **Rate Limiting**: API call throttling for mobile clients
- **Permission Validation**: Real-time role verification
- **Input Sanitization**: Zod schemas for all mobile API inputs

## Performance Optimization

### Mobile Performance
- **Startup Time**: Target <3 seconds cold start
- **Memory Management**: Target <200MB steady state
- **Bundle Size**: Target <50MB APK
- **Network Optimization**: Request batching and intelligent caching

### DeepSeek LLM Optimization
- **Cost Control**: Intelligent caching (5-minute cache for similar queries)
- **Request Optimization**: Data preprocessing to reduce token usage
- **Fallback Strategy**: Basic analysis when LLM service unavailable
- **Usage Monitoring**: Real-time cost tracking and limits

## Deployment Strategy

### Mobile App Deployment
- **Development**: Expo development builds for testing
- **Staging**: Internal distribution via Expo
- **Production**: Google Play Store release with app activation
- **Enterprise**: APK distribution with activation codes

### Backend Deployment
- **Development**: Local MySQL with Spring Boot on port 10010
- **Production**: MySQL on Alibaba Cloud (139.196.165.140:10010)
- **Deployment**: Automated deployment via 宝塔面板 (BT-Panel)
- **API Versioning**: Mobile API versioning for backward compatibility

## Common Issues & Solutions

### 📱 React Native Issues

**Cache Problems**:
```bash
npx expo start --clear        # Clear Expo cache
rm -rf node_modules && npm install  # Reinstall dependencies
```

**Device/Emulator**:
- Android Emulator: Ensure Android Studio and AVD configured
- Network: Use `10.0.2.2:10010` for Android emulator → backend
- Hot Reload: Restart Expo dev server if not working

**State Management**:
- Verify Zustand store persistence configuration
- Check permission/navigation state updates trigger re-renders

### 🔧 Backend Issues

**Service Health Check**:
```bash
# Spring Boot health endpoint
curl http://localhost:10010/api/mobile/health

# MySQL connection
mysql -u root cretas_db -e "SHOW TABLES"

# Check running processes
lsof -i :10010              # Mac/Linux
netstat -ano | findstr :10010  # Windows
```

**Port Conflicts**:
```bash
# Check port availability
lsof -i :10010    # Backend API
lsof -i :3010     # React Native Dev
lsof -i :3306     # MySQL
```

### 🚨 Quick Diagnostics

**All Services Status**:
```bash
# React Native
npx expo doctor

# Backend (Java)
cd backend-java && mvn --version

# Database
mysql -u root -p -e "SELECT VERSION()"
```


---

## 🚀 Quick Reference

### Test Account
- **Admin**: `admin` / `Admin@123456` (Full system access)

### Port Configuration
| Service | Port | URL |
|---------|------|-----|
| React Native Dev | 3010 | `http://localhost:3010` |
| Spring Boot API | 10010 | `http://139.196.165.140:10010` |
| MySQL | 3306 | `localhost:3306` |

### Development Commands

**Frontend**:
```bash
cd frontend/CretasFoodTrace
npm start                    # Start Expo dev server
npx expo start --clear      # Clear cache and start
```

**Backend**:
```bash
cd backend-java
mvn clean package -DskipTests    # Build JAR
mvn spring-boot:run              # Run locally
```

**Deploy to Server**:
```bash
scp target/*.jar root@139.196.165.140:/www/wwwroot/cretas/
ssh root@139.196.165.140 "bash /www/wwwroot/cretas/restart.sh"
```
