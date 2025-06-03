import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { traceApi } from '@/lib/api';

// 溯源数据类型定义
export interface Batch {
  id: string;
  batchNumber: string;
  productName: string;
  productionDate: string;
  expiryDate: string;
  status: 'active' | 'recalled' | 'expired';
  facility: {
    id: string;
    name: string;
    location: string;
  };
  traceabilitySteps: TraceStep[];
  qualityMetrics: QualityMetric[];
  certifications: Certification[];
}

export interface TraceStep {
  id: string;
  step: number;
  title: string;
  description: string;
  timestamp: string;
  location: string;
  responsible: string;
  status: 'completed' | 'in-progress' | 'pending';
  documents: Document[];
  photos: string[];
}

export interface QualityMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  threshold: {
    min: number;
    max: number;
  };
  status: 'pass' | 'fail' | 'warning';
  measuredAt: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issuedDate: string;
  expiryDate: string;
  status: 'valid' | 'expired' | 'revoked';
  documentUrl: string;
}

export interface SearchHistory {
  id: string;
  batchId: string;
  batchNumber: string;
  productName: string;
  searchedAt: string;
  category: 'recent' | 'bookmarked';
}

// 溯源状态接口
export interface TraceState {
  // 当前状态
  currentBatch: Batch | null;
  isLoading: boolean;
  error: string | null;
  
  // 搜索相关
  searchQuery: string;
  searchResults: Batch[];
  searchHistory: SearchHistory[];
  recentSearches: string[];
  suggestions: string[];
  
  // 视图状态
  viewMode: 'timeline' | 'detailed' | 'summary';
  selectedStep: string | null;
  showQualityMetrics: boolean;
  showCertifications: boolean;
  
  // 偏好设置
  autoSave: boolean;
  showSearchSuggestions: boolean;
  maxHistoryItems: number;
  
  // Actions
  setCurrentBatch: (batch: Batch | null) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: Batch[]) => void;
  addToHistory: (batch: Batch) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  bookmarkBatch: (batchId: string) => void;
  unbookmarkBatch: (batchId: string) => void;
  setViewMode: (mode: 'timeline' | 'detailed' | 'summary') => void;
  setSelectedStep: (stepId: string | null) => void;
  toggleQualityMetrics: () => void;
  toggleCertifications: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  
  // 搜索建议
  addSuggestion: (suggestion: string) => void;
  clearSuggestions: () => void;
}

// 创建Zustand Store
export const useTraceStore = create<TraceState>()(
  devtools(
    persist(
      (set, get) => ({
        // 初始状态
        currentBatch: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        searchResults: [],
        searchHistory: [],
        recentSearches: [],
        suggestions: [],
        viewMode: 'timeline',
        selectedStep: null,
        showQualityMetrics: true,
        showCertifications: true,
        autoSave: true,
        showSearchSuggestions: true,
        maxHistoryItems: 50,

        // Actions实现
        setCurrentBatch: (batch) => set({ currentBatch: batch }),
        
        setSearchQuery: (query) => {
          set({ searchQuery: query });
          
          // 如果查询非空且启用建议，添加到建议列表
          if (query.trim() && get().showSearchSuggestions) {
            const { suggestions } = get();
            if (!suggestions.includes(query.trim())) {
              set({ 
                suggestions: [query.trim(), ...suggestions].slice(0, 10) 
              });
            }
          }
        },
        
        setSearchResults: (results) => set({ searchResults: results }),
        
        addToHistory: (batch) => {
          const { searchHistory, maxHistoryItems } = get();
          const existingIndex = searchHistory.findIndex(item => item.batchId === batch.id);
          
          const historyItem: SearchHistory = {
            id: `${batch.id}-${Date.now()}`,
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            productName: batch.productName,
            searchedAt: new Date().toISOString(),
            category: 'recent'
          };
          
          let newHistory: SearchHistory[];
          if (existingIndex >= 0) {
            // 更新现有记录
            newHistory = [...searchHistory];
            newHistory[existingIndex] = { ...newHistory[existingIndex], searchedAt: historyItem.searchedAt };
          } else {
            // 添加新记录
            newHistory = [historyItem, ...searchHistory].slice(0, maxHistoryItems);
          }
          
          set({ searchHistory: newHistory });
          
          // 更新最近搜索
          const recentSearches = [batch.batchNumber, ...get().recentSearches.filter(s => s !== batch.batchNumber)].slice(0, 10);
          set({ recentSearches });
        },
        
        removeFromHistory: (id) => {
          const { searchHistory } = get();
          set({ 
            searchHistory: searchHistory.filter(item => item.id !== id) 
          });
        },
        
        clearHistory: () => set({ 
          searchHistory: [], 
          recentSearches: [] 
        }),
        
        bookmarkBatch: (batchId) => {
          const { searchHistory } = get();
          const newHistory = searchHistory.map(item => 
            item.batchId === batchId 
              ? { ...item, category: 'bookmarked' as const }
              : item
          );
          set({ searchHistory: newHistory });
        },
        
        unbookmarkBatch: (batchId) => {
          const { searchHistory } = get();
          const newHistory = searchHistory.map(item => 
            item.batchId === batchId 
              ? { ...item, category: 'recent' as const }
              : item
          );
          set({ searchHistory: newHistory });
        },
        
        setViewMode: (mode) => set({ viewMode: mode }),
        setSelectedStep: (stepId) => set({ selectedStep: stepId }),
        toggleQualityMetrics: () => set({ showQualityMetrics: !get().showQualityMetrics }),
        toggleCertifications: () => set({ showCertifications: !get().showCertifications }),
        setError: (error) => set({ error }),
        setLoading: (loading) => set({ isLoading: loading }),
        
        addSuggestion: (suggestion) => {
          const { suggestions } = get();
          if (!suggestions.includes(suggestion)) {
            set({ 
              suggestions: [suggestion, ...suggestions].slice(0, 10) 
            });
          }
        },
        
        clearSuggestions: () => set({ suggestions: [] }),
      }),
      {
        name: 'trace-state',
        // 选择性持久化，不保存临时状态
        partialize: (state) => ({
          searchHistory: state.searchHistory,
          recentSearches: state.recentSearches,
          suggestions: state.suggestions,
          viewMode: state.viewMode,
          showQualityMetrics: state.showQualityMetrics,
          showCertifications: state.showCertifications,
          autoSave: state.autoSave,
          showSearchSuggestions: state.showSearchSuggestions,
          maxHistoryItems: state.maxHistoryItems,
        }),
      }
    ),
    {
      name: 'trace-store',
    }
  )
);

