/**
 * 通用页面配置状态管理
 * General Page Configuration State Management (Zustand)
 *
 * Phase 3 - 支持多种页面类型的配置管理
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import { lowcodeApiClient } from '../services/api/lowcodeApiClient';

// 创建PageConfigStore专用logger
const storeLogger = logger.createContextLogger('PageConfigStore');

// ============================================
// 类型定义
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
interface HistoryItem {
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
// 默认配置
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

/**
 * 深拷贝模块数组
 */
function cloneModules(modules: PageModule[]): PageModule[] {
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
function generateModuleId(): string {
  return `module_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// Store 类型定义
// ============================================

interface PageConfigState {
  // 状态
  configs: Record<string, PageConfig>;
  activePageId: string | null;
  isEditing: boolean;
  isLoading: boolean;
  error: string | null;

  // 草稿状态 (编辑时使用)
  draftLayoutConfig: LayoutConfig | null;
  draftThemeConfig: PageThemeConfig | null;
  hasUnsavedChanges: boolean;

  // 历史记录
  history: HistoryItem[];
  historyIndex: number;

  // Actions - 配置加载/保存
  loadConfig: (pageId: string, factoryId: string) => Promise<void>;
  saveConfig: (pageId: string) => Promise<void>;
  publishConfig: (pageId: string) => Promise<void>;

  // Actions - 布局操作
  updateLayout: (pageId: string, modules: PageModule[]) => void;
  updateModuleProps: (
    pageId: string,
    moduleId: string,
    props: Record<string, unknown>
  ) => void;
  addModule: (
    pageId: string,
    componentType: string,
    position: ModulePosition
  ) => void;
  removeModule: (pageId: string, moduleId: string) => void;
  reorderModules: (pageId: string, fromIndex: number, toIndex: number) => void;
  resizeModule: (pageId: string, moduleId: string, size: ModuleSize) => void;
  moveModule: (
    pageId: string,
    moduleId: string,
    position: ModulePosition
  ) => void;
  toggleModuleVisibility: (pageId: string, moduleId: string) => void;

  // Actions - 主题操作
  updateTheme: (pageId: string, theme: Partial<PageThemeConfig>) => void;

  // Actions - 数据绑定
  updateDataBindings: (pageId: string, bindings: DataBinding[]) => void;
  addDataBinding: (pageId: string, binding: DataBinding) => void;
  removeDataBinding: (pageId: string, bindingId: string) => void;

  // Actions - 页面管理
  setActivePageId: (pageId: string | null) => void;
  startEditing: () => void;
  cancelEditing: () => void;
  setError: (error: string | null) => void;

  // Actions - 工具方法
  resetToDefault: (pageId: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Getters
  getConfig: (pageId: string) => PageConfig | undefined;
  getActiveConfig: () => PageConfig | undefined;
  getModules: (pageId: string) => PageModule[];
  getModuleById: (pageId: string, moduleId: string) => PageModule | undefined;
  getVisibleModules: (pageId: string) => PageModule[];

  // Actions - AI操作
  aiGenerateLayout: (factoryId: string, prompt: string, pageType: string) => Promise<AIOperationResult>;
  aiAddComponent: (factoryId: string, prompt: string) => Promise<AIOperationResult>;
  aiUpdateStyle: (factoryId: string, prompt: string) => Promise<AIOperationResult>;
  applyAIResult: (result: AIOperationResult) => void;
  isAIProcessing: boolean;
  aiError: string | null;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 添加历史记录
 */
function addToHistory(
  state: PageConfigState,
  action: HistoryItem['action'],
  description: string,
  moduleId?: string
): Partial<PageConfigState> {
  const currentModules = state.draftLayoutConfig?.modules || [];
  const newHistory = state.history.slice(0, state.historyIndex + 1);

  newHistory.push({
    timestamp: Date.now(),
    action,
    moduleId,
    previousState: cloneModules(currentModules),
    description,
  });

  // 限制历史记录数量
  const maxHistory = 50;
  if (newHistory.length > maxHistory) {
    newHistory.shift();
  }

  return {
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

// ============================================
// Store 实现
// ============================================

export const usePageConfigStore = create<PageConfigState>()(
  persist(
    (set, get) => ({
      // 初始状态
      configs: {},
      activePageId: null,
      isEditing: false,
      isLoading: false,
      error: null,
      draftLayoutConfig: null,
      draftThemeConfig: null,
      hasUnsavedChanges: false,
      history: [],
      historyIndex: -1,
      isAIProcessing: false,
      aiError: null,

      // ==========================================
      // 配置加载/保存
      // ==========================================

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

      // ==========================================
      // 布局操作
      // ==========================================

      updateLayout: (pageId, modules) => {
        const { activePageId, draftLayoutConfig } = get();

        if (activePageId !== pageId || !draftLayoutConfig) {
          storeLogger.warn('updateLayout: 页面ID不匹配或无草稿配置');
          return;
        }

        const historyUpdate = addToHistory(get(), 'update', '更新布局');

        set({
          draftLayoutConfig: {
            ...draftLayoutConfig,
            modules: cloneModules(modules),
          },
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      updateModuleProps: (pageId, moduleId, props) => {
        const { activePageId, draftLayoutConfig } = get();

        if (activePageId !== pageId || !draftLayoutConfig) {
          storeLogger.warn('updateModuleProps: 页面ID不匹配或无草稿配置');
          return;
        }

        const modules = draftLayoutConfig.modules.map((m) =>
          m.id === moduleId ? { ...m, props: { ...m.props, ...props } } : m
        );

        const module = draftLayoutConfig.modules.find((m) => m.id === moduleId);
        const historyUpdate = addToHistory(
          get(),
          'update',
          `更新模块属性: ${module?.name || moduleId}`,
          moduleId
        );

        set({
          draftLayoutConfig: { ...draftLayoutConfig, modules },
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      addModule: (pageId, componentType, position) => {
        const { activePageId, draftLayoutConfig } = get();

        if (activePageId !== pageId || !draftLayoutConfig) {
          storeLogger.warn('addModule: 页面ID不匹配或无草稿配置');
          return;
        }

        const newModule: PageModule = {
          id: generateModuleId(),
          componentType,
          position,
          size: { width: 1, height: 1 },
          props: {},
          visible: true,
          name: componentType,
        };

        const modules = [...draftLayoutConfig.modules, newModule];

        const historyUpdate = addToHistory(
          get(),
          'add',
          `添加模块: ${componentType}`,
          newModule.id
        );

        set({
          draftLayoutConfig: { ...draftLayoutConfig, modules },
          hasUnsavedChanges: true,
          ...historyUpdate,
        });

        storeLogger.debug('模块已添加', { moduleId: newModule.id, componentType });
      },

      removeModule: (pageId, moduleId) => {
        const { activePageId, draftLayoutConfig } = get();

        if (activePageId !== pageId || !draftLayoutConfig) {
          storeLogger.warn('removeModule: 页面ID不匹配或无草稿配置');
          return;
        }

        const module = draftLayoutConfig.modules.find((m) => m.id === moduleId);
        const modules = draftLayoutConfig.modules.filter(
          (m) => m.id !== moduleId
        );

        const historyUpdate = addToHistory(
          get(),
          'remove',
          `删除模块: ${module?.name || moduleId}`,
          moduleId
        );

        set({
          draftLayoutConfig: { ...draftLayoutConfig, modules },
          hasUnsavedChanges: true,
          ...historyUpdate,
        });

        storeLogger.debug('模块已删除', { moduleId });
      },

      reorderModules: (pageId, fromIndex, toIndex) => {
        const { activePageId, draftLayoutConfig } = get();

        if (activePageId !== pageId || !draftLayoutConfig) {
          storeLogger.warn('reorderModules: 页面ID不匹配或无草稿配置');
          return;
        }

        const modules = [...draftLayoutConfig.modules];
        if (
          fromIndex < 0 ||
          fromIndex >= modules.length ||
          toIndex < 0 ||
          toIndex >= modules.length
        ) {
          return;
        }

        const [removed] = modules.splice(fromIndex, 1);
        if (!removed) return;

        modules.splice(toIndex, 0, removed);

        // 更新order字段
        modules.forEach((m, index) => {
          m.position.order = index;
        });

        const historyUpdate = addToHistory(
          get(),
          'reorder',
          `重新排序: ${removed.name || removed.id}`,
          removed.id
        );

        set({
          draftLayoutConfig: { ...draftLayoutConfig, modules },
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      resizeModule: (pageId, moduleId, size) => {
        const { activePageId, draftLayoutConfig } = get();

        if (activePageId !== pageId || !draftLayoutConfig) {
          storeLogger.warn('resizeModule: 页面ID不匹配或无草稿配置');
          return;
        }

        const modules = draftLayoutConfig.modules.map((m) =>
          m.id === moduleId ? { ...m, size: { ...size } } : m
        );

        const module = draftLayoutConfig.modules.find((m) => m.id === moduleId);
        const historyUpdate = addToHistory(
          get(),
          'update',
          `调整大小: ${module?.name || moduleId} -> ${size.width}x${size.height}`,
          moduleId
        );

        set({
          draftLayoutConfig: { ...draftLayoutConfig, modules },
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      moveModule: (pageId, moduleId, position) => {
        const { activePageId, draftLayoutConfig } = get();

        if (activePageId !== pageId || !draftLayoutConfig) {
          storeLogger.warn('moveModule: 页面ID不匹配或无草稿配置');
          return;
        }

        const modules = draftLayoutConfig.modules.map((m) =>
          m.id === moduleId ? { ...m, position: { ...position } } : m
        );

        const module = draftLayoutConfig.modules.find((m) => m.id === moduleId);
        const historyUpdate = addToHistory(
          get(),
          'update',
          `移动: ${module?.name || moduleId} -> (${position.x}, ${position.y})`,
          moduleId
        );

        set({
          draftLayoutConfig: { ...draftLayoutConfig, modules },
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      toggleModuleVisibility: (pageId, moduleId) => {
        const { activePageId, draftLayoutConfig } = get();

        if (activePageId !== pageId || !draftLayoutConfig) {
          storeLogger.warn('toggleModuleVisibility: 页面ID不匹配或无草稿配置');
          return;
        }

        const modules = draftLayoutConfig.modules.map((m) =>
          m.id === moduleId ? { ...m, visible: !m.visible } : m
        );

        const module = draftLayoutConfig.modules.find((m) => m.id === moduleId);
        const newVisibility = !module?.visible;
        const historyUpdate = addToHistory(
          get(),
          'update',
          `${newVisibility ? '显示' : '隐藏'}: ${module?.name || moduleId}`,
          moduleId
        );

        set({
          draftLayoutConfig: { ...draftLayoutConfig, modules },
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      // ==========================================
      // 主题操作
      // ==========================================

      updateTheme: (pageId, theme) => {
        const { activePageId, draftThemeConfig } = get();

        if (activePageId !== pageId || !draftThemeConfig) {
          storeLogger.warn('updateTheme: 页面ID不匹配或无草稿配置');
          return;
        }

        set({
          draftThemeConfig: { ...draftThemeConfig, ...theme },
          hasUnsavedChanges: true,
        });
      },

      // ==========================================
      // 数据绑定
      // ==========================================

      updateDataBindings: (pageId, bindings) => {
        const { configs } = get();

        const configKey = Object.keys(configs).find((key) =>
          key.endsWith(`_${pageId}`)
        );

        if (!configKey) {
          storeLogger.warn('updateDataBindings: 配置不存在');
          return;
        }

        const currentConfig = configs[configKey];
        if (!currentConfig) return;

        set({
          configs: {
            ...configs,
            [configKey]: {
              ...currentConfig,
              dataBindings: bindings,
              updatedAt: new Date().toISOString(),
            },
          },
          hasUnsavedChanges: true,
        });
      },

      addDataBinding: (pageId, binding) => {
        const { configs } = get();

        const configKey = Object.keys(configs).find((key) =>
          key.endsWith(`_${pageId}`)
        );

        if (!configKey) {
          storeLogger.warn('addDataBinding: 配置不存在');
          return;
        }

        const currentConfig = configs[configKey];
        if (!currentConfig) return;

        set({
          configs: {
            ...configs,
            [configKey]: {
              ...currentConfig,
              dataBindings: [...currentConfig.dataBindings, binding],
              updatedAt: new Date().toISOString(),
            },
          },
          hasUnsavedChanges: true,
        });
      },

      removeDataBinding: (pageId, bindingId) => {
        const { configs } = get();

        const configKey = Object.keys(configs).find((key) =>
          key.endsWith(`_${pageId}`)
        );

        if (!configKey) {
          storeLogger.warn('removeDataBinding: 配置不存在');
          return;
        }

        const currentConfig = configs[configKey];
        if (!currentConfig) return;

        set({
          configs: {
            ...configs,
            [configKey]: {
              ...currentConfig,
              dataBindings: currentConfig.dataBindings.filter(
                (b) => b.bindingId !== bindingId
              ),
              updatedAt: new Date().toISOString(),
            },
          },
          hasUnsavedChanges: true,
        });
      },

      // ==========================================
      // 页面管理
      // ==========================================

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

      // ==========================================
      // 工具方法
      // ==========================================

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

      undo: () => {
        const { history, historyIndex, draftLayoutConfig } = get();

        if (historyIndex < 0 || !draftLayoutConfig) return;

        const historyItem = history[historyIndex];
        if (!historyItem) return;

        set({
          draftLayoutConfig: {
            ...draftLayoutConfig,
            modules: cloneModules(historyItem.previousState),
          },
          historyIndex: historyIndex - 1,
          hasUnsavedChanges: true,
        });
      },

      redo: () => {
        const { history, historyIndex, draftLayoutConfig } = get();

        if (historyIndex >= history.length - 1 || !draftLayoutConfig) return;

        const nextIndex = historyIndex + 1;
        const nextItem = history[nextIndex + 1];

        if (nextItem) {
          set({
            draftLayoutConfig: {
              ...draftLayoutConfig,
              modules: cloneModules(nextItem.previousState),
            },
            historyIndex: nextIndex,
            hasUnsavedChanges: true,
          });
        }
      },

      canUndo: () => {
        const { historyIndex } = get();
        return historyIndex >= 0;
      },

      canRedo: () => {
        const { history, historyIndex } = get();
        return historyIndex < history.length - 1;
      },

      // ==========================================
      // Getters
      // ==========================================

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

      getModules: (pageId) => {
        const { activePageId, draftLayoutConfig, isEditing, configs } = get();

        // 编辑模式且是当前活动页面，返回草稿
        if (isEditing && activePageId === pageId && draftLayoutConfig) {
          return draftLayoutConfig.modules;
        }

        // 从配置中获取
        const configKey = Object.keys(configs).find((key) =>
          key.endsWith(`_${pageId}`)
        );

        if (configKey && configs[configKey]) {
          return configs[configKey].layoutConfig.modules;
        }

        return [];
      },

      getModuleById: (pageId, moduleId) => {
        const modules = get().getModules(pageId);
        return modules.find((m) => m.id === moduleId);
      },

      getVisibleModules: (pageId) => {
        const modules = get().getModules(pageId);
        return modules
          .filter((m) => m.visible)
          .sort((a, b) => a.position.order - b.position.order);
      },

      // ==========================================
      // AI操作
      // ==========================================

      aiGenerateLayout: async (factoryId, prompt, pageType) => {
        const { draftLayoutConfig, activePageId, configs } = get();
        const activePageConfig = activePageId ? configs[activePageId] : null;

        set({ isAIProcessing: true, aiError: null });

        try {
          storeLogger.debug('AI生成布局', { factoryId, prompt, pageType });

          // 将当前模块转换为JSON字符串用于AI请求
          const currentConfig = activePageConfig
            ? {
                pageId: activePageConfig.pageId,
                factoryId,
                pageType: pageType as 'home' | 'dashboard' | 'list' | 'detail' | 'form',
                pageName: activePageConfig.pageId, // 使用pageId作为名称
                layoutConfig: JSON.stringify({ modules: draftLayoutConfig?.modules || [] }),
              }
            : undefined;

          const response = await lowcodeApiClient.aiGeneratePage(factoryId, {
            prompt,
            pageType,
            currentConfig,
          });

          if (!response.success || !response.data) {
            const errorMsg = response.message || 'AI生成布局失败';
            set({ isAIProcessing: false, aiError: errorMsg });
            return {
              success: false,
              message: errorMsg,
            };
          }

          // 解析后端返回的布局配置
          const layoutData = response.data.layoutConfig
            ? JSON.parse(response.data.layoutConfig)
            : { modules: [] };
          const themeData = response.data.themeConfig
            ? JSON.parse(response.data.themeConfig)
            : undefined;

          // 转换后端响应为AIOperationResult
          const result: AIOperationResult = {
            success: true,
            layoutConfig: layoutData.modules as PageModule[],
            themeConfig: themeData as Record<string, unknown> | undefined,
            message: response.data.explanation || 'AI布局生成成功',
            suggestedActions: response.data.suggestedActions?.map((action) => ({
              actionCode: action.actionCode,
              actionName: action.actionName,
              description: action.description,
            })),
          };

          // 自动应用结果
          get().applyAIResult(result);

          storeLogger.info('AI布局生成成功', { modulesCount: result.layoutConfig?.length });
          set({ isAIProcessing: false });

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'AI生成布局失败';
          storeLogger.error('AI生成布局失败', { factoryId, error });
          set({ isAIProcessing: false, aiError: errorMessage });
          return {
            success: false,
            message: errorMessage,
          };
        }
      },

      aiAddComponent: async (factoryId, prompt) => {
        const { draftLayoutConfig, activePageId, configs } = get();
        const activePageConfig = activePageId ? configs[activePageId] : null;

        set({ isAIProcessing: true, aiError: null });

        try {
          storeLogger.debug('AI添加组件', { factoryId, prompt });

          const response = await lowcodeApiClient.aiAddComponent(factoryId, {
            pageId: activePageConfig?.pageId || 'home',
            prompt,
          });

          if (!response.success || !response.data) {
            const errorMsg = response.message || 'AI添加组件失败';
            set({ isAIProcessing: false, aiError: errorMsg });
            return {
              success: false,
              message: errorMsg,
            };
          }

          // 解析后端返回的布局配置
          const layoutData = response.data.layoutConfig
            ? JSON.parse(response.data.layoutConfig)
            : { modules: draftLayoutConfig?.modules || [] };

          const result: AIOperationResult = {
            success: true,
            layoutConfig: layoutData.modules as PageModule[],
            message: response.data.explanation || 'AI组件添加成功',
            suggestedActions: response.data.suggestedActions?.map((action) => ({
              actionCode: action.actionCode,
              actionName: action.actionName,
              description: action.description,
            })),
          };

          // 自动应用结果
          get().applyAIResult(result);

          storeLogger.info('AI添加组件成功');
          set({ isAIProcessing: false });

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'AI添加组件失败';
          storeLogger.error('AI添加组件失败', { factoryId, error });
          set({ isAIProcessing: false, aiError: errorMessage });
          return {
            success: false,
            message: errorMessage,
          };
        }
      },

      aiUpdateStyle: async (factoryId, prompt) => {
        const { draftLayoutConfig, draftThemeConfig, activePageId, configs } = get();
        const activePageConfig = activePageId ? configs[activePageId] : null;

        set({ isAIProcessing: true, aiError: null });

        try {
          storeLogger.debug('AI更新样式', { factoryId, prompt });

          const response = await lowcodeApiClient.aiUpdateStyle(factoryId, {
            pageId: activePageConfig?.pageId || 'home',
            prompt,
          });

          if (!response.success || !response.data) {
            const errorMsg = response.message || 'AI更新样式失败';
            set({ isAIProcessing: false, aiError: errorMsg });
            return {
              success: false,
              message: errorMsg,
            };
          }

          // 解析后端返回的配置
          const layoutData = response.data.layoutConfig
            ? JSON.parse(response.data.layoutConfig)
            : { modules: draftLayoutConfig?.modules || [] };
          const themeData = response.data.themeConfig
            ? JSON.parse(response.data.themeConfig)
            : draftThemeConfig;

          const result: AIOperationResult = {
            success: true,
            layoutConfig: layoutData.modules as PageModule[],
            themeConfig: themeData as Record<string, unknown> | undefined,
            message: response.data.explanation || 'AI样式更新成功',
            suggestedActions: response.data.suggestedActions?.map((action) => ({
              actionCode: action.actionCode,
              actionName: action.actionName,
              description: action.description,
            })),
          };

          // 自动应用结果
          get().applyAIResult(result);

          storeLogger.info('AI更新样式成功');
          set({ isAIProcessing: false });

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'AI更新样式失败';
          storeLogger.error('AI更新样式失败', { factoryId, error });
          set({ isAIProcessing: false, aiError: errorMessage });
          return {
            success: false,
            message: errorMessage,
          };
        }
      },

      applyAIResult: (result) => {
        const { draftLayoutConfig, draftThemeConfig, activePageId } = get();

        if (!result.success) {
          storeLogger.warn('applyAIResult: 结果不成功，跳过应用');
          return;
        }

        if (!activePageId || !draftLayoutConfig) {
          storeLogger.warn('applyAIResult: 没有活动页面或草稿配置');
          return;
        }

        // 添加到历史记录（用于撤销）
        const historyUpdate = addToHistory(
          get(),
          'ai_generate',
          `AI操作: ${result.message}`,
        );

        // 应用布局配置
        const newLayoutConfig = result.layoutConfig
          ? {
              ...draftLayoutConfig,
              modules: cloneModules(result.layoutConfig),
            }
          : draftLayoutConfig;

        // 应用主题配置
        let newThemeConfig: PageThemeConfig | null = draftThemeConfig;
        if (result.themeConfig) {
          const baseTheme: PageThemeConfig = draftThemeConfig || {
            primaryColor: '#1890FF',
            backgroundColor: '#FFFFFF',
            textColor: '#1F2937',
            accentColor: '#3B82F6',
            borderRadius: 8,
          };
          newThemeConfig = {
            ...baseTheme,
            ...(result.themeConfig as Partial<PageThemeConfig>),
          };
        }

        set({
          draftLayoutConfig: newLayoutConfig,
          draftThemeConfig: newThemeConfig as PageThemeConfig | null,
          hasUnsavedChanges: true,
          ...historyUpdate,
        });

        storeLogger.info('AI结果已应用', {
          modulesCount: newLayoutConfig?.modules?.length,
          hasThemeChanges: !!result.themeConfig,
        });
      },
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
 */
export const usePageEditState = () =>
  usePageConfigStore((state) => ({
    isEditing: state.isEditing,
    hasUnsavedChanges: state.hasUnsavedChanges,
    isLoading: state.isLoading,
    error: state.error,
  }));

/**
 * 获取主题配置
 */
export const usePageTheme = () =>
  usePageConfigStore(
    (state) => state.draftThemeConfig || DEFAULT_THEME_CONFIG
  );

/**
 * 获取撤销/重做状态
 */
export const usePageUndoRedo = () =>
  usePageConfigStore((state) => ({
    canUndo: state.canUndo(),
    canRedo: state.canRedo(),
    undo: state.undo,
    redo: state.redo,
  }));

/**
 * 获取模块操作方法
 */
export const usePageModuleActions = () =>
  usePageConfigStore((state) => ({
    addModule: state.addModule,
    removeModule: state.removeModule,
    updateModuleProps: state.updateModuleProps,
    reorderModules: state.reorderModules,
    resizeModule: state.resizeModule,
    moveModule: state.moveModule,
    toggleModuleVisibility: state.toggleModuleVisibility,
  }));

/**
 * 获取页面配置操作方法
 */
export const usePageConfigActions = () =>
  usePageConfigStore((state) => ({
    loadConfig: state.loadConfig,
    saveConfig: state.saveConfig,
    publishConfig: state.publishConfig,
    startEditing: state.startEditing,
    cancelEditing: state.cancelEditing,
    resetToDefault: state.resetToDefault,
    updateTheme: state.updateTheme,
    updateLayout: state.updateLayout,
  }));

/**
 * 获取AI操作方法和状态
 */
export const usePageAIActions = () =>
  usePageConfigStore((state) => ({
    aiGenerateLayout: state.aiGenerateLayout,
    aiAddComponent: state.aiAddComponent,
    aiUpdateStyle: state.aiUpdateStyle,
    applyAIResult: state.applyAIResult,
    isAIProcessing: state.isAIProcessing,
    aiError: state.aiError,
  }));

export default usePageConfigStore;
