/*
 * 全局状态管理 - 溯源商城高保真原型系统
 * 使用LocalStorage进行持久化
 */

class StateManager {
  constructor() {
    this.state = {};
    this.listeners = {};
    this.storageKey = 'cretas_prototype_state';

    // 从LocalStorage加载状态
    this.loadFromStorage();
  }

  /**
   * 获取状态
   * @param {string} key - 状态键
   * @param {any} defaultValue - 默认值
   * @returns {any} 状态值
   */
  get(key, defaultValue = null) {
    return key.split('.').reduce((obj, k) => obj?.[k], this.state) ?? defaultValue;
  }

  /**
   * 设置状态
   * @param {string} key - 状态键
   * @param {any} value - 状态值
   * @param {boolean} persist - 是否持久化
   */
  set(key, value, persist = true) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, k) => {
      if (!obj[k]) obj[k] = {};
      return obj[k];
    }, this.state);

    target[lastKey] = value;

    // 持久化
    if (persist) {
      this.saveToStorage();
    }

    // 通知监听器
    this.notify(key, value);
  }

  /**
   * 删除状态
   * @param {string} key - 状态键
   */
  remove(key) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, k) => obj?.[k], this.state);

    if (target) {
      delete target[lastKey];
      this.saveToStorage();
      this.notify(key, null);
    }
  }

  /**
   * 清空所有状态
   */
  clear() {
    this.state = {};
    localStorage.removeItem(this.storageKey);
    this.notifyAll();
  }

  /**
   * 监听状态变化
   * @param {string} key - 状态键
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消监听的函数
   */
  subscribe(key, callback) {
    if (!this.listeners[key]) {
      this.listeners[key] = [];
    }
    this.listeners[key].push(callback);

    // 返回取消订阅函数
    return () => {
      this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
    };
  }

  /**
   * 通知监听器
   * @param {string} key - 状态键
   * @param {any} value - 新值
   */
  notify(key, value) {
    if (this.listeners[key]) {
      this.listeners[key].forEach(callback => callback(value));
    }
  }

  /**
   * 通知所有监听器
   */
  notifyAll() {
    Object.keys(this.listeners).forEach(key => {
      const value = this.get(key);
      this.notify(key, value);
    });
  }

  /**
   * 从LocalStorage加载状态
   */
  loadFromStorage() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.state = JSON.parse(data);
      }
    } catch (err) {
      console.error('Failed to load state from localStorage:', err);
    }
  }

  /**
   * 保存状态到LocalStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (err) {
      console.error('Failed to save state to localStorage:', err);
    }
  }
}

// 创建全局实例
const globalState = new StateManager();

// 常用状态键
const StateKeys = {
  // 用户相关
  USER: 'user',
  USER_ID: 'user.id',
  USER_NAME: 'user.name',
  USER_AVATAR: 'user.avatar',
  USER_LEVEL: 'user.level',

  // 认证相关
  ACCESS_TOKEN: 'auth.accessToken',
  REFRESH_TOKEN: 'auth.refreshToken',
  IS_LOGGED_IN: 'auth.isLoggedIn',

  // 导航相关
  CURRENT_TAB: 'navigation.currentTab',
  PAGE_HISTORY: 'navigation.history',

  // 购物车（C端）
  CART_ITEMS: 'cart.items',
  CART_COUNT: 'cart.count',

  // 筛选条件（缓存）
  FILTER_CATEGORY: 'filter.category',
  FILTER_KEYWORD: 'filter.keyword',

  // 后台管理（Web端）
  ADMIN_SIDEBAR_COLLAPSED: 'admin.sidebarCollapsed',
  ADMIN_TABLE_PAGE_SIZE: 'admin.tablePageSize'
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StateManager, globalState, StateKeys };
}
