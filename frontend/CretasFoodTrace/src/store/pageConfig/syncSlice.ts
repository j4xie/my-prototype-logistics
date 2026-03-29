/**
 * Sync Slice — API load/save/publish actions + page management state
 */

import type { StateCreator } from 'zustand';
import type { PageConfigState, PageConfig } from './types';
import { PageType } from './types';
import {
  createDefaultPageConfig,
  cloneModules,
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_THEME_CONFIG,
} from './defaults';
import { addToHistory } from './historySlice';
import { logger } from '../../utils/logger';

const storeLogger = logger.createContextLogger('PageConfigStore');

// ============================================
// Slice Interface
// ============================================

export interface SyncSlice {
  // State
  configs: Record<string, PageConfig>;
  activePageId: string | null;
  isEditing: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions - 配置加载/保存
  loadConfig: (pageId: string, factoryId: string) => Promise<void>;
  saveConfig: (pageId: string) => Promise<void>;
  publishConfig: (pageId: string) => Promise<void>;

  // Actions - 页面管理
  setActivePageId: (pageId: string | null) => void;
  startEditing: () => void;
  cancelEditing: () => void;
  setError: (error: string | null) => void;

  // Actions - 工具方法
  resetToDefault: (pageId: string) => void;

  // Getters
  getConfig: (pageId: string) => PageConfig | undefined;
  getActiveConfig: () => PageConfig | undefined;
}

// ============================================
// Slice Creator
// ============================================

export const createSyncSlice: StateCreator<
  PageConfigState,
  [],
  [],
  SyncSlice
