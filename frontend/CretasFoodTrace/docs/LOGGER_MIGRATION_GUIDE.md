# Logger 迁移指南

## 📋 概述

本项目已引入统一的日志工具 `logger`，用于替代项目中的 336 个 `console.log()` 调用。

**核心优势**:
- ✅ 环境区分（开发环境显示全部日志，生产环境仅显示警告和错误）
- ✅ 日志级别管理（DEBUG, INFO, WARN, ERROR）
- ✅ 敏感信息自动脱敏（password, token, apiKey 等）
- ✅ 性能追踪（操作耗时、API调用监控）
- ✅ 格式化输出（时间戳、平台标识、日志级别）
- ✅ 错误追踪集成（预留 Sentry 等集成接口）

---

## 🚀 快速开始

### 1. 导入 Logger

```typescript
import { logger } from '@/utils/logger';
```

### 2. 基本使用

```typescript
// ❌ 旧写法
console.log('用户登录成功', { userId: 123 });

// ✅ 新写法
logger.info('用户登录成功', { userId: 123 });
```

---

## 📝 迁移对照表

### 基础日志替换

| 旧写法 | 新写法 | 日志级别 | 生产环境显示 |
|--------|--------|----------|--------------|
| `console.log()` | `logger.debug()` | DEBUG | ❌ 不显示 |
| `console.log()` | `logger.info()` | INFO | ❌ 不显示 |
| `console.warn()` | `logger.warn()` | WARN | ✅ 显示 |
| `console.error()` | `logger.error()` | ERROR | ✅ 显示 |

**选择原则**:
- **调试信息**（仅开发需要）→ `logger.debug()`
- **正常运行信息**（用户操作、状态变化）→ `logger.info()`
- **警告信息**（非关键问题、降级处理）→ `logger.warn()`
- **错误信息**（需要关注的问题）→ `logger.error()`

---

## 💡 迁移示例

### 示例 1: 认证服务 (authService.ts)

#### ❌ 迁移前

```typescript
export class AuthService {
  static async login(username: string, password: string): Promise<LoginResponse> {
    console.log('开始登录流程:', { username });

    try {
      const response = await apiClient.post('/auth/login', { username, password });
      console.log('登录成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  }

  static async refreshToken(): Promise<void> {
    console.log('刷新Token...');
    // ...
  }
}
```

#### ✅ 迁移后

```typescript
import { logger } from '@/utils/logger';

// 为AuthService创建专用logger（可选，但推荐）
const authLogger = logger.createContextLogger('AuthService');

export class AuthService {
  static async login(username: string, password: string): Promise<LoginResponse> {
    // 使用info级别，因为登录是正常用户操作
    authLogger.info('开始登录流程', { username });

    try {
      const response = await apiClient.post('/auth/login', { username, password });
      // password 会被自动脱敏为 '***'
      authLogger.info('登录成功', response.data);
      return response.data;
    } catch (error) {
      // 使用error级别，提供上下文信息
      authLogger.error('登录失败', error, { username });
      throw error;
    }
  }

  static async refreshToken(): Promise<void> {
    // 使用debug级别，因为Token刷新是内部操作
    authLogger.debug('刷新Token...');
    // ...
  }
}
```

**输出示例**:
```
[10:23:45.123][DEBUG][ios] [AuthService] 刷新Token...
[10:23:46.456][INFO][ios] [AuthService] 开始登录流程 { username: 'admin' }
[10:23:47.789][INFO][ios] [AuthService] 登录成功 { userId: 1, token: '***' }
```

---

### 示例 2: API 调用监控

#### ❌ 迁移前

```typescript
async function fetchBatchList(factoryId: number): Promise<Batch[]> {
  console.log(`获取工厂 ${factoryId} 的批次列表`);

  const startTime = Date.now();
  try {
    const response = await processingApiClient.getBatches(factoryId);
    const duration = Date.now() - startTime;
    console.log(`获取批次列表成功，耗时 ${duration}ms`, response.data);
    return response.data;
  } catch (error) {
    console.error('获取批次列表失败:', error);
    throw error;
  }
}
```

