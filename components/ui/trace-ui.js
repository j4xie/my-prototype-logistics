/**
 * 食品溯源系统 - UI组件模块
 * 版本: 1.0.0
 */

const traceUI = {
  /**
   * 初始化UI组件
   */
  init() {
    this.initToastContainer();
    console.log('UI组件已初始化');
  },

  /**
   * 初始化toast容器
   */
  initToastContainer() {
    // 检查是否已存在toast容器
    if (document.getElementById('trace-toast-container')) {
      return;
    }

    // 创建toast容器
    const toastContainer = document.createElement('div');
    toastContainer.id = 'trace-toast-container';
    toastContainer.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center space-y-2';
    document.body.appendChild(toastContainer);

    // 添加样式
    if (!document.getElementById('trace-ui-styles')) {
      const style = document.createElement('style');
      style.id = 'trace-ui-styles';
      style.textContent = `
        #trace-toast-container {
          pointer-events: none;
        }
        .trace-toast {
          pointer-events: auto;
          min-width: 250px;
          max-width: 90vw;
          border-radius: 4px;
          padding: 12px 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          margin-bottom: 8px;
          transform: translateY(100px);
          opacity: 0;
          transition: transform 0.3s ease, opacity 0.3s ease;
          display: flex;
          align-items: center;
          font-size: 14px;
        }
        .trace-toast.show {
          transform: translateY(0);
          opacity: 1;
        }
        .trace-toast-icon {
          margin-right: 10px;
          font-size: 16px;
        }
        .trace-toast-info {
          background-color: #e6f7ff;
          border-left: 4px solid #1890ff;
          color: #0c5bb4;
        }
        .trace-toast-success {
          background-color: #f6ffed;
          border-left: 4px solid #52c41a;
          color: #389e0d;
        }
        .trace-toast-warning {
          background-color: #fffbe6;
          border-left: 4px solid #faad14;
          color: #d48806;
        }
        .trace-toast-error {
          background-color: #fff2f0;
          border-left: 4px solid #ff4d4f;
          color: #cf1322;
        }
        .trace-toast-loading {
          background-color: #e6f7ff;
          border-left: 4px solid #1890ff;
          color: #0c5bb4;
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .trace-rotate {
          animation: rotate 1.5s linear infinite;
        }
      `;
      document.head.appendChild(style);
    }
  },

  /**
   * 显示toast通知
   * @param {string} message - 通知消息
   * @param {string} type - 通知类型 ('info'|'success'|'warning'|'error'|'loading')
   * @param {number} duration - 显示时长(毫秒)，0表示不自动关闭
   * @returns {HTMLElement} Toast元素
   */
  showToast(message, type = 'info', duration = 3000) {
    this.initToastContainer();
    const container = document.getElementById('trace-toast-container');

    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = `trace-toast trace-toast-${type}`;
    
    // 根据类型设置图标
    let iconClass = '';
    switch (type) {
      case 'success':
        iconClass = 'fa-check-circle';
        break;
      case 'warning':
        iconClass = 'fa-exclamation-triangle';
        break;
      case 'error':
        iconClass = 'fa-times-circle';
        break;
      case 'loading':
        iconClass = 'fa-spinner trace-rotate';
        break;
      default:
        iconClass = 'fa-info-circle';
    }

    // 设置内容
    toast.innerHTML = `
      <i class="fas ${iconClass} trace-toast-icon"></i>
      <span>${message}</span>
    `;

    // 添加到容器
    container.appendChild(toast);

    // 触发显示动画
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // 自动关闭
    if (duration > 0) {
      setTimeout(() => {
        this.closeToast(toast);
      }, duration);
    }

    return toast;
  },

  /**
   * 关闭toast
   * @param {HTMLElement} toast - Toast元素
   */
  closeToast(toast) {
    if (!toast) return;

    toast.classList.remove('show');
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  },

  /**
   * 显示加载中toast
   * @param {string} message - 加载消息
   * @returns {HTMLElement} Toast元素
   */
  showLoading(message = '加载中...') {
    return this.showToast(message, 'loading', 0);
  },

  /**
   * 隐藏加载中toast并显示结果
   * @param {HTMLElement} loadingToast - 加载中toast元素
   * @param {string} message - 结果消息
   * @param {string} type - 结果类型 ('success'|'warning'|'error')
   * @param {number} duration - 显示时长(毫秒)
   */
  hideLoading(loadingToast, message, type = 'success', duration = 3000) {
    if (!loadingToast) return;

    this.closeToast(loadingToast);
    
    if (message) {
      this.showToast(message, type, duration);
    }
  },

  /**
   * 创建确认对话框
   * @param {Object} options - 配置选项
   * @param {string} options.title - 标题
   * @param {string} options.content - 内容
   * @param {string} options.confirmText - 确认按钮文本
   * @param {string} options.cancelText - 取消按钮文本
   * @param {Function} options.onConfirm - 确认回调
   * @param {Function} options.onCancel - 取消回调
   */
  showConfirm(options) {
    // 默认选项
    const config = {
      title: '确认操作',
      content: '确定执行此操作吗？',
      confirmText: '确定',
      cancelText: '取消',
      onConfirm: null,
      onCancel: null,
      ...options
    };

    // 创建模态框
    const modalContainer = document.createElement('div');
    modalContainer.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
    
    // 设置内容
    modalContainer.innerHTML = `
      <div class="bg-white rounded-lg max-w-md w-full p-6 shadow-xl transform transition-all">
        <h3 class="text-lg font-medium text-gray-900 mb-3">${config.title}</h3>
        <div class="text-sm text-gray-500 mb-5">${config.content}</div>
        <div class="flex justify-end space-x-2">
          <button class="confirm-cancel px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
            ${config.cancelText}
          </button>
          <button class="confirm-ok px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
            ${config.confirmText}
          </button>
        </div>
      </div>
    `;

    // 添加到页面
    document.body.appendChild(modalContainer);

    // 绑定按钮事件
    const confirmButton = modalContainer.querySelector('.confirm-ok');
    const cancelButton = modalContainer.querySelector('.confirm-cancel');

    // 确认按钮
    confirmButton.addEventListener('click', () => {
      document.body.removeChild(modalContainer);
      if (typeof config.onConfirm === 'function') {
        config.onConfirm();
      }
    });

    // 取消按钮
    cancelButton.addEventListener('click', () => {
      document.body.removeChild(modalContainer);
      if (typeof config.onCancel === 'function') {
        config.onCancel();
      }
    });

    // 点击背景关闭
    modalContainer.addEventListener('click', (e) => {
      if (e.target === modalContainer) {
        document.body.removeChild(modalContainer);
        if (typeof config.onCancel === 'function') {
          config.onCancel();
        }
      }
    });
  },

  /**
   * 显示表格加载状态
   * @param {HTMLElement} tableContainer - 表格容器元素
   * @param {string} message - 加载消息
   */
  showTableLoading(tableContainer, message = '正在加载数据...') {
    // 检查容器
    if (!tableContainer) return;

    // 创建加载蒙层
    const loadingMask = document.createElement('div');
    loadingMask.className = 'table-loading-mask absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-10';
    loadingMask.innerHTML = `
      <div class="text-center">
        <i class="fas fa-spinner fa-spin text-blue-500 text-2xl mb-2"></i>
        <p class="text-gray-600">${message}</p>
      </div>
    `;

    // 确保容器有定位属性
    if (getComputedStyle(tableContainer).position === 'static') {
      tableContainer.style.position = 'relative';
    }

    // 添加到容器
    tableContainer.appendChild(loadingMask);
    
    return loadingMask;
  },

  /**
   * 隐藏表格加载状态
   * @param {HTMLElement} tableContainer - 表格容器元素
   */
  hideTableLoading(tableContainer) {
    if (!tableContainer) return;
    const loadingMask = tableContainer.querySelector('.table-loading-mask');
    if (loadingMask) {
      loadingMask.remove();
    }
  }
};

// 页面加载时自动初始化
document.addEventListener('DOMContentLoaded', () => {
  traceUI.init();
});

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { traceUI };
} else {
  window.traceUI = traceUI;
} 