/**
 * 角色主题状态管理
 * Role Theme State Management (Zustand)
 *
 * 管理多角色主题系统，包括角色特定主题颜色和组件权限
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../services/api/apiClient';

// ============================================
// 类型定义
// ============================================

/**
 * 角色代码类型
 */
export type RoleCode =
  | 'factory_super_admin'
  | 'hr_admin'
  | 'dispatcher'
  | 'production_manager'
  | 'warehouse_manager'
  | 'quality_manager'
  | 'workshop_supervisor'
  | 'quality_inspector'
  | 'operator'
  | 'warehouse_worker'
  | 'viewer';

/**
 * 权限级别
 */
export type PermissionLevel = 'view' | 'edit' | 'none';

/**
 * 角色主题配置
 */
export interface RoleTheme {
  roleCode: RoleCode;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
  logoUrl?: string;
  welcomeText?: string;
}

/**
 * 组件权限配置
 */
export interface ComponentPermission {
  componentType: string;
  permissionLevel: PermissionLevel;
}

/**
 * 主题颜色集合
 */
export interface ThemeColors {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
}

/**
 * API响应类型
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

// ============================================
// 默认配置
// ============================================

/**
 * 角色默认主色调
 */
export const DEFAULT_ROLE_COLORS: Record<RoleCode, string> = {
  factory_super_admin: '#1890FF',
  hr_admin: '#722ED1',
  dispatcher: '#13C2C2',
  production_manager: '#52C41A',
  warehouse_manager: '#FA8C16',
  quality_manager: '#EB2F96',
  workshop_supervisor: '#2F54EB',
  quality_inspector: '#F5222D',
  operator: '#1890FF',
  warehouse_worker: '#FA8C16',
  viewer: '#8C8C8C',
};

/**
 * 系统默认主题
 */
export const DEFAULT_THEME: RoleTheme = {
  roleCode: 'viewer',
  primaryColor: '#1890FF',
  secondaryColor: '#69C0FF',
  accentColor: '#40A9FF',
  backgroundColor: '#F5F5F5',
  surfaceColor: '#FFFFFF',
  textColor: '#262626',
  successColor: '#52C41A',
  warningColor: '#FAAD14',
  errorColor: '#FF4D4F',
  welcomeText: '欢迎使用白垩纪食品溯源系统',
};

/**
 * 基于角色代码生成默认主题
 */
function createDefaultThemeForRole(roleCode: RoleCode): RoleTheme {
  const primaryColor = DEFAULT_ROLE_COLORS[roleCode] || DEFAULT_THEME.primaryColor;

  return {
    ...DEFAULT_THEME,
    roleCode,
    primaryColor,
    // 根据主色生成次要色（稍微变亮）
    secondaryColor: lightenColor(primaryColor, 0.2),
    accentColor: lightenColor(primaryColor, 0.1),
  };
}

/**
 * 颜色变亮工具函数
 */
