/**
 * 食品溯源系统 - 通用工具函数模块
 * 版本: 1.0.0
 */

// 通用工具函数
export const traceUtils = {
  /**
   * 初始化工具模块
   */
  init() {
    console.log('工具模块已初始化');
    return this;
  },
  
  /**
   * 生成UUID
   * @returns {string} - 生成的UUID
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },
  
  /**
   * 生成唯一ID (更短版本)
   * @returns {string} - 生成的唯一ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  },
  
  /**
   * 格式化日期时间
   * @param {Date|string|number} date - 日期对象或时间戳
   * @param {string} format - 格式字符串 (yyyy-MM-dd HH:mm:ss)
   * @returns {string} - 格式化后的日期字符串
   */
  formatDate(date, format = 'yyyy-MM-dd HH:mm:ss') {
    if (!date) return '';
    
    // 转换输入日期为Date对象
    let dateObj;
    if (typeof date === 'string') {
      // 处理ISO字符串
      dateObj = new Date(date);
    } else if (typeof date === 'number') {
      // 处理时间戳
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return '';
    }
    
    // 检查是否有效日期
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    const formatObj = {
      yyyy: dateObj.getFullYear(),
      MM: ('0' + (dateObj.getMonth() + 1)).slice(-2),
      dd: ('0' + dateObj.getDate()).slice(-2),
      HH: ('0' + dateObj.getHours()).slice(-2),
      mm: ('0' + dateObj.getMinutes()).slice(-2),
      ss: ('0' + dateObj.getSeconds()).slice(-2)
    };
    
    return format.replace(/(yyyy|MM|dd|HH|mm|ss)/g, match => formatObj[match]);
  },
  
  /**
   * 计算两个日期之间的差异
   * @param {Date|string|number} date1 - 起始日期
   * @param {Date|string|number} date2 - 结束日期
   * @param {string} unit - 返回单位 (days, hours, minutes, seconds)
   * @returns {number} - 时间差值
   */
  dateDiff(date1, date2, unit = 'days') {
    // 转换为毫秒
    const d1 = new Date(date1).getTime();
    const d2 = new Date(date2).getTime();
    
    if (isNaN(d1) || isNaN(d2)) {
      return null;
    }
    
    const diff = Math.abs(d2 - d1);
    
    // 根据单位返回不同的结果
    switch (unit.toLowerCase()) {
      case 'days':
        return Math.floor(diff / (1000 * 60 * 60 * 24));
      case 'hours':
        return Math.floor(diff / (1000 * 60 * 60));
      case 'minutes':
        return Math.floor(diff / (1000 * 60));
      case 'seconds':
        return Math.floor(diff / 1000);
      default:
        return diff;
    }
  },
  
  /**
   * 防抖函数
   * @param {Function} func - 需要防抖的函数
   * @param {number} wait - 等待时间(毫秒)
   * @returns {Function} - 防抖处理后的函数
   */
  debounce(func, wait = 300) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func.apply(context, args);
      }, wait);
    };
  },
  
  /**
   * 节流函数
   * @param {Function} func - 需要节流的函数
   * @param {number} limit - 限制时间(毫秒)
   * @returns {Function} - 节流处理后的函数
   */
  throttle(func, limit = 300) {
    let inThrottle;
    return function(...args) {
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  },
  
  /**
   * 深拷贝对象
   * @param {Object} obj - 要拷贝的对象
   * @returns {Object} - 拷贝后的新对象
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    // 处理Date对象
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    // 处理Array对象
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }
    
    // 处理普通对象
    const cloneObj = {};
    Object.keys(obj).forEach(key => {
      cloneObj[key] = this.deepClone(obj[key]);
    });
    
    return cloneObj;
  },
  
  /**
   * 将对象转换为查询字符串
   * @param {Object} params - 参数对象
   * @returns {string} - 查询字符串
   */
  objectToQueryString(params) {
    if (!params || typeof params !== 'object') {
      return '';
    }
    
    return Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== null)
      .map(key => {
        const value = params[key];
        if (Array.isArray(value)) {
          // 处理数组参数
          return value.map(val => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`).join('&');
        }
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      })
      .join('&');
  },
  
  /**
   * 解析查询字符串为对象
   * @param {string} queryString - 查询字符串
   * @returns {Object} - 解析后的对象
   */
  queryStringToObject(queryString) {
    if (!queryString || typeof queryString !== 'string') {
      return {};
    }
    
    // 移除开头的问号
    const query = queryString.startsWith('?') ? queryString.substring(1) : queryString;
    
    // 解析查询字符串
    const result = {};
    query.split('&').forEach(part => {
      if (!part) return;
      
      const [key, value] = part.split('=').map(decodeURIComponent);
      
      // 处理数组参数
      if (result[key] !== undefined) {
        if (!Array.isArray(result[key])) {
          result[key] = [result[key]];
        }
        result[key].push(value);
      } else {
        result[key] = value;
      }
    });
    
    return result;
  },
  
  /**
   * 检测设备类型
   * @returns {Object} - 设备信息对象
   */
  detectDevice() {
    const ua = navigator.userAgent;
    
    const device = {
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
      isIOS: /iPhone|iPad|iPod/i.test(ua),
      isAndroid: /Android/i.test(ua),
      isTablet: /iPad|Android(?!.*Mobile)/i.test(ua),
      isDesktop: !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
      isSafari: /^((?!chrome|android).)*safari/i.test(ua),
      isChrome: /chrome/i.test(ua) && /google/i.test(ua),
      isFirefox: /firefox/i.test(ua),
      isEdge: /edg/i.test(ua),
      isWeChat: /MicroMessenger/i.test(ua)
    };
    
    return device;
  },
  
  /**
   * 获取浏览器语言设置
   * @returns {string} - 浏览器语言代码
   */
  getBrowserLanguage() {
    return navigator.language || navigator.userLanguage || 'zh-CN';
  },
  
  /**
   * 复制文本到剪贴板
   * @param {string} text - 要复制的文本
   * @returns {Promise} - 复制操作的Promise
   */
  copyToClipboard(text) {
    // 优先使用navigator.clipboard API (需要HTTPS或localhost)
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    
    // 回退方法
    return new Promise((resolve, reject) => {
      try {
        // 创建临时元素并复制
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed'; // 避免滚动
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        // 执行复制命令
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          resolve();
        } else {
          reject(new Error('复制失败'));
        }
      } catch (err) {
        reject(err);
      }
    });
  },
  
  /**
   * 安全获取本地存储数据
   * @param {string} key - 存储键名
   * @param {*} defaultValue - 默认值
   * @returns {*} - 存储的值或默认值
   */
  getLocalStorage(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return defaultValue;
      return JSON.parse(value);
    } catch (err) {
      console.error('从localStorage获取数据失败:', err);
      return defaultValue;
    }
  },
  
  /**
   * 安全设置本地存储数据
   * @param {string} key - 存储键名
   * @param {*} value - 要存储的值
   * @returns {boolean} - 是否成功
   */
  setLocalStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('设置localStorage数据失败:', err);
      return false;
    }
  },
  
  /**
   * 从本地存储中删除数据
   * @param {string} key - 存储键名
   * @returns {boolean} - 是否成功
   */
  removeLocalStorage(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (err) {
      console.error('从localStorage删除数据失败:', err);
      return false;
    }
  }
};

// 为了向后兼容，导出到全局对象
if (typeof window !== 'undefined') {
  window.traceUtils = traceUtils;
} 