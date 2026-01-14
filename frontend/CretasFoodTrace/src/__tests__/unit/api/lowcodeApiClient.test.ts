/**
 * lowcodeApiClient 单元测试
 * 测试低代码系统API客户端的所有核心方法
 */

import { lowcodeApiClient, PageConfigDTO, ComponentDefinitionDTO } from '../../../services/api/lowcodeApiClient';
import { createApiMock, mockSuccessResponse, mockErrorResponse, resetApiMock } from '../../utils/mockApiClient';
import { mockFactoryId, randomString } from '../../utils/testHelpers';
import MockAdapter from 'axios-mock-adapter';

describe('lowcodeApiClient', () => {
  let mock: MockAdapter;
  const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
  const TEST_PAGE_ID = 'home';
  const TEST_ROLE_CODE = 'factory_admin';

  beforeEach(() => {
    mock = createApiMock();
  });

  afterEach(() => {
    resetApiMock(mock);
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * 创建Mock页面配置
   */
  function mockPageConfig(overrides?: Partial<PageConfigDTO>): PageConfigDTO {
    return {
      pageId: `page_${randomString(6)}`,
      factoryId: DEFAULT_FACTORY_ID,
      pageType: 'home',
      pageName: '测试页面',
      layoutConfig: JSON.stringify({
        modules: [],
        gridColumns: 2,
        gridGap: 12,
        padding: 16,
      }),
      themeConfig: JSON.stringify({
        primaryColor: '#1890ff',
        backgroundColor: '#ffffff',
        textColor: '#333333',
      }),
      status: 1,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * 创建Mock组件定义
   */
  function mockComponentDefinition(overrides?: Partial<ComponentDefinitionDTO>): ComponentDefinitionDTO {
    return {
      componentType: `component_${randomString(6)}`,
      name: '测试组件',
      category: 'basic',
      icon: 'icon-test',
      propsSchema: JSON.stringify({
        type: 'object',
        properties: {
          title: { type: 'string' },
        },
      }),
      defaultProps: JSON.stringify({ title: '默认标题' }),
      aiDescription: '测试用的基础组件',
      ...overrides,
    };
  }

  // ============================================================================
  // getPages Tests
  // ============================================================================

  describe('getPages', () => {
    it('应该成功获取页面列表', async () => {
      const mockPages = [mockPageConfig(), mockPageConfig()];
      const mockResponse = {
        success: true,
        data: mockPages,
      };

      mockSuccessResponse(
        mock,
        'get',
        `/api/mobile/${DEFAULT_FACTORY_ID}/lowcode/pages`,
        mockResponse
      );

      const result = await lowcodeApiClient.getPages(DEFAULT_FACTORY_ID);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('应该支持按角色筛选页面', async () => {
      const mockPages = [mockPageConfig({ roleCode: TEST_ROLE_CODE })];
      const mockResponse = {
        success: true,
        data: mockPages,
      };

      mock.onGet(/\/api\/mobile\/.*\/lowcode\/pages/).reply((config) => {
        expect(config.params).toHaveProperty('roleCode', TEST_ROLE_CODE);
        return [200, mockResponse];
      });

      const result = await lowcodeApiClient.getPages(DEFAULT_FACTORY_ID, TEST_ROLE_CODE);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('应该处理空页面列表', async () => {
      const mockResponse = {
        success: true,
        data: [],
      };

      mockSuccessResponse(
        mock,
        'get',
        `/api/mobile/${DEFAULT_FACTORY_ID}/lowcode/pages`,
        mockResponse
      );

      const result = await lowcodeApiClient.getPages(DEFAULT_FACTORY_ID);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('应该在API错误时抛出异常', async () => {
      mockErrorResponse(
        mock,
        'get',
        `/api/mobile/${DEFAULT_FACTORY_ID}/lowcode/pages`,
        '获取页面列表失败',
        500
      );

      await expect(lowcodeApiClient.getPages(DEFAULT_FACTORY_ID)).rejects.toThrow();
    });
  });

  // ============================================================================
  // getPage Tests
  // ============================================================================

  describe('getPage', () => {
    it('应该成功获取单个页面配置', async () => {
      const mockPage = mockPageConfig({ pageId: TEST_PAGE_ID });
      const mockResponse = {
        success: true,
        data: mockPage,
      };

      mockSuccessResponse(
        mock,
        'get',
        `/api/mobile/${DEFAULT_FACTORY_ID}/lowcode/pages/${TEST_PAGE_ID}`,
        mockResponse
      );

      const result = await lowcodeApiClient.getPage(DEFAULT_FACTORY_ID, TEST_PAGE_ID);

      expect(result.success).toBe(true);
      expect(result.data?.pageId).toBe(TEST_PAGE_ID);
    });

    it('应该支持按角色获取页面', async () => {
      const mockPage = mockPageConfig({ pageId: TEST_PAGE_ID, roleCode: TEST_ROLE_CODE });
      const mockResponse = {
        success: true,
        data: mockPage,
      };

      mock.onGet(/\/api\/mobile\/.*\/lowcode\/pages\/.*/).reply((config) => {
        expect(config.params).toHaveProperty('roleCode', TEST_ROLE_CODE);
        return [200, mockResponse];
      });

      const result = await lowcodeApiClient.getPage(DEFAULT_FACTORY_ID, TEST_PAGE_ID, TEST_ROLE_CODE);

      expect(result.success).toBe(true);
    });

    it('应该在页面不存在时返回404错误', async () => {
      const NON_EXISTENT_PAGE_ID = 'non_existent_page';

      mockErrorResponse(
        mock,
        'get',
        `/api/mobile/${DEFAULT_FACTORY_ID}/lowcode/pages/${NON_EXISTENT_PAGE_ID}`,
        '页面不存在',
        404
      );

      await expect(lowcodeApiClient.getPage(DEFAULT_FACTORY_ID, NON_EXISTENT_PAGE_ID)).rejects.toThrow();
    });
  });

  // ============================================================================
  // getComponents Tests
  // ============================================================================

  describe('getComponents', () => {
    it('应该成功获取组件列表', async () => {
      const mockComponents = [
        mockComponentDefinition({ componentType: 'banner' }),
        mockComponentDefinition({ componentType: 'card' }),
        mockComponentDefinition({ componentType: 'list' }),
      ];
      const mockResponse = {
        success: true,
        data: mockComponents,
      };

      mockSuccessResponse(
        mock,
        'get',
        `/api/mobile/${DEFAULT_FACTORY_ID}/lowcode/components`,
        mockResponse
      );

      const result = await lowcodeApiClient.getComponents(DEFAULT_FACTORY_ID);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
    });

    it('应该支持按角色筛选组件', async () => {
      const mockComponents = [mockComponentDefinition()];
      const mockResponse = {
        success: true,
        data: mockComponents,
      };

      mock.onGet(/\/api\/mobile\/.*\/lowcode\/components/).reply((config) => {
        expect(config.params).toHaveProperty('roleCode', TEST_ROLE_CODE);
        return [200, mockResponse];
      });

      const result = await lowcodeApiClient.getComponents(DEFAULT_FACTORY_ID, TEST_ROLE_CODE);

      expect(result.success).toBe(true);
    });

    it('应该处理空组件列表', async () => {
      const mockResponse = {
        success: true,
        data: [],
      };

      mockSuccessResponse(
        mock,
        'get',
        `/api/mobile/${DEFAULT_FACTORY_ID}/lowcode/components`,
        mockResponse
      );

      const result = await lowcodeApiClient.getComponents(DEFAULT_FACTORY_ID);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  // ============================================================================
  // createPage Tests
  // ============================================================================

  describe('createPage', () => {
    it('应该成功创建页面', async () => {
      const newPageConfig = mockPageConfig({ pageId: 'new_page' });
      const mockResponse = {
        success: true,
        data: newPageConfig,
      };

      mockSuccessResponse(
        mock,
        'post',
        `/api/mobile/${DEFAULT_FACTORY_ID}/lowcode/pages`,
        mockResponse
      );

      const result = await lowcodeApiClient.createPage(DEFAULT_FACTORY_ID, newPageConfig);

      expect(result.success).toBe(true);
      expect(result.data?.pageId).toBe('new_page');
    });

    it('应该在创建失败时返回错误', async () => {
      const newPageConfig = mockPageConfig();

      mockErrorResponse(
        mock,
        'post',
        `/api/mobile/${DEFAULT_FACTORY_ID}/lowcode/pages`,
        '创建页面失败',
        400
      );

      await expect(lowcodeApiClient.createPage(DEFAULT_FACTORY_ID, newPageConfig)).rejects.toThrow();
    });
  });

  // ============================================================================
  // updatePage Tests
  // ============================================================================

  describe('updatePage', () => {
    it('应该成功更新页面', async () => {
      const updateData = { pageName: '更新后的页面名称' };
      const mockPage = mockPageConfig({ pageId: TEST_PAGE_ID, ...updateData });
      const mockResponse = {
        success: true,
        data: mockPage,
      };

      mockSuccessResponse(
        mock,
        'put',
        `/api/mobile/${DEFAULT_FACTORY_ID}/lowcode/pages/${TEST_PAGE_ID}`,
        mockResponse
      );

      const result = await lowcodeApiClient.updatePage(DEFAULT_FACTORY_ID, TEST_PAGE_ID, updateData);

      expect(result.success).toBe(true);
      expect(result.data?.pageName).toBe('更新后的页面名称');
    });
  });

  // ============================================================================
  // publishPage Tests
  // ============================================================================

  describe('publishPage', () => {
    it('应该成功发布页面', async () => {
      const mockPage = mockPageConfig({ pageId: TEST_PAGE_ID, status: 2 });
      const mockResponse = {
        success: true,
        data: mockPage,
      };

      mockSuccessResponse(
        mock,
        'post',
        `/api/mobile/${DEFAULT_FACTORY_ID}/lowcode/pages/${TEST_PAGE_ID}/publish`,
        mockResponse
      );

      const result = await lowcodeApiClient.publishPage(DEFAULT_FACTORY_ID, TEST_PAGE_ID);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // deletePage Tests
  // ============================================================================

  describe('deletePage', () => {
    it('应该成功删除页面', async () => {
      const mockResponse = {
        success: true,
        data: null,
      };

      mockSuccessResponse(
        mock,
        'delete',
        `/api/mobile/${DEFAULT_FACTORY_ID}/lowcode/pages/${TEST_PAGE_ID}`,
        mockResponse
      );

      await expect(lowcodeApiClient.deletePage(DEFAULT_FACTORY_ID, TEST_PAGE_ID)).resolves.not.toThrow();
    });

    it('应该在删除不存在的页面时返回错误', async () => {
      const NON_EXISTENT_PAGE_ID = 'non_existent_page';

      mockErrorResponse(
        mock,
        'delete',
        `/api/mobile/${DEFAULT_FACTORY_ID}/lowcode/pages/${NON_EXISTENT_PAGE_ID}`,
        '页面不存在',
        404
      );

      await expect(lowcodeApiClient.deletePage(DEFAULT_FACTORY_ID, NON_EXISTENT_PAGE_ID)).rejects.toThrow();
    });
  });

  // ============================================================================
  // AI Operations Tests
  // ============================================================================

  describe('aiGeneratePage', () => {
    it('应该成功调用AI生成页面', async () => {
      const mockAIResponse = {
        success: true,
        data: {
          result: {
            pageConfig: mockPageConfig(),
            layoutConfig: JSON.stringify({ modules: [] }),
            themeConfig: JSON.stringify({ primaryColor: '#1890ff' }),
            explanation: 'AI根据您的需求生成了首页布局',
            aiMessage: '生成成功',
            suggestedActions: [
              {
                actionCode: 'ADD_BANNER',
                actionName: '添加轮播图',
                description: '建议添加一个轮播图组件展示产品',
              },
            ],
          },
          intentCode: 'PAGE_GENERATE',
          message: '操作成功',
        },
      };

      mockSuccessResponse(
        mock,
        'post',
        `/api/mobile/${DEFAULT_FACTORY_ID}/ai/intent/execute`,
        mockAIResponse
      );

      const result = await lowcodeApiClient.aiGeneratePage(DEFAULT_FACTORY_ID, {
        prompt: '生成一个简洁的首页',
        pageType: 'home',
      });

      expect(result.success).toBe(true);
      expect(result.data?.explanation).toContain('AI');
    });

    it('应该在AI生成失败时返回错误信息', async () => {
      const mockResponse = {
        success: false,
        message: 'AI服务暂时不可用',
        code: 'AI_SERVICE_UNAVAILABLE',
      };

      mockSuccessResponse(
        mock,
        'post',
        `/api/mobile/${DEFAULT_FACTORY_ID}/ai/intent/execute`,
        mockResponse
      );

      const result = await lowcodeApiClient.aiGeneratePage(DEFAULT_FACTORY_ID, {
        prompt: '生成页面',
        pageType: 'home',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('AI服务暂时不可用');
    });

    it('应该支持传入当前配置用于优化', async () => {
      const currentConfig = mockPageConfig();
      const mockAIResponse = {
        success: true,
        data: {
          result: {
            pageConfig: mockPageConfig(),
            layoutConfig: JSON.stringify({ modules: [] }),
            explanation: '已基于现有配置优化',
          },
          intentCode: 'PAGE_GENERATE',
        },
      };

      mock.onPost(/\/api\/mobile\/.*\/ai\/intent\/execute/).reply((config) => {
        const requestData = JSON.parse(config.data);
        expect(requestData.context).toHaveProperty('currentConfig');
        return [200, mockAIResponse];
      });

      const result = await lowcodeApiClient.aiGeneratePage(DEFAULT_FACTORY_ID, {
        prompt: '优化当前页面',
        pageType: 'home',
        currentConfig,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('aiAddComponent', () => {
    it('应该成功调用AI添加组件', async () => {
      const mockAIResponse = {
        success: true,
        data: {
          result: {
            componentConfig: {
              componentType: 'banner',
              props: { images: [] },
            },
            pageConfig: mockPageConfig(),
            layoutConfig: JSON.stringify({
              modules: [
                {
                  id: 'module_1',
                  componentType: 'banner',
                  position: { x: 0, y: 0, order: 0 },
                  size: { width: 2, height: 1 },
                  props: { images: [] },
                  visible: true,
                },
              ],
            }),
            explanation: '已添加轮播图组件',
          },
          intentCode: 'PAGE_COMPONENT_ADD',
        },
      };

      mockSuccessResponse(
        mock,
        'post',
        `/api/mobile/${DEFAULT_FACTORY_ID}/ai/intent/execute`,
        mockAIResponse
      );

      const result = await lowcodeApiClient.aiAddComponent(DEFAULT_FACTORY_ID, {
        pageId: TEST_PAGE_ID,
        prompt: '添加一个轮播图',
      });

      expect(result.success).toBe(true);
      expect(result.data?.componentConfig).toHaveProperty('componentType', 'banner');
    });

    it('应该支持指定目标位置', async () => {
      const targetPosition = { x: 0, y: 1 };
      const mockAIResponse = {
        success: true,
        data: {
          result: {
            componentConfig: { componentType: 'card' },
            pageConfig: mockPageConfig(),
            layoutConfig: JSON.stringify({ modules: [] }),
          },
          intentCode: 'PAGE_COMPONENT_ADD',
        },
      };

      mock.onPost(/\/api\/mobile\/.*\/ai\/intent\/execute/).reply((config) => {
        const requestData = JSON.parse(config.data);
        expect(requestData.context).toHaveProperty('targetPosition', targetPosition);
        return [200, mockAIResponse];
      });

      const result = await lowcodeApiClient.aiAddComponent(DEFAULT_FACTORY_ID, {
        pageId: TEST_PAGE_ID,
        prompt: '在指定位置添加卡片',
        targetPosition,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('aiUpdateStyle', () => {
    it('应该成功调用AI更新样式', async () => {
      const mockAIResponse = {
        success: true,
        data: {
          result: {
            pageConfig: mockPageConfig(),
            layoutConfig: JSON.stringify({ modules: [] }),
            themeConfig: JSON.stringify({
              primaryColor: '#52c41a',
              backgroundColor: '#f0f5ff',
            }),
            explanation: '已将主题色更改为绿色系',
          },
          intentCode: 'PAGE_STYLE_UPDATE',
        },
      };

      mockSuccessResponse(
        mock,
        'post',
        `/api/mobile/${DEFAULT_FACTORY_ID}/ai/intent/execute`,
        mockAIResponse
      );

      const result = await lowcodeApiClient.aiUpdateStyle(DEFAULT_FACTORY_ID, {
        pageId: TEST_PAGE_ID,
        prompt: '将主题色改为绿色',
      });

      expect(result.success).toBe(true);
      expect(result.data?.explanation).toContain('绿色');
    });

    it('应该返回建议的后续操作', async () => {
      const mockAIResponse = {
        success: true,
        data: {
          result: {
            pageConfig: mockPageConfig(),
            themeConfig: JSON.stringify({ primaryColor: '#1890ff' }),
            suggestedActions: [
              {
                actionCode: 'ADJUST_FONT',
                actionName: '调整字体',
                description: '建议同时调整字体大小以匹配新风格',
              },
            ],
          },
          intentCode: 'PAGE_STYLE_UPDATE',
        },
      };

      mockSuccessResponse(
        mock,
        'post',
        `/api/mobile/${DEFAULT_FACTORY_ID}/ai/intent/execute`,
        mockAIResponse
      );

      const result = await lowcodeApiClient.aiUpdateStyle(DEFAULT_FACTORY_ID, {
        pageId: TEST_PAGE_ID,
        prompt: '优化页面风格',
      });

      expect(result.success).toBe(true);
      expect(result.data?.suggestedActions).toHaveLength(1);
      expect(result.data?.suggestedActions?.[0]?.actionCode).toBe('ADJUST_FONT');
    });

    it('应该在AI服务错误时抛出异常', async () => {
      mockErrorResponse(
        mock,
        'post',
        `/api/mobile/${DEFAULT_FACTORY_ID}/ai/intent/execute`,
        'AI服务内部错误',
        500
      );

      await expect(
        lowcodeApiClient.aiUpdateStyle(DEFAULT_FACTORY_ID, {
          pageId: TEST_PAGE_ID,
          prompt: '更新样式',
        })
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('边界情况', () => {
    it('应该支持不同的工厂ID', async () => {
      const customFactoryId = mockFactoryId();
      const mockResponse = {
        success: true,
        data: [],
      };

      mockSuccessResponse(
        mock,
        'get',
        `/api/mobile/${customFactoryId}/lowcode/pages`,
        mockResponse
      );

      const result = await lowcodeApiClient.getPages(customFactoryId);

      expect(result.success).toBe(true);
    });

    it('应该正确处理包含特殊字符的pageId', async () => {
      const specialPageId = 'page-with-dash_and_underscore';
      const mockPage = mockPageConfig({ pageId: specialPageId });
      const mockResponse = {
        success: true,
        data: mockPage,
      };

      mockSuccessResponse(
        mock,
        'get',
        `/api/mobile/${DEFAULT_FACTORY_ID}/lowcode/pages/${specialPageId}`,
        mockResponse
      );

      const result = await lowcodeApiClient.getPage(DEFAULT_FACTORY_ID, specialPageId);

      expect(result.success).toBe(true);
      expect(result.data?.pageId).toBe(specialPageId);
    });
  });
});
