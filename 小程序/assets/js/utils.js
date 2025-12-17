/*
 * 通用工具函数 - 溯源商城高保真原型系统
 */

const Utils = {
  /**
   * 格式化日期
   * @param {Date|string|number} date - 日期
   * @param {string} format - 格式 ('YYYY-MM-DD' | 'YYYY-MM-DD HH:mm' | 'YYYY-MM-DD HH:mm:ss')
   * @returns {string} 格式化后的日期
   */
  formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    if (!date) return '';

    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  },

  /**
   * 格式化货币
   * @param {number} amount - 金额
   * @param {string} currency - 货币符号
   * @returns {string} 格式化后的货币
   */
  formatCurrency(amount, currency = '¥') {
    if (amount === null || amount === undefined) return `${currency}0.00`;

    const formatted = Number(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    return `${currency}${formatted}`;
  },

  /**
   * 格式化数字（千分位）
   * @param {number} num - 数字
   * @returns {string} 格式化后的数字
   */
  formatNumber(num) {
    if (num === null || num === undefined) return '0';

    return String(num).replace(/\d(?=(\d{3})+$)/g, '$&,');
  },

  /**
   * 防抖
   * @param {Function} func - 函数
   * @param {number} wait - 等待时间（毫秒）
   * @returns {Function} 防抖后的函数
   */
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * 节流
   * @param {Function} func - 函数
   * @param {number} limit - 限制时间（毫秒）
   * @returns {Function} 节流后的函数
   */
  throttle(func, limit = 300) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  /**
   * 深拷贝
   * @param {any} obj - 对象
   * @returns {any} 拷贝后的对象
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;

    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));

    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = this.deepClone(obj[key]);
      }
    }
    return clonedObj;
  },

  /**
   * 生成随机ID
   * @param {number} length - 长度
   * @returns {string} 随机ID
   */
  generateId(length = 8) {
    return Math.random().toString(36).substr(2, length);
  },

  /**
   * 延迟执行
   * @param {number} ms - 延迟时间（毫秒）
   * @returns {Promise} Promise
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * 获取URL参数
   * @param {string} name - 参数名
   * @returns {string|null} 参数值
   */
  getUrlParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  },

  /**
   * 设置URL参数
   * @param {string} name - 参数名
   * @param {string} value - 参数值
   */
  setUrlParam(name, value) {
    const url = new URL(window.location.href);
    url.searchParams.set(name, value);
    window.history.pushState({}, '', url);
  },

  /**
   * 显示Toast提示
   * @param {string} message - 提示消息
   * @param {string} type - 类型 ('success' | 'error' | 'warning' | 'info')
   * @param {number} duration - 持续时间（毫秒）
   */
  showToast(message, type = 'info', duration = 3000) {
    // 创建toast容器（如果不存在）
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // 图标
    const iconMap = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };
    const icon = iconMap[type] || iconMap.info;

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // 自动移除
    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /**
   * 显示Loading
   * @param {string} message - 加载消息
   * @returns {Function} 关闭Loading的函数
   */
  showLoading(message = '加载中...') {
    const loading = document.createElement('div');
    loading.className = 'modal-backdrop';
    loading.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <div class="loading-text">${message}</div>
      </div>
    `;

    document.body.appendChild(loading);

    return () => loading.remove();
  },

  /**
   * 确认对话框
   * @param {string} message - 确认消息
   * @param {string} title - 标题
   * @returns {Promise<boolean>} 是否确认
   */
  confirm(message, title = '确认') {
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';

      backdrop.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">${title}</div>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" data-action="cancel">取消</button>
            <button class="btn btn-primary" data-action="confirm">确认</button>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);

      // 按钮事件
      backdrop.querySelector('[data-action="cancel"]').onclick = () => {
        backdrop.remove();
        resolve(false);
      };

      backdrop.querySelector('[data-action="confirm"]').onclick = () => {
        backdrop.remove();
        resolve(true);
      };

      // 点击背景关闭
      backdrop.onclick = (e) => {
        if (e.target === backdrop) {
          backdrop.remove();
          resolve(false);
        }
      };
    });
  },

  /**
   * 复制到剪贴板
   * @param {string} text - 文本
   * @returns {Promise<boolean>} 是否成功
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('复制成功', 'success');
      return true;
    } catch (err) {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();

      try {
        document.execCommand('copy');
        this.showToast('复制成功', 'success');
        return true;
      } catch (err) {
        this.showToast('复制失败', 'error');
        return false;
      } finally {
        document.body.removeChild(textArea);
      }
    }
  },

  /**
   * 下载文件
   * @param {Blob|string} data - 数据或URL
   * @param {string} filename - 文件名
   */
  downloadFile(data, filename) {
    const url = typeof data === 'string' ? data : URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    if (typeof data !== 'string') {
      URL.revokeObjectURL(url);
    }
  },

  /**
   * 文件大小格式化
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * 验证手机号
   * @param {string} phone - 手机号
   * @returns {boolean} 是否有效
   */
  isValidPhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone);
  },

  /**
   * 验证邮箱
   * @param {string} email - 邮箱
   * @returns {boolean} 是否有效
   */
  isValidEmail(email) {
    return /^[\w.-]+@[\w.-]+\.\w+$/.test(email);
  },

  /**
   * 手机号脱敏
   * @param {string} phone - 手机号
   * @returns {string} 脱敏后的手机号
   */
  maskPhone(phone) {
    if (!phone || phone.length !== 11) return phone;
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  },

  /**
   * 切换侧边栏菜单组
   * @param {HTMLElement} element - 点击的元素
   */
  toggleSidebarGroup(element) {
    // 找到父级 nav-group
    const group = element.closest('.nav-group');
    if (group) {
        group.classList.toggle('expanded');
        
        // 保存状态到 localStorage (如果每个 group 有唯一标识)
        // 这里简单实现：保存所有 expanded 的 group index
        this.saveSidebarState();
    }
  },

  /**
   * 保存侧边栏状态
   */
  saveSidebarState() {
      const groups = document.querySelectorAll('.nav-group');
      const expandedIndices = [];
      groups.forEach((group, index) => {
          if (group.classList.contains('expanded')) {
              expandedIndices.push(index);
          }
      });
      localStorage.setItem('sidebarState', JSON.stringify(expandedIndices));
  },

  /**
   * 恢复侧边栏状态
   */
  restoreSidebarState() {
      const savedState = localStorage.getItem('sidebarState');
      if (savedState) {
          const expandedIndices = JSON.parse(savedState);
          const groups = document.querySelectorAll('.nav-group');
          expandedIndices.forEach(index => {
              if (groups[index]) {
                  groups[index].classList.add('expanded');
              }
          });
      }
  }
};

// 页面加载时恢复侧边栏状态
document.addEventListener('DOMContentLoaded', () => {
    if (typeof Utils !== 'undefined' && Utils.restoreSidebarState) {
        Utils.restoreSidebarState();
    }
    
    // 绑定侧边栏点击事件 (如果 HTML 中没有 onclick)
    // 但目前 HTML 中有 onclick="toggleSidebarGroup(this)"，需要确保全局能访问
    // 将 toggleSidebarGroup 挂载到 window 对象，以便 HTML onclick 属性可以访问
    if (typeof window !== 'undefined') {
        window.toggleSidebarGroup = (el) => Utils.toggleSidebarGroup(el);
    }
});

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}
