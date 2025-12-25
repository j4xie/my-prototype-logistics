import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { handleError } from '../utils/errorHandler';

export interface NetworkState {
  isConnected: boolean;
  type: NetInfoStateType;
  isInternetReachable: boolean | null;
  strength: number | null;
  carrier: string | null;
  details: any;
}

export interface NetworkRetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  timeout: number;
}

export class NetworkManager {
  private static listeners: Set<(state: NetworkState) => void> = new Set();
  private static currentState: NetworkState | null = null;
  private static unsubscribe: (() => void) | null = null;
  private static initialized = false;

  // 默认重试选项
  private static defaultRetryOptions: NetworkRetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    timeout: 30000,
  };

  /**
   * 初始化网络监听器
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 获取初始网络状态
      const initialState = await NetInfo.fetch();
      this.currentState = this.transformNetInfoState(initialState);

      // 订阅网络状态变化
      this.unsubscribe = NetInfo.addEventListener((state) => {
        const networkState = this.transformNetInfoState(state);
        const wasConnected = this.currentState?.isConnected;
        const isConnected = networkState.isConnected;

        this.currentState = networkState;

        // 通知所有监听器
        this.listeners.forEach(listener => {
          try {
            listener(networkState);
          } catch (error) {
            console.error('Error in network listener:', error);
          }
        });

        // 网络状态变化日志
        if (wasConnected !== isConnected) {
          if (isConnected) {
            console.log('🟢 Network connected:', networkState.type);
          } else {
            console.log('🔴 Network disconnected');
          }
        }
      });

      this.initialized = true;
      console.log('✅ Network manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize network manager:', error);
      throw error;
    }
  }

  /**
   * 清理网络监听器
   */
  static cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.listeners.clear();
    this.initialized = false;
    console.log('🧹 Network manager cleaned up');
  }

  /**
   * 检查网络是否连接
   */
  static async isConnected(): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (this.currentState) {
        return this.currentState.isConnected;
      }

      // 如果没有缓存状态，直接检查
      const state = await NetInfo.fetch();
      return state.isConnected === true;
    } catch (error) {
      console.error('Error checking network connection:', error);
      return false;
    }
  }

  /**
   * 检查网络是否可达互联网
   */
  static async isInternetReachable(): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (this.currentState) {
        return this.currentState.isInternetReachable === true;
      }

      const state = await NetInfo.fetch();
      return state.isInternetReachable === true;
    } catch (error) {
      console.error('Error checking internet reachability:', error);
      return false;
    }
  }

  /**
   * 获取当前网络状态
   */
  static async getCurrentState(): Promise<NetworkState> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (this.currentState) {
        return this.currentState;
      }

      const state = await NetInfo.fetch();
      return this.transformNetInfoState(state);
    } catch (error) {
      console.error('Error getting current network state:', error);
      return {
        isConnected: false,
        type: NetInfoStateType.none,
        isInternetReachable: false,
        strength: null,
        carrier: null,
        details: null,
      };
    }
  }

  /**
   * 添加网络状态监听器
   */
  static addListener(listener: (state: NetworkState) => void): () => void {
    if (!this.initialized) {
      this.initialize().catch(console.error);
    }

    this.listeners.add(listener);

    // 立即发送当前状态
    if (this.currentState) {
      try {
        listener(this.currentState);
      } catch (error) {
        console.error('Error in network listener:', error);
      }
    }

    // 返回取消监听的函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 等待网络连接
   */
  static async waitForConnection(timeout: number = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(false);
      }, timeout);

      const checkConnection = async () => {
        const isConnected = await this.isConnected();
        if (isConnected) {
          clearTimeout(timeoutId);
          resolve(true);
        }
      };

      // 立即检查一次
      checkConnection();

      // 监听网络状态变化
      const unsubscribe = this.addListener((state) => {
        if (state.isConnected) {
          clearTimeout(timeoutId);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }

  /**
   * 带重试的网络请求执行器
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<NetworkRetryOptions> = {}
  ): Promise<T> {
    const opts = { ...this.defaultRetryOptions, ...options };
    let lastError: any;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        // 检查网络连接
        const isConnected = await this.isConnected();
        if (!isConnected) {
          // 等待网络连接，但不超过重试延迟时间
          const delay = this.calculateDelay(attempt, opts);
          const connected = await this.waitForConnection(Math.min(delay, 5000));
          if (!connected) {
            throw new Error('Network not available');
          }
        }

        // 执行操作
        const result = await Promise.race([
          operation(),
          this.createTimeoutPromise<T>(opts.timeout),
        ]);

        console.log(`✅ Network operation succeeded on attempt ${attempt + 1}`);
        return result as T;

      } catch (error) {
        lastError = error;
        
        if (attempt === opts.maxRetries) {
          break;
        }

        // 检查是否应该重试
        if (!this.shouldRetry(error)) {
          break;
        }

        const delay = this.calculateDelay(attempt, opts);
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`⚠️ Network operation failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, errorMessage);
        
        await this.delay(delay);
      }
    }

    console.error(`❌ Network operation failed after ${opts.maxRetries + 1} attempts:`, lastError);
    throw lastError;
  }

  /**
   * 网络诊断
   */
  static async diagnose(): Promise<{
    isConnected: boolean;
    isInternetReachable: boolean;
    networkType: NetInfoStateType;
    signalStrength: number | null;
    responseTime: number | null;
    error: string | null;
  }> {
    try {
      const startTime = Date.now();
      const state = await this.getCurrentState();
      
      let responseTime: number | null = null;
      let error: string | null = null;

      if (state.isConnected) {
        try {
          // 简单的网络延迟测试
          const testStart = Date.now();
          await fetch('https://www.baidu.com', {
            method: 'HEAD',
            cache: 'no-cache',
          });
          responseTime = Date.now() - testStart;
        } catch (fetchError: any) {
          error = fetchError.message;
          responseTime = Date.now() - startTime;
        }
      }

      return {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable === true,
        networkType: state.type,
        signalStrength: state.strength,
        responseTime,
        error,
      };
    } catch (error) {
      return {
        isConnected: false,
        isInternetReachable: false,
        networkType: NetInfoStateType.none,
        signalStrength: null,
        responseTime: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 转换NetInfo状态为内部状态
   */
  private static transformNetInfoState(state: NetInfoState): NetworkState {
    // state.details 的类型取决于 state.type
    const details = state.details as Record<string, any> | null;

    return {
      isConnected: state.isConnected === true,
      type: state.type,
      isInternetReachable: state.isInternetReachable,
      strength: details && 'strength' in details ? (details.strength as number | null) : null,
      carrier: details && 'cellularGeneration' in details ? (details.cellularGeneration as string | null) : null,
      details: state.details,
    };
  }

  /**
   * 计算重试延迟
   */
  private static calculateDelay(attempt: number, options: NetworkRetryOptions): number {
    const delay = options.baseDelay * Math.pow(options.backoffFactor, attempt);
    return Math.min(delay, options.maxDelay);
  }

  /**
   * 判断是否应该重试
   */
  private static shouldRetry(error: any): boolean {
    // 网络相关错误应该重试
    const networkErrors = [
      'Network request failed',
      'Network not available',
      'timeout',
      'ECONNABORTED',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return networkErrors.some(networkError => 
      errorMessage.includes(networkError.toLowerCase())
    );
  }

  /**
   * 延迟函数
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 创建超时Promise
   */
  private static createTimeoutPromise<T>(timeout: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), timeout);
    });
  }

  /**
   * 获取网络质量评估
   */
  static async getNetworkQuality(): Promise<'excellent' | 'good' | 'fair' | 'poor' | 'offline'> {
    try {
      const state = await this.getCurrentState();
      
      if (!state.isConnected) {
        return 'offline';
      }

      // 基于网络类型判断
      switch (state.type) {
        case NetInfoStateType.wifi:
          return state.strength && state.strength > 80 ? 'excellent' : 'good';
        case NetInfoStateType.cellular:
          if (state.carrier === '5g') return 'excellent';
          if (state.carrier === '4g') return 'good';
          if (state.carrier === '3g') return 'fair';
          return 'poor';
        case NetInfoStateType.ethernet:
          return 'excellent';
        default:
          return 'poor';
      }
    } catch (error) {
      console.error('Error assessing network quality:', error);
      return 'offline';
    }
  }

  /**
   * 网络性能监控
   */
  static startPerformanceMonitoring(interval: number = 30000): () => void {
    const monitoringInterval = setInterval(async () => {
      try {
        const diagnosis = await this.diagnose();
        console.log('📊 Network Performance:', {
          type: diagnosis.networkType,
          connected: diagnosis.isConnected,
          responseTime: diagnosis.responseTime,
          quality: await this.getNetworkQuality(),
        });
      } catch (error) {
        console.error('Error in network performance monitoring:', error);
      }
    }, interval);

    return () => {
      clearInterval(monitoringInterval);
      console.log('🛑 Network performance monitoring stopped');
    };
  }
}