function lightenColor(hex: string, percent: number): string {
  // 移除 # 前缀
  const color = hex.replace('#', '');

  // 解析 RGB
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);

  // 变亮
  const newR = Math.min(255, Math.round(r + (255 - r) * percent));
  const newG = Math.min(255, Math.round(g + (255 - g) * percent));
  const newB = Math.min(255, Math.round(b + (255 - b) * percent));

  // 返回新颜色
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`.toUpperCase();
}

// ============================================
// Store 类型定义
// ============================================

interface RoleThemeState {
  // 状态
  currentTheme: RoleTheme | null;
  defaultTheme: RoleTheme;
  availableComponents: ComponentPermission[];
  isLoading: boolean;
  error: string | null;

  // Actions - 主题加载
  loadTheme: (roleCode: RoleCode, factoryId: string) => Promise<void>;
  setTheme: (theme: RoleTheme) => void;
  resetTheme: () => void;

  // Actions - 颜色获取
  getEffectiveColor: (colorKey: keyof ThemeColors) => string;
  getThemedColors: () => ThemeColors;

  // Actions - 组件权限
  canUseComponent: (componentType: string) => boolean;
  canEditComponent: (componentType: string) => boolean;
  setComponentPermissions: (permissions: ComponentPermission[]) => void;

  // Getters
  getCurrentRoleCode: () => RoleCode | null;
  getPrimaryColor: () => string;
  getWelcomeText: () => string;
  getLogoUrl: () => string | undefined;
}

// ============================================
// Store 实现
// ============================================

export const useRoleThemeStore = create<RoleThemeState>()(
  persist(
    (set, get) => ({
      // 初始状态
      currentTheme: null,
      defaultTheme: DEFAULT_THEME,
      availableComponents: [],
      isLoading: false,
      error: null,

      // ==========================================
      // 主题加载
      // ==========================================

      loadTheme: async (roleCode, factoryId) => {
        set({ isLoading: true, error: null });

        try {
          // 尝试从API获取角色主题配置
          const response = await apiClient.get<ApiResponse<{
            theme: RoleTheme;
            permissions: ComponentPermission[];
          }>>(`/api/mobile/${factoryId}/role-theme/${roleCode}`);

          if (response.success && response.data) {
            set({
              currentTheme: response.data.theme,
              availableComponents: response.data.permissions || [],
              isLoading: false,
            });
          } else {
            // API返回失败，使用默认主题
            const defaultRoleTheme = createDefaultThemeForRole(roleCode);
            set({
              currentTheme: defaultRoleTheme,
              availableComponents: [],
              isLoading: false,
            });
          }
        } catch (error) {
          // API调用失败，回退到基于角色的默认主题
          console.warn('[RoleThemeStore] API调用失败，使用默认主题:', error);
          const defaultRoleTheme = createDefaultThemeForRole(roleCode);
          set({
            currentTheme: defaultRoleTheme,
            availableComponents: [],
            isLoading: false,
            error: null, // 静默处理，不显示错误
          });
        }
      },

      setTheme: (theme) => {
        set({ currentTheme: theme, error: null });
      },

      resetTheme: () => {
        set({
          currentTheme: null,
          availableComponents: [],
          error: null,
        });
      },

      // ==========================================
      // 颜色获取
      // ==========================================

      getEffectiveColor: (colorKey) => {
        const { currentTheme, defaultTheme } = get();
        const theme = currentTheme || defaultTheme;
        return theme[colorKey] || defaultTheme[colorKey];
      },

      getThemedColors: () => {
        const { currentTheme, defaultTheme } = get();
        const theme = currentTheme || defaultTheme;

        return {
          primaryColor: theme.primaryColor || defaultTheme.primaryColor,
          secondaryColor: theme.secondaryColor || defaultTheme.secondaryColor,
          accentColor: theme.accentColor || defaultTheme.accentColor,
          backgroundColor: theme.backgroundColor || defaultTheme.backgroundColor,
          surfaceColor: theme.surfaceColor || defaultTheme.surfaceColor,
          textColor: theme.textColor || defaultTheme.textColor,
          successColor: theme.successColor || defaultTheme.successColor,
          warningColor: theme.warningColor || defaultTheme.warningColor,
          errorColor: theme.errorColor || defaultTheme.errorColor,
        };
      },

      // ==========================================
      // 组件权限
      // ==========================================

      canUseComponent: (componentType) => {
        const { availableComponents } = get();

        // 如果没有权限配置，默认允许查看
        if (availableComponents.length === 0) {
          return true;
        }

        const permission = availableComponents.find(
          (p) => p.componentType === componentType
        );

        // 如果找到权限配置，检查是否不是 'none'
        if (permission) {
          return permission.permissionLevel !== 'none';
        }

        // 未配置的组件默认允许查看
        return true;
      },

      canEditComponent: (componentType) => {
        const { availableComponents } = get();

        // 如果没有权限配置，默认不允许编辑
        if (availableComponents.length === 0) {
          return false;
        }

        const permission = availableComponents.find(
          (p) => p.componentType === componentType
        );

        // 只有明确配置为 'edit' 才允许编辑
        return permission?.permissionLevel === 'edit';
      },

      setComponentPermissions: (permissions) => {
        set({ availableComponents: permissions });
      },

      // ==========================================
      // Getters
      // ==========================================

      getCurrentRoleCode: () => {
        const { currentTheme } = get();
        return currentTheme?.roleCode || null;
      },

      getPrimaryColor: () => {
        const { currentTheme, defaultTheme } = get();
        return currentTheme?.primaryColor || defaultTheme.primaryColor;
      },

      getWelcomeText: () => {
        const { currentTheme, defaultTheme } = get();
        return currentTheme?.welcomeText || defaultTheme.welcomeText || '';
      },

      getLogoUrl: () => {
        const { currentTheme } = get();
        return currentTheme?.logoUrl;
      },
    }),
    {
      name: 'role-theme-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // 只持久化主题配置和权限
      partialize: (state) => ({
        currentTheme: state.currentTheme,
        availableComponents: state.availableComponents,
      }),
    }
  )
);

// ============================================
// 便捷 hooks
// ============================================

/**
 * 获取当前主题颜色
 */
export const useThemedColors = () =>
  useRoleThemeStore((state) => state.getThemedColors());

/**
 * 获取主色调
 */
export const usePrimaryColor = () =>
  useRoleThemeStore((state) => state.getPrimaryColor());

/**
 * 获取加载状态
 */
export const useRoleThemeLoading = () =>
  useRoleThemeStore((state) => ({
    isLoading: state.isLoading,
    error: state.error,
  }));

/**
 * 获取组件权限检查方法
 */
export const useComponentPermissions = () =>
  useRoleThemeStore((state) => ({
    canUseComponent: state.canUseComponent,
    canEditComponent: state.canEditComponent,
  }));

/**
 * 获取欢迎信息
 */
export const useWelcomeInfo = () =>
  useRoleThemeStore((state) => ({
    welcomeText: state.getWelcomeText(),
    logoUrl: state.getLogoUrl(),
    roleCode: state.getCurrentRoleCode(),
  }));

/**
 * 获取特定颜色
 */
export const useEffectiveColor = (colorKey: keyof ThemeColors) =>
  useRoleThemeStore((state) => state.getEffectiveColor(colorKey));

export default useRoleThemeStore;