// React Query集成Hooks
export const useTraceQuery = (batchId: string) => {
  const setCurrentBatch = useTraceStore(state => state.setCurrentBatch);
  const setError = useTraceStore(state => state.setError);
  const setLoading = useTraceStore(state => state.setLoading);
  
  return useQuery({
    queryKey: queryKeys.trace.batch(batchId),
    queryFn: async () => {
      setLoading(true);
      setError(null);
      
      try {
        const batch = await traceApi.getBatchInfo(batchId) as Batch;
        setCurrentBatch(batch);
        return batch;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '获取批次信息失败';
        setError(errorMessage);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    enabled: !!batchId,
    staleTime: 5 * 60 * 1000, // 5分钟
    gcTime: 30 * 60 * 1000, // 30分钟缓存
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

export const useTraceSearch = () => {
  const setSearchResults = useTraceStore(state => state.setSearchResults);
  const setError = useTraceStore(state => state.setError);
  const setLoading = useTraceStore(state => state.setLoading);
  
  return useMutation({
    mutationFn: async (query: string) => {
      setLoading(true);
      setError(null);
      
      try {
        const results = await traceApi.searchBatches(query) as Batch[];
        setSearchResults(results);
        return results;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '搜索失败';
        setError(errorMessage);
        throw error;
      } finally {
        setLoading(false);
      }
    },
  });
};

export const useTraceHistory = () => {
  const queryClient = useQueryClient();
  const addToHistory = useTraceStore(state => state.addToHistory);
  const removeFromHistory = useTraceStore(state => state.removeFromHistory);
  const clearHistory = useTraceStore(state => state.clearHistory);
  
  const prefetchBatch = (batchId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.trace.batch(batchId),
      queryFn: () => traceApi.getBatchInfo(batchId),
      staleTime: 5 * 60 * 1000,
    });
  };
  
  return {
    addToHistory,
    removeFromHistory,
    clearHistory,
    prefetchBatch,
  };
};

// 选择器Hooks - 性能优化
export const useCurrentBatch = () => useTraceStore(state => state.currentBatch);
export const useSearchState = () => useTraceStore(state => ({
  query: state.searchQuery,
  results: state.searchResults,
  isLoading: state.isLoading,
  error: state.error,
}));
export const useSearchHistory = () => useTraceStore(state => state.searchHistory);
export const useRecentSearches = () => useTraceStore(state => state.recentSearches);
export const useTraceViewSettings = () => useTraceStore(state => ({
  viewMode: state.viewMode,
  selectedStep: state.selectedStep,
  showQualityMetrics: state.showQualityMetrics,
  showCertifications: state.showCertifications,
}));
export const useTracePreferences = () => useTraceStore(state => ({
  autoSave: state.autoSave,
  showSearchSuggestions: state.showSearchSuggestions,
  maxHistoryItems: state.maxHistoryItems,
})); 