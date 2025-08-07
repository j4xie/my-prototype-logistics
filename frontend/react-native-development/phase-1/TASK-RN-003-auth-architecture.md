# TASK-RN-003: 认证架构搭建

> React Native Android开发 - 认证架构搭建任务
>
> 创建时间: 2025-08-05
> 预计工期: 2.5天 (20小时)
> 优先级: 高
> 状态: 待开始

## 📋 任务概述

基于web端完整的认证系统，搭建React Native的认证架构，包括多角色认证系统、RBAC权限控制、Token管理系统和权限配置映射等核心功能。

## 🎯 任务目标

- 建立完整的多角色认证系统架构
- 实现RBAC权限控制基础框架  
- 搭建安全的Token管理系统
- 复制web端权限配置到移动端
- 为登录和权限功能提供坚实基础

## 📋 详细步骤

### **Day 1: 认证系统架构设计** (8小时)

#### 1.1 多角色认证系统设计 (3小时)

**1.1.1 角色类型定义**
```typescript
// src/types/auth.ts
export type UserRole = 
  | 'platform_super_admin'    // 平台超级管理员
  | 'platform_operator'       // 平台操作员  
  | 'factory_super_admin'     // 工厂超级管理员
  | 'permission_admin'        // 权限管理员
  | 'department_admin'        // 部门管理员
  | 'operator'                // 操作员
  | 'viewer'                  // 查看者

export type UserType = 'platform_admin' | 'factory_user';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  userType: UserType;
  department?: string;
  factoryId?: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

**1.1.2 权限接口定义**
```typescript
// src/types/permissions.ts
export interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface UserPermissions {
  modules: {
    platform_access: boolean;
    factory_management: boolean;
    user_management: boolean;
    whitelist_management: boolean;
    farming_access: boolean;
    processing_access: boolean;
    logistics_access: boolean;
    sales_access: boolean;
  };
  features: string[];
  dataAccess: 'all' | 'factory_all' | 'department' | 'limited';
  departmentAccess: 'all' | 'own' | 'authorized';
}
```

#### 1.2 权限配置映射 (3小时)

**1.2.1 权限配置复制**
```typescript
// src/config/permissions.ts
// 基于backend/src/config/permissions.js的完整复制

export const PLATFORM_PERMISSIONS = {
  'platform_super_admin': {
    name: '平台超级管理员',
    description: '平台最高权限，可以管理所有工厂和平台设置',
    permissions: [
      'create_factory',
      'delete_factory', 
      'manage_all_factories',
      'view_factories',
      'view_factory_details',
      'factory_activation_control',
      'manage_factory_users',
      'create_users',
      // ... 完整权限列表
    ],
    dataAccess: 'all'
  },
  // ... 其他角色配置
};

export const FACTORY_PERMISSIONS = {
  // 复制完整的工厂权限配置
};
```

**1.2.2 权限计算工具**
```typescript
// src/utils/permissions.ts
export function calculateUserPermissions(
  userType: UserType, 
  role: UserRole, 
  department?: string
): UserPermissions {
  // 权限计算逻辑
}

export function hasPermission(
  userPermissions: UserPermissions, 
  requiredPermission: string
): boolean {
  // 权限检查逻辑
}
```

#### 1.3 状态管理架构 (2小时)

**1.3.1 认证状态管理**
```typescript
// src/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  permissions: UserPermissions | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  updateUser: (user: User) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // 状态和方法实现
    }),
    {
      name: 'auth-storage',
      // 安全存储配置
    }
  )
);
```

### **Day 2: Token管理系统** (8小时)

#### 2.1 安全Token存储 (3小时)

**2.1.1 Token管理器**
```typescript
// src/services/tokenManager.ts
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
}

export class TokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'access_token';  
  private static readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private static readonly TOKEN_EXPIRY_KEY = 'token_expiry';

  // 安全存储tokens
  static async storeTokens(tokens: AuthTokens): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        // Web平台使用AsyncStorage
        await AsyncStorage.multiSet([
          [this.ACCESS_TOKEN_KEY, tokens.accessToken],
          [this.REFRESH_TOKEN_KEY, tokens.refreshToken],
          [this.TOKEN_EXPIRY_KEY, tokens.expiresAt.toString()],
        ]);
      } else {
        // 移动端使用SecureStore
        await Promise.all([
          SecureStore.setItemAsync(this.ACCESS_TOKEN_KEY, tokens.accessToken),
          SecureStore.setItemAsync(this.REFRESH_TOKEN_KEY, tokens.refreshToken),
          SecureStore.setItemAsync(this.TOKEN_EXPIRY_KEY, tokens.expiresAt.toString()),
        ]);
      }
    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw new Error('Token storage failed');
    }
  }

  // 获取有效token
  static async getValidToken(): Promise<string | null> {
    // Token获取和验证逻辑
  }

  // 刷新token
  static async refreshToken(): Promise<string | null> {
    // Token刷新逻辑
  }

  // 清理tokens
  static async clearTokens(): Promise<void> {
    // Token清理逻辑
  }
}
```

#### 2.2 认证服务 (3小时)

**2.2.1 认证API服务**
```typescript
// src/services/authService.ts
export interface LoginCredentials {
  username: string;
  password: string;
  userType?: UserType;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
  permissions: UserPermissions;
}

export class AuthService {
  private static baseURL = 'http://your-backend-domain.com/api/auth';

  static async login(credentials: LoginCredentials): Promise<LoginResponse> {
    // 登录API调用
  }

  static async logout(): Promise<void> {
    // 登出API调用
  }

