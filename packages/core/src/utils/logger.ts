/**
 * 跨平台日志记录器
 * 支持Web和React Native环境
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
  data?: any;
  userId?: string;
  sessionId?: string;
}

export interface LoggerConfig {
  /** 最低日志级别 */
  minLevel: LogLevel;
  /** 是否启用日志 */
  enabled: boolean;
  /** 是否启用控制台输出 */
  enableConsole: boolean;
  /** 是否启用持久化存储 */
  enableStorage: boolean;
  /** 最大存储日志数量 */
  maxStoredLogs: number;
  /** 日志格式化器 */
  formatter?: (entry: LogEntry) => string;
  /** 自定义输出处理器 */
  handlers?: LogHandler[];
}

export interface LogHandler {
  name: string;
  handle: (entry: LogEntry) => void | Promise<void>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: 'info',
  enabled: true,
  enableConsole: true,
  enableStorage: false,
  maxStoredLogs: 1000,
};

/**
 * 跨平台日志记录器
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private storedLogs: LogEntry[] = [];
  private sessionId: string;

  private constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateSessionId();
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * 更新配置
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 设置用户ID（用于日志关联）
   */
  setUserId(userId: string): void {
    this.sessionId = userId;
  }

  /**
   * Debug级别日志
   */
  debug(message: string, context?: string, data?: any): void {
    this.log('debug', message, context, data);
  }

  /**
   * Info级别日志
   */
  info(message: string, context?: string, data?: any): void {
    this.log('info', message, context, data);
  }

  /**
   * Warning级别日志
   */
  warn(message: string, context?: string, data?: any): void {
    this.log('warn', message, context, data);
  }

  /**
   * Error级别日志
   */
  error(message: string, context?: string, data?: any): void {
    this.log('error', message, context, data);
  }

  /**
   * 记录错误对象
   */
  logError(error: Error, context?: string, additionalData?: any): void {
    this.log('error', error.message, context, {
      name: error.name,
      stack: error.stack,
      ...additionalData
    });
  }

  /**
   * 记录性能指标
   */
  logPerformance(
    operation: string, 
    duration: number, 
    context?: string, 
    additionalData?: any
  ): void {
    this.log('info', `Performance: ${operation} took ${duration}ms`, context, {
      operation,
      duration,
      ...additionalData
    });
  }

  /**
   * 记录用户行为
   */
  logUserAction(
    action: string,
    userId?: string,
    context?: string,
    data?: any
  ): void {
    this.log('info', `User Action: ${action}`, context, {
      action,
      userId: userId || this.sessionId,
      ...data
    });
  }

  /**
   * 核心日志记录方法
   */
  private log(level: LogLevel, message: string, context?: string, data?: any): void {
    if (!this.config.enabled) return;
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.minLevel]) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      data,
      sessionId: this.sessionId
    };

    // 控制台输出
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    // 存储日志
    if (this.config.enableStorage) {
      this.storeLog(entry);
    }

    // 自定义处理器
    if (this.config.handlers) {
      this.config.handlers.forEach(handler => {
        try {
          handler.handle(entry);
        } catch (error) {
          // 避免日志处理器错误影响主流程
          console.warn(`Log handler "${handler.name}" failed:`, error);
        }
      });
    }
  }

  /**
   * 输出到控制台
   */
  private outputToConsole(entry: LogEntry): void {
    const formatMessage = this.config.formatter 
      ? this.config.formatter(entry)
      : this.formatDefaultMessage(entry);

    switch (entry.level) {
      case 'debug':
        console.debug(formatMessage, entry.data);
        break;
      case 'info':
        console.info(formatMessage, entry.data);
        break;
      case 'warn':
        console.warn(formatMessage, entry.data);
        break;
      case 'error':
        console.error(formatMessage, entry.data);
        break;
    }
  }

  /**
   * 默认消息格式化
   */
  private formatDefaultMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const context = entry.context ? `[${entry.context}]` : '';
    return `${timestamp} ${level} ${context} ${entry.message}`;
  }

  /**
   * 存储日志到内存
   */
  private storeLog(entry: LogEntry): void {
    this.storedLogs.push(entry);
    
    // 保持最大存储数量限制
    if (this.storedLogs.length > this.config.maxStoredLogs) {
      this.storedLogs = this.storedLogs.slice(-this.config.maxStoredLogs);
    }
  }

  /**
   * 获取存储的日志
   */
  getStoredLogs(filter?: {
    level?: LogLevel;
    context?: string;
    since?: Date;
    limit?: number;
  }): LogEntry[] {
    let logs = [...this.storedLogs];

    if (filter) {
      if (filter.level) {
        logs = logs.filter(log => log.level === filter.level);
      }
      if (filter.context) {
        logs = logs.filter(log => log.context === filter.context);
      }
      if (filter.since) {
        logs = logs.filter(log => log.timestamp >= filter.since!);
      }
      if (filter.limit) {
        logs = logs.slice(-filter.limit);
      }
    }

    return logs;
  }

  /**
   * 清空存储的日志
   */
  clearStoredLogs(): void {
    this.storedLogs = [];
  }

  /**
   * 导出日志为JSON字符串
   */
  exportLogs(filter?: Parameters<typeof this.getStoredLogs>[0]): string {
    const logs = this.getStoredLogs(filter);
    return JSON.stringify(logs, null, 2);
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 创建子logger（带上下文）
   */
  createChildLogger(context: string): ChildLogger {
    return new ChildLogger(this, context);
  }
}

