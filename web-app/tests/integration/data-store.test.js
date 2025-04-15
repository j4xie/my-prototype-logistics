/**
 * 数据模块与Store模块的集成测试
 * @version 1.0.0
 */

import { traceStore } from '../../components/modules/store/store';
import { 
  productMapper, 
  traceRecordMapper,
  mapToDTO,
  mapToEntity
} from '../../components/modules/data/mappers';

// 测试前的初始化
beforeEach(() => {
  // 重置模拟函数
  jest.clearAllMocks();
  
  // 重置Store状态
  traceStore.clear();
  
  // 模拟localStorage
  const mockStorage = (() => {
    let store = {};
    return {
      getItem: jest.fn(key => store[key] || null),
      setItem: jest.fn((key, value) => {
        store[key] = value;
      }),
      removeItem: jest.fn(key => {
        delete store[key];
      })
    };
  })();
  
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage
  });
});

describe('数据模块与Store模块集成测试', () => {
  // 模拟产品数据
  const mockProducts = [
    {
      id: 'p001',
      name: '有机大米',
      description: '纯天然有机大米',
      category: '粮食',
      price: 39.9,
      created_at: '2025-04-01T09:00:00Z'
    },
    {
      id: 'p002',
      name: '有机蔬菜',
      description: '新鲜有机蔬菜',
      category: '蔬菜',
      price: 15.99,
      created_at: '2025-04-03T10:00:00Z'
    }
  ];
  
  // 模拟溯源记录数据
  const mockTraceRecords = [
    {
      id: 'tr001',
      product_id: 'p001',
      timestamp: '2025-03-01T08:00:00Z',
      location: {
        lat: 28.2,
        lng: 112.9,
        address: '湖南省长沙市'
      },
      operation: '种植',
      operator_id: 'u001',
      operator_name: '李四',
      details: { soil: '粘土', seedSource: '本地' },
      verification_status: 'verified'
    },
    {
      id: 'tr002',
      product_id: 'p001',
      timestamp: '2025-03-20T09:30:00Z',
      location: {
        lat: 28.2,
        lng: 112.9,
        address: '湖南省长沙市'
      },
      operation: '施肥',
      operator_id: 'u001',
      operator_name: '李四',
      details: { fertilizer: '有机肥', amount: '100kg' },
      verification_status: 'verified'
    }
  ];
  
  // 测试产品数据与Store集成
  describe('产品数据与Store集成', () => {
    test('应该能够将产品数据存储到Store中', () => {
      // 订阅Store变更
      let storeChanged = false;
      const unsubscribe = traceStore.subscribe('data.products', () => {
        storeChanged = true;
      });
      
      // 转换产品数据并存储到Store
      const productDTOs = mapToDTO(productMapper.toDTO, mockProducts);
      traceStore.set('data.products', productDTOs);
      
      // 验证Store状态被更新
      expect(storeChanged).toBe(true);
      
      // 验证Store中的产品数据
      const storedProducts = traceStore.get('data.products');
      expect(storedProducts).toEqual(productDTOs);
      expect(storedProducts.length).toBe(2);
      expect(storedProducts[0].name).toBe('有机大米');
      expect(storedProducts[1].name).toBe('有机蔬菜');
      
      // 移除订阅
      unsubscribe();
    });
    
    test('从Store中获取产品数据并转换为实体', () => {
      // 先将DTO存储到Store
      const productDTOs = mapToDTO(productMapper.toDTO, mockProducts);
      traceStore.set('data.products', productDTOs);
      
      // 从Store获取并转换为实体
      const storedProducts = traceStore.get('data.products');
      const productEntities = mapToEntity(productMapper.toEntity, storedProducts);
      
      // 验证实体数据
      expect(productEntities.length).toBe(2);
      expect(productEntities[0].id).toBe('p001');
      expect(productEntities[0].name).toBe('有机大米');
      expect(productEntities[0].created_at).toBe('2025-04-01T09:00:00Z');
      expect(productEntities[1].id).toBe('p002');
      expect(productEntities[1].category).toBe('蔬菜');
    });
    
    test('更新Store中的产品数据应该触发订阅回调', () => {
      // 设置回调计数器
      let callCount = 0;
      const unsubscribe = traceStore.subscribe('data.products', () => {
        callCount++;
      });
      
      // 初始设置产品数据
      const productDTOs = mapToDTO(productMapper.toDTO, mockProducts);
      traceStore.set('data.products', productDTOs);
      expect(callCount).toBe(1);
      
      // 更新第一个产品的价格
      traceStore.set('data.products.0.price', 45.9);
      expect(callCount).toBe(2);
      
      // 验证更新后的数据
      const updatedProduct = traceStore.get('data.products.0');
      expect(updatedProduct.price).toBe(45.9);
      
      // 移除订阅
      unsubscribe();
    });
  });
  
  // 测试溯源记录数据与Store集成
  describe('溯源记录数据与Store集成', () => {
    test('应该能够将溯源记录数据存储到Store中', () => {
      // 转换溯源记录数据并存储到Store
      const recordDTOs = mapToDTO(traceRecordMapper.toDTO, mockTraceRecords);
      traceStore.set('data.traceRecords', recordDTOs);
      
      // 验证Store中的溯源记录数据
      const storedRecords = traceStore.get('data.traceRecords');
      expect(storedRecords).toEqual(recordDTOs);
      expect(storedRecords.length).toBe(2);
      expect(storedRecords[0].operation).toBe('种植');
      expect(storedRecords[1].operation).toBe('施肥');
    });
    
    test('应该能够按产品ID过滤溯源记录', () => {
      // 先将DTO存储到Store
      const recordDTOs = mapToDTO(traceRecordMapper.toDTO, mockTraceRecords);
      traceStore.set('data.traceRecords', recordDTOs);
      
      // 设置当前选中的产品ID
      traceStore.set('ui.selectedProductId', 'p001');
      
      // 实现过滤功能（通常在应用代码中实现，这里仅为测试）
      function getFilteredRecords() {
        const selectedProductId = traceStore.get('ui.selectedProductId');
        const allRecords = traceStore.get('data.traceRecords') || [];
        
        if (!selectedProductId) return allRecords;
        
        return allRecords.filter(record => record.productId === selectedProductId);
      }
      
      // 获取过滤后的记录
      const filteredRecords = getFilteredRecords();
      
      // 验证过滤结果
      expect(filteredRecords.length).toBe(2);
      expect(filteredRecords[0].productId).toBe('p001');
      expect(filteredRecords[1].productId).toBe('p001');
      
      // 修改选中的产品ID
      traceStore.set('ui.selectedProductId', 'p002');
      
      // 重新获取过滤后的记录
      const newFilteredRecords = getFilteredRecords();
      
      // 验证新的过滤结果
      expect(newFilteredRecords.length).toBe(0); // 没有p002的记录
    });
  });
  
  // 测试数据持久化
  describe('数据持久化', () => {
    test('应该能够将数据从Store保存到localStorage', () => {
      // 配置Store持久化
      traceStore.init({
        enableAutoSave: true,
        persistentKeys: ['data']
      });
      
      // 存储产品数据
      const productDTOs = mapToDTO(productMapper.toDTO, mockProducts);
      traceStore.set('data.products', productDTOs);
      
      // 手动触发保存
      traceStore.save();
      
      // 验证localStorage.setItem被调用
      expect(window.localStorage.setItem).toHaveBeenCalled();
      
      // 验证保存的数据包含产品信息
      const savedCall = window.localStorage.setItem.mock.calls[0];
      const savedData = JSON.parse(savedCall[1]);
      
      expect(savedData).toHaveProperty('data');
      expect(savedData.data).toHaveProperty('products');
      expect(savedData.data.products.length).toBe(2);
    });
    
    test('应该能够从localStorage恢复数据到Store', () => {
      // 模拟localStorage中已存在的数据
      const storedData = {
        data: {
          products: mapToDTO(productMapper.toDTO, mockProducts),
          traceRecords: mapToDTO(traceRecordMapper.toDTO, mockTraceRecords)
        }
      };
      
      window.localStorage.getItem.mockReturnValue(JSON.stringify(storedData));
      
      // 配置Store并初始化（会从localStorage加载）
      traceStore.init({
        localStorageKey: 'trace_store',
        enableAutoSave: true,
        persistentKeys: ['data']
      });
      
      // 验证Store中的数据已从localStorage恢复
      const restoredProducts = traceStore.get('data.products');
      const restoredRecords = traceStore.get('data.traceRecords');
      
      expect(restoredProducts.length).toBe(2);
      expect(restoredProducts[0].name).toBe('有机大米');
      
      expect(restoredRecords.length).toBe(2);
      expect(restoredRecords[0].operation).toBe('种植');
    });
  });
  
  // 测试数据变更日志
  describe('数据变更日志', () => {
    test('应该能够记录数据变更的日志', () => {
      // 配置Store启用变更日志
      traceStore.init({
        logChanges: true
      });
      
      // 进行一系列数据变更
      traceStore.set('data.products', mapToDTO(productMapper.toDTO, mockProducts));
      traceStore.set('data.products.0.price', 45.9);
      traceStore.set('data.selectedProduct', 'p001');
      
      // 获取变更日志
      const changeLog = traceStore.getChangeLog();
      
      // 验证变更日志记录
      expect(changeLog.length).toBe(3);
      expect(changeLog[0].path).toBe('data.products');
      expect(changeLog[1].path).toBe('data.products.0.price');
      expect(changeLog[1].newValue).toBe(45.9);
      expect(changeLog[2].path).toBe('data.selectedProduct');
      expect(changeLog[2].newValue).toBe('p001');
    });
    
    test('清除变更日志应该重置日志记录', () => {
      // 配置Store启用变更日志
      traceStore.init({
        logChanges: true
      });
      
      // 进行数据变更
      traceStore.set('data.testValue', 'test');
      
      // 验证有变更记录
      expect(traceStore.getChangeLog().length).toBeGreaterThan(0);
      
      // 清除变更日志
      traceStore.clearChangeLog();
      
      // 验证变更日志已清除
      expect(traceStore.getChangeLog().length).toBe(0);
    });
  });
}); 