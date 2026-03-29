/**
 * AI Slice — AI-powered layout generation, component addition, style updates
 */

import type { StateCreator } from 'zustand';
import type { PageConfigState, AIOperationResult, PageThemeConfig, PageModule } from './types';
import { cloneModules } from './defaults';
import { addToHistory } from './historySlice';
import { lowcodeApiClient } from '../../services/api/lowcodeApiClient';
import { logger } from '../../utils/logger';

const storeLogger = logger.createContextLogger('PageConfigStore');

// ============================================
// Slice Interface
// ============================================

export interface AISlice {
  // State
  isAIProcessing: boolean;
  aiError: string | null;

  // Actions
  aiGenerateLayout: (factoryId: string, prompt: string, pageType: string) => Promise<AIOperationResult>;
  aiAddComponent: (factoryId: string, prompt: string) => Promise<AIOperationResult>;
  aiUpdateStyle: (factoryId: string, prompt: string) => Promise<AIOperationResult>;
  applyAIResult: (result: AIOperationResult) => void;
}

// ============================================
// Slice Creator
// ============================================

export const createAISlice: StateCreator<
  PageConfigState,
  [],
  [],
  AISlice
> = (set, get) => ({
  // Initial state
  isAIProcessing: false,
  aiError: null,

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
});
