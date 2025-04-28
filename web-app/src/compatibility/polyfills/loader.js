/**
 * @file 垫片加载器
 * @description 负责实际加载垫片并应用于当前环境
 * @version 1.0.0
 */

import PolyfillRegistry from './registry';

/**
 * 垫片加载器类
 * 负责动态加载和应用垫片
 */
class PolyfillLoader {
  /**
   * 创建垫片加载器实例
   * @param {Object} options - 配置选项
   * @param {Boolean} [options.debug=false] - 是否启用调试模式
   * @param {String} [options.basePath=''] - 垫片脚本的基础路径
   * @param {Number} [options.timeout=10000] - 加载超时时间（毫秒）
   * @param {Boolean} [options.autoInit=true] - 是否自动初始化（注册标准垫片）
   * @param {PolyfillRegistry} [options.registry] - 自定义垫片注册表
   */
  constructor(options = {}) {
    this.debug = !!options.debug;
    this.basePath = options.basePath || '';
    this.timeout = options.timeout || 10000;
    this.loadedPolyfills = new Set();
    this.pendingLoads = new Map();
    this.registry = options.registry || new PolyfillRegistry({
      debug: this.debug,
      skipStandardPolyfills: false
    });
    
    this._initPromise = null;
    this._isInitialized = false;
    
    // 性能指标
    this.metrics = {
      totalLoadTime: 0,
      polyfillsLoaded: 0,
      loadStart: 0,
      loadEnd: 0,
      loadErrors: 0
    };
    
    if (options.autoInit !== false) {
      this.init();
    }
  }

  /**
   * 输出调试日志
   * @private
   * @param {String} message - 日志消息
   * @param {...any} args - 额外参数
   */
  _log(message, ...args) {
    if (this.debug) {
      console.log(`[PolyfillLoader] ${message}`, ...args);
    }
  }

  /**
   * 初始化加载器
   * @returns {Promise<void>} - 初始化完成的Promise
   */
  init() {
    if (this._initPromise) {
      return this._initPromise;
    }
    
    this._log('初始化垫片加载器');
    
    this._initPromise = Promise.resolve().then(() => {
      this._isInitialized = true;
      this._log('垫片加载器初始化完成');
    });
    
    return this._initPromise;
  }

  /**
   * 确保加载器已初始化
   * @private
   * @returns {Promise<void>}
   */
  async _ensureInitialized() {
    if (!this._isInitialized) {
      await this.init();
    }
  }

  /**
   * 加载单个垫片
   * @private
   * @param {Object} polyfillDef - 垫片定义对象
   * @returns {Promise<void>} - 加载完成的Promise
   */
  _loadSinglePolyfill(polyfillDef) {
    const name = polyfillDef.name;
    
    // 如果已加载，直接返回成功
    if (this.loadedPolyfills.has(name)) {
      this._log(`垫片 "${name}" 已加载，跳过`);
      return Promise.resolve();
    }
    
    // 如果有挂起的加载，返回该Promise
    if (this.pendingLoads.has(name)) {
      this._log(`垫片 "${name}" 正在加载，等待完成`);
      return this.pendingLoads.get(name);
    }
    
    this._log(`开始加载垫片 "${name}"`);
    
    // 创建新的加载Promise
    const loadPromise = new Promise((resolve, reject) => {
      // 构建完整路径
      let path = polyfillDef.path;
      if (!path.startsWith('http') && !path.startsWith('/') && !path.startsWith('./') && !path.startsWith('../')) {
        path = this.basePath + path;
      }
      
      // 创建脚本元素
      const script = document.createElement('script');
      script.src = path;
      script.async = true;
      
      // 设置超时
      const timeoutId = setTimeout(() => {
        this._log(`垫片 "${name}" 加载超时`);
        cleanup();
        this.metrics.loadErrors++;
        reject(new Error(`加载垫片 "${name}" 超时`));
      }, this.timeout);
      
      // 清理函数
      const cleanup = () => {
        clearTimeout(timeoutId);
        script.onload = null;
        script.onerror = null;
        this.pendingLoads.delete(name);
      };
      
      // 加载成功处理
      script.onload = () => {
        this._log(`垫片 "${name}" 加载成功`);
        cleanup();
        this.loadedPolyfills.add(name);
        this.metrics.polyfillsLoaded++;
        resolve();
      };
      
      // 加载失败处理
      script.onerror = () => {
        this._log(`垫片 "${name}" 加载失败`);
        cleanup();
        this.metrics.loadErrors++;
        reject(new Error(`加载垫片 "${name}" 失败`));
      };
      
      // 添加到文档
      document.head.appendChild(script);
    });
    
    // 存储挂起的加载
    this.pendingLoads.set(name, loadPromise);
    
    return loadPromise;
  }