#### ✅ 迁移后

```typescript
import { logger } from '@/utils/logger';

async function fetchBatchList(factoryId: number): Promise<Batch[]> {
  logger.debug(`获取工厂 ${factoryId} 的批次列表`);

  // 使用logger的性能追踪功能
  const endTimer = logger.createTimer('fetchBatchList');

  try {
    const response = await processingApiClient.getBatches(factoryId);
    endTimer(); // 自动记录耗时
    logger.info('获取批次列表成功', { count: response.data.length });
    return response.data;
  } catch (error) {
    logger.error('获取批次列表失败', error, { factoryId });
    throw error;
  }
}
```

**输出示例**:
```
[10:23:45.123][DEBUG][ios] 获取工厂 1 的批次列表
[10:23:46.234][INFO][ios] [PERF] fetchBatchList: 1111ms
[10:23:46.234][INFO][ios] 获取批次列表成功 { count: 15 }
```

---

### 示例 3: API Client (使用专用 api 方法)

#### ❌ 迁移前

```typescript
class ProcessingApiClient {
  async getBatches(factoryId: number): Promise<ApiResponse<Batch[]>> {
    const startTime = Date.now();
    try {
      const response = await apiClient.get(`/processing/batches?factoryId=${factoryId}`);
      const duration = Date.now() - startTime;
      console.log(`GET /processing/batches - 200 (${duration}ms)`);
      return response.data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const status = error.response?.status || 500;
      console.error(`GET /processing/batches - ${status} (${duration}ms)`, error);
      throw error;
    }
  }
}
```

#### ✅ 迁移后

```typescript
import { logger } from '@/utils/logger';

class ProcessingApiClient {
  async getBatches(factoryId: number): Promise<ApiResponse<Batch[]>> {
    const startTime = Date.now();
    try {
      const response = await apiClient.get(`/processing/batches?factoryId=${factoryId}`);
      const duration = Date.now() - startTime;

      // 使用logger的API专用方法
      logger.api('GET', '/processing/batches', 200, duration);
      return response.data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const status = error.response?.status || 500;

      // 自动根据状态码选择日志级别 (>=500 ERROR, >=400 WARN, <400 DEBUG)
      logger.api('GET', '/processing/batches', status, duration, error);
      throw error;
    }
  }
}
```

**输出示例**:
```
// 成功 (200): DEBUG级别，生产环境不显示
[10:23:45.123][DEBUG][ios] [API] GET /processing/batches - 200 (1234ms)

// 客户端错误 (400): WARN级别，生产环境显示
[10:23:45.123][WARN][ios] [API] GET /processing/batches - 404 (567ms) NotFoundError: ...

// 服务器错误 (500): ERROR级别，生产环境显示
[10:23:45.123][ERROR][ios] [API] GET /processing/batches - 500 (890ms) ServerError: ...
```

---

### 示例 4: 性能追踪

#### ❌ 迁移前

```typescript
async function calculateCostAnalysis(batchId: number): Promise<CostAnalysis> {
  const startTime = Date.now();
  console.log(`开始计算批次 ${batchId} 的成本分析`);

  const result = await heavyCalculation(batchId);

  const duration = Date.now() - startTime;
  console.log(`成本分析计算完成，耗时 ${duration}ms`);
  return result;
}
```

#### ✅ 迁移后

```typescript
import { logger } from '@/utils/logger';

async function calculateCostAnalysis(batchId: number): Promise<CostAnalysis> {
  logger.debug(`开始计算批次 ${batchId} 的成本分析`);

  // 方式1: 使用createTimer
  const endTimer = logger.createTimer('calculateCostAnalysis');
  const result = await heavyCalculation(batchId);
  endTimer(); // 输出: [PERF] calculateCostAnalysis: 1234ms

  // 方式2: 使用performance方法
  // const startTime = Date.now();
  // const result = await heavyCalculation(batchId);
  // const duration = Date.now() - startTime;
  // logger.performance('calculateCostAnalysis', duration, { batchId });

  return result;
}
```

---

### 示例 5: 敏感信息脱敏

