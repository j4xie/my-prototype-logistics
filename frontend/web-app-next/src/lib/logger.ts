// 日志记录器 - 简化版本
// 提供基础的日志记录功能

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
  data?: any;
}

// 简化的日志记录器
class Logger {
  private static instance: Logger;

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  debug(message: string, context?: string, data?: any): void {
    this.log('debug', message, context, data);
  }

  info(message: string, context?: string, data?: any): void {
    this.log('info', message, context, data);
  }

  warn(message: string, context?: string, data?: any): void {
    this.log('warn', message, context, data);
  }

  error(message: string, context?: string, data?: any): void {
    this.log('error', message, context, data);
  }

  private log(level: LogLevel, message: string, context?: string, data?: any): void {
    // 在开发环境中输出到控制台
    if (process.env.NODE_ENV === 'development') {
      const prefix = context ? `[${context}]` : '';
      const logMessage = `${prefix} ${message}`;

      switch (level) {
        case 'debug':
          console.debug(logMessage, data);
          break;
        case 'info':
          console.info(logMessage, data);
          break;
        case 'warn':
          console.warn(logMessage, data);
          break;
        case 'error':
          console.error(logMessage, data);
          break;
      }
    }
  }
}

// 导出单例实例
export const logger = Logger.getInstance();

// 默认导出
export default logger; 