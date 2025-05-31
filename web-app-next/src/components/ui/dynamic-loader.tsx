'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Loading } from './loading';

// 定义动态组件配置接口
interface DynamicComponentConfig {
  loader: () => Promise<any>;
  loading?: () => React.ReactNode;
  ssr?: boolean;
  displayName?: string;
}

// 错误边界组件
class DynamicErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dynamic component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">
                  组件加载失败: {this.state.error?.message || '未知错误'}
                </p>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// 创建动态组件的工厂函数
export function createDynamicComponent<T = any>(config: DynamicComponentConfig) {
  const DynamicComponent = dynamic(config.loader, {
    loading: config.loading || (() => <Loading />),
    ssr: config.ssr !== false,
  });

  // 返回带错误边界的包装组件
  const WrappedComponent = React.forwardRef<T, any>((props) => (
    <DynamicErrorBoundary>
      <Suspense fallback={config.loading ? config.loading() : <Loading />}>
        <DynamicComponent {...props} />
      </Suspense>
    </DynamicErrorBoundary>
  ));

  WrappedComponent.displayName = config.displayName || 'DynamicComponent';

  return WrappedComponent;
}

// 预定义的动态组件加载器
export const DynamicLoaders = {
  // 高级表格组件
  AdvancedTable: createDynamicComponent({
    loader: () => import('./advanced-table').then(mod => ({ default: mod.AdvancedTable })),
    displayName: 'DynamicAdvancedTable',
    ssr: false, // 表格通常不需要SSR
  }),

  // 图表组件（示例）
  ChartComponent: createDynamicComponent({
    loader: () => Promise.resolve({ 
      default: () => <div className="bg-gray-100 rounded-lg p-8 text-center text-gray-500">图表组件正在开发中</div> 
    }),
    displayName: 'DynamicChart',
    ssr: false,
  }),

  // 模态框组件
  Modal: createDynamicComponent({
    loader: () => Promise.resolve({ 
      default: () => <div className="bg-gray-100 rounded-lg p-4 text-center text-gray-500">模态框组件</div> 
    }),
    displayName: 'DynamicModal',
    ssr: false,
  }),
};

// 动态加载状态指示器
export const DynamicLoadingIndicator: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}> = ({ size = 'md', message = '组件加载中...' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div className="flex items-center justify-center p-4">
      <div className={`animate-spin rounded-full border-2 border-blue-600 border-t-transparent ${sizeClasses[size]}`}></div>
      <span className="ml-2 text-sm text-gray-600">{message}</span>
    </div>
  );
};

// 性能监控Hook
export function useDynamicComponentMetrics(componentName: string) {
  const [metrics, setMetrics] = React.useState({
    loadStartTime: 0,
    loadEndTime: 0,
    loadDuration: 0,
    isLoading: false,
    hasError: false,
  });

  const startLoading = React.useCallback(() => {
    const startTime = performance.now();
    setMetrics(prev => ({
      ...prev,
      loadStartTime: startTime,
      isLoading: true,
      hasError: false,
    }));
  }, []);

  const endLoading = React.useCallback((success: boolean = true) => {
    const endTime = performance.now();
    setMetrics(prev => ({
      ...prev,
      loadEndTime: endTime,
      loadDuration: endTime - prev.loadStartTime,
      isLoading: false,
      hasError: !success,
    }));

    // 发送性能指标到控制台（可以替换为实际的分析服务）
    console.log(`Dynamic Component [${componentName}] 加载指标:`, {
      duration: endTime - metrics.loadStartTime,
      success,
      timestamp: new Date().toISOString(),
    });
  }, [componentName, metrics.loadStartTime]);

  return {
    metrics,
    startLoading,
    endLoading,
  };
}

// 导出类型
export type { DynamicComponentConfig }; 