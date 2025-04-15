/**
 * 食品溯源系统 - Toast通知组件测试
 * @version 1.0.0
 */

// 导入Toast组件
import { 
  traceToast, 
  showToast, 
  showInfo, 
  showSuccess, 
  showWarning, 
  showError, 
  showLoading 
} from '../../../components/modules/ui/toast.js';

// 测试前设置
beforeEach(() => {
  // 清理DOM环境
  document.body.innerHTML = '<div id="app"></div>';
  // 重置traceToast状态
  if (traceToast._state && traceToast._state.container) {
    if (traceToast._state.container.parentNode) {
      traceToast._state.container.parentNode.removeChild(traceToast._state.container);
    }
    traceToast._state.container = null;
  }
  if (traceToast._state) {
    traceToast._state.toasts = [];
    traceToast._state.stylesAdded = false;
    traceToast._state.uniqueId = 1;
  }
});

// 主测试套件
describe('Toast通知组件', () => {
  // 组件初始化测试
  describe('初始化', () => {
    test('应该能成功初始化Toast组件', () => {
      const toast = traceToast.init();
      
      // 验证初始化后的状态
      expect(toast).toBe(traceToast); // 确认返回自身
      expect(document.querySelector(`.${traceToast.config.containerClass}`)).not.toBeNull(); // 确认容器已创建
      expect(traceToast._state.container).not.toBeNull(); // 确认内部状态已更新
      expect(traceToast._state.stylesAdded).toBe(true); // 确认样式已添加
    });
    
    test('应该使用默认配置', () => {
      traceToast.init();
      
      // 验证默认配置
      expect(traceToast.config.defaultDuration).toBe(3000);
      expect(traceToast.config.maxVisible).toBe(5);
      expect(traceToast.config.position).toBe('top-right');
    });
    
    test('应该允许自定义配置', () => {
      const customConfig = {
        defaultDuration: 5000,
        position: 'bottom-center',
        maxVisible: 3
      };
      
      traceToast.init(customConfig);
      
      // 验证自定义配置是否生效
      expect(traceToast.config.defaultDuration).toBe(5000);
      expect(traceToast.config.position).toBe('bottom-center');
      expect(traceToast.config.maxVisible).toBe(3);
    });
  });
  
  // 显示Toast测试
  describe('显示Toast', () => {
    beforeEach(() => {
      traceToast.init();
    });
    
    test('应该能显示基本Toast', () => {
      const message = '这是一条测试消息';
      const result = traceToast.show(message);
      
      // 验证返回值
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('close');
      
      // 验证DOM中是否添加了Toast元素
      const toastElement = document.querySelector(`.${traceToast.config.toastClass}`);
      expect(toastElement).not.toBeNull();
      expect(toastElement.textContent).toContain(message);
    });
    
    test('应该支持不同类型的Toast', () => {
      // 测试各种类型
      const types = ['info', 'success', 'warning', 'error', 'loading'];
      
      types.forEach(type => {
        traceToast.show(`${type}消息`, type);
        
        // 验证类型特定样式是否添加
        const toastElement = document.querySelector(`.${traceToast.config.toastClass}-${type}`);
        expect(toastElement).not.toBeNull();
      });
      
      // 验证总共创建了5个Toast
      const allToasts = document.querySelectorAll(`.${traceToast.config.toastClass}`);
      expect(allToasts.length).toBe(5);
    });
  });
  
  // 快捷方法测试
  describe('快捷方法', () => {
    beforeEach(() => {
      traceToast.init();
      // 模拟traceToast.show方法
      jest.spyOn(traceToast, 'show').mockImplementation(() => ({ id: 'mock-id', close: jest.fn() }));
    });
    
    afterEach(() => {
      // 恢复原始方法
      jest.restoreAllMocks();
    });
    
    test('showToast应该调用traceToast.show', () => {
      showToast('测试消息', 'info', 3000);
      
      // 验证show方法被调用且参数正确
      expect(traceToast.show).toHaveBeenCalledWith('测试消息', 'info', 3000);
    });
    
    test('showInfo应该调用traceToast.show并设置类型为info', () => {
      showInfo('信息消息');
      
      // 验证show方法被调用且类型为info
      expect(traceToast.show).toHaveBeenCalledWith('信息消息', 'info', undefined);
    });
    
    test('showSuccess应该调用traceToast.show并设置类型为success', () => {
      showSuccess('成功消息');
      
      // 验证show方法被调用且类型为success
      expect(traceToast.show).toHaveBeenCalledWith('成功消息', 'success', undefined);
    });
    
    test('showWarning应该调用traceToast.show并设置类型为warning', () => {
      showWarning('警告消息');
      
      // 验证show方法被调用且类型为warning
      expect(traceToast.show).toHaveBeenCalledWith('警告消息', 'warning', undefined);
    });
    
    test('showError应该调用traceToast.show并设置类型为error', () => {
      showError('错误消息');
      
      // 验证show方法被调用且类型为error
      expect(traceToast.show).toHaveBeenCalledWith('错误消息', 'error', undefined);
    });
    
    test('showLoading应该调用traceToast.show并设置类型为loading及持续时间为0', () => {
      showLoading('加载中...');
      
      // 验证show方法被调用且类型为loading，持续时间为0
      expect(traceToast.show).toHaveBeenCalledWith('加载中...', 'loading', 0);
    });
  });
  
  // 关闭Toast测试
  describe('关闭Toast', () => {
    beforeEach(() => {
      traceToast.init();
    });
    
    test('close方法应该存在', () => {
      // 检查close方法存在并且是一个函数
      expect(typeof traceToast.close).toBe('function');
    });
    
    test('应该能通过调用toast.close()方法关闭Toast', () => {
      // 显示一个Toast
      const toast = traceToast.show('这是一条测试消息');
      
      // 模拟close方法
      const closeSpy = jest.spyOn(traceToast, 'close');
      
      // 通过返回的对象关闭Toast
      toast.close();
      
      // 验证close方法被调用了一次，并且使用了正确的ID
      expect(closeSpy).toHaveBeenCalledWith(toast.id);
    });
    
    test('closeAll方法应该存在', () => {
      // 检查closeAll方法存在并且是一个函数
      expect(typeof traceToast.closeAll).toBe('function');
    });
  });
}); 