  /**
   * 按照优先级顺序加载多个垫片
   * @param {Array<Object>} polyfillsToLoad - 要加载的垫片定义列表
   * @returns {Promise<Array<String>>} - 已加载的垫片名称列表
   */
  async _loadPolyfills(polyfillsToLoad) {
    const loadedPolyfills = [];
    
    for (const polyfillDef of polyfillsToLoad) {
      try {
        await this._loadSinglePolyfill(polyfillDef);
        loadedPolyfills.push(polyfillDef.name);
      } catch (error) {
        this._log(`加载垫片 "${polyfillDef.name}" 出错:`, error);
        // 继续加载其他垫片
      }
    }
    
    return loadedPolyfills;
  }

  /**
   * 加载必要的垫片
   * @param {Object} options - 加载选项
   * @param {Array<String>} [options.include=[]] - 强制包含的垫片
   * @param {Array<String>} [options.exclude=[]] - 排除的垫片
   * @returns {Promise<Object>} - 加载结果，包含加载的垫片列表和性能指标
   */
  async loadPolyfills(options = {}) {
    await this._ensureInitialized();
    
    const include = options.include || [];
    const exclude = options.exclude || [];
    
    // 记录开始时间
    this.metrics.loadStart = performance.now();
    
    this._log('开始加载垫片，包含:', include, '排除:', exclude);
    
    // 获取需要加载的垫片列表
    const polyfillsToLoad = this.registry.getRequiredPolyfills(include, exclude);
    
    if (polyfillsToLoad.length === 0) {
      this._log('没有需要加载的垫片');
      this.metrics.loadEnd = performance.now();
      this.metrics.totalLoadTime = this.metrics.loadEnd - this.metrics.loadStart;
      
      return {
        loadedPolyfills: [],
        metrics: { ...this.metrics }
      };
    }
    
    this._log(`需要加载 ${polyfillsToLoad.length} 个垫片:`, polyfillsToLoad.map(p => p.name));
    
    // 加载垫片
    const loadedPolyfills = await this._loadPolyfills(polyfillsToLoad);
    
    // 记录结束时间
    this.metrics.loadEnd = performance.now();
    this.metrics.totalLoadTime = this.metrics.loadEnd - this.metrics.loadStart;
    
    this._log(`垫片加载完成，已加载: ${loadedPolyfills.join(', ')}`);
    this._log('加载性能:', this.metrics);
    
    return {
      loadedPolyfills,
      metrics: { ...this.metrics }
    };
  }

  /**
   * 检查特定垫片是否已加载
   * @param {String} name - 垫片名称
   * @returns {Boolean} - 是否已加载
   */
  isPolyfillLoaded(name) {
    const resolvedName = this.registry._resolveName(name);
    return this.loadedPolyfills.has(resolvedName);
  }

  /**
   * 获取加载性能指标
   * @returns {Object} - 性能指标对象
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * 重置加载器状态
   * @param {Boolean} [keepRegistry=true] - 是否保留注册表
   * @returns {PolyfillLoader} - 链式调用支持
   */
  reset(keepRegistry = true) {
    this._log('重置加载器状态');
    
    this.loadedPolyfills.clear();
    this.pendingLoads.clear();
    
    this.metrics = {
      totalLoadTime: 0,
      polyfillsLoaded: 0,
      loadStart: 0,
      loadEnd: 0,
      loadErrors: 0
    };
    
    this._initPromise = null;
    this._isInitialized = false;
    
    if (!keepRegistry) {
      this._log('重置垫片注册表');
      this.registry = new PolyfillRegistry({
        debug: this.debug,
        skipStandardPolyfills: false
      });
    }
    
    return this;
  }
}

// 导出类
export default PolyfillLoader; 