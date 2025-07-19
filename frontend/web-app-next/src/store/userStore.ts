/**
 * 用户偏好状态管理
 * 管理用户的个性化设置：主题、语言、界面配置等
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import type { UserPreferencesState } from '@/types/state';

/**
 * 默认用户偏好设置
 */
const defaultUserPreferences = {
  // 主题设置
  theme: 'light' as const,
  fontSize: 'medium' as const,
  colorScheme: 'blue' as const,
  
  // 语言设置
  language: 'zh-CN' as const,
  timezone: 'Asia/Shanghai',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: '24h' as const,
  
  // 界面设置
  sidebarCollapsed: false,
  sidebarPosition: 'left' as const,
  showNotifications: true,
  soundEnabled: true,
  animationsEnabled: true,
  
  // 数据设置
  itemsPerPage: 20,
      autoRefresh: true,
  autoRefreshInterval: 30000, // 30秒
  
  // 农业管理偏好
  defaultCropView: 'grid' as const,
  showWeatherWidget: true,
  temperatureUnit: 'celsius' as const,
  
  // 溯源查询偏好
  maxSearchHistory: 50,
  autoSaveSearch: true,
  showSearchSuggestions: true,
  
  // 仪表板偏好
  dashboardLayout: 'standard' as const,
  favoriteCharts: [] as string[],
  widgetOrder: [] as string[],
  
  // 数据导出偏好
  exportFormat: 'excel' as const,
  includeImages: true,
  compressFiles: false,
  
  // 其他设置
  showTooltips: true,
  keyboardShortcuts: true,
  betaFeatures: false,
};

/**
 * 用户偏好状态管理
 */
