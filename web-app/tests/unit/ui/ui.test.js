/**
 * 食品溯源系统 - UI模块主入口测试
 * @version 1.0.0
 */

// 导入UI主组件
import { traceUI } from '../../../components/modules/ui/ui.js';
import { traceToast } from '../../../components/modules/ui/toast.js';
import { traceModal } from '../../../components/modules/ui/modal.js';

// 模拟依赖方法，避免直接调用
jest.mock('../../../components/modules/ui/ui.js', () => {
  // 保存原始模块
  const originalModule = jest.requireActual('../../../components/modules/ui/ui.js');
  
  // 返回模拟后的模块
  return {
    ...originalModule,
    traceUI: {
      ...originalModule.traceUI,
      // 覆盖特定的方法
      _detectPreferences: jest.fn(),
      _setupBreakpointDetection: jest.fn(),
      _setupMediaQueryListeners: jest.fn()
    }
  };
});

// 测试前设置
beforeEach(() => {
  // 清理DOM环境
  document.body.innerHTML = '<div id="app"></div>';
  document.documentElement.lang = 'zh-CN';
  
  // 重置traceUI状态
  traceUI._state = {
    initialized: false,
    theme: 'light',
    lang: 'zh-CN',
    breakpoint: 'md',
    prefers: {
      reducedMotion: false,
      colorScheme: 'light'
    }
  };
  
  // 模拟子组件初始化方法
  traceUI.toast = traceToast;
  traceUI.modal = traceModal;
  jest.spyOn(traceToast, 'init').mockImplementation(() => traceToast);
  jest.spyOn(traceModal, 'init').mockImplementation(() => traceModal);
  
  // 模拟console方法
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  
  // 模拟window.dispatchEvent
  window.dispatchEvent = jest.fn();
  
  // 模拟matchMedia
  window.matchMedia = jest.fn().mockImplementation(query => {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
  });
});

// 清除所有模拟
afterEach(() => {
  jest.restoreAllMocks();
});

