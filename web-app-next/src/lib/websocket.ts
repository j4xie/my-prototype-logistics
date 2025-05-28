import { io, Socket } from 'socket.io-client';

export interface WebSocketConfig {
  url: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  timeout?: number;
}

export interface MessageHandler {
  [event: string]: (data: any) => void;
}

class WebSocketManager {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private messageHandlers: MessageHandler = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: WebSocketConfig) {
    this.config = {
      autoConnect: true,
      reconnection: true,
      timeout: 5000,
      ...config,
    };
  }

  /**
   * 建立WebSocket连接
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(this.config.url, {
        autoConnect: this.config.autoConnect,
        timeout: this.config.timeout,
        reconnection: this.config.reconnection,
      });

      // 连接成功
      this.socket.on('connect', () => {
        console.log('✅ WebSocket 连接成功');
        this.reconnectAttempts = 0;
        resolve();
      });

      // 连接失败
      this.socket.on('connect_error', (error) => {
        console.error('❌ WebSocket 连接失败:', error);
        this.handleReconnect();
        reject(error);
      });

      // 断开连接
      this.socket.on('disconnect', (reason) => {
        console.warn('⚠️ WebSocket 连接断开:', reason);
        if (reason === 'io server disconnect') {
          // 服务器主动断开，需要重新连接
          this.handleReconnect();
        }
      });

      // 注册消息处理器
      this.registerMessageHandlers();
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * 发送消息
   */
  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket 未连接，消息发送失败');
    }
  }

  /**
   * 监听消息
   */
  on(event: string, handler: (data: any) => void): void {
    this.messageHandlers[event] = handler;
    if (this.socket) {
      this.socket.on(event, handler);
    }
  }

  /**
   * 移除监听器
   */
  off(event: string): void {
    delete this.messageHandlers[event];
    if (this.socket) {
      this.socket.off(event);
    }
  }

  /**
   * 处理重连逻辑
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`🔄 尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})，${delay}ms 后重试`);
      
      setTimeout(() => {
        this.connect().catch(() => {
          console.error(`重连失败 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        });
      }, delay);
    } else {
      console.error('❌ WebSocket 重连次数超限，停止重连');
    }
  }

  /**
   * 注册消息处理器
   */
  private registerMessageHandlers(): void {
    if (!this.socket) return;

    Object.entries(this.messageHandlers).forEach(([event, handler]) => {
      this.socket!.on(event, handler);
    });
  }

  /**
   * 获取连接状态
   */
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// 创建全局WebSocket实例
let wsManager: WebSocketManager;

export const initWebSocket = (config: WebSocketConfig): WebSocketManager => {
  if (!wsManager) {
    wsManager = new WebSocketManager(config);
  }
  return wsManager;
};

export const getWebSocket = (): WebSocketManager => {
  if (!wsManager) {
    throw new Error('WebSocket 未初始化，请先调用 initWebSocket()');
  }
  return wsManager;
};

export default WebSocketManager; 