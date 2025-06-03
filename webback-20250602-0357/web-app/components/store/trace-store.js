/**
 * 食品溯源系统 - 中央状态管理
 * 提供统一的数据存储、共享和验证功能
 */

// UPDATED CODE: 创建状态管理类
class TraceStore {
  constructor() {
    // 用户相关状态
    this.user = {
      id: null,
      name: null,
      role: null,
      permissions: [],
      isAuthenticated: false,
      lastActivity: null
    };
    
    // 溯源数据状态
    this.trace = {
      currentId: null,
      drafts: {}, // 保存未完成的溯源记录
      currentStage: null,
      progress: 0,
      isModified: false,
      validationErrors: []
    };
    
    // 系统设置
    this.settings = {
      language: 'zh-CN',
      theme: 'light',
      notifications: true,
      autoSave: true,
      offlineMode: false
    };
    
    // 观察者列表 - 用于状态变更通知
    this._observers = {};
    
    // 初始化本地存储
    this._initStorage();
  }
  
  /**
   * 初始化存储
   */
  _initStorage() {
    // 从localStorage加载用户数据
    try {
      const savedUser = localStorage.getItem('trace_user');
      if (savedUser) {
        this.user = { ...this.user, ...JSON.parse(savedUser) };
      }
      
      // 加载系统设置
      const savedSettings = localStorage.getItem('trace_settings');
      if (savedSettings) {
        this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
      }
      
      // 加载草稿数据
      const savedDrafts = localStorage.getItem('trace_drafts');
      if (savedDrafts) {
        this.trace.drafts = JSON.parse(savedDrafts);
      }
      
      console.log('状态管理: 已从本地存储加载数据');
    } catch (error) {
      console.error('状态管理: 加载本地存储数据失败', error);
    }
  }
  
  /**
   * 保存状态到本地存储
   */
  _saveToStorage() {
    try {
      localStorage.setItem('trace_user', JSON.stringify(this.user));
      localStorage.setItem('trace_settings', JSON.stringify(this.settings));
      localStorage.setItem('trace_drafts', JSON.stringify(this.trace.drafts));
    } catch (error) {
      console.error('状态管理: 保存到本地存储失败', error);
    }
  }
  
  /**
   * 订阅状态变更
   * @param {string} topic 主题名称
   * @param {Function} callback 回调函数
   * @return {string} 订阅ID
   */
  subscribe(topic, callback) {
    if (!this._observers[topic]) {
      this._observers[topic] = [];
    }
    
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    this._observers[topic].push({ id, callback });
    
    return id;
  }
  
  /**
   * 取消订阅
   * @param {string} topic 主题名称
   * @param {string} id 订阅ID
   */
  unsubscribe(topic, id) {
    if (this._observers[topic]) {
      this._observers[topic] = this._observers[topic].filter(
        observer => observer.id !== id
      );
    }
  }
  
  /**
   * 通知状态变更
   * @param {string} topic 主题名称
   * @param {any} data 变更数据
   */
  _notify(topic, data) {
    if (this._observers[topic]) {
      this._observers[topic].forEach(observer => {
        try {
          observer.callback(data);
        } catch (error) {
          console.error(`状态管理: 通知观察者失败: ${topic}`, error);
        }
      });
    }
  }
  
  /**
   * 设置用户信息
   * @param {Object} userData 用户数据
   */
  setUser(userData) {
    const oldUser = { ...this.user };
    this.user = { ...this.user, ...userData };
    
    // 如果身份验证状态发生变化，更新最后活动时间
    if (oldUser.isAuthenticated !== this.user.isAuthenticated && this.user.isAuthenticated) {
      this.user.lastActivity = Date.now();
    }
    
    this._saveToStorage();
    this._notify('user', this.user);
    return this.user;
  }
  
  /**
   * 用户登录
   * @param {Object} userData 用户数据
   */
  login(userData) {
    this.setUser({
      ...userData,
      isAuthenticated: true,
      lastActivity: Date.now()
    });
    this._notify('auth', { action: 'login', user: this.user });
    return this.user;
  }
  
  /**
   * 用户登出
   */
  logout() {
    const oldUser = { ...this.user };
    this.user = {
      id: null,
      name: null,
      role: null,
      permissions: [],
      isAuthenticated: false,
      lastActivity: null
    };
    
    this._saveToStorage();
    this._notify('auth', { action: 'logout', previousUser: oldUser });
    return this.user;
  }
  
