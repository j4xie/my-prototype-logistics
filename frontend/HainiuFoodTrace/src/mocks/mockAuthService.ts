import { 
  LoginRequest, 
  LoginResponse, 
  User, 
  AuthTokens, 
  BiometricAuthOptions,
  UserRole,
  UserPermissions,
  RegisterPhaseOneRequest,
  RegisterPhaseTwoRequest,
  RegisterResponse
} from '../types/auth';
import { TokenManager } from '../services/tokenManager';

/**
 * Mock用户数据 - 基于真实的7种角色
 */
const MOCK_USERS = {
  // 系统开发者
  'dev': {
    id: 'user-dev-001',
    username: 'dev',
    userType: 'platform' as const,
    phone: '13800000001',
    email: 'dev@heiniu.com',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    platformUser: {
      role: 'system_developer',
      permissions: ['*'], // 所有权限
      department: 'system',
      level: -1
    }
  },

  // 平台超级管理员
  'admin': {
    id: 'user-admin-001',
    username: 'admin',
    userType: 'platform' as const,
    phone: '13800000002',
    email: 'admin@heiniu.com',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    platformUser: {
      role: 'platform_super_admin',
      permissions: [
        'user_manage_all',
        'factory_manage_all', 
        'platform_admin',
        'data_export',
        'system_config'
      ],
      department: 'platform',
      level: 0
    }
  },

  // 平台操作员
  'operator': {
    id: 'user-operator-001',
    username: 'operator',
    userType: 'platform' as const,
    phone: '13800000003',
    email: 'operator@heiniu.com',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    platformUser: {
      role: 'platform_operator',
      permissions: [
        'factory_view',
        'user_view',
        'data_view',
        'report_generate'
      ],
      department: 'operations',
      level: 1
    }
  },

  // 工厂超级管理员
  'factory_admin': {
    id: 'user-factory-001',
    username: 'factory_admin',
    userType: 'factory' as const,
    phone: '13800000004',
    email: 'factory.admin@heiniu.com',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    factoryUser: {
      factoryId: 'factory-001',
      role: 'factory_super_admin',
      permissions: [
        'factory_manage_all',
        'user_manage_factory',
        'department_manage_all',
        'processing_manage',
        'quality_control',
        'data_export_factory'
      ],
      department: 'management',
      departments: ['management', '生产部门', '质量控制部', '包装部门'],
      level: 0
    }
  },

  // 权限管理员
  'permission_admin': {
    id: 'user-perm-001',
    username: 'permission_admin', 
    userType: 'factory' as const,
    phone: '13800000005',
    email: 'perm.admin@heiniu.com',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    factoryUser: {
      factoryId: 'factory-001',
      role: 'permission_admin',
      permissions: [
        'user_manage_department',
        'role_assign',
        'permission_config',
        'department_view'
      ],
      department: 'management',
      departments: ['management'],
      level: 5
    }
  },

  // 部门管理员
  'dept_admin': {
    id: 'user-dept-001',
    username: 'dept_admin',
    userType: 'factory' as const,
    phone: '13800000006',
    email: 'dept.admin@heiniu.com', 
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    factoryUser: {
      factoryId: 'factory-001',
      role: 'department_admin',
      permissions: [
        'processing_manage_department',
        'employee_manage',
        'quality_view',
        'report_department'
      ],
      department: '生产部门',
      departments: ['生产部门'],
      level: 10
    }
  },

  // 操作员
  'worker': {
    id: 'user-worker-001',
    username: 'worker',
    userType: 'factory' as const,
    phone: '13800000007',
    email: 'worker@heiniu.com',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    factoryUser: {
      factoryId: 'factory-001',
      role: 'operator',
      permissions: [
        'processing_record',
        'quality_record',
        'equipment_operate'
      ],
      department: '生产部门',
      departments: ['生产部门'],
      level: 30
    }
  },

  // 查看者
  'viewer': {
    id: 'user-viewer-001',
    username: 'viewer',
    userType: 'factory' as const,
    phone: '13800000008',
    email: 'viewer@heiniu.com',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    factoryUser: {
      factoryId: 'factory-001',
      role: 'viewer',
      permissions: [
        'processing_view',
        'quality_view',
        'report_view'
      ],
      department: '质量控制部',
      departments: ['质量控制部'],
      level: 50
    }
  }
};

