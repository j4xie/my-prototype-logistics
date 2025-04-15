/**
 * @file 溯源记录详情组件单元测试
 * @description 测试溯源记录详情组件的加载、渲染、验证和导出功能
 * @version 1.0.0
 */

import { TraceRecordDetails } from '../../../components/modules/trace/TraceRecordDetails';
import { traceData } from '../../../components/modules/data/data';
import { TraceRecordView } from '../../../components/modules/trace/TraceRecordView';

// 模拟依赖模块
jest.mock('../../../components/modules/data/data', () => ({
  traceData: {
    getTraceRecord: jest.fn(),
    getRelatedRecords: jest.fn(),
    verifyRecord: jest.fn()
  }
}));

jest.mock('../../../components/modules/trace/TraceRecordView', () => ({
  TraceRecordView: {
    init: jest.fn().mockReturnValue({
      renderDetail: jest.fn(),
      renderStatusTag: jest.fn()
    })
  }
}));

// 模拟记录数据
const mockRecord = {
  id: 'record-001',
  productId: 'product-001',
  productName: '有机草莓',
  operation: '收获',
  operator: '张三',
  location: '浙江省杭州市',
  timestamp: '2025-05-16T10:30:00Z',
  status: 'completed',
  details: {
    notes: '按标准流程收获',
    attachments: ['image1.jpg'],
    verificationStatus: 'verified'
  }
};

const mockRelatedRecords = [
  {
    id: 'record-002',
    productId: 'product-001',
    productName: '有机草莓',
    operation: '包装',
    timestamp: '2025-05-16T14:30:00Z',
    status: 'completed'
  },
  {
    id: 'record-003',
    productId: 'product-001',
    productName: '有机草莓',
    operation: '运输',
    timestamp: '2025-05-17T09:15:00Z',
    status: 'in-transit'
  }
];

