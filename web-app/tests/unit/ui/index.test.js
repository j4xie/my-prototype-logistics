/**
 * 食品溯源系统 - UI模块索引测试
 * @version 1.0.0
 */

// 导入UI模块中所有组件和方法
const uiModule = require('../../../components/modules/ui/index.js');
const defaultExport = uiModule;

describe('UI模块索引', () => {
  // 测试默认导出
  test('应该有一个默认导出', () => {
    expect(defaultExport).toBeDefined();
  });
  
  // 测试组件导出
  test('应该导出traceUI组件', () => {
    expect(uiModule.traceUI).toBeDefined();
  });
  
  // 测试Toast组件和方法导出
  test('应该导出Toast组件和方法', () => {
    expect(uiModule.traceToast).toBeDefined();
    expect(uiModule.showToast).toBeDefined();
    expect(uiModule.showInfo).toBeDefined();
    expect(uiModule.showSuccess).toBeDefined();
    expect(uiModule.showWarning).toBeDefined();
    expect(uiModule.showError).toBeDefined();
    expect(uiModule.showLoading).toBeDefined();
  });
  
  // 测试Modal组件和方法导出
  test('应该导出Modal组件和方法', () => {
    expect(uiModule.traceModal).toBeDefined();
    expect(uiModule.openModal).toBeDefined();
    expect(uiModule.showConfirm).toBeDefined();
    expect(uiModule.showAlert).toBeDefined();
  });
}); 