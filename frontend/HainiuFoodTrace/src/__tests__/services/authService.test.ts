/**
 * 认证服务测试
 * 测试统一登录、注册流程、Token管理等核心认证功能
 */

import { AuthService } from '../../services/auth/authService';
import { StorageService } from '../../services/storage/storageService';
import { TokenManager } from '../../services/tokenManager';
import { BiometricManager } from '../../services/biometricManager';
import { NetworkManager } from '../../services/networkManager';
import { setupAllMocks, resetMocks } from '../mocks/apiMocks';
import { 
  createMockUser, 
  createMockTokens, 
  createMockDeviceInfo,
  waitForAsync 
} from '../mocks/testUtils';
import usersData from '../fixtures/users.json';
import apiResponses from '../fixtures/apiResponses.json';

// Mock所有依赖服务
jest.mock('../../services/storage/storageService');
jest.mock('../../services/tokenManager');
jest.mock('../../services/biometricManager');
jest.mock('../../services/networkManager');

const mockStorageService = StorageService as jest.Mocked<typeof StorageService>;
const mockTokenManager = TokenManager as jest.Mocked<typeof TokenManager>;
const mockBiometricManager = BiometricManager as jest.Mocked<typeof BiometricManager>;
const mockNetworkManager = NetworkManager as jest.Mocked<typeof NetworkManager>;

