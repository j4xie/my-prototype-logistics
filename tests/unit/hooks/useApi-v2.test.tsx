/**
 * useApi-v2 Hook测试 - 验证无限循环修复
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useSimpleApi, useTraceV2, useProductV2, clearAllCache } from '@/hooks/useApi-v2';

// Mock服务
const mockTraceService = {
  getTraces: jest.fn(),
  getTrace: jest.fn(),
  searchTraces: jest.fn(),
};

const mockProductService = {
  getProducts: jest.fn(),
  getProduct: jest.fn(),
  getCategories: jest.fn(),
};

jest.mock('@/services/http-service', () => ({
  HttpServiceFactory: {
    createTraceService: () => mockTraceService,
    createProductService: () => mockProductService,
  }
}));

describe('useSimpleApi - 修复版本', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllCache();
  });

  it('应该能正常获取数据而不引发无限循环', async () => {
    const mockData = { id: 1, name: 'test' };
    const apiCall = jest.fn().mockResolvedValue(mockData);

    const { result } = renderHook(() => useSimpleApi(apiCall, {
      immediate: true
    }));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
      expect(result.current.loading).toBe(false);
      expect(result.current.status).toBe('success');
    });

    // 验证apiCall只被调用一次，没有无限循环
    expect(apiCall).toHaveBeenCalledTimes(1);
  });

  it('应该正确处理参数变化', async () => {
    const mockData1 = { id: 1, name: 'test1' };
    const mockData2 = { id: 2, name: 'test2' };
    
    let params = { id: 1 };
    const apiCall = jest.fn();
    apiCall.mockResolvedValueOnce(mockData1).mockResolvedValueOnce(mockData2);

    const { result, rerender } = renderHook(() => 
      useSimpleApi(() => Promise.resolve(params.id === 1 ? mockData1 : mockData2), {
        cacheKey: `test-${params.id}`,
        immediate: true
      })
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData1);
    });

    // 改变参数
    params = { id: 2 };
    rerender();

    // 手动触发refetch来模拟参数变化
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData2);
    });
  });

  it('应该能处理错误而不引发无限循环', async () => {
    const error = new Error('API Error');
    const apiCall = jest.fn().mockRejectedValue(error);

    const { result } = renderHook(() => useSimpleApi(apiCall, {
      immediate: true,
      retry: false // 禁用重试以便测试
    }));

    await waitFor(() => {
      expect(result.current.error).toEqual(error);
      expect(result.current.status).toBe('error');
    });

    // 验证只调用一次，没有无限重试
    expect(apiCall).toHaveBeenCalledTimes(1);
  });
});

describe('useTraceV2 - 修复版本', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllCache();
  });

  it('应该能正常获取溯源数据', async () => {
    const mockTraces = [{ id: 1, batchCode: 'B001' }];
    mockTraceService.getTraces.mockResolvedValue(mockTraces);

    const { result } = renderHook(() => useTraceV2().useTraces({ page: 1 }));

    await waitFor(() => {
      expect(result.current.data).toEqual(mockTraces);
      expect(result.current.status).toBe('success');
    });

    // 验证服务只被调用一次
    expect(mockTraceService.getTraces).toHaveBeenCalledTimes(1);
    expect(mockTraceService.getTraces).toHaveBeenCalledWith({ page: 1 });
  });

  it('应该能获取单个溯源', async () => {
    const mockTrace = { id: '123', batchCode: 'B001' };
    mockTraceService.getTrace.mockResolvedValue(mockTrace);

    const { result } = renderHook(() => useTraceV2().useTrace('123'));

    await waitFor(() => {
      expect(result.current.data).toEqual(mockTrace);
      expect(result.current.status).toBe('success');
    });

    expect(mockTraceService.getTrace).toHaveBeenCalledTimes(1);
    expect(mockTraceService.getTrace).toHaveBeenCalledWith('123');
  });
});

describe('useProductV2 - 修复版本', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllCache();
  });

  it('应该能正常获取产品数据', async () => {
    const mockProducts = [{ id: 1, name: 'Product 1' }];
    mockProductService.getProducts.mockResolvedValue(mockProducts);

    const { result } = renderHook(() => useProductV2().useProducts({ page: 1 }));

    await waitFor(() => {
      expect(result.current.data).toEqual(mockProducts);
      expect(result.current.status).toBe('success');
    });

    expect(mockProductService.getProducts).toHaveBeenCalledTimes(1);
    expect(mockProductService.getProducts).toHaveBeenCalledWith({ page: 1 });
  });

  it('应该能获取产品分类', async () => {
    const mockCategories = ['food', 'drink'];
    mockProductService.getCategories.mockResolvedValue(mockCategories);

    const { result } = renderHook(() => useProductV2().useCategories());

    await waitFor(() => {
      expect(result.current.data).toEqual(mockCategories);
      expect(result.current.status).toBe('success');
    });

    expect(mockProductService.getCategories).toHaveBeenCalledTimes(1);
  });
});

describe('缓存功能 - 修复版本', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllCache();
  });

  it('应该正确使用缓存', async () => {
    const mockData = { id: 1, name: 'cached' };
    const apiCall = jest.fn().mockResolvedValue(mockData);

    // 第一次调用
    const { result: result1 } = renderHook(() => useSimpleApi(apiCall, {
      cacheKey: 'test-cache',
      immediate: true
    }));

    await waitFor(() => {
      expect(result1.current.data).toEqual(mockData);
    });

    // 第二次调用应该使用缓存
    const { result: result2 } = renderHook(() => useSimpleApi(apiCall, {
      cacheKey: 'test-cache',
      immediate: true
    }));

    await waitFor(() => {
      expect(result2.current.data).toEqual(mockData);
    });

    // 验证apiCall只被调用一次（第二次使用了缓存）
    expect(apiCall).toHaveBeenCalledTimes(1);
  });
}); 