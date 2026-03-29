/**
 * Layout Slice — Module CRUD actions (add/remove/reorder/resize/move modules)
 */

import type { StateCreator } from 'zustand';
import type {
  PageConfigState,
  PageModule,
  ModulePosition,
  ModuleSize,
  LayoutConfig,
} from './types';
import { cloneModules, generateModuleId } from './defaults';
import { addToHistory } from './historySlice';
import { logger } from '../../utils/logger';

const storeLogger = logger.createContextLogger('PageConfigStore');

// ============================================
// Slice Interface
// ============================================

export interface LayoutSlice {
  // State
  draftLayoutConfig: LayoutConfig | null;
  hasUnsavedChanges: boolean;

  // Actions
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

  // Getters
  getModules: (pageId: string) => PageModule[];
  getModuleById: (pageId: string, moduleId: string) => PageModule | undefined;
  getVisibleModules: (pageId: string) => PageModule[];
}

// ============================================
// Slice Creator
// ============================================

export const createLayoutSlice: StateCreator<
  PageConfigState,
  [],
  [],
  LayoutSlice
> = (set, get) => ({
  // Initial state
  draftLayoutConfig: null,
  hasUnsavedChanges: false,

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

  // Getters

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
});
