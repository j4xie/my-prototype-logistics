// Store entry point
export { useAuthStore } from './authStore';

// Home layout store - 首页布局状态管理
export {
  useHomeLayoutStore,
  useCurrentLayout,
  useVisibleModules,
  useLayoutEditState,
  useLayoutTheme,
  useUndoRedo,
  useModuleActions,
  useLayoutActions,
} from './homeLayoutStore';

// Role theme store - 角色主题状态管理
export {
  useRoleThemeStore,
  useThemedColors,
  usePrimaryColor,
  useRoleThemeLoading,
  useComponentPermissions,
  useWelcomeInfo,
  useEffectiveColor,
  DEFAULT_ROLE_COLORS,
  DEFAULT_THEME,
} from './roleThemeStore';

// Role theme types
export type {
  RoleCode,
  RoleTheme,
  ComponentPermission,
  ThemeColors,
  PermissionLevel,
} from './roleThemeStore';

// Page config store - 通用页面配置状态管理 (Phase 3)
export {
  usePageConfigStore,
  useActivePageConfig,
  usePageModules,
  useVisiblePageModules,
  usePageEditState,
  usePageTheme,
  usePageUndoRedo,
  usePageModuleActions,
  usePageConfigActions,
  // Types
  PageType,
  DEFAULT_THEME_CONFIG as PAGE_DEFAULT_THEME_CONFIG,
  DEFAULT_LAYOUT_CONFIG as PAGE_DEFAULT_LAYOUT_CONFIG,
  createDefaultPageConfig,
} from './pageConfigStore';

// Page config types
export type {
  PageConfig,
  PageModule,
  PageThemeConfig,
  PageConfigStatus,
  ModulePosition,
  ModuleSize,
  LayoutConfig,
  DataBinding,
} from './pageConfigStore';