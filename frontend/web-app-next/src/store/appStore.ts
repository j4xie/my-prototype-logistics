/**
 * 全局应用状态管理
 * 使用Zustand管理主题、语言、UI状态等全局应用状态
 * TASK-P3-017: 扩展AI状态管理和离线状态管理
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import {
  type AppState as BaseAppState,
  type Notification,
  type AiState,
  type ExtendedOfflineState,
  QueueStatus,
  SyncStatus,
  type AiOperation
} from '@/types/state';

// 基础网络状态类型定义
export interface NetworkState {
  online: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

// 生成唯一ID的工具函数
const generateId = () => Math.random().toString(36).substr(2, 9);

// 🆕 默认AI状态 (TASK-P3-017)
const getDefaultAiState = (): AiState => ({
  cache: {
    l1Size: 0,
    l2Size: 0,
    hitRate: 0,
    totalRequests: 0,
    cacheStrategy: 'lru'
  },
  batch: {
    queueSize: 0,
    processing: false,
    concurrency: 6,
    completedJobs: 0,
    failedJobs: 0,
    averageProcessingTime: 0
  },
  performance: {
    responseTime: 0,
    throughput: 0,
    errorRate: 0,
    systemHealth: 100,
    lastUpdated: Date.now()
  },
  errors: {
    circuitBreakerOpen: false,
    degradedMode: false,
    lastError: null,
    errorCount: 0,
    recoveryTime: null
  }
});

// 🆕 默认离线状态 (TASK-P3-017)
const getDefaultOfflineState = (): ExtendedOfflineState => ({
  isOfflineMode: typeof window !== 'undefined' ? !navigator.onLine : false,
  queueInfo: {
    size: 0,
    status: QueueStatus.IDLE,
    pendingOperations: 0,
    failedOperations: 0,
    lastProcessedAt: null
  },
  sync: {
    status: SyncStatus.IDLE,
    progress: 0,
    lastSyncAt: null,
    nextSyncAt: null,
    autoSyncEnabled: true,
    syncInterval: 60000, // 60秒
    errorMessage: null
  },
  network: {
    online: typeof window !== 'undefined' ? navigator.onLine : true,
    lastOnlineAt: typeof window !== 'undefined' && navigator.onLine ? Date.now() : null
  }
});

// 扩展应用状态接口
export interface AppState extends BaseAppState {
  // 🆕 AI状态管理 (TASK-P3-017)
  ai: AiState;

  // 🆕 离线状态管理 (TASK-P3-017)
  offlineExtended: ExtendedOfflineState;

  // 🆕 AI操作队列 (TASK-P3-017)
  aiOperations: AiOperation[];

  // 网络状态 (简化版)
  network: NetworkState;

  // 开发者模式
  developerMode: boolean;

  // 应用配置
  config: {
    autoSave: boolean;
    autoRefresh: boolean;
    refreshInterval: number; // 毫秒
  };

  // 通知设置
  notificationSettings: {
    desktop: boolean;
    mobile: boolean;
    email: boolean;
  };

  // 扩展Actions
  updateNetworkState: (state: Partial<NetworkState>) => void;
  updateConfig: (config: Partial<AppState['config']>) => void;
  updateNotificationSettings: (settings: Partial<AppState['notificationSettings']>) => void;
  toggleDeveloperMode: () => void;
  initialize: () => void;

  // 添加缺失的方法
  setSidebarCollapsed: (collapsed: boolean) => void;
  updateNotifications: (notifications: Notification[]) => void;
  setMobileNavOpen: (open: boolean) => void;

  // 🆕 AI状态管理方法 (TASK-P3-017)
  updateAiCache: (cache: Partial<AiState['cache']>) => void;
  updateAiBatch: (batch: Partial<AiState['batch']>) => void;
  updateAiPerformance: (performance: Partial<AiState['performance']>) => void;
  updateAiErrors: (errors: Partial<AiState['errors']>) => void;

  // 🆕 离线状态管理方法 (TASK-P3-017)
  setOfflineMode: (isOffline: boolean) => void;
  updateQueueStatus: (status: QueueStatus) => void;
  updateSyncProgress: (progress: number) => void;
  triggerSync: () => Promise<void>;
  pauseSync: () => void;
  resumeSync: () => void;
  clearSyncError: () => void;

  // 🆕 AI操作管理方法 (TASK-P3-017)
  addAiOperation: (operation: Omit<AiOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>) => void;
  updateAiOperation: (id: string, updates: Partial<AiOperation>) => void;
  removeAiOperation: (id: string) => void;
  retryAiOperation: (id: string) => void;
}

/**
 * 应用状态管理Store
 * 使用Zustand + 持久化存储 + devtools
 */