describe('溯源记录详情组件测试', () => {
  let detailsComponent;
  let container;
  
  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 初始化测试DOM环境
    document.body.innerHTML = '<div id="test-container"></div>';
    container = document.getElementById('test-container');
    
    // 重置模拟API的返回值
    traceData.getTraceRecord.mockResolvedValue(mockRecord);
    traceData.getRelatedRecords.mockResolvedValue(mockRelatedRecords);
    traceData.verifyRecord.mockResolvedValue({ verified: true, blockchainId: 'bc-12345' });
    
    // 初始化详情组件
    detailsComponent = TraceRecordDetails.init();
  });
  
  describe('初始化测试', () => {
    test('应该使用默认配置初始化组件', () => {
      const details = TraceRecordDetails.init();
      expect(details).toBeDefined();
      expect(details.load).toBeDefined();
      expect(details.refresh).toBeDefined();
      expect(details.renderTo).toBeDefined();
      expect(details.verify).toBeDefined();
      expect(details.exportRecord).toBeDefined();
    });
    
    test('应该使用自定义配置初始化组件', () => {
      const customConfig = {
        enableEdit: true,
        maxRelatedRecords: 10,
        callbacks: {
          onLoad: jest.fn()
        }
      };
      
      const details = TraceRecordDetails.init(customConfig);
      expect(details).toBeDefined();
      
      // 验证配置已应用（通过调用方法间接验证）
      details.setConfig(details.getConfig()); // 获取并设置配置，触发内部处理
      
      // 加载记录后调用回调
      traceData.getTraceRecord.mockResolvedValueOnce(mockRecord);
      return details.load('record-001').then(() => {
        expect(customConfig.callbacks.onLoad).toHaveBeenCalledWith(mockRecord);
      });
    });
  });
  
  describe('记录加载测试', () => {
    test('应该能够成功加载记录', () => {
      return detailsComponent.load('record-001').then(record => {
        expect(record).toEqual(mockRecord);
        expect(traceData.getTraceRecord).toHaveBeenCalledWith('record-001', { useCache: true });
        expect(traceData.getRelatedRecords).toHaveBeenCalled();
      });
    });
    
    test('加载空记录ID应该抛出错误', () => {
      return expect(detailsComponent.load('')).rejects.toThrow('记录ID不能为空');
    });
    
    test('数据源错误应该被正确处理', () => {
      const errorMsg = '网络错误';
      traceData.getTraceRecord.mockRejectedValueOnce(new Error(errorMsg));
      
      const onErrorMock = jest.fn();
      const details = TraceRecordDetails.init({
        callbacks: { onError: onErrorMock }
      });
      
      return details.load('record-001').catch(error => {
        expect(error.message).toBe(errorMsg);
        expect(onErrorMock).toHaveBeenCalled();
      });
    });
    
    test('刷新应该重新加载当前记录', async () => {
      // 先加载一条记录
      await detailsComponent.load('record-001');
      
      // 清除之前的调用记录
      traceData.getTraceRecord.mockClear();
      
      // 刷新记录
      await detailsComponent.refresh();
      
      // 验证是否使用了正确的参数重新调用API
      expect(traceData.getTraceRecord).toHaveBeenCalledWith('record-001', { useCache: false });
    });
    
    test('没有当前记录时刷新应该抛出错误', () => {
      // 直接调用刷新（没有先加载记录）
      return expect(detailsComponent.refresh()).rejects.toThrow('没有当前记录可刷新');
    });
  });
  
  describe('记录渲染测试', () => {
    test('应该将记录渲染到容器中', async () => {
      // 先加载记录
      await detailsComponent.load('record-001');
      
      // 渲染到容器
      detailsComponent.renderTo(container);
      
      // 验证容器中包含记录信息
      expect(container.innerHTML).not.toBe('');
      expect(container.querySelector('.trace-record-details')).not.toBeNull();
    });
    
    test('未加载记录时应显示空状态', () => {
      // 直接渲染（没有先加载记录）
      detailsComponent.renderTo(container);
      
      // 验证显示了空状态
      expect(container.textContent).toContain('未找到溯源记录');
    });
    
    test('记录加载出错时应显示错误信息', async () => {
      // 模拟加载错误
      traceData.getTraceRecord.mockRejectedValueOnce(new Error('加载失败'));
      
      // 尝试加载记录
      try {
        await detailsComponent.load('record-001');
      } catch (error) {
        // 忽略错误，继续测试
      }
      
      // 渲染到容器
      detailsComponent.renderTo(container);
      
      // 验证显示了错误信息
      expect(container.textContent).toContain('加载失败');
    });
    
    test('加载中时应显示加载状态', () => {
      // 创建一个不会立即解决的Promise
      const pendingPromise = new Promise(() => {});
      traceData.getTraceRecord.mockReturnValueOnce(pendingPromise);
      
      // 开始加载记录
      detailsComponent.load('record-001');
      
      // 在加载完成前渲染
      detailsComponent.renderTo(container);
      
      // 验证显示了加载状态
      expect(container.querySelector('.loading-indicator')).not.toBeNull();
    });
  });
  
  describe('记录验证测试', () => {
    test('应该能够验证记录', async () => {
      // 先加载记录
      await detailsComponent.load('record-001');
      
      // 验证记录
      const result = await detailsComponent.verify();
      
      // 检查验证结果
      expect(result.verified).toBe(true);
      expect(result.blockchainId).toBe('bc-12345');
      expect(traceData.verifyRecord).toHaveBeenCalledWith(mockRecord.id);
    });
    
    test('没有当前记录时验证应该失败', async () => {
      await expect(detailsComponent.verify()).rejects.toThrow('没有可验证的记录');
    });
  });
  
  describe('记录导出测试', () => {
    test('应该能够导出记录', async () => {
      // 模拟document.createElement创建的a元素
      const mockAnchor = {
        href: '',
        download: '',
        click: jest.fn(),
        style: {}
      };
      
      // 保存原始方法
      const originalCreateElement = document.createElement;
      
      // 模拟createElement方法
      document.createElement = jest.fn().mockImplementation((tag) => {
        if (tag === 'a') return mockAnchor;
        return originalCreateElement.call(document, tag);
      });
      
      // 先加载记录
      await detailsComponent.load('record-001');
      
      // 导出记录
      detailsComponent.exportRecord('pdf');
      
      // 验证导出逻辑
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockAnchor.download).toContain('有机草莓');
      expect(mockAnchor.click).toHaveBeenCalled();
      
      // 恢复原始方法
      document.createElement = originalCreateElement;
    });
    
    test('没有当前记录时导出应该失败', () => {
      expect(() => detailsComponent.exportRecord()).toThrow('没有可导出的记录');
    });
  });
  
  describe('相关记录测试', () => {
    test('应该加载相关记录', async () => {
      // 加载记录（会自动加载相关记录）
      await detailsComponent.load('record-001');
      
      // 获取相关记录
      const relatedRecords = detailsComponent.getRelatedRecords();
      
      // 验证相关记录
      expect(relatedRecords).toEqual(mockRelatedRecords);
      expect(traceData.getRelatedRecords).toHaveBeenCalledWith(mockRecord.id, expect.any(Object));
    });
    
    test('可以禁用相关记录加载', async () => {
      // 使用自定义配置初始化组件
      const details = TraceRecordDetails.init({
        showRelatedRecords: false
      });
      
      // 加载记录
      await details.load('record-001');
      
      // 验证不会加载相关记录
      expect(traceData.getRelatedRecords).not.toHaveBeenCalled();
    });
  });
}); 