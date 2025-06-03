/**
 * @module traceCore
 * @description 食品溯源系统 - 核心功能模块
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 */

// 引入必要的依赖
const traceUI = window.traceUI || {};
const traceData = window.traceData || {};
const traceNav = window.traceNav || {};

// 系统配置
const config = {
  appName: "食品溯源系统",
  version: "1.0.0",
  apiEndpoint: "/api",
  dataStorage: "indexeddb", // 'indexeddb', 'localstorage', 'server'
  defaultLanguage: "zh-CN",
  scanEnabled: true,
  blockchainEnabled: true,
  mapProvider: "amap", // 'amap', 'google', 'baidu'
  offlineMode: false,
  debugMode: false,
  syncInterval: 300000, // 5分钟
  maxCacheSize: 10485760, // 10MB
  sessionTimeout: 1800000, // 30分钟
  authRequired: true
};

// 用户状态
let userState = {
  isAuthenticated: false,
  userId: null,
  username: null,
  role: null,
  permissions: [],
  lastActivity: Date.now(),
  settings: {}
};

// 应用状态
let appState = {
  initialized: false,
  online: navigator.onLine,
  syncing: false,
  lastSync: null,
  pendingChanges: 0,
  currentPage: null,
  loadingStatus: null,
  notifications: [],
  errors: []
};

// 组件注册表
const components = {};

// 模块加载状态
const moduleStatus = {
  ui: false,
  data: false,
  nav: false,
  blockchain: false,
  map: false,
  scanner: false,
  performance: false
};

/**
 * 食品溯源系统核心模块
 */
