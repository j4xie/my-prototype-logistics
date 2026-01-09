/**
 * WebSocket 服务 - 设备实时监控
 *
 * 连接后端 WebSocket 端点 /ws/equipment-monitoring
 * 支持工厂订阅、设备状态更新、告警推送
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */

import { API_BASE_URL } from '../constants/config';
import { logger } from '../utils/logger';
import { useAuthStore } from '../store/authStore';

const wsLogger = logger.createContextLogger('WebSocket');

// ==========================================
// 类型定义
// ==========================================

export type WebSocketState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface EquipmentUpdateData {
  equipmentId: string;
  factoryId: string;
  status: string;
  lastHeartbeat?: string;
  metrics?: Record<string, unknown>;
}

export interface EquipmentAlertData {
  alertId?: number;
  equipmentId: string;
  factoryId: string;
  alertType: string;
  alertMessage: string;
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  timestamp: string;
}

export interface SubscribedData {
  factoryId: string;
  message: string;
}

export interface WebSocketMessage {
  type: string;
  data?: unknown;
  factoryId?: string;
  timestamp?: string;
}

type EventListener<T = unknown> = (data: T) => void;

export type WebSocketEventType =
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'subscribed'
  | 'unsubscribed'
  | 'equipmentUpdate'
  | 'equipmentAlert'
  | 'heartbeat'
  | 'error';

// ==========================================
// WebSocket 服务实现
// ==========================================

class WebSocketServiceImpl {
  private socket: WebSocket | null = null;
  private state: WebSocketState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // 初始重连延迟 1s
  private maxReconnectDelay = 30000; // 最大重连延迟 30s
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private subscribedFactoryId: string | null = null;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private pendingSubscription: string | null = null;