#### ❌ 迁移前（有安全风险！）

```typescript
async function storeToken(tokens: AuthTokens): Promise<void> {
  console.log('存储令牌:', tokens);
  // 输出: 存储令牌: { accessToken: 'eyJhbGciOiJ...' }
  // ⚠️ Token完整暴露在日志中！

  await SecureStore.setItemAsync('access_token', tokens.accessToken);
}
```

#### ✅ 迁移后（自动脱敏）

```typescript
import { logger } from '@/utils/logger';

async function storeToken(tokens: AuthTokens): Promise<void> {
  logger.debug('存储令牌', tokens);
  // 输出: 存储令牌 { accessToken: '***', refreshToken: '***' }
  // ✅ 敏感字段自动替换为 '***'

  await SecureStore.setItemAsync('access_token', tokens.accessToken);
}
```

**自动脱敏的字段**（不区分大小写）:
- `password` / `Password` / `PASSWORD`
- `token` / `accessToken` / `refreshToken` / `deviceToken`
- `apiKey` / `secret`
- `creditCard` / `cvv` / `ssn`

---

## 🎯 Context Logger（模块专用日志）

为特定模块创建专用 logger，自动添加模块前缀：

```typescript
import { logger } from '@/utils/logger';

// 创建模块专用logger
const authLogger = logger.createContextLogger('AuthService');
const apiLogger = logger.createContextLogger('ApiClient');
const storeLogger = logger.createContextLogger('AuthStore');

// 使用
authLogger.info('用户登录成功', { userId: 123 });
// 输出: [INFO][ios] [AuthService] 用户登录成功 { userId: 123 }

apiLogger.error('API调用失败', error);
// 输出: [ERROR][ios] [ApiClient] API调用失败 ...

storeLogger.debug('更新用户状态', newState);
// 输出: [DEBUG][ios] [AuthStore] 更新用户状态 ...
```

**推荐使用场景**:
- Service 类 (`authService.ts`, `networkService.ts`)
- API Client 类 (`processingApiClient.ts`)
- Zustand Store (`authStore.ts`)
- 复杂组件 (`BatchDetailScreen.tsx`)

---

## ⚙️ 高级配置

### 1. 调整日志级别（运行时）

```typescript
import { logger, LogLevel } from '@/utils/logger';

// 开发环境显示所有日志
if (__DEV__) {
  logger.setLevel(LogLevel.DEBUG);
}

// 生产环境只显示错误
if (!__DEV__) {
  logger.setLevel(LogLevel.ERROR);
}

// 临时关闭所有日志（调试时）
logger.setLevel(LogLevel.NONE);
```

### 2. 集成 Sentry 错误追踪

```typescript
import * as Sentry from '@sentry/react-native';
import { logger } from '@/utils/logger';

// 配置Sentry集成
logger.setErrorTracker((error, context) => {
  Sentry.captureException(error, {
    contexts: { custom: context },
  });
});

// 使用logger.error()时自动上报到Sentry
logger.error('关键错误', error, { userId: 123, action: 'payment' });
// ✅ 日志打印 + Sentry上报
```

### 3. 添加自定义敏感字段

```typescript
import { logger } from '@/utils/logger';

logger.configure({
  sensitiveFields: [
    'password',
    'token',
    // 添加项目特定的敏感字段
    'idCard',        // 身份证号
    'phoneNumber',   // 手机号
    'bankAccount',   // 银行账号
  ],
});
```

---

## 📊 迁移进度

### 当前状态（2025-11-20）

- **总计**: 336 个 `console.log()` 调用
- **已迁移**: 165 个 ✅
- **待迁移**: 171 个
- **完成度**: 49%

### 迁移优先级

**P0 - 立即迁移**（安全风险）✅ **已完成**:
- [x] `authService.ts` (20个) - ✅ 已迁移 (Commit: a77d253d)
- [x] `tokenManager.ts` (21个) - ✅ 已迁移 (Commit: a77d253d)

