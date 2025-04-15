/**
 * 数据导入导出功能测试
 * @version 1.0.0
 */

import { 
  productMapper, 
  traceRecordMapper,
  mapToDTO,
  mapToEntity
} from '../../../components/modules/data/mappers';

describe('数据导入导出功能测试', () => {
  // 模拟数据
  const mockProductEntity = {
    id: 'p001',
    name: '有机大米',
    description: '纯天然有机大米',
    category: '粮食',
    price: 39.9,
    created_at: '2025-04-01T09:00:00Z'
  };
  
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
  
  // 测试数据导出
  describe('数据导出功能', () => {
    test('应该能将产品数据转换为可导出的JSON格式', () => {
      // 转换产品数据
      const productDTO = productMapper.toDTO(mockProductEntity);
      
      // 转换追溯记录数据
      const traceRecordDTOs = mapToDTO(traceRecordMapper.toDTO, mockTraceRecords);
      
      // 组装成完整的导出数据
      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        product: productDTO,
        traceRecords: traceRecordDTOs
      };
      
      // 验证导出数据格式
      expect(exportData).toHaveProperty('version');
      expect(exportData).toHaveProperty('timestamp');
      expect(exportData).toHaveProperty('product');
      expect(exportData).toHaveProperty('traceRecords');
      expect(exportData.product.id).toBe('p001');
      expect(exportData.traceRecords.length).toBe(2);
      expect(exportData.traceRecords[0].operation).toBe('种植');
      expect(exportData.traceRecords[1].operation).toBe('施肥');
      
      // 验证JSON序列化
      const jsonString = JSON.stringify(exportData);
      expect(typeof jsonString).toBe('string');
      
      // 验证可以反序列化
      const parsed = JSON.parse(jsonString);
      expect(parsed).toEqual(exportData);
    });
  });
  
  // 测试数据导入
  describe('数据导入功能', () => {
    test('应该能将导入的JSON数据转换为应用内部数据结构', () => {
      // 模拟导入的JSON数据
      const importData = {
        version: '1.0',
        timestamp: '2025-04-20T14:00:00Z',
        product: {
          id: 'p001',
          name: '有机大米',
          description: '纯天然有机大米',
          category: '粮食',
          price: 39.9,
          createdAt: '2025-04-01T09:00:00Z'
        },
        traceRecords: [
          {
            id: 'tr001',
            productId: 'p001',
            timestamp: '2025-03-01T08:00:00Z',
            location: {
              latitude: 28.2,
              longitude: 112.9,
              address: '湖南省长沙市'
            },
            operation: '种植',
            operatorId: 'u001',
            operatorName: '李四',
            details: { soil: '粘土', seedSource: '本地' },
            verificationStatus: 'verified'
          },
          {
            id: 'tr002',
            productId: 'p001',
            timestamp: '2025-03-20T09:30:00Z',
            location: {
              latitude: 28.2,
              longitude: 112.9,
              address: '湖南省长沙市'
            },
            operation: '施肥',
            operatorId: 'u001',
            operatorName: '李四',
            details: { fertilizer: '有机肥', amount: '100kg' },
            verificationStatus: 'verified'
          }
        ]
      };
      
      // 验证版本兼容性（简单示例）
      expect(importData.version).toBe('1.0');
      
      // 转换产品数据
      const productEntity = productMapper.toEntity(importData.product);
      
      // 转换追溯记录数据
      const traceRecordEntities = mapToEntity(traceRecordMapper.toEntity, importData.traceRecords);
      
      // 验证转换后的产品数据
      expect(productEntity).toHaveProperty('id', 'p001');
      expect(productEntity).toHaveProperty('name', '有机大米');
      expect(productEntity).toHaveProperty('created_at', '2025-04-01T09:00:00Z');
      
      // 验证转换后的追溯记录数据
      expect(traceRecordEntities.length).toBe(2);
      expect(traceRecordEntities[0].operation).toBe('种植');
      expect(traceRecordEntities[0].product_id).toBe('p001');
      expect(traceRecordEntities[1].operation).toBe('施肥');
      expect(traceRecordEntities[1].details).toHaveProperty('fertilizer', '有机肥');
    });
    
    test('应该能处理不同版本的导入数据', () => {
      // 模拟旧版本的导入数据（假设0.9版本使用不同的字段名）
      const oldVersionData = {
        version: '0.9',
        date: '2025-03-15T10:00:00Z',  // 不是timestamp
        product: {
          id: 'p001',
          name: '有机大米',
          desc: '纯天然有机大米',  // 不是description
          type: '粮食',          // 不是category
          price: 39.9,
          createTime: '2025-04-01T09:00:00Z'  // 不是createdAt
        },
        records: [  // 不是traceRecords
          {
            id: 'tr001',
            pid: 'p001',  // 不是productId
            time: '2025-03-01T08:00:00Z',  // 不是timestamp
            loc: {  // 不是location
              lat: 28.2,
              long: 112.9,  // 不是longitude
              addr: '湖南省长沙市'  // 不是address
            },
            op: '种植',  // 不是operation
            opId: 'u001',  // 不是operatorId
            opName: '李四',  // 不是operatorName
            data: { soil: '粘土', seedSource: '本地' },  // 不是details
            status: 'verified'  // 不是verificationStatus
          }
        ]
      };
      
      // 验证版本兼容性处理的模拟函数
      function handleVersionCompatibility(data) {
        // 简单示例，实际应用中可能需要更复杂的逻辑
        if (data.version === '0.9') {
          return {
            version: '1.0',
            timestamp: data.date,
            product: {
              id: data.product.id,
              name: data.product.name,
              description: data.product.desc,
              category: data.product.type,
              price: data.product.price,
              createdAt: data.product.createTime
            },
            traceRecords: data.records.map(record => ({
              id: record.id,
              productId: record.pid,
              timestamp: record.time,
              location: {
                latitude: record.loc.lat,
                longitude: record.loc.long,
                address: record.loc.addr
              },
              operation: record.op,
              operatorId: record.opId,
              operatorName: record.opName,
              details: record.data,
              verificationStatus: record.status
            }))
          };
        }
        return data;  // 如果是当前版本，直接返回
      }
      
      // 处理版本兼容性
      const compatibleData = handleVersionCompatibility(oldVersionData);
      
      // 验证转换后的数据
      expect(compatibleData.version).toBe('1.0');
      expect(compatibleData).toHaveProperty('timestamp');
      expect(compatibleData.product).toHaveProperty('description');
      expect(compatibleData.product).toHaveProperty('category');
      expect(compatibleData).toHaveProperty('traceRecords');
      expect(compatibleData.traceRecords[0]).toHaveProperty('productId');
      expect(compatibleData.traceRecords[0]).toHaveProperty('timestamp');
      expect(compatibleData.traceRecords[0].location).toHaveProperty('longitude');
      
      // 转换为实体数据
      const productEntity = productMapper.toEntity(compatibleData.product);
      const traceRecordEntities = mapToEntity(traceRecordMapper.toEntity, compatibleData.traceRecords);
      
      // 验证转换后的实体数据
      expect(productEntity.name).toBe('有机大米');
      expect(traceRecordEntities[0].operation).toBe('种植');
    });
  });
}); 