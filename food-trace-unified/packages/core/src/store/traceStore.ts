// 溯源状态管理 - 基础框架
import { create } from 'zustand';
import type { TraceState, SearchHistory } from '../types/state';
import type { Batch } from '../types/business';

interface TraceActions {
  searchBatches: (query: string) => Promise<void>;
  setBatch: (batch: Batch | null) => void;
  setViewMode: (mode: 'timeline' | 'detailed' | 'summary') => void;
  addSearchHistory: (query: string, resultCount: number) => void;
  clearSearchHistory: () => void;
}

type TraceStore = TraceState & TraceActions;

export const useTraceStore = create<TraceStore>((set, get) => ({
  // 初始状态
  currentBatch: null,
  searchQuery: '',
  searchResults: [],
  searchHistory: [],
  viewMode: 'timeline',
  showQualityMetrics: true,
  loading: false,
  error: null,

  // Actions - 基础框架
  searchBatches: async (query: string) => {
    set({ loading: true, error: null, searchQuery: query });
    // TODO: 实现批次搜索逻辑
    set({ loading: false, searchResults: [] });
  },

  setBatch: (batch) => set({ currentBatch: batch }),
  setViewMode: (viewMode) => set({ viewMode }),
  
  addSearchHistory: (query, resultCount) => {
    const history: SearchHistory = {
      id: `search_${Date.now()}`,
      query,
      timestamp: new Date(),
      resultCount
    };
    set(state => ({ 
      searchHistory: [history, ...state.searchHistory].slice(0, 10) 
    }));
  },

  clearSearchHistory: () => set({ searchHistory: [] })
}));