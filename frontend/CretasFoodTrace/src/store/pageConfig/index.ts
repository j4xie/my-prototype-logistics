/**
 * Page Configuration Store
 * Composes all slices into a single Zustand store with persist middleware
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PageConfigState } from './types';
import { DEFAULT_THEME_CONFIG } from './defaults';
import { createLayoutSlice } from './layoutSlice';
import { createThemeSlice } from './themeSlice';
import { createDataBindingSlice } from './dataBindingSlice';
import { createHistorySlice } from './historySlice';
import { createSyncSlice } from './syncSlice';
import { createAISlice } from './aiSlice';

// ============================================
// Store Creation — single persist wrapper
// ============================================

export const usePageConfigStore = create<PageConfigState>()(
  persist(
    (...args) => ({
      ...createLayoutSlice(...args),
      ...createThemeSlice(...args),
      ...createDataBindingSlice(...args),
      ...createHistorySlice(...args),
      ...createSyncSlice(...args),
      ...createAISlice(...args),
    }),
    {
      name: 'page-config-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // 只持久化配置数据，不持久化编辑状态
      partialize: (state) => ({
        configs: state.configs,
        activePageId: state.activePageId,
      }),
    }
  )
);

// ============================================
// 便捷 hooks
// ============================================

/**
 * 获取活动页面配置
 */
export const useActivePageConfig = () =>
  usePageConfigStore((state) => state.getActiveConfig());

/**
 * 获取页面模块
 */
export const usePageModules = (pageId: string) =>
  usePageConfigStore((state) => state.getModules(pageId));

/**
 * 获取可见模块
 */
export const useVisiblePageModules = (pageId: string) =>
  usePageConfigStore((state) => state.getVisibleModules(pageId));

/**
 * 获取编辑状态
 * P1 Fix: Use useShallow to prevent unnecessary re-renders
 */
export const usePageEditState = () =>
  usePageConfigStore(
    useShallow((state) => ({
      isEditing: state.isEditing,
      hasUnsavedChanges: state.hasUnsavedChanges,
      isLoading: state.isLoading,
      error: state.error,
    }))
  );

/**
 * 获取主题配置
 */
export const usePageTheme = () =>
  usePageConfigStore(
    (state) => state.draftThemeConfig || DEFAULT_THEME_CONFIG
  );

/**
 * 获取撤销/重做状态
 * P1 Fix: Use useShallow to prevent unnecessary re-renders
 */
export const usePageUndoRedo = () =>
  usePageConfigStore(
    useShallow((state) => ({
      canUndo: state.canUndo(),
      canRedo: state.canRedo(),
      undo: state.undo,
      redo: state.redo,
    }))
  );

/**
 * 获取模块操作方法
 * P1 Fix: Use useShallow to prevent unnecessary re-renders
 */
export const usePageModuleActions = () =>
  usePageConfigStore(
    useShallow((state) => ({
      addModule: state.addModule,
      removeModule: state.removeModule,
      updateModuleProps: state.updateModuleProps,
      reorderModules: state.reorderModules,
      resizeModule: state.resizeModule,
      moveModule: state.moveModule,
      toggleModuleVisibility: state.toggleModuleVisibility,
    }))
  );

/**
 * 获取页面配置操作方法
 * P1 Fix: Use useShallow to prevent unnecessary re-renders
 */
export const usePageConfigActions = () =>
  usePageConfigStore(
    useShallow((state) => ({
      loadConfig: state.loadConfig,
      saveConfig: state.saveConfig,
      publishConfig: state.publishConfig,
      startEditing: state.startEditing,
      cancelEditing: state.cancelEditing,
      resetToDefault: state.resetToDefault,
      updateTheme: state.updateTheme,
      updateLayout: state.updateLayout,
    }))
  );

/**
 * 获取AI操作方法和状态
 * P1 Fix: Use useShallow to prevent unnecessary re-renders
 */
export const usePageAIActions = () =>
  usePageConfigStore(
    useShallow((state) => ({
      aiGenerateLayout: state.aiGenerateLayout,
      aiAddComponent: state.aiAddComponent,
      aiUpdateStyle: state.aiUpdateStyle,
      applyAIResult: state.applyAIResult,
      isAIProcessing: state.isAIProcessing,
      aiError: state.aiError,
    }))
  );

// ============================================
// Re-exports for convenience
// ============================================

export { PageType } from './types';
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
  HistoryItem,
  AISuggestedAction,
  AIOperationResult,
} from './types';

export {
  DEFAULT_THEME_CONFIG,
  DEFAULT_LAYOUT_CONFIG,
  createDefaultPageConfig,
} from './defaults';

export default usePageConfigStore;
