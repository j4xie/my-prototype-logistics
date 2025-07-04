/**
 * 跨平台存储适配器
 * 支持Web (localStorage/sessionStorage) 和 React Native (AsyncStorage)
 */

export interface IStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys?(): Promise<string[]>;
}

export interface StorageOptions {
  /** 存储key前缀 */
  prefix?: string;
  /** 是否启用JSON序列化 */
  serialize?: boolean;
  /** 是否启用压缩 */
  compress?: boolean;
  /** 错误处理 */
  onError?: (error: Error, operation: string) => void;
}

/**
 * 抽象存储适配器基类
 */
export abstract class BaseStorageAdapter implements IStorageAdapter {
  protected options: Required<StorageOptions>;

  constructor(options: StorageOptions = {}) {
    this.options = {
      prefix: '',
      serialize: true,
      compress: false,
      onError: (error, operation) => {
        console.warn(`[Storage] ${operation} failed:`, error);
      },
      ...options
    };
  }

  abstract getItem(key: string): Promise<string | null>;
  abstract setItem(key: string, value: string): Promise<void>;
  abstract removeItem(key: string): Promise<void>;
  abstract clear(): Promise<void>;

  protected getFullKey(key: string): string {
    return this.options.prefix ? `${this.options.prefix}:${key}` : key;
  }

  protected handleError(error: Error, operation: string): void {
    this.options.onError(error, operation);
  }

  /**
   * 获取并反序列化数据
   */
  async getData<T>(key: string): Promise<T | null> {
    try {
      const value = await this.getItem(key);
      if (value === null) return null;

      if (this.options.serialize) {
        return JSON.parse(value) as T;
      }
      return value as unknown as T;
    } catch (error) {
      this.handleError(error as Error, 'getData');
      return null;
    }
  }

  /**
   * 序列化并存储数据
   */
  async setData<T>(key: string, value: T): Promise<void> {
    try {
      const serializedValue = this.options.serialize 
        ? JSON.stringify(value)
        : String(value);
      
      await this.setItem(key, serializedValue);
    } catch (error) {
      this.handleError(error as Error, 'setData');
      throw error;
    }
  }
}

/**
 * Web存储适配器 (localStorage/sessionStorage)
 */
export class WebStorageAdapter extends BaseStorageAdapter {
  private storage: Storage;

  constructor(
    storageType: 'localStorage' | 'sessionStorage' = 'localStorage',
    options: StorageOptions = {}
  ) {
    super(options);
    
    if (typeof window === 'undefined') {
      throw new Error('WebStorageAdapter can only be used in browser environment');
    }
    
    this.storage = window[storageType];
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return this.storage.getItem(this.getFullKey(key));
    } catch (error) {
      this.handleError(error as Error, 'getItem');
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      this.storage.setItem(this.getFullKey(key), value);
    } catch (error) {
      this.handleError(error as Error, 'setItem');
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      this.storage.removeItem(this.getFullKey(key));
    } catch (error) {
      this.handleError(error as Error, 'removeItem');
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      if (this.options.prefix) {
        // 只清除带前缀的key
        const keysToRemove: string[] = [];
        for (let i = 0; i < this.storage.length; i++) {
          const key = this.storage.key(i);
          if (key?.startsWith(`${this.options.prefix}:`)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => this.storage.removeItem(key));
      } else {
        this.storage.clear();
      }
    } catch (error) {
      this.handleError(error as Error, 'clear');
      throw error;
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      const keys: string[] = [];
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key) {
          if (this.options.prefix) {
            if (key.startsWith(`${this.options.prefix}:`)) {
              keys.push(key.replace(`${this.options.prefix}:`, ''));
            }
          } else {
            keys.push(key);
          }
        }
      }
      return keys;
    } catch (error) {
      this.handleError(error as Error, 'getAllKeys');
      return [];
    }
  }
}

/**
 * React Native AsyncStorage适配器
 */
export class AsyncStorageAdapter extends BaseStorageAdapter {
  private AsyncStorage: any;

  constructor(AsyncStorage: any, options: StorageOptions = {}) {
    super(options);
    this.AsyncStorage = AsyncStorage;
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return await this.AsyncStorage.getItem(this.getFullKey(key));
    } catch (error) {
      this.handleError(error as Error, 'getItem');
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await this.AsyncStorage.setItem(this.getFullKey(key), value);
    } catch (error) {
      this.handleError(error as Error, 'setItem');
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await this.AsyncStorage.removeItem(this.getFullKey(key));
    } catch (error) {
      this.handleError(error as Error, 'removeItem');
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      if (this.options.prefix) {
        const keys = await this.getAllKeys();
        const fullKeys = keys.map(key => this.getFullKey(key));
        await this.AsyncStorage.multiRemove(fullKeys);
      } else {
        await this.AsyncStorage.clear();
      }
    } catch (error) {
      this.handleError(error as Error, 'clear');
      throw error;
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      const allKeys = await this.AsyncStorage.getAllKeys();
      if (this.options.prefix) {
        return allKeys
          .filter((key: string) => key.startsWith(`${this.options.prefix}:`))
          .map((key: string) => key.replace(`${this.options.prefix}:`, ''));
      }
      return allKeys;
    } catch (error) {
      this.handleError(error as Error, 'getAllKeys');
      return [];
    }
  }
}

/**
 * 内存存储适配器 (用于测试或无持久化需求)
 */
export class MemoryStorageAdapter extends BaseStorageAdapter {
  private store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(this.getFullKey(key)) || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(this.getFullKey(key), value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(this.getFullKey(key));
  }

  async clear(): Promise<void> {
    if (this.options.prefix) {
      const keysToDelete = Array.from(this.store.keys())
        .filter(key => key.startsWith(`${this.options.prefix}:`));
      keysToDelete.forEach(key => this.store.delete(key));
    } else {
      this.store.clear();
    }
  }

  async getAllKeys(): Promise<string[]> {
    const keys = Array.from(this.store.keys());
    if (this.options.prefix) {
      return keys
        .filter(key => key.startsWith(`${this.options.prefix}:`))
        .map(key => key.replace(`${this.options.prefix}:`, ''));
    }
    return keys;
  }
}

/**
 * 存储适配器工厂
 */
export class StorageAdapterFactory {
  /**
   * 创建Web存储适配器
   */
  static createWebStorage(
    type: 'localStorage' | 'sessionStorage' = 'localStorage',
    options: StorageOptions = {}
  ): WebStorageAdapter {
    return new WebStorageAdapter(type, options);
  }

  /**
   * 创建React Native AsyncStorage适配器
   */
  static createAsyncStorage(
    AsyncStorage: any,
    options: StorageOptions = {}
  ): AsyncStorageAdapter {
    return new AsyncStorageAdapter(AsyncStorage, options);
  }

  /**
   * 创建内存存储适配器
   */
  static createMemoryStorage(options: StorageOptions = {}): MemoryStorageAdapter {
    return new MemoryStorageAdapter(options);
  }

  /**
   * 自动检测并创建适配器
   */
  static createAutoDetect(
    AsyncStorage?: any,
    options: StorageOptions = {}
  ): IStorageAdapter {
    // 优先使用localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      return new WebStorageAdapter('localStorage', options);
    }
    
    // 其次使用AsyncStorage
    if (AsyncStorage) {
      return new AsyncStorageAdapter(AsyncStorage, options);
    }
    
    // 降级到内存存储
    console.warn('[StorageAdapter] 使用内存存储，数据不会持久化');
    return new MemoryStorageAdapter(options);
  }
}

// 默认导出工厂类
export default StorageAdapterFactory;