  /**
   * 连接 WebSocket 服务器
   */
  async connect(): Promise<boolean> {
    if (this.state === 'connected' || this.state === 'connecting') {
      wsLogger.debug('WebSocket 已连接或正在连接');
      return this.state === 'connected';
    }

    this.setState('connecting');

    return new Promise((resolve) => {
      try {
        const wsUrl = this.buildWebSocketUrl();
        wsLogger.info('连接 WebSocket', { url: wsUrl });

        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          wsLogger.info('WebSocket 连接成功');
          this.setState('connected');
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.startHeartbeat();
          this.emit('connected', {});

          // 处理待处理的订阅
          if (this.pendingSubscription) {
            this.subscribeToFactory(this.pendingSubscription);
            this.pendingSubscription = null;
          }

          resolve(true);
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.socket.onclose = (event) => {
          wsLogger.warn('WebSocket 连接关闭', { code: event.code, reason: event.reason });
          this.cleanup();
          this.emit('disconnected', { code: event.code, reason: event.reason });

          // 非正常关闭时尝试重连
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }

          resolve(false);
        };

        this.socket.onerror = (error) => {
          wsLogger.error('WebSocket 错误', error);
          this.emit('error', { message: 'WebSocket 连接错误' });
        };

      } catch (error) {
        wsLogger.error('WebSocket 连接失败', error);
        this.setState('disconnected');
        resolve(false);
      }
    });
  }

  /**
   * 断开 WebSocket 连接
   */
  disconnect(): void {
    wsLogger.info('主动断开 WebSocket');
    this.cleanup();
    if (this.socket) {
      this.socket.close(1000, '客户端主动断开');
      this.socket = null;
    }
    this.setState('disconnected');
    this.subscribedFactoryId = null;
  }

  /**
   * 订阅工厂设备更新
   */
  subscribeToFactory(factoryId: string): boolean {
    if (!factoryId) {
      wsLogger.warn('订阅失败: factoryId 为空');
      return false;
    }

    if (this.state !== 'connected') {
      wsLogger.debug('WebSocket 未连接，保存待处理订阅', { factoryId });
      this.pendingSubscription = factoryId;
      this.connect();
      return false;
    }

    wsLogger.info('订阅工厂设备更新', { factoryId });
    const success = this.sendMessage({
      type: 'subscribe',
      factoryId,
    });

    if (success) {
      this.subscribedFactoryId = factoryId;
    }

    return success;
  }

  /**
   * 取消订阅
   */
  unsubscribe(): boolean {
    if (this.state !== 'connected') {
      return false;
    }

    wsLogger.info('取消订阅');
    const success = this.sendMessage({ type: 'unsubscribe' });

    if (success) {
      this.subscribedFactoryId = null;
      this.emit('unsubscribed', {});
    }

    return success;
  }

  /**
   * 获取当前连接状态
   */
  getState(): WebSocketState {
    return this.state;
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * 获取已订阅的工厂ID
   */
  getSubscribedFactoryId(): string | null {
    return this.subscribedFactoryId;
  }

  /**
   * 注册事件监听器
   */
  on<T>(event: WebSocketEventType, listener: EventListener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as EventListener);

    // 返回取消订阅函数
    return () => {
      this.listeners.get(event)?.delete(listener as EventListener);
    };
  }

  /**
   * 移除事件监听器
   */
  off(event: WebSocketEventType, listener: EventListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  /**
   * 移除所有监听器
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  // ==========================================
  // 私有方法
  // ==========================================

  private buildWebSocketUrl(): string {
    // 将 http:// 转换为 ws://，将 https:// 转换为 wss://
    const baseUrl = API_BASE_URL.replace(/^http/, 'ws');
    return `${baseUrl}/ws/equipment-monitoring`;
  }

  private setState(state: WebSocketState): void {
    if (this.state !== state) {
      wsLogger.debug('WebSocket 状态变更', { from: this.state, to: state });
      this.state = state;
    }
  }

  private sendMessage(message: WebSocketMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      wsLogger.warn('WebSocket 未连接，无法发送消息');
      return false;
    }

    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      wsLogger.error('发送消息失败', error);
      return false;
    }
  }

  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      wsLogger.debug('收到消息', { type: message.type });

      switch (message.type) {
        case 'heartbeat':
        case 'pong':
          this.resetHeartbeatTimeout();
          this.emit('heartbeat', {});
          break;

        case 'subscribed':
          wsLogger.info('订阅成功', message.data);
          this.emit('subscribed', message.data as SubscribedData);
          break;

        case 'equipment_update':
          this.emit('equipmentUpdate', message.data as EquipmentUpdateData);
          break;

        case 'equipment_alert':
          wsLogger.warn('收到设备告警', message.data);
          this.emit('equipmentAlert', message.data as EquipmentAlertData);
          break;

        case 'error':
          wsLogger.error('服务器返回错误', message.data);
          this.emit('error', message.data);
          break;

        default:
          wsLogger.debug('未知消息类型', { type: message.type, data: message.data });
      }
    } catch (error) {
      wsLogger.error('解析消息失败', error, { rawData: data });
    }
  }

  private emit<T>(event: WebSocketEventType, data: T): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          wsLogger.error('事件监听器执行失败', error, { event });
        }
      });
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    // 每 25 秒发送一次心跳（与后端保持一致）
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.sendMessage({ type: 'ping' });
        this.setHeartbeatTimeout();
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.clearHeartbeatTimeout();
  }

  private setHeartbeatTimeout(): void {
    this.clearHeartbeatTimeout();

    // 60 秒没有收到心跳响应则认为连接断开
    this.heartbeatTimeout = setTimeout(() => {
      wsLogger.warn('心跳超时，重新连接');
      this.disconnect();
      this.scheduleReconnect();
    }, 60000);
  }

  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private resetHeartbeatTimeout(): void {
    this.clearHeartbeatTimeout();
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      wsLogger.error('达到最大重连次数，停止重连');
      this.emit('error', { message: '连接失败，请检查网络后重试' });
      return;
    }

    this.setState('reconnecting');
    this.reconnectAttempts++;

    // 指数退避算法
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    wsLogger.info('计划重连', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay
    });

    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts
    });

    setTimeout(() => {
      if (this.state === 'reconnecting') {
        this.connect();
      }
    }, delay);
  }

  private cleanup(): void {
    this.stopHeartbeat();
  }
}

// ==========================================
// 导出单例服务
// ==========================================

export const webSocketService = new WebSocketServiceImpl();

// ==========================================
// React Hook
// ==========================================

/**
 * WebSocket Hook - 用于 React 组件
 *
 * @example
 * ```tsx
 * const { state, isConnected, subscribe } = useWebSocket();
 *
 * useEffect(() => {
 *   const unsubscribe = webSocketService.on('equipmentAlert', (data) => {
 *     console.log('收到告警:', data);
 *   });
 *   return unsubscribe;
 * }, []);
 * ```
 */
export function useWebSocket() {
  const factoryId = useAuthStore((state) => state.getFactoryId());
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return {
    state: webSocketService.getState(),
    isConnected: webSocketService.isConnected(),
    subscribedFactoryId: webSocketService.getSubscribedFactoryId(),

    connect: () => webSocketService.connect(),
    disconnect: () => webSocketService.disconnect(),
    subscribe: (fId?: string) => webSocketService.subscribeToFactory(fId || factoryId || ''),
    unsubscribe: () => webSocketService.unsubscribe(),
    on: webSocketService.on.bind(webSocketService),
    off: webSocketService.off.bind(webSocketService),

    // 便捷方法
    autoConnect: async () => {
      if (isAuthenticated && factoryId) {
        const connected = await webSocketService.connect();
        if (connected) {
          webSocketService.subscribeToFactory(factoryId);
        }
        return connected;
      }
      return false;
    },
  };
}
