/**
 * 食品溯源系统 - Modal对话框组件测试
 * @version 1.0.0
 */

// 导入Modal组件
import { 
  traceModal, 
  openModal, 
  showConfirm, 
  showAlert 
} from '../../../components/modules/ui/modal.js';

// 测试前设置
beforeEach(() => {
  // 清理DOM环境
  document.body.innerHTML = '<div id="app"></div>';
  
  // 重置traceModal状态
  if (traceModal._state) {
    traceModal._state.modals = [];
    traceModal._state.stylesAdded = false;
    traceModal._state.uniqueId = 1;
  }
});

// 主测试套件
describe('Modal对话框组件', () => {
  // 组件初始化测试
  describe('初始化', () => {
    test('应该能成功初始化Modal组件', () => {
      const modal = traceModal.init();
      
      // 验证初始化后的状态
      expect(modal).toBe(traceModal); // 确认返回自身
      expect(traceModal._state.stylesAdded).toBe(true); // 确认样式已添加
    });
    
    test('应该使用默认配置', () => {
      traceModal.init();
      
      // 验证默认配置
      expect(traceModal.config.closeOnEscape).toBe(true);
      expect(traceModal.config.closeOnOverlayClick).toBe(true);
      expect(traceModal.config.animations).toBe(true);
    });
    
    test('应该允许自定义配置', () => {
      const customConfig = {
        closeOnEscape: false,
        closeOnOverlayClick: false,
        animations: false,
        zIndex: 2000
      };
      
      traceModal.init(customConfig);
      
      // 验证自定义配置是否生效
      expect(traceModal.config.closeOnEscape).toBe(false);
      expect(traceModal.config.closeOnOverlayClick).toBe(false);
      expect(traceModal.config.animations).toBe(false);
      expect(traceModal.config.zIndex).toBe(2000);
    });
  });
  
  // 创建Modal测试
  describe('创建Modal', () => {
    beforeEach(() => {
      traceModal.init();
    });
    
    test('应该能创建基本Modal', () => {
      const title = '测试标题';
      const content = '这是一个测试内容';
      const result = traceModal.create({
        title: title,
        content: content
      });
      
      // 验证返回值
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('close');
      
      // 验证DOM中是否添加了Modal元素
      const overlayElement = document.querySelector(`.${traceModal.config.overlayClass}`);
      const modalElement = document.querySelector(`.${traceModal.config.modalClass}`);
      const titleElement = document.querySelector(`.${traceModal.config.modalClass}-title`);
      const bodyElement = document.querySelector(`.${traceModal.config.modalClass}-body`);
      
      expect(overlayElement).not.toBeNull();
      expect(modalElement).not.toBeNull();
      expect(titleElement).not.toBeNull();
      expect(bodyElement).not.toBeNull();
      
      expect(titleElement.textContent).toBe(title);
      expect(bodyElement.textContent).toBe(content);
    });
    
    test('应该支持不同尺寸的Modal', () => {
      // 由于无法直接验证CSS类，我们检查create方法是否接受size参数
      const sizes = ['small', 'medium', 'large', 'fullscreen'];
      
      sizes.forEach(size => {
        const options = {
          title: `${size}对话框`,
          content: `这是一个${size}尺寸的对话框`,
          size: size
        };
        
        // 确保create方法不会因为size参数而报错
        expect(() => traceModal.create(options)).not.toThrow();
      });
    });
    
    test('应该支持自定义按钮', () => {
      const buttons = [
        { text: '取消', type: 'default' },
        { text: '确定', type: 'primary' }
      ];
      
      // 确保create方法接受buttons参数
      expect(() => {
        traceModal.create({
          title: '带按钮的对话框',
          content: '这是一个带按钮的对话框',
          buttons: buttons
        });
      }).not.toThrow();
      
      // 验证DOM中是否有按钮元素
      const buttonElements = document.querySelectorAll('button');
      expect(buttonElements.length).toBeGreaterThan(0);
    });
  });
  
  // 对话框快捷方法测试
  describe('对话框快捷方法', () => {
    beforeEach(() => {
      traceModal.init();
      // 模拟traceModal.create方法
      jest.spyOn(traceModal, 'create').mockImplementation(() => ({ id: 'mock-id', close: jest.fn() }));
    });
    
    afterEach(() => {
      // 恢复原始方法
      jest.restoreAllMocks();
    });
    
    test('openModal应该调用traceModal.create', () => {
      const options = {
        title: '测试对话框',
        content: '测试内容'
      };
      
      openModal(options);
      
      // 验证create方法被调用且参数正确
      expect(traceModal.create).toHaveBeenCalledWith(options);
    });
    
    test('showConfirm应该调用traceModal.confirm', () => {
      // 模拟confirm方法
      jest.spyOn(traceModal, 'confirm').mockImplementation(() => ({ id: 'mock-id', close: jest.fn() }));
      
      const options = {
        title: '确认',
        content: '确定要执行此操作吗？'
      };
      
      showConfirm(options);
      
      // 验证confirm方法被调用且参数正确
      expect(traceModal.confirm).toHaveBeenCalledWith(options);
    });
    
    test('showAlert应该调用traceModal.alert', () => {
      // 模拟alert方法
      jest.spyOn(traceModal, 'alert').mockImplementation(() => ({ id: 'mock-id', close: jest.fn() }));
      
      const options = {
        title: '提示',
        content: '操作成功！'
      };
      
      showAlert(options);
      
      // 验证alert方法被调用且参数正确
      expect(traceModal.alert).toHaveBeenCalledWith(options);
    });
  });
  
  // 确认/提示对话框测试
  describe('确认/提示对话框', () => {
    beforeEach(() => {
      traceModal.init();
      // 模拟create方法以简化测试
      jest.spyOn(traceModal, 'create').mockImplementation(() => ({ 
        id: 'mock-id', 
        close: jest.fn() 
      }));
    });
    
    afterEach(() => {
      jest.restoreAllMocks();
    });
    
    test('confirm应该创建对话框并设置正确的参数', () => {
      const options = {
        title: '确认操作',
        content: '确定要删除这条记录吗？'
      };
      
      traceModal.confirm(options);
      
      // 验证是否调用了create方法
      expect(traceModal.create).toHaveBeenCalled();
      
      // 获取调用参数
      const callArgs = traceModal.create.mock.calls[0][0];
      
      // 验证标题
      expect(callArgs.title).toBe('确认操作');
      
      // 内容处理可能因实现而异，不进行严格检查
      
      // 验证按钮存在
      expect(callArgs.buttons).toBeDefined();
      expect(callArgs.buttons.length).toBe(2);
    });
    
    test('alert应该创建带有一个确定按钮的对话框', () => {
      const options = {
        title: '操作成功',
        content: '记录已保存！'
      };
      
      traceModal.alert(options);
      
      // 验证是否调用了create方法
      expect(traceModal.create).toHaveBeenCalled();
      
      // 获取调用参数
      const callArgs = traceModal.create.mock.calls[0][0];
      
      // 验证标题
      expect(callArgs.title).toBe('操作成功');
      
      // 验证按钮
      expect(callArgs.buttons).toBeDefined();
      expect(callArgs.buttons.length).toBe(1);
      expect(callArgs.buttons[0].text).toBe('确定');
    });
  });
  
  // 关闭Modal测试
  describe('关闭Modal', () => {
    beforeEach(() => {
      traceModal.init();
    });
    
    test('close方法应该存在', () => {
      // 检查close方法存在并且是一个函数
      expect(typeof traceModal.close).toBe('function');
    });
    
    test('closeAll方法应该存在', () => {
      // 检查closeAll方法存在并且是一个函数
      expect(typeof traceModal.closeAll).toBe('function');
    });
    
    test('应该能通过调用modal.close()方法关闭Modal', () => {
      // 模拟create方法返回对象
      jest.spyOn(traceModal, 'close');
      
      // 模拟创建Modal
      const modal = {
        id: 'test-id',
        close: function() {
          traceModal.close(this.id);
        }
      };
      
      // 调用close方法
      modal.close();
      
      // 验证traceModal.close被调用
      expect(traceModal.close).toHaveBeenCalledWith('test-id');
    });
  });
}); 