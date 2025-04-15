/**
 * @file 溯源记录详情组件异步功能测试
 * @description 测试溯源记录详情组件的异步验证、导出和分享功能
 * @version 1.0.0
 */

import { TraceRecordDetails } from '../../../components/modules/trace/TraceRecordDetails';
import { traceData } from '../../../components/modules/data/data';
import { traceUtils } from '../../../components/modules/utils/utils';

// 模拟依赖模块
jest.mock('../../../components/modules/data/data', () => ({
  traceData: {
    getTraceRecord: jest.fn(),
    getTraceRecordsByProduct: jest.fn(),
    getTraceRecordsByBatch: jest.fn(),
    verifyRecord: jest.fn(),
    exportRecord: jest.fn(),
    shareRecord: jest.fn(),
    generateRecordQRCode: jest.fn()
  }
}));

jest.mock('../../../components/modules/utils/utils', () => ({
  traceUtils: {
    generateUUID: jest.fn().mockReturnValue('mock-uuid-123'),
    formatDate: jest.fn(date => date.toISOString())
  }
}));

jest.mock('../../../components/modules/trace/TraceRecordView', () => ({
  TraceRecordView: {
    init: jest.fn().mockReturnValue({
      renderDetail: jest.fn(),
      renderList: jest.fn(),
      renderStatusTag: jest.fn()
    })
  }
}));

