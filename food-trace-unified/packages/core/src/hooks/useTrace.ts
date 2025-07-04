// 溯源Hooks - 基础框架
import { useTraceStore } from '../store/traceStore';

export const useTrace = () => {
  const {
    currentBatch,
    searchQuery,
    searchResults,
    searchHistory,
    viewMode,
    showQualityMetrics,
    loading,
    error,
    searchBatches,
    setBatch,
    setViewMode,
    addSearchHistory,
    clearSearchHistory
  } = useTraceStore();

  return {
    currentBatch,
    searchQuery,
    searchResults,
    searchHistory,
    viewMode,
    showQualityMetrics,
    loading,
    error,
    searchBatches,
    setBatch,
    setViewMode,
    addSearchHistory,
    clearSearchHistory
  };
};