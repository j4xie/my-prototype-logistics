/**
 * 首页布局状态管理
 * Home Layout State Management (Zustand)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  HomeModule,
  HomeModuleType,
  FactoryHomeLayout,
  ThemeConfig,
  ModuleConfig,
  TimeSlot,
  LayoutHistoryItem,
} from '../types/decoration';
import {
  DEFAULT_HOME_LAYOUT,
  DEFAULT_THEME_CONFIG,
  createDefaultFactoryLayout,
  getCurrentTimeSlot,
  cloneModules,
  validateLayout,
} from '../types/decoration';
import { decorationApiClient } from '../services/api/decorationApiClient';

// ============================================
// 类型定义
// ============================================

interface HomeLayoutState {
  // 状态
  layout: FactoryHomeLayout | null;
  isEditing: boolean;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  error: string | null;

  // 临时编辑状态
  draftModules: HomeModule[];
  draftTheme: ThemeConfig | null;
  currentTimeSlot: TimeSlot;

  // 历史记录 (用于撤销)
  history: LayoutHistoryItem[];
  historyIndex: number;

  // Actions - 基础操作
  setLayout: (layout: FactoryHomeLayout) => void;
  startEditing: () => void;
  cancelEditing: () => void;
  setError: (error: string | null) => void;

  // Actions - 模块操作
  reorderModules: (fromIndex: number, toIndex: number) => void;
  resizeModule: (moduleId: string, size: { w: 1 | 2; h: 1 | 2 }) => void;
  moveModule: (moduleId: string, position: { x: number; y: number }) => void;
  toggleModuleVisibility: (moduleId: string) => void;
  updateModuleConfig: (moduleId: string, config: Partial<ModuleConfig>) => void;

  // Actions - 子项操作 (统计卡片/快捷操作)
  toggleStatCardVisibility: (moduleId: string, cardId: string) => void;
  toggleQuickActionVisibility: (moduleId: string, actionId: string) => void;
  addStatCard: (moduleId: string, cardId: string) => void;
  addQuickAction: (moduleId: string, actionId: string) => void;

  // Actions - 主题操作
  updateTheme: (theme: Partial<ThemeConfig>) => void;

  // Actions - 时段布局
  switchTimeSlot: (slot: TimeSlot) => void;
  getCurrentLayout: () => HomeModule[];
  enableTimeBased: (enabled: boolean) => void;
  setTimeSlotLayout: (slot: TimeSlot, modules: HomeModule[]) => void;

  // Actions - AI操作
  applyAILayout: (modules: HomeModule[], theme?: ThemeConfig) => void;

  // Actions - API操作
  fetchLayout: (factoryId: string) => Promise<void>;
  saveDraft: (factoryId: string) => Promise<void>;
  publishLayout: (factoryId: string) => Promise<void>;

  // Actions - 工具方法
  resetToDefault: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Getters
  getVisibleModules: () => HomeModule[];
  getModuleById: (id: string) => HomeModule | undefined;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 添加历史记录
 */
