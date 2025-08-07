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

// 权限管理Hooks
export {
  usePermissions,
  usePermissionCheck,
  useMultiPermissionCheck,
  useDepartmentAccess
} from './usePermissions';

// 通用操作Hooks - 代码重构专用
export { useStatusActions } from './useStatusActions';
export { useErrorHandler } from './useErrorHandler';

// 示例：
// export { useAuth } from './useAuth';
// export { useLocalStorage } from './useLocalStorage';
// export { useDebounce } from './useDebounce';
