/**
 * @file 溯源记录与产品管理集成测试
 * @description 测试溯源记录模块与产品管理模块的集成功能
 * @version 1.0.0
 */

import { traceData } from '../../components/modules/data/data';
import { traceStore } from '../../components/modules/store/store';
import { TraceRecordDetails } from '../../components/modules/trace/TraceRecordDetails';
import { TraceRecordView } from '../../components/modules/trace/TraceRecordView';
import { productManager } from '../../components/modules/product/productManager';

// 模拟依赖模块
jest.mock('../../components/modules/data/data', () => ({
  traceData: {
    getTraceRecordsByProduct: jest.fn(),
    getProductById: jest.fn(),
    getTraceRecord: jest.fn(),
    searchProducts: jest.fn(),
    getRelatedRecords: jest.fn()
  }
}));

jest.mock('../../components/modules/store/store', () => ({
  traceStore: {
    get: jest.fn(),
    set: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
  }
}));

// 模拟数据
const mockProducts = [
  {
    id: 'product-001',
    name: '有机草莓',
    category: '水果',
    producer: '阳光农场',
    produceDate: '2025-05-10',
    batchNumber: 'B2025051001'
  },
  {
    id: 'product-002',
    name: '有机蓝莓',
    category: '水果',
    producer: '绿源农场',
    produceDate: '2025-05-12',
    batchNumber: 'B2025051202'
  }
];

const mockTraceRecords = [
  {
    id: 'record-001',
    productId: 'product-001',
    productName: '有机草莓',
    operation: '种植',
    operator: '张三',
    location: '浙江省杭州市',
    timestamp: '2025-05-01T08:30:00Z',
    status: 'completed'
  },
  {
    id: 'record-002',
    productId: 'product-001',
    productName: '有机草莓',
    operation: '收获',
    operator: '李四',
    location: '浙江省杭州市',
    timestamp: '2025-05-10T09:15:00Z',
    status: 'completed'
  },
  {
    id: 'record-003',
    productId: 'product-002',
    productName: '有机蓝莓',
    operation: '种植',
    operator: '王五',
    location: '江苏省南京市',
    timestamp: '2025-05-03T07:45:00Z',
    status: 'completed'
  }
];

