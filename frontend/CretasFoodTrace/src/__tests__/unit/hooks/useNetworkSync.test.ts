// @ts-nocheck
/**
 * useNetworkSync 单元测试
 * 测试网络同步hook：待同步计数、草稿同步、错误处理
 */

import { renderHook, act } from '@testing-library/react-native';

const mockRemoveDraft = jest.fn();
let mockDrafts: any[] = [];

jest.mock('../../../store/draftReportStore', () => ({
  useDraftReportStore: () => ({
    drafts: mockDrafts,
    removeDraft: mockRemoveDraft,
  }),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

import { useNetworkSync } from '../../../hooks/useNetworkSync';

const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';

// Get reference to mock apiClient for per-test control
const mockApiClient = require('../../../services/api/apiClient').apiClient;

beforeEach(() => {
  jest.clearAllMocks();
  mockDrafts = [];
});

describe('useNetworkSync', () => {
  // ========== pendingCount ==========
  describe('pendingCount', () => {
    it('should return 0 when no drafts exist', () => {
      mockDrafts = [];

      const { result } = renderHook(() => useNetworkSync());
      expect(result.current.pendingCount).toBe(0);
    });

    it('should count only drafts matching current factoryId', () => {
      mockDrafts = [
        { id: 'd1', factoryId: DEFAULT_FACTORY_ID, batchId: 1, outputQuantity: 10, goodQuantity: 10, defectQuantity: 0, notes: '' },
        { id: 'd2', factoryId: DEFAULT_FACTORY_ID, batchId: 2, outputQuantity: 20, goodQuantity: 18, defectQuantity: 2, notes: '' },
        { id: 'd3', factoryId: 'OTHER_FACTORY', batchId: 3, outputQuantity: 5, goodQuantity: 5, defectQuantity: 0, notes: '' },
      ];

      const { result } = renderHook(() => useNetworkSync());
      expect(result.current.pendingCount).toBe(2);
    });

    it('should return 0 when all drafts belong to other factories', () => {
      mockDrafts = [
        { id: 'd1', factoryId: 'OTHER_FACTORY', batchId: 1, outputQuantity: 10, goodQuantity: 10, defectQuantity: 0, notes: '' },
      ];

      const { result } = renderHook(() => useNetworkSync());
      expect(result.current.pendingCount).toBe(0);
    });
  });

  // ========== syncDrafts ==========
  describe('syncDrafts', () => {
    it('should skip when no drafts exist', async () => {
      mockDrafts = [];

      const { result } = renderHook(() => useNetworkSync());
      await act(async () => {
        await result.current.syncDrafts();
      });

      expect(mockRemoveDraft).not.toHaveBeenCalled();
    });

    it('should POST each draft to the batch report API', async () => {
      mockDrafts = [
        { id: 'd1', factoryId: DEFAULT_FACTORY_ID, batchId: 101, outputQuantity: 50, goodQuantity: 48, defectQuantity: 2, notes: '正常' },
      ];

      // Mock successful post
      const originalPost = mockApiClient.post;
      mockApiClient.post = jest.fn().mockResolvedValue({ success: true, data: {} });

      const { result } = renderHook(() => useNetworkSync());
      await act(async () => {
        await result.current.syncDrafts();
      });

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/api/mobile/${DEFAULT_FACTORY_ID}/processing/batches/101/report`,
        expect.objectContaining({
          actualQuantity: 50,
          goodQuantity: 48,
          defectQuantity: 2,
          notes: '正常',
        })
      );

      mockApiClient.post = originalPost;
    });

    it('should call removeDraft on successful sync', async () => {
      mockDrafts = [
        { id: 'd1', factoryId: DEFAULT_FACTORY_ID, batchId: 101, outputQuantity: 50, goodQuantity: 50, defectQuantity: 0, notes: '' },
      ];

      const originalPost = mockApiClient.post;
      mockApiClient.post = jest.fn().mockResolvedValue({ success: true, data: {} });

      const { result } = renderHook(() => useNetworkSync());
      await act(async () => {
        await result.current.syncDrafts();
      });

      expect(mockRemoveDraft).toHaveBeenCalledWith('d1');

      mockApiClient.post = originalPost;
    });

    it('should not call removeDraft when API errors occur', async () => {
      mockDrafts = [
        { id: 'd1', factoryId: DEFAULT_FACTORY_ID, batchId: 101, outputQuantity: 50, goodQuantity: 50, defectQuantity: 0, notes: '' },
      ];

      const originalPost = mockApiClient.post;
      mockApiClient.post = jest.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useNetworkSync());
      await act(async () => {
        await result.current.syncDrafts();
      });

      expect(mockRemoveDraft).not.toHaveBeenCalled();

      mockApiClient.post = originalPost;
    });

    it('should skip drafts with different factoryId', async () => {
      mockDrafts = [
        { id: 'd1', factoryId: 'OTHER_FACTORY', batchId: 101, outputQuantity: 50, goodQuantity: 50, defectQuantity: 0, notes: '' },
      ];

      const originalPost = mockApiClient.post;
      mockApiClient.post = jest.fn().mockResolvedValue({ success: true, data: {} });

      const { result } = renderHook(() => useNetworkSync());
      await act(async () => {
        await result.current.syncDrafts();
      });

      expect(mockApiClient.post).not.toHaveBeenCalled();

      mockApiClient.post = originalPost;
    });

    it('should handle mixed success and failure across drafts', async () => {
      mockDrafts = [
        { id: 'd1', factoryId: DEFAULT_FACTORY_ID, batchId: 101, outputQuantity: 50, goodQuantity: 50, defectQuantity: 0, notes: '' },
        { id: 'd2', factoryId: DEFAULT_FACTORY_ID, batchId: 102, outputQuantity: 30, goodQuantity: 28, defectQuantity: 2, notes: '' },
      ];

      const originalPost = mockApiClient.post;
      let callCount = 0;
      mockApiClient.post = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve({ success: true, data: {} });
        return Promise.reject(new Error('fail'));
      });

      const { result } = renderHook(() => useNetworkSync());
      await act(async () => {
        await result.current.syncDrafts();
      });

      // Only first draft removed
      expect(mockRemoveDraft).toHaveBeenCalledTimes(1);
      expect(mockRemoveDraft).toHaveBeenCalledWith('d1');

      mockApiClient.post = originalPost;
    });
  });
});
