/**
 * 食品溯源系统 - 状态管理模块
 * 版本: 1.0.0
 * 
 * 实现简单的状态管理解决方案，用于跨组件状态共享和持久化
 */

// 状态管理模块
export const traceStore = {
  // 默认配置
  config: {
    localStorageKey: 'trace-store',   // localStorage存储键名
    enableAutoSave: true,             // 是否自动保存状态
    autoSaveInterval: 5000,           // 自动保存间隔(毫秒)
    persistentKeys: [],               // 需要持久化的状态键列表 (为空表示全部持久化)
    logChanges: false                 // 是否记录状态变更日志
  },
  
  // 内部状态
  _state: {
    store: {},                        // 存储的状态
    listeners: {},                    // 状态变更监听器
    autoSaveTimer: null,              // 自动保存定时器
    initialized: false,               // 是否已初始化
    changeLog: []                     // 状态变更日志
  },
  
  /**
   * 初始化状态管理模块
   * @param {Object} options - 配置选项
   * @returns {Object} - 状态管理模块实例
   */
  init(options = {}) {
    // 合并配置
    this.config = { ...this.config, ...options };
    
    // 从本地存储加载状态
    this._loadFromStorage();
    
    // 设置自动保存
    if (this.config.enableAutoSave) {
      this._setupAutoSave();
    }
    
    // 标记为已初始化
    this._state.initialized = true;
    
    console.log('状态管理模块已初始化');
    return this;
  },
  
  /**
   * 从本地存储加载状态
   * @private
   */
  _loadFromStorage() {
    try {
      const storedData = localStorage.getItem(this.config.localStorageKey);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        
        // 如果定义了持久化键，只加载这些键
        if (this.config.persistentKeys.length > 0) {
          this.config.persistentKeys.forEach(key => {
            if (parsedData.hasOwnProperty(key)) {
              this._state.store[key] = parsedData[key];
            }
          });
        } else {
          // 否则加载所有数据
          this._state.store = { ...parsedData };
        }
      }
    } catch (err) {
      console.error('从localStorage加载状态失败:', err);
    }
  },
  
  /**
   * 保存状态到本地存储
   * @private
   */
  _saveToStorage() {
    try {
      let dataToSave;
      
      // 如果定义了持久化键，只保存这些键
      if (this.config.persistentKeys.length > 0) {
        dataToSave = {};
        this.config.persistentKeys.forEach(key => {
          if (this._state.store.hasOwnProperty(key)) {
            dataToSave[key] = this._state.store[key];
          }
        });
      } else {
        // 否则保存所有数据
        dataToSave = { ...this._state.store };
      }
      
      localStorage.setItem(this.config.localStorageKey, JSON.stringify(dataToSave));
    } catch (err) {
      console.error('保存状态到localStorage失败:', err);
    }
  },
  
  /**
   * 设置自动保存
   * @private
   */
  _setupAutoSave() {
    // 清除现有定时器
    if (this._state.autoSaveTimer) {
      clearInterval(this._state.autoSaveTimer);
    }
    
    // 设置新定时器
    this._state.autoSaveTimer = setInterval(() => {
      this._saveToStorage();
    }, this.config.autoSaveInterval);
  },
  
  /**
   * 获取状态
   * @param {string} key - 状态键，支持使用点号访问嵌套属性，如 'user.profile.name'
   * @param {*} defaultValue - 如果状态不存在，返回的默认值
   * @returns {*} - 状态值或默认值
   */
  get(key, defaultValue = null) {
    if (!key) return { ...this._state.store };
    
    // 处理嵌套键
    if (key.includes('.')) {
      const parts = key.split('.');
      let value = this._state.store;
      
      for (const part of parts) {
        if (value === undefined || value === null) {
          return defaultValue;
        }
        value = value[part];
      }
      
      return value === undefined ? defaultValue : value;
    }
    
    // 处理普通键
    return this._state.store.hasOwnProperty(key) ? this._state.store[key] : defaultValue;
  },
  
  /**
   * 设置状态
   * @param {string|Object} keyOrObject - 状态键或包含多个键值对的对象
   * @param {*} value - 状态值（当keyOrObject为字符串时）
   * @returns {boolean} - 操作是否成功
   */
  set(keyOrObject, value) {
    // 检查是否已初始化
    if (!this._state.initialized) {
      console.error('状态管理模块尚未初始化');
      return false;
    }
    
    const prevState = { ...this._state.store };
    let changes = {};
    
    // 如果keyOrObject是对象，一次设置多个键
    if (typeof keyOrObject === 'object' && keyOrObject !== null) {
      changes = { ...keyOrObject };
      
      // 更新状态
      Object.entries(keyOrObject).forEach(([key, val]) => {
        // 处理嵌套键
        if (key.includes('.')) {
          this._setNestedValue(key, val);
        } else {
          this._state.store[key] = val;
        }
      });
    } else if (typeof keyOrObject === 'string') {
      // 处理单个键
      const key = keyOrObject;
      changes = { [key]: value };
      
      // 处理嵌套键
      if (key.includes('.')) {
        this._setNestedValue(key, value);
      } else {
        this._state.store[key] = value;
      }
    } else {
      console.error('无效的参数', keyOrObject);
      return false;
    }
    
    // 记录变更
    if (this.config.logChanges) {
      this._state.changeLog.push({
        timestamp: Date.now(),
        changes,
        prevState,
        newState: { ...this._state.store }
      });
    }
    
    // 触发变更事件
    this._notifyListeners(changes, prevState);
    
    // 如果启用自动保存，立即保存
    if (this.config.enableAutoSave && !this._state.autoSaveTimer) {
      this._saveToStorage();
    }
    
    return true;
  },
  
  /**
   * 设置嵌套值
   * @param {string} key - 嵌套键，如 'user.profile.name'
   * @param {*} value - 要设置的值
   * @private
   */
  _setNestedValue(key, value) {
    const parts = key.split('.');
    const lastPart = parts.pop();
    
    let current = this._state.store;
    
    // 确保路径存在
    for (const part of parts) {
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    // 设置最终值
    current[lastPart] = value;
  },
  
  /**
   * 删除状态
   * @param {string} key - 状态键
   * @returns {boolean} - 是否成功删除
   */
  remove(key) {
    if (!key || typeof key !== 'string') {
      console.error('无效的键', key);
      return false;
    }
    
    const prevState = { ...this._state.store };
    
    // 处理嵌套键
    if (key.includes('.')) {
      const parts = key.split('.');
      const lastPart = parts.pop();
      
      let current = this._state.store;
      
      // 导航到嵌套对象
      for (const part of parts) {
        if (!current[part] || typeof current[part] !== 'object') {
          return false; // 路径不存在
        }
        current = current[part];
      }
      
      // 删除属性
      if (current.hasOwnProperty(lastPart)) {
        delete current[lastPart];
        
        // 记录变更
        if (this.config.logChanges) {
          this._state.changeLog.push({
            timestamp: Date.now(),
            changes: { [key]: undefined },
            prevState,
            newState: { ...this._state.store }
          });
        }
        
        // 触发变更事件
        this._notifyListeners({ [key]: undefined }, prevState);
        
        return true;
      }
      
      return false;
    }
    
    // 处理普通键
    if (this._state.store.hasOwnProperty(key)) {
      delete this._state.store[key];
      
      // 记录变更
      if (this.config.logChanges) {
        this._state.changeLog.push({
          timestamp: Date.now(),
          changes: { [key]: undefined },
          prevState,
          newState: { ...this._state.store }
        });
      }
      
      // 触发变更事件
      this._notifyListeners({ [key]: undefined }, prevState);
      
      return true;
    }
    
    return false;
  },
  
  /**
   * 清空状态
   * @param {Array} exceptKeys - 排除不清空的键数组
   * @returns {boolean} - 操作是否成功
   */
  clear(exceptKeys = []) {
    const prevState = { ...this._state.store };
    
    if (exceptKeys.length > 0) {
      // 保存需要保留的键
      const keysToKeep = {};
      exceptKeys.forEach(key => {
        if (this._state.store.hasOwnProperty(key)) {
          keysToKeep[key] = this._state.store[key];
        }
      });
      
      // 清空并恢复保留的键
      this._state.store = { ...keysToKeep };
    } else {
      // 完全清空
      this._state.store = {};
    }
    
    // 记录变更
    if (this.config.logChanges) {
      this._state.changeLog.push({
        timestamp: Date.now(),
        changes: { clear: true, exceptKeys },
        prevState,
        newState: { ...this._state.store }
      });
    }
    
    // 触发变更事件
    this._notifyListeners({ clear: true }, prevState);
    
    return true;
  },
  
  /**
   * 立即保存到本地存储
   * @returns {boolean} - 操作是否成功
   */
  save() {
    try {
      this._saveToStorage();
      return true;
    } catch (err) {
      console.error('保存状态失败:', err);
      return false;
    }
  },
  
  /**
   * 添加状态变更监听器
   * @param {string} key - 状态键，支持使用 * 监听所有变更
   * @param {Function} callback - 回调函数，接收 (newValue, oldValue, changeInfo) 参数
   * @returns {string} - 监听器ID，用于后续移除
   */
  subscribe(key, callback) {
    if (typeof callback !== 'function') {
      console.error('监听器必须是函数');
      return null;
    }
    
    const listenerId = `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (!this._state.listeners[key]) {
      this._state.listeners[key] = {};
    }
    
    this._state.listeners[key][listenerId] = callback;
    
    return listenerId;
  },
  
  /**
   * 移除状态变更监听器
   * @param {string} key - 状态键
   * @param {string} listenerId - 监听器ID
   * @returns {boolean} - 是否成功移除
   */
  unsubscribe(key, listenerId) {
    if (this._state.listeners[key] && this._state.listeners[key][listenerId]) {
      delete this._state.listeners[key][listenerId];
      
      // 如果没有更多监听器，清理空对象
      if (Object.keys(this._state.listeners[key]).length === 0) {
        delete this._state.listeners[key];
      }
      
      return true;
    }
    
    return false;
  },
  
  /**
   * 通知监听器
   * @param {Object} changes - 变更的键值对
   * @param {Object} prevState - 变更前的状态
   * @private
   */
  _notifyListeners(changes, prevState) {
    // 处理每个变更的键
    Object.keys(changes).forEach(key => {
      // 获取当前值
      const newValue = this.get(key);
      // 获取旧值
      const oldValue = this._getNestedValue(prevState, key);
      
      // 构建变更信息对象
      const changeInfo = {
        key,
        timestamp: Date.now(),
        path: key.includes('.') ? key.split('.') : [key]
      };
      
      // 通知特定键的监听器
      if (this._state.listeners[key]) {
        Object.values(this._state.listeners[key]).forEach(callback => {
          try {
            callback(newValue, oldValue, changeInfo);
          } catch (err) {
            console.error('执行监听器回调时出错:', err);
          }
        });
      }
      
      // 处理嵌套键的父级监听器
      if (key.includes('.')) {
        const parts = key.split('.');
        let parentKey = '';
        
        for (let i = 0; i < parts.length - 1; i++) {
          parentKey = parentKey ? `${parentKey}.${parts[i]}` : parts[i];
          
          if (this._state.listeners[parentKey]) {
            const parentNewValue = this.get(parentKey);
            const parentOldValue = this._getNestedValue(prevState, parentKey);
            
            Object.values(this._state.listeners[parentKey]).forEach(callback => {
              try {
                callback(parentNewValue, parentOldValue, {
                  ...changeInfo,
                  key: parentKey,
                  path: parentKey.split('.')
                });
              } catch (err) {
                console.error('执行父级监听器回调时出错:', err);
              }
            });
          }
        }
      }
      
      // 通知通配符监听器
      if (this._state.listeners['*']) {
        Object.values(this._state.listeners['*']).forEach(callback => {
          try {
            callback(this._state.store, prevState, {
              ...changeInfo,
              key: '*',
              changes
            });
          } catch (err) {
            console.error('执行通配符监听器回调时出错:', err);
          }
        });
      }
    });
  },
  
  /**
   * 从对象中获取嵌套值
   * @param {Object} obj - 源对象
   * @param {string} key - 嵌套键，如 'user.profile.name'
   * @returns {*} - 嵌套值或undefined
   * @private
   */
  _getNestedValue(obj, key) {
    if (!key.includes('.')) {
      return obj[key];
    }
    
    const parts = key.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  },
  
  /**
   * 获取状态变更日志
   * @returns {Array} - 状态变更日志数组
   */
  getChangeLog() {
    return [...this._state.changeLog];
  },
  
  /**
   * 清空状态变更日志
   */
  clearChangeLog() {
    this._state.changeLog = [];
  },
  
  /**
   * 获取状态快照
   * @returns {Object} - 当前状态的深拷贝
   */
  getSnapshot() {
    return JSON.parse(JSON.stringify(this._state.store));
  },
  
  /**
   * 从快照恢复状态
   * @param {Object} snapshot - 状态快照
   * @param {boolean} merge - 是否合并现有状态，false则完全替换
   * @returns {boolean} - 操作是否成功
   */
  restoreSnapshot(snapshot, merge = false) {
    if (!snapshot || typeof snapshot !== 'object') {
      console.error('无效的状态快照');
      return false;
    }
    
    const prevState = { ...this._state.store };
    
    if (merge) {
      // 合并状态
      this._state.store = {
        ...this._state.store,
        ...JSON.parse(JSON.stringify(snapshot))
      };
    } else {
      // 替换状态
      this._state.store = JSON.parse(JSON.stringify(snapshot));
    }
    
    // 记录变更
    if (this.config.logChanges) {
      this._state.changeLog.push({
        timestamp: Date.now(),
        changes: { restore: true, merge },
        prevState,
        newState: { ...this._state.store }
      });
    }
    
    // 触发变更事件
    this._notifyListeners({ restore: true }, prevState);
    
    return true;
  }
};

// 全局状态容器实例
export const createStore = (options = {}) => {
  return {
    ...Object.create(traceStore),
    config: { ...traceStore.config },
    _state: {
      store: {},
      listeners: {},
      autoSaveTimer: null,
      initialized: false,
      changeLog: []
    },
    init: function(initOptions = {}) {
      return traceStore.init.call(this, { ...options, ...initOptions });
    }
  };
};

// 为了向后兼容，导出到全局对象
if (typeof window !== 'undefined') {
  window.traceStore = traceStore;
  window.createStore = createStore;
} 