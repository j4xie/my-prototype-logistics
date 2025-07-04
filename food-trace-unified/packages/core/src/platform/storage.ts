// 跨平台存储适配器
import type { StorageAdapter } from '../types/platform';

class WebStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('Failed to set localStorage item:', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove localStorage item:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      return Object.keys(localStorage);
    } catch {
      return [];
    }
  }
}

class MemoryStorageAdapter implements StorageAdapter {
  private storage = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async getAllKeys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }
}

// React Native AsyncStorage适配器 (运行时动态导入)
class AsyncStorageAdapter implements StorageAdapter {
  private asyncStorage: any;

  constructor() {
    // 动态导入，避免在Web环境中出错
    this.initAsyncStorage();
  }

  private async initAsyncStorage() {
    try {
      // 在React Native环境中动态导入
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      this.asyncStorage = AsyncStorage;
    } catch {
      // 如果导入失败，回退到内存存储
      console.warn('AsyncStorage not available, falling back to memory storage');
      const memoryAdapter = new MemoryStorageAdapter();
      Object.assign(this, memoryAdapter);
    }
  }

  async getItem(key: string): Promise<string | null> {
    if (!this.asyncStorage) {
      await this.initAsyncStorage();
    }
    try {
      return await this.asyncStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!this.asyncStorage) {
      await this.initAsyncStorage();
    }
    try {
      await this.asyncStorage.setItem(key, value);
    } catch (error) {
      console.warn('Failed to set AsyncStorage item:', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    if (!this.asyncStorage) {
      await this.initAsyncStorage();
    }
    try {
      await this.asyncStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove AsyncStorage item:', error);
    }
  }

  async clear(): Promise<void> {
    if (!this.asyncStorage) {
      await this.initAsyncStorage();
    }
    try {
      await this.asyncStorage.clear();
    } catch (error) {
      console.warn('Failed to clear AsyncStorage:', error);
    }
  }

  async getAllKeys(): Promise<string[]> {
    if (!this.asyncStorage) {
      await this.initAsyncStorage();
    }
    try {
      return await this.asyncStorage.getAllKeys();
    } catch {
      return [];
    }
  }
}

export function createStorageAdapter(platform: 'web' | 'mobile' | 'auto' = 'auto'): StorageAdapter {
  if (platform === 'auto') {
    // 自动检测平台
    if (typeof window !== 'undefined' && window.localStorage) {
      return new WebStorageAdapter();
    } else if (typeof global !== 'undefined') {
      // React Native 环境
      return new AsyncStorageAdapter();
    } else {
      return new MemoryStorageAdapter();
    }
  }

  switch (platform) {
    case 'web':
      return new WebStorageAdapter();
    case 'mobile':
      return new AsyncStorageAdapter();
    default:
      return new MemoryStorageAdapter();
  }
}

// 存储键常量
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'food_trace_auth_token',
  USER_INFO: 'food_trace_user_info',
  PERMISSIONS: 'food_trace_permissions',
  PREFERENCES: 'food_trace_preferences',
  SEARCH_HISTORY: 'food_trace_search_history',
  OFFLINE_DATA: 'food_trace_offline_data',
} as const;