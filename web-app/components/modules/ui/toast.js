/**
 * 食品溯源系统 - Toast通知组件
 * 版本: 1.0.0
 */

// Toast通知组件
const traceToast = {
  // 配置选项
  config: {
    defaultDuration: 3000, // 默认显示时间(毫秒)
    maxVisible: 5,         // 最大可见Toast数量
    position: 'top-right', // 默认位置 (top-right, top-center, top-left, bottom-right, bottom-center, bottom-left)
    containerClass: 'trace-toast-container',
    toastClass: 'trace-toast',
    animations: true,      // 是否启用动画
    pauseOnHover: true,    // 鼠标悬停时暂停倒计时
    showCloseButton: true  // 是否显示关闭按钮
  },
  
  // 内部状态
  _state: {
    container: null,
    toasts: [],
    stylesAdded: false,
    uniqueId: 1
  },
  
  /**
   * 初始化Toast组件
   * @param {Object} options - 可选配置参数
   * @returns {Object} - Toast组件实例
   */
  init(options = {}) {
    // 合并配置
    this.config = { ...this.config, ...options };
    
    // 初始化Toast容器
    this._initToastContainer();
    
    // 添加样式
    if (!this._state.stylesAdded) {
      this._addToastStyles();
      this._state.stylesAdded = true;
    }
    
    console.log('Toast组件已初始化');
    return this;
  },
  
  /**
   * 初始化Toast容器
   * @private
   */
  _initToastContainer() {
    // 检查是否已存在容器
    let container = document.querySelector(`.${this.config.containerClass}`);
    
    if (!container) {
      container = document.createElement('div');
      container.className = this.config.containerClass;
      // 设置容器样式和位置
      this._setContainerPosition(container, this.config.position);
      document.body.appendChild(container);
    }
    
    this._state.container = container;
  },
  
  /**
   * 设置Toast容器位置
   * @param {HTMLElement} container - Toast容器元素
   * @param {string} position - 位置
   * @private
   */
  _setContainerPosition(container, position) {
    container.style.position = 'fixed';
    container.style.zIndex = '9999';
    container.style.maxWidth = '100%';
    
    // 基于位置设置样式
    switch (position) {
      case 'top-left':
        container.style.top = '20px';
        container.style.left = '20px';
        break;
      case 'top-center':
        container.style.top = '20px';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
        break;
      case 'top-right':
        container.style.top = '20px';
        container.style.right = '20px';
        break;
      case 'bottom-left':
        container.style.bottom = '20px';
        container.style.left = '20px';
        break;
      case 'bottom-center':
        container.style.bottom = '20px';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
        break;
      case 'bottom-right':
        container.style.bottom = '20px';
        container.style.right = '20px';
        break;
      default:
        // 默认右上角
        container.style.top = '20px';
        container.style.right = '20px';
    }
  },
  
  /**
   * 添加Toast样式
   * @private
   */
  _addToastStyles() {
    // 创建样式元素
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .${this.config.containerClass} {
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 350px;
      }
      
      .${this.config.toastClass} {
        padding: 12px 16px;
        border-radius: 4px;
        background-color: #fff;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
        color: #333;
        font-size: 14px;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        min-width: 250px;
        max-width: 350px;
        transition: all 0.3s ease;
        overflow: hidden;
      }
      
      .${this.config.toastClass}-icon {
        margin-right: 10px;
        flex-shrink: 0;
      }
      
      .${this.config.toastClass}-content {
        flex: 1;
        overflow-wrap: break-word;
        word-break: break-word;
      }
      
      .${this.config.toastClass}-close {
        margin-left: 10px;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        color: #999;
        flex-shrink: 0;
        opacity: 0.7;
        transition: opacity 0.2s;
      }
      
      .${this.config.toastClass}-close:hover {
        opacity: 1;
      }
      
      .${this.config.toastClass}-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background-color: rgba(0, 0, 0, 0.1);
        width: 100%;
      }
      
      .${this.config.toastClass}.enter {
        transform: translateX(100%);
        opacity: 0;
      }
      
      .${this.config.toastClass}.enter-active {
        transform: translateX(0);
        opacity: 1;
      }
      
      .${this.config.toastClass}.exit {
        transform: translateX(0);
        opacity: 1;
      }
      
      .${this.config.toastClass}.exit-active {
        transform: translateX(100%);
        opacity: 0;
      }
      
      /* 类型样式 */
      .${this.config.toastClass}-info {
        border-left: 4px solid #2196F3;
      }
      
      .${this.config.toastClass}-success {
        border-left: 4px solid #4CAF50;
      }
      
      .${this.config.toastClass}-warning {
        border-left: 4px solid #FF9800;
      }
      
      .${this.config.toastClass}-error {
        border-left: 4px solid #F44336;
      }
      
      .${this.config.toastClass}-loading {
        border-left: 4px solid #9C27B0;
      }
      
      /* 图标样式 */
      .${this.config.toastClass}-icon svg {
        width: 20px;
        height: 20px;
      }
      
      /* 加载动画 */
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      .${this.config.toastClass}-loading .${this.config.toastClass}-icon svg {
        animation: spin 1s linear infinite;
      }
    `;
    
    document.head.appendChild(styleEl);
  },
  
  /**
   * 显示Toast通知
   * @param {string} message - 通知消息
   * @param {string} type - 通知类型 ('info', 'success', 'warning', 'error', 'loading')
   * @param {number} duration - 显示时间(毫秒)，0表示不自动关闭
   * @returns {Object} - Toast实例，包含close方法
   */
  show(message, type = 'info', duration) {
    // 如果容器不存在，初始化
    if (!this._state.container) {
      this.init();
    }
    
    // 确定显示时间
    const actualDuration = duration !== undefined ? duration : this.config.defaultDuration;
    
    // 创建唯一ID
    const id = `toast-${this._state.uniqueId++}`;
    
    // 创建Toast元素
    const toastEl = document.createElement('div');
    toastEl.id = id;
    toastEl.className = `${this.config.toastClass} ${this.config.toastClass}-${type}`;
    toastEl.style.position = 'relative';
    
    // 添加图标
    const iconEl = document.createElement('div');
    iconEl.className = `${this.config.toastClass}-icon`;
    iconEl.innerHTML = this._getIconSvg(type);
    
    // 添加内容
    const contentEl = document.createElement('div');
    contentEl.className = `${this.config.toastClass}-content`;
    contentEl.textContent = message;
    
    // 添加关闭按钮
    let closeEl = null;
    if (this.config.showCloseButton) {
      closeEl = document.createElement('div');
      closeEl.className = `${this.config.toastClass}-close`;
      closeEl.innerHTML = '&times;';
      closeEl.addEventListener('click', () => this.close(id));
    }
    
    // 组装Toast
    toastEl.appendChild(iconEl);
    toastEl.appendChild(contentEl);
    if (closeEl) {
      toastEl.appendChild(closeEl);
    }
    
    // 如果启用动画，添加动画类
    if (this.config.animations) {
      toastEl.classList.add('enter');
      
      // 延迟一帧添加enter-active类，触发过渡
      setTimeout(() => {
        toastEl.classList.add('enter-active');
      }, 16);
      
      // 移除过渡类
      setTimeout(() => {
        toastEl.classList.remove('enter');
        toastEl.classList.remove('enter-active');
      }, 300);
    }
    
    // 添加进度条
    if (actualDuration > 0) {
      const progressEl = document.createElement('div');
      progressEl.className = `${this.config.toastClass}-progress`;
      toastEl.appendChild(progressEl);
      
      let remaining = 100;
      const interval = Math.max(10, Math.min(50, actualDuration / 100));
      const step = 100 / (actualDuration / interval);
      
      const timer = setInterval(() => {
        if (remaining <= 0) {
          clearInterval(timer);
          return;
        }
        
        remaining -= step;
        progressEl.style.width = `${Math.max(0, remaining)}%`;
      }, interval);
      
      // 保存定时器ID
      toastEl.dataset.timerId = timer;
    }
    
    // 管理最大可见数量
    while (this._state.toasts.length >= this.config.maxVisible) {
      const oldestId = this._state.toasts.shift();
      this.close(oldestId);
    }
    
    // 添加到容器
    this._state.container.appendChild(toastEl);
    this._state.toasts.push(id);
    
    // 设置自动关闭
    if (actualDuration > 0) {
      setTimeout(() => this.close(id), actualDuration);
    }
    
    // 鼠标悬停暂停
    if (this.config.pauseOnHover && actualDuration > 0) {
      let timerId = parseInt(toastEl.dataset.timerId);
      
      toastEl.addEventListener('mouseenter', () => {
        if (timerId) {
          clearInterval(timerId);
          toastEl.dataset.timerId = '';
        }
      });
      
      toastEl.addEventListener('mouseleave', () => {
        if (actualDuration > 0 && !timerId) {
          // 重新启动进度条
          const progressEl = toastEl.querySelector(`.${this.config.toastClass}-progress`);
          if (progressEl) {
            const remaining = parseFloat(progressEl.style.width || '100');
            const interval = Math.max(10, Math.min(50, actualDuration / 100));
            const step = 100 / (actualDuration / interval);
            
            timerId = setInterval(() => {
              if (remaining <= 0) {
                clearInterval(timerId);
                return;
              }
              
              remaining -= step;
              progressEl.style.width = `${Math.max(0, remaining)}%`;
            }, interval);
            
            toastEl.dataset.timerId = timerId;
          }
        }
      });
    }
    
    // 返回Toast控制对象
    return {
      id,
      close: () => this.close(id),
      update: (newMessage, newType) => this.update(id, newMessage, newType)
    };
  },
  
  /**
   * 更新已有的Toast内容
   * @param {string} id - Toast ID
   * @param {string} message - 新消息内容
   * @param {string} type - 新的类型 (可选)
   * @returns {boolean} - 是否成功更新
   */
  update(id, message, type) {
    const toastEl = document.getElementById(id);
    if (!toastEl) return false;
    
    // 更新消息内容
    const contentEl = toastEl.querySelector(`.${this.config.toastClass}-content`);
    if (contentEl) {
      contentEl.textContent = message;
    }
    
    // 如果提供了新类型，更新类型
    if (type) {
      // 移除当前类型类
      ['info', 'success', 'warning', 'error', 'loading'].forEach(t => {
        toastEl.classList.remove(`${this.config.toastClass}-${t}`);
      });
      
      // 添加新类型类
      toastEl.classList.add(`${this.config.toastClass}-${type}`);
      
      // 更新图标
      const iconEl = toastEl.querySelector(`.${this.config.toastClass}-icon`);
      if (iconEl) {
        iconEl.innerHTML = this._getIconSvg(type);
      }
    }
    
    return true;
  },
  
  /**
   * 关闭指定的Toast
   * @param {string} id - Toast ID
   */
  close(id) {
    const toastEl = document.getElementById(id);
    if (!toastEl) return;
    
    // 清除定时器
    if (toastEl.dataset.timerId) {
      clearInterval(parseInt(toastEl.dataset.timerId));
    }
    
    // 从跟踪数组中移除
    const index = this._state.toasts.indexOf(id);
    if (index !== -1) {
      this._state.toasts.splice(index, 1);
    }
    
    // 如果启用动画，添加退出动画类
    if (this.config.animations) {
      toastEl.classList.add('exit');
      
      setTimeout(() => {
        toastEl.classList.add('exit-active');
      }, 16);
      
      // 动画结束后移除元素
      setTimeout(() => {
        if (toastEl.parentNode) {
          toastEl.parentNode.removeChild(toastEl);
        }
      }, 300);
    } else {
      // 直接移除元素
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
    }
  },
  
  /**
   * 关闭所有Toast
   */
  closeAll() {
    // 复制数组，因为在循环中将修改原数组
    const toastIds = [...this._state.toasts];
    toastIds.forEach(id => this.close(id));
  },
  
  /**
   * 根据类型获取SVG图标
   * @param {string} type - 通知类型
   * @returns {string} - SVG图标代码
   * @private
   */
  _getIconSvg(type) {
    switch (type) {
      case 'info':
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#2196F3"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
      case 'success':
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#4CAF50"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
      case 'warning':
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FF9800"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>';
      case 'error':
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F44336"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
      case 'loading':
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#9C27B0"><path d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.41 3.59-8 8-8zm0 16c-4.41 0-8-3.59-8-8H2c0 5.52 4.48 10 10 10v-2zm0-14c-3.31 0-6 2.69-6 6h2c0-2.21 1.79-4 4-4V6z"/></svg>';
      default:
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#2196F3"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
    }
  }
};

// 便捷方法
const showToast = (message, type = 'info', duration) => traceToast.show(message, type, duration);
const showInfo = (message, duration) => traceToast.show(message, 'info', duration);
const showSuccess = (message, duration) => traceToast.show(message, 'success', duration);
const showWarning = (message, duration) => traceToast.show(message, 'warning', duration);
const showError = (message, duration) => traceToast.show(message, 'error', duration);
const showLoading = (message = '加载中...', duration = 0) => traceToast.show(message, 'loading', duration);

// 为了向后兼容，导出到全局对象
if (typeof window !== 'undefined') {
  window.traceToast = traceToast;
  window.showToast = showToast;
  window.showInfo = showInfo;
  window.showSuccess = showSuccess;
  window.showWarning = showWarning;
  window.showError = showError;
  window.showLoading = showLoading;
} 
// CommonJS导出
module.exports.traceToast = traceToast;
module.exports.showToast = showToast;
module.exports.showInfo = showInfo;
module.exports.showSuccess = showSuccess;
module.exports.showWarning = showWarning;
module.exports.showError = showError;
module.exports.showLoading = showLoading;