**P1 - 高优先级**（高频调用）✅ **已完成**:
- [x] `apiClient.ts` (5个) - ✅ 已迁移 (Commit: 1b3d0127)
- [x] `authStore.ts` (3个) - ✅ 已迁移 (Commit: 1b3d0127)

**P2 - 中优先级**（功能模块）🔨 **进行中**:
- [x] EnhancedLoginScreen.tsx (2个) - ✅ 已迁移
- [x] ProcessingDashboard.tsx (7个) - ✅ 已迁移
- [x] CostAnalysisDashboard.tsx (2个) - ✅ 已迁移
- [x] MaterialBatchManagementScreen.tsx (38个) - ✅ 已迁移
- [x] MaterialTypeManagementScreen.tsx (15个) - ✅ 已迁移
- [x] CreateQualityRecordScreen.tsx (12个) - ✅ 已迁移
- [x] EntityDataExportScreen.tsx (12个) - ✅ 已迁移
- [x] ConversionRateScreen.tsx (10个) - ✅ 已迁移
- [x] ProductionPlanManagementScreen.tsx (10个) - ✅ 已迁移
- [x] QuickStatsPanel.tsx (8个) - ✅ 已迁移
- [ ] 其他Screen组件 (~30个)
- [ ] 其他ApiClient (~80个)

**P3 - 低优先级**（工具类）⏳ **待迁移**:
- [ ] 工具函数和辅助类 (~57个)

### 已迁移文件列表

| 文件 | Console调用数 | 日志类型 | Commit | 状态 |
|------|--------------|---------|--------|------|
| `authService.ts` | 20 | authLogger | a77d253d | ✅ |
| `tokenManager.ts` | 21 | tokenLogger | a77d253d | ✅ |
| `apiClient.ts` | 5 | apiLogger | 1b3d0127 | ✅ |
| `authStore.ts` | 3 | storeLogger | 1b3d0127 | ✅ |
| `EnhancedLoginScreen.tsx` | 2 | loginLogger | 3bc81c11 | ✅ |
| `ProcessingDashboard.tsx` | 7 | dashboardLogger | 3bc81c11 | ✅ |
| `CostAnalysisDashboard.tsx` | 2 | costAnalysisLogger | 3bc81c11 | ✅ |
| `MaterialBatchManagementScreen.tsx` | 38 | materialBatchLogger | 08ae36e6 | ✅ |
| `MaterialTypeManagementScreen.tsx` | 15 | materialTypeLogger | ccd4a6d7 | ✅ |
| `CreateQualityRecordScreen.tsx` | 12 | qualityRecordLogger | 19ade454 | ✅ |
| `EntityDataExportScreen.tsx` | 12 | entityExportLogger | 769d75ac | ✅ |
| `ConversionRateScreen.tsx` | 10 | conversionLogger | 7df81497 | ✅ |
| `ProductionPlanManagementScreen.tsx` | 10 | productionPlanLogger | c575cc08 | ✅ |
| `QuickStatsPanel.tsx` | 8 | quickStatsLogger | 3c0d467f | ✅ |
| **总计** | **165** | - | - | **49%** |

---

## ✅ 迁移检查清单

每个文件迁移时，请确认：

- [ ] 所有 `console.log()` 替换为合适的日志级别
- [ ] 重要模块创建了 Context Logger
- [ ] API 调用使用 `logger.api()` 方法
- [ ] 性能关键代码使用 `logger.createTimer()`
- [ ] 敏感信息已由logger自动脱敏
- [ ] ESLint 不再有 `no-console` 警告

---

## 🔗 相关文档

- **Logger源码**: [`src/utils/logger.ts`](../src/utils/logger.ts)
- **ESLint配置**: [`/.eslintrc.js`](../.eslintrc.js)
- **CLAUDE.md**: 查看"禁止的开发模式"章节

---

## 🤝 贡献

迁移完一个文件后，请更新本文档的"迁移进度"部分。

**命令**:
```bash
# 检查所有console.log使用
npm run lint

# 查看console.log统计
grep -r "console.log" src/ --include="*.ts" --include="*.tsx" | wc -l
```

---

**最后更新**: 2025-11-20
**维护者**: Development Team
