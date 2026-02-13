/**
 * DynamicReportScreen 集成测试 (RNTL)
 * 测试动态报工页面的渲染、表单交互、提交、草稿保存
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import DynamicReportScreen from '../../../screens/processing/DynamicReportScreen';
import { workReportingApiClient } from '../../../services/api/workReportingApiClient';
import { useDraftReportStore } from '../../../store/draftReportStore';
import { useAuthStore } from '../../../store/authStore';
import type { FactoryUser } from '../../../types/auth';

// Mock workReportingApiClient
jest.mock('../../../services/api/workReportingApiClient', () => ({
  workReportingApiClient: {
    getSchema: jest.fn(),
    submitReport: jest.fn(),
  },
}));

// Mock fieldVisibilityStore
jest.mock('../../../store/fieldVisibilityStore', () => ({
  useFieldVisibilityStore: jest.fn(() => ({
    isFieldVisible: jest.fn(() => true),
  })),
}));

// Mock formatters
jest.mock('../../../utils/formatters', () => ({
  formatDate: jest.fn((input: string) => input || '2026-02-13'),
  formatDateTime: jest.fn(() => '2026-02-13 10:00'),
  formatNumberWithCommas: jest.fn((v: number) => String(v)),
}));

// Override the navigation mock to support reportType param
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    setOptions: jest.fn(),
    addListener: jest.fn(),
  }),
  useRoute: () => ({
    params: { reportType: 'PROGRESS' },
  }),
}));

const mockedApiClient = workReportingApiClient as jest.Mocked<typeof workReportingApiClient>;

describe('DynamicReportScreen', () => {
  const mockFactoryUser: FactoryUser = {
    id: 22,
    username: 'workshop_sup1',
    email: 'ws1@cretas.com',
    fullName: '王主管',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    userType: 'factory',
    factoryId: 'F001',
    factoryUser: {
      role: 'workshop_supervisor',
      factoryId: 'F001',
      permissions: [],
    },
  };

  const mockSchema = {
    success: true,
    code: 200,
    message: '成功',
    data: {
      id: 'tpl_1',
      name: '生产进度报工模板',
      entityType: 'PRODUCTION_PROGRESS_REPORT',
      schemaJson: JSON.stringify({
        fields: [
          { key: 'processCategory', label: '生产类目', type: 'text', required: true },
          { key: 'outputQuantity', label: '产品数量', type: 'integer', required: false },
        ],
      }),
      isActive: true,
      version: 1,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: mockFactoryUser,
      isAuthenticated: true,
      tokens: null,
      isLoading: false,
    });
    useDraftReportStore.getState().clearDrafts();
    mockedApiClient.getSchema.mockResolvedValue(mockSchema);
  });

  // ========== 渲染 ==========
  describe('渲染', () => {
    it('应该显示加载指示器，然后渲染表单', async () => {
      render(<DynamicReportScreen />);

      // Schema加载完成后应该看到标题
      await waitFor(() => {
        expect(screen.getByText('实时生产进度上报')).toBeTruthy();
      });
    });

    it('PROGRESS模式应该显示生产类目/工序字段', async () => {
      render(<DynamicReportScreen />);

      await waitFor(() => {
        expect(screen.getByText(/生产类目\/工序/)).toBeTruthy();
      });

      // 应该显示良品数和不良品数
      expect(screen.getByPlaceholderText('良品')).toBeTruthy();
      expect(screen.getByPlaceholderText('不良')).toBeTruthy();
    });

    it('应该显示报工日期（只读）', async () => {
      render(<DynamicReportScreen />);

      await waitFor(() => {
        expect(screen.getByText('报工日期')).toBeTruthy();
      });
    });

    it('应该显示备注字段', async () => {
      render(<DynamicReportScreen />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('备注信息（选填）')).toBeTruthy();
      });
    });

    it('应该显示提交按钮', async () => {
      render(<DynamicReportScreen />);

      await waitFor(() => {
        expect(screen.getByText('提交报工')).toBeTruthy();
      });
    });
  });

  // ========== 表单填写 ==========
  describe('表单填写', () => {
    it('应该能输入生产类目', async () => {
      render(<DynamicReportScreen />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('输入生产类目或工序')).toBeTruthy();
      });

      const input = screen.getByPlaceholderText('输入生产类目或工序');
      fireEvent.changeText(input, '切割工序');

      expect(input.props.value).toBe('切割工序');
    });

    it('应该能输入数量字段', async () => {
      render(<DynamicReportScreen />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('输入数量')).toBeTruthy();
      });

      fireEvent.changeText(screen.getByPlaceholderText('输入数量'), '100');
      fireEvent.changeText(screen.getByPlaceholderText('良品'), '95');
      fireEvent.changeText(screen.getByPlaceholderText('不良'), '5');

      expect(screen.getByPlaceholderText('输入数量').props.value).toBe('100');
      expect(screen.getByPlaceholderText('良品').props.value).toBe('95');
      expect(screen.getByPlaceholderText('不良').props.value).toBe('5');
    });

    it('应该能输入备注', async () => {
      render(<DynamicReportScreen />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('备注信息（选填）')).toBeTruthy();
      });

      fireEvent.changeText(screen.getByPlaceholderText('备注信息（选填）'), '今日产量正常');
      expect(screen.getByPlaceholderText('备注信息（选填）').props.value).toBe('今日产量正常');
    });
  });

  // ========== 提交 ==========
  describe('提交', () => {
    it('生产类目为空时应阻止提交并显示提示', async () => {
      render(<DynamicReportScreen />);

      await waitFor(() => {
        expect(screen.getByText('提交报工')).toBeTruthy();
      });

      // 不填写生产类目，直接提交
      fireEvent.press(screen.getByText('提交报工'));

      expect(Alert.alert).toHaveBeenCalledWith('提示', '请填写生产类目/工序');
      expect(mockedApiClient.submitReport).not.toHaveBeenCalled();
    });

    it('填写完成后应成功提交', async () => {
      mockedApiClient.submitReport.mockResolvedValueOnce({
        success: true,
        code: 200,
        message: '成功',
        data: {
          id: 1,
          factoryId: 'F001',
          workerId: 22,
          reportType: 'PROGRESS' as const,
          reportDate: '2026-02-13',
          status: 'SUBMITTED' as const,
          syncedToSmartbi: false,
          createdAt: '2026-02-13T10:00:00Z',
          updatedAt: '2026-02-13T10:00:00Z',
        },
      });

      render(<DynamicReportScreen />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('输入生产类目或工序')).toBeTruthy();
      });

      fireEvent.changeText(screen.getByPlaceholderText('输入生产类目或工序'), '切割');
      fireEvent.changeText(screen.getByPlaceholderText('输入数量'), '100');
      fireEvent.changeText(screen.getByPlaceholderText('良品'), '95');
      fireEvent.changeText(screen.getByPlaceholderText('不良'), '5');

      fireEvent.press(screen.getByText('提交报工'));

      await waitFor(() => {
        expect(mockedApiClient.submitReport).toHaveBeenCalled();
      });

      // 成功后应该显示成功Alert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '成功',
          '报工提交成功',
          expect.any(Array)
        );
      });
    });

    it('网络错误应保存草稿', async () => {
      mockedApiClient.submitReport.mockRejectedValueOnce(new Error('网络错误'));

      render(<DynamicReportScreen />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('输入生产类目或工序')).toBeTruthy();
      });

      fireEvent.changeText(screen.getByPlaceholderText('输入生产类目或工序'), '包装');
      fireEvent.press(screen.getByText('提交报工'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('提交失败', expect.any(String));
      });

      // 应该保存了一个草稿
      const drafts = useDraftReportStore.getState().drafts;
      expect(drafts).toHaveLength(1);
    });
  });

  // ========== HOURS模式差异 ==========
  describe('HOURS模式表单差异', () => {
    beforeEach(() => {
      // 切换到HOURS模式
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { reportType: 'HOURS' },
      });

      mockedApiClient.getSchema.mockResolvedValue({
        ...mockSchema,
        data: {
          ...mockSchema.data,
          entityType: 'PRODUCTION_HOURS_REPORT',
          name: '工时报工模板',
        },
      });
    });

    it('HOURS模式应该显示商品名称字段', async () => {
      render(<DynamicReportScreen />);

      await waitFor(() => {
        expect(screen.getByText('商品名称')).toBeTruthy();
      });

      expect(screen.getByPlaceholderText('输入商品名称')).toBeTruthy();
    });

    it('HOURS模式应该显示工时明细', async () => {
      render(<DynamicReportScreen />);

      await waitFor(() => {
        expect(screen.getByText('工时明细')).toBeTruthy();
      });

      // 应该显示正式工/小时工/日结工
      expect(screen.getByText('正式工')).toBeTruthy();
      expect(screen.getByText('小时工')).toBeTruthy();
      expect(screen.getByText('日结工')).toBeTruthy();
    });

    it('HOURS模式应该显示时间范围字段', async () => {
      render(<DynamicReportScreen />);

      await waitFor(() => {
        expect(screen.getByText('开始时间')).toBeTruthy();
      });

      expect(screen.getByText('结束时间')).toBeTruthy();
    });

    it('HOURS模式应该显示操作量字段', async () => {
      render(<DynamicReportScreen />);

      await waitFor(() => {
        expect(screen.getByText('操作量')).toBeTruthy();
      });

      expect(screen.getByPlaceholderText('输入操作量')).toBeTruthy();
    });

    it('HOURS模式不填商品名称应阻止提交', async () => {
      render(<DynamicReportScreen />);

      await waitFor(() => {
        expect(screen.getByText('提交报工')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('提交报工'));

      expect(Alert.alert).toHaveBeenCalledWith('提示', '请填写商品名称');
    });
  });
});
