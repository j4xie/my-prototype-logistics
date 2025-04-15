/**
 * UI组件与Store模块的集成测试
 * @version 1.0.0
 */

import { traceModal } from '../../components/modules/ui/modal';
import { traceToast } from '../../components/modules/ui/toast';
import { traceStore } from '../../components/modules/store/store';

// 测试前的设置
function setupTestDOM() {
  // 重置DOM环境
  document.body.innerHTML = '';
  
  // 创建测试容器
  const container = document.createElement('div');
  container.id = 'test-container';
  document.body.appendChild(container);
  
  // 创建toast容器
  const toastContainer = document.createElement('div');
  toastContainer.id = 'trace-toast-container';
  document.body.appendChild(toastContainer);
  
  // 创建modal容器
  const modalContainer = document.createElement('div');
  modalContainer.id = 'trace-modal-container';
  document.body.appendChild(modalContainer);
  
  // 模拟CustomEvent
  window.CustomEvent = function(event, params) {
    params = params || { bubbles: false, cancelable: false, detail: null };
    const evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    return evt;
  };
  
  // 模拟window.matchMedia
  window.matchMedia = jest.fn().mockImplementation(query => {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn()
    };
  });
}

// 测试前的初始化
beforeEach(() => {
  // 重置DOM环境
  setupTestDOM();
  
  // 重置模拟函数
  jest.clearAllMocks();
  
  // 重置Store状态
  traceStore.clear();
  
  // 初始化组件
  traceModal.init();
  traceToast.init();
});