> = (set, get) => ({
  // Initial state
  configs: {},
  activePageId: null,
  isEditing: false,
  isLoading: false,
  error: null,

  loadConfig: async (pageId, factoryId) => {
    set({ isLoading: true, error: null });

    try {
      storeLogger.debug('加载页面配置', { pageId, factoryId });

      // TODO: 调用API获取配置
      // const response = await pageConfigApiClient.getConfig(pageId, factoryId);

      // 模拟API调用 - 先从本地缓存获取
      const { configs } = get();
      const configKey = `${factoryId}_${pageId}`;

      if (configs[configKey]) {
        storeLogger.debug('从缓存加载配置', { configKey });
        set({
          activePageId: pageId,
          draftLayoutConfig: { ...configs[configKey].layoutConfig },
          draftThemeConfig: { ...configs[configKey].themeConfig },
          isLoading: false,
        });
      } else {
        // 创建默认配置
        storeLogger.debug('创建默认配置', { pageId, factoryId });
        const defaultConfig = createDefaultPageConfig(
          pageId,
          factoryId,
          PageType.HOME
        );

        set({
          configs: { ...configs, [configKey]: defaultConfig },
          activePageId: pageId,
          draftLayoutConfig: { ...defaultConfig.layoutConfig },
          draftThemeConfig: { ...defaultConfig.themeConfig },
          isLoading: false,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '加载配置失败';
      storeLogger.error('加载配置失败', { pageId, factoryId, error });
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  saveConfig: async (pageId) => {
    const {
      configs,
      activePageId,
      draftLayoutConfig,
      draftThemeConfig,
    } = get();

    if (!activePageId || activePageId !== pageId) {
      throw new Error('页面ID不匹配');
    }

    const configKey = Object.keys(configs).find((key) =>
      key.endsWith(`_${pageId}`)
    );

    if (!configKey || !draftLayoutConfig || !draftThemeConfig) {
      throw new Error('没有可保存的配置');
    }

    set({ isLoading: true, error: null });

    try {
      storeLogger.debug('保存页面配置', { pageId });

      // TODO: 调用API保存配置
      // const response = await pageConfigApiClient.saveConfig(pageId, {
      //   layoutConfig: draftLayoutConfig,
      //   themeConfig: draftThemeConfig,
      // });

      const currentConfig = configs[configKey];
      if (!currentConfig) {
        throw new Error('配置不存在');
      }

      const updatedConfig: PageConfig = {
        ...currentConfig,
        layoutConfig: {
          ...draftLayoutConfig,
          modules: cloneModules(draftLayoutConfig.modules),
        },
        themeConfig: { ...draftThemeConfig },
        version: currentConfig.version + 1,
        updatedAt: new Date().toISOString(),
      };

      set({
        configs: { ...configs, [configKey]: updatedConfig },
        hasUnsavedChanges: false,
        isLoading: false,
        isEditing: false,
      });

      storeLogger.info('配置保存成功', { pageId, version: updatedConfig.version });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '保存配置失败';
      storeLogger.error('保存配置失败', { pageId, error });
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  publishConfig: async (pageId) => {
    const { configs } = get();

    const configKey = Object.keys(configs).find((key) =>
      key.endsWith(`_${pageId}`)
    );

    if (!configKey) {
      throw new Error('配置不存在');
    }

    const currentConfig = configs[configKey];
    if (!currentConfig) {
      throw new Error('配置不存在');
    }

    set({ isLoading: true, error: null });

    try {
      storeLogger.debug('发布页面配置', { pageId });

      // TODO: 调用API发布配置
      // const response = await pageConfigApiClient.publishConfig(pageId);

      const updatedConfig: PageConfig = {
        ...currentConfig,
        status: 'published',
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set({
        configs: { ...configs, [configKey]: updatedConfig },
        isLoading: false,
      });

      storeLogger.info('配置发布成功', { pageId });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '发布配置失败';
      storeLogger.error('发布配置失败', { pageId, error });
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  setActivePageId: (pageId) => {
    set({ activePageId: pageId });
  },

  startEditing: () => {
    const { activePageId, configs } = get();

    if (!activePageId) {
      storeLogger.warn('startEditing: 没有活动页面');
      return;
    }

    const configKey = Object.keys(configs).find((key) =>
      key.endsWith(`_${activePageId}`)
    );

    if (!configKey) {
      storeLogger.warn('startEditing: 配置不存在');
      return;
    }

    const currentConfig = configs[configKey];
    if (!currentConfig) return;

    set({
      isEditing: true,
      draftLayoutConfig: {
        ...currentConfig.layoutConfig,
        modules: cloneModules(currentConfig.layoutConfig.modules),
      },
      draftThemeConfig: { ...currentConfig.themeConfig },
      history: [],
      historyIndex: -1,
    });

    storeLogger.debug('开始编辑', { pageId: activePageId });
  },

  cancelEditing: () => {
    const { activePageId, configs } = get();

    if (!activePageId) {
      set({
        isEditing: false,
        hasUnsavedChanges: false,
        draftLayoutConfig: null,
        draftThemeConfig: null,
        history: [],
        historyIndex: -1,
      });
      return;
    }

    const configKey = Object.keys(configs).find((key) =>
      key.endsWith(`_${activePageId}`)
    );

    if (!configKey) {
      set({
        isEditing: false,
        hasUnsavedChanges: false,
        draftLayoutConfig: null,
        draftThemeConfig: null,
        history: [],
        historyIndex: -1,
      });
      return;
    }

    const currentConfig = configs[configKey];
    if (!currentConfig) {
      set({
        isEditing: false,
        hasUnsavedChanges: false,
        draftLayoutConfig: null,
        draftThemeConfig: null,
        history: [],
        historyIndex: -1,
      });
      return;
    }

    set({
      isEditing: false,
      hasUnsavedChanges: false,
      draftLayoutConfig: {
        ...currentConfig.layoutConfig,
        modules: cloneModules(currentConfig.layoutConfig.modules),
      },
      draftThemeConfig: { ...currentConfig.themeConfig },
      history: [],
      historyIndex: -1,
    });

    storeLogger.debug('取消编辑', { pageId: activePageId });
  },

  setError: (error) => {
    set({ error });
  },

  resetToDefault: (pageId) => {
    const { activePageId, draftLayoutConfig } = get();

    if (activePageId !== pageId || !draftLayoutConfig) {
      storeLogger.warn('resetToDefault: 页面ID不匹配或无草稿配置');
      return;
    }

    const historyUpdate = addToHistory(get(), 'reset', '重置为默认布局');

    set({
      draftLayoutConfig: { ...DEFAULT_LAYOUT_CONFIG },
      draftThemeConfig: { ...DEFAULT_THEME_CONFIG },
      hasUnsavedChanges: true,
      ...historyUpdate,
    });

    storeLogger.debug('重置为默认配置', { pageId });
  },

  getConfig: (pageId) => {
    const { configs } = get();
    const configKey = Object.keys(configs).find((key) =>
      key.endsWith(`_${pageId}`)
    );
    return configKey ? configs[configKey] : undefined;
  },

  getActiveConfig: () => {
    const { activePageId, configs } = get();
    if (!activePageId) return undefined;

    const configKey = Object.keys(configs).find((key) =>
      key.endsWith(`_${activePageId}`)
    );
    return configKey ? configs[configKey] : undefined;
  },
});
