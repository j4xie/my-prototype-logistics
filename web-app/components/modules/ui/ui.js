const traceToast = require('./toast.js').traceToast;
const showToast = require('./toast.js').showToast;
const showInfo = require('./toast.js').showInfo;
const showSuccess = require('./toast.js').showSuccess;
const showWarning = require('./toast.js').showWarning;
const showError = require('./toast.js').showError;
const showLoading = require('./toast.js').showLoading;
const traceModal = require('./modal.js').traceModal;
const openModal = require('./modal.js').openModal;
const showConfirm = require('./modal.js').showConfirm;
const showAlert = require('./modal.js').showAlert;

/**
 * 食品溯源系统 - UI模块主入口
 * 版本: 1.0.0
 */

// import { traceToast, showToast, showInfo, showSuccess, showWarning, showError, showLoading } from './toast.js';
// import { traceModal, openModal, showConfirm, showAlert } from './modal.js';

// UI组件统一管理
const traceUI = {
  // 组件引用
  toast: traceToast,
  modal: traceModal,
  
  // 内部状态
  _state: {
    initialized: false,
    theme: 'light',      // 主题: light, dark
    lang: 'zh-CN',       // 语言
    breakpoint: 'md',    // 当前断点: xs, sm, md, lg, xl
    prefers: {
      reducedMotion: false, // 是否偏好减弱动画
      colorScheme: 'light'  // 偏好配色方案
    }
  },
  
  /**
   * 初始化UI模块
   * @param {Object} options - 配置选项
   * @returns {Object} - UI模块实例
   */
  init(options = {}) {
    if (this._state.initialized) {
      console.log('UI模块已初始化，跳过重复初始化');
      return this;
    }
    
    // 提取选项
    const {
      theme,
      lang,
      toastOptions,
      modalOptions,
      ...otherOptions
    } = options;
    
    // 初始化主题
    if (theme) {
      this.setTheme(theme);
    } else {
      this._detectPreferences();
    }
    
    // 初始化语言
    if (lang) {
      this._state.lang = lang;
    }
    
    // 初始化子组件
    this.toast.init(toastOptions || {});
    this.modal.init(modalOptions || {});
    
    // 添加响应式支持
    this._setupBreakpointDetection();
    this._setupMediaQueryListeners();
    
    // 标记为已初始化
    this._state.initialized = true;
    
    console.log('UI模块已初始化');
    return this;
  },
  
  /**
   * 设置主题
   * @param {string} theme - 主题名称 ('light', 'dark')
   */
  setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') {
      console.error('不支持的主题:', theme);
      return;
    }
    
    const oldTheme = this._state.theme;
    this._state.theme = theme;
    
    // 移除旧主题
    if (oldTheme && document.body.classList.contains(`theme-${oldTheme}`)) {
      document.body.classList.remove(`theme-${oldTheme}`);
    }
    
    // 添加新主题
    document.body.classList.add(`theme-${theme}`);
    
    // 触发主题变更事件
    window.dispatchEvent(new CustomEvent('themechange', {
      detail: { theme, oldTheme }
    }));
  },
  
  /**
   * 获取当前主题
   * @returns {string} - 当前主题名称
   */
  getTheme() {
    return this._state.theme;
  },
  
  /**
   * 切换主题
   * @returns {string} - 切换后的主题名称
   */
  toggleTheme() {
    const newTheme = this._state.theme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
    return newTheme;
  },
  
  /**
   * 设置语言
   * @param {string} lang - 语言代码
   */
  setLanguage(lang) {
    this._state.lang = lang;
    document.documentElement.lang = lang;
    
    // 触发语言变更事件
    window.dispatchEvent(new CustomEvent('languagechange', {
      detail: { lang }
    }));
  },
  
  /**
   * 获取当前语言
   * @returns {string} - 当前语言代码
   */
  getLanguage() {
    return this._state.lang;
  },
  
  /**
   * 检测用户偏好
   * @private
   */
  _detectPreferences() {
    // 检测颜色方案偏好
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    this._state.prefers.colorScheme = prefersDarkScheme.matches ? 'dark' : 'light';
    
    // 设置对应主题
    this.setTheme(this._state.prefers.colorScheme);
    
    // 检测减弱动画偏好
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._state.prefers.reducedMotion = prefersReducedMotion.matches;
    
    if (this._state.prefers.reducedMotion) {
      document.body.classList.add('reduced-motion');
    }
  },
  
  /**
   * 设置媒体查询监听器
   * @private
   */
  _setupMediaQueryListeners() {
    // 监听颜色方案变化
    const darkSchemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    
    // 使用较新的事件监听API或回退到旧API
    if (darkSchemeMedia.addEventListener) {
      darkSchemeMedia.addEventListener('change', e => {
        this._state.prefers.colorScheme = e.matches ? 'dark' : 'light';
        // 自动跟随系统主题变化
        this.setTheme(this._state.prefers.colorScheme);
      });
    } else if (darkSchemeMedia.addListener) {
      // 旧API (Safari 13及更早版本)
      darkSchemeMedia.addListener(e => {
        this._state.prefers.colorScheme = e.matches ? 'dark' : 'light';
        this.setTheme(this._state.prefers.colorScheme);
      });
    }
    
    // 监听减弱动画偏好变化
    const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    if (reducedMotionMedia.addEventListener) {
      reducedMotionMedia.addEventListener('change', e => {
        this._state.prefers.reducedMotion = e.matches;
        if (e.matches) {
          document.body.classList.add('reduced-motion');
        } else {
          document.body.classList.remove('reduced-motion');
        }
      });
    } else if (reducedMotionMedia.addListener) {
      reducedMotionMedia.addListener(e => {
        this._state.prefers.reducedMotion = e.matches;
        if (e.matches) {
          document.body.classList.add('reduced-motion');
        } else {
          document.body.classList.remove('reduced-motion');
        }
      });
    }
  },
  
  /**
   * 设置断点检测
   * @private
   */
  _setupBreakpointDetection() {
    const breakpoints = {
      xs: '(max-width: 575px)',
      sm: '(min-width: 576px) and (max-width: 767px)',
      md: '(min-width: 768px) and (max-width: 991px)',
      lg: '(min-width: 992px) and (max-width: 1199px)',
      xl: '(min-width: 1200px)'
    };
    
    // 初始检测当前断点
    for (const [name, query] of Object.entries(breakpoints)) {
      if (window.matchMedia(query).matches) {
        this._state.breakpoint = name;
        break;
      }
    }
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
      for (const [name, query] of Object.entries(breakpoints)) {
        if (window.matchMedia(query).matches) {
          if (this._state.breakpoint !== name) {
            const oldBreakpoint = this._state.breakpoint;
            this._state.breakpoint = name;
            
            // 触发断点变化事件
            window.dispatchEvent(new CustomEvent('breakpointchange', {
              detail: { breakpoint: name, oldBreakpoint }
            }));
          }
          break;
        }
      }
    });
  },
  
  /**
   * 获取当前断点
   * @returns {string} - 当前断点名称
   */
  getBreakpoint() {
    return this._state.breakpoint;
  },
  
  /**
   * 检查当前断点是否为移动设备
   * @returns {boolean} - 是否为移动设备断点
   */
  isMobile() {
    return ['xs', 'sm'].includes(this._state.breakpoint);
  },
  
  /**
   * 创建基本UI元素
   * @param {string} type - 元素类型
   * @param {Object} props - 元素属性
   * @returns {HTMLElement} - 创建的HTML元素
   */
  createElement(type, props = {}) {
    const element = document.createElement(type);
    
    // 设置属性
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'style' && typeof value === 'object') {
        // 设置样式
        Object.entries(value).forEach(([styleKey, styleValue]) => {
          element.style[styleKey] = styleValue;
        });
      } else if (key === 'classList' && Array.isArray(value)) {
        // 添加类名
        value.forEach(className => {
          element.classList.add(className);
        });
      } else if (key === 'dataset' && typeof value === 'object') {
        // 设置数据属性
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
      } else if (key === 'children' && Array.isArray(value)) {
        // 添加子元素
        value.forEach(child => {
          if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
          } else if (child instanceof HTMLElement) {
            element.appendChild(child);
          }
        });
      } else if (key === 'events' && typeof value === 'object') {
        // 添加事件监听
        Object.entries(value).forEach(([eventName, handler]) => {
          element.addEventListener(eventName, handler);
        });
      } else if (key === 'html') {
        // 设置innerHTML
        element.innerHTML = value;
      } else if (key === 'text') {
        // 设置textContent
        element.textContent = value;
      } else {
        // 其他属性
        element.setAttribute(key, value);
      }
    });
    
    return element;
  },
  
  /**
   * 显示加载中动画
   * @param {string} container - 容器选择器或容器元素
   * @param {Object} options - 配置选项
   * @returns {Object} - 加载器控制对象
   */
  showLoading(container, options = {}) {
    const loadingOptions = {
      size: 'medium',  // small, medium, large
      text: '加载中...',
      overlay: true,
      spinnerColor: '',
      textColor: '',
      ...options
    };
    
    // 查找容器
    let containerEl = container;
    if (typeof container === 'string') {
      containerEl = document.querySelector(container);
    }
    
    if (!containerEl) {
      console.error('找不到加载容器:', container);
      return { hide: () => {} };
    }
    
    // 设置容器相对定位
    const originalPosition = containerEl.style.position;
    if (originalPosition !== 'absolute' && originalPosition !== 'fixed' && originalPosition !== 'relative') {
      containerEl.style.position = 'relative';
    }
    
    // 创建加载遮罩
    const loadingEl = document.createElement('div');
    loadingEl.className = 'trace-loading';
    
    // 设置尺寸类
    if (['small', 'medium', 'large'].includes(loadingOptions.size)) {
      loadingEl.classList.add(`trace-loading-${loadingOptions.size}`);
    }
    
    // 设置样式
    Object.assign(loadingEl.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '100'
    });
    
    if (loadingOptions.overlay) {
      loadingEl.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    }
    
    // 创建加载图标
    const spinner = document.createElement('div');
    spinner.className = 'trace-loading-spinner';
    
    // 设置图标样式
    Object.assign(spinner.style, {
      border: '3px solid #f3f3f3',
      borderTop: `3px solid ${loadingOptions.spinnerColor || '#2196F3'}`,
      borderRadius: '50%',
      width: loadingOptions.size === 'small' ? '20px' : (loadingOptions.size === 'large' ? '40px' : '30px'),
      height: loadingOptions.size === 'small' ? '20px' : (loadingOptions.size === 'large' ? '40px' : '30px'),
      animation: 'trace-spin 1s linear infinite'
    });
    
    // 创建加载文本
    const text = document.createElement('div');
    text.className = 'trace-loading-text';
    text.textContent = loadingOptions.text;
    
    // 设置文本样式
    Object.assign(text.style, {
      marginTop: '10px',
      color: loadingOptions.textColor || '#666'
    });
    
    // 添加动画样式
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @keyframes trace-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    
    // 组装加载元素
    loadingEl.appendChild(spinner);
    if (loadingOptions.text) {
      loadingEl.appendChild(text);
    }
    
    // 添加到容器
    document.head.appendChild(styleEl);
    containerEl.appendChild(loadingEl);
    
    // 返回控制对象
    return {
      hide: () => {
        if (containerEl.contains(loadingEl)) {
          containerEl.removeChild(loadingEl);
        }
        document.head.removeChild(styleEl);
        containerEl.style.position = originalPosition;
      },
      setText: (newText) => {
        text.textContent = newText;
      },
      getElement: () => loadingEl
    };
  }
};

// 导出Toast便捷方法
// export { showToast, showInfo, showSuccess, showWarning, showError, showLoading };

// 导出Modal便捷方法
// export { openModal, showConfirm, showAlert };

// 为了向后兼容，导出到全局对象
if (typeof window !== 'undefined') {
  window.traceUI = traceUI;
} 
// CommonJS导出
module.exports.showToast = showToast;
module.exports.showInfo = showInfo;
module.exports.showSuccess = showSuccess;
module.exports.showWarning = showWarning;
module.exports.showError = showError;
module.exports.showLoading = showLoading;
module.exports.openModal = openModal;
module.exports.showConfirm = showConfirm;
module.exports.showAlert = showAlert;
module.exports.traceUI = traceUI;