/**
 * Mock权限映射
 */
const ROLE_PERMISSIONS_MAP: Record<UserRole, UserPermissions> = {
  'system_developer': {
    features: ['*'],
    modules: {
      farming_access: true,
      processing_access: true,
      logistics_access: true,
      trace_access: true,
      admin_access: true,
      platform_access: true,
    },
    role: 'system_developer',
    userType: 'platform',
    level: -1
  },
  'platform_super_admin': {
    features: ['user_manage_all', 'factory_manage_all', 'platform_admin', 'data_export', 'system_config'],
    modules: {
      farming_access: true,
      processing_access: true,
      logistics_access: true,
      trace_access: true,
      admin_access: true,
      platform_access: true,
    },
    role: 'platform_super_admin',
    userType: 'platform',
    level: 0
  },
  'platform_operator': {
    features: ['factory_view', 'user_view', 'data_view', 'report_generate'],
    modules: {
      farming_access: true,
      processing_access: true,
      logistics_access: true,
      trace_access: true,
      admin_access: false,
      platform_access: true,
    },
    role: 'platform_operator',
    userType: 'platform',
    level: 1
  },
  'factory_super_admin': {
    features: ['factory_manage_all', 'user_manage_factory', 'department_manage_all', 'processing_manage', 'quality_control', 'data_export_factory'],
    modules: {
      farming_access: true,
      processing_access: true,
      logistics_access: true,
      trace_access: true,
      admin_access: true,
      platform_access: false,
    },
    role: 'factory_super_admin',
    userType: 'factory',
    level: 0
  },
  'permission_admin': {
    features: ['user_manage_department', 'role_assign', 'permission_config', 'department_view'],
    modules: {
      farming_access: true,
      processing_access: true,
      logistics_access: true,
      trace_access: true,
      admin_access: true,
      platform_access: false,
    },
    role: 'permission_admin',
    userType: 'factory',
    level: 5
  },
  'department_admin': {
    features: ['processing_manage_department', 'employee_manage', 'quality_view', 'report_department'],
    modules: {
      farming_access: true,
      processing_access: true,
      logistics_access: true,
      trace_access: true,
      admin_access: false,
      platform_access: false,
    },
    role: 'department_admin',
    userType: 'factory',
    level: 10
  },
  'operator': {
    features: ['processing_record', 'quality_record', 'equipment_operate'],
    modules: {
      farming_access: true,
      processing_access: true,
      logistics_access: false,
      trace_access: true,
      admin_access: false,
      platform_access: false,
    },
    role: 'operator',
    userType: 'factory',
    level: 30
  },
  'viewer': {
    features: ['processing_view', 'quality_view', 'report_view'],
    modules: {
      farming_access: true,
      processing_access: true,
      logistics_access: false,
      trace_access: true,
      admin_access: false,
      platform_access: false,
    },
    role: 'viewer',
    userType: 'factory',
    level: 50
  }
};

/**
 * Mock生物识别存储
 */
const MOCK_BIOMETRIC_USERS = new Set(['admin', 'factory_admin', 'dept_admin']);

/**
 * Mock白名单用户
 */
const MOCK_WHITELIST_PHONES = {
  '13900000001': { role: 'operator', factoryId: 'factory-001', department: '生产部' },
  '13900000002': { role: 'department_admin', factoryId: 'factory-001', department: '质检部' },
  '13900000003': { role: 'viewer', factoryId: 'factory-001', department: '仓储部' },
};

/**
 * Mock验证码存储
 */
const MOCK_VERIFICATION_CODES = new Map<string, { code: string; expires: number }>();

/**
 * Mock AuthService - 用于测试环境
 */