export const useAppStore = create<AppState>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        // 基础状态 (从BaseAppState继承)
        theme: 'light',
        language: 'zh-CN',
        online: typeof window !== 'undefined' ? navigator.onLine : true,
        loading: false,
        sidebarCollapsed: false,
        mobileNavOpen: false,
        error: null,
        notifications: [],

        // 扩展状态
        network: {
          online: typeof window !== 'undefined' ? navigator.onLine : true,
        },
        developerMode: false,
        config: {
          autoSave: true,
          autoRefresh: false,
          refreshInterval: 30000, // 30秒
        },
        notificationSettings: {
          desktop: true,
          mobile: true,
          email: false,
        },
        ai: getDefaultAiState(),
        offlineExtended: getDefaultOfflineState(),
        aiOperations: [],

        // 基础Actions
        setTheme: (theme: 'light' | 'dark') => {
          set({ theme }, false, 'app/setTheme');
          // 应用主题到DOM
          if (typeof window !== 'undefined') {
            document.documentElement.classList.toggle('dark', theme === 'dark');
          }
        },

        setLanguage: (language: 'zh-CN' | 'en-US') => {
          set({ language }, false, 'app/setLanguage');
        },

        setOnline: (online: boolean) => {
          set({ online }, false, 'app/setOnline');
        },

        setLoading: (loading: boolean) => {
          set({ loading }, false, 'app/setLoading');
        },

        setSidebarCollapsed: (collapsed: boolean) => {
          set({ sidebarCollapsed: collapsed }, false, 'app/setSidebarCollapsed');
        },

        toggleSidebar: () => {
          set(
            (state) => ({ sidebarCollapsed: !state.sidebarCollapsed }),
            false,
            'app/toggleSidebar'
          );
        },

        setMobileNavOpen: (open: boolean) => {
          set({ mobileNavOpen: open }, false, 'app/setMobileNavOpen');
        },

        toggleMobileNav: () => {
          const currentState = get();
          const newOpen = !currentState.mobileNavOpen;
          set({ mobileNavOpen: newOpen }, false, 'app/toggleMobileNav');

          // 防背景滚动
          if (typeof window !== 'undefined') {
            document.body.style.overflow = newOpen ? 'hidden' : '';
          }
        },

        setError: (error: string | null) => {
          set({ error }, false, 'app/setError');
        },

        updateNotifications: (notifications: Notification[]) => {
          set({ notifications }, false, 'app/updateNotifications');
        },

        addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => {
          const id = generateId();
          const newNotification: Notification = {
            ...notification,
            id,
            timestamp: Date.now()
          };
          set(state => ({
            notifications: [...state.notifications, newNotification]
          }), false, 'app/addNotification');

          // 自动移除通知（如果设置了duration）
          if (notification.duration && notification.duration > 0) {
            setTimeout(() => {
              get().removeNotification(newNotification.id);
            }, notification.duration);
          }
        },

        removeNotification: (id: string) => {
          set(
            (state) => ({
              notifications: state.notifications.filter((n) => n.id !== id),
            }),
            false,
            'app/removeNotification'
          );
        },

        clearNotifications: () => {
          set({ notifications: [] }, false, 'app/clearNotifications');
        },

        // 网络状态管理
        updateNetworkState: (networkState: Partial<NetworkState>) => {
          set(
            (state) => ({
              network: { ...state.network, ...networkState },
            }),
            false,
            'app/updateNetworkState'
          );
        },

        // 应用配置管理
        updateConfig: (newConfig: Partial<AppState['config']>) => {
          set(
            (state) => ({
              config: { ...state.config, ...newConfig },
            }),
            false,
            'app/updateConfig'
          );
        },

        // 通知设置管理
        updateNotificationSettings: (newSettings: Partial<AppState['notificationSettings']>) => {
          set(
            (state) => ({
              notificationSettings: { ...state.notificationSettings, ...newSettings },
            }),
            false,
            'app/updateNotificationSettings'
          );
        },

        // 开发者模式切换
        toggleDeveloperMode: () => {
          set(
            (state) => ({ developerMode: !state.developerMode }),
            false,
            'app/toggleDeveloperMode'
          );
        },

        // 初始化应用
        initialize: () => {
          if (typeof window !== 'undefined') {
            // 网络状态监听
            const updateOnlineStatus = () => {
              const currentState = get();
              const online = navigator.onLine;

              if (currentState.online !== online) {
                set({ online }, false, 'app/networkChange');

                // 更新网络详细信息（如果支持）
                if ('connection' in navigator && (navigator as any).connection) {
                  const connection = (navigator as any).connection;
                  currentState.updateNetworkState({
                    online,
                    effectiveType: connection.effectiveType,
                    downlink: connection.downlink,
                    rtt: connection.rtt,
                  });
                } else {
                  currentState.updateNetworkState({ online });
                }
              }
            };

            // 绑定网络状态监听
            window.addEventListener('online', updateOnlineStatus);
            window.addEventListener('offline', updateOnlineStatus);

            // 主题初始化
            const currentTheme = get().theme;
            document.documentElement.classList.toggle('dark', currentTheme === 'dark');

            // 移动端导航清理
            document.body.style.overflow = '';

            console.log('应用状态初始化完成');
          }
        },

        // 🆕 AI状态管理方法 (TASK-P3-017)
        updateAiCache: (cache: Partial<AiState['cache']>) => {
          set(
            (state) => ({
              ai: { ...state.ai, cache: { ...state.ai.cache, ...cache } },
            }),
            false,
            'app/updateAiCache'
          );
        },
        updateAiBatch: (batch: Partial<AiState['batch']>) => {
          set(
            (state) => ({
              ai: { ...state.ai, batch: { ...state.ai.batch, ...batch } },
            }),
            false,
            'app/updateAiBatch'
          );
        },
        updateAiPerformance: (performance: Partial<AiState['performance']>) => {
          set(
            (state) => ({
              ai: { ...state.ai, performance: { ...state.ai.performance, ...performance } },
            }),
            false,
            'app/updateAiPerformance'
          );
        },
        updateAiErrors: (errors: Partial<AiState['errors']>) => {
          set(
            (state) => ({
              ai: { ...state.ai, errors: { ...state.ai.errors, ...errors } },
            }),
            false,
            'app/updateAiErrors'
          );
        },

        // 🆕 离线状态管理方法 (TASK-P3-017)
        setOfflineMode: (isOffline: boolean) => {
          set(
            (state) => ({
              offlineExtended: { ...state.offlineExtended, isOfflineMode: isOffline },
            }),
            false,
            'app/setOfflineMode'
          );
        },
        updateQueueStatus: (status: QueueStatus) => {
          set(
            (state) => ({
              offlineExtended: { ...state.offlineExtended, queueInfo: { ...state.offlineExtended.queueInfo, status } },
            }),
            false,
            'app/updateQueueStatus'
          );
        },
        updateSyncProgress: (progress: number) => {
          set(
            (state) => ({
              offlineExtended: { ...state.offlineExtended, sync: { ...state.offlineExtended.sync, progress } },
            }),
            false,
            'app/updateSyncProgress'
          );
        },
                 triggerSync: async () => {
           const state = get();
           if (state.offlineExtended.sync.status === SyncStatus.SYNCING) return;

           set(
             (state) => ({
               offlineExtended: {
                 ...state.offlineExtended,
                 sync: { ...state.offlineExtended.sync, status: SyncStatus.SYNCING, progress: 0 }
               },
             }),
             false,
             'app/triggerSync'
           );

           try {
             // 模拟同步过程
             for (let i = 0; i <= 100; i += 10) {
               await new Promise(resolve => setTimeout(resolve, 100));
               set(
                 (state) => ({
                   offlineExtended: {
                     ...state.offlineExtended,
                     sync: { ...state.offlineExtended.sync, progress: i }
                   },
                 }),
                 false,
                 'app/syncProgress'
               );
             }

             set(
               (state) => ({
                 offlineExtended: {
                   ...state.offlineExtended,
                   sync: {
                     ...state.offlineExtended.sync,
                     status: SyncStatus.SUCCESS,
                     progress: 100,
                     lastSyncAt: Date.now(),
                     errorMessage: null
                   }
                 },
               }),
               false,
               'app/syncSuccess'
             );
           } catch (error) {
             set(
               (state) => ({
                 offlineExtended: {
                   ...state.offlineExtended,
                   sync: {
                     ...state.offlineExtended.sync,
                     status: SyncStatus.ERROR,
                     errorMessage: error instanceof Error ? error.message : 'Sync failed'
                   }
                 },
               }),
               false,
               'app/syncError'
             );
           }
         },
         pauseSync: () => {
           set(
             (state) => ({
               offlineExtended: {
                 ...state.offlineExtended,
                 sync: { ...state.offlineExtended.sync, status: SyncStatus.PAUSED }
               },
             }),
             false,
             'app/pauseSync'
           );
         },
         resumeSync: () => {
           set(
             (state) => ({
               offlineExtended: {
                 ...state.offlineExtended,
                 sync: { ...state.offlineExtended.sync, status: SyncStatus.IDLE }
               },
             }),
             false,
             'app/resumeSync'
           );
         },
         clearSyncError: () => {
           set(
             (state) => ({
               offlineExtended: {
                 ...state.offlineExtended,
                 sync: { ...state.offlineExtended.sync, errorMessage: null, status: SyncStatus.IDLE }
               },
             }),
             false,
             'app/clearSyncError'
           );
         },

                 // 🆕 AI操作管理方法 (TASK-P3-017)
         addAiOperation: (operation: Omit<AiOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>) => {
           const newOperation: AiOperation = {
             ...operation,
             id: generateId(),
             timestamp: Date.now(),
             retryCount: 0,
             status: 'pending'
           };
           set(
             (state) => ({
               aiOperations: [...state.aiOperations, newOperation],
             }),
             false,
             'app/addAiOperation'
           );
         },
         updateAiOperation: (id: string, updates: Partial<AiOperation>) => {
           set(
             (state) => ({
               aiOperations: state.aiOperations.map(op =>
                 op.id === id ? { ...op, ...updates } : op
               ),
             }),
             false,
             'app/updateAiOperation'
           );
         },
         removeAiOperation: (id: string) => {
           set(
             (state) => ({
               aiOperations: state.aiOperations.filter(op => op.id !== id),
             }),
             false,
             'app/removeAiOperation'
           );
         },
         retryAiOperation: (id: string) => {
           set(
             (state) => ({
               aiOperations: state.aiOperations.map(op =>
                 op.id === id ? { ...op, retryCount: op.retryCount + 1, status: 'pending' } : op
               ),
             }),
             false,
             'app/retryAiOperation'
           );
         },
      })),
      {
        name: 'app-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          theme: state.theme,
          language: state.language,
          sidebarCollapsed: state.sidebarCollapsed,
          config: state.config,
          notificationSettings: state.notificationSettings,
          developerMode: state.developerMode,
          ai: state.ai,
          offlineExtended: state.offlineExtended,
          aiOperations: state.aiOperations,
        }),
      }
    ),
    {
      name: 'app-store',
    }
  )
);

