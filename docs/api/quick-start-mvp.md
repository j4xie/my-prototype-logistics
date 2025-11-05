# MVP快速开始指南

**预计阅读时间**: 5分钟
**前置条件**: 已配置React Native开发环境

---

## 🎯 MVP开发路线图

### Phase 1 (Week 1-3): 基础功能
```
✅ 认证授权（7个API）
├─ unified-login（统一登录）
├─ register-phase-one/two（两阶段注册）
├─ send-code/verify-code（验证码）
├─ refresh（Token刷新）
└─ logout（登出）

✅ 用户管理（14个API）
├─ CRUD操作
├─ 角色管理
└─ 批量操作

✅ 设备激活（3个API）
✅ 白名单（4个API）
```

### Phase 2 (Week 4-8): 核心业务
```
✅ 生产加工（12个API）
✅ 原材料批次（14个API）
✅ 生产计划（12个API）
✅ 转换率（10个API）
✅ 供应商/客户（8+8=16个API）
✅ 考勤工时（14个API）
```

### Phase 3 (Week 9): 配置管理
```
✅ 产品/原料/工作类型（37个API）
✅ 工厂设置（8个API）
✅ 文件上传、数据同步（4个API）
```

---

## 🚀 第一个API调用

### Step 1: 配置API基础地址

```typescript
// src/config/api.config.ts
export const API_CONFIG = {
  BASE_URL: 'http://47.251.121.76:10010/api',
  TIMEOUT: 30000,
  HEADERS: {
    'Content-Type': 'application/json',
  }
};
```

### Step 2: 创建API客户端

```typescript
// src/services/apiClient.ts
import axios from 'axios';
import { API_CONFIG } from '@/config/api.config';
import { authStore } from '@/store/authStore';

const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS
});

// 请求拦截器 - 添加Token
apiClient.interceptors.request.use(
  config => {
    const token = authStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// 响应拦截器 - 处理401自动刷新Token
apiClient.interceptors.response.use(
  response => response.data,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = authStore.getState().refreshToken;
        const { data } = await axios.post(
          `${API_CONFIG.BASE_URL}/mobile/auth/refresh`,
          { refreshToken }
        );

        authStore.getState().setTokens(data.accessToken, data.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

        return apiClient(originalRequest);
      } catch (refreshError) {
        authStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

### Step 3: 创建认证服务

```typescript
// src/services/authService.ts
import apiClient from './apiClient';

interface LoginRequest {
  username: string;
  password: string;
  factoryId?: string;
  deviceInfo?: DeviceInfo;
}

interface LoginResponse {
  token: string;
  refreshToken: string;
  userId: number;
  username: string;
  role: string;
  permissions: string[];
  factoryId?: string;
  profile: UserProfile;
}

export const authService = {
  // 统一登录
  async unifiedLogin(request: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post('/mobile/auth/unified-login', request);
    return response.data;
  },

  // 刷新Token
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    const response = await apiClient.post('/mobile/auth/refresh', { refreshToken });
    return response.data;
  },

  // 登出
  async logout(deviceId?: string): Promise<void> {
    await apiClient.post('/mobile/auth/logout', { deviceId });
  }
};
```

### Step 4: 在组件中使用

```typescript
// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import { authService } from '@/services/authService';
import { authStore } from '@/store/authStore';

export const LoginScreen = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const result = await authService.unifiedLogin({
        username,
        password,
        deviceInfo: {
          deviceId: await getDeviceId(),
          deviceType: Platform.OS,
          model: await getDeviceModel(),
          osVersion: Platform.Version
        }
      });

      // 保存认证信息
      authStore.getState().setAuth(result);

      // 跳转到主页
      navigation.replace('Main');
    } catch (error) {
      Alert.alert('登录失败', error.message);
    }
  };

  return (
    <View>
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="用户名"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="密码"
        secureTextEntry
      />
      <Button title="登录" onPress={handleLogin} />
    </View>
  );
};
```

---

## 📋 MVP开发Checklist

### Phase 1 进度跟踪

- [ ] **认证授权（7个API）**
  - [ ] unified-login
  - [ ] register-phase-one
  - [ ] register-phase-two
  - [ ] send-code
  - [ ] verify-code
  - [ ] refresh
  - [ ] logout

- [ ] **用户管理（14个API）**
  - [ ] 获取用户列表
  - [ ] 创建用户
  - [ ] 更新用户
  - [ ] 删除用户
  - [ ] 角色管理
  - ...

- [ ] **设备激活（3个API）**
  - [ ] activate
  - [ ] 设备列表
  - [ ] 移除设备

- [ ] **白名单（4个API）**
  - [ ] 列表
  - [ ] 添加
  - [ ] 删除
  - [ ] 检查

### Phase 2 进度跟踪

- [ ] **生产加工（12个API）**
- [ ] **原材料批次（14个API）**
- [ ] **生产计划（12个API）**
- [ ] **转换率（10个API）**
- [ ] **供应商（8个API）**
- [ ] **客户（8个API）**
- [ ] **考勤工时（14个API）**

---

## 🔧 测试环境

### 测试服务器
```
URL: http://47.251.121.76:10010/
Swagger: http://47.251.121.76:10010/swagger-ui.html
```

### 测试账号

| 角色 | 用户名 | 密码 | 工厂ID |
|------|--------|------|--------|
| 平台管理员 | admin | Admin@123456 | - |
| 工厂超管 | super_admin | Admin@123 | FAC001 |
| 部门管理员 | processing_admin | DeptAdmin@123 | FAC001 |
| 操作员 | operator001 | Operator@123 | FAC001 |

---

## 💡 最佳实践

### 1. 错误处理

```typescript
try {
  const result = await apiCall();
} catch (error) {
  if (error.code === 'TOKEN_EXPIRED') {
    await refreshToken();
  } else if (error.code === 'NETWORK_ERROR') {
    await useOfflineMode();
  } else {
    showError(error.message);
  }
}
```

### 2. 离线支持

```typescript
// 定期同步
setInterval(async () => {
  if (isOnline()) {
    await syncData(factoryId);
  }
}, 5 * 60 * 1000); // 每5分钟
```

### 3. 性能优化

```typescript
// 批量请求
const results = await Promise.all([
  apiClient.get('/users'),
  apiClient.get('/products'),
  apiClient.get('/materials')
]);
```

---

## 🔗 相关文档

- [MVP API参考](./mvp-api-reference.md) - 完整API文档
- [MVP数据模型](./mvp-models.md) - TypeScript类型
- [PRD映射表](./prd-api-mapping.md) - 需求对照
- [项目开发指南](../../CLAUDE.md) - 整体策略

---

**开始开发**: 从[MVP API参考](./mvp-api-reference.md)的Phase 1章节开始！