function addToHistory(
  state: HomeLayoutState,
  action: LayoutHistoryItem['action'],
  description: string,
  moduleId?: string
): Partial<HomeLayoutState> {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push({
    timestamp: Date.now(),
    action,
    moduleId,
    previousState: cloneModules(state.draftModules),
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

export const useHomeLayoutStore = create<HomeLayoutState>()(
  persist(
    (set, get) => ({
      // 初始状态
      layout: null,
      isEditing: false,
      hasUnsavedChanges: false,
      isLoading: false,
      error: null,
      draftModules: cloneModules(DEFAULT_HOME_LAYOUT),
      draftTheme: null,
      currentTimeSlot: 'default',
      history: [],
      historyIndex: -1,

      // ==========================================
      // 基础操作
      // ==========================================

      setLayout: (layout) => {
        set({
          layout,
          draftModules: cloneModules(layout.modules),
          draftTheme: layout.theme ? { ...layout.theme } : null,
          hasUnsavedChanges: false,
          error: null,
        });
      },

      startEditing: () => {
        const { layout } = get();
        set({
          isEditing: true,
          draftModules: layout ? cloneModules(layout.modules) : cloneModules(DEFAULT_HOME_LAYOUT),
          draftTheme: layout?.theme ? { ...layout.theme } : { ...DEFAULT_THEME_CONFIG },
          history: [],
          historyIndex: -1,
        });
      },

      cancelEditing: () => {
        const { layout } = get();
        set({
          isEditing: false,
          hasUnsavedChanges: false,
          draftModules: layout ? cloneModules(layout.modules) : cloneModules(DEFAULT_HOME_LAYOUT),
          draftTheme: layout?.theme ? { ...layout.theme } : null,
          history: [],
          historyIndex: -1,
        });
      },

      setError: (error) => {
        set({ error });
      },

      // ==========================================
      // 模块操作
      // ==========================================

      reorderModules: (fromIndex, toIndex) => {
        const { draftModules } = get();
        if (fromIndex < 0 || fromIndex >= draftModules.length) return;
        if (toIndex < 0 || toIndex >= draftModules.length) return;

        const modules = [...draftModules];
        const [removed] = modules.splice(fromIndex, 1);
        if (!removed) return;

        modules.splice(toIndex, 0, removed);

        // 更新order字段
        modules.forEach((m, index) => {
          m.order = index;
        });

        const historyUpdate = addToHistory(
          get(),
          'reorder',
          `重新排序: ${removed.name} 从 ${fromIndex} 移动到 ${toIndex}`,
          removed.id
        );

        set({
          draftModules: modules,
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      resizeModule: (moduleId, size) => {
        const { draftModules } = get();
        const modules = draftModules.map((m) =>
          m.id === moduleId ? { ...m, gridSize: { ...size } } : m
        );

        const module = draftModules.find((m) => m.id === moduleId);
        const historyUpdate = addToHistory(
          get(),
          'resize',
          `调整大小: ${module?.name || moduleId} -> ${size.w}x${size.h}`,
          moduleId
        );

        set({
          draftModules: modules,
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      moveModule: (moduleId, position) => {
        const { draftModules } = get();
        const modules = draftModules.map((m) =>
          m.id === moduleId ? { ...m, gridPosition: { ...position } } : m
        );

        const module = draftModules.find((m) => m.id === moduleId);
        const historyUpdate = addToHistory(
          get(),
          'move',
          `移动: ${module?.name || moduleId} -> (${position.x}, ${position.y})`,
          moduleId
        );

        set({
          draftModules: modules,
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      toggleModuleVisibility: (moduleId) => {
        const { draftModules } = get();
        const modules = draftModules.map((m) =>
          m.id === moduleId ? { ...m, visible: !m.visible } : m
        );

        const module = draftModules.find((m) => m.id === moduleId);
        const newVisibility = !module?.visible;
        const historyUpdate = addToHistory(
          get(),
          'toggle',
          `${newVisibility ? '显示' : '隐藏'}: ${module?.name || moduleId}`,
          moduleId
        );

        set({
          draftModules: modules,
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      updateModuleConfig: (moduleId, config) => {
        const { draftModules } = get();
        const modules = draftModules.map((m) =>
          m.id === moduleId
            ? { ...m, config: { ...m.config, ...config } }
            : m
        );

        const module = draftModules.find((m) => m.id === moduleId);
        const historyUpdate = addToHistory(
          get(),
          'config',
          `更新配置: ${module?.name || moduleId}`,
          moduleId
        );

        set({
          draftModules: modules,
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      // ==========================================
      // 子项操作 (统计卡片/快捷操作)
      // ==========================================

      toggleStatCardVisibility: (moduleId, cardId) => {
        const { draftModules } = get();
        const modules = draftModules.map((m) => {
          if (m.id !== moduleId) return m;

          const cards = m.config?.cards || [];
          const existingCard = cards.find((c) => c.id === cardId);

          let updatedCards;
          if (existingCard) {
            // 卡片配置已存在，切换 visible 状态
            updatedCards = cards.map((c) =>
              c.id === cardId ? { ...c, visible: !c.visible } : c
            );
          } else {
            // 卡片配置不存在，添加为隐藏状态
            updatedCards = [...cards, { id: cardId, visible: false }];
          }

          return {
            ...m,
            config: { ...m.config, cards: updatedCards },
          };
        });

        const module = draftModules.find((m) => m.id === moduleId);
        const card = module?.config?.cards?.find((c) => c.id === cardId);
        const newVisibility = card ? !card.visible : false; // 新添加的默认隐藏
        const historyUpdate = addToHistory(
          get(),
          'config',
          `${newVisibility ? '显示' : '隐藏'}卡片: ${cardId}`,
          moduleId
        );

        set({
          draftModules: modules,
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      toggleQuickActionVisibility: (moduleId, actionId) => {
        const { draftModules } = get();
        const modules = draftModules.map((m) => {
          if (m.id !== moduleId) return m;

          const actions = m.config?.actions || [];
          const existingAction = actions.find((a) => a.id === actionId);

          let updatedActions;
          if (existingAction) {
            // 操作配置已存在，切换 visible 状态
            updatedActions = actions.map((a) =>
              a.id === actionId ? { ...a, visible: !a.visible } : a
            );
          } else {
            // 操作配置不存在，添加为隐藏状态
            updatedActions = [...actions, { id: actionId, visible: false }];
          }

          return {
            ...m,
            config: { ...m.config, actions: updatedActions },
          };
        });

        const module = draftModules.find((m) => m.id === moduleId);
        const action = module?.config?.actions?.find((a) => a.id === actionId);
        const newVisibility = action ? !action.visible : false; // 新添加的默认隐藏
        const historyUpdate = addToHistory(
          get(),
          'config',
          `${newVisibility ? '显示' : '隐藏'}操作: ${actionId}`,
          moduleId
        );

        set({
          draftModules: modules,
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      addStatCard: (moduleId, cardId) => {
        const { draftModules } = get();
        const modules = draftModules.map((m) => {
          if (m.id !== moduleId) return m;

          const cards = m.config?.cards || [];
          // 检查是否已存在该卡片
          const existingCard = cards.find((c) => c.id === cardId);
          if (existingCard) {
            // 如果已存在但隐藏，则显示
            return {
              ...m,
              config: {
                ...m.config,
                cards: cards.map((c) =>
                  c.id === cardId ? { ...c, visible: true } : c
                ),
              },
            };
          }

          // 添加新卡片
          const newCard = { id: cardId, visible: true };
          return {
            ...m,
            config: { ...m.config, cards: [...cards, newCard] },
          };
        });

        const historyUpdate = addToHistory(
          get(),
          'config',
          `添加卡片: ${cardId}`,
          moduleId
        );

        set({
          draftModules: modules,
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      addQuickAction: (moduleId, actionId) => {
        const { draftModules } = get();
        const modules = draftModules.map((m) => {
          if (m.id !== moduleId) return m;

          const actions = m.config?.actions || [];
          // 检查是否已存在该操作
          const existingAction = actions.find((a) => a.id === actionId);
          if (existingAction) {
            // 如果已存在但隐藏，则显示
            return {
              ...m,
              config: {
                ...m.config,
                actions: actions.map((a) =>
                  a.id === actionId ? { ...a, visible: true } : a
                ),
              },
            };
          }

          // 添加新操作
          const newAction = { id: actionId, visible: true };
          return {
            ...m,
            config: { ...m.config, actions: [...actions, newAction] },
          };
        });

        const historyUpdate = addToHistory(
          get(),
          'config',
          `添加操作: ${actionId}`,
          moduleId
        );

        set({
          draftModules: modules,
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      // ==========================================
      // 主题操作
      // ==========================================

      updateTheme: (theme) => {
        const { draftTheme } = get();
        set({
          draftTheme: { ...(draftTheme || DEFAULT_THEME_CONFIG), ...theme },
          hasUnsavedChanges: true,
        });
      },

      // ==========================================
      // 时段布局
      // ==========================================

      switchTimeSlot: (slot) => {
        set({ currentTimeSlot: slot });
      },

      getCurrentLayout: () => {
        const { layout, draftModules, isEditing, currentTimeSlot } = get();

        // 编辑模式返回草稿
        if (isEditing) {
          return draftModules;
        }

        // 没有布局返回默认
        if (!layout) {
          return DEFAULT_HOME_LAYOUT;
        }

        // 未启用时段布局，返回默认模块
        if (!layout.timeBasedEnabled) {
          return layout.modules;
        }

        // 根据时段返回对应布局
        const timeSlot = currentTimeSlot === 'default' ? getCurrentTimeSlot() : currentTimeSlot;

        switch (timeSlot) {
          case 'morning':
            return layout.morningLayout || layout.modules;
          case 'afternoon':
            return layout.afternoonLayout || layout.modules;
          case 'evening':
            return layout.eveningLayout || layout.modules;
          default:
            return layout.modules;
        }
      },

      enableTimeBased: (enabled) => {
        const { layout } = get();
        if (layout) {
          set({
            layout: { ...layout, timeBasedEnabled: enabled },
            hasUnsavedChanges: true,
          });
        }
      },

      setTimeSlotLayout: (slot, modules) => {
        const { layout } = get();
        if (!layout) return;

        const updates: Partial<FactoryHomeLayout> = {};

        switch (slot) {
          case 'morning':
            updates.morningLayout = cloneModules(modules);
            break;
          case 'afternoon':
            updates.afternoonLayout = cloneModules(modules);
            break;
          case 'evening':
            updates.eveningLayout = cloneModules(modules);
            break;
          default:
            updates.modules = cloneModules(modules);
        }

        set({
          layout: { ...layout, ...updates },
          hasUnsavedChanges: true,
        });
      },

      // ==========================================
      // AI操作
      // ==========================================

      applyAILayout: (modules, theme) => {
        const historyUpdate = addToHistory(get(), 'ai_apply', 'AI生成布局');

        set({
          draftModules: cloneModules(modules),
          draftTheme: theme ? { ...theme } : get().draftTheme,
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      // ==========================================
      // API操作
      // ==========================================

      fetchLayout: async (factoryId) => {
        console.log('[HomeLayoutStore] fetchLayout 开始, factoryId:', factoryId);
        set({ isLoading: true, error: null });

        // 检查本地是否已有布局（persist 会自动加载）
        const currentLayout = get().layout;
        if (currentLayout && currentLayout.factoryId === factoryId) {
          console.log('[HomeLayoutStore] 使用本地已保存的布局');
          set({ isLoading: false });
          return;
        }

        // 首次使用，创建默认布局
        // TODO: 后端 decoration API 数据格式对齐后再启用远程加载
        console.log('[HomeLayoutStore] 首次使用，创建默认布局');
        const defaultLayout = createDefaultFactoryLayout(factoryId);
        get().setLayout(defaultLayout);
        set({ isLoading: false });
      },

      saveDraft: async (factoryId) => {
        const { draftModules, draftTheme, layout } = get();

        // 验证布局
        const validation = validateLayout(draftModules);
        if (!validation.isValid) {
          throw new Error(`布局验证失败: ${validation.errors.join(', ')}`);
        }

        set({ isLoading: true, error: null });

        try {
          // 直接保存到本地存储（persist 中间件会自动同步）
          // TODO: 后端 API 对接后再启用远程保存
          console.log('[HomeLayoutStore] 保存布局到本地存储');

          set({
            layout: {
              factoryId,
              modules: cloneModules(draftModules),
              theme: draftTheme ? { ...draftTheme } : undefined,
              version: (layout?.version || 0) + 1,
              status: 'draft',
              timeBasedEnabled: layout?.timeBasedEnabled || false,
              morningLayout: layout?.morningLayout,
              afternoonLayout: layout?.afternoonLayout,
              eveningLayout: layout?.eveningLayout,
              gridColumns: layout?.gridColumns || 2,
              updatedAt: new Date().toISOString(),
            },
            hasUnsavedChanges: false,
            isLoading: false,
            isEditing: false,
          });

          console.log('[HomeLayoutStore] 布局保存成功');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '保存布局失败';
          set({ isLoading: false, error: errorMessage });
          throw error;
        }
      },

      publishLayout: async (factoryId) => {
        const { layout } = get();
        if (!layout) {
          throw new Error('没有可发布的布局');
        }

        set({ isLoading: true, error: null });

        try {
          // 调用真实API发布布局
          const response = await decorationApiClient.publishLayout(factoryId, {
            version: layout.version,
          });

          if (response.success && response.data) {
            set({
              layout: {
                ...layout,
                status: 'published',
                updatedAt: response.data.publishedAt || new Date().toISOString(),
              },
              isLoading: false,
            });
          } else {
            throw new Error(response.message || '发布布局失败');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '发布布局失败';
          set({ isLoading: false, error: errorMessage });
          throw error;
        }
      },

      // ==========================================
      // 工具方法
      // ==========================================

      resetToDefault: () => {
        const historyUpdate = addToHistory(get(), 'reset', '重置为默认布局');

        set({
          draftModules: cloneModules(DEFAULT_HOME_LAYOUT),
          draftTheme: { ...DEFAULT_THEME_CONFIG },
          hasUnsavedChanges: true,
          ...historyUpdate,
        });
      },

      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < 0) return;

        const historyItem = history[historyIndex];
        if (!historyItem) return;

        set({
          draftModules: cloneModules(historyItem.previousState),
          historyIndex: historyIndex - 1,
          hasUnsavedChanges: true,
        });
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;

        const nextIndex = historyIndex + 1;
        const nextItem = history[nextIndex + 1];

        if (nextItem) {
          set({
            draftModules: cloneModules(nextItem.previousState),
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

      getVisibleModules: () => {
        const modules = get().getCurrentLayout();
        return modules
          .filter((m) => m.visible)
          .sort((a, b) => a.order - b.order);
      },

      getModuleById: (id) => {
        const { draftModules } = get();
        return draftModules.find((m) => m.id === id);
      },
    }),
    {
      name: 'home-layout-storage-v7', // v7: 黑名单逻辑修复
      storage: createJSONStorage(() => AsyncStorage),
      // 只持久化布局配置，不持久化编辑状态
      partialize: (state) => ({
        layout: state.layout,
        currentTimeSlot: state.currentTimeSlot,
      }),
    }
  )
);

// ============================================
// 便捷 hooks
// ============================================

/**
 * 获取当前布局模块（原始数据，不过滤）
 */
export const useCurrentLayoutModules = () =>
  useHomeLayoutStore(
    useShallow((state) => {
      if (state.isEditing) {
        return state.draftModules;
      }
      return state.layout?.modules || DEFAULT_HOME_LAYOUT;
    })
  );

/**
 * 获取可见模块 - 使用 useShallow 确保引用稳定
 */
export const useVisibleModules = () =>
  useHomeLayoutStore(
    useShallow((state) => {
      const modules = state.isEditing
        ? state.draftModules
        : (state.layout?.modules || DEFAULT_HOME_LAYOUT);

      return modules
        .filter((m) => m.visible)
        .sort((a, b) => a.order - b.order);
    })
  );

// 保持向后兼容
export const useCurrentLayout = useCurrentLayoutModules;

/**
 * 获取编辑状态
 */
export const useLayoutEditState = () =>
  useHomeLayoutStore(
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
export const useLayoutTheme = () =>
  useHomeLayoutStore((state) => state.draftTheme || state.layout?.theme || DEFAULT_THEME_CONFIG);

/**
 * 获取撤销/重做状态
 */
export const useUndoRedo = () =>
  useHomeLayoutStore(
    useShallow((state) => ({
      canUndo: state.canUndo(),
      canRedo: state.canRedo(),
      undo: state.undo,
      redo: state.redo,
    }))
  );

/**
 * 获取模块操作方法
 */
export const useModuleActions = () =>
  useHomeLayoutStore(
    useShallow((state) => ({
      reorderModules: state.reorderModules,
      resizeModule: state.resizeModule,
      moveModule: state.moveModule,
      toggleModuleVisibility: state.toggleModuleVisibility,
      updateModuleConfig: state.updateModuleConfig,
    }))
  );

/**
 * 获取布局操作方法
 */
export const useLayoutActions = () =>
  useHomeLayoutStore(
    useShallow((state) => ({
      startEditing: state.startEditing,
      cancelEditing: state.cancelEditing,
      saveDraft: state.saveDraft,
      publishLayout: state.publishLayout,
      resetToDefault: state.resetToDefault,
      applyAILayout: state.applyAILayout,
    }))
  );

export default useHomeLayoutStore;
