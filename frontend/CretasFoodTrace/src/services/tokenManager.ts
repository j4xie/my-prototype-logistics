import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { apiClient } from './api/apiClient';
import { SecureStorageUnavailableError, TokenStorageError } from '../errors';
import { logger } from '../utils/logger';

// 创建TokenManager专用logger
const tokenLogger = logger.createContextLogger('TokenManager');

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tempToken?: string;
  expiresAt: number;
  tokenType: string;
}

export interface TokenRefreshResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  message?: string;
}

export class TokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'secure_access_token';
  private static readonly REFRESH_TOKEN_KEY = 'secure_refresh_token';
  private static readonly TEMP_TOKEN_KEY = 'secure_temp_token';
  private static readonly TOKEN_EXPIRY_KEY = 'token_expiry';
  private static readonly TOKEN_TYPE_KEY = 'token_type';

  // Token自动刷新状态
  private static isRefreshing = false;
  private static refreshPromise: Promise<string | null> | null = null;

  /**
   * 安全存储tokens - 根据平台选择合适的存储方式
   */
  static async storeTokens(tokens: AuthTokens): Promise<void> {
    try {
      const expiryTime = tokens.expiresAt || (Date.now() + 3600 * 1000); // 默认1小时

      // Web平台使用AsyncStorage，移动端使用SecureStore
      if (Platform.OS === 'web') {
        await Promise.all([
          AsyncStorage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken),
          AsyncStorage.setItem(this.REFRESH_TOKEN_KEY, tokens.refreshToken),
          AsyncStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString()),
          AsyncStorage.setItem(this.TOKEN_TYPE_KEY, tokens.tokenType || 'Bearer'),
        ]);
        if (tokens.tempToken) {
          await AsyncStorage.setItem(this.TEMP_TOKEN_KEY, tokens.tempToken);
        }
      } else {
        try {
          await Promise.all([
            SecureStore.setItemAsync(this.ACCESS_TOKEN_KEY, tokens.accessToken),
            SecureStore.setItemAsync(this.REFRESH_TOKEN_KEY, tokens.refreshToken),
            AsyncStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString()),
            AsyncStorage.setItem(this.TOKEN_TYPE_KEY, tokens.tokenType || 'Bearer'),
          ]);

          if (tokens.tempToken) {
            await SecureStore.setItemAsync(this.TEMP_TOKEN_KEY, tokens.tempToken);
          }
        } catch (secureStoreError) {
          tokenLogger.error('SecureStore不可用', secureStoreError);
          throw new SecureStorageUnavailableError(
            '您的设备不支持安全存储功能。为保护您的登录凭证安全，请使用支持安全存储的设备登录。'
          );
        }
      }

      tokenLogger.debug('Tokens存储成功');
    } catch (error) {
      tokenLogger.error('Token存储失败', error);
      throw new Error('Token存储失败');
    }
  }

  /**
   * 获取有效的访问token - 自动检查过期并刷新
   */
  static async getValidToken(): Promise<string | null> {
    try {
      // 获取当前访问token
      let accessToken = await this.getAccessToken();
      if (!accessToken) {
        tokenLogger.debug('未找到访问令牌');
        return null;
      }

      // 检查token是否即将过期 (提前5分钟刷新)
      const isExpiringSoon = await this.isTokenExpiringSoon(5 * 60 * 1000);

      if (isExpiringSoon) {
        tokenLogger.info('Token即将过期，尝试刷新');
        const refreshedToken = await this.refreshTokenIfNeeded();
        return refreshedToken || accessToken;
      }

      return accessToken;
    } catch (error) {
      tokenLogger.error('获取有效Token失败', error);
      return null;
    }
  }

  /**
   * 刷新token - 支持并发请求防重复
   */
  static async refreshToken(): Promise<string | null> {
    // 防止并发刷新
    if (this.isRefreshing && this.refreshPromise) {
      tokenLogger.debug('Token刷新已在进行中，等待...');
      return await this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * 执行token刷新
   */
  private static async performTokenRefresh(): Promise<string | null> {
    try {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) {
        tokenLogger.warn('无可用的刷新令牌');
        return null;
      }

      tokenLogger.info('正在刷新Token');
      const response = await apiClient.post<TokenRefreshResponse>('/api/mobile/auth/refresh', {
        refreshToken
      });

      if (response.success && response.accessToken) {
        // 存储新的tokens（敏感字段会被自动脱敏）
        const newTokens: AuthTokens = {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken || refreshToken,
          expiresAt: Date.now() + (response.expiresIn || 3600) * 1000,
          tokenType: 'Bearer'
        };

        await this.storeTokens(newTokens);
        tokenLogger.info('Token刷新成功');
        return response.accessToken;
      } else {
        tokenLogger.warn('Token刷新失败', { message: response.message });
        return null;
      }
    } catch (error) {
      tokenLogger.error('Token刷新错误', error);
      return null;
    }
  }

  /**
   * 检查token是否需要刷新
   */
  private static async refreshTokenIfNeeded(): Promise<string | null> {
    const needsRefresh = await this.isTokenExpiringSoon(5 * 60 * 1000);
    
    if (needsRefresh) {
      return await this.refreshToken();
    }
    
    return await this.getAccessToken();
  }

  /**
   * 检查token是否即将过期
   */
  private static async isTokenExpiringSoon(thresholdMs: number = 5 * 60 * 1000): Promise<boolean> {
    try {
      const expiryTime = await AsyncStorage.getItem(this.TOKEN_EXPIRY_KEY);
      if (!expiryTime) return true;

      const expiry = parseInt(expiryTime, 10);
      const now = Date.now();
      const timeUntilExpiry = expiry - now;

      return timeUntilExpiry <= thresholdMs;
    } catch (error) {
      tokenLogger.error('检查Token过期时间失败', error);
      return true;
    }
  }

  /**
   * 检查token是否已过期
   */
  static async isTokenExpired(): Promise<boolean> {
    try {
      const expiryTime = await AsyncStorage.getItem(this.TOKEN_EXPIRY_KEY);
      if (!expiryTime) return true;

      const expiry = parseInt(expiryTime, 10);
      return Date.now() >= expiry;
    } catch (error) {
      tokenLogger.error('检查Token过期状态失败', error);
      return true;
    }
  }

  /**
   * 获取访问token
   */
  private static async getAccessToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return await AsyncStorage.getItem(this.ACCESS_TOKEN_KEY);
      }
      return await SecureStore.getItemAsync(this.ACCESS_TOKEN_KEY);
    } catch (error) {
      tokenLogger.error('获取访问令牌失败', error);
      return null;
    }
  }

  /**
   * 获取刷新token
   */
  private static async getRefreshToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return await AsyncStorage.getItem(this.REFRESH_TOKEN_KEY);
      }
      return await SecureStore.getItemAsync(this.REFRESH_TOKEN_KEY);
    } catch (error) {
      tokenLogger.error('获取刷新令牌失败', error);
      return null;
    }
  }

  /**
   * 获取临时token (注册流程使用)
   */
  static async getTempToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return await AsyncStorage.getItem(this.TEMP_TOKEN_KEY);
      }
      return await SecureStore.getItemAsync(this.TEMP_TOKEN_KEY);
    } catch (error) {
      tokenLogger.error('获取临时令牌失败', error);
      return null;
    }
  }

  /**
   * 存储临时token
   */
  static async storeTempToken(tempToken: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(this.TEMP_TOKEN_KEY, tempToken);
      } else {
        await SecureStore.setItemAsync(this.TEMP_TOKEN_KEY, tempToken);
      }
    } catch (error) {
      tokenLogger.error('临时令牌存储失败', error);
      throw new TokenStorageError('临时令牌存储失败', error as Error);
    }
  }

  /**
   * 清除所有tokens
   */
  static async clearTokens(): Promise<void> {
    try {
      // 同时清理SecureStore和AsyncStorage，确保完全清理
      const asyncCleanup = [
        AsyncStorage.removeItem(this.ACCESS_TOKEN_KEY).catch(() => {}),
        AsyncStorage.removeItem(this.REFRESH_TOKEN_KEY).catch(() => {}),
        AsyncStorage.removeItem(this.TEMP_TOKEN_KEY).catch(() => {}),
        AsyncStorage.removeItem(this.TOKEN_EXPIRY_KEY).catch(() => {}),
        AsyncStorage.removeItem(this.TOKEN_TYPE_KEY).catch(() => {}),
      ];
      const secureCleanup = Platform.OS === 'web' ? [] : [
        SecureStore.deleteItemAsync(this.ACCESS_TOKEN_KEY).catch(() => {}),
        SecureStore.deleteItemAsync(this.REFRESH_TOKEN_KEY).catch(() => {}),
        SecureStore.deleteItemAsync(this.TEMP_TOKEN_KEY).catch(() => {}),
      ];
      await Promise.all([...asyncCleanup, ...secureCleanup]);

      tokenLogger.info('所有Token已清除');
    } catch (error) {
      tokenLogger.error('清除Token失败', error);
      throw error;
    }
  }

  /**
   * 获取token信息（用于调试）
   */
  static async getTokenInfo(): Promise<{
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    hasTempToken: boolean;
    expiresAt: number | null;
    isExpired: boolean;
    timeUntilExpiry: number | null;
  }> {
    try {
      const [accessToken, refreshToken, tempToken, expiryTime] = await Promise.all([
        this.getAccessToken(),
        this.getRefreshToken(),
        this.getTempToken(),
        AsyncStorage.getItem(this.TOKEN_EXPIRY_KEY),
      ]);

      const expiry = expiryTime ? parseInt(expiryTime, 10) : null;
      const now = Date.now();
      const isExpired = expiry ? now >= expiry : true;
      const timeUntilExpiry = expiry ? expiry - now : null;

      return {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        hasTempToken: !!tempToken,
        expiresAt: expiry,
        isExpired,
        timeUntilExpiry,
      };
    } catch (error) {
      tokenLogger.error('获取Token信息失败', error);
      return {
        hasAccessToken: false,
        hasRefreshToken: false,
        hasTempToken: false,
        expiresAt: null,
        isExpired: true,
        timeUntilExpiry: null,
      };
    }
  }

  /**
   * 验证token格式
   */
  static validateTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') return false;
    
    // 基本的JWT格式验证 (三个部分用.分隔)
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    try {
      // 验证每部分都是有效的base64
      parts.forEach(part => {
        if (!part) throw new Error('Empty token part');
        // 简单的base64验证
        const decoded = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
        if (!decoded) throw new Error('Invalid base64');
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}