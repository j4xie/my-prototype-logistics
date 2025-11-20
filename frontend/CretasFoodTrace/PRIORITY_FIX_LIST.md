# 前端问题修复清单（优先级排序）

**生成时间**: 2025-11-20
**总问题数**: 62个
**预计总工作量**: 27-48小时

---

## 🔴 P0 - 致命问题（必须立即修复）

### ☑️ P0-1: TypeScript编译错误

- **文件**: `src/screens/processing/QualityInspectionDetailScreen.tsx:157`
- **错误**: `error TS1005: 'try' expected`
- **影响**: 阻塞编译
- **工作量**: ⏱️ 5分钟
- **修复人**: [ ]
- **状态**: [ ] 未开始 / [ ] 进行中 / [ ] 已完成

**修复步骤**:
```bash
# 1. 打开文件检查第157行语法错误
# 2. 修复缺少的try-catch块
# 3. 验证编译通过
npm run typecheck
```

---

### ☑️ P0-2: AppNavigator缺少导入

- **文件**: `src/navigation/AppNavigator.tsx`
- **问题**: 缺少所有import语句
- **影响**: 应用无法启动
- **工作量**: ⏱️ 5分钟
- **修复人**: [ ]
- **状态**: [ ] 未开始 / [ ] 进行中 / [ ] 已完成

**修复代码**:
```typescript
// 在文件顶部添加以下导入
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { useAuthStore } from './src/store/authStore';
import { theme } from './src/theme';
import EnhancedLoginScreen from './src/screens/auth/EnhancedLoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen';
import MainNavigator from './src/navigation/MainNavigator';

const Stack = createNativeStackNavigator();
```

---

### ☑️ P0-3: Jest测试配置修复

- **文件**:
  - `jest.config.js` (需创建)
  - `src/constants/config.ts`
  - `src/services/api/forgotPasswordApiClient.ts`
  - `src/__tests__/utils/testHelpers.ts`
- **问题**: 3个测试套件失败
- **影响**: 无法运行测试
- **工作量**: ⏱️ 1-2小时
- **修复人**: [ ]
- **状态**: [ ] 未开始 / [ ] 进行中 / [ ] 已完成

**修复步骤**:

1. **创建jest.config.js**:
```javascript
module.exports = {
  preset: 'react-native',
  globals: {
    __DEV__: true,
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|react-navigation|@react-navigation)/)',
  ],
};
```

2. **修复forgotPasswordApiClient.ts**:
   - 移除 `response.data`（apiClient已返回data）

3. **修复testHelpers.ts**:
   - 更新Mock类型定义

4. **验证**:
```bash
npm test
```

---

### ☑️ P0-4: TypeScript严格模式配置

- **文件**: `tsconfig.json`
- **问题**: 未开启strict模式
- **影响**: 失去类型安全保护
- **工作量**: ⏱️ 8-16小时
- **修复人**: [ ]
- **状态**: [ ] 未开始 / [ ] 进行中 / [ ] 已完成

**修复步骤**:

1. **备份当前配置**:
```bash
cp tsconfig.json tsconfig.json.backup
```

