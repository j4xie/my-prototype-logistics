/**
 * 基础Store抽象类
 * 提供通用的状态管理功能
 */

import { StoreApi, UseBoundStore } from 'zustand';
import { IStorageAdapter } from '../utils/storage-adapter';
import { logger } from '../utils/logger';

/**
 * 基础状态接口
 */
export interface BaseState {
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

/**
 * 基础操作接口
 */
export interface BaseActions {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  updateTimestamp: () => void;
  reset: () => void;
}

/**
 * Store配置选项
 */
export interface StoreConfig {
  name: string;
  version?: number;
  storage?: IStorageAdapter;
  persist?: boolean;
  debug?: boolean;
  middleware?: any[];
}

/**
 * 持久化选项
 */
export interface PersistOptions {
  name: string;
  storage: IStorageAdapter;
  partialize?: (state: any) => any;
  onRehydrateStorage?: () => (state?: any, error?: Error) => void;
  version?: number;
  migrate?: (persistedState: any, version: number) => any;
  merge?: (persistedState: any, currentState: any) => any;
  skipHydration?: boolean;
}

/**
 * 基础Store类
 */
export abstract class BaseStore<T extends BaseState = BaseState> {
  protected config: StoreConfig;
  protected initialState: T;
  protected store?: UseBoundStore<StoreApi<T>>;

  constructor(config: StoreConfig, initialState: T) {
    this.config = config;
    this.initialState = {
      ...initialState,
      loading: false,
      error: null,
      lastUpdated: null,
    };

    if (this.config.debug) {
      logger.info(`Initializing store: ${this.config.name}`, 'BaseStore');
    }
  }

  /**
   * 获取初始状态
   */
  protected getInitialState(): T {
    return { ...this.initialState };
  }

  /**
   * 创建基础actions
   */
  protected createBaseActions(set: any, get: any): BaseActions {
    return {
      setLoading: (loading: boolean) => {
        if (this.config.debug) {
          logger.debug(`Setting loading: ${loading}`, this.config.name);
        }
        set({ loading }, false, `${this.config.name}/setLoading`);
      },

      setError: (error: string | null) => {
        if (this.config.debug) {
          logger.debug(`Setting error: ${error}`, this.config.name);
        }
        set({ error }, false, `${this.config.name}/setError`);
      },

      clearError: () => {
        if (this.config.debug) {
          logger.debug('Clearing error', this.config.name);
        }
        set({ error: null }, false, `${this.config.name}/clearError`);
      },

      updateTimestamp: () => {
        const timestamp = new Date().toISOString();
        if (this.config.debug) {
          logger.debug(`Updating timestamp: ${timestamp}`, this.config.name);
        }
        set({ lastUpdated: timestamp }, false, `${this.config.name}/updateTimestamp`);
      },

      reset: () => {
        if (this.config.debug) {
          logger.debug('Resetting store', this.config.name);
        }
        set(this.getInitialState(), false, `${this.config.name}/reset`);
      },
    };
  }

  /**
   * 创建持久化中间件
   */
  protected createPersistMiddleware(options: PersistOptions) {
    return (config: any) => (set: any, get: any, api: any) => {
      const persistedState = this.loadPersistedState(options);
      const initialState = persistedState || this.getInitialState();

      const stateCreator = config(
        (partial: any, replace?: boolean, action?: string) => {
          set(partial, replace, action);
          this.savePersistedState(get(), options);
        },
        get,
        api
      );

      // 合并持久化状态
      if (persistedState && options.merge) {
        const mergedState = options.merge(persistedState, stateCreator);
        Object.assign(stateCreator, mergedState);
      } else if (persistedState) {
        Object.assign(stateCreator, persistedState);
      }

      return stateCreator;
    };
  }

  /**
   * 加载持久化状态
   */
  private loadPersistedState(options: PersistOptions): any {
    try {
      if (!options.storage) return null;

      const stored = options.storage.getData(options.name);
      if (!stored) return null;

      // 版本迁移
      if (options.version && options.migrate && stored.version !== options.version) {
        const migrated = options.migrate(stored.state, stored.version || 0);
        return migrated;
      }

      return stored.state;
    } catch (error) {
      logger.error('Failed to load persisted state', this.config.name, error);
      return null;
    }
  }

  /**
   * 保存持久化状态
   */
  private async savePersistedState(state: any, options: PersistOptions): Promise<void> {
    try {
      if (!options.storage) return;

      const stateToSave = options.partialize ? options.partialize(state) : state;
      const dataToStore = {
        state: stateToSave,
        version: options.version || 1,
        timestamp: Date.now(),
      };

      await options.storage.setData(options.name, dataToStore);
    } catch (error) {
      logger.error('Failed to save persisted state', this.config.name, error);
    }
  }

