// 应用全局状态管理
import { create } from 'zustand';
import type { AppState, NetworkState, UIState } from '../types/state';

interface AppActions {
  setInitialized: (initialized: boolean) => void;
  setNetworkState: (network: Partial<NetworkState>) => void;
  setUIState: (ui: Partial<UIState>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

type AppStore = AppState & AppActions;

export const useAppStore = create<AppStore>((set) => ({
  // 初始状态
  initialized: false,
  platform: 'web',
  network: {
    isConnected: true,
    type: 'wifi',
    isInternetReachable: true,
    syncPending: false
  },
  ui: {
    sidebarOpen: false,
    modalStack: [],
    toasts: [],
    theme: 'light',
    locale: 'zh'
  },
  loading: false,
  error: null,

  // Actions
  setInitialized: (initialized: boolean) => set({ initialized }),
  
  setNetworkState: (network: Partial<NetworkState>) => 
    set(state => ({ network: { ...state.network, ...network } })),
    
  setUIState: (ui: Partial<UIState>) => 
    set(state => ({ ui: { ...state.ui, ...ui } })),
    
  setLoading: (loading: boolean) => set({ loading }),
  setError: (error: string | null) => set({ error })
}));