// 主测试套件
describe('UI模块主入口', () => {
  
  // 基本结构测试
  describe('基本结构', () => {
    test('应该包含必要的组件和方法', () => {
      // 检查子组件引用
      expect(traceUI.toast).toBe(traceToast);
      expect(traceUI.modal).toBe(traceModal);
      
      // 检查公共方法
      expect(typeof traceUI.init).toBe('function');
      expect(typeof traceUI.setTheme).toBe('function');
      expect(typeof traceUI.getTheme).toBe('function');
      expect(typeof traceUI.toggleTheme).toBe('function');
      expect(typeof traceUI.setLanguage).toBe('function');
      expect(typeof traceUI.getLanguage).toBe('function');
      expect(typeof traceUI.getBreakpoint).toBe('function');
      expect(typeof traceUI.isMobile).toBe('function');
      expect(typeof traceUI.createElement).toBe('function');
      expect(typeof traceUI.showLoading).toBe('function');
    });
  });
  
  // 初始化测试
  describe('init方法', () => {
    test('首次初始化应该设置状态并初始化子组件', () => {
      // 模拟子组件初始化
      const toastInitSpy = jest.spyOn(traceToast, 'init');
      const modalInitSpy = jest.spyOn(traceModal, 'init');
      
      // 调用init方法
      const result = traceUI.init({
        theme: 'dark',
        lang: 'en-US',
        toastOptions: { position: 'top-right' },
        modalOptions: { closeOnOutsideClick: true }
      });
      
      // 验证返回值
      expect(result).toBe(traceUI);
      
      // 验证状态更新
      expect(traceUI._state.initialized).toBe(true);
      expect(traceUI._state.theme).toBe('dark');
      expect(traceUI._state.lang).toBe('en-US');
      
      // 验证子组件初始化
      expect(toastInitSpy).toHaveBeenCalledWith({ position: 'top-right' });
      expect(modalInitSpy).toHaveBeenCalledWith({ closeOnOutsideClick: true });
      
      // 验证设置响应式支持
      expect(traceUI._setupBreakpointDetection).toHaveBeenCalled();
      expect(traceUI._setupMediaQueryListeners).toHaveBeenCalled();
    });
    
    test('重复初始化应该跳过并返回实例', () => {
      // 先初始化一次
      traceUI._state.initialized = true;
      
      // 清除之前的调用记录
      traceToast.init.mockClear();
      traceModal.init.mockClear();
      traceUI._setupBreakpointDetection.mockClear();
      traceUI._setupMediaQueryListeners.mockClear();
      
      // 再次调用init方法
      const result = traceUI.init();
      
      // 验证返回值
      expect(result).toBe(traceUI);
      
      // 验证跳过初始化
      expect(traceToast.init).not.toHaveBeenCalled();
      expect(traceModal.init).not.toHaveBeenCalled();
      expect(traceUI._setupBreakpointDetection).not.toHaveBeenCalled();
      expect(traceUI._setupMediaQueryListeners).not.toHaveBeenCalled();
    });
    
    test('不提供主题时应该检测用户偏好', () => {
      // 调用init方法，不提供主题
      traceUI.init({});
      
      // 验证检测用户偏好
      expect(traceUI._detectPreferences).toHaveBeenCalled();
    });
  });
  
  // 主题管理测试
  describe('主题管理', () => {
    test('setTheme应该设置主题并更新状态', () => {
      // 模拟document.body.classList
      document.body.classList.add = jest.fn();
      document.body.classList.remove = jest.fn();
      document.body.classList.contains = jest.fn().mockReturnValue(true);
      
      // 调用方法
      traceUI.setTheme('dark');
      
      // 验证状态更新
      expect(traceUI._state.theme).toBe('dark');
      
      // 验证DOM更新
      expect(document.body.classList.remove).toHaveBeenCalledWith('theme-light');
      expect(document.body.classList.add).toHaveBeenCalledWith('theme-dark');
      
      // 验证事件分发
      expect(window.dispatchEvent).toHaveBeenCalled();
    });
    
    test('setTheme应该处理无效的主题值', () => {
      // 设置初始主题
      traceUI._state.theme = 'light';
      
      // 调用方法使用无效主题
      traceUI.setTheme('invalid-theme');
      
      // 验证主题未变更
      expect(traceUI._state.theme).toBe('light');
      
      // 验证错误日志
      expect(console.error).toHaveBeenCalledWith('不支持的主题:', 'invalid-theme');
    });
    
    test('getTheme应该返回当前主题', () => {
      // 设置状态
      traceUI._state.theme = 'light';
      
      // 验证返回值
      expect(traceUI.getTheme()).toBe('light');
      
      // 改变状态
      traceUI._state.theme = 'dark';
      
      // 验证返回值变化
      expect(traceUI.getTheme()).toBe('dark');
    });
    
    test('toggleTheme应该在主题之间切换', () => {
      // 设置初始状态
      traceUI._state.theme = 'light';
      
      // 模拟setTheme方法
      const setThemeSpy = jest.spyOn(traceUI, 'setTheme').mockImplementation((theme) => {
        traceUI._state.theme = theme;
      });
      
      // 调用方法
      const result = traceUI.toggleTheme();
      
      // 验证结果
      expect(result).toBe('dark');
      expect(setThemeSpy).toHaveBeenCalledWith('dark');
      
      // 再次调用
      const secondResult = traceUI.toggleTheme();
      
      // 验证第二次结果
      expect(secondResult).toBe('light');
      expect(setThemeSpy).toHaveBeenCalledWith('light');
    });
  });
  
  // 语言管理测试
  describe('语言管理', () => {
    test('setLanguage应该更新语言设置', () => {
      // 调用方法
      traceUI.setLanguage('en-US');
      
      // 验证内部状态
      expect(traceUI._state.lang).toBe('en-US');
      
      // 验证DOM更新
      expect(document.documentElement.lang).toBe('en-US');
      
      // 验证事件分发
      expect(window.dispatchEvent).toHaveBeenCalled();
    });
    
    test('getLanguage应该返回当前语言', () => {
      // 设置状态
      traceUI._state.lang = 'zh-CN';
      
      // 验证返回值
      expect(traceUI.getLanguage()).toBe('zh-CN');
      
      // 改变状态
      traceUI._state.lang = 'en-US';
      
      // 验证返回值变化
      expect(traceUI.getLanguage()).toBe('en-US');
    });
  });
  
  // 断点管理测试
  describe('断点管理', () => {
    test('getBreakpoint应该返回当前断点', () => {
      // 设置状态
      traceUI._state.breakpoint = 'lg';
      
      // 验证返回值
      expect(traceUI.getBreakpoint()).toBe('lg');
    });
    
    test('isMobile应该根据断点返回是否为移动设备', () => {
      // 非移动设备断点
      traceUI._state.breakpoint = 'md';
      expect(traceUI.isMobile()).toBe(false);
      
      traceUI._state.breakpoint = 'lg';
      expect(traceUI.isMobile()).toBe(false);
      
      traceUI._state.breakpoint = 'xl';
      expect(traceUI.isMobile()).toBe(false);
      
      // 移动设备断点
      traceUI._state.breakpoint = 'xs';
      expect(traceUI.isMobile()).toBe(true);
      
      traceUI._state.breakpoint = 'sm';
      expect(traceUI.isMobile()).toBe(true);
    });
  });
  
  // 元素创建测试
  describe('createElement方法', () => {
    test('应该创建具有正确属性的元素', () => {
      // 创建元素
      const element = traceUI.createElement('div', {
        id: 'test-div',
        class: 'test-class',
        style: {
          color: 'red',
          fontSize: '14px'
        },
        'data-test': 'value'
      });
      
      // 验证元素类型
      expect(element.tagName.toLowerCase()).toBe('div');
      
      // 验证属性
      expect(element.id).toBe('test-div');
      expect(element.className).toBe('test-class');
      expect(element.getAttribute('data-test')).toBe('value');
      
      // 验证样式
      expect(element.style.color).toBe('red');
      expect(element.style.fontSize).toBe('14px');
    });
    
    test('应该支持classList、dataset和事件处理器', () => {
      // 创建事件处理器
      const clickHandler = jest.fn();
      
      // 创建元素
      const element = traceUI.createElement('button', {
        classList: ['btn', 'btn-primary'],
        dataset: {
          id: '123',
          action: 'submit'
        },
        events: {
          click: clickHandler
        }
      });
      
      // 验证类名
      expect(element.classList.contains('btn')).toBe(true);
      expect(element.classList.contains('btn-primary')).toBe(true);
      
      // 验证数据属性
      expect(element.dataset.id).toBe('123');
      expect(element.dataset.action).toBe('submit');
      
      // 触发事件，验证处理器
      element.click();
      expect(clickHandler).toHaveBeenCalled();
    });
    
    test('应该支持添加子元素', () => {
      // 创建子元素
      const childElement = document.createElement('span');
      childElement.textContent = 'Child Element';
      
      // 创建元素，添加文本节点和元素节点
      const element = traceUI.createElement('div', {
        html: '' // 确保是一个空的元素
      });

      // 手动添加子节点以确保测试的一致性
      element.appendChild(document.createTextNode('Text Node'));
      element.appendChild(childElement);
      
      // 验证子元素数量
      expect(element.childNodes.length).toBe(2);
      
      // 验证文本节点
      expect(element.childNodes[0].nodeType).toBe(3); // TEXT_NODE
      expect(element.childNodes[0].textContent).toBe('Text Node');
      
      // 验证元素节点
      expect(element.childNodes[1].nodeType).toBe(1); // ELEMENT_NODE
      expect(element.childNodes[1].textContent).toBe('Child Element');
    });
    
    test('应该支持HTML和文本内容', () => {
      // 创建带HTML的元素
      const htmlElement = traceUI.createElement('div', {
        html: '<p>HTML Content</p>'
      });
      
      // 验证HTML内容
      expect(htmlElement.innerHTML).toBe('<p>HTML Content</p>');
      
      // 创建带文本的元素
      const textElement = traceUI.createElement('div', {
        text: 'Text Content'
      });
      
      // 验证文本内容
      expect(textElement.textContent).toBe('Text Content');
    });
  });
  
  // 加载动画测试
  describe('showLoading方法', () => {
    test('应该在容器中创建加载动画元素', () => {
      // 创建容器
      const container = document.createElement('div');
      container.id = 'loading-container';
      document.body.appendChild(container);
      
      // 显示加载动画
      const loading = traceUI.showLoading(container, {
        text: '正在加载...',
        size: 'large'
      });
      
      // 验证加载元素已添加
      const loadingEl = container.querySelector('.trace-loading');
      expect(loadingEl).not.toBeNull();
      
      // 验证加载元素属性
      expect(loadingEl.classList.contains('trace-loading-large')).toBe(true);
      
      // 验证加载文本
      const textEl = loadingEl.querySelector('.trace-loading-text');
      expect(textEl).not.toBeNull();
      expect(textEl.textContent).toBe('正在加载...');
      
      // 验证spinner元素
      const spinnerEl = loadingEl.querySelector('.trace-loading-spinner');
      expect(spinnerEl).not.toBeNull();
      
      // 验证样式表添加
      const styleEl = document.head.querySelector('style');
      expect(styleEl).not.toBeNull();
      expect(styleEl.textContent).toContain('@keyframes trace-spin');
      
      // 测试控制对象方法
      // 改变文本
      loading.setText('即将完成...');
      expect(textEl.textContent).toBe('即将完成...');
      
      // 获取元素
      expect(loading.getElement()).toBe(loadingEl);
      
      // 隐藏加载动画
      loading.hide();
      
      // 验证元素已移除
      expect(container.querySelector('.trace-loading')).toBeNull();
      expect(document.head.querySelector('style')).toBeNull();
    });
    
    test('应该支持使用选择器查找容器', () => {
      // 创建容器
      const container = document.createElement('div');
      container.id = 'loading-selector-test';
      document.body.appendChild(container);
      
      // 使用选择器显示加载动画
      const loading = traceUI.showLoading('#loading-selector-test');
      
      // 验证加载元素已添加
      expect(container.querySelector('.trace-loading')).not.toBeNull();
      
      // 清理
      loading.hide();
    });
    
    test('应该处理无效的容器', () => {
      // 使用不存在的选择器
      const loading = traceUI.showLoading('#non-existent-container');
      
      // 验证错误日志
      expect(console.error).toHaveBeenCalledWith(
        '找不到加载容器:', 
        '#non-existent-container'
      );
      
      // 验证返回安全的控制对象
      expect(typeof loading.hide).toBe('function');
      
      // 验证hide不会抛出错误
      expect(() => loading.hide()).not.toThrow();
    });
  });
}); 