describe('AuthService', () => {
  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();
    resetMocks();
    setupAllMocks();
    
    // 默认网络连接正常
    mockNetworkManager.isConnected.mockResolvedValue(true);
    mockNetworkManager.executeWithRetry.mockImplementation((fn) => fn());
    
    // 默认生物识别不可用
    mockBiometricManager.isAvailable.mockResolvedValue(false);
  });

  describe('统一登录功能', () => {
    const validCredentials = {
      username: 'platform_admin',
      password: 'Admin@123456',
      deviceInfo: createMockDeviceInfo(),
      rememberMe: true,
      biometricEnabled: false
    };

    test('平台用户登录成功', async () => {
      const result = await AuthService.login(validCredentials);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.userType).toBe('platform');
      expect(result.tokens).toBeDefined();
      
      // 验证TokenManager被调用
      expect(mockTokenManager.storeTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          tokenType: 'Bearer'
        })
      );
      
      // 验证用户信息被保存
      expect(mockStorageService.setItem).toHaveBeenCalledWith(
        'user_info',
        expect.any(String)
      );
    });

    test('工厂用户登录成功', async () => {
      const factoryCredentials = {
        ...validCredentials,
        username: 'factory_admin',
        password: 'Factory@123456'
      };

      const result = await AuthService.login(factoryCredentials);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.userType).toBe('factory');
      expect(result.tokens).toBeDefined();
    });

    test('无效凭证登录失败', async () => {
      const invalidCredentials = {
        ...validCredentials,
        username: 'invalid_user',
        password: 'wrong_password'
      };

      await expect(AuthService.login(invalidCredentials)).rejects.toThrow(
        '用户名或密码错误'
      );
    });

    test('网络不可用时登录失败', async () => {
      mockNetworkManager.isConnected.mockResolvedValue(false);

      await expect(AuthService.login(validCredentials)).rejects.toThrow(
        '网络连接不可用，请检查网络设置'
      );
    });

    test('启用生物识别的登录流程', async () => {
      mockBiometricManager.isAvailable.mockResolvedValue(true);
      
      const biometricCredentials = {
        ...validCredentials,
        biometricEnabled: true
      };

      const result = await AuthService.login(biometricCredentials);

      expect(result.success).toBe(true);
      expect(mockBiometricManager.isAvailable).toHaveBeenCalled();
      expect(mockBiometricManager.saveBiometricCredentials).toHaveBeenCalledWith({
        username: biometricCredentials.username,
        encryptedToken: expect.any(String),
        deviceInfo: biometricCredentials.deviceInfo
      });
    });
  });

  describe('注册流程', () => {
    test('注册第一阶段 - 手机验证成功', async () => {
      const request = {
        phoneNumber: '+86138000000009',
        verificationType: 'register' as const,
        factoryId: 'FAC001'
      };

      const result = await AuthService.registerPhaseOne(request);

      expect(result.success).toBe(true);
      expect(result.tempToken).toBeDefined();
      expect(mockStorageService.setSecureItem).toHaveBeenCalledWith(
        'temp_token',
        expect.any(String)
      );
    });

    test('注册第一阶段 - 手机号不在白名单', async () => {
      const request = {
        phoneNumber: '+86138999999999',
        verificationType: 'register' as const
      };

      await expect(AuthService.registerPhaseOne(request)).rejects.toThrow(
        '手机号未在白名单中'
      );
    });

    test('注册第二阶段 - 完整资料提交成功', async () => {
      const request = {
        phoneNumber: '+86138000000009',
        verificationCode: '123456',
        username: 'new_operator',
        password: 'NewUser@123456',
        realName: '新注册用户',
        email: 'new@factory001.com',
        departmentId: 'processing',
        deviceInfo: createMockDeviceInfo()
      };

      const result = await AuthService.registerPhaseTwo(request);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      
      // 验证临时token被清除
      expect(mockStorageService.removeSecureItem).toHaveBeenCalledWith('temp_token');
    });
  });

  describe('生物识别登录', () => {
    beforeEach(() => {
      mockBiometricManager.isBiometricLoginEnabled.mockResolvedValue(true);
      mockBiometricManager.authenticate.mockResolvedValue(true);
      mockBiometricManager.getBiometricCredentials.mockResolvedValue({
        username: 'platform_admin',
        encryptedToken: 'encrypted_token_123',
        deviceInfo: createMockDeviceInfo()
      });
    });

    test('生物识别登录成功', async () => {
      const result = await AuthService.biometricLogin();

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      
      expect(mockBiometricManager.isBiometricLoginEnabled).toHaveBeenCalled();
      expect(mockBiometricManager.authenticate).toHaveBeenCalled();
      expect(mockBiometricManager.getBiometricCredentials).toHaveBeenCalled();
    });

    test('生物识别未启用', async () => {
      mockBiometricManager.isBiometricLoginEnabled.mockResolvedValue(false);

      await expect(AuthService.biometricLogin()).rejects.toThrow(
        '生物识别登录未启用'
      );
    });

    test('生物识别认证失败', async () => {
      mockBiometricManager.authenticate.mockResolvedValue(false);

      await expect(AuthService.biometricLogin()).rejects.toThrow(
        '生物识别认证失败'
      );
    });

    test('未找到生物识别凭据', async () => {
      mockBiometricManager.getBiometricCredentials.mockResolvedValue(null);

      await expect(AuthService.biometricLogin()).rejects.toThrow(
        '未找到生物识别登录凭据'
      );
    });

    test('生物识别登录时更新凭据', async () => {
      const result = await AuthService.biometricLogin();

      expect(result.success).toBe(true);
      expect(mockBiometricManager.saveBiometricCredentials).toHaveBeenCalledWith({
        username: 'platform_admin',
        encryptedToken: expect.any(String),
        deviceInfo: expect.any(Object)
      });
    });
  });

  describe('设备登录', () => {
    test('设备登录成功', async () => {
      mockStorageService.getSecureItem
        .mockResolvedValueOnce('test-device-123') // device_id
        .mockResolvedValueOnce('device_token_123'); // device_token

      const result = await AuthService.deviceLogin();

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
    });

    test('设备未绑定时登录失败', async () => {
      mockStorageService.getSecureItem.mockResolvedValue(null);

      await expect(AuthService.deviceLogin()).rejects.toThrow(
        '设备未绑定，请先进行正常登录'
      );
    });
  });

  describe('登出功能', () => {
    test('登出成功', async () => {
      await AuthService.logout();

      // 验证清除认证数据的方法被调用
      expect(mockTokenManager.clearTokens).toHaveBeenCalled();
      expect(mockStorageService.removeItem).toHaveBeenCalledWith('user_info');
      expect(mockStorageService.removeItem).toHaveBeenCalledWith('user_role');
      expect(mockStorageService.removeItem).toHaveBeenCalledWith('last_login');
      expect(mockStorageService.removeSecureItem).toHaveBeenCalledWith('device_token');
    });
  });

  describe('认证状态检查', () => {
    test('有效认证状态', async () => {
      const mockUser = createMockUser('platform', 'platform_super_admin');
      mockTokenManager.getValidToken.mockResolvedValue('valid_token_123');
      mockStorageService.getItem.mockResolvedValue(JSON.stringify(mockUser));

      const result = await AuthService.checkAuthStatus();

      expect(result.isAuthenticated).toBe(true);
      expect(result.user).toEqual(mockUser);
    });

    test('Token无效时清除认证信息', async () => {
      mockTokenManager.getValidToken.mockResolvedValue('invalid_token');
      mockStorageService.getItem.mockResolvedValue(JSON.stringify(createMockUser()));
      
      // 模拟API调用失败
      mockNetworkManager.executeWithRetry.mockRejectedValue(new Error('Token invalid'));

      const result = await AuthService.checkAuthStatus();

      expect(result.isAuthenticated).toBe(false);
      expect(result.user).toBe(null);
      expect(mockTokenManager.clearTokens).toHaveBeenCalled();
    });

    test('无Token或用户信息', async () => {
      mockTokenManager.getValidToken.mockResolvedValue(null);
      mockStorageService.getItem.mockResolvedValue(null);

      const result = await AuthService.checkAuthStatus();

      expect(result.isAuthenticated).toBe(false);
      expect(result.user).toBe(null);
    });
  });

  describe('权限和角色检查', () => {
    const mockUser = createMockUser('factory', 'operator');

    beforeEach(() => {
      mockStorageService.getItem.mockResolvedValue(JSON.stringify(mockUser));
    });

    test('权限检查 - 有权限', async () => {
      // Mock用户权限
      const userWithPermissions = {
        ...mockUser,
        permissions: {
          ...mockUser.permissions || {},
          features: ['production_operation', 'quality_inspection']
        }
      };
      mockStorageService.getItem.mockResolvedValue(JSON.stringify(userWithPermissions));

      const hasPermission = await AuthService.hasPermission('production_operation');
      expect(hasPermission).toBe(true);
    });

    test('权限检查 - 无权限', async () => {
      const userWithPermissions = {
        ...mockUser,
        permissions: {
          ...mockUser.permissions || {},
          features: ['quality_inspection']
        }
      };
      mockStorageService.getItem.mockResolvedValue(JSON.stringify(userWithPermissions));

      const hasPermission = await AuthService.hasPermission('admin_access');
      expect(hasPermission).toBe(false);
    });

    test('角色检查 - 匹配角色', async () => {
      const hasRole = await AuthService.hasRole('operator');
      expect(hasRole).toBe(true);
    });

    test('角色检查 - 不匹配角色', async () => {
      const hasRole = await AuthService.hasRole('factory_super_admin');
      expect(hasRole).toBe(false);
    });

    test('获取当前用户', async () => {
      const currentUser = await AuthService.getCurrentUser();
      expect(currentUser).toEqual(mockUser);
    });

    test('无用户信息时返回null', async () => {
      mockStorageService.getItem.mockResolvedValue(null);
      
      const currentUser = await AuthService.getCurrentUser();
      expect(currentUser).toBe(null);
    });
  });

  describe('验证码相关功能', () => {
    test('发送验证码成功', async () => {
      const result = await AuthService.sendVerificationCode('+86138000000009');
      
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    test('验证手机号成功', async () => {
      const request = {
        phoneNumber: '+86138000000009',
        verificationCode: '123456',
        verificationType: 'registration' as const
      };

      const result = await AuthService.verifyPhoneNumber(request);
      
      expect(result.success).toBe(true);
      if (result.tempToken) {
        expect(mockStorageService.setSecureItem).toHaveBeenCalledWith(
          'temp_token', 
          result.tempToken
        );
      }
    });
  });

  describe('错误处理', () => {
    test('网络错误处理', async () => {
      mockNetworkManager.isConnected.mockResolvedValue(false);

      await expect(AuthService.login({
        username: 'test',
        password: 'test',
        deviceInfo: createMockDeviceInfo()
      })).rejects.toThrow('网络连接不可用');
    });

    test('API错误响应处理', async () => {
      // 这个测试由API mock自动处理错误响应
      await expect(AuthService.login({
        username: 'invalid',
        password: 'invalid',
        deviceInfo: createMockDeviceInfo()
      })).rejects.toThrow();
    });
  });
});