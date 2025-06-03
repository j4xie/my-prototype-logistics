/**
 * 全局应用状态管理
 * 使用Zustand管理主题、语言、UI状态等全局应用状态
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import { type AppState as BaseAppState, type Notification } from '@/types/state';

// 基础网络状态类型定义
export interface NetworkState {
  online: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

// 生成唯一ID的工具函数
const generateId = () => Math.random().toString(36).substr(2, 9);

// 扩展应用状态接口
export interface AppState extends BaseAppState {
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