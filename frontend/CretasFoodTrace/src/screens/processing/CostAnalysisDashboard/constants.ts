/**
 * 成本分析常量定义
 * 将常量移出组件，避免每次渲染都重新创建
 */

// AI快速问题列表
export const QUICK_QUESTIONS = [
  '如何降低人工成本？',
  '设备利用率如何优化？',
  '如何提高利润率？',
] as const;

// 缓存配置
export const CACHE_CONFIG = {
  // 成本数据缓存时长（5分钟）
  COST_DATA_DURATION: 5 * 60 * 1000,
  // AI分析结果缓存时长（30分钟）
  AI_ANALYSIS_DURATION: 30 * 60 * 1000,
  // Session有效期（24小时）
  SESSION_DURATION: 24 * 60 * 60 * 1000,
} as const;

// AsyncStorage键名前缀
export const STORAGE_KEYS = {
  AI_SESSION_PREFIX: 'ai_session_',
  COST_CACHE_PREFIX: 'cost_cache_',
} as const;