2. **更新tsconfig.json**:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noPropertyAccessFromIndexSignature": false,
    "noUncheckedIndexedAccess": false,
    "skipLibCheck": true
  },
  "include": [
    "src/**/*",
    "App.tsx"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

3. **检查类型错误**:
```bash
npm run typecheck 2>&1 | tee typescript-errors.log
wc -l typescript-errors.log
```

4. **逐文件修复**（优先级排序）:
   - [ ] `src/navigation/MainNavigator.tsx`
   - [ ] `src/navigation/AppNavigator.tsx`
   - [ ] `src/store/authStore.ts`
   - [ ] `src/services/api/apiClient.ts`
   - [ ] `src/services/storage/storageService.ts`
   - [ ] 其他核心文件

5. **验证无类型错误**:
```bash
npm run typecheck
```

---

**P0阶段完成标准**:
- [ ] `npm run typecheck` 无错误
- [ ] `npm test` 全部通过
- [ ] 应用可启动

---

## 🟠 P1 - 重要问题（影响质量）

### ☑️ P1-1: 清理69处 `as any` 类型断言

- **文件**: 27个文件
- **工作量**: ⏱️ 8-12小时
- **修复人**: [ ]
- **状态**: [ ] 未开始 / [ ] 进行中 / [ ] 已完成

**优先级文件列表**:

1. **src/navigation/MainNavigator.tsx** (10处)
   - [ ] 第36行: `permissions = (user as any)?.permissions`
   - [ ] 第40行: `(user as any).platformUser?.role`
   - [ ] 第41行: `(user as any).role`
   - [ ] 第42行: `(user as any).factoryUser?.role`
   - [ ] 第43行: `(user as any).role`
   - [ ] 第49行: `(user as any).factoryUser?.department`
   - [ ] 第73行: `(permissions as any).modules`
   - [ ] 第77行: `(permissions as any).features`
   - [ ] 其他2处

2. **src/screens/management/DepartmentManagementScreen.tsx** (8处)
   - [ ] 逐行检查和修复

3. **src/store/authStore.ts** (2处)
   - [ ] 检查用户类型定义

**修复模板**:

```typescript
// ❌ BAD
const permissions = (user as any)?.permissions || {};

// ✅ GOOD - 方案1: 类型守卫
interface PlatformUser {
  platformUser: {
    role: string;
    factoryId: string;
  };
}

interface FactoryUser {
  factoryUser: {
    role: string;
    factoryId: string;
    department?: string;
  };
}

type User = PlatformUser | FactoryUser;

function isPlatformUser(user: any): user is PlatformUser {
  return user?.userType === 'platform' && 'platformUser' in user;
}

// 使用
if (isPlatformUser(user)) {
  const role = user.platformUser.role; // 类型安全
}

// ✅ GOOD - 方案2: 可选链 + 空值合并
const permissions = user?.permissions ?? {};
```

**进度跟踪**:
- [ ] MainNavigator.tsx (10/10)
- [ ] DepartmentManagementScreen.tsx (8/8)
- [ ] authStore.ts (2/2)
- [ ] 其他24个文件 (49/49)

---

### ☑️ P1-2: 清理22处 TODO 注释

- **文件**: 14个文件
- **工作量**: ⏱️ 2-4小时
- **修复人**: [ ]
- **状态**: [ ] 未开始 / [ ] 进行中 / [ ] 已完成

**TODO清单**:

1. **src/screens/main/components/QuickStatsPanel.tsx** (4处)
   - [ ] 检查每个TODO状态
   - [ ] 已实现 → 删除TODO
   - [ ] 未实现 → 改用NotImplementedError

2. **src/screens/alerts/ExceptionAlertScreen.tsx** (3处)
   - [ ] 处理TODO

3. **src/screens/processing/QualityInspectionDetailScreen.tsx** (2处)
   - [ ] 处理TODO

4. **其他11个文件** (13处)
   - [ ] 逐文件处理

**处理方案**:

```typescript
// ❌ BAD
// TODO: 后端API未实现，当前使用Mock数据
async getFactories() {
  return mockFactories;
}

// ✅ GOOD - 方案1: 功能未实现
import { NotImplementedError } from '../errors';

async getFactories() {
  throw new NotImplementedError(
    '工厂列表功能尚未实现',
    'FACTORY_LIST',
    {
      plannedPhase: 'Phase 4',
      trackingIssue: '#123',
      backendApiRequired: '/api/mobile/factories',
    }
  );
}

// ✅ GOOD - 方案2: 功能已实现
// 直接删除TODO注释，保留实现代码

// ✅ GOOD - 方案3: 需要后端支持
// 1. 删除TODO
// 2. 记录到 backend/rn-update-tableandlogic.md
// 3. 抛出NotImplementedError
```

---

### ☑️ P1-3: API客户端类型改进

- **文件**:
  - `src/services/api/apiClient.ts`
  - `src/services/api/processingApiClient.ts`
  - `src/services/storage/storageService.ts`
- **工作量**: ⏱️ 1-2小时
- **修复人**: [ ]
- **状态**: [ ] 未开始 / [ ] 进行中 / [ ] 已完成

**修复点**:

1. **apiClient.ts - 第82行**:
```typescript
// ❌ BAD
private async refreshAccessToken(refreshToken: string): Promise<any> {
  // ...
}

// ✅ GOOD
interface RefreshTokenResponse {
  success: boolean;
  tokens?: {
    token?: string;
    accessToken?: string;
    refreshToken: string;
  };
}

private async refreshAccessToken(refreshToken: string): Promise<RefreshTokenResponse> {
  const response = await axios.post(`${API_BASE_URL}/api/mobile/auth/refresh`, {
    refreshToken
  });
  return response.data;
}
```

2. **apiClient.ts - 第114行**:
```typescript
// ❌ BAD
async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  return await this.client.post(url, data, config);
}

// ✅ GOOD
async post<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig
): Promise<T> {
  return await this.client.post(url, data, config);
}
```

3. **storageService.ts - 第23行和88行**:
```typescript
// ❌ BAD
static async setObject(key: string, value: any): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

static async setUserInfo(user: any): Promise<void> {
  await this.setObject('user_info', user);
}

// ✅ GOOD
static async setObject<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

interface UserInfo {
  id: string | number;
  username: string;
  userType: 'platform' | 'factory';
  role: string;
  permissions?: any;
  platformUser?: any;
  factoryUser?: any;
}

static async setUserInfo(user: UserInfo): Promise<void> {
  await this.setObject('user_info', user);
  if (user.role) {
    await this.setItem('user_role', user.role);
  }
}
```

---

### ☑️ P1-4: 导航类型命名统一

- **文件**:
  - `src/types/navigation.ts`
  - `src/navigation/MainNavigator.tsx`
  - `src/navigation/AttendanceStackNavigator.tsx`
- **工作量**: ⏱️ 30分钟
- **修复人**: [ ]
- **状态**: [ ] 未开始 / [ ] 进行中 / [ ] 已完成

**修复步骤**:

1. **更新navigation.ts**:
```typescript
// ❌ OLD
export type MainTabParamList = {
  HomeTab: undefined;
  TimeClockTab: NavigatorScreenParams<TimeClockStackParamList>;  // ❌
  // ...
};

export type TimeClockStackParamList = {  // ❌
  TimeClockScreen: undefined;
  ClockHistory: { employeeId?: string };
  // ...
};

// ✅ NEW
export type MainTabParamList = {
  HomeTab: undefined;
  AttendanceTab: NavigatorScreenParams<AttendanceStackParamList>;  // ✅
  // ...
};

export type AttendanceStackParamList = {  // ✅
  TimeClockScreen: undefined;
  ClockHistory: { employeeId?: string };
  TimeStatistics: { employeeId?: string; period?: 'day' | 'week' | 'month' };
  WorkRecords: { employeeId?: string };
  AttendanceHistory: undefined;
  DepartmentAttendance: undefined;  // ✅ 添加缺失的路由
};
```

2. **更新AttendanceStackNavigator.tsx**:
```typescript
// ❌ OLD
import { TimeClockStackParamList } from '../types/navigation';
const Stack = createNativeStackNavigator<TimeClockStackParamList>();

// ✅ NEW
import { AttendanceStackParamList } from '../types/navigation';
const Stack = createNativeStackNavigator<AttendanceStackParamList>();
```

3. **验证无TypeScript错误**:
```bash
npm run typecheck
```

---

### ☑️ P1-5: MainNavigator权限检查重构

- **文件**: `src/navigation/MainNavigator.tsx`
- **问题**: 复杂的权限检查逻辑 + 大量 `as any`
- **工作量**: ⏱️ 2小时
- **修复人**: [ ]
- **状态**: [ ] 未开始 / [ ] 进行中 / [ ] 已完成

**重构方案**:

```typescript
// 1. 定义明确的用户类型
interface PlatformUserData {
  role: string;
  factoryId?: string;
}

interface FactoryUserData {
  role: string;
  factoryId: string;
  department?: string;
}

interface UserPermissions {
  modules?: Record<string, boolean>;
  features?: string[];
}

interface AuthUser {
  id: string | number;
  username: string;
  userType: 'platform' | 'factory';
  permissions?: UserPermissions;
  platformUser?: PlatformUserData;
  factoryUser?: FactoryUserData;
}

// 2. 创建类型守卫
function isPlatformUser(user: any): user is AuthUser & { platformUser: PlatformUserData } {
  return user?.userType === 'platform' && !!user.platformUser;
}

function isFactoryUser(user: any): user is AuthUser & { factoryUser: FactoryUserData } {
  return user?.userType === 'factory' && !!user.factoryUser;
}

// 3. 安全的角色获取
function getUserRole(user: any): string {
  if (isPlatformUser(user)) {
    return user.platformUser.role || 'viewer';
  }
  if (isFactoryUser(user)) {
    return user.factoryUser.role || 'viewer';
  }
  return 'viewer';
}

// 4. 权限检查函数
function hasPermission(user: any, perm: string): boolean {
  // 部门管理员特殊处理
  if (isFactoryUser(user) && user.factoryUser.role === 'department_admin') {
    const department = user.factoryUser.department;
    const departmentPermissionMap: Record<string, string> = {
      'processing': 'processing_access',
      'farming': 'farming_access',
      'logistics': 'logistics_access',
      'quality': 'quality_access',
    };
    if (department && departmentPermissionMap[department] === perm) {
      return true;
    }
  }

  const permissions = user?.permissions;
  if (!permissions) return false;

  // 检查 modules 对象
  if (permissions.modules?.[perm] === true) {
    return true;
  }

  // 检查 features 数组
  if (Array.isArray(permissions.features) && permissions.features.includes(perm)) {
    return true;
  }

  return false;
}
```

---

**P1阶段完成标准**:
- [ ] 所有 `as any` 已移除（69 → 0）
- [ ] 所有 TODO 已处理（22 → 0）
- [ ] API客户端无 `any` 类型
- [ ] 导航类型一致
- [ ] `npm run typecheck` 无警告

---

## 🟡 P2 - 改进建议（可延后）

### ☑️ P2-1: 完善ESLint配置

- **文件**: `.eslintrc.js`
- **工作量**: ⏱️ 1小时
- **修复人**: [ ]
- **状态**: [ ] 未开始 / [ ] 进行中 / [ ] 已完成

**修改点**:

```javascript
module.exports = {
  // ... existing config
  rules: {
    // ===== 类型安全 =====
    '@typescript-eslint/no-explicit-any': 'error',  // ✅ warn → error
    '@typescript-eslint/no-floating-promises': 'error',  // ✅ 新增
    '@typescript-eslint/explicit-function-return-type': ['warn', {  // ✅ 新增
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
    }],

    // ===== TODO检测 =====
    'no-warning-comments': process.env.NODE_ENV === 'production' ? ['error', {  // ✅ 新增
      terms: ['TODO', 'FIXME', 'HACK', 'XXX'],
      location: 'anywhere'
    }] : 'warn',

    // ===== 魔法数字 =====
    '@typescript-eslint/no-magic-numbers': ['warn', {  // ✅ 新增
      ignore: [0, 1, -1],
      ignoreArrayIndexes: true,
      ignoreEnums: true,
      enforceConst: true,
    }],

    // ===== 其他 =====
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'prefer-const': 'error',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
  },
};
```

**验证**:
```bash
npm run lint
```

---

### ☑️ P2-2: 添加lint脚本

- **文件**: `package.json`
- **工作量**: ⏱️ 5分钟
- **修复人**: [ ]
- **状态**: [ ] 未开始 / [ ] 进行中 / [ ] 已完成

**修改**:
```bash
npm pkg set scripts.lint="eslint src --ext .ts,.tsx"
npm pkg set scripts.lint:fix="eslint src --ext .ts,.tsx --fix"
npm pkg set scripts.lint:report="eslint src --ext .ts,.tsx --output-file eslint-report.json --format json"
```

---

### ☑️ P2-3: 清理重复登录路由

- **文件**: `src/navigation/AppNavigator.tsx`
- **工作量**: ⏱️ 5分钟
- **修复人**: [ ]
- **状态**: [ ] 未开始 / [ ] 进行中 / [ ] 已完成

**修改**:
```typescript
// ❌ OLD - 重复路由
<>
  <Stack.Screen name="Login" component={EnhancedLoginScreen} />
  <Stack.Screen name="EnhancedLogin" component={EnhancedLoginScreen} />
  <Stack.Screen name="LoginScreen" component={EnhancedLoginScreen} />
  <Stack.Screen name="RegisterScreen" component={RegisterScreen} />
  <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
</>

// ✅ NEW - 简化路由
<>
  <Stack.Screen name="Login" component={EnhancedLoginScreen} />
  <Stack.Screen name="Register" component={RegisterScreen} />
  <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
</>
```

---

### ☑️ P2-4: Mock数据环境检查

- **文件**: `src/services/mockData/index.ts` + 使用Mock的页面
- **工作量**: ⏱️ 1小时
- **修复人**: [ ]
- **状态**: [ ] 未开始 / [ ] 进行中 / [ ] 已完成

**添加检查**:
```typescript
// src/services/mockData/index.ts

// 生产环境禁用Mock数据
if (!__DEV__) {
  throw new Error('⚠️ Mock数据仅在开发环境可用');
}

// 开发环境显示警告
console.warn('⚠️ 当前使用Mock数据，生产环境将禁用');

export const mockBatches = [
  // ... mock data
];

// 在使用Mock数据的地方添加警告
export function getMockData() {
  if (!__DEV__) {
    throw new NotImplementedError(
      '该功能需要后端API支持',
      'BACKEND_REQUIRED'
    );
  }
  return mockBatches;
}
```

---

### ☑️ P2-5: Promise.allSettled错误处理

- **文件**: `src/screens/processing/InventoryCheckScreen.tsx`
- **工作量**: ⏱️ 30分钟
- **修复人**: [ ]
- **状态**: [ ] 未开始 / [ ] 进行中 / [ ] 已完成

**检查并修复**:
```typescript
// 如果有使用Promise.allSettled，确保有错误处理
const results = await Promise.allSettled([api1(), api2(), api3()]);

results.forEach((result, index) => {
  if (result.status === 'rejected') {
    console.error(`API ${index + 1} failed:`, result.reason);
    // ✅ 必须有用户提示
    Alert.alert('警告', `部分数据加载失败: ${result.reason.message}`);
  }
});
```

---

**P2阶段完成标准**:
- [ ] ESLint配置完整
- [ ] `npm run lint` 可用
- [ ] 无重复路由
- [ ] Mock数据有环境检查
- [ ] Promise.allSettled有错误处理

---

## 📊 总体进度跟踪

### 阶段完成度

| 阶段 | 问题数 | 已完成 | 进行中 | 未开始 | 进度 |
|------|--------|--------|--------|--------|------|
| P0 | 4 | 0 | 0 | 4 | ░░░░░░░░░░ 0% |
| P1 | 5 | 0 | 0 | 5 | ░░░░░░░░░░ 0% |
| P2 | 5 | 0 | 0 | 5 | ░░░░░░░░░░ 0% |

### 工作量统计

| 阶段 | 预计工作量 | 实际工作量 | 完成时间 |
|------|-----------|-----------|---------|
| P0 | 10-19小时 | - | - |
| P1 | 13.5-20.5小时 | - | - |
| P2 | 3.5小时 | - | - |
| **总计** | **27-43小时** | **-** | **-** |

---

## 🎯 本周目标（Week 1）

**截止日期**: [ 填写日期 ]

### 本周必须完成（P0）

- [ ] P0-1: TypeScript编译错误修复
- [ ] P0-2: AppNavigator导入修复
- [ ] P0-3: Jest测试配置
- [ ] P0-4: TypeScript严格模式（至少完成核心文件）

**成功标准**:
- [ ] `npm run typecheck` 通过
- [ ] `npm test` 通过
- [ ] 应用可启动并运行

---

## 📝 修复日志

### 2025-11-20
- [ ] 创建修复清单
- [ ] 分配任务给团队成员

### [ 日期 ]
- [ ] 记录每日修复进度

---

## 🔗 相关文档

- [完整审计报告](./FRONTEND_AUDIT_REPORT.md)
- [CLAUDE.md规范](../../CLAUDE.md)
- [TypeScript错误日志](./typescript-errors.log)
- [Jest测试结果](./jest-test-results.log)

---

**维护人**: [ 团队负责人 ]
**最后更新**: 2025-11-20