  /**
   * 创建开发工具中间件
   */
  protected createDevtoolsMiddleware() {
    return (config: any) => (set: any, get: any, api: any) => {
      const stateCreator = config(
        (partial: any, replace?: boolean, action?: string) => {
          if (this.config.debug && action) {
            logger.debug(`Action dispatched: ${action}`, this.config.name, {
              state: get(),
              partial,
              replace,
            });
          }
          set(partial, replace, action);
        },
        get,
        api
      );

      return stateCreator;
    };
  }

  /**
   * 处理异步操作
   */
  protected async handleAsyncOperation<R>(
    operation: () => Promise<R>,
    options: {
      loadingKey?: string;
      errorKey?: string;
      successCallback?: (result: R) => void;
      errorCallback?: (error: Error) => void;
      context?: string;
    } = {}
  ): Promise<R | null> {
    const { loadingKey = 'loading', errorKey = 'error', successCallback, errorCallback, context } = options;

    try {
      // 设置加载状态
      this.store?.getState().setLoading?.(true);

      // 清除之前的错误
      this.store?.getState().clearError?.();

      // 执行异步操作
      const result = await operation();

      // 成功回调
      if (successCallback) {
        successCallback(result);
      }

      // 更新时间戳
      this.store?.getState().updateTimestamp?.();

      if (this.config.debug) {
        logger.info(`Async operation completed successfully`, context || this.config.name);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 设置错误状态
      this.store?.getState().setError?.(errorMessage);

      // 错误回调
      if (errorCallback) {
        errorCallback(error as Error);
      }

      logger.error('Async operation failed', context || this.config.name, error);

      return null;
    } finally {
      // 清除加载状态
      this.store?.getState().setLoading?.(false);
    }
  }

  /**
   * 批量更新状态
   */
  protected batchUpdate(updates: Partial<T>, action?: string): void {
    if (!this.store) return;

    const actionName = action || `${this.config.name}/batchUpdate`;
    
    if (this.config.debug) {
      logger.debug(`Batch update: ${actionName}`, this.config.name, updates);
    }

    // 使用函数式更新确保状态一致性
    this.store.setState((state) => ({ ...state, ...updates }), false, actionName);
  }

  /**
   * 获取当前状态
   */
  getCurrentState(): T | undefined {
    return this.store?.getState();
  }

  /**
   * 订阅状态变化
   */
  subscribe(callback: (state: T) => void): () => void {
    if (!this.store) {
      throw new Error('Store not initialized');
    }

    return this.store.subscribe(callback);
  }

  /**
   * 销毁Store
   */
  destroy(): void {
    if (this.config.debug) {
      logger.info(`Destroying store: ${this.config.name}`, 'BaseStore');
    }

    this.store?.destroy?.();
    this.store = undefined;
  }

  /**
   * 获取Store实例
   */
  abstract getStore(): UseBoundStore<StoreApi<T>>;
}

/**
 * 创建状态选择器
 */
export function createSelector<T, R>(
  selector: (state: T) => R,
  equalityFn?: (a: R, b: R) => boolean
): (state: T) => R {
  let lastResult: R;
  let hasResult = false;

  return (state: T): R => {
    const result = selector(state);

    if (!hasResult) {
      lastResult = result;
      hasResult = true;
      return result;
    }

    if (equalityFn) {
      if (equalityFn(lastResult, result)) {
        return lastResult;
      }
    } else {
      if (lastResult === result) {
        return lastResult;
      }
    }

    lastResult = result;
    return result;
  };
}

/**
 * 浅比较函数
 */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  const keysA = Object.keys(a as any);
  const keysB = Object.keys(b as any);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!(key in (b as any)) || (a as any)[key] !== (b as any)[key]) {
      return false;
    }
  }

  return true;
}

/**
 * 深比较函数
 */
export function deepEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  const keysA = Object.keys(a as any);
  const keysB = Object.keys(b as any);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!(key in (b as any))) return false;
    if (!deepEqual((a as any)[key], (b as any)[key])) return false;
  }

  return true;
}

/**
 * 防抖状态更新
 */
export function createDebouncedSetter<T>(
  setter: (value: T) => void,
  delay: number = 300
): (value: T) => void {
  let timeoutId: NodeJS.Timeout;

  return (value: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => setter(value), delay);
  };
}

/**
 * 节流状态更新
 */
export function createThrottledSetter<T>(
  setter: (value: T) => void,
  delay: number = 100
): (value: T) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout;

  return (value: T) => {
    const now = Date.now();
    
    if (now - lastCall >= delay) {
      setter(value);
      lastCall = now;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setter(value);
        lastCall = Date.now();
      }, delay - (now - lastCall));
    }
  };
}