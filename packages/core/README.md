# @food-trace/core

食品溯源系统核心业务逻辑包，提供跨平台的状态管理、类型定义、工具函数和平台抽象层。

## 特性

- 🔄 **跨平台状态管理** - 基于 Zustand 的响应式状态管理
- 📝 **完整类型定义** - TypeScript 类型安全
- 🛠️ **工具函数库** - 常用的业务工具函数
- 💾 **存储抽象** - 支持 localStorage、AsyncStorage 等
- 📊 **日志系统** - 跨平台日志记录
- ⚡ **性能优化** - 缓存、防抖、节流等
- 🔐 **安全功能** - 错误处理、验证等

## 支持平台

- ✅ Web (React)
- ✅ React Native (iOS/Android)
- 🔄 未来支持更多平台

## 安装

```bash
npm install @food-trace/core
# 或
yarn add @food-trace/core
# 或
pnpm add @food-trace/core
```

## 快速开始

### 1. 初始化

```typescript
import { initializeCore } from '@food-trace/core';

// 初始化核心包
initializeCore({
  debug: true,
  logLevel: 'debug',
  platform: 'web', // 或 'react-native'
  apiBaseUrl: 'https://api.example.com',
});
```

### 2. 状态管理

```typescript
import { useAuth, useUser } from '@food-trace/core';

function App() {
  const { isAuthenticated, login, logout } = useAuth();
  const user = useUser();

  const handleLogin = async () => {
    await login({
      username: 'user@example.com',
      password: 'password123',
    });
  };

  return (
    <div>
      {isAuthenticated ? (
        <div>
          <h1>Welcome, {user?.displayName}</h1>
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <button onClick={handleLogin}>Login</button>
      )}
    </div>
  );
}
```

### 3. 工具函数

```typescript
import { 
  formatDate, 
  validateObject, 
  logger,
  Platform 
} from '@food-trace/core';

// 日期格式化
const formattedDate = formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss');

// 数据验证
const validation = validateObject(data, {
  name: { required: true, minLength: 2 },
  email: { required: true, email: true },
});

// 日志记录
logger.info('User action completed', 'App', { userId: '123' });

// 平台检测
if (Platform.isMobile) {
  console.log('Running on mobile device');
}
```

### 4. 类型定义

```typescript
import type { 
  User, 
  Batch, 
  Product, 
  QualityCheck 
} from '@food-trace/core';

const user: User = {
  id: '1',
  username: 'john',
  email: 'john@example.com',
  displayName: 'John Doe',
  role: {
    id: 'admin',
    name: '管理员',
    description: '系统管理员',
    level: 1,
  },
  permissions: [],
  createdAt: '2023-01-01T00:00:00Z',
};
```

## API 文档

### 状态管理

#### useAuth()
认证状态管理 Hook

```typescript
const {
  isAuthenticated,
  isInitialized,
  user,
  loading,
  error,
  login,
  logout,
  register,
  updateProfile,
  hasPermission,
  hasRole,
  hasFeature,
} = useAuth();
```

#### useUser()
获取当前用户信息

```typescript
const user = useUser(); // User | null
```

#### usePermission(resource, action)
权限检查 Hook

```typescript
const canEdit = usePermission('products', 'write');
const canDelete = usePermission('batches', 'delete');
```

### 工具函数

#### 日期工具
```typescript
import { DateUtils, formatDate, formatRelativeTime } from '@food-trace/core';

// 格式化日期
const formatted = formatDate(new Date(), 'YYYY-MM-DD');

// 相对时间
const relative = formatRelativeTime(new Date());

// 日期计算
const future = DateUtils.add(new Date(), 7, 'days');
```

#### 验证工具
```typescript
import { Validator, ValidationRules } from '@food-trace/core';

// 单值验证
const result = Validator.validateValue('test@example.com', {
  required: true,
  email: true,
});

// 对象验证
const objectResult = Validator.validateObject(data, {
  name: ValidationRules.required('姓名不能为空'),
  email: ValidationRules.email(),
  age: ValidationRules.range(18, 120),
});
```

#### 存储工具
```typescript
import { StorageAdapterFactory } from '@food-trace/core';

// Web 环境
const webStorage = StorageAdapterFactory.createWebStorage('localStorage');

// React Native 环境
const rnStorage = StorageAdapterFactory.createAsyncStorage(AsyncStorage);

// 自动检测
const storage = StorageAdapterFactory.createAutoDetect(AsyncStorage);

// 使用存储
await storage.setData('key', { value: 'data' });
const data = await storage.getData('key');
```

### 错误处理

```typescript
import { AppError, ErrorFactory, errorHandler } from '@food-trace/core';

try {
  // 业务逻辑
} catch (error) {
  const appError = errorHandler.handle(error, 'MyComponent');
  
  // 显示用户友好的错误消息
  const userMessage = appError.toUserMessage('zh-CN');
  console.log(userMessage);
}

// 创建自定义错误
const validationError = ErrorFactory.validation('数据验证失败');
const networkError = ErrorFactory.network('网络连接失败');
```

## React Native 集成

### 1. 安装依赖

```bash
npm install @react-native-async-storage/async-storage
```

### 2. 配置

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeCore } from '@food-trace/core';

initializeCore({
  platform: 'react-native',
  storage: AsyncStorage,
  debug: __DEV__,
});
```

### 3. 使用

```typescript
import React from 'react';
import { View, Text, Button } from 'react-native';
import { useAuth } from '@food-trace/core';

export default function App() {
  const { isAuthenticated, user, login, logout } = useAuth();

  return (
    <View>
      {isAuthenticated ? (
        <View>
          <Text>Welcome, {user?.displayName}</Text>
          <Button title="Logout" onPress={logout} />
        </View>
      ) : (
        <Button 
          title="Login" 
          onPress={() => login({ username: 'test', password: 'test' })} 
        />
      )}
    </View>
  );
}
```

## 高级用法

### 自定义存储适配器

```typescript
import { BaseStorageAdapter } from '@food-trace/core';

class CustomStorageAdapter extends BaseStorageAdapter {
  async getItem(key: string): Promise<string | null> {
    // 自定义获取逻辑
    return customStorage.get(this.getFullKey(key));
  }

  async setItem(key: string, value: string): Promise<void> {
    // 自定义存储逻辑
    await customStorage.set(this.getFullKey(key), value);
  }

  // ... 其他方法
}
```

### 自定义认证服务

```typescript
import { setAuthApi } from '@food-trace/core';

const customAuthApi = {
  async login(credentials) {
    const response = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    return response.json();
  },
  
  async logout() {
    await fetch('/api/logout', { method: 'POST' });
  },
  
  // ... 其他方法
};

setAuthApi(customAuthApi);
```

## 构建

```bash
# 安装依赖
npm install

# 构建
npm run build

# 开发模式
npm run dev

# 类型检查
npm run type-check

# 测试
npm test
```

## 许可证

MIT

## 贡献

欢迎提交 Pull Request 和 Issue！

## 更新日志

### v1.0.0
- 🎉 初始版本发布
- ✅ 基础状态管理
- ✅ 跨平台存储
- ✅ 类型定义
- ✅ 工具函数库