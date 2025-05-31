import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { dashboardApi } from '@/lib/api';

// 仪表板数据类型定义
export interface DashboardStats {
  production: {
    total: number;
    trend: number;
    target: number;
    completion: number;
  };
  quality: {
    passRate: number;
    testsPassed: number;
    testsTotal: number;
    trend: number;
  };
  inventory: {
    totalItems: number;
    lowStock: number;
    outOfStock: number;
    value: number;
  };
  orders: {
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
  };
}

export interface OverviewData {
  dailyProduction: Array<{
    date: string;
    value: number;
    target: number;
  }>;
  qualityTrends: Array<{
    date: string;
    passRate: number;
    testCount: number;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  alerts: Array<{
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: string;
    resolved: boolean;
  }>;
}

export interface ReportData {
  summary: {
    period: string;
    totalProduction: number;
    averageQuality: number;
    totalRevenue: number;
    efficiency: number;
  };
  charts: {
    production: Array<{
      period: string;
      value: number;
    }>;
    quality: Array<{
      period: string;
      passRate: number;
    }>;
    revenue: Array<{
      period: string;
      amount: number;
    }>;
  };
}

export interface DashboardFilters {
  timeRange: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  customDateRange?: {
    start: string;
    end: string;
  };
  facility?: string[];
  productCategory?: string[];
  status?: string[];
}

export interface DashboardLayout {
  widgets: Array<{
    id: string;
    type: 'stats' | 'chart' | 'table' | 'alerts';
    position: {
      x: number;
      y: number;
      w: number;
      h: number;
    };
    config: Record<string, unknown>;
  }>;
  favoriteCharts: string[];
  hiddenWidgets: string[];
}

// 仪表板状态接口
export interface DashboardState {
  // 数据状态
  stats: DashboardStats | null;
  overview: OverviewData | null;
  reports: ReportData | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  
  // 视图状态
  currentView: 'overview' | 'analytics' | 'reports' | 'alerts';
  filters: DashboardFilters;
  layout: DashboardLayout;
  isFullscreen: boolean;
  selectedWidget: string | null;
  
  // 实时更新
  autoRefresh: boolean;
  refreshInterval: number; // 秒
  
