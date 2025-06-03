/**
 * 食品溯源系统 - 用户体验(UX)优化组件
 * 提供智能提示、表单优化、加载状态、动画效果等功能
 */

class TraceUX {
  constructor() {
    this.tooltips = new Map();
    this.loadingStates = new Map();
    this.formStates = new Map();
    this.animations = new Map();
    this.notifications = [];
    this.config = {
      animationDuration: 300,
      tooltipDelay: 200,
      notificationDuration: 5000,
      debounceDelay: 300,
      throttleDelay: 100
    };
  }

  /**
   * 初始化用户体验功能
   */
  init() {
    this.setupTooltips();
    this.setupFormOptimizations();
    this.setupLoadingStates();
    this.setupAnimations();
    this.setupNotifications();
    this.setupSmartSuggestions();
    this.setupGestureSupport();
    
    console.log('用户体验组件已初始化');
  }

  /**
   * 设置智能提示
   */
  setupTooltips() {
    // 为所有带有data-tooltip属性的元素添加提示
    document.querySelectorAll('[data-tooltip]').forEach(element => {
      const tooltip = this.createTooltip(element);
      this.tooltips.set(element, tooltip);
      
      // 添加事件监听
      element.addEventListener('mouseenter', () => this.showTooltip(element));
      element.addEventListener('mouseleave', () => this.hideTooltip(element));
      element.addEventListener('focus', () => this.showTooltip(element));
      element.addEventListener('blur', () => this.hideTooltip(element));
    });
  }