describe('溯源记录与产品管理集成测试', () => {
  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 设置模拟返回值
    traceData.getProductById.mockImplementation((id) => {
      return Promise.resolve(mockProducts.find(p => p.id === id) || null);
    });
    
    traceData.getTraceRecordsByProduct.mockImplementation((productId) => {
      return Promise.resolve(mockTraceRecords.filter(r => r.productId === productId));
    });
    
    traceData.searchProducts.mockResolvedValue(mockProducts);
    
    // 模拟store.get的行为
    traceStore.get.mockImplementation((key) => {
      if (key === 'ui.selectedProductId') return 'product-001';
      if (key === 'data.products') return mockProducts;
      if (key === 'data.traceRecords') return mockTraceRecords;
      return null;
    });
  });
  
  describe('产品溯源记录查询测试', () => {
    test('应该能够按产品ID查询溯源记录', async () => {
      // 查询特定产品的溯源记录
      const records = await traceData.getTraceRecordsByProduct('product-001');
      
      // 验证记录
      expect(records).toHaveLength(2);
      expect(records[0].productId).toBe('product-001');
      expect(records[1].productId).toBe('product-001');
      
      // 验证API调用
      expect(traceData.getTraceRecordsByProduct).toHaveBeenCalledWith('product-001');
    });
    
    test('应该处理不存在的产品ID', async () => {
      // 设置空记录返回
      traceData.getTraceRecordsByProduct.mockResolvedValueOnce([]);
      
      // 查询不存在的产品的溯源记录
      const records = await traceData.getTraceRecordsByProduct('non-existent');
      
      // 验证返回空数组
      expect(records).toHaveLength(0);
    });
  });
  
  describe('产品与溯源记录状态管理测试', () => {
    test('应该通过Store管理当前选中的产品', () => {
      // 获取当前选中的产品ID
      const selectedProductId = traceStore.get('ui.selectedProductId');
      expect(selectedProductId).toBe('product-001');
      
      // 模拟用户选择新产品
      traceStore.set('ui.selectedProductId', 'product-002');
      
      // 验证set方法被正确调用
      expect(traceStore.set).toHaveBeenCalledWith('ui.selectedProductId', 'product-002');
    });
    
    test('应该能够过滤特定产品的溯源记录', () => {
      // 创建过滤函数
      const filterRecordsByProduct = (productId) => {
        const allRecords = traceStore.get('data.traceRecords') || [];
        if (!productId) return allRecords;
        return allRecords.filter(record => record.productId === productId);
      };
      
      // 过滤产品1的记录
      const product1Records = filterRecordsByProduct('product-001');
      expect(product1Records).toHaveLength(2);
      
      // 过滤产品2的记录
      const product2Records = filterRecordsByProduct('product-002');
      expect(product2Records).toHaveLength(1);
      
      // 不存在的产品
      const noRecords = filterRecordsByProduct('non-existent');
      expect(noRecords).toHaveLength(0);
    });
  });
  
  describe('产品溯源记录详情集成测试', () => {
    let container;
    
    beforeEach(() => {
      // 创建DOM容器
      document.body.innerHTML = '<div id="test-container"></div>';
      container = document.getElementById('test-container');
      
      // 为getTraceRecord设置模拟返回值
      traceData.getTraceRecord.mockImplementation((id) => {
        return Promise.resolve(mockTraceRecords.find(r => r.id === id) || null);
      });
      
      // 为getRelatedRecords设置模拟返回值
      traceData.getRelatedRecords.mockImplementation((recordId) => {
        // 模拟查找相关记录的逻辑
        const record = mockTraceRecords.find(r => r.id === recordId);
        if (!record) return Promise.resolve([]);
        
        // 返回同一产品的其他记录
        return Promise.resolve(
          mockTraceRecords.filter(r => r.productId === record.productId && r.id !== recordId)
        );
      });
    });
    
    test('应该能够获取和显示溯源记录详情', async () => {
      // 初始化详情组件
      const details = TraceRecordDetails.init();
      
      // 加载一条记录
      await details.load('record-001');
      
      // 获取记录
      const record = details.getRecord();
      expect(record).toBeDefined();
      expect(record.id).toBe('record-001');
      expect(record.productName).toBe('有机草莓');
      
      // 验证API调用
      expect(traceData.getTraceRecord).toHaveBeenCalledWith('record-001', expect.any(Object));
    });
    
    test('应该获取相关溯源记录', async () => {
      // 初始化详情组件
      const details = TraceRecordDetails.init();
      
      // 加载一条记录
      await details.load('record-001');
      
      // 获取相关记录
      const relatedRecords = details.getRelatedRecords();
      
      // 验证相关记录
      expect(relatedRecords).toHaveLength(1);
      expect(relatedRecords[0].id).toBe('record-002');
      expect(relatedRecords[0].productId).toBe('product-001');
    });
    
    test('应该能够在产品页面中查看溯源记录', async () => {
      // 模拟产品页面集成
      
      // 1. 模拟从产品管理器获取产品
      traceData.getProductById.mockResolvedValueOnce(mockProducts[0]);
      const product = await traceData.getProductById('product-001');
      
      // 2. 显示产品信息
      const productDiv = document.createElement('div');
      productDiv.innerHTML = `
        <h2>${product.name}</h2>
        <p>生产商: ${product.producer}</p>
        <p>生产日期: ${product.produceDate}</p>
        <p>批次号: ${product.batchNumber}</p>
      `;
      container.appendChild(productDiv);
      
      // 3. 获取该产品的溯源记录
      const records = await traceData.getTraceRecordsByProduct('product-001');
      
      // 4. 显示溯源记录列表
      const recordsDiv = document.createElement('div');
      recordsDiv.className = 'trace-records-container';
      
      records.forEach(record => {
        const recordItem = document.createElement('div');
        recordItem.className = 'trace-record-item';
        recordItem.dataset.recordId = record.id;
        recordItem.innerHTML = `
          <h3>${record.operation}</h3>
          <p>操作员: ${record.operator}</p>
          <p>位置: ${record.location}</p>
          <p>时间: ${record.timestamp}</p>
        `;
        recordsDiv.appendChild(recordItem);
      });
      container.appendChild(recordsDiv);
      
      // 验证UI结果
      expect(container.innerHTML).toContain('有机草莓');
      expect(container.innerHTML).toContain('阳光农场');
      expect(container.querySelectorAll('.trace-record-item').length).toBe(2);
      expect(container.innerHTML).toContain('种植');
      expect(container.innerHTML).toContain('收获');
    });
  });
  
  describe('溯源数据搜索与过滤集成测试', () => {
    test('应该能够搜索产品并显示相关溯源记录', async () => {
      // 模拟实现产品搜索与溯源记录获取的集成功能
      
      // 搜索函数
      async function searchProductsAndRecords(keyword) {
        // 1. 搜索产品
        const matchedProducts = await traceData.searchProducts(keyword);
        
        // 2. 对每个产品获取溯源记录
        const results = await Promise.all(
          matchedProducts.map(async (product) => {
            const records = await traceData.getTraceRecordsByProduct(product.id);
            return {
              product,
              records
            };
          })
        );
        
        return results;
      }
      
      // 执行搜索
      const searchResults = await searchProductsAndRecords('有机');
      
      // 验证结果
      expect(searchResults).toHaveLength(2);
      expect(searchResults[0].product.name).toBe('有机草莓');
      expect(searchResults[0].records).toHaveLength(2);
      expect(searchResults[1].product.name).toBe('有机蓝莓');
      expect(searchResults[1].records).toHaveLength(1);
    });
    
    test('应该能够按操作类型过滤溯源记录', () => {
      // 过滤函数
      function filterRecordsByOperation(records, operation) {
        if (!operation) return records;
        return records.filter(record => record.operation === operation);
      }
      
      // 过滤种植操作
      const plantingRecords = filterRecordsByOperation(mockTraceRecords, '种植');
      expect(plantingRecords).toHaveLength(2);
      expect(plantingRecords[0].operation).toBe('种植');
      expect(plantingRecords[1].operation).toBe('种植');
      
      // 过滤收获操作
      const harvestRecords = filterRecordsByOperation(mockTraceRecords, '收获');
      expect(harvestRecords).toHaveLength(1);
      expect(harvestRecords[0].operation).toBe('收获');
      
      // 不存在的操作
      const noRecords = filterRecordsByOperation(mockTraceRecords, '包装');
      expect(noRecords).toHaveLength(0);
    });
    
    test('应该能够按时间范围过滤溯源记录', () => {
      // 时间范围过滤函数
      function filterRecordsByDateRange(records, startDate, endDate) {
        if (!startDate && !endDate) return records;
        
        return records.filter(record => {
          const recordDate = new Date(record.timestamp);
          if (startDate && recordDate < new Date(startDate)) return false;
          if (endDate && recordDate > new Date(endDate)) return false;
          return true;
        });
      }
      
      // 过滤5月1日至5月5日的记录
      const earlyMayRecords = filterRecordsByDateRange(
        mockTraceRecords,
        '2025-05-01T00:00:00Z',
        '2025-05-05T23:59:59Z'
      );
      expect(earlyMayRecords).toHaveLength(2);
      
      // 过滤5月10日之后的记录
      const lateMayRecords = filterRecordsByDateRange(
        mockTraceRecords,
        '2025-05-10T00:00:00Z',
        null
      );
      expect(lateMayRecords).toHaveLength(1);
      expect(lateMayRecords[0].operation).toBe('收获');
    });
  });
}); 