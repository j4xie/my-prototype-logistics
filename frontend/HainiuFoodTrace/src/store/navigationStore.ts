import { create } from 'zustand';
import { User } from '../types/auth';
import { getUserRole } from '../utils/roleMapping';
import { usePermissionStore } from './permissionStore';

export interface TabConfig {
  name: string;
  title: string;
  icon: string;
  component: string;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requiredModules?: string[];
}

export interface NavigationState {
  // 状态
  currentTab: string;
  availableTabs: TabConfig[];
  isTabBarVisible: boolean;
  navigationHistory: string[];
  
  // Actions
  setCurrentTab: (tab: string) => void;
  updateAvailableTabs: (user: User | null) => void;
  setTabBarVisible: (visible: boolean) => void;
  pushToHistory: (screen: string) => void;
  clearHistory: () => void;
  
  // Getters
  getTabByName: (name: string) => TabConfig | null;
  canAccessTab: (tabName: string, userRole: string | null) => boolean;
}

// 定义所有可能的Tab配置
const ALL_TABS: TabConfig[] = [
  // 基础Tab - 所有用户都可以看到
  {
    name: 'home',
    title: '首页',
    icon: 'home',
    component: 'HomeScreen',
  },
  
  // 业务模块Tab
  {
    name: 'farming',
    title: '种植',
    icon: 'leaf',
    component: 'FarmingScreen',
    requiredModules: ['farming_access'],
  },
  {
    name: 'processing',
    title: '加工',
    icon: 'cog',
    component: 'ProcessingScreen',
    requiredModules: ['processing_access'],
  },
  {
    name: 'logistics',
    title: '物流',
    icon: 'car',
    component: 'LogisticsScreen',
    requiredModules: ['logistics_access'],
  },
  {
    name: 'trace',
    title: '溯源',
    icon: 'search',
    component: 'TraceScreen',
    requiredModules: ['trace_access'],
  },
  
  // 高级功能Tab
  {
    name: 'alerts',
    title: '告警',
    icon: 'warning',
    component: 'AlertScreen',
    requiredModules: ['alerts_access'],
    requiredPermissions: ['alerts:view'],
  },
  {
    name: 'reports',
    title: '报表',
    icon: 'bar-chart',
    component: 'ReportScreen',
    requiredModules: ['reports_access'],
    requiredPermissions: ['reports:view'],
  },
  {
    name: 'system',
    title: '监控',
    icon: 'pulse',
    component: 'SystemScreen',
    requiredModules: ['system_access'],
    requiredPermissions: ['system:view'],
  },

  // 管理Tab
  {
    name: 'admin',
    title: '管理',
    icon: 'settings',
    component: 'AdminScreen',
    requiredModules: ['admin_access'],
  },
  {
    name: 'platform',
    title: '平台',
    icon: 'server',
    component: 'PlatformScreen',
    requiredModules: ['platform_access'],
  },
  
  // 开发者Tab
  {
    name: 'developer',
    title: '开发',
    icon: 'code-slash',
    component: 'DeveloperScreen',
    requiredRoles: ['system_developer'],
  },
];

export const useNavigationStore = create<NavigationState>((set, get) => ({
  // 初始状态
  currentTab: 'home',
  availableTabs: [ALL_TABS[0]], // 默认只有首页
  isTabBarVisible: true,
  navigationHistory: [],

  // Actions
  setCurrentTab: (tab) =>
    set({ currentTab: tab }),

  updateAvailableTabs: (user) => {
    if (!user) {
      // 未登录用户只能看到首页
      set({ 
        availableTabs: [ALL_TABS[0]],
        currentTab: 'home'
      });
      return;
    }

    const userRole = getUserRole(user);
    const availableTabs: TabConfig[] = [];

    // 检查每个Tab是否可访问
    ALL_TABS.forEach(tab => {
      if (get().canAccessTab(tab.name, userRole)) {
        availableTabs.push(tab);
      }
    });

    // 如果当前Tab不可访问，切换到首页
    const currentTabAvailable = availableTabs.some(tab => tab.name === get().currentTab);
    const newCurrentTab = currentTabAvailable ? get().currentTab : 'home';

    set({ 
      availableTabs,
      currentTab: newCurrentTab
    });
  },

  setTabBarVisible: (isTabBarVisible) =>
    set({ isTabBarVisible }),

  pushToHistory: (screen) =>
    set((state) => ({
      navigationHistory: [...state.navigationHistory, screen].slice(-10), // 保留最近10个记录
    })),

  clearHistory: () =>
    set({ navigationHistory: [] }),

  // Getters
  getTabByName: (name) => {
    const { availableTabs } = get();
    return availableTabs.find(tab => tab.name === name) || null;
  },

  canAccessTab: (tabName, userRole) => {
    const tab = ALL_TABS.find(t => t.name === tabName);
    if (!tab) return false;

    // 首页所有人都可以访问
    if (tabName === 'home') return true;

    // 如果没有用户角色，只能访问首页
    if (!userRole) return false;

    // 检查角色要求
    if (tab.requiredRoles && !tab.requiredRoles.includes(userRole)) {
      return false;
    }

    // 集成权限store进行权限检查
    const permissionStore = usePermissionStore.getState();
    
    // 检查权限要求
    if (tab.requiredPermissions) {
      const hasAllPermissions = tab.requiredPermissions.every(permission => 
        permissionStore.hasPermission(permission)
      );
      if (!hasAllPermissions) return false;
    }

    // 检查模块要求
    if (tab.requiredModules) {
      const hasAllModules = tab.requiredModules.every(module => 
        permissionStore.hasModuleAccess(module)
      );
      if (!hasAllModules) return false;
    }

    return true;
  },
}));