export const useUserStore = create<UserPreferencesState>()(
  devtools(
    persist(
      (set, get) => ({
        ...defaultUserPreferences,

        // 主题管理
        setTheme: (theme) => {
          set({ theme }, false, 'user/setTheme');
          
          // 更新HTML根元素的类名以应用主题
          if (typeof document !== 'undefined') {
            document.documentElement.classList.remove('light', 'dark');
            document.documentElement.classList.add(theme);
          }
        },

        setFontSize: (fontSize) => {
          set({ fontSize }, false, 'user/setFontSize');
          
          // 更新HTML根元素的字体大小类名
          if (typeof document !== 'undefined') {
            document.documentElement.classList.remove('text-sm', 'text-base', 'text-lg');
            const sizeMap = {
              small: 'text-sm',
              medium: 'text-base',
              large: 'text-lg'
            };
            document.documentElement.classList.add(sizeMap[fontSize]);
          }
        },

        setColorScheme: (colorScheme) => {
          set({ colorScheme }, false, 'user/setColorScheme');
        },

        // 语言管理
        setLanguage: (language) => {
          set({ language }, false, 'user/setLanguage');
          
          // 更新HTML lang属性
          if (typeof document !== 'undefined') {
            document.documentElement.lang = language === 'zh-CN' ? 'zh' : 'en';
          }
        },

        setTimezone: (timezone) => {
          set({ timezone }, false, 'user/setTimezone');
        },

        setDateFormat: (dateFormat) => {
          set({ dateFormat }, false, 'user/setDateFormat');
        },

        setTimeFormat: (timeFormat) => {
          set({ timeFormat }, false, 'user/setTimeFormat');
        },

        // 界面设置
        setSidebarCollapsed: (collapsed) => {
          set({ sidebarCollapsed: collapsed }, false, 'user/setSidebarCollapsed');
        },

        toggleSidebar: () => {
          const { sidebarCollapsed } = get();
          set({ sidebarCollapsed: !sidebarCollapsed }, false, 'user/toggleSidebar');
        },

        setSidebarPosition: (position) => {
          set({ sidebarPosition: position }, false, 'user/setSidebarPosition');
        },

        setShowNotifications: (show) => {
          set({ showNotifications: show }, false, 'user/setShowNotifications');
        },

        setSoundEnabled: (enabled) => {
          set({ soundEnabled: enabled }, false, 'user/setSoundEnabled');
        },

        setAnimationsEnabled: (enabled) => {
          set({ animationsEnabled: enabled }, false, 'user/setAnimationsEnabled');
        },

        // 数据设置
        setItemsPerPage: (count) => {
          set({ itemsPerPage: count }, false, 'user/setItemsPerPage');
        },

        setAutoRefresh: (enabled) => {
          set({ autoRefresh: enabled }, false, 'user/setAutoRefresh');
        },

        setAutoRefreshInterval: (interval) => {
          set({ autoRefreshInterval: interval }, false, 'user/setAutoRefreshInterval');
        },

        // 农业管理偏好
        setDefaultCropView: (view) => {
          set({ defaultCropView: view }, false, 'user/setDefaultCropView');
        },

        setShowWeatherWidget: (show) => {
          set({ showWeatherWidget: show }, false, 'user/setShowWeatherWidget');
        },

        setTemperatureUnit: (unit) => {
          set({ temperatureUnit: unit }, false, 'user/setTemperatureUnit');
        },

        // 溯源查询偏好
        setMaxSearchHistory: (max) => {
          set({ maxSearchHistory: max }, false, 'user/setMaxSearchHistory');
        },

        setAutoSaveSearch: (enabled) => {
          set({ autoSaveSearch: enabled }, false, 'user/setAutoSaveSearch');
        },

        setShowSearchSuggestions: (show) => {
          set({ showSearchSuggestions: show }, false, 'user/setShowSearchSuggestions');
        },

        // 仪表板偏好
        setDashboardLayout: (layout) => {
          set({ dashboardLayout: layout }, false, 'user/setDashboardLayout');
        },

        setFavoriteCharts: (charts) => {
          set({ favoriteCharts: charts }, false, 'user/setFavoriteCharts');
        },

        addFavoriteChart: (chartId) => {
          const { favoriteCharts } = get();
          if (!favoriteCharts.includes(chartId)) {
            set({ 
              favoriteCharts: [...favoriteCharts, chartId] 
            }, false, 'user/addFavoriteChart');
          }
        },

        removeFavoriteChart: (chartId) => {
          const { favoriteCharts } = get();
          set({ 
            favoriteCharts: favoriteCharts.filter(id => id !== chartId) 
          }, false, 'user/removeFavoriteChart');
        },

        setWidgetOrder: (order) => {
          set({ widgetOrder: order }, false, 'user/setWidgetOrder');
        },

        // 数据导出偏好
        setExportFormat: (format) => {
          set({ exportFormat: format }, false, 'user/setExportFormat');
        },

        setIncludeImages: (include) => {
          set({ includeImages: include }, false, 'user/setIncludeImages');
        },

        setCompressFiles: (compress) => {
          set({ compressFiles: compress }, false, 'user/setCompressFiles');
        },

        // 其他设置
        setShowTooltips: (show) => {
          set({ showTooltips: show }, false, 'user/setShowTooltips');
        },

        setKeyboardShortcuts: (enabled) => {
          set({ keyboardShortcuts: enabled }, false, 'user/setKeyboardShortcuts');
        },

        setBetaFeatures: (enabled) => {
          set({ betaFeatures: enabled }, false, 'user/setBetaFeatures');
        },

        // 批量更新设置
        updatePreferences: (preferences) => {
          set({ ...preferences }, false, 'user/updatePreferences');
        },

        // 重置为默认设置
        resetToDefaults: () => {
          set(defaultUserPreferences, false, 'user/resetToDefaults');
          
          // 重新应用主题设置
          if (typeof document !== 'undefined') {
            document.documentElement.classList.remove('light', 'dark');
            document.documentElement.classList.add(defaultUserPreferences.theme);
            
            document.documentElement.classList.remove('text-sm', 'text-base', 'text-lg');
            document.documentElement.classList.add('text-base');
            
            document.documentElement.lang = 'zh';
          }
        },

        // 导入用户设置
        importPreferences: (preferences) => {
          try {
            // 验证导入的设置格式
            const validatedPreferences = { ...defaultUserPreferences, ...preferences };
            set(validatedPreferences, false, 'user/importPreferences');
            
            console.log('✅ 用户偏好设置导入成功');
            return true;
          } catch (error) {
            console.error('❌ 用户偏好设置导入失败:', error);
            return false;
          }
        },

        // 导出用户设置
        exportPreferences: () => {
          const state = get();
          const exportData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            preferences: {
              theme: state.theme,
              fontSize: state.fontSize,
              colorScheme: state.colorScheme,
              language: state.language,
              timezone: state.timezone,
              dateFormat: state.dateFormat,
              timeFormat: state.timeFormat,
              sidebarCollapsed: state.sidebarCollapsed,
              sidebarPosition: state.sidebarPosition,
              showNotifications: state.showNotifications,
              soundEnabled: state.soundEnabled,
              animationsEnabled: state.animationsEnabled,
              itemsPerPage: state.itemsPerPage,
              autoRefresh: state.autoRefresh,
              autoRefreshInterval: state.autoRefreshInterval,
              defaultCropView: state.defaultCropView,
              showWeatherWidget: state.showWeatherWidget,
              temperatureUnit: state.temperatureUnit,
              maxSearchHistory: state.maxSearchHistory,
              autoSaveSearch: state.autoSaveSearch,
              showSearchSuggestions: state.showSearchSuggestions,
              dashboardLayout: state.dashboardLayout,
              favoriteCharts: state.favoriteCharts,
              widgetOrder: state.widgetOrder,
              exportFormat: state.exportFormat,
              includeImages: state.includeImages,
              compressFiles: state.compressFiles,
              showTooltips: state.showTooltips,
              keyboardShortcuts: state.keyboardShortcuts,
              betaFeatures: state.betaFeatures,
            },
          };
          
          return exportData;
        },
      }),
      {
        name: 'user-preferences',
        // 选择性持久化，排除不需要持久化的状态
        partialize: (state) => ({
          theme: state.theme,
          fontSize: state.fontSize,
          colorScheme: state.colorScheme,
          language: state.language,
          timezone: state.timezone,
          dateFormat: state.dateFormat,
          timeFormat: state.timeFormat,
          sidebarCollapsed: state.sidebarCollapsed,
          sidebarPosition: state.sidebarPosition,
          showNotifications: state.showNotifications,
          soundEnabled: state.soundEnabled,
          animationsEnabled: state.animationsEnabled,
          itemsPerPage: state.itemsPerPage,
          autoRefresh: state.autoRefresh,
          autoRefreshInterval: state.autoRefreshInterval,
          defaultCropView: state.defaultCropView,
          showWeatherWidget: state.showWeatherWidget,
          temperatureUnit: state.temperatureUnit,
          maxSearchHistory: state.maxSearchHistory,
          autoSaveSearch: state.autoSaveSearch,
          showSearchSuggestions: state.showSearchSuggestions,
          dashboardLayout: state.dashboardLayout,
          favoriteCharts: state.favoriteCharts,
          widgetOrder: state.widgetOrder,
          exportFormat: state.exportFormat,
          includeImages: state.includeImages,
          compressFiles: state.compressFiles,
          showTooltips: state.showTooltips,
          keyboardShortcuts: state.keyboardShortcuts,
          betaFeatures: state.betaFeatures,
        }),
      }
    ),
    { name: 'UserStore' }
  )
);