  static async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // Token刷新API调用
  }

  static async getCurrentUser(): Promise<User> {
    // 获取当前用户信息
  }

  static async updateProfile(updates: Partial<User>): Promise<User> {
    // 更新用户资料
  }
}
```

#### 2.3 生物识别集成 (2小时)

**2.3.1 生物识别管理器**
```typescript
// src/services/biometricManager.ts
import * as LocalAuthentication from 'expo-local-authentication';

export class BiometricManager {
  static async isAvailable(): Promise<boolean> {
    // 检查生物识别可用性
  }

  static async authenticate(reason: string): Promise<boolean> {
    // 执行生物识别验证
  }

  static async getSupportedTypes(): Promise<string[]> {
    // 获取支持的生物识别类型
  }
}
```

### **Day 2.5: 网络和错误处理** (4小时)

#### 3.1 网络状态管理 (2小时)

**3.1.1 网络检测**
```typescript
// src/services/networkManager.ts
import NetInfo from '@react-native-community/netinfo';

export class NetworkManager {
  static async isConnected(): Promise<boolean> {
    // 检查网络连接状态
  }

  static subscribeToNetworkState(callback: (isConnected: boolean) => void) {
    // 监听网络状态变化
  }

  static async waitForConnection(timeout: number = 10000): Promise<boolean> {
    // 等待网络连接恢复
  }
}
```

#### 3.2 错误处理系统 (2小时)

**3.2.1 认证错误处理**
```typescript
// src/utils/errorHandler.ts
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  BIOMETRIC_FAILED = 'BIOMETRIC_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function handleAuthError(error: unknown): AuthError {
  // 错误处理和转换逻辑
}
```

## 🏆 交付物

### 技术交付物
- [ ] **完整的认证类型定义** (auth.ts, permissions.ts)
- [ ] **权限配置映射** (permissions.ts) - 完整复制web端配置
- [ ] **状态管理架构** (authStore.ts) - Zustand持久化存储
- [ ] **Token管理系统** (tokenManager.ts) - 安全存储+自动刷新
- [ ] **认证服务** (authService.ts) - API调用封装
- [ ] **生物识别集成** (biometricManager.ts) - 指纹/Face ID
- [ ] **网络状态管理** (networkManager.ts) - 网络检测和重试
- [ ] **错误处理系统** (errorHandler.ts) - 统一错误处理

### 架构交付物
- [ ] **认证流程架构图** - 登录、token刷新、权限检查流程
- [ ] **状态管理架构** - Zustand store结构和数据流
- [ ] **安全架构文档** - Token存储、生物识别、权限控制
- [ ] **错误处理策略** - 网络错误、认证错误、权限错误

### 文档交付物
- [ ] **认证系统技术文档** - 架构设计和实现说明
- [ ] **权限配置文档** - 角色权限映射表
- [ ] **API接口文档** - 认证相关API调用说明
- [ ] **安全最佳实践** - Token安全、生物识别使用指南

## ✅ 验收标准

### 架构完整性验证
- [ ] 6种用户角色类型定义完整
- [ ] 权限配置100%对应web端
- [ ] 状态管理架构清晰可扩展
- [ ] Token管理系统安全可靠

### 功能基础验证
- [ ] TokenManager可以安全存储和获取token
- [ ] 权限计算函数返回正确结果
- [ ] 生物识别在支持设备上可用
- [ ] 网络状态检测正常工作

### 代码质量验证
- [ ] TypeScript类型定义完整
- [ ] 错误处理覆盖所有场景
- [ ] 代码结构清晰易维护
- [ ] 安全实践符合最佳标准

## 📊 时间分配

| 阶段 | 内容 | 预计时间 | 关键交付物 |
|------|------|----------|-----------|
| Day 1 | 认证系统架构设计 | 8小时 | 类型定义、权限配置、状态管理 |
| Day 2 | Token管理系统 | 8小时 | Token管理器、认证服务、生物识别 |
| Day 2.5 | 网络和错误处理 | 4小时 | 网络管理、错误处理、文档 |
| **总计** | **认证架构搭建** | **20小时** | **完整认证架构基础** |

## 🚨 风险与对策

### 技术风险
- **风险**: 权限配置复杂度超预期
- **对策**: 分模块实现，先核心权限后扩展功能

- **风险**: Token安全存储兼容性问题
- **对策**: 提供多平台存储方案，充分测试

### 架构风险
- **风险**: 状态管理过于复杂
- **对策**: 保持状态结构简单，分离关注点

- **风险**: 生物识别API变更
- **对策**: 提供密码备选方案，版本兼容检查

## 🔄 与其他任务的接口

### 输入依赖
- **TASK-RN-002**: 项目初始化完成，依赖包已安装
- **Web端权限配置**: backend/src/config/permissions.js

### 输出到后续任务
- **TASK-RN-004**: 登录系统可以使用认证架构
- **TASK-RN-005**: 权限控制可以使用权限配置
- **所有后续任务**: 基于认证架构的权限控制

## 📝 开发检查点

### Day 1 检查点
- [ ] 认证类型定义是否完整覆盖web端
- [ ] 权限配置映射是否准确
- [ ] 状态管理架构是否清晰

### Day 2 检查点
- [ ] Token管理是否安全可靠
- [ ] 认证服务API调用是否正确
- [ ] 生物识别集成是否工作

### Day 2.5 检查点
- [ ] 网络状态管理是否完善
- [ ] 错误处理是否覆盖所有场景
- [ ] 文档是否完整清晰

## 📞 技术支持

**负责人**: [待分配]
**技术支持**: [项目技术负责人]
**参考资料**: 
- Web端权限配置: `backend/src/config/permissions.js`
- Web端认证控制器: `backend/src/controllers/authController.js`

---

**任务创建时间**: 2025-08-05
**计划开始时间**: TASK-RN-002完成后
**计划完成时间**: 开始后2.5个工作日

*此任务是认证系统的核心基础，所有后续认证相关功能都基于此架构。*