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

// 示例：
// export { useAuth } from './useAuth';
// export { useLocalStorage } from './useLocalStorage';
// export { useDebounce } from './useDebounce';

// 暂时导出空对象，等待后续hooks的添加
export {};