// 状态选择器 - 优化性能，避免不必要的重渲染
export const appSelectors = {
  theme: (state: AppState) => state.theme,
  language: (state: AppState) => state.language,
  online: (state: AppState) => state.online,
  loading: (state: AppState) => state.loading,
  sidebarCollapsed: (state: AppState) => state.sidebarCollapsed,
  mobileNavOpen: (state: AppState) => state.mobileNavOpen,
  error: (state: AppState) => state.error,
  notifications: (state: AppState) => state.notifications,
  network: (state: AppState) => state.network,
  config: (state: AppState) => state.config,
  notificationSettings: (state: AppState) => state.notificationSettings,
  developerMode: (state: AppState) => state.developerMode,
  ai: (state: AppState) => state.ai,
  offlineExtended: (state: AppState) => state.offlineExtended,
  aiOperations: (state: AppState) => state.aiOperations,
};

// 便捷hooks
export const useTheme = () => useAppStore(appSelectors.theme);
export const useLanguage = () => useAppStore(appSelectors.language);
export const useOnlineStatus = () => useAppStore(appSelectors.online);
export const useGlobalLoading = () => useAppStore(appSelectors.loading);
export const useNotifications = () => useAppStore(appSelectors.notifications);

// 组合hooks - 返回多个相关状态
export const useAppTheme = () => useAppStore((state) => state.theme);
export const useAppLanguage = () => useAppStore((state) => state.language);
export const useAppLoading = () => useAppStore((state) => state.loading);
export const useAppSidebar = () => useAppStore((state) => ({
  collapsed: state.sidebarCollapsed,
  toggle: state.toggleSidebar,
  setCollapsed: state.setSidebarCollapsed,
}));

