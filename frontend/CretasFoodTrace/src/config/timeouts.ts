/**
 * 统一的超时和重试配置
 *
 * 使用场景：
 * 1. API请求超时配置
 * 2. 网络重试策略
 * 3. 后台任务超时
 *
 * 注意：不要在代码中硬编码超时时间，统一使用此配置
 */

/**
 * API请求超时配置（毫秒）
 */
export const API_TIMEOUTS = {
  /** 默认API请求超时：30秒 */
  DEFAULT: 30_000,

  /** 快速查询超时：10秒（如搜索、过滤） */
  QUICK_QUERY: 10_000,

  /** 长时间操作超时：60秒（如批量导入、报表生成） */
  LONG_OPERATION: 60_000,

  /** 文件上传超时：2分钟 */
  FILE_UPLOAD: 120_000,

  /** 网络健康检查超时：5秒 */
  HEALTH_CHECK: 5_000,

  /** DeepSeek AI分析超时：45秒 */
  AI_ANALYSIS: 45_000,
} as const;

/**
 * 网络重试配置
 */
export const RETRY_CONFIG = {
  /** 最大重试次数 */
  MAX_ATTEMPTS: 3,

  /** 基础延迟时间：1秒 */
  BASE_DELAY: 1_000,

  /** 最大延迟时间：10秒（指数退避的上限） */
  MAX_DELAY: 10_000,

  /** 退避因子：每次重试延迟时间翻倍 */
  BACKOFF_FACTOR: 2,

  /** 快速重试最大次数：用于轻量级请求 */
  QUICK_RETRY_MAX: 2,

  /** 快速重试延迟：500毫秒 */
  QUICK_RETRY_DELAY: 500,
} as const;

/**
 * 缓存过期时间配置（毫秒）
 */
export const CACHE_EXPIRY = {
  /** 短期缓存：5分钟（如列表数据） */
  SHORT: 5 * 60 * 1000,

  /** 中期缓存：30分钟（如统计数据） */
  MEDIUM: 30 * 60 * 1000,

  /** 长期缓存：2小时（如配置数据） */
  LONG: 2 * 60 * 60 * 1000,

  /** DeepSeek AI分析缓存：5分钟 */
  AI_ANALYSIS: 5 * 60 * 1000,
} as const;

/**
 * 防抖/节流配置（毫秒）
 */
export const DEBOUNCE_CONFIG = {
  /** 搜索输入防抖：300毫秒 */
  SEARCH_INPUT: 300,

  /** 表单验证防抖：500毫秒 */
  FORM_VALIDATION: 500,

  /** 窗口resize防抖：200毫秒 */
  WINDOW_RESIZE: 200,

  /** 按钮防抖：1秒（防止重复提交） */
  BUTTON_CLICK: 1_000,
} as const;

/**
 * 后台任务轮询间隔（毫秒）
 */
export const POLLING_INTERVALS = {
  /** 快速轮询：5秒（如实时状态） */
  FAST: 5_000,

  /** 正常轮询：30秒（如列表刷新） */
  NORMAL: 30_000,

  /** 慢速轮询：2分钟（如统计数据） */
  SLOW: 2 * 60 * 1000,
} as const;

/**
 * 获取带抖动的重试延迟（避免雷同请求）
 * @param attempt 当前重试次数（从1开始）
 * @returns 延迟时间（毫秒）
 */
export function getRetryDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_CONFIG.BASE_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_FACTOR, attempt - 1),
    RETRY_CONFIG.MAX_DELAY
  );

  // 添加±20%的随机抖动
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.round(delay + jitter);
}

/**
 * 根据操作类型获取超时时间
 */
export function getTimeoutForOperation(operationType: 'read' | 'write' | 'delete'): number {
  switch (operationType) {
    case 'read':
      return API_TIMEOUTS.DEFAULT;
    case 'write':
      return API_TIMEOUTS.LONG_OPERATION;
    case 'delete':
      return API_TIMEOUTS.DEFAULT;
    default:
      return API_TIMEOUTS.DEFAULT;
  }
}
