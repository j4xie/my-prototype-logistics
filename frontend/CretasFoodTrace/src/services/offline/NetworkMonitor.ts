/**
 * 网络状态监控服务
 *
 * 监听网络状态变化，支持在线/离线检测
 * 使用 @react-native-community/netinfo
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */

import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import type { NetworkState, NetworkStateListener, NetworkStatus } from './types';

// ==================== NetworkMonitor 类 ====================

class NetworkMonitor {
  private listeners: Set<NetworkStateListener> = new Set();
  private unsubscribe: NetInfoSubscription | null = null;
  private currentState: NetworkState | null = null;
  private isInitialized = false;

  // ==================== 初始化 ====================

  /**
   * 初始化网络监控
   * 开始监听网络状态变化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 获取初始状态
      const initialState = await NetInfo.fetch();
      this.currentState = this.mapNetInfoState(initialState);

      // 订阅状态变化
      this.unsubscribe = NetInfo.addEventListener((state) => {
        const newState = this.mapNetInfoState(state);
        this.handleStateChange(newState);
      });

      this.isInitialized = true;
      console.log('[NetworkMonitor] Initialized with status:', this.currentState.status);
    } catch (error) {
      console.error('[NetworkMonitor] Failed to initialize:', error);
      // 降级处理：假设在线
      this.currentState = {
        status: 'online',
        isConnected: true,
        lastChecked: new Date().toISOString(),
      };
      this.isInitialized = true;
    }
  }

  /**
   * 销毁监控器
   * 取消所有监听
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.listeners.clear();
    this.isInitialized = false;
    console.log('[NetworkMonitor] Destroyed');
  }

  // ==================== 状态查询 ====================

  /**
   * 检查是否在线
   *
   * @returns 是否在线
   */
  async isOnline(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.currentState?.isConnected ?? false;
  }

  /**
   * 获取当前网络状态
   *
   * @returns 网络状态
   */
  async getState(): Promise<NetworkState> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.currentState) {
      // 如果状态未初始化，重新获取
      const state = await NetInfo.fetch();
      this.currentState = this.mapNetInfoState(state);
    }

    return this.currentState;
  }

  /**
   * 强制刷新网络状态
   *
   * @returns 最新的网络状态
   */
  async refresh(): Promise<NetworkState> {
    try {
      const state = await NetInfo.refresh();
      this.currentState = this.mapNetInfoState(state);
      return this.currentState;
    } catch (error) {
      console.error('[NetworkMonitor] Failed to refresh:', error);
      throw error;
    }
  }

  // ==================== 监听器管理 ====================

  /**
   * 订阅网络状态变化
   *
   * @param listener 监听器回调
   * @returns 取消订阅函数
   */
  subscribe(listener: NetworkStateListener): () => void {
    this.listeners.add(listener);

    // 立即触发一次，让监听器知道当前状态
    if (this.currentState) {
      listener(this.currentState);
    }

    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 取消订阅
   *
   * @param listener 监听器回调
   */
  unsubscribeListener(listener: NetworkStateListener): void {
    this.listeners.delete(listener);
  }

  /**
   * 清除所有监听器
   */
  clearListeners(): void {
    this.listeners.clear();
  }

  // ==================== 内部方法 ====================

  /**
   * 映射 NetInfo 状态到自定义 NetworkState
   */
  private mapNetInfoState(state: NetInfoState): NetworkState {
    const isConnected = state.isConnected ?? false;
    const isInternetReachable = state.isInternetReachable ?? undefined;

    let status: NetworkStatus;
    if (isConnected && isInternetReachable !== false) {
      status = 'online';
    } else if (!isConnected) {
      status = 'offline';
    } else {
      status = 'unknown';
    }

    return {
      status,
      type: state.type,
      isConnected,
      isInternetReachable,
      isExpensive: state.details?.isConnectionExpensive,
      lastChecked: new Date().toISOString(),
    };
  }

  /**
   * 处理状态变化
   */
  private handleStateChange(newState: NetworkState): void {
    const prevState = this.currentState;

    // 如果状态没有变化，不触发监听器
    if (
      prevState &&
      prevState.status === newState.status &&
      prevState.type === newState.type
    ) {
      return;
    }

    this.currentState = newState;

    console.log(
      `[NetworkMonitor] State changed: ${prevState?.status || 'unknown'} -> ${newState.status}`
    );

    // 通知所有监听器
    this.notifyListeners(newState);
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(state: NetworkState): void {
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (error) {
        console.error('[NetworkMonitor] Listener error:', error);
      }
    }
  }

  // ==================== 便捷方法 ====================

  /**
   * 检查是否为WiFi连接
   *
   * @returns 是否为WiFi
   */
  async isWiFi(): Promise<boolean> {
    const state = await this.getState();
    return state.type === 'wifi';
  }

  /**
   * 检查是否为蜂窝网络
   *
   * @returns 是否为蜂窝网络
   */
  async isCellular(): Promise<boolean> {
    const state = await this.getState();
    return state.type === 'cellular';
  }

  /**
   * 检查是否为昂贵连接 (如漫游)
   *
   * @returns 是否为昂贵连接
   */
  async isExpensive(): Promise<boolean> {
    const state = await this.getState();
    return state.isExpensive ?? false;
  }

  /**
   * 等待网络恢复
   * 返回 Promise，在网络恢复时 resolve
   *
   * @param timeout 超时时间 (毫秒)，默认 30 秒
   * @returns 是否在超时前恢复
   */
  async waitForOnline(timeout = 30000): Promise<boolean> {
    const isCurrentlyOnline = await this.isOnline();

    if (isCurrentlyOnline) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const timeoutId = setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, timeout);

      const unsubscribe = this.subscribe((state) => {
        if (state.isConnected) {
          clearTimeout(timeoutId);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }
}

// ==================== 导出单例 ====================

export const networkMonitor = new NetworkMonitor();
export default networkMonitor;