  /**
   * 创建提示元素
   * @param {HTMLElement} element - 目标元素
   * @returns {HTMLElement} 提示元素
   */
  createTooltip(element) {
    const tooltip = document.createElement('div');
    tooltip.className = 'trace-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.textContent = element.getAttribute('data-tooltip');
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .trace-tooltip {
        position: absolute;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 14px;
        z-index: 1000;
        pointer-events: none;
        opacity: 0;
        transition: opacity ${this.config.tooltipDelay}ms;
      }
      .trace-tooltip.show {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(tooltip);
    return tooltip;
  }

  /**
   * 显示提示
   * @param {HTMLElement} element - 目标元素
   */
  showTooltip(element) {
    const tooltip = this.tooltips.get(element);
    if (!tooltip) return;
    
    const rect = element.getBoundingClientRect();
    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
    tooltip.style.left = `${rect.left + (rect.width - tooltip.offsetWidth) / 2}px`;
    tooltip.classList.add('show');
  }

  /**
   * 隐藏提示
   * @param {HTMLElement} element - 目标元素
   */
  hideTooltip(element) {
    const tooltip = this.tooltips.get(element);
    if (!tooltip) return;
    
    tooltip.classList.remove('show');
  }

  /**
   * 设置表单优化
   */
  setupFormOptimizations() {
    // 为所有表单添加优化
    document.querySelectorAll('form').forEach(form => {
      this.formStates.set(form, {
        isSubmitting: false,
        lastSubmitTime: 0,
        validationErrors: new Set()
      });
      
      // 添加实时验证
      form.querySelectorAll('input, select, textarea').forEach(field => {
        field.addEventListener('input', this.debounce(() => {
          this.validateField(field);
        }, this.config.debounceDelay));
      });
      
      // 优化提交处理
      form.addEventListener('submit', this.throttle((e) => {
        e.preventDefault();
        this.handleFormSubmit(form);
      }, this.config.throttleDelay));
    });
  }

  /**
   * 验证表单字段
   * @param {HTMLElement} field - 表单字段
   */
  validateField(field) {
    const form = field.closest('form');
    const state = this.formStates.get(form);
    
    // 清除之前的错误
    field.classList.remove('error');
    const errorElement = field.parentElement.querySelector('.error-message');
    if (errorElement) {
      errorElement.remove();
    }
    
    // 执行验证
    if (field.required && !field.value) {
      this.showFieldError(field, '此字段为必填项');
      state.validationErrors.add(field);
    } else if (field.type === 'email' && !this.isValidEmail(field.value)) {
      this.showFieldError(field, '请输入有效的邮箱地址');
      state.validationErrors.add(field);
    } else if (field.type === 'number' && field.min && field.value < field.min) {
      this.showFieldError(field, `数值不能小于 ${field.min}`);
      state.validationErrors.add(field);
    } else if (field.type === 'number' && field.max && field.value > field.max) {
      this.showFieldError(field, `数值不能大于 ${field.max}`);
      state.validationErrors.add(field);
    } else {
      state.validationErrors.delete(field);
    }
  }

  /**
   * 显示字段错误
   * @param {HTMLElement} field - 表单字段
   * @param {string} message - 错误消息
   */
  showFieldError(field, message) {
    field.classList.add('error');
    
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    field.parentElement.appendChild(errorElement);
    
    // 添加动画效果
    this.animateElement(errorElement, 'fadeIn');
  }

  /**
   * 处理表单提交
   * @param {HTMLFormElement} form - 表单元素
   */
  async handleFormSubmit(form) {
    const state = this.formStates.get(form);
    if (state.isSubmitting) return;
    
    // 验证所有字段
    form.querySelectorAll('input, select, textarea').forEach(field => {
      this.validateField(field);
    });
    
    if (state.validationErrors.size > 0) {
      this.showNotification('请修正表单中的错误', 'error');
      return;
    }
    
    state.isSubmitting = true;
    this.showLoadingState(form);
    
    try {
      // 模拟表单提交
      await this.simulateFormSubmission(form);
      this.showNotification('表单提交成功', 'success');
      form.reset();
    } catch (error) {
      this.showNotification('提交失败，请重试', 'error');
    } finally {
      state.isSubmitting = false;
      this.hideLoadingState(form);
    }
  }

  /**
   * 设置加载状态
   */
  setupLoadingStates() {
    // 为所有按钮添加加载状态
    document.querySelectorAll('button[type="submit"]').forEach(button => {
      button.addEventListener('click', () => {
        this.showLoadingState(button);
      });
    });
  }

  /**
   * 显示加载状态
   * @param {HTMLElement} element - 目标元素
   */
  showLoadingState(element) {
    const originalContent = element.innerHTML;
    this.loadingStates.set(element, originalContent);
    
    element.innerHTML = `
      <span class="loading-spinner"></span>
      <span>处理中...</span>
    `;
    element.disabled = true;
    
    // 添加加载动画样式
    const style = document.createElement('style');
    style.textContent = `
      .loading-spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 2px solid #f3f3f3;
        border-top: 2px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: 8px;
        vertical-align: middle;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 隐藏加载状态
   * @param {HTMLElement} element - 目标元素
   */
  hideLoadingState(element) {
    const originalContent = this.loadingStates.get(element);
    if (originalContent) {
      element.innerHTML = originalContent;
      element.disabled = false;
    }
  }

  /**
   * 设置动画效果
   */
  setupAnimations() {
    // 为页面元素添加动画
    document.querySelectorAll('.animate-on-scroll').forEach(element => {
      this.animations.set(element, {
        isVisible: false,
        animation: element.getAttribute('data-animation') || 'fadeIn'
      });
      
      // 监听滚动事件
      window.addEventListener('scroll', this.throttle(() => {
        this.checkElementVisibility(element);
      }, 100));
    });
  }

  /**
   * 检查元素可见性
   * @param {HTMLElement} element - 目标元素
   */
  checkElementVisibility(element) {
    const rect = element.getBoundingClientRect();
    const isVisible = (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
    
    const animation = this.animations.get(element);
    if (isVisible && !animation.isVisible) {
      this.animateElement(element, animation.animation);
      animation.isVisible = true;
    }
  }

  /**
   * 为元素添加动画
   * @param {HTMLElement} element - 目标元素
   * @param {string} animation - 动画类型
   */
  animateElement(element, animation) {
    const animations = {
      fadeIn: {
        from: { opacity: 0 },
        to: { opacity: 1 }
      },
      slideUp: {
        from: { transform: 'translateY(20px)', opacity: 0 },
        to: { transform: 'translateY(0)', opacity: 1 }
      },
      slideDown: {
        from: { transform: 'translateY(-20px)', opacity: 0 },
        to: { transform: 'translateY(0)', opacity: 1 }
      },
      scale: {
        from: { transform: 'scale(0.9)', opacity: 0 },
        to: { transform: 'scale(1)', opacity: 1 }
      }
    };
    
    const keyframes = animations[animation];
    if (!keyframes) return;
    
    element.animate([keyframes.from, keyframes.to], {
      duration: this.config.animationDuration,
      easing: 'ease-out'
    });
  }

  /**
   * 设置通知系统
   */
  setupNotifications() {
    // 创建通知容器
    const container = document.createElement('div');
    container.className = 'trace-notifications';
    document.body.appendChild(container);
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .trace-notifications {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
      }
      .trace-notification {
        background: white;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        padding: 12px 20px;
        margin-bottom: 10px;
        min-width: 300px;
        display: flex;
        align-items: center;
        animation: slideIn 0.3s ease-out;
      }
      .trace-notification.success {
        border-left: 4px solid #4CAF50;
      }
      .trace-notification.error {
        border-left: 4px solid #f44336;
      }
      .trace-notification.warning {
        border-left: 4px solid #ff9800;
      }
      @keyframes slideIn {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 显示通知
   * @param {string} message - 通知消息
   * @param {string} type - 通知类型
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `trace-notification ${type}`;
    notification.textContent = message;
    
    const container = document.querySelector('.trace-notifications');
    container.appendChild(notification);
    
    // 自动移除
    setTimeout(() => {
      notification.remove();
    }, this.config.notificationDuration);
  }

  /**
   * 设置智能建议
   */
  setupSmartSuggestions() {
    // 为输入字段添加智能建议
    document.querySelectorAll('input[data-suggestions]').forEach(input => {
      const suggestions = JSON.parse(input.getAttribute('data-suggestions'));
      
      input.addEventListener('input', this.debounce(() => {
        this.showSuggestions(input, suggestions);
      }, this.config.debounceDelay));
    });
  }

  /**
   * 显示智能建议
   * @param {HTMLInputElement} input - 输入字段
   * @param {Array} suggestions - 建议列表
   */
  showSuggestions(input, suggestions) {
    // 移除现有的建议列表
    const existingList = input.parentElement.querySelector('.suggestions-list');
    if (existingList) {
      existingList.remove();
    }
    
    if (!input.value) return;
    
    // 过滤建议
    const filtered = suggestions.filter(s => 
      s.toLowerCase().includes(input.value.toLowerCase())
    );
    
    if (filtered.length === 0) return;
    
    // 创建建议列表
    const list = document.createElement('ul');
    list.className = 'suggestions-list';
    
    filtered.forEach(suggestion => {
      const item = document.createElement('li');
      item.textContent = suggestion;
      item.addEventListener('click', () => {
        input.value = suggestion;
        list.remove();
      });
      list.appendChild(item);
    });
    
    input.parentElement.appendChild(list);
  }

  /**
   * 设置手势支持
   */
  setupGestureSupport() {
    // 为移动设备添加手势支持
    if ('ontouchstart' in window) {
      document.querySelectorAll('.swipeable').forEach(element => {
        let startX = 0;
        let startY = 0;
        
        element.addEventListener('touchstart', (e) => {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
        });
        
        element.addEventListener('touchend', (e) => {
          const endX = e.changedTouches[0].clientX;
          const endY = e.changedTouches[0].clientY;
          
          const deltaX = endX - startX;
          const deltaY = endY - startY;
          
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > 50) {
              this.handleSwipe(element, 'right');
            } else if (deltaX < -50) {
              this.handleSwipe(element, 'left');
            }
          } else if (Math.abs(deltaY) > 50) {
            if (deltaY > 0) {
              this.handleSwipe(element, 'down');
            } else {
              this.handleSwipe(element, 'up');
            }
          }
        });
      });
    }
  }

  /**
   * 处理滑动手势
   * @param {HTMLElement} element - 目标元素
   * @param {string} direction - 滑动方向
   */
  handleSwipe(element, direction) {
    const handlers = {
      left: () => {
        // 处理向左滑动
        if (element.classList.contains('modal')) {
          element.style.display = 'none';
        }
      },
      right: () => {
        // 处理向右滑动
        if (element.classList.contains('modal')) {
          element.style.display = 'none';
        }
      },
      up: () => {
        // 处理向上滑动
        if (element.classList.contains('dropdown')) {
          element.classList.remove('show');
        }
      },
      down: () => {
        // 处理向下滑动
        if (element.classList.contains('dropdown')) {
          element.classList.add('show');
        }
      }
    };
    
    if (handlers[direction]) {
      handlers[direction]();
    }
  }

  /**
   * 防抖函数
   * @param {Function} func - 要执行的函数
   * @param {number} delay - 延迟时间
   * @returns {Function} 防抖后的函数
   */
  debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * 节流函数
   * @param {Function} func - 要执行的函数
   * @param {number} delay - 延迟时间
   * @returns {Function} 节流后的函数
   */
  throttle(func, delay) {
    let lastCall = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastCall >= delay) {
        func.apply(this, args);
        lastCall = now;
      }
    };
  }

  /**
   * 验证邮箱地址
   * @param {string} email - 邮箱地址
   * @returns {boolean} 是否有效
   */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * 模拟表单提交
   * @param {HTMLFormElement} form - 表单元素
   * @returns {Promise} 提交结果
   */
  simulateFormSubmission(form) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90%的成功率
          resolve();
        } else {
          reject(new Error('模拟提交失败'));
        }
      }, 1000);
    });
  }
}

// 初始化并导出
const traceUX = new TraceUX();

// 在文档加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  traceUX.init();
});

// 导出组件
export default traceUX; 