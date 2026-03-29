/**
 * Backward-compatible re-export from the slice-based decomposition.
 * All logic now lives in ./pageConfig/ slices.
 */

// Store & hooks
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
  usePageAIActions,
  default,
} from './pageConfig';

// Enum
export { PageType } from './pageConfig';

// Types
export type {
  PageConfigState,
  PageConfigStatus,
  ModulePosition,
  ModuleSize,
  PageModule,
  PageThemeConfig,
  DataBinding,
  LayoutConfig,
  PageConfig,
  AISuggestedAction,
  AIOperationResult,
} from './pageConfig';

// Defaults & factories
export {
  DEFAULT_THEME_CONFIG,
  DEFAULT_LAYOUT_CONFIG,
  createDefaultPageConfig,
} from './pageConfig';
