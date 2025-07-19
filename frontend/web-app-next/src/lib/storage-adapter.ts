/**
 * 存储适配器
 * 
 * 为缓存系统提供统一的存储接口，支持localStorage、sessionStorage和IndexedDB
 */

export interface StorageOptions {
  /** 存储类型 */
  type?: 'localStorage' | 'sessionStorage' | 'indexedDB';
  /** 数据库名称（仅用于IndexedDB） */
  dbName?: string;
  /** 存储版本 */
  version?: number;
  /** 是否启用压缩 */
  compress?: boolean;
}

export class StorageAdapter {
  private storageType: 'localStorage' | 'sessionStorage' | 'indexedDB';
  private prefix: string;
  private options: Required<StorageOptions>;

  constructor(prefix: string = 'cache', options: StorageOptions = {}) {
    this.prefix = prefix;
    this.options = {
      type: 'localStorage',
      dbName: 'AiCache',
      version: 1,
      compress: false,
      ...options
    };
    this.storageType = this.options.type;
  }

  /**
   * 获取存储的数据
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);

    try {
      switch (this.storageType) {
        case 'localStorage':
          return this.getFromWebStorage(localStorage, fullKey);
        case 'sessionStorage':
          return this.getFromWebStorage(sessionStorage, fullKey);
        case 'indexedDB':
          return this.getFromIndexedDB(fullKey);
        default:
          throw new Error(`不支持的存储类型: ${this.storageType}`);
      }
    } catch (error) {
      console.warn(`[StorageAdapter] 获取数据失败 (${key}):`, error);
      return null;
    }
  }

  /**
   * 存储数据
   */
  async set<T>(key: string, value: T): Promise<void> {
    const fullKey = this.getFullKey(key);

    try {
      switch (this.storageType) {
        case 'localStorage':
          return this.setToWebStorage(localStorage, fullKey, value);
        case 'sessionStorage':
          return this.setToWebStorage(sessionStorage, fullKey, value);
        case 'indexedDB':
          return this.setToIndexedDB(fullKey, value);
        default:
          throw new Error(`不支持的存储类型: ${this.storageType}`);
      }
    } catch (error) {
      console.warn(`[StorageAdapter] 存储数据失败 (${key}):`, error);
      throw error;
    }
  }

  /**
   * 删除数据
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);

    try {
      switch (this.storageType) {
        case 'localStorage':
          localStorage.removeItem(fullKey);
          break;
        case 'sessionStorage':
          sessionStorage.removeItem(fullKey);
          break;
        case 'indexedDB':
          await this.deleteFromIndexedDB(fullKey);
          break;
        default:
          throw new Error(`不支持的存储类型: ${this.storageType}`);
      }
    } catch (error) {
      console.warn(`[StorageAdapter] 删除数据失败 (${key}):`, error);
      throw error;
    }
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<void> {
    try {
      switch (this.storageType) {
        case 'localStorage':
          this.clearWebStorage(localStorage);
          break;
        case 'sessionStorage':
          this.clearWebStorage(sessionStorage);
          break;
        case 'indexedDB':
          await this.clearIndexedDB();
          break;
        default:
          throw new Error(`不支持的存储类型: ${this.storageType}`);
      }
    } catch (error) {
      console.warn('[StorageAdapter] 清空数据失败:', error);
      throw error;
    }
  }

  // ========================= 私有方法 =========================

  private getFullKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  private getFromWebStorage<T>(storage: Storage, key: string): T | null {
    const item = storage.getItem(key);
    if (item === null) {
      return null;
    }

    try {
      const parsed = JSON.parse(item);
      return this.options.compress ? this.decompress(parsed) : parsed;
    } catch (error) {
      console.warn(`[StorageAdapter] 解析数据失败:`, error);
      return null;
    }
  }

  private setToWebStorage<T>(storage: Storage, key: string, value: T): void {
    try {
      const dataToStore = this.options.compress ? this.compress(value) : value;
      storage.setItem(key, JSON.stringify(dataToStore));
    } catch (error) {
      console.warn(`[StorageAdapter] WebStorage存储失败:`, error);
      throw error;
    }
  }

  private clearWebStorage(storage: Storage): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(this.prefix + ':')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => storage.removeItem(key));
  }

  // IndexedDB 方法（简化实现）
  private async getFromIndexedDB<T>(key: string): Promise<T | null> {
    // 简化实现，实际项目中应该使用完整的IndexedDB实现
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      // 降级到localStorage
      return this.getFromWebStorage(localStorage, key);
    } catch (error) {
      console.warn('[StorageAdapter] IndexedDB降级失败:', error);
      return null;
    }
  }

  private async setToIndexedDB<T>(key: string, value: T): Promise<void> {
    // 简化实现，降级到localStorage
    if (typeof window === 'undefined') {
      return;
    }

    try {
      this.setToWebStorage(localStorage, key, value);
    } catch (error) {
      console.warn('[StorageAdapter] IndexedDB降级失败:', error);
      throw error;
    }
  }

  private async deleteFromIndexedDB(key: string): Promise<void> {
    // 简化实现，降级到localStorage
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('[StorageAdapter] IndexedDB删除降级失败:', error);
      throw error;
    }
  }

  private async clearIndexedDB(): Promise<void> {
    // 简化实现，降级到localStorage
    if (typeof window === 'undefined') {
      return;
    }

    try {
      this.clearWebStorage(localStorage);
    } catch (error) {
      console.warn('[StorageAdapter] IndexedDB清空降级失败:', error);
      throw error;
    }
  }

  // 压缩/解压缩方法（简化实现）
  private compress(data: any): any {
    // 这里可以实现真正的压缩算法，如LZ-string
    // 目前只是简单返回原数据
    return data;
  }

  private decompress(data: any): any {
    // 这里实现对应的解压缩
    return data;
  }

  /**
   * 检查存储是否可用
   */
  static isStorageAvailable(type: 'localStorage' | 'sessionStorage'): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const storage = window[type];
      const testKey = '__storage_test__';
      storage.setItem(testKey, 'test');
      storage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取存储使用情况
   */
  async getStorageInfo(): Promise<{
    used: number;
    total: number;
    available: number;
  }> {
    if (typeof window === 'undefined') {
      return { used: 0, total: 0, available: 0 };
    }

    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          total: estimate.quota || 0,
          available: (estimate.quota || 0) - (estimate.usage || 0)
        };
      }
    } catch (error) {
      console.warn('[StorageAdapter] 获取存储信息失败:', error);
    }

    // 降级实现
    return { used: 0, total: 0, available: 0 };
  }
} 