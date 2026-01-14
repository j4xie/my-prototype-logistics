/**
 * pageConfigStore 单元测试
 * 测试页面配置状态管理的所有核心方法
 */

import { act } from 'react';
import {
  usePageConfigStore,
  PageType,
  PageModule,
  PageConfig,
  ModulePosition,
  ModuleSize,
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_THEME_CONFIG,
  createDefaultPageConfig,
  AIOperationResult,
} from '../../../store/pageConfigStore';
import { lowcodeApiClient } from '../../../services/api/lowcodeApiClient';
import { randomString } from '../../utils/testHelpers';

// Mock lowcodeApiClient
jest.mock('../../../services/api/lowcodeApiClient', () => ({
  lowcodeApiClient: {
    aiGeneratePage: jest.fn(),
    aiAddComponent: jest.fn(),
    aiUpdateStyle: jest.fn(),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(),
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    createContextLogger: () => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
  },
}));

describe('pageConfigStore', () => {
  const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
  const TEST_PAGE_ID = 'home';

  // Reset store state before each test
  beforeEach(() => {
    const store = usePageConfigStore.getState();
    // Reset to initial state
    usePageConfigStore.setState({
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
    });

    jest.clearAllMocks();
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * 创建Mock模块
   */
  function mockModule(overrides?: Partial<PageModule>): PageModule {
    return {
      id: `module_${randomString(8)}`,
      componentType: 'banner',
      position: { x: 0, y: 0, order: 0 },
      size: { width: 2, height: 1 },
      props: {},
      visible: true,
      name: '测试模块',
      ...overrides,
    };
  }

  /**
   * 设置带有默认配置的Store状态
   */
  async function setupStoreWithConfig() {
    const store = usePageConfigStore.getState();
    await act(async () => {
      await store.loadConfig(TEST_PAGE_ID, DEFAULT_FACTORY_ID);
    });
    return usePageConfigStore.getState();
  }

  /**
   * 设置编辑模式
   */
  async function setupEditingMode() {
    await setupStoreWithConfig();
    const store = usePageConfigStore.getState();
    act(() => {
      store.startEditing();
    });
    return usePageConfigStore.getState();
  }

  // ============================================================================
  // loadConfig Tests
  // ============================================================================

  describe('loadConfig', () => {
    it('应该成功加载页面配置', async () => {
      const store = usePageConfigStore.getState();

      await act(async () => {
        await store.loadConfig(TEST_PAGE_ID, DEFAULT_FACTORY_ID);
      });

      const state = usePageConfigStore.getState();
      expect(state.activePageId).toBe(TEST_PAGE_ID);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('应该为新页面创建默认配置', async () => {
      const store = usePageConfigStore.getState();
      const newPageId = 'new_page';

      await act(async () => {
        await store.loadConfig(newPageId, DEFAULT_FACTORY_ID);
      });

      const state = usePageConfigStore.getState();
      const configKey = `${DEFAULT_FACTORY_ID}_${newPageId}`;
      expect(state.configs[configKey]).toBeDefined();
      expect(state.configs[configKey]?.pageId).toBe(newPageId);
      expect(state.configs[configKey]?.factoryId).toBe(DEFAULT_FACTORY_ID);
    });

    it('应该从缓存加载已有配置', async () => {
      // First load
      await setupStoreWithConfig();

      // Modify the config
      const state = usePageConfigStore.getState();
      const configKey = `${DEFAULT_FACTORY_ID}_${TEST_PAGE_ID}`;
      const currentConfig = state.configs[configKey];
      if (currentConfig) {
        usePageConfigStore.setState({
          configs: {
            ...state.configs,
            [configKey]: {
              ...currentConfig,
              version: 5,
            },
          },
        });
      }

      // Second load should use cached config
      await act(async () => {
        await usePageConfigStore.getState().loadConfig(TEST_PAGE_ID, DEFAULT_FACTORY_ID);
      });

      const finalState = usePageConfigStore.getState();
      expect(finalState.configs[configKey]?.version).toBe(5);
    });

    it('应该在加载时设置草稿配置', async () => {
      await setupStoreWithConfig();

      const state = usePageConfigStore.getState();
      expect(state.draftLayoutConfig).toBeDefined();
      expect(state.draftThemeConfig).toBeDefined();
    });
  });

  // ============================================================================
  // saveConfig Tests
  // ============================================================================

  describe('saveConfig', () => {
    it('应该成功保存页面配置', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();

      await act(async () => {
        await store.saveConfig(TEST_PAGE_ID);
      });

      const state = usePageConfigStore.getState();
      expect(state.hasUnsavedChanges).toBe(false);
      expect(state.isEditing).toBe(false);
    });

    it('应该在保存时增加版本号', async () => {
      await setupEditingMode();

      const initialState = usePageConfigStore.getState();
      const configKey = Object.keys(initialState.configs).find((key) =>
        key.endsWith(`_${TEST_PAGE_ID}`)
      );
      const initialVersion = configKey ? initialState.configs[configKey]?.version ?? 1 : 1;

      await act(async () => {
        await initialState.saveConfig(TEST_PAGE_ID);
      });

      const finalState = usePageConfigStore.getState();
      expect(configKey ? finalState.configs[configKey]?.version : undefined).toBe(initialVersion + 1);
    });

    it('应该在页面ID不匹配时抛出错误', async () => {
      await setupStoreWithConfig();

      const store = usePageConfigStore.getState();

      await expect(
        act(async () => {
          await store.saveConfig('wrong_page_id');
        })
      ).rejects.toThrow('页面ID不匹配');
    });

    it('应该在没有草稿配置时抛出错误', async () => {
      usePageConfigStore.setState({
        activePageId: TEST_PAGE_ID,
        draftLayoutConfig: null,
        draftThemeConfig: null,
        configs: {},
      });

      const store = usePageConfigStore.getState();

      await expect(
        act(async () => {
          await store.saveConfig(TEST_PAGE_ID);
        })
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // addModule Tests
  // ============================================================================

  describe('addModule', () => {
    it('应该成功添加模块', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();
      const position: ModulePosition = { x: 0, y: 0, order: 0 };

      act(() => {
        store.addModule(TEST_PAGE_ID, 'banner', position);
      });

      const state = usePageConfigStore.getState();
      const modules = state.draftLayoutConfig?.modules || [];
      expect(modules).toHaveLength(1);
      expect(modules[0]?.componentType).toBe('banner');
    });

    it('应该为新模块生成唯一ID', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();
      const position: ModulePosition = { x: 0, y: 0, order: 0 };

      act(() => {
        store.addModule(TEST_PAGE_ID, 'banner', position);
        store.addModule(TEST_PAGE_ID, 'card', { x: 0, y: 1, order: 1 });
      });

      const state = usePageConfigStore.getState();
      const modules = state.draftLayoutConfig?.modules || [];
      expect(modules[0]?.id).not.toBe(modules[1]?.id);
    });

    it('应该设置hasUnsavedChanges为true', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();

      act(() => {
        store.addModule(TEST_PAGE_ID, 'banner', { x: 0, y: 0, order: 0 });
      });

      const state = usePageConfigStore.getState();
      expect(state.hasUnsavedChanges).toBe(true);
    });

    it('应该添加历史记录', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();

      act(() => {
        store.addModule(TEST_PAGE_ID, 'banner', { x: 0, y: 0, order: 0 });
      });

      const state = usePageConfigStore.getState();
      expect(state.history.length).toBeGreaterThan(0);
      expect(state.history[state.history.length - 1]?.action).toBe('add');
    });

    it('应该在页面ID不匹配时不执行操作', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();
      const initialModulesLength = store.draftLayoutConfig?.modules.length || 0;

      act(() => {
        store.addModule('wrong_page_id', 'banner', { x: 0, y: 0, order: 0 });
      });

      const state = usePageConfigStore.getState();
      expect(state.draftLayoutConfig?.modules.length).toBe(initialModulesLength);
    });
  });

  // ============================================================================
  // removeModule Tests
  // ============================================================================

  describe('removeModule', () => {
    it('应该成功删除模块', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();

      // Add a module first
      act(() => {
        store.addModule(TEST_PAGE_ID, 'banner', { x: 0, y: 0, order: 0 });
      });

      const stateWithModule = usePageConfigStore.getState();
      const moduleId = stateWithModule.draftLayoutConfig?.modules[0]?.id;

      // Remove the module
      act(() => {
        stateWithModule.removeModule(TEST_PAGE_ID, moduleId!);
      });

      const state = usePageConfigStore.getState();
      expect(state.draftLayoutConfig?.modules).toHaveLength(0);
    });

    it('应该添加删除历史记录', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();

      act(() => {
        store.addModule(TEST_PAGE_ID, 'banner', { x: 0, y: 0, order: 0 });
      });

      const stateWithModule = usePageConfigStore.getState();
      const moduleId = stateWithModule.draftLayoutConfig?.modules[0]?.id;

      act(() => {
        stateWithModule.removeModule(TEST_PAGE_ID, moduleId!);
      });

      const state = usePageConfigStore.getState();
      const lastHistory = state.history[state.history.length - 1];
      expect(lastHistory?.action).toBe('remove');
    });
  });

  // ============================================================================
  // updateModuleProps Tests
  // ============================================================================

  describe('updateModuleProps', () => {
    it('应该成功更新模块属性', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();

      act(() => {
        store.addModule(TEST_PAGE_ID, 'banner', { x: 0, y: 0, order: 0 });
      });

      const stateWithModule = usePageConfigStore.getState();
      const moduleId = stateWithModule.draftLayoutConfig?.modules[0]?.id;

      act(() => {
        stateWithModule.updateModuleProps(TEST_PAGE_ID, moduleId!, {
          title: '新标题',
          showArrow: true,
        });
      });

      const state = usePageConfigStore.getState();
      const module = state.draftLayoutConfig?.modules.find((m) => m.id === moduleId);
      expect(module?.props).toEqual({ title: '新标题', showArrow: true });
    });

    it('应该合并而非替换现有属性', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();

      act(() => {
        store.addModule(TEST_PAGE_ID, 'banner', { x: 0, y: 0, order: 0 });
      });

      const stateWithModule = usePageConfigStore.getState();
      const moduleId = stateWithModule.draftLayoutConfig?.modules[0]?.id;

      // Set initial props
      act(() => {
        stateWithModule.updateModuleProps(TEST_PAGE_ID, moduleId!, { title: '标题' });
      });

      // Update with new props
      act(() => {
        usePageConfigStore.getState().updateModuleProps(TEST_PAGE_ID, moduleId!, { subtitle: '副标题' });
      });

      const state = usePageConfigStore.getState();
      const module = state.draftLayoutConfig?.modules.find((m) => m.id === moduleId);
      expect(module?.props).toEqual({ title: '标题', subtitle: '副标题' });
    });
  });

  // ============================================================================
  // AI Operations Tests
  // ============================================================================

  describe('aiGenerateLayout', () => {
    it('应该成功调用AI生成布局', async () => {
      await setupEditingMode();

      const mockAIResponse = {
        success: true,
        data: {
          pageConfig: {
            pageId: TEST_PAGE_ID,
            factoryId: DEFAULT_FACTORY_ID,
            pageType: 'home',
            pageName: '首页',
            layoutConfig: JSON.stringify({
              modules: [mockModule()],
            }),
          },
          layoutConfig: JSON.stringify({
            modules: [mockModule()],
          }),
          explanation: 'AI生成了一个简洁的首页布局',
        },
      };

      (lowcodeApiClient.aiGeneratePage as jest.Mock).mockResolvedValue(mockAIResponse);

      const store = usePageConfigStore.getState();

      let result: AIOperationResult | undefined;
      await act(async () => {
        result = await store.aiGenerateLayout(DEFAULT_FACTORY_ID, '生成简洁首页', 'home');
      });

      expect(result?.success).toBe(true);
      expect(result?.message).toContain('AI');
    });

    it('应该在AI生成失败时返回错误', async () => {
      await setupEditingMode();

      const mockErrorResponse = {
        success: false,
        message: 'AI服务暂时不可用',
      };

      (lowcodeApiClient.aiGeneratePage as jest.Mock).mockResolvedValue(mockErrorResponse);

      const store = usePageConfigStore.getState();

      let result: AIOperationResult | undefined;
      await act(async () => {
        result = await store.aiGenerateLayout(DEFAULT_FACTORY_ID, '生成页面', 'home');
      });

      expect(result?.success).toBe(false);
      expect(result?.message).toBe('AI服务暂时不可用');
    });

    it('应该在处理期间设置isAIProcessing为true', async () => {
      await setupEditingMode();

      let processingState = false;
      (lowcodeApiClient.aiGeneratePage as jest.Mock).mockImplementation(async () => {
        processingState = usePageConfigStore.getState().isAIProcessing;
        return { success: true, data: { layoutConfig: JSON.stringify({ modules: [] }) } };
      });

      const store = usePageConfigStore.getState();

      await act(async () => {
        await store.aiGenerateLayout(DEFAULT_FACTORY_ID, '生成页面', 'home');
      });

      expect(processingState).toBe(true);
      expect(usePageConfigStore.getState().isAIProcessing).toBe(false);
    });

    it('应该在API错误时捕获并设置aiError', async () => {
      await setupEditingMode();

      (lowcodeApiClient.aiGeneratePage as jest.Mock).mockRejectedValue(new Error('网络错误'));

      const store = usePageConfigStore.getState();

      await act(async () => {
        await store.aiGenerateLayout(DEFAULT_FACTORY_ID, '生成页面', 'home');
      });

      const state = usePageConfigStore.getState();
      expect(state.aiError).toBe('网络错误');
    });
  });

  describe('aiAddComponent', () => {
    it('应该成功调用AI添加组件', async () => {
      await setupEditingMode();

      const newModule = mockModule({ componentType: 'product_card' });
      const mockAIResponse = {
        success: true,
        data: {
          componentConfig: { componentType: 'product_card' },
          pageConfig: { pageId: TEST_PAGE_ID },
          layoutConfig: JSON.stringify({
            modules: [newModule],
          }),
          explanation: '已添加产品卡片组件',
        },
      };

      (lowcodeApiClient.aiAddComponent as jest.Mock).mockResolvedValue(mockAIResponse);

      const store = usePageConfigStore.getState();

      let result: AIOperationResult | undefined;
      await act(async () => {
        result = await store.aiAddComponent(DEFAULT_FACTORY_ID, '添加产品卡片');
      });

      expect(result?.success).toBe(true);
    });

    it('应该在AI添加失败时返回错误', async () => {
      await setupEditingMode();

      const mockErrorResponse = {
        success: false,
        message: '无法识别组件类型',
      };

      (lowcodeApiClient.aiAddComponent as jest.Mock).mockResolvedValue(mockErrorResponse);

      const store = usePageConfigStore.getState();

      let result: AIOperationResult | undefined;
      await act(async () => {
        result = await store.aiAddComponent(DEFAULT_FACTORY_ID, '添加未知组件');
      });

      expect(result?.success).toBe(false);
      expect(result?.message).toBe('无法识别组件类型');
    });
  });

  describe('aiUpdateStyle', () => {
    it('应该成功调用AI更新样式', async () => {
      await setupEditingMode();

      const mockAIResponse = {
        success: true,
        data: {
          pageConfig: { pageId: TEST_PAGE_ID },
          layoutConfig: JSON.stringify({ modules: [] }),
          themeConfig: JSON.stringify({
            primaryColor: '#52c41a',
            backgroundColor: '#f6ffed',
          }),
          explanation: '已将主题色更改为绿色系',
        },
      };

      (lowcodeApiClient.aiUpdateStyle as jest.Mock).mockResolvedValue(mockAIResponse);

      const store = usePageConfigStore.getState();

      let result: AIOperationResult | undefined;
      await act(async () => {
        result = await store.aiUpdateStyle(DEFAULT_FACTORY_ID, '使用绿色主题');
      });

      expect(result?.success).toBe(true);
      expect(result?.themeConfig).toBeDefined();
    });

    it('应该正确应用主题配置到草稿', async () => {
      await setupEditingMode();

      const mockAIResponse = {
        success: true,
        data: {
          pageConfig: { pageId: TEST_PAGE_ID },
          themeConfig: JSON.stringify({
            primaryColor: '#722ed1',
          }),
        },
      };

      (lowcodeApiClient.aiUpdateStyle as jest.Mock).mockResolvedValue(mockAIResponse);

      const store = usePageConfigStore.getState();

      await act(async () => {
        await store.aiUpdateStyle(DEFAULT_FACTORY_ID, '使用紫色主题');
      });

      const state = usePageConfigStore.getState();
      expect(state.draftThemeConfig?.primaryColor).toBe('#722ed1');
    });
  });

  describe('applyAIResult', () => {
    it('应该正确应用AI结果到草稿配置', async () => {
      await setupEditingMode();

      const aiResult: AIOperationResult = {
        success: true,
        layoutConfig: [mockModule({ id: 'ai_module_1', componentType: 'ai_banner' })],
        themeConfig: { primaryColor: '#ff4d4f' },
        message: 'AI结果应用成功',
      };

      const store = usePageConfigStore.getState();

      act(() => {
        store.applyAIResult(aiResult);
      });

      const state = usePageConfigStore.getState();
      expect(state.draftLayoutConfig?.modules).toHaveLength(1);
      expect(state.draftLayoutConfig?.modules[0]?.componentType).toBe('ai_banner');
      expect(state.hasUnsavedChanges).toBe(true);
    });

    it('应该在结果不成功时不应用', async () => {
      await setupEditingMode();

      const initialStore = usePageConfigStore.getState();
      const initialModulesLength = initialStore.draftLayoutConfig?.modules.length || 0;

      const aiResult: AIOperationResult = {
        success: false,
        message: '操作失败',
      };

      act(() => {
        initialStore.applyAIResult(aiResult);
      });

      const state = usePageConfigStore.getState();
      expect(state.draftLayoutConfig?.modules.length).toBe(initialModulesLength);
    });

    it('应该添加AI操作到历史记录', async () => {
      await setupEditingMode();

      const aiResult: AIOperationResult = {
        success: true,
        layoutConfig: [mockModule()],
        message: 'AI生成布局',
      };

      const store = usePageConfigStore.getState();

      act(() => {
        store.applyAIResult(aiResult);
      });

      const state = usePageConfigStore.getState();
      const lastHistory = state.history[state.history.length - 1];
      expect(lastHistory?.action).toBe('ai_generate');
    });
  });

  // ============================================================================
  // Undo/Redo Tests
  // ============================================================================

  describe('undo / redo', () => {
    it('应该支持撤销操作', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();

      // Add two modules
      act(() => {
        store.addModule(TEST_PAGE_ID, 'banner', { x: 0, y: 0, order: 0 });
      });

      const stateAfterFirst = usePageConfigStore.getState();

      act(() => {
        stateAfterFirst.addModule(TEST_PAGE_ID, 'card', { x: 0, y: 1, order: 1 });
      });

      expect(usePageConfigStore.getState().draftLayoutConfig?.modules).toHaveLength(2);

      // Undo
      act(() => {
        usePageConfigStore.getState().undo();
      });

      expect(usePageConfigStore.getState().draftLayoutConfig?.modules).toHaveLength(1);
    });

    it('canUndo应该正确反映状态', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();
      expect(store.canUndo()).toBe(false);

      act(() => {
        store.addModule(TEST_PAGE_ID, 'banner', { x: 0, y: 0, order: 0 });
      });

      expect(usePageConfigStore.getState().canUndo()).toBe(true);
    });

    it('canRedo应该正确反映状态', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();

      act(() => {
        store.addModule(TEST_PAGE_ID, 'banner', { x: 0, y: 0, order: 0 });
      });

      expect(usePageConfigStore.getState().canRedo()).toBe(false);

      act(() => {
        usePageConfigStore.getState().undo();
      });

      expect(usePageConfigStore.getState().canRedo()).toBe(true);
    });
  });

  // ============================================================================
  // Getter Tests
  // ============================================================================

  describe('getters', () => {
    it('getModules应该返回正确的模块列表', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();

      act(() => {
        store.addModule(TEST_PAGE_ID, 'banner', { x: 0, y: 0, order: 0 });
        store.addModule(TEST_PAGE_ID, 'card', { x: 0, y: 1, order: 1 });
      });

      const modules = usePageConfigStore.getState().getModules(TEST_PAGE_ID);
      expect(modules).toHaveLength(2);
    });

    it('getVisibleModules应该只返回可见模块', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();

      act(() => {
        store.addModule(TEST_PAGE_ID, 'banner', { x: 0, y: 0, order: 0 });
        store.addModule(TEST_PAGE_ID, 'card', { x: 0, y: 1, order: 1 });
      });

      const stateWithModules = usePageConfigStore.getState();
      const moduleId = stateWithModules.draftLayoutConfig?.modules[0]?.id;

      act(() => {
        stateWithModules.toggleModuleVisibility(TEST_PAGE_ID, moduleId!);
      });

      const visibleModules = usePageConfigStore.getState().getVisibleModules(TEST_PAGE_ID);
      expect(visibleModules).toHaveLength(1);
    });

    it('getModuleById应该返回正确的模块', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();

      act(() => {
        store.addModule(TEST_PAGE_ID, 'banner', { x: 0, y: 0, order: 0 });
      });

      const stateWithModule = usePageConfigStore.getState();
      const moduleId = stateWithModule.draftLayoutConfig?.modules[0]?.id;

      const module = stateWithModule.getModuleById(TEST_PAGE_ID, moduleId!);
      expect(module?.id).toBe(moduleId);
      expect(module?.componentType).toBe('banner');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('边界情况', () => {
    it('createDefaultPageConfig应该创建正确的默认配置', () => {
      const config = createDefaultPageConfig(TEST_PAGE_ID, DEFAULT_FACTORY_ID, PageType.HOME);

      expect(config.pageId).toBe(TEST_PAGE_ID);
      expect(config.factoryId).toBe(DEFAULT_FACTORY_ID);
      expect(config.pageType).toBe(PageType.HOME);
      expect(config.layoutConfig).toEqual(DEFAULT_LAYOUT_CONFIG);
      expect(config.themeConfig).toEqual(DEFAULT_THEME_CONFIG);
      expect(config.status).toBe('draft');
      expect(config.version).toBe(1);
    });

    it('resetToDefault应该重置为默认配置', async () => {
      await setupEditingMode();

      const store = usePageConfigStore.getState();

      // Add some modules
      act(() => {
        store.addModule(TEST_PAGE_ID, 'banner', { x: 0, y: 0, order: 0 });
        store.addModule(TEST_PAGE_ID, 'card', { x: 0, y: 1, order: 1 });
      });

      expect(usePageConfigStore.getState().draftLayoutConfig?.modules.length).toBeGreaterThan(0);

      // Reset
      act(() => {
        usePageConfigStore.getState().resetToDefault(TEST_PAGE_ID);
      });

      const state = usePageConfigStore.getState();
      expect(state.draftLayoutConfig?.modules).toHaveLength(0);
    });

    it('cancelEditing应该还原到保存的配置', async () => {
      await setupStoreWithConfig();

      const store = usePageConfigStore.getState();
      act(() => {
        store.startEditing();
      });

      // Add a module
      act(() => {
        usePageConfigStore.getState().addModule(TEST_PAGE_ID, 'banner', { x: 0, y: 0, order: 0 });
      });

      expect(usePageConfigStore.getState().draftLayoutConfig?.modules).toHaveLength(1);

      // Cancel editing
      act(() => {
        usePageConfigStore.getState().cancelEditing();
      });

      const state = usePageConfigStore.getState();
      expect(state.isEditing).toBe(false);
      expect(state.hasUnsavedChanges).toBe(false);
    });
  });
});