/**
 * 选择器Hook - 主题相关
 */
export const useTheme = () => useUserStore((state) => state.theme);
export const useFontSize = () => useUserStore((state) => state.fontSize);
export const useColorScheme = () => useUserStore((state) => state.colorScheme);

/**
 * 选择器Hook - 语言相关
 */
export const useLanguage = () => useUserStore((state) => state.language);
export const useTimezone = () => useUserStore((state) => state.timezone);
export const useDateFormat = () => useUserStore((state) => state.dateFormat);
export const useTimeFormat = () => useUserStore((state) => state.timeFormat);

/**
 * 选择器Hook - 界面设置
 */
export const useSidebarCollapsed = () => useUserStore((state) => state.sidebarCollapsed);
export const useSidebarPosition = () => useUserStore((state) => state.sidebarPosition);
export const useNotifications = () => useUserStore((state) => state.showNotifications);
export const useSoundEnabled = () => useUserStore((state) => state.soundEnabled);
export const useAnimationsEnabled = () => useUserStore((state) => state.animationsEnabled);

/**
 * 选择器Hook - 数据设置
 */
export const useItemsPerPage = () => useUserStore((state) => state.itemsPerPage);
export const useAutoRefresh = () => useUserStore((state) => state.autoRefresh);
export const useAutoRefreshInterval = () => useUserStore((state) => state.autoRefreshInterval);

/**
 * 选择器Hook - 仪表板设置
 */
export const useDashboardLayout = () => useUserStore((state) => state.dashboardLayout);
export const useFavoriteCharts = () => useUserStore((state) => state.favoriteCharts);
export const useWidgetOrder = () => useUserStore((state) => state.widgetOrder);

/**
 * 初始化用户偏好设置
 * 在应用启动时调用，确保主题等设置正确应用
 */
export const initializeUserPreferences = () => {
  if (typeof window === 'undefined') return;
  
  const state = useUserStore.getState();
  
  // 应用主题
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(state.theme);
  
  // 应用字体大小
  document.documentElement.classList.remove('text-sm', 'text-base', 'text-lg');
  const sizeMap = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg'
  };
  document.documentElement.classList.add(sizeMap[state.fontSize]);
  
  // 应用语言设置
  document.documentElement.lang = state.language === 'zh-CN' ? 'zh' : 'en';
  
  console.log('✅ 用户偏好设置初始化完成');
}; 