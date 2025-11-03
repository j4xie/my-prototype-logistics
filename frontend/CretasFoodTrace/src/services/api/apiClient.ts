import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService } from '../storage/storageService';
import { API_BASE_URL } from '../../constants/config';
import { useAuthStore } from '../../store/authStore';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // 请求拦截器 - 智能token管理
    this.client.interceptors.request.use(
      async (config) => {
        // 优先使用安全存储的访问token (使用正确的key)
        const accessToken = await StorageService.getSecureItem('secure_access_token');
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
          console.log('🔑 Using token from SecureStore');
        } else {
          // 降级到普通存储
          const token = await AsyncStorage.getItem('auth_token');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log('🔑 Using token from AsyncStorage');
          } else {
            console.warn('⚠️ No token found in storage');
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 响应拦截器 - 智能token刷新和错误处理
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // 尝试使用refresh token刷新访问token (使用正确的key)
            const refreshToken = await StorageService.getSecureItem('secure_refresh_token');
            if (refreshToken) {
              const response = await this.refreshAccessToken(refreshToken);
              if (response.success && response.tokens) {
                // 保存新的tokens (使用正确的key)
                await StorageService.setSecureItem('secure_access_token', response.tokens.token || response.tokens.accessToken);
                await StorageService.setSecureItem('secure_refresh_token', response.tokens.refreshToken);

                // 重试原始请求
                originalRequest.headers.Authorization = `Bearer ${response.tokens.token || response.tokens.accessToken}`;
                return this.client(originalRequest);
              }
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
          }

          // 刷新失败，清除所有认证信息
          await this.clearAuthTokens();
          // 触发登出事件
          this.onAuthenticationFailed?.();
        }
        return Promise.reject(error);
      }
    );
  }

  // Token刷新方法
  private async refreshAccessToken(refreshToken: string): Promise<any> {
    const response = await axios.post(`${API_BASE_URL}/api/mobile/auth/refresh`, {
      refreshToken
    });
    return response.data;
  }

  // 清除认证信息
  private async clearAuthTokens(): Promise<void> {
    await Promise.all([
      StorageService.removeSecureItem('secure_access_token'),
      StorageService.removeSecureItem('secure_refresh_token'),
      StorageService.removeSecureItem('secure_temp_token'),
      AsyncStorage.removeItem('auth_token'),
      AsyncStorage.removeItem('user_info')
    ]);

    // 同步清除authStore状态，强制返回登录页
    try {
      useAuthStore.getState().logout();
      console.log('✅ AuthStore cleared - user will be redirected to login');
    } catch (error) {
      console.error('Failed to clear auth store:', error);
    }
  }

  // 认证失败回调
  public onAuthenticationFailed?: () => void;

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();