describe('UI组件与Store模块集成测试', () => {
  // 测试Modal组件与Store集成
  describe('Modal组件与Store集成', () => {
    test('打开Modal时应该更新Store中的modal状态', () => {
      // 订阅Store变更
      let storeChanged = false;
      const unsubscribe = traceStore.subscribe('ui.modal', () => {
        storeChanged = true;
      });
      
      // 打开Modal
      traceModal.show({
        title: '测试标题',
        content: '测试内容',
        confirmText: '确认'
      });
      
      // 验证Store状态被更新
      expect(storeChanged).toBe(true);
      
      // 验证Store中的modal状态
      const modalState = traceStore.get('ui.modal');
      expect(modalState).toBeDefined();
      expect(modalState.isOpen).toBe(true);
      expect(modalState.title).toBe('测试标题');
      expect(modalState.content).toBe('测试内容');
      
      // 移除订阅
      unsubscribe();
    });
    
    test('关闭Modal时应该更新Store中的modal状态', () => {
      // 先打开Modal
      traceModal.show({
        title: '测试标题',
        content: '测试内容'
      });
      
      // 订阅Store变更
      let storeChanged = false;
      const unsubscribe = traceStore.subscribe('ui.modal', () => {
        storeChanged = true;
      });
      
      // 关闭Modal
      traceModal.hide();
      
      // 验证Store状态被更新
      expect(storeChanged).toBe(true);
      
      // 验证Store中的modal状态
      const modalState = traceStore.get('ui.modal');
      expect(modalState).toBeDefined();
      expect(modalState.isOpen).toBe(false);
      
      // 移除订阅
      unsubscribe();
    });
    
    test('通过Store状态变更应该控制Modal的显示和隐藏', () => {
      // 模拟Modal.show方法
      const showSpy = jest.spyOn(traceModal, 'show');
      const hideSpy = jest.spyOn(traceModal, 'hide');
      
      // 通过Store设置Modal状态来显示
      traceStore.set('ui.modal', {
        isOpen: true,
        title: 'Store标题',
        content: 'Store内容',
        confirmText: '确认',
        cancelText: '取消'
      });
      
      // 验证Modal.show方法被调用
      expect(showSpy).toHaveBeenCalled();
      expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Store标题',
        content: 'Store内容'
      }));
      
      // 通过Store设置Modal状态来隐藏
      traceStore.set('ui.modal.isOpen', false);
      
      // 验证Modal.hide方法被调用
      expect(hideSpy).toHaveBeenCalled();
      
      // 恢复spy
      showSpy.mockRestore();
      hideSpy.mockRestore();
    });
  });
  
  // 测试Toast组件与Store集成
  describe('Toast组件与Store集成', () => {
    test('显示Toast时应该更新Store中的toast状态', () => {
      // 订阅Store变更
      let storeChanged = false;
      const unsubscribe = traceStore.subscribe('ui.toast', () => {
        storeChanged = true;
      });
      
      // 显示Toast
      traceToast.show('测试消息', 'success');
      
      // 验证Store状态被更新
      expect(storeChanged).toBe(true);
      
      // 验证Store中的toast状态
      const toastState = traceStore.get('ui.toast');
      expect(toastState).toBeDefined();
      expect(toastState.visible).toBe(true);
      expect(toastState.message).toBe('测试消息');
      expect(toastState.type).toBe('success');
      
      // 移除订阅
      unsubscribe();
    });
    
    test('隐藏Toast时应该更新Store中的toast状态', () => {
      // 先显示Toast
      traceToast.show('测试消息', 'success');
      
      // 订阅Store变更
      let storeChanged = false;
      const unsubscribe = traceStore.subscribe('ui.toast', () => {
        storeChanged = true;
      });
      
      // 隐藏Toast
      traceToast.hide();
      
      // 验证Store状态被更新
      expect(storeChanged).toBe(true);
      
      // 验证Store中的toast状态
      const toastState = traceStore.get('ui.toast');
      expect(toastState).toBeDefined();
      expect(toastState.visible).toBe(false);
      
      // 移除订阅
      unsubscribe();
    });
    
    test('通过Store状态变更应该控制Toast的显示和隐藏', () => {
      // 模拟Toast.show方法
      const showSpy = jest.spyOn(traceToast, 'show');
      const hideSpy = jest.spyOn(traceToast, 'hide');
      
      // 通过Store设置Toast状态来显示
      traceStore.set('ui.toast', {
        visible: true,
        message: 'Store消息',
        type: 'warning',
        duration: 5000
      });
      
      // 验证Toast.show方法被调用
      expect(showSpy).toHaveBeenCalled();
      expect(showSpy).toHaveBeenCalledWith('Store消息', 'warning', 5000);
      
      // 通过Store设置Toast状态来隐藏
      traceStore.set('ui.toast.visible', false);
      
      // 验证Toast.hide方法被调用
      expect(hideSpy).toHaveBeenCalled();
      
      // 恢复spy
      showSpy.mockRestore();
      hideSpy.mockRestore();
    });
  });
  
  // 测试UI组件的联动
  describe('UI组件联动', () => {
    test('通过Store应该能够实现Modal和Toast的联动', () => {
      // 模拟Toast.show方法
      const toastShowSpy = jest.spyOn(traceToast, 'show');
      
      // 打开Modal
      traceModal.show({
        title: '操作确认',
        content: '确认删除该项目吗？',
        confirmText: '确认',
        cancelText: '取消',
        onConfirm: () => {
          // 操作成功后通过Store更新Toast
          traceStore.set('ui.toast', {
            visible: true,
            message: '删除成功',
            type: 'success',
            duration: 3000
          });
        }
      });
      
      // 模拟点击确认按钮
      const confirmButton = document.querySelector('.trace-modal-confirm');
      if (confirmButton) {
        confirmButton.click();
      }
      
      // 验证Toast.show方法被调用
      expect(toastShowSpy).toHaveBeenCalled();
      expect(toastShowSpy).toHaveBeenCalledWith('删除成功', 'success', 3000);
      
      // 恢复spy
      toastShowSpy.mockRestore();
    });
    
    test('应该能够通过Store保存和恢复UI状态', () => {
      // 设置初始UI状态
      traceStore.set('ui', {
        theme: 'dark',
        sidebar: {
          collapsed: true
        },
        modal: {
          isOpen: false
        },
        toast: {
          visible: false
        }
      });
      
      // 保存当前状态
      const snapshot = traceStore.getSnapshot(['ui']);
      
      // 修改UI状态
      traceStore.set('ui.theme', 'light');
      traceStore.set('ui.sidebar.collapsed', false);
      traceStore.set('ui.modal.isOpen', true);
      traceStore.set('ui.toast.visible', true);
      
      // 验证状态已更改
      expect(traceStore.get('ui.theme')).toBe('light');
      expect(traceStore.get('ui.sidebar.collapsed')).toBe(false);
      expect(traceStore.get('ui.modal.isOpen')).toBe(true);
      expect(traceStore.get('ui.toast.visible')).toBe(true);
      
      // 恢复之前保存的状态
      traceStore.restoreSnapshot(snapshot);
      
      // 验证状态已恢复
      expect(traceStore.get('ui.theme')).toBe('dark');
      expect(traceStore.get('ui.sidebar.collapsed')).toBe(true);
      expect(traceStore.get('ui.modal.isOpen')).toBe(false);
      expect(traceStore.get('ui.toast.visible')).toBe(false);
    });
  });
}); 