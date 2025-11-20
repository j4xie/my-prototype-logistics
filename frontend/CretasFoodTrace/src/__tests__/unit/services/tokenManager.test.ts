/**
 * TokenManager 单元测试
 * 测试Token管理器的所有核心功能
 */

import { TokenManager } from '../../../services/tokenManager';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { wait } from '../../utils/testHelpers';

// Mock apiClient
jest.mock('../../../services/api/apiClient', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

import { apiClient } from '../../../services/api/apiClient';

describe('TokenManager', () => {
  const mockTokens = {
    accessToken: 'mock-access-token-12345',
    refreshToken: 'mock-refresh-token-67890',
    expiresAt: Date.now() + 3600 * 1000, // 1 hour from now
    tokenType: 'Bearer',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks
    (SecureStore.setItemAsync as jest.Mock).mockReset();
    (SecureStore.getItemAsync as jest.Mock).mockReset();
    (SecureStore.deleteItemAsync as jest.Mock).mockReset();
    (AsyncStorage.setItem as jest.Mock).mockReset();
    (AsyncStorage.getItem as jest.Mock).mockReset();
    (AsyncStorage.removeItem as jest.Mock).mockReset();
  });

  describe('storeTokens', () => {
    it('应该成功存储tokens到SecureStore', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await TokenManager.storeTokens(mockTokens);

      // 验证SecureStore调用
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'secure_access_token',
        mockTokens.accessToken
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'secure_refresh_token',
        mockTokens.refreshToken
      );

      // 验证AsyncStorage调用
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'token_expiry',
        mockTokens.expiresAt.toString()
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'token_type',
        'Bearer'
      );
    });

    it('应该存储临时token（如果提供）', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const tokensWithTemp = {
        ...mockTokens,
        tempToken: 'temp-token-abc',
      };

      await TokenManager.storeTokens(tokensWithTemp);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'secure_temp_token',
        'temp-token-abc'
      );
    });

    it('应该在SecureStore不可用时抛出错误', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('SecureStore not available'));

      await expect(TokenManager.storeTokens(mockTokens)).rejects.toThrow();
    });

    it('应该使用默认过期时间（如果未提供）', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const tokensWithoutExpiry = {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: 0, // Will use default
        tokenType: 'Bearer',
      };

      await TokenManager.storeTokens(tokensWithoutExpiry);

      // 验证设置了过期时间
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'token_expiry',
        expect.any(String)
      );
    });
  });

  describe('getValidToken', () => {
    it('应该返回有效的访问token', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-token');
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        String(Date.now() + 3600 * 1000) // 1 hour future
      );

      const token = await TokenManager.getValidToken();

      expect(token).toBe('valid-token');
    });

    it('应该在token不存在时返回null', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const token = await TokenManager.getValidToken();

      expect(token).toBeNull();
    });

    it('应该在token即将过期时刷新token', async () => {
      // Mock即将过期的token (1分钟后过期，小于5分钟阈值)
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('old-token') // getAccessToken
        .mockResolvedValueOnce('refresh-token'); // getRefreshToken

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        String(Date.now() + 60 * 1000) // 1 minute future
      );

      (apiClient.post as jest.Mock).mockResolvedValue({
        success: true,
        accessToken: 'new-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
      });

      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const token = await TokenManager.getValidToken();

      // 应该调用了refresh API
      expect(apiClient.post).toHaveBeenCalledWith('/api/mobile/auth/refresh', {
        refreshToken: 'refresh-token',
      });

      // 应该返回新token
      expect(token).toBe('new-token');
    });
  });

  describe('refreshToken', () => {
    it('应该成功刷新token', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('refresh-token-123');
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      (apiClient.post as jest.Mock).mockResolvedValue({
        success: true,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
      });

      const newToken = await TokenManager.refreshToken();

      expect(newToken).toBe('new-access-token');
      expect(apiClient.post).toHaveBeenCalledWith('/api/mobile/auth/refresh', {
        refreshToken: 'refresh-token-123',
      });
    });

    it('应该在refresh token不存在时返回null', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const newToken = await TokenManager.refreshToken();

      expect(newToken).toBeNull();
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('应该在刷新失败时返回null', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('refresh-token');

      (apiClient.post as jest.Mock).mockRejectedValue(new Error('Refresh failed'));

      const newToken = await TokenManager.refreshToken();

      expect(newToken).toBeNull();
    });

    it('应该防止并发刷新', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('refresh-token');
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      (apiClient.post as jest.Mock).mockImplementation(() =>
        wait(100).then(() => ({
          success: true,
          accessToken: 'new-token',
          expiresIn: 3600,
        }))
      );

      // 同时发起两个刷新请求
      const promise1 = TokenManager.refreshToken();
      const promise2 = TokenManager.refreshToken();

      const [token1, token2] = await Promise.all([promise1, promise2]);

      // 应该返回相同的token
      expect(token1).toBe(token2);

      // API应该只被调用一次
      expect(apiClient.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('isTokenExpired', () => {
    it('应该在token已过期时返回true', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        String(Date.now() - 1000) // 1 second in past
      );

      const isExpired = await TokenManager.isTokenExpired();

      expect(isExpired).toBe(true);
    });

    it('应该在token未过期时返回false', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        String(Date.now() + 3600 * 1000) // 1 hour future
      );

      const isExpired = await TokenManager.isTokenExpired();

      expect(isExpired).toBe(false);
    });

    it('应该在token不存在时返回true', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const isExpired = await TokenManager.isTokenExpired();

      expect(isExpired).toBe(true);
    });
  });

  describe('getTempToken / storeTempToken', () => {
    it('应该成功存储临时token', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      await TokenManager.storeTempToken('temp-token-xyz');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'secure_temp_token',
        'temp-token-xyz'
      );
    });

    it('应该成功获取临时token', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('temp-token-xyz');

      const tempToken = await TokenManager.getTempToken();

      expect(tempToken).toBe('temp-token-xyz');
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('secure_temp_token');
    });

    it('应该在临时token不存在时返回null', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const tempToken = await TokenManager.getTempToken();

      expect(tempToken).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('应该清除所有tokens', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      await TokenManager.clearTokens();

      // 验证SecureStore清理
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('secure_access_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('secure_refresh_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('secure_temp_token');

      // 验证AsyncStorage清理
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('token_expiry');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('token_type');
    });

    it('应该处理清理失败的情况', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error('Delete failed'));
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      // 不应该抛出错误
      await expect(TokenManager.clearTokens()).resolves.not.toThrow();
    });
  });

  describe('getTokenInfo', () => {
    it('应该返回完整的token信息', async () => {
      const futureTime = Date.now() + 3600 * 1000;

      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token')
        .mockResolvedValueOnce('temp-token');

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(String(futureTime));

      const info = await TokenManager.getTokenInfo();

      expect(info.hasAccessToken).toBe(true);
      expect(info.hasRefreshToken).toBe(true);
      expect(info.hasTempToken).toBe(true);
      expect(info.expiresAt).toBe(futureTime);
      expect(info.isExpired).toBe(false);
      expect(info.timeUntilExpiry).toBeGreaterThan(0);
    });

    it('应该处理缺失的tokens', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const info = await TokenManager.getTokenInfo();

      expect(info.hasAccessToken).toBe(false);
      expect(info.hasRefreshToken).toBe(false);
      expect(info.hasTempToken).toBe(false);
      expect(info.expiresAt).toBeNull();
      expect(info.isExpired).toBe(true);
    });
  });

  describe('validateTokenFormat', () => {
    it('应该验证有效的JWT格式', () => {
      // 简单的JWT格式: header.payload.signature
      const validJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

      const isValid = TokenManager.validateTokenFormat(validJWT);

      expect(isValid).toBe(true);
    });

    it('应该拒绝无效的token格式', () => {
      const invalidTokens = [
        '',
        'invalid',
        'only.two.parts',
        null,
        undefined,
        123,
      ];

      invalidTokens.forEach((token: any) => {
        expect(TokenManager.validateTokenFormat(token)).toBe(false);
      });
    });

    it('应该拒绝缺少部分的token', () => {
      const invalidToken = 'header.payload'; // Missing signature

      const isValid = TokenManager.validateTokenFormat(invalidToken);

      expect(isValid).toBe(false);
    });
  });
});