const traceCore = {
  /**
   * 初始化系统
   * @param {Object} options - 配置选项
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async init(options = {}) {
    console.log(`${config.appName} v${config.version} 正在初始化...`);
    
    // 合并配置
    Object.assign(config, options);
    
    // 记录初始化开始时间
    const startTime = Date.now();
    
    try {
      // 初始化UI组件
      if (typeof traceUI.init === 'function') {
        await traceUI.init();
        moduleStatus.ui = true;
      } else {
        console.warn('UI模块未找到或init方法不存在');
      }
      
      // 初始化数据模块
      if (typeof traceData.init === 'function') {
        await traceData.init({
          storageType: config.dataStorage,
          apiEndpoint: config.apiEndpoint,
          offlineMode: config.offlineMode
        });
        moduleStatus.data = true;
      } else {
        console.warn('数据模块未找到或init方法不存在');
      }
      
      // 初始化导航模块
      if (typeof traceNav.init === 'function') {
        await traceNav.init();
        moduleStatus.nav = true;
      } else {
        console.warn('导航模块未找到或init方法不存在');
      }
      
      // 懒加载其他组件
      this.loadAdditionalModules();
      
      // 设置网络状态监听
      this.setupNetworkListeners();
      
      // 设置活动监听
      this.setupActivityTracking();
      
      // 加载用户设置
      await this.loadUserSettings();
      
      // 如果启用了自动同步，设置同步定时器
      if (config.syncInterval > 0) {
        this.startSyncTimer();
      }
      
      // 初始化完成
      appState.initialized = true;
      
      // 计算初始化时间
      const initTime = Date.now() - startTime;
      console.log(`${config.appName} 初始化完成 (${initTime}ms)`);
      
      // 触发初始化完成事件
      this.triggerEvent('init_complete', { initTime });
      
      return true;
    } catch (error) {
      console.error('系统初始化失败:', error);
      appState.errors.push({
        type: 'init_error',
        message: error.message,
        timestamp: Date.now(),
        details: error.stack
      });
      
      // 触发初始化失败事件
      this.triggerEvent('init_error', { error });
      
      return false;
    }
  },
  
  /**
   * 加载附加模块
   */
  async loadAdditionalModules() {
    // 按需加载其他模块
    this.loadModule('blockchain', config.blockchainEnabled);
    this.loadModule('map', true);
    this.loadModule('scanner', config.scanEnabled);
    this.loadModule('performance', !config.offlineMode);
  },
  
  /**
   * 加载特定模块
   * @param {string} moduleName - 模块名称
   * @param {boolean} shouldLoad - 是否应该加载
   */
  async loadModule(moduleName, shouldLoad) {
    if (!shouldLoad) {
      return;
    }
    
    // 记录加载开始
    appState.loadingStatus = `正在加载${moduleName}模块...`;
    this.triggerEvent('module_loading', { module: moduleName });
    
    try {
      let moduleLoaded = false;
      
      switch (moduleName) {
        case 'blockchain':
          if (typeof window.traceBlockchain !== 'undefined') {
            const result = await window.traceBlockchain.init();
            moduleStatus.blockchain = result;
            moduleLoaded = result;
          } else {
            await this.loadScript('components/trace-blockchain.js');
            
            if (typeof window.traceBlockchain !== 'undefined') {
              const result = await window.traceBlockchain.init();
              moduleStatus.blockchain = result;
              moduleLoaded = result;
            }
          }
          break;
          
        case 'map':
          if (typeof window.traceMap !== 'undefined') {
            const result = await window.traceMap.init({ provider: config.mapProvider });
            moduleStatus.map = result;
            moduleLoaded = result;
          } else {
            await this.loadScript('components/trace-map.js');
            
            if (typeof window.traceMap !== 'undefined') {
              const result = await window.traceMap.init({ provider: config.mapProvider });
              moduleStatus.map = result;
              moduleLoaded = result;
            }
          }
          break;
          
        case 'scanner':
          if (typeof window.traceScanner !== 'undefined') {
            const result = await window.traceScanner.init();
            moduleStatus.scanner = result;
            moduleLoaded = result;
          } else {
            await this.loadScript('components/trace-scanner.js');
            
            if (typeof window.traceScanner !== 'undefined') {
              const result = await window.traceScanner.init();
              moduleStatus.scanner = result;
              moduleLoaded = result;
            }
          }
          break;
          
        case 'performance':
          if (typeof window.tracePerformance !== 'undefined') {
            const result = await window.tracePerformance.init();
            moduleStatus.performance = result;
            moduleLoaded = result;
          } else {
            await this.loadScript('components/trace-performance.js');
            
            if (typeof window.tracePerformance !== 'undefined') {
              const result = await window.tracePerformance.init();
              moduleStatus.performance = result;
              moduleLoaded = result;
            }
          }
          break;
          
        default:
          console.warn(`未知模块: ${moduleName}`);
      }
      
      // 更新加载状态
      appState.loadingStatus = null;
      
      // 触发模块加载事件
      this.triggerEvent('module_loaded', { 
        module: moduleName,
        success: moduleLoaded
      });
      
    } catch (error) {
      console.error(`${moduleName}模块加载失败:`, error);
      
      // 更新加载状态
      appState.loadingStatus = null;
      
      // 记录错误
      appState.errors.push({
        type: 'module_load_error',
        module: moduleName,
        message: error.message,
        timestamp: Date.now()
      });
      
      // 触发模块加载错误事件
      this.triggerEvent('module_load_error', { 
        module: moduleName,
        error 
      });
    }
  },
  
  /**
   * 加载脚本
   * @param {string} url - 脚本URL
   * @returns {Promise<void>}
   */
  loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`加载脚本失败: ${url}`));
      
      document.head.appendChild(script);
    });
  },
  
  /**
   * 设置网络状态监听器
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      appState.online = true;
      this.triggerEvent('online', {});
      
      // 如果有待处理的更改，尝试同步
      if (appState.pendingChanges > 0) {
        this.syncData();
      }
    });
    
    window.addEventListener('offline', () => {
      appState.online = false;
      this.triggerEvent('offline', {});
      
      // 显示离线通知
      if (traceUI && traceUI.showToast) {
        traceUI.showToast('您当前处于离线模式，数据将在恢复连接后同步', 'warning', 5000);
      }
    });
  },
  
  /**
   * 设置用户活动跟踪
   */
  setupActivityTracking() {
    // 监听用户活动
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    const updateActivity = () => {
      userState.lastActivity = Date.now();
    };
    
    activityEvents.forEach(eventType => {
      document.addEventListener(eventType, updateActivity, { passive: true });
    });
    
    // 定期检查会话超时
    if (config.sessionTimeout > 0 && config.authRequired) {
      setInterval(() => {
        const inactiveTime = Date.now() - userState.lastActivity;
        
        // 如果超过会话超时时间，自动登出
        if (inactiveTime >= config.sessionTimeout && userState.isAuthenticated) {
          this.logout({ reason: 'timeout' });
        }
      }, 60000); // 每分钟检查一次
    }
  },
  
  /**
   * 启动数据同步定时器
   */
  startSyncTimer() {
    // 清除现有定时器
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    // 设置新的定时器
    this.syncTimer = setInterval(() => {
      if (appState.online && !appState.syncing) {
        this.syncData();
      }
    }, config.syncInterval);
  },
  
  /**
   * 同步数据
   * @returns {Promise<boolean>} 同步是否成功
   */
  async syncData() {
    if (appState.syncing || !appState.online) {
      return false;
    }
    
    appState.syncing = true;
    this.triggerEvent('sync_start', {});
    
    try {
      // 调用数据模块的同步功能
      if (traceData && typeof traceData.syncData === 'function') {
        const result = await traceData.syncData();
        
        // 更新同步状态
        appState.lastSync = Date.now();
        appState.pendingChanges = result.pendingChanges || 0;
        
        // 触发同步完成事件
        this.triggerEvent('sync_complete', { 
          success: true,
          timestamp: appState.lastSync,
          pendingChanges: appState.pendingChanges
        });
        
        appState.syncing = false;
        return true;
      } else {
        throw new Error('数据同步功能不可用');
      }
    } catch (error) {
      console.error('数据同步失败:', error);
      
      // 记录错误
      appState.errors.push({
        type: 'sync_error',
        message: error.message,
        timestamp: Date.now()
      });
      
      // 触发同步错误事件
      this.triggerEvent('sync_error', { error });
      
      appState.syncing = false;
      return false;
    }
  },
  
  /**
   * 加载用户设置
   * @returns {Promise<Object>} 用户设置
   */
  async loadUserSettings() {
    try {
      if (userState.isAuthenticated && userState.userId) {
        // 尝试从服务器加载用户设置
        if (appState.online && traceData && typeof traceData.getUserSettings === 'function') {
          const settings = await traceData.getUserSettings(userState.userId);
          
          if (settings) {
            userState.settings = settings;
          }
        } 
        // 回退到本地存储
        else {
          const savedSettings = localStorage.getItem(`trace_user_settings_${userState.userId}`);
          
          if (savedSettings) {
            try {
              userState.settings = JSON.parse(savedSettings);
            } catch (e) {
              console.error('解析用户设置失败:', e);
            }
          }
        }
      } else {
        // 加载匿名用户设置
        const anonSettings = localStorage.getItem('trace_anon_settings');
        
        if (anonSettings) {
          try {
            userState.settings = JSON.parse(anonSettings);
          } catch (e) {
            console.error('解析匿名用户设置失败:', e);
          }
        }
      }
      
      // 应用语言设置
      if (userState.settings.language) {
        this.setLanguage(userState.settings.language);
      } else {
        this.setLanguage(config.defaultLanguage);
      }
      
      return userState.settings;
    } catch (error) {
      console.error('加载用户设置失败:', error);
      return {};
    }
  },
  
  /**
   * 保存用户设置
   * @param {Object} settings - 要保存的设置
   * @returns {Promise<boolean>} 是否保存成功
   */
  async saveUserSettings(settings) {
    try {
      // 合并设置
      userState.settings = {
        ...userState.settings,
        ...settings
      };
      
      // 如果用户已认证，保存到服务器
      if (userState.isAuthenticated && userState.userId) {
        if (appState.online && traceData && typeof traceData.saveUserSettings === 'function') {
          await traceData.saveUserSettings(userState.userId, userState.settings);
        }
        
        // 同时保存到本地存储作为备份
        localStorage.setItem(
          `trace_user_settings_${userState.userId}`, 
          JSON.stringify(userState.settings)
        );
      } 
      // 匿名用户，只保存到本地
      else {
        localStorage.setItem(
          'trace_anon_settings', 
          JSON.stringify(userState.settings)
        );
      }
      
      // 触发设置更新事件
      this.triggerEvent('settings_updated', { settings: userState.settings });
      
      return true;
    } catch (error) {
      console.error('保存用户设置失败:', error);
      
      // 记录错误
      appState.errors.push({
        type: 'settings_save_error',
        message: error.message,
        timestamp: Date.now()
      });
      
      return false;
    }
  },
  
  /**
   * 设置系统语言
   * @param {string} language - 语言代码
   */
  setLanguage(language) {
    // 保存到设置
    userState.settings.language = language;
    
    // 设置HTML语言属性
    document.documentElement.lang = language;
    
    // 触发语言更改事件
    this.triggerEvent('language_changed', { language });
  },
  
  /**
   * 登录
   * @param {Object} credentials - 登录凭证
   * @returns {Promise<Object>} 登录结果
   */
  async login(credentials) {
    try {
      // 调用认证API
      if (!traceData || typeof traceData.authenticateUser !== 'function') {
        throw new Error('认证功能不可用');
      }
      
      const authResult = await traceData.authenticateUser(credentials);
      
      if (authResult && authResult.success) {
        // 更新用户状态
        userState.isAuthenticated = true;
        userState.userId = authResult.userId;
        userState.username = authResult.username || credentials.username;
        userState.role = authResult.role;
        userState.permissions = authResult.permissions || [];
        userState.lastActivity = Date.now();
        
        // 加载用户设置
        await this.loadUserSettings();
        
        // 触发登录成功事件
        this.triggerEvent('login_success', { 
          userId: userState.userId,
          username: userState.username,
          role: userState.role
        });
        
        // 同步数据
        if (appState.online) {
          this.syncData();
        }
        
        return {
          success: true,
          userId: userState.userId,
          username: userState.username
        };
      } else {
        throw new Error(authResult.message || '登录失败');
      }
    } catch (error) {
      console.error('登录失败:', error);
      
      // 记录错误
      appState.errors.push({
        type: 'login_error',
        message: error.message,
        timestamp: Date.now()
      });
      
      // 触发登录失败事件
      this.triggerEvent('login_error', { error });
      
      return {
        success: false,
        message: error.message
      };
    }
  },
  
  /**
   * 登出
   * @param {Object} options - 登出选项
   * @returns {Promise<boolean>} 登出是否成功
   */
  async logout(options = {}) {
    try {
      // 先保存用户设置
      if (Object.keys(userState.settings).length > 0) {
        await this.saveUserSettings(userState.settings);
      }
      
      // 如果有待同步的数据，先尝试同步
      if (appState.online && appState.pendingChanges > 0) {
        await this.syncData();
      }
      
      // 调用认证API登出
      if (appState.online && traceData && typeof traceData.logoutUser === 'function') {
        await traceData.logoutUser(userState.userId);
      }
      
      // 保存当前用户ID以便引用
      const prevUserId = userState.userId;
      const prevUsername = userState.username;
      
      // 重置用户状态
      userState = {
        isAuthenticated: false,
        userId: null,
        username: null,
        role: null,
        permissions: [],
        lastActivity: Date.now(),
        settings: {} // 保留一些通用设置如语言
      };
      
      // 触发登出事件
      this.triggerEvent('logout', {
        userId: prevUserId,
        username: prevUsername,
        reason: options.reason || 'user_initiated'
      });
      
      // 重定向到登录页面（如果需要）
      if (options.redirect !== false) {
        window.location.href = options.redirectUrl || '/auth/login.html';
      }
      
      return true;
    } catch (error) {
      console.error('登出过程中发生错误:', error);
      
      // 记录错误
      appState.errors.push({
        type: 'logout_error',
        message: error.message,
        timestamp: Date.now()
      });
      
      return false;
    }
  },
  
  /**
   * 检查用户权限
   * @param {string} permission - 要检查的权限
   * @returns {boolean} 是否有权限
   */
  hasPermission(permission) {
    // 如果未启用认证，直接返回true
    if (!config.authRequired) {
      return true;
    }
    
    // 检查用户是否已认证
    if (!userState.isAuthenticated) {
      return false;
    }
    
    // 管理员角色拥有所有权限
    if (userState.role === 'admin') {
      return true;
    }
    
    // 检查特定权限
    return userState.permissions.includes(permission);
  },
  
  /**
   * 导航到页面
   * @param {string} pageUrl - 页面URL
   * @param {Object} [params] - 导航参数
   */
  navigateTo(pageUrl, params = {}) {
    // 检查页面访问权限
    if (params.requiresAuth && !userState.isAuthenticated) {
      // 保存请求的URL以便登录后重定向
      localStorage.setItem('trace_redirect_after_login', pageUrl);
      
      // 重定向到登录页面
      window.location.href = '/auth/login.html';
      return;
    }
    
    // 检查特定权限
    if (params.requiredPermission && !this.hasPermission(params.requiredPermission)) {
      if (traceUI && traceUI.showToast) {
        traceUI.showToast('您没有访问该页面的权限', 'error', 3000);
      }
      return;
    }
    
    // 记录当前页面
    const prevPage = appState.currentPage;
    appState.currentPage = pageUrl;
    
    // 触发页面导航事件
    this.triggerEvent('navigate', {
      from: prevPage,
      to: pageUrl,
      params
    });
    
    // 执行导航
    if (params.newTab) {
      window.open(pageUrl, '_blank');
    } else {
      window.location.href = pageUrl;
    }
  },
  
  /**
   * 注册组件
   * @param {string} name - 组件名称
   * @param {Object} component - 组件对象
   */
  registerComponent(name, component) {
    if (components[name]) {
      console.warn(`组件 ${name} 已经注册，将被覆盖`);
    }
    
    components[name] = component;
    
    // 触发组件注册事件
    this.triggerEvent('component_registered', { name });
  },
  
  /**
   * 获取组件
   * @param {string} name - 组件名称
   * @returns {Object|null} 组件对象或null
   */
  getComponent(name) {
    return components[name] || null;
  },
  
  /**
   * 触发事件
   * @param {string} eventName - 事件名称
   * @param {Object} data - 事件数据
   */
  triggerEvent(eventName, data = {}) {
    // 创建自定义事件
    const event = new CustomEvent(`trace:${eventName}`, {
      detail: {
        ...data,
        timestamp: Date.now()
      },
      bubbles: true,
      cancelable: true
    });
    
    // 分发事件
    document.dispatchEvent(event);
    
    // 调试模式下记录事件
    if (config.debugMode) {
      console.log(`事件: ${eventName}`, data);
    }
  },
  
  /**
   * 监听事件
   * @param {string} eventName - 事件名称
   * @param {Function} handler - 事件处理函数
   */
  on(eventName, handler) {
    const eventListener = (e) => handler(e.detail);
    document.addEventListener(`trace:${eventName}`, eventListener);
    
    // 返回用于移除监听器的函数
    return () => {
      document.removeEventListener(`trace:${eventName}`, eventListener);
    };
  },
  
  /**
   * 获取系统状态
   * @returns {Object} 系统状态
   */
  getSystemStatus() {
    return {
      app: { ...appState },
      user: {
        isAuthenticated: userState.isAuthenticated,
        userId: userState.userId,
        username: userState.username,
        role: userState.role,
        lastActivity: userState.lastActivity
      },
      modules: { ...moduleStatus },
      config: {
        appName: config.appName,
        version: config.version,
        offlineMode: config.offlineMode,
        dataStorage: config.dataStorage,
        language: userState.settings.language || config.defaultLanguage
      }
    };
  },
  
  /**
   * 获取错误日志
   * @returns {Array} 错误日志
   */
  getErrorLog() {
    return [...appState.errors];
  },
  
  /**
   * 清除错误日志
   */
  clearErrorLog() {
    appState.errors = [];
  },
  
  /**
   * 设置调试模式
   * @param {boolean} enabled - 是否启用调试模式
   */
  setDebugMode(enabled) {
    config.debugMode = enabled;
    
    // 保存到设置
    this.saveUserSettings({ debugMode: enabled });
    
    // 触发调试模式变更事件
    this.triggerEvent('debug_mode_changed', { enabled });
  },
  
  /**
   * 设置离线模式
   * @param {boolean} enabled - 是否启用离线模式
   */
  setOfflineMode(enabled) {
    config.offlineMode = enabled;
    
    // 保存到设置
    this.saveUserSettings({ offlineMode: enabled });
    
    // 触发离线模式变更事件
    this.triggerEvent('offline_mode_changed', { enabled });
    
    // 通知用户
    if (traceUI && traceUI.showToast) {
      if (enabled) {
        traceUI.showToast('已启用离线模式，数据将保存在本地', 'info', 3000);
      } else {
        traceUI.showToast('已禁用离线模式，数据将实时同步', 'info', 3000);
      }
    }
  },
  
  /**
   * 获取系统配置
   * @returns {Object} 系统配置
   */
  getConfig() {
    // 返回配置的副本以防止意外修改
    return { ...config };
  }
};

// 导出模块
window.traceCore = traceCore;

// 如果定义了模块系统，也通过模块系统导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = traceCore;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return traceCore; });
} 