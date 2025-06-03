/**
 * 食品溯源系统 - 通用工具函数模块
 * 版本: 1.0.0
 */

// 通用工具函数
const traceUtils = {
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
    
    // 处理格式字符串，使用正则替换格式占位符
    // 移除[T]形式中的方括号，将它们视为直接的字符
    return format.replace(/\[(.+?)\]/g, '$1')
                .replace(/(yyyy|MM|dd|HH|mm|ss)/g, match => formatObj[match]);
  },
  
  /**
   * 计算两个日期之间的差异
   * @param {Date|string|number} date1 - 起始日期
   * @param {Date|string|number} date2 - 结束日期
   * @param {string} unit - 返回单位 (days, hours, minutes, seconds)
   * @param {boolean} absolute - 是否返回绝对值，默认false
   * @returns {number} - 时间差值
   */
  dateDiff(date1, date2, unit = '', absolute = false) {
    // 转换为毫秒
    const d1 = new Date(date1).getTime();
    const d2 = new Date(date2).getTime();
    
    if (isNaN(d1) || isNaN(d2)) {
      return null;
    }
    
    // 计算实际差值（可能为负）
    const rawDiff = d2 - d1;
    const diff = absolute ? Math.abs(rawDiff) : rawDiff;
    
    // 默认或无效unit参数返回毫秒差值
    if (!unit || unit === '') {
      return diff;
    }
    
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
        return diff; // 返回毫秒差值
    }
  },
  
  /**
   * 判断是否为有效日期
   * @param {any} date - 需要验证的日期
   * @returns {boolean} - 是否为有效日期
   */
  isValidDate(date) {
    if (!date) return false;
    
    // 如果是数字，转换为日期对象
    if (typeof date === 'number') {
      date = new Date(date);
    }
    
    // 如果是字符串，尝试转换
    if (typeof date === 'string') {
      date = new Date(date);
    }
    
    // 检查是否是有效的Date对象且日期合理
    if (date instanceof Date && !isNaN(date.getTime())) {
      // 额外检查日期是否合理
      const y = date.getFullYear();
      const m = date.getMonth();
      const d = date.getDate();
      
      // 检查2月31日等非法日期
      const maxDays = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      return d > 0 && d <= maxDays[m];
    }
    
    return false;
  },
  
  /**
   * 解析日期字符串为Date对象
   * @param {string} dateString - 日期字符串
   * @param {string} format - 自定义格式（可选）
   * @returns {Date|null} - 解析后的Date对象，解析失败返回null
   */
  parseDateString(dateString, format = null) {
    if (!dateString) return null;
    
    // 如果已经是Date对象直接返回
    if (dateString instanceof Date) return dateString;
    
    // 如果是数字，假设是时间戳
    if (typeof dateString === 'number') {
      return new Date(dateString);
    }
    
    // 如果不是字符串，返回null
    if (typeof dateString !== 'string') return null;
    
    // 尝试直接解析（处理ISO格式和常见格式）
    try {
      const date = new Date(dateString);
      // 验证是否解析成功
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (e) {
      // 解析失败，继续尝试自定义格式
    }
    
    // 如果提供了自定义格式，尝试按照格式解析
    if (format) {
      try {
        // 简单实现：仅支持yyyy-MM-dd HH:mm:ss格式
        // 一个完整的实现会更复杂，需要处理各种格式
        if (format === 'yyyyMMddHHmmss') {
          const year = parseInt(dateString.substring(0, 4));
          const month = parseInt(dateString.substring(4, 6)) - 1;
          const day = parseInt(dateString.substring(6, 8));
          const hour = parseInt(dateString.substring(8, 10));
          const minute = parseInt(dateString.substring(10, 12));
          const second = parseInt(dateString.substring(12, 14));
          
          const date = new Date(year, month, day, hour, minute, second);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      } catch (e) {
        // 自定义格式解析失败
      }
    }
    
    // 所有解析尝试失败，返回null
    return null;
  },
  
  /**
   * 获取相对时间描述
   * @param {Date|string|number} date - 日期
   * @returns {string} - 相对时间描述
   */
  getRelativeTimeString(date) {
    if (!date) return '未知时间';
    
    // 确保date为Date对象
    let dateObj;
    try {
      if (typeof date === 'string' || typeof date === 'number') {
        dateObj = new Date(date);
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        return '未知时间';
      }
      
      // 验证日期是否有效
      if (isNaN(dateObj.getTime())) {
        return '未知时间';
      }
    } catch (e) {
      return '未知时间';
    }
    
    const now = new Date();
    const diff = now.getTime() - dateObj.getTime();
    const diffAbs = Math.abs(diff);
    const isFuture = diff < 0;
    
    // 时间单位转换（毫秒）
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    const month = 30 * day;
    const year = 365 * day;
    
    // 根据时间差值返回相应的描述
    if (diffAbs < minute) {
      return '刚刚';
    } else if (diffAbs < hour) {
      const minutes = Math.floor(diffAbs / minute);
      return isFuture ? `${minutes}分钟后` : `${minutes}分钟前`;
    } else if (diffAbs < day) {
      const hours = Math.floor(diffAbs / hour);
      return isFuture ? `${hours}小时后` : `${hours}小时前`;
    } else if (diffAbs < day * 2) {
      // 处理"昨天/明天"的特殊情况
      return isFuture ? '明天' : '昨天';
    } else if (diffAbs < week) {
      const days = Math.floor(diffAbs / day);
      return isFuture ? `${days}天后` : `${days}天前`;
    } else if (diffAbs < month) {
      const weeks = Math.floor(diffAbs / week);
      return isFuture ? `${weeks}周后` : `${weeks}周前`;
    } else if (diffAbs < year) {
      const months = Math.floor(diffAbs / month);
      return isFuture ? `${months}个月后` : `${months}个月前`;
    } else {
      const years = Math.floor(diffAbs / year);
      return isFuture ? `${years}年后` : `${years}年前`;
    }
  },
  
  /**
   * 获取星期名称
   * @param {Date|string|number} date - 日期
   * @param {string} lang - 语言代码，默认'zh'（中文）
   * @param {string} format - 格式，'long'或'short'
   * @returns {string} - 星期名称
   */
  getDayName(date, lang = 'zh', format = 'long') {
    if (!date) return '';
    
    // 确保date为Date对象
    let dateObj;
    try {
      if (typeof date === 'string' || typeof date === 'number') {
        dateObj = new Date(date);
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        return '';
      }
      
      // 验证日期是否有效
      if (isNaN(dateObj.getTime())) {
        return '';
      }
    } catch (e) {
      return '';
    }
    
    const day = dateObj.getDay(); // 0-6，0表示星期日
    
    // 中文星期名称
    const zhDays = {
      long: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
      short: ['日', '一', '二', '三', '四', '五', '六']
    };
    
    // 英文星期名称
    const enDays = {
      long: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    };
    
    // 根据语言和格式返回星期名称
    if (lang === 'zh') {
      return zhDays[format][day];
    } else {
      return enDays[format][day];
    }
  },
  
  /**
   * 获取月份名称
   * @param {Date|string|number} date - 日期
   * @param {string} lang - 语言代码，默认'zh'（中文）
   * @param {string} format - 格式，'long'或'short'
   * @returns {string} - 月份名称
   */
  getMonthName(date, lang = 'zh', format = 'long') {
    if (!date) return '';
    
    // 确保date为Date对象
    let dateObj;
    try {
      if (typeof date === 'string' || typeof date === 'number') {
        dateObj = new Date(date);
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        return '';
      }
      
      // 验证日期是否有效
      if (isNaN(dateObj.getTime())) {
        return '';
      }
    } catch (e) {
      return '';
    }
    
    const month = dateObj.getMonth(); // 0-11
    
    // 中文月份名称
    const zhMonths = {
      long: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
      short: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    };
    
    // 英文月份名称
    const enMonths = {
      long: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    };
    
    // 根据语言和格式返回月份名称
    if (lang === 'zh') {
      return zhMonths[format][month];
    } else {
      return enMonths[format][month];
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
// CommonJS导出
module.exports.traceUtils = traceUtils;