// 模拟记录数据
const mockRecord = {
  id: 'record-001',
  productId: 'product-001',
  batchNumber: 'BATCH-2025-05',
  productName: '有机草莓',
  productType: '水果',
  operation: '收获',
  operator: '张三',
  location: '浙江省杭州市',
  timestamp: '2025-05-16T10:30:00Z',
  status: 'completed',
  details: {
    notes: '按标准流程收获',
    attachments: ['image1.jpg'],
    verificationStatus: 'pending'
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

// 模拟验证结果
const mockVerifyResult = {
  ...mockRecord,
  verified: true,
  blockchainId: 'bc-12345',
  verifiedAt: '2025-05-18T09:30:00Z',
  verifiedBy: 'system',
  details: {
    ...mockRecord.details,
    verificationStatus: 'verified'
  }
};

describe('溯源记录详情组件异步功能测试', () => {
  let detailsComponent;
  let container;
  let mockCallbacks;
  
  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 初始化测试DOM环境
    document.body.innerHTML = '<div id="test-container"></div>';
    container = document.getElementById('test-container');
    
    // 重置模拟API的返回值
    traceData.getTraceRecord.mockResolvedValue(mockRecord);
    traceData.getTraceRecordsByProduct.mockResolvedValue(mockRelatedRecords);
    traceData.getTraceRecordsByBatch.mockResolvedValue(mockRelatedRecords);
    traceData.verifyRecord.mockResolvedValue(mockVerifyResult);
    traceData.exportRecord.mockResolvedValue('https://example.com/exports/record-001.pdf');
    traceData.shareRecord.mockResolvedValue({ url: 'https://share.example.com/r/record-001', expiresAt: '2025-06-18T09:30:00Z' });
    traceData.generateRecordQRCode.mockResolvedValue('data:image/png;base64,mockQRImageData');
    
    // 模拟回调函数
    mockCallbacks = {
      onLoad: jest.fn(),
      onVerify: jest.fn(),
      onExport: jest.fn(),
      onShare: jest.fn(),
      onError: jest.fn()
    };
    
    // 初始化详情组件
    detailsComponent = TraceRecordDetails.init({
      callbacks: mockCallbacks
    });
  });
  
  describe('验证功能测试', () => {
    test('应正确处理异步验证成功', async () => {
      // 先加载记录
      await detailsComponent.load('record-001');
      
      // 验证记录
      const result = await detailsComponent.verify();
      
      // 检查验证结果
      expect(result).toEqual(mockVerifyResult);
      expect(traceData.verifyRecord).toHaveBeenCalledWith('record-001');
      expect(mockCallbacks.onVerify).toHaveBeenCalledWith(mockVerifyResult);
    });
    
    test('应正确处理验证过程中的错误', async () => {
      // 先加载记录
      await detailsComponent.load('record-001');
      
      // 模拟验证失败
      const errorMessage = '区块链服务不可用';
      traceData.verifyRecord.mockRejectedValueOnce(new Error(errorMessage));
      
      // 执行验证并捕获错误
      await expect(detailsComponent.verify()).rejects.toThrow(errorMessage);
      expect(mockCallbacks.onError).toHaveBeenCalled();
      
      // 确保错误消息被正确设置
      detailsComponent.renderTo(container);
      expect(container.textContent).toContain('验证记录失败');
    });
    
    test('已验证的记录应直接返回而不再次验证', async () => {
      // 先加载一个已验证的记录
      const verifiedRecord = { ...mockRecord, verified: true };
      traceData.getTraceRecord.mockResolvedValueOnce(verifiedRecord);
      await detailsComponent.load('record-001');
      
      // 验证记录
      await detailsComponent.verify();
      
      // 验证API不应被调用
      expect(traceData.verifyRecord).not.toHaveBeenCalled();
    });
  });
  
  describe('导出功能测试', () => {
    test('应支持多种导出格式', async () => {
      // 先加载记录
      await detailsComponent.load('record-001');
      
      // 导出不同格式
      const formats = ['pdf', 'json', 'csv'];
      
      for (const format of formats) {
        const mockUrl = `https://example.com/exports/record-001.${format}`;
        traceData.exportRecord.mockResolvedValueOnce(mockUrl);
        
        const result = await detailsComponent.exportRecord(format);
        expect(result).toBe(mockUrl);
        expect(traceData.exportRecord).toHaveBeenCalledWith('record-001', format);
        expect(mockCallbacks.onExport).toHaveBeenCalledWith(mockUrl, format);
      }
    });
    
    test('应正确处理导出过程中的错误', async () => {
      // 先加载记录
      await detailsComponent.load('record-001');
      
      // 模拟导出失败
      const errorMessage = '服务器错误';
      traceData.exportRecord.mockRejectedValueOnce(new Error(errorMessage));
      
      // 执行导出并捕获错误
      await expect(detailsComponent.exportRecord('pdf')).rejects.toThrow(errorMessage);
      expect(mockCallbacks.onError).toHaveBeenCalled();
    });
  });
  
  describe('分享功能测试', () => {
    test('应支持多种分享方式', async () => {
      // 先加载记录
      await detailsComponent.load('record-001');
      
      // 分享不同方式
      const methods = ['link', 'email', 'qrcode'];
      
      for (const method of methods) {
        const mockResult = {
          url: `https://share.example.com/r/record-001/${method}`,
          expiresAt: '2025-06-18T09:30:00Z',
          method
        };
        traceData.shareRecord.mockResolvedValueOnce(mockResult);
        
        const result = await detailsComponent.shareRecord(method);
        expect(result).toEqual(mockResult);
        expect(traceData.shareRecord).toHaveBeenCalledWith('record-001', method);
        expect(mockCallbacks.onShare).toHaveBeenCalledWith(mockResult, method);
      }
    });
    
    test('应正确处理分享过程中的错误', async () => {
      // 先加载记录
      await detailsComponent.load('record-001');
      
      // 模拟分享失败
      const errorMessage = '无法连接到分享服务';
      traceData.shareRecord.mockRejectedValueOnce(new Error(errorMessage));
      
      // 执行分享并捕获错误
      await expect(detailsComponent.shareRecord('link')).rejects.toThrow(errorMessage);
      expect(mockCallbacks.onError).toHaveBeenCalled();
    });
  });
  
  describe('QR码生成测试', () => {
    test('应可以配置QR码生成选项', async () => {
      // 先加载记录
      await detailsComponent.load('record-001');
      
      // 生成QR码
      const options = {
        size: 300,
        includeProductInfo: true,
        includeBatchInfo: true,
        color: '#00467F'
      };
      
      await detailsComponent.generateQRCode(options);
      
      expect(traceData.generateRecordQRCode).toHaveBeenCalledWith(
        'record-001',
        expect.objectContaining(options)
      );
    });
    
    test('应正确处理QR码生成错误', async () => {
      // 先加载记录
      await detailsComponent.load('record-001');
      
      // 模拟QR码生成失败
      const errorMessage = 'QR码生成失败';
      traceData.generateRecordQRCode.mockRejectedValueOnce(new Error(errorMessage));
      
      // 执行QR码生成并捕获错误
      await expect(detailsComponent.generateQRCode()).rejects.toThrow(errorMessage);
      expect(mockCallbacks.onError).toHaveBeenCalled();
    });
  });
  
  describe('相关记录加载测试', () => {
    test('应优先使用产品ID加载相关记录', async () => {
      await detailsComponent.load('record-001');
      expect(traceData.getTraceRecordsByProduct).toHaveBeenCalledWith('product-001');
      expect(traceData.getTraceRecordsByBatch).not.toHaveBeenCalled();
    });
    
    test('没有产品ID时应使用批次号加载相关记录', async () => {
      // 模拟一个没有产品ID但有批次号的记录
      const batchRecord = { ...mockRecord, productId: null };
      traceData.getTraceRecord.mockResolvedValueOnce(batchRecord);
      
      await detailsComponent.load('record-001');
      expect(traceData.getTraceRecordsByProduct).not.toHaveBeenCalled();
      expect(traceData.getTraceRecordsByBatch).toHaveBeenCalledWith('BATCH-2025-05');
    });
    
    test('相关记录加载错误不应阻止主记录加载', async () => {
      // 模拟相关记录加载失败
      traceData.getTraceRecordsByProduct.mockRejectedValueOnce(new Error('加载相关记录失败'));
      
      // 加载记录应该成功
      const record = await detailsComponent.load('record-001');
      expect(record).toEqual(mockRecord);
      
      // 相关记录应为空数组
      expect(detailsComponent.getRelatedRecords()).toEqual([]);
    });
  });
}); 