  /**
   * 检查用户权限
   * @param {string} permission 权限名称
   * @return {boolean} 是否有权限
   */
  hasPermission(permission) {
    if (!this.user.isAuthenticated) return false;
    if (this.user.role === 'admin') return true;
    return this.user.permissions.includes(permission);
  }
  
  /**
   * 保存溯源草稿
   * @param {string} id 溯源ID
   * @param {Object} data 溯源数据
   */
  saveTraceDraft(id, data) {
    if (!id) return null;
    
    this.trace.drafts[id] = {
      ...this.trace.drafts[id],
      ...data,
      updatedAt: Date.now()
    };
    
    this.trace.isModified = true;
    this.trace.currentId = id;
    
    this._saveToStorage();
    this._notify('trace', { action: 'save_draft', id, data: this.trace.drafts[id] });
    
    return this.trace.drafts[id];
  }
  
  /**
   * 获取溯源草稿
   * @param {string} id 溯源ID
   * @return {Object} 溯源草稿数据
   */
  getTraceDraft(id) {
    return id ? this.trace.drafts[id] : null;
  }
  
  /**
   * 删除溯源草稿
   * @param {string} id 溯源ID
   */
  deleteTraceDraft(id) {
    if (id && this.trace.drafts[id]) {
      const draft = { ...this.trace.drafts[id] };
      delete this.trace.drafts[id];
      
      if (this.trace.currentId === id) {
        this.trace.currentId = null;
      }
      
      this._saveToStorage();
      this._notify('trace', { action: 'delete_draft', id, data: draft });
    }
  }
  
  /**
   * 设置当前溯源阶段
   * @param {string} stage 阶段名称
   * @param {number} progress 进度百分比
   */
  setTraceStage(stage, progress) {
    this.trace.currentStage = stage;
    this.trace.progress = progress;
    
    this._notify('trace', { 
      action: 'change_stage', 
      stage, 
      progress,
      currentId: this.trace.currentId
    });
  }
  
  /**
   * 验证溯源数据
   * @param {Object} data 溯源数据
   * @param {Array} rules 验证规则
   * @return {Object} 验证结果
   */
  validateTraceData(data, rules) {
    const errors = [];
    const validData = {};
    
    for (const field in rules) {
      const value = data[field];
      const rule = rules[field];
      
      // 检查必填字段
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({ field, message: `${rule.label || field}是必填项` });
        continue;
      }
      
      // 验证通过后的数据处理（类型转换等）
      validData[field] = value;
      
      // 如果值为空且非必填，则跳过后续验证
      if (value === undefined || value === null || value === '') {
        continue;
      }
      
      // 检查类型和格式
      if (rule.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push({ field, message: `${rule.label || field}必须是数字` });
        } else {
          validData[field] = num;
        }
      } else if (rule.type === 'date') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          errors.push({ field, message: `${rule.label || field}不是有效的日期格式` });
        }
      } else if (rule.pattern) {
        const regex = new RegExp(rule.pattern);
        if (!regex.test(value)) {
          errors.push({ field, message: rule.message || `${rule.label || field}格式不正确` });
        }
      }
      
      // 检查长度
      if (rule.minLength && String(value).length < rule.minLength) {
        errors.push({ field, message: `${rule.label || field}长度不能小于${rule.minLength}个字符` });
      }
      
      if (rule.maxLength && String(value).length > rule.maxLength) {
        errors.push({ field, message: `${rule.label || field}长度不能超过${rule.maxLength}个字符` });
      }
    }
    
    this.trace.validationErrors = errors;
    
    return {
      isValid: errors.length === 0,
      errors,
      data: validData
    };
  }
  
  /**
   * 更新系统设置
   * @param {Object} newSettings 新设置
   */
  updateSettings(newSettings) {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };
    
    this._saveToStorage();
    this._notify('settings', { 
      action: 'update', 
      old: oldSettings, 
      new: this.settings 
    });
    
    return this.settings;
  }
  
  /**
   * 获取当前状态
   * @return {Object} 完整状态
   */
  getState() {
    return {
      user: { ...this.user },
      trace: { ...this.trace },
      settings: { ...this.settings }
    };
  }
}

// 创建单例并导出
export const traceStore = new TraceStore();

// 在文档加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('状态管理: 已初始化');
}); 