// 仪表板Hooks - 基础框架
import { useDashboardStore } from '../store/dashboardStore';

export const useDashboard = () => {
  const {
    stats,
    overview,
    currentView,
    filters,
    autoRefresh,
    refreshInterval,
    loading,
    error,
    fetchStats,
    fetchOverview,
    setCurrentView,
    setAutoRefresh,
    setRefreshInterval
  } = useDashboardStore();

  return {
    stats,
    overview,
    currentView,
    filters,
    autoRefresh,
    refreshInterval,
    loading,
    error,
    fetchStats,
    fetchOverview,
    setCurrentView,
    setAutoRefresh,
    setRefreshInterval
  };
};