export const useAppNetwork = () => useAppStore((state) => ({
  online: state.online,
  network: state.network,
}));

export const useAppConfig = () => useAppStore((state) => ({
  config: state.config,
  updateConfig: state.updateConfig,
}));

export const useAppNotifications = () => useAppStore((state) => ({
  notifications: state.notifications,
  add: state.addNotification,
  remove: state.removeNotification,
  clear: state.clearNotifications,
}));

export const useAppDeveloperMode = () => useAppStore((state) => ({
  enabled: state.developerMode,
  toggle: state.toggleDeveloperMode,
}));

export const useAppAi = () => useAppStore((state) => ({
  ai: state.ai,
  updateAiCache: state.updateAiCache,
  updateAiBatch: state.updateAiBatch,
  updateAiPerformance: state.updateAiPerformance,
  updateAiErrors: state.updateAiErrors,
}));

export const useAppOffline = () => useAppStore((state) => ({
  offlineExtended: state.offlineExtended,
  setOfflineMode: state.setOfflineMode,
  updateQueueStatus: state.updateQueueStatus,
  updateSyncProgress: state.updateSyncProgress,
  triggerSync: state.triggerSync,
  pauseSync: state.pauseSync,
  resumeSync: state.resumeSync,
  clearSyncError: state.clearSyncError,
}));

export const useAppAiOperations = () => useAppStore((state) => ({
  aiOperations: state.aiOperations,
  addAiOperation: state.addAiOperation,
  updateAiOperation: state.updateAiOperation,
  removeAiOperation: state.removeAiOperation,
  retryAiOperation: state.retryAiOperation,
}));