export class MockAuthService {
  /**
   * Mock登录
   */
  static async login(credentials: LoginRequest): Promise<LoginResponse> {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 1000));

    const username = credentials.username.toLowerCase();
    const password = credentials.password;

    // 简单的用户验证 (密码为用户名)
    const mockUser = MOCK_USERS[username as keyof typeof MOCK_USERS];
    
    if (!mockUser || password !== username) {
      return {
        success: false,
        message: '用户名或密码错误',
        user: null,
        tokens: null
      };
    }

    // 生成Mock tokens
    const tokens: AuthTokens = {
      accessToken: `mock_access_token_${Date.now()}`,
      refreshToken: `mock_refresh_token_${Date.now()}`,
      expiresAt: Date.now() + 3600000, // 1小时
      tokenType: 'Bearer'
    };

    // 保存tokens到TokenManager
    await TokenManager.storeTokens(tokens);

    // 转换为前端用户格式
    const user: User = {
      id: mockUser.id,
      username: mockUser.username,
      userType: mockUser.userType,
      phone: mockUser.phone,
      email: mockUser.email,
      isActive: mockUser.isActive,
      createdAt: mockUser.createdAt,
      ...(mockUser.userType === 'platform' ? { platformUser: mockUser.platformUser } : { factoryUser: mockUser.factoryUser })
    };

    console.log('🎭 Mock login successful:', { username, role: this.getUserRole(user) });

    return {
      success: true,
      message: '登录成功',
      user,
      tokens
    };
  }

  /**
   * Mock生物识别登录
   */
  static async biometricLogin(options: BiometricAuthOptions = {}): Promise<LoginResponse> {
    // 模拟生物识别延迟
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 模拟从存储中获取已保存的生物识别用户
    const storedCredential = await this.getStoredBiometricCredential();
    
    if (!storedCredential) {
      return {
        success: false,
        message: '未找到生物识别凭据，请先进行普通登录并启用生物识别',
        user: null,
        tokens: null
      };
    }

    // 模拟生物识别成功率 (90%)
    const biometricSuccess = Math.random() > 0.1;
    
    if (!biometricSuccess) {
      return {
        success: false,
        message: '生物识别验证失败，请重试',
        user: null,
        tokens: null
      };
    }

    // 返回存储的用户信息
    return await this.login({
      username: storedCredential.username,
      password: storedCredential.username, // Mock中密码等于用户名
      deviceInfo: {
        deviceId: 'mock-device',
        deviceModel: 'Mock Device',
        osVersion: '1.0.0',
        appVersion: '1.0.0',
        platform: 'android'
      }
    });
  }

  /**
   * 检查认证状态
   */
  static async checkAuthStatus(): Promise<{ isAuthenticated: boolean; user: User | null }> {
    try {
      const token = await TokenManager.getValidToken();
      
      if (!token || !token.startsWith('mock_access_token')) {
        return { isAuthenticated: false, user: null };
      }

      // 从token中提取用户信息 (Mock实现)
      const mockUsername = 'admin'; // 简化实现，实际应该从token解码
      const mockUser = MOCK_USERS[mockUsername];
      
      if (!mockUser) {
        return { isAuthenticated: false, user: null };
      }

      const user: User = {
        id: mockUser.id,
        username: mockUser.username,
        userType: mockUser.userType,
        phone: mockUser.phone,
        email: mockUser.email,
        isActive: mockUser.isActive,
        createdAt: mockUser.createdAt,
        ...(mockUser.userType === 'platform' ? { platformUser: mockUser.platformUser } : { factoryUser: mockUser.factoryUser })
      };

      return { isAuthenticated: true, user };
    } catch (error) {
      console.error('Mock auth status check failed:', error);
      return { isAuthenticated: false, user: null };
    }
  }

  /**
   * Mock Token刷新
   */
  static async refreshToken(refreshToken: string): Promise<{ success: boolean; accessToken?: string; refreshToken?: string; expiresIn?: number }> {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 500));

    if (!refreshToken || !refreshToken.startsWith('mock_refresh_token')) {
      return { success: false };
    }

    const newTokens = {
      accessToken: `mock_access_token_${Date.now()}`,
      refreshToken: `mock_refresh_token_${Date.now()}`,
      expiresIn: 3600
    };

    console.log('🔄 Mock token refresh successful');
    
    return {
      success: true,
      ...newTokens
    };
  }

  /**
   * 获取用户角色
   */
  private static getUserRole(user: User): UserRole {
    if (user.userType === 'platform') {
      return (user as any).platformUser?.role || 'platform_operator';
    } else {
      return (user as any).factoryUser?.role || 'operator';  
    }
  }

  /**
   * 获取用户权限
   */
  static getUserPermissions(user: User): UserPermissions {
    const role = this.getUserRole(user);
    return ROLE_PERMISSIONS_MAP[role] || ROLE_PERMISSIONS_MAP['viewer'];
  }

  /**
   * 生物识别凭据管理
   */
  private static async getStoredBiometricCredential(): Promise<{ username: string } | null> {
    // 模拟从安全存储中获取生物识别凭据
    // 在实际应用中这里应该是加密的凭据
    try {
      const stored = await TokenManager.getTempToken();
      if (stored?.startsWith('biometric_')) {
        const username = stored.replace('biometric_', '');
        return { username };
      }
    } catch (error) {
      console.error('Error getting biometric credential:', error);
    }
    return null;
  }

  /**
   * 保存生物识别凭据 
   */
  static async saveBiometricCredential(username: string): Promise<void> {
    if (MOCK_BIOMETRIC_USERS.has(username)) {
      await TokenManager.storeTempToken(`biometric_${username}`);
      console.log('🔐 Biometric credential saved for:', username);
    }
  }

  /**
   * 获取所有Mock用户 (调试用)
   */
  static getMockUsers(): typeof MOCK_USERS {
    return MOCK_USERS;
  }

  /**
   * 发送验证码
   */
  static async sendVerificationCode(phoneNumber: string): Promise<{ success: boolean; message?: string }> {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 500));

    // 生成6位随机验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 存储验证码，有效期5分钟
    MOCK_VERIFICATION_CODES.set(phoneNumber, {
      code,
      expires: Date.now() + 5 * 60 * 1000
    });

    console.log(`🔐 Mock verification code for ${phoneNumber}: ${code}`);

    return {
      success: true,
      message: '验证码已发送'
    };
  }

  /**
   * 验证手机号和验证码
   */
  static async verifyPhoneNumber(request: {
    phoneNumber: string;
    verificationCode: string;
    verificationType: 'registration' | 'reset';
  }): Promise<{
    success: boolean;
    message?: string;
    tempToken?: string;
    factoryId?: string;
    whitelistInfo?: any;
  }> {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 800));

    const storedCode = MOCK_VERIFICATION_CODES.get(request.phoneNumber);
    
    // 检查验证码是否存在
    if (!storedCode) {
      return {
        success: false,
        message: '请先获取验证码'
      };
    }

    // 检查验证码是否过期
    if (Date.now() > storedCode.expires) {
      MOCK_VERIFICATION_CODES.delete(request.phoneNumber);
      return {
        success: false,
        message: '验证码已过期，请重新获取'
      };
    }

    // 检查验证码是否正确
    if (storedCode.code !== request.verificationCode) {
      return {
        success: false,
        message: '验证码错误'
      };
    }

    // 清除使用过的验证码
    MOCK_VERIFICATION_CODES.delete(request.phoneNumber);

    // 检查是否在白名单中
    const whitelistInfo = MOCK_WHITELIST_PHONES[request.phoneNumber as keyof typeof MOCK_WHITELIST_PHONES];
    
    if (!whitelistInfo) {
      return {
        success: false,
        message: '该手机号未在系统白名单中，请联系管理员'
      };
    }

    // 生成临时token
    const tempToken = `temp_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      message: '验证成功',
      tempToken,
      factoryId: whitelistInfo.factoryId,
      whitelistInfo
    };
  }

  /**
   * 注册第二阶段
   */
  static async registerPhaseTwo(request: RegisterPhaseTwoRequest): Promise<RegisterResponse> {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 验证临时token
    if (!request.tempToken || !request.tempToken.startsWith('temp_token_')) {
      return {
        success: false,
        message: '临时凭证无效或已过期'
      };
    }

    // 检查用户名是否已存在
    const existingUser = Object.values(MOCK_USERS).find(u => u.username === request.username);
    if (existingUser) {
      return {
        success: false,
        message: '用户名已存在'
      };
    }

    // 创建新用户
    const newUserId = `user-new-${Date.now()}`;
    const whitelistInfo = MOCK_WHITELIST_PHONES[request.phoneNumber as keyof typeof MOCK_WHITELIST_PHONES] || 
                         { role: 'viewer', factoryId: 'factory-001', department: '生产部' };

    const newUser: User = {
      id: newUserId,
      username: request.username,
      userType: 'factory' as const,
      phone: request.phoneNumber,
      email: request.email,
      isActive: true,
      createdAt: new Date().toISOString(),
      factoryUser: {
        factoryId: request.factoryId || whitelistInfo.factoryId,
        role: whitelistInfo.role as UserRole,
        permissions: ROLE_PERMISSIONS_MAP[whitelistInfo.role as UserRole]?.features || [],
        department: request.department || whitelistInfo.department,
        departments: [request.department || whitelistInfo.department],
        level: ROLE_PERMISSIONS_MAP[whitelistInfo.role as UserRole]?.level || 50
      }
    };

    // 生成tokens
    const tokens: AuthTokens = {
      accessToken: `mock_access_token_${Date.now()}`,
      refreshToken: `mock_refresh_token_${Date.now()}`,
      expiresAt: Date.now() + 3600000, // 1小时
      tokenType: 'Bearer'
    };

    console.log('✅ Mock user registered:', { username: request.username, role: whitelistInfo.role });

    return {
      success: true,
      message: '注册成功',
      user: newUser,
      tokens
    };
  }

  /**
   * 模拟复杂权限检查
   */
  static async checkPermissions(options: {
    permissions?: string[];
    roles?: UserRole[];
    modules?: string[];
    department?: string;
    minimumLevel?: number;
    dataAccess?: {
      level: 'all' | 'factory' | 'department' | 'own';
      owner?: string;
      department?: string;
    };
  }): Promise<{
    hasAccess: boolean;
    reason: string;
    details: any;
  }> {
    // 模拟权限检查延迟
    await new Promise(resolve => setTimeout(resolve, 200));

    const { isAuthenticated, user } = await this.checkAuthStatus();
    
    if (!isAuthenticated || !user) {
      return {
        hasAccess: false,
        reason: '用户未登录',
        details: { step: 'authentication' }
      };
    }

    const userPermissions = this.getUserPermissions(user);
    const checks = [];

    // 角色检查
    if (options.roles && options.roles.length > 0) {
      const hasRole = options.roles.includes(userPermissions.role as UserRole);
      checks.push({
        name: 'roles',
        passed: hasRole,
        reason: hasRole ? '角色验证通过' : `需要角色之一: ${options.roles.join(', ')}`
      });
    }

    // 权限特性检查
    if (options.permissions && options.permissions.length > 0) {
      const hasPermission = userPermissions.features.includes('*') || 
                           options.permissions.some(p => userPermissions.features.includes(p));
      checks.push({
        name: 'permissions',
        passed: hasPermission,
        reason: hasPermission ? '权限验证通过' : `需要权限之一: ${options.permissions.join(', ')}`
      });
    }

    // 模块权限检查
    if (options.modules && options.modules.length > 0) {
      const hasModule = options.modules.some(m => (userPermissions.modules as any)[m] === true);
      checks.push({
        name: 'modules',
        passed: hasModule,
        reason: hasModule ? '模块权限验证通过' : `需要模块权限之一: ${options.modules.join(', ')}`
      });
    }

    // 权限级别检查  
    if (options.minimumLevel !== undefined) {
      const hasLevel = userPermissions.level <= options.minimumLevel;
      checks.push({
        name: 'level',
        passed: hasLevel,
        reason: hasLevel ? `权限级别满足 (${userPermissions.level})` : `权限级别不足，需要 ≤${options.minimumLevel}，当前 ${userPermissions.level}`
      });
    }

    const failedChecks = checks.filter(check => !check.passed);
    const hasAccess = failedChecks.length === 0;

    return {
      hasAccess,
      reason: hasAccess ? '权限验证通过' : `权限不足: ${failedChecks.map(c => c.reason).join('; ')}`,
      details: {
        checks,
        user: user.id,
        role: userPermissions.role,
        userType: userPermissions.userType,
        cached: false
      }
    };
  }
}

export default MockAuthService;