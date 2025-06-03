/**
 * useApi Hook - 向后兼容入口
 * 
 * @description 提供向后兼容的API Hook接口
 * @deprecated 建议使用 useApi-simple.ts 中的函数
 */

// 从实际存在的文件重新导出所有函数
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

// 向后兼容的别名
export { useApi as useBaseApi } from './useApi-simple'; 