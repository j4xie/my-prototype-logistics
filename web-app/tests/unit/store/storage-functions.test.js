/**
 * 食品溯源系统 - 存储管理功能测试
 * 测试store模块的存储相关功能，包括快照、恢复和变更日志
 */

// 导入测试模块
const { traceStore, createStore } = require('../../../components/modules/store/store');

// 创建localStorage模拟
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    // 辅助测试的方法
    _getStore: () => store,
    _setStore: (newStore) => { store = { ...newStore }; }
  };
})();

// 在测试前设置
beforeEach(() => {
  // 清除所有模拟函数调用
  jest.clearAllMocks();
  
  // 模拟localStorage
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true
  });
  
  // 重置traceStore状态
  traceStore._state = {
    store: {},
    listeners: {},
    autoSaveTimer: null,
    initialized: false,
    changeLog: []
  };
  
  // 初始化traceStore，关闭自动保存以便测试
  traceStore.init({
    enableAutoSave: false,
    logChanges: true
  });
});

describe('存储管理功能测试', () => {
  describe('快照与恢复功能', () => {
    test('getSnapshot应返回当前状态的深拷贝', () => {
      // 设置初始状态
      traceStore.set({
        user: { id: 1, name: '张三' },
        settings: { theme: 'dark' }
      });
      
      // 获取快照
      const snapshot = traceStore.getSnapshot();
      
      // 验证快照内容
      expect(snapshot).toEqual({
        user: { id: 1, name: '张三' },
        settings: { theme: 'dark' }
      });
      
      // 修改原状态不应影响快照
      traceStore.set('user.name', '李四');
      expect(snapshot.user.name).toBe('张三');
    });
    
    test('restoreSnapshot应正确还原状态(替换模式)', () => {
      // 设置初始状态
      traceStore.set({
        user: { id: 1, name: '张三' },
        settings: { theme: 'dark' },
        data: [1, 2, 3]
      });
      
      // 创建快照
      const snapshot = {
        user: { id: 2, name: '李四' },
        preferences: { language: 'zh-CN' }
      };
      
      // 还原快照(替换模式)
      traceStore.restoreSnapshot(snapshot, false);
      
      // 验证状态被完全替换
      expect(traceStore.get()).toEqual({
        user: { id: 2, name: '李四' },
        preferences: { language: 'zh-CN' }
      });
      
      // 原来的settings和data应被删除
      expect(traceStore.get('settings')).toBeNull();
      expect(traceStore.get('data')).toBeNull();
    });
    
    test('restoreSnapshot应正确还原状态(合并模式)', () => {
      // 设置初始状态
      traceStore.set({
        user: { id: 1, name: '张三', role: 'admin' },
        settings: { theme: 'dark' },
        data: [1, 2, 3]
      });
      
      // 创建快照
      const snapshot = {
        user: { id: 2, name: '李四' },
        preferences: { language: 'zh-CN' }
      };
      
      // 还原快照(合并模式)
      traceStore.restoreSnapshot(snapshot, true);
      
      // 验证状态被合并
      expect(traceStore.get('user')).toEqual({ 
        id: 2,  // 被快照中的值覆盖
        name: '李四',  // 被快照中的值覆盖
        role: 'admin'  // 保留原值，因为快照中没有这个属性
      });
      expect(traceStore.get('settings')).toEqual({ theme: 'dark' });
      expect(traceStore.get('data')).toEqual([1, 2, 3]);
      expect(traceStore.get('preferences')).toEqual({ language: 'zh-CN' });
    });
    
    test('restoreSnapshot应触发状态变更事件', () => {
      // 设置监听器
      const mockListener = jest.fn();
      traceStore.subscribe('*', mockListener);
      
      // 设置初始状态
      traceStore.set('user', { name: '张三' });
      
      // 重置监听器调用记录
      mockListener.mockClear();
      
      // 创建快照并还原
      const snapshot = { user: { name: '李四' } };
      traceStore.restoreSnapshot(snapshot);
      
      // 验证监听器被调用
      expect(mockListener).toHaveBeenCalled();
    });
  });
  
  describe('变更日志功能', () => {
    test('set操作应记录到变更日志', () => {
      // 设置状态并生成变更日志
      traceStore.set('user', { name: '张三' });
      traceStore.set('settings', { theme: 'dark' });
      
      // 获取变更日志
      const changeLog = traceStore.getChangeLog();
      
      // 验证变更日志内容
      expect(changeLog.length).toBe(2);
      expect(changeLog[0].changes).toEqual({ user: { name: '张三' } });
      expect(changeLog[1].changes).toEqual({ settings: { theme: 'dark' } });
      expect(changeLog[0].timestamp).toBeDefined();
    });
    
    test('clearChangeLog应清空变更日志', () => {
      // 设置状态并生成变更日志
      traceStore.set('user', { name: '张三' });
      traceStore.set('settings', { theme: 'dark' });
      
      // 清空变更日志
      traceStore.clearChangeLog();
      
      // 验证变更日志已清空
      expect(traceStore.getChangeLog().length).toBe(0);
    });
    
    test('禁用日志功能时不应记录变更', () => {
      // 使用自定义配置创建store
      const customStore = createStore({
        logChanges: false
      });
      
      // 设置状态
      customStore.set('user', { name: '张三' });
      customStore.set('settings', { theme: 'dark' });
      
      // 验证变更日志为空
      expect(customStore.getChangeLog().length).toBe(0);
    });
  });
  
  describe('持久化存储功能', () => {
    test('应将状态保存到localStorage', () => {
      // 设置状态
      traceStore.set({
        user: { name: '张三' },
        settings: { theme: 'dark' }
      });
      
      // 手动保存
      traceStore.save();
      
      // 验证localStorage.setItem被调用
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'trace-store',
        expect.any(String)
      );
      
      // 验证保存的数据
      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(savedData).toEqual({
        user: { name: '张三' },
        settings: { theme: 'dark' }
      });
    });
    
    test('应仅保存persistentKeys中指定的键', () => {
      // 使用自定义配置初始化
      traceStore.init({
        enableAutoSave: false,
        persistentKeys: ['user']
      });
      
      // 设置状态
      traceStore.set({
        user: { name: '张三' },
        settings: { theme: 'dark' },
        temporary: { data: 'temp' }
      });
      
      // 手动保存
      traceStore.save();
      
      // 验证保存的数据
      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(savedData).toEqual({
        user: { name: '张三' }
      });
      expect(savedData.settings).toBeUndefined();
      expect(savedData.temporary).toBeUndefined();
    });
    
    test('应从localStorage加载状态', () => {
      // 预设localStorage数据
      const mockData = {
        user: { name: '张三' },
        settings: { theme: 'dark' }
      };
      mockLocalStorage._setStore({
        'trace-store': JSON.stringify(mockData)
      });
      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(mockData));
      
      // 重新初始化，应加载localStorage中的数据
      traceStore.init();
      
      // 验证状态已加载
      expect(traceStore.get('user')).toEqual({ name: '张三' });
      expect(traceStore.get('settings')).toEqual({ theme: 'dark' });
    });
    
    test('应正确处理localStorage加载失败', () => {
      // 模拟localStorage.getItem抛出异常
      mockLocalStorage.getItem.mockImplementationOnce(() => {
        throw new Error('模拟的存储错误');
      });
      
      // 捕获控制台错误
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // 重新初始化
      traceStore.init();
      
      // 验证错误被记录
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('从localStorage加载状态失败');
      
      // 恢复console.error
      consoleSpy.mockRestore();
    });
  });
  
  describe('createStore函数', () => {
    test('应创建独立的store实例', () => {
      // 创建自定义store实例
      const customStore = createStore({
        localStorageKey: 'custom-store'
      });
      
      // 设置主store和自定义store的状态
      traceStore.set('globalKey', 'global value');
      customStore.set('customKey', 'custom value');
      
      // 验证两个store实例是独立的
      expect(traceStore.get('globalKey')).toBe('global value');
      expect(traceStore.get('customKey')).toBeNull();
      expect(customStore.get('globalKey')).toBeNull();
      expect(customStore.get('customKey')).toBe('custom value');
    });
    
    test('不同实例应使用不同的localStorage键', () => {
      // 创建自定义store实例
      const customStore = createStore({
        localStorageKey: 'custom-store'
      });
      
      // 设置状态并保存
      traceStore.set('globalData', 'global');
      customStore.set('customData', 'custom');
      
      traceStore.save();
      customStore.save();
      
      // 验证使用了不同的localStorage键
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'trace-store',
        expect.any(String)
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'custom-store',
        expect.any(String)
      );
    });
  });
}); 