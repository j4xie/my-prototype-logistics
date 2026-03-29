/**
 * Page Configuration Types
 * Single source of truth for all pageConfig type definitions
 */

import type { LayoutSlice } from './layoutSlice';
import type { ThemeSlice } from './themeSlice';
import type { DataBindingSlice } from './dataBindingSlice';
import type { HistorySlice } from './historySlice';
import type { SyncSlice } from './syncSlice';
import type { AISlice } from './aiSlice';

// ============================================
// Enums
// ============================================

/**
 * 页面类型枚举
 */
export enum PageType {
  HOME = 'home',
  DASHBOARD = 'dashboard',
  LIST = 'list',
  DETAIL = 'detail',
  FORM = 'form',
}

// ============================================
// Core Types
// ============================================

/**
 * 页面配置状态
 */
export type PageConfigStatus = 'draft' | 'published' | 'archived';

/**
 * 模块位置
 */
export interface ModulePosition {
  x: number;
  y: number;
  order: number;
}

/**
 * 模块尺寸
 */
export interface ModuleSize {
  width: 1 | 2 | 3 | 4;
  height: 1 | 2 | 3 | 4;
}

/**
 * 页面模块配置
 */
export interface PageModule {
  id: string;
  componentType: string;
  position: ModulePosition;
  size: ModuleSize;
  props: Record<string, unknown>;
  visible: boolean;
  name?: string;
  description?: string;
}

/**
 * 主题配置
 */
export interface PageThemeConfig {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  borderRadius: number;
  fontFamily?: string;
  customStyles?: Record<string, unknown>;
}

/**
 * 数据绑定配置
 */
export interface DataBinding {
  bindingId: string;
  moduleId: string;
  dataSource: string;
  fieldMappings: Record<string, string>;
  refreshInterval?: number;
  filters?: Record<string, unknown>;
}

/**
 * 布局配置
 */
export interface LayoutConfig {
  modules: PageModule[];
  gridColumns: number;
  gridGap: number;
  padding: number;
}

/**
 * 页面配置
 */
export interface PageConfig {
  pageId: string;
  factoryId: string;
  pageType: PageType;
  layoutConfig: LayoutConfig;
  themeConfig: PageThemeConfig;
  dataBindings: DataBinding[];
  status: PageConfigStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

/**
 * 历史记录项
 */
export interface HistoryItem {
  timestamp: number;
  action: 'add' | 'remove' | 'update' | 'reorder' | 'reset' | 'ai_generate' | 'ai_add' | 'ai_style';
  moduleId?: string;
  previousState: PageModule[];
  description: string;
}

/**
 * AI建议操作
 */
export interface AISuggestedAction {
  actionCode: string;
  actionName: string;
  description: string;
}

/**
 * AI操作结果
 */
export interface AIOperationResult {
  success: boolean;
  layoutConfig?: PageModule[];
  themeConfig?: Record<string, unknown>;
  message: string;
  suggestedActions?: AISuggestedAction[];
}

// ============================================
// Combined Store State
// ============================================

/**
 * Full page config store state — intersection of all slices
 */
export type PageConfigState =
  LayoutSlice &
  ThemeSlice &
  DataBindingSlice &
  HistorySlice &
  SyncSlice &
  AISlice;
