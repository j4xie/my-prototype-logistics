import { QueryClient } from '@tanstack/react-query';

/**
 * React Query配置
 * 
 * 缓存策略：
 * - staleTime: 5分钟 - 数据在此时间内视为新鲜，不会重新请求
 * - gcTime: 30分钟 - 数据在内存中保存的时间 (垃圾回收时间)
 * - retry: 3次 - 请求失败后的重试次数
 * - retryDelay: 指数退避 - 重试间隔逐渐增加
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 数据新鲜时间：5分钟内不重新请求
      staleTime: 5 * 60 * 1000,
      // 垃圾回收时间：30分钟后清理 (替代原来的cacheTime)
      gcTime: 30 * 60 * 1000,
      // 重试配置
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // 窗口重新获得焦点时重新请求
      refetchOnWindowFocus: false,
      // 网络重新连接时重新请求
      refetchOnReconnect: true,
      // 组件挂载时重新请求
      refetchOnMount: true,
    },
    mutations: {
      // Mutation重试配置
      retry: 1,
      retryDelay: 1000,
    },
  },
});

/**
 * 查询键工厂
 * 统一管理所有查询键，避免重复和冲突
 */
export const queryKeys = {
  // 认证相关
  auth: {
    user: () => ['auth', 'user'] as const,
    permissions: () => ['auth', 'permissions'] as const,
    profile: () => ['auth', 'profile'] as const,
  },
  
  // 溯源查询相关
  trace: {
    all: () => ['trace'] as const,
    batch: (batchId: string) => ['trace', 'batch', batchId] as const,
    history: () => ['trace', 'history'] as const,
    search: (query: string) => ['trace', 'search', query] as const,
  },
  
  // 仪表板相关
  dashboard: {
    all: () => ['dashboard'] as const,
    stats: () => ['dashboard', 'stats'] as const,
    overview: () => ['dashboard', 'overview'] as const,
    reports: (timeRange: string) => ['dashboard', 'reports', timeRange] as const,
  },
  
  // 业务数据相关
  farming: {
    all: () => ['farming'] as const,
    records: () => ['farming', 'records'] as const,
    batches: () => ['farming', 'batches'] as const,
  },
  
  processing: {
    all: () => ['processing'] as const,
    records: () => ['processing', 'records'] as const,
    batches: () => ['processing', 'batches'] as const,
  },
  
  logistics: {
    all: () => ['logistics'] as const,
    shipments: () => ['logistics', 'shipments'] as const,
    tracking: (trackingId: string) => ['logistics', 'tracking', trackingId] as const,
  },
} as const;

/**
 * 查询错误处理
 */
export const queryErrorHandler = (error: Error) => {
  console.error('Query Error:', error);
  
  // 根据错误类型进行不同处理
  if (error.message.includes('401')) {
    // 未授权，跳转到登录页
    window.location.href = '/auth/login';
  } else if (error.message.includes('403')) {
    // 权限不足，显示提示
    console.warn('权限不足');
  } else if (error.message.includes('500')) {
    // 服务器错误，显示通用错误提示
    console.error('服务器错误，请稍后重试');
  }
};

/**
 * 查询成功处理
 */
export const querySuccessHandler = (data: unknown) => {
  console.log('Query Success:', data);
}; 