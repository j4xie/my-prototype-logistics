// 自定义Hooks导出索引
// 这里将导出所有自定义hooks

// API相关Hooks - 从实际存在的文件导出
export {
  useApi,
  useAuth,
  useTrace,
  useProduct,
  useUser,
  login,
  clearCache,
  type UseApiConfig,
  type UseApiResult,
  type ApiStatus
} from './useApi-simple';

// AI状态管理Hooks - TASK-P3-017
export {
  useAiCache,
  useAiBatch,
  useAiPerformance,
  useAiErrors,
  useAiState,
  useOfflineState
} from './useAiState';

// 示例：
// export { useAuth } from './useAuth';
// export { useLocalStorage } from './useLocalStorage';
// export { useDebounce } from './useDebounce';
