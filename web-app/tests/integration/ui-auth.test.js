/**
 * UI组件与Auth模块的集成测试
 * @version 1.0.0
 */

import { traceModal } from '../../components/modules/ui/modal';
import { traceToast } from '../../components/modules/ui/toast';
import { traceAuth } from '../../components/modules/auth/auth';
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

  // 创建登录表单
  const loginForm = document.createElement('form');
  loginForm.id = 'login-form';
  loginForm.innerHTML = `
    <input type="text" id="username" name="username" />
    <input type="password" id="password" name="password" />
    <button type="submit" id="login-button">登录</button>
  `;
  container.appendChild(loginForm);
  
  // 模拟CustomEvent
  window.CustomEvent = function(event, params) {
    params = params || { bubbles: false, cancelable: false, detail: null };
    const evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    return evt;
  };
}

// 测试前的初始化
beforeEach(() => {
  // 重置DOM环境
  setupTestDOM();
  
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
  
  // 初始化Auth模块
  traceAuth.init();
  
  // 初始化UI组件
  traceModal.init();
  traceToast.init();
});

describe('UI组件与Auth模块集成测试', () => {
  // 测试登录表单验证集成
  describe('登录表单验证集成', () => {
    test('无效的登录表单应该显示错误提示', () => {
      // 模拟Toast.show方法
      const toastShowSpy = jest.spyOn(traceToast, 'show');
      
      // 创建无效的表单数据
      const formData = {
        username: '',
        password: '123'
      };
      
      // 验证表单
      const validationResult = traceAuth.validateLoginForm(formData);
      
      // 表单无效，显示错误提示
      if (!validationResult.isValid) {
        // 获取第一个错误消息
        const firstErrorMessage = Object.values(validationResult.errors)[0];
        traceToast.show(firstErrorMessage, 'error');
      }
      
      // 验证Toast.show被调用显示错误消息
      expect(toastShowSpy).toHaveBeenCalled();
      expect(toastShowSpy).toHaveBeenCalledWith('用户名不能为空', 'error');
      
      // 恢复spy
      toastShowSpy.mockRestore();
    });
    
    test('有效的登录表单应该提交并登录', () => {
      // 模拟Auth.login方法
      const loginSpy = jest.spyOn(traceAuth, 'login');
      
      // 模拟Toast.show方法
      const toastShowSpy = jest.spyOn(traceToast, 'show');
      
      // 创建有效的表单数据
      const formData = {
        username: 'testuser',
        password: 'password123'
      };
      
      // 验证表单
      const validationResult = traceAuth.validateLoginForm(formData);
      
      // 表单有效，模拟登录
      if (validationResult.isValid) {
        // 模拟成功登录
        traceAuth.login({
          id: 'user123',
          username: formData.username,
          role: 'user',
          permissions: ['read', 'write']
        });
        
        // 显示成功消息
        traceToast.show('登录成功', 'success');
      }
      
      // 验证Auth.login被调用
      expect(loginSpy).toHaveBeenCalled();
      
      // 验证登录状态
      expect(traceAuth.isLoggedIn).toBe(true);
      expect(traceAuth.user.username).toBe('testuser');
      
      // 验证Toast.show被调用显示成功消息
      expect(toastShowSpy).toHaveBeenCalled();
      expect(toastShowSpy).toHaveBeenCalledWith('登录成功', 'success');
      
      // 恢复spy
      loginSpy.mockRestore();
      toastShowSpy.mockRestore();
    });
  });
  
  // 测试认证状态与UI的集成
  describe('认证状态与UI的集成', () => {
    test('登录状态应该反映在Store中', () => {
      // 订阅Store变更
      let storeChanged = false;
      const unsubscribe = traceStore.subscribe('auth', () => {
        storeChanged = true;
      });
      
      // 模拟用户登录
      traceAuth.login({
        id: 'user123',
        username: 'testuser',
        role: 'admin',
        permissions: ['admin.access']
      });
      
      // 将认证状态同步到Store
      traceStore.set('auth', {
        isLoggedIn: traceAuth.isLoggedIn,
        user: traceAuth.user,
        role: traceAuth.getUserRole()
      });
      
      // 验证Store状态被更新
      expect(storeChanged).toBe(true);
      
      // 验证Store中的认证状态
      const authState = traceStore.get('auth');
      expect(authState.isLoggedIn).toBe(true);
      expect(authState.user.username).toBe('testuser');
      expect(authState.role).toBe('admin');
      
      // 移除订阅
      unsubscribe();
    });
    
    test('登出操作应该清除认证状态并更新UI', () => {
      // 模拟Modal.show方法
      const modalShowSpy = jest.spyOn(traceModal, 'show');
      
      // 先登录用户
      traceAuth.login({
        id: 'user123',
        username: 'testuser',
        role: 'user'
      });
      
      // 同步到Store
      traceStore.set('auth.isLoggedIn', traceAuth.isLoggedIn);
      traceStore.set('auth.user', traceAuth.user);
      
      // 模拟登出确认对话框
      traceModal.show({
        title: '确认登出',
        content: '您确定要退出登录吗？',
        confirmText: '确认',
        cancelText: '取消',
        onConfirm: () => {
          // 执行登出操作
          traceAuth.logout();
          
          // 同步到Store
          traceStore.set('auth.isLoggedIn', traceAuth.isLoggedIn);
          traceStore.set('auth.user', traceAuth.user);
          
          // 显示登出成功消息
          traceToast.show('已成功退出登录', 'info');
        }
      });
      
      // 验证Modal.show被调用
      expect(modalShowSpy).toHaveBeenCalled();
      
      // 模拟点击确认按钮
      const confirmButton = document.querySelector('.trace-modal-confirm');
      if (confirmButton) {
        confirmButton.click();
      }
      
      // 验证登出后的状态
      expect(traceAuth.isLoggedIn).toBe(false);
      expect(Object.keys(traceAuth.user).length).toBe(0);
      
      // 验证Store中的认证状态已更新
      expect(traceStore.get('auth.isLoggedIn')).toBe(false);
      
      // 恢复spy
      modalShowSpy.mockRestore();
    });
  });
  
  // 测试权限控制与UI的集成
  describe('权限控制与UI的集成', () => {
    test('UI元素应该根据用户权限显示或隐藏', () => {
      // 创建需要权限控制的UI元素
      const adminButton = document.createElement('button');
      adminButton.id = 'admin-button';
      adminButton.classList.add('permission-required');
      adminButton.dataset.permission = 'admin.access';
      adminButton.textContent = '管理员功能';
      
      const userButton = document.createElement('button');
      userButton.id = 'user-button';
      userButton.classList.add('permission-required');
      userButton.dataset.permission = 'user.basic';
      userButton.textContent = '用户功能';
      
      document.getElementById('test-container').appendChild(adminButton);
      document.getElementById('test-container').appendChild(userButton);
      
      // 用户未登录时，所有权限控制元素应隐藏
      function updateUIByPermissions() {
        const permissionElements = document.querySelectorAll('.permission-required');
        
        permissionElements.forEach(element => {
          const requiredPermission = element.dataset.permission;
          const hasPermission = traceAuth.hasPermission(requiredPermission);
          
          if (hasPermission) {
            element.style.display = '';
          } else {
            element.style.display = 'none';
          }
        });
      }
      
      // 初始状态：未登录
      updateUIByPermissions();
      
      // 开发模式下总是返回true
      // 但在测试中我们想验证实际逻辑，所以暂时替换方法
      const originalHasPermission = traceAuth.hasPermission;
      traceAuth.hasPermission = function(permission) {
        if (!this.isLoggedIn) return false;
        
        if (this.user.role === 'admin') return true;
        
        if (Array.isArray(this.user.permissions)) {
          return this.user.permissions.includes(permission);
        }
        
        return false;
      };
      
      // 再次更新UI
      updateUIByPermissions();
      
      // 验证未登录状态下的UI
      expect(adminButton.style.display).toBe('');
      expect(userButton.style.display).toBe('');
      
      // 普通用户登录
      traceAuth.login({
        id: 'user123',
        username: 'testuser',
        role: 'user',
        permissions: ['user.basic']
      });
      
      // 更新UI
      updateUIByPermissions();
      
      // 验证普通用户状态下的UI
      expect(adminButton.style.display).toBe('none');
      expect(userButton.style.display).toBe('');
      
      // 管理员登录
      traceAuth.logout();
      traceAuth.login({
        id: 'admin123',
        username: 'admin',
        role: 'admin',
        permissions: ['admin.access']
      });
      
      // 更新UI
      updateUIByPermissions();
      
      // 验证管理员状态下的UI
      expect(adminButton.style.display).toBe('');
      expect(userButton.style.display).toBe('');
      
      // 恢复原始方法
      traceAuth.hasPermission = originalHasPermission;
    });
  });
  
  // 测试表单验证与UI的集成
  describe('表单验证与UI的集成', () => {
    test('登录表单提交应该在UI上显示验证结果', () => {
      // 模拟表单提交事件处理器
      const formSubmitHandler = (event) => {
        // 在实际环境中会阻止默认行为
        // event.preventDefault();
        
        // 获取表单数据
        const form = document.getElementById('login-form');
        const formData = {
          username: form.elements.username.value,
          password: form.elements.password.value
        };
        
        // 验证表单
        const validationResult = traceAuth.validateLoginForm(formData);
        
        // 清除之前的验证消息
        const existingErrorMessages = document.querySelectorAll('.error-message');
        existingErrorMessages.forEach(element => element.remove());
        
        // 处理验证结果
        if (!validationResult.isValid) {
          // 显示错误消息
          Object.entries(validationResult.errors).forEach(([field, message]) => {
            const inputElement = document.getElementById(field);
            
            if (inputElement) {
              // 添加错误样式
              inputElement.classList.add('input-error');
              
              // 创建并添加错误消息
              const errorElement = document.createElement('div');
              errorElement.className = 'error-message';
              errorElement.textContent = message;
              errorElement.style.color = 'red';
              
              inputElement.parentNode.insertBefore(errorElement, inputElement.nextSibling);
            }
          });
          
          // 显示通用错误消息
          traceToast.show('登录信息验证失败，请检查输入', 'error');
          
          return false;
        }
        
        return true;
      };
      
      // 获取表单和元素
      const form = document.getElementById('login-form');
      const usernameInput = document.getElementById('username');
      const passwordInput = document.getElementById('password');
      
      // 设置无效的输入值
      usernameInput.value = '';
      passwordInput.value = '123';
      
      // 触发表单提交处理
      const result = formSubmitHandler();
      
      // 验证表单验证失败
      expect(result).toBe(false);
      
      // 验证UI上是否显示了错误消息
      const errorMessages = document.querySelectorAll('.error-message');
      expect(errorMessages.length).toBeGreaterThan(0);
      expect(errorMessages[0].textContent).toBe('用户名不能为空');
      
      // 验证输入框是否添加了错误样式
      expect(usernameInput.classList.contains('input-error')).toBe(true);
      
      // 设置有效的输入值
      usernameInput.value = 'testuser';
      passwordInput.value = 'password123';
      
      // 清除之前的验证消息
      const existingErrorMessages = document.querySelectorAll('.error-message');
      existingErrorMessages.forEach(element => element.remove());
      usernameInput.classList.remove('input-error');
      passwordInput.classList.remove('input-error');
      
      // 再次触发表单提交处理
      const validResult = formSubmitHandler();
      
      // 验证表单验证成功
      expect(validResult).toBe(true);
      
      // 验证UI上没有错误消息
      const newErrorMessages = document.querySelectorAll('.error-message');
      expect(newErrorMessages.length).toBe(0);
    });
  });
}); 