/**
 * 子Logger类，自动带上下文
 */
export class ChildLogger {
  constructor(
    private parent: Logger,
    private context: string
  ) {}

  debug(message: string, data?: any): void {
    this.parent.debug(message, this.context, data);
  }

  info(message: string, data?: any): void {
    this.parent.info(message, this.context, data);
  }

  warn(message: string, data?: any): void {
    this.parent.warn(message, this.context, data);
  }

  error(message: string, data?: any): void {
    this.parent.error(message, this.context, data);
  }

  logError(error: Error, additionalData?: any): void {
    this.parent.logError(error, this.context, additionalData);
  }

  logPerformance(operation: string, duration: number, additionalData?: any): void {
    this.parent.logPerformance(operation, duration, this.context, additionalData);
  }

  logUserAction(action: string, userId?: string, data?: any): void {
    this.parent.logUserAction(action, userId, this.context, data);
  }
}

/**
 * 预定义的日志处理器
 */
export const LogHandlers = {
  /**
   * 远程日志处理器（发送到服务器）
   */
  createRemoteHandler(
    endpoint: string,
    apiKey?: string
  ): LogHandler {
    return {
      name: 'remote',
      handle: async (entry: LogEntry) => {
        try {
          const headers: HeadersInit = {
            'Content-Type': 'application/json'
          };
          
          if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
          }

          await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(entry)
          });
        } catch (error) {
          // 静默失败，避免影响主流程
          console.warn('Failed to send log to remote:', error);
        }
      }
    };
  },

  /**
   * 文件日志处理器（仅React Native）
   */
  createFileHandler(
    filePath: string,
    FileSystem?: any
  ): LogHandler {
    return {
      name: 'file',
      handle: async (entry: LogEntry) => {
        if (!FileSystem) {
          console.warn('FileSystem not available for file logging');
          return;
        }

        try {
          const logLine = JSON.stringify(entry) + '\n';
          await FileSystem.appendFile(filePath, logLine);
        } catch (error) {
          console.warn('Failed to write log to file:', error);
        }
      }
    };
  }
};

// 创建默认单例实例
export const logger = Logger.getInstance({
  minLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  enableStorage: true,
  maxStoredLogs: 500
});

// 默认导出
export default logger;