/**
 * 日志工具
 * 提供不同级别的日志记录功能
 */

// 日志级别
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  NONE: 4
};

// 默认配置
const defaultConfig = {
  level: LogLevel.INFO,
  useConsole: true,
  useLocalStorage: false,
  localStorageKey: 'app_logs',
  maxLogEntries: 1000,
  timestampFormat: 'ISO' // 'ISO' 或 'LOCALE'
};

// 当前配置
let config = { ...defaultConfig };

// 存储的日志
let storedLogs = [];

/**
 * 配置日志工具
 * @param {Object} newConfig - 新配置
 */
function configureLogger(newConfig = {}) {
  config = {
    ...config,
    ...newConfig
  };
  
  // 如果启用了本地存储，尝试加载已存储的日志
  if (config.useLocalStorage) {
    _loadLogsFromStorage();
  }
}

/**
 * 记录调试级别日志
 * @param {string} message - 日志消息
 * @param {*} [data] - 附加数据
 */
function logDebug(message, data) {
  _log(LogLevel.DEBUG, message, data);
}

/**
 * 记录信息级别日志
 * @param {string} message - 日志消息
 * @param {*} [data] - 附加数据
 */
function logInfo(message, data) {
  _log(LogLevel.INFO, message, data);
}

/**
 * 记录警告级别日志
 * @param {string} message - 日志消息
 * @param {*} [data] - 附加数据
 */
function logWarning(message, data) {
  _log(LogLevel.WARNING, message, data);
}

/**
 * 记录错误级别日志
 * @param {string} message - 日志消息
 * @param {*} [data] - 附加数据
 */
function logError(message, data) {
  _log(LogLevel.ERROR, message, data);
}

/**
 * 获取所有存储的日志
 * @return {Array} 日志数组
 */
function getLogs() {
  return [...storedLogs];
}

/**
 * 获取特定级别的日志
 * @param {number} level - 日志级别
 * @return {Array} 日志数组
 */
function getLogsByLevel(level) {
  return storedLogs.filter(log => log.level === level);
}

/**
 * 清除所有存储的日志
 */
function clearLogs() {
  storedLogs = [];
  
  if (config.useLocalStorage) {
    try {
      localStorage.removeItem(config.localStorageKey);
    } catch (error) {
      console.error('无法清除本地存储中的日志', error);
    }
  }
}

/**
 * 内部方法：记录日志
 * @private
 * @param {number} level - 日志级别
 * @param {string} message - 日志消息
 * @param {*} [data] - 附加数据
 */
function _log(level, message, data) {
  // 如果日志级别低于配置的级别，不记录
  if (level < config.level) {
    return;
  }
  
  const timestamp = config.timestampFormat === 'ISO' 
    ? new Date().toISOString()
    : new Date().toLocaleString();
  
  const logEntry = {
    timestamp,
    level,
    message,
    data
  };
  
  // 输出到控制台
  if (config.useConsole) {
    _logToConsole(logEntry);
  }
  
  // 存储日志
  if (config.useLocalStorage) {
    _storeLog(logEntry);
  }
}

/**
 * 内部方法：输出日志到控制台
 * @private
 * @param {Object} logEntry - 日志条目
 */
function _logToConsole(logEntry) {
  const { timestamp, level, message, data } = logEntry;
  
  let formattedMessage = `[${timestamp}] `;
  
  switch (level) {
    case LogLevel.DEBUG:
      formattedMessage += '[DEBUG] ';
      break;
    case LogLevel.INFO:
      formattedMessage += '[INFO] ';
      break;
    case LogLevel.WARNING:
      formattedMessage += '[WARNING] ';
      break;
    case LogLevel.ERROR:
      formattedMessage += '[ERROR] ';
      break;
  }
  
  formattedMessage += message;
  
  switch (level) {
    case LogLevel.DEBUG:
      if (data) {
        console.debug(formattedMessage, data);
      } else {
        console.debug(formattedMessage);
      }
      break;
    case LogLevel.INFO:
      if (data) {
        console.info(formattedMessage, data);
      } else {
        console.info(formattedMessage);
      }
      break;
    case LogLevel.WARNING:
      if (data) {
        console.warn(formattedMessage, data);
      } else {
        console.warn(formattedMessage);
      }
      break;
    case LogLevel.ERROR:
      if (data) {
        console.error(formattedMessage, data);
      } else {
        console.error(formattedMessage);
      }
      break;
  }
}

/**
 * 内部方法：存储日志
 * @private
 * @param {Object} logEntry - 日志条目
 */
function _storeLog(logEntry) {
  storedLogs.push(logEntry);
  
  // 限制日志数量
  if (storedLogs.length > config.maxLogEntries) {
    storedLogs = storedLogs.slice(storedLogs.length - config.maxLogEntries);
  }
  
  // 存储到本地存储
  try {
    localStorage.setItem(config.localStorageKey, JSON.stringify(storedLogs));
  } catch (error) {
    console.error('无法将日志保存到本地存储', error);
    
    // 如果是存储空间不足，清除一些旧日志再重试
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      storedLogs = storedLogs.slice(storedLogs.length / 2);
      try {
        localStorage.setItem(config.localStorageKey, JSON.stringify(storedLogs));
      } catch (retryError) {
        console.error('重试保存日志失败', retryError);
      }
    }
  }
}

/**
 * 内部方法：从本地存储加载日志
 * @private
 */
function _loadLogsFromStorage() {
  try {
    const storedLogsStr = localStorage.getItem(config.localStorageKey);
    if (storedLogsStr) {
      storedLogs = JSON.parse(storedLogsStr);
    }
  } catch (error) {
    console.error('无法从本地存储加载日志', error);
  }
}

/**
 * 获取日志级别名称
 * @param {number} level - 日志级别
 * @return {string} 日志级别名称
 */
function getLevelName(level) {
  switch (level) {
    case LogLevel.DEBUG:
      return 'DEBUG';
    case LogLevel.INFO:
      return 'INFO';
    case LogLevel.WARNING:
      return 'WARNING';
    case LogLevel.ERROR:
      return 'ERROR';
    case LogLevel.NONE:
      return 'NONE';
    default:
      return 'UNKNOWN';
  }
}

module.exports = {
  LogLevel,
  configureLogger,
  logDebug,
  logInfo,
  logWarning,
  logError,
  getLogs,
  getLogsByLevel,
  clearLogs,
  getLevelName
}; 