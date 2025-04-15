/**
 * 食品溯源系统 - 状态管理模块索引测试
 * @version 1.0.0
 */

// 导入被测试模块
import defaultExport, { createStore } from '../../../components/modules/store/index.js';

// 测试套件
describe('状态管理模块索引', () => {
  test('应正确导出默认实例和createStore函数', () => {
    // 验证默认导出和命名导出
    expect(defaultExport).toBeDefined();
    expect(typeof defaultExport).toBe('object');
    
    expect(createStore).toBeDefined();
    expect(typeof createStore).toBe('function');
  });
}); 