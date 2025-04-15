/**
 * 数据模块索引文件测试
 * @version 1.0.0
 */

import * as mappersModule from '../../../components/modules/data/mappers';

describe('数据模块索引测试', () => {
  // 测试mappers.js导出内容
  test('mappers模块应该正确导出所有映射器和辅助函数', () => {
    // 验证映射器导出
    expect(mappersModule.productMapper).toBeDefined();
    expect(mappersModule.userMapper).toBeDefined();
    expect(mappersModule.traceRecordMapper).toBeDefined();
    
    // 验证辅助函数导出
    expect(mappersModule.mapToDTO).toBeDefined();
    expect(mappersModule.mapToEntity).toBeDefined();
    
    // 验证映射器中的方法存在
    expect(typeof mappersModule.productMapper.toDTO).toBe('function');
    expect(typeof mappersModule.productMapper.toEntity).toBe('function');
    expect(typeof mappersModule.userMapper.toDTO).toBe('function');
    expect(typeof mappersModule.userMapper.toEntity).toBe('function');
    expect(typeof mappersModule.traceRecordMapper.toDTO).toBe('function');
    expect(typeof mappersModule.traceRecordMapper.toEntity).toBe('function');
  });
}); 