  // Actions
  setCurrentView: (view: 'overview' | 'analytics' | 'reports' | 'alerts') => void;
  setFilters: (filters: Partial<DashboardFilters>) => void;
  resetFilters: () => void;
  updateLayout: (layout: DashboardLayout) => void;
  addFavoriteChart: (chartId: string) => void;
  removeFavoriteChart: (chartId: string) => void;
  hideWidget: (widgetId: string) => void;
  showWidget: (widgetId: string) => void;
  setSelectedWidget: (widgetId: string | null) => void;
  toggleFullscreen: () => void;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  updateLastRefresh: () => void;
}

// 默认筛选器
const defaultFilters: DashboardFilters = {
  timeRange: 'today',
  facility: [],
  productCategory: [],
  status: [],
};

// 默认布局
const defaultLayout: DashboardLayout = {
  widgets: [
    {
      id: 'production-stats',
      type: 'stats',
      position: { x: 0, y: 0, w: 6, h: 3 },
      config: { title: '生产统计' },
    },
    {
      id: 'quality-stats',
      type: 'stats',
      position: { x: 6, y: 0, w: 6, h: 3 },
      config: { title: '质量统计' },
    },
    {
      id: 'production-chart',
      type: 'chart',
      position: { x: 0, y: 3, w: 8, h: 4 },
      config: { title: '生产趋势', chartType: 'line' },
    },
    {
      id: 'alerts-panel',
      type: 'alerts',
      position: { x: 8, y: 3, w: 4, h: 4 },
      config: { title: '系统警报' },
    },
  ],
  favoriteCharts: [],
  hiddenWidgets: [],
};

// 创建Zustand Store
export const useDashboardStore = create<DashboardState>()(
  devtools(
    persist(
      (set, get) => ({
        // 初始状态
        stats: null,
        overview: null,
        reports: null,
        isLoading: false,
        error: null,
        lastUpdated: null,
        currentView: 'overview',
        filters: defaultFilters,
        layout: defaultLayout,
        isFullscreen: false,
        selectedWidget: null,
        autoRefresh: true,
        refreshInterval: 30, // 30秒

        // Actions实现
        setCurrentView: (view) => set({ currentView: view }),
        
        setFilters: (newFilters) => {
          const { filters } = get();
          set({ 
            filters: { ...filters, ...newFilters } 
          });
        },
        
        resetFilters: () => set({ filters: defaultFilters }),
        
        updateLayout: (layout) => set({ layout }),
        
        addFavoriteChart: (chartId) => {
          const { layout } = get();
          if (!layout.favoriteCharts.includes(chartId)) {
            set({
              layout: {
                ...layout,
                favoriteCharts: [...layout.favoriteCharts, chartId],
              },
            });
          }
        },
        
        removeFavoriteChart: (chartId) => {
          const { layout } = get();
          set({
            layout: {
              ...layout,
              favoriteCharts: layout.favoriteCharts.filter(id => id !== chartId),
            },
          });
        },
        
        hideWidget: (widgetId) => {
          const { layout } = get();
          if (!layout.hiddenWidgets.includes(widgetId)) {
            set({
              layout: {
                ...layout,
                hiddenWidgets: [...layout.hiddenWidgets, widgetId],
              },
            });
          }
        },
        
        showWidget: (widgetId) => {
          const { layout } = get();
          set({
            layout: {
              ...layout,
              hiddenWidgets: layout.hiddenWidgets.filter(id => id !== widgetId),
            },
          });
        },
        
        setSelectedWidget: (widgetId) => set({ selectedWidget: widgetId }),
        
        toggleFullscreen: () => set({ isFullscreen: !get().isFullscreen }),
        
        setAutoRefresh: (enabled) => set({ autoRefresh: enabled }),
        
        setRefreshInterval: (interval) => {
          // 限制刷新间隔在10秒到300秒之间
          const clampedInterval = Math.max(10, Math.min(300, interval));
          set({ refreshInterval: clampedInterval });
        },
        
        setError: (error) => set({ error }),
        setLoading: (loading) => set({ isLoading: loading }),
        updateLastRefresh: () => set({ lastUpdated: new Date().toISOString() }),
      }),
      {
        name: 'dashboard-state',
        // 选择性持久化，不保存临时数据
        partialize: (state) => ({
          currentView: state.currentView,
          filters: state.filters,
          layout: state.layout,
          autoRefresh: state.autoRefresh,
          refreshInterval: state.refreshInterval,
        }),
      }
    ),
    {
      name: 'dashboard-store',
    }
  )
);

// React Query集成Hooks
export const useDashboardStats = () => {
  const setError = useDashboardStore(state => state.setError);
  const setLoading = useDashboardStore(state => state.setLoading);
  const updateLastRefresh = useDashboardStore(state => state.updateLastRefresh);
  const autoRefresh = useDashboardStore(state => state.autoRefresh);
  const refreshInterval = useDashboardStore(state => state.refreshInterval);
  
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: async () => {
      setLoading(true);
      setError(null);
      
      try {
        const stats = await dashboardApi.getStats() as DashboardStats;
        updateLastRefresh();
        return stats;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '获取统计数据失败';
        setError(errorMessage);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    staleTime: 2 * 60 * 1000, // 2分钟
    gcTime: 10 * 60 * 1000, // 10分钟缓存
    refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
    retry: 3,
  });
};

export const useDashboardOverview = () => {
  const setError = useDashboardStore(state => state.setError);
  const setLoading = useDashboardStore(state => state.setLoading);
  const updateLastRefresh = useDashboardStore(state => state.updateLastRefresh);
  const autoRefresh = useDashboardStore(state => state.autoRefresh);
  const refreshInterval = useDashboardStore(state => state.refreshInterval);
  
  return useQuery({
    queryKey: queryKeys.dashboard.overview(),
    queryFn: async () => {
      setLoading(true);
      setError(null);
      
      try {
        const overview = await dashboardApi.getOverview() as OverviewData;
        updateLastRefresh();
        return overview;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '获取概览数据失败';
        setError(errorMessage);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    staleTime: 1 * 60 * 1000, // 1分钟
    gcTime: 5 * 60 * 1000, // 5分钟缓存
    refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
    retry: 3,
  });
};

export const useDashboardReports = (timeRange: string) => {
  const setError = useDashboardStore(state => state.setError);
  const setLoading = useDashboardStore(state => state.setLoading);
  
  return useQuery({
    queryKey: queryKeys.dashboard.reports(timeRange),
    queryFn: async () => {
      setLoading(true);
      setError(null);
      
      try {
        const reports = await dashboardApi.getReports(timeRange) as ReportData;
        return reports;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '获取报告数据失败';
        setError(errorMessage);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    enabled: !!timeRange,
    staleTime: 5 * 60 * 1000, // 5分钟
    gcTime: 30 * 60 * 1000, // 30分钟缓存
    retry: 3,
  });
};

// 数据更新Mutation
export const useUpdateDashboardData = () => {
  const queryClient = useQueryClient();
  const updateLastRefresh = useDashboardStore(state => state.updateLastRefresh);
  
  return useMutation({
    mutationFn: async (type: 'stats' | 'overview' | 'reports') => {
      // 根据类型刷新对应数据
      switch (type) {
        case 'stats':
          return dashboardApi.getStats();
        case 'overview':
          return dashboardApi.getOverview();
        case 'reports':
          return dashboardApi.getReports('today');
        default:
          throw new Error('未知的数据类型');
      }
    },
    onSuccess: (_, type) => {
      // 使相关查询失效，触发重新获取
      switch (type) {
        case 'stats':
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
          break;
        case 'overview':
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.overview() });
          break;
        case 'reports':
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'reports'] });
          break;
      }
      updateLastRefresh();
    },
  });
};

// 实时数据同步Hook
export const useDashboardSync = () => {
  const autoRefresh = useDashboardStore(state => state.autoRefresh);
  const refreshInterval = useDashboardStore(state => state.refreshInterval);
  const queryClient = useQueryClient();
  
  const refreshAllData = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  
  const toggleAutoRefresh = () => {
    const currentAutoRefresh = useDashboardStore.getState().autoRefresh;
    useDashboardStore.getState().setAutoRefresh(!currentAutoRefresh);
  };
  
  return {
    refreshAllData,
    toggleAutoRefresh,
    autoRefresh,
    refreshInterval,
  };
};

// 选择器Hooks - 性能优化
export const useDashboardView = () => useDashboardStore(state => state.currentView);
export const useDashboardFilters = () => useDashboardStore(state => state.filters);
export const useDashboardLayout = () => useDashboardStore(state => state.layout);
export const useDashboardStatus = () => useDashboardStore(state => ({
  isLoading: state.isLoading,
  error: state.error,
  lastUpdated: state.lastUpdated,
}));
export const useDashboardSettings = () => useDashboardStore(state => ({
  autoRefresh: state.autoRefresh,
  refreshInterval: state.refreshInterval,
  isFullscreen: state.isFullscreen,
  selectedWidget: state.selectedWidget,
})); 