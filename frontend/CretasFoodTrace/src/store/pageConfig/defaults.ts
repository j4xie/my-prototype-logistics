/**
 * Default configurations and factory functions
 */

import type {
  PageThemeConfig,
  LayoutConfig,
  PageConfig,
  PageModule,
} from './types';
import { PageType } from './types';

// ============================================
// Default Configs
// ============================================

export const DEFAULT_THEME_CONFIG: PageThemeConfig = {
  primaryColor: '#1890ff',
  backgroundColor: '#ffffff',
  textColor: '#333333',
  accentColor: '#52c41a',
  borderRadius: 8,
};

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  modules: [],
  gridColumns: 2,
  gridGap: 12,
  padding: 16,
};

// ============================================
// Factory Functions
// ============================================

/**
 * 创建默认页面配置
 */
export function createDefaultPageConfig(
  pageId: string,
  factoryId: string,
  pageType: PageType
): PageConfig {
  return {
    pageId,
    factoryId,
    pageType,
    layoutConfig: { ...DEFAULT_LAYOUT_CONFIG },
    themeConfig: { ...DEFAULT_THEME_CONFIG },
    dataBindings: [],
    status: 'draft',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * 深拷贝模块数组
 */
export function cloneModules(modules: PageModule[]): PageModule[] {
  return modules.map((m) => ({
    ...m,
    position: { ...m.position },
    size: { ...m.size },
    props: { ...m.props },
  }));
}

/**
 * 生成唯一模块ID
 */
export function generateModuleId(): string {
  return `module_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
