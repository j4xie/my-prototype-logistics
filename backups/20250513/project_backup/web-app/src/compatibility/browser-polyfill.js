/**
 * @file 浏览器兼容性填充模块
 * @description 为旧浏览器提供现代功能的兼容性填充
 * @version 1.0.0
 */

/**
 * 应用必要的浏览器填充
 * @param {Object} features - 浏览器特性检测结果
 * @returns {Array<string>} 已应用的填充列表
 */
export function applyPolyfills(features) {
  const appliedPolyfills = [];

  if (!features) {
    console.error('未提供浏览器特性信息，无法应用填充');
    return appliedPolyfills;
  }

  // 为旧版IE应用基本填充
  if (features.isIE) {
    _applyIEPolyfills();
    appliedPolyfills.push('IE基础填充');
  }

  // 为不支持Promise的浏览器添加填充
  if (!features.supportsPromise) {
    _applyPromisePolyfill();
    appliedPolyfills.push('Promise');
  }

  // 为不支持fetch的浏览器添加填充
  if (!features.supportsFetch) {
    _applyFetchPolyfill();
    appliedPolyfills.push('Fetch API');
  }

  // 为不支持Symbol的浏览器添加填充
  if (typeof Symbol === 'undefined') {
    _applySymbolPolyfill();
    appliedPolyfills.push('Symbol');
  }

  // 为不支持Array.from的浏览器添加填充
  if (!Array.from) {
    _applyArrayFromPolyfill();
    appliedPolyfills.push('Array.from');
  }

  // 为不支持Object.assign的浏览器添加填充
  if (!Object.assign) {
    _applyObjectAssignPolyfill();
    appliedPolyfills.push('Object.assign');
  }

  // 为不支持requestAnimationFrame的浏览器添加填充
  if (!features.supportsRequestAnimationFrame) {
    _applyRAFPolyfill();
    appliedPolyfills.push('requestAnimationFrame');
  }

  // 为不支持localStorage的浏览器提供内存模拟
  if (!features.supportsLocalStorage) {
    _applyLocalStoragePolyfill();
    appliedPolyfills.push('localStorage');
  }

  return appliedPolyfills;
}

/**
 * 应用IE特定的填充
 * @private
 */
function _applyIEPolyfills() {
  // Console 填充 (IE8/9)
  if (!window.console) {
    window.console = {
      log: function() {},
      error: function() {},
      warn: function() {},
      info: function() {}
    };
  }

  // forEach 填充
  if (!Array.prototype.forEach) {
    Array.prototype.forEach = function(callback, thisArg) {
      var T, k;
      if (this == null) {
        throw new TypeError('this is null or not defined');
      }

      var O = Object(this);
      var len = O.length >>> 0;

      if (typeof callback !== 'function') {
        throw new TypeError(callback + ' is not a function');
      }

      if (arguments.length > 1) {
        T = thisArg;
      }

      k = 0;
      while (k < len) {
        var kValue;
        if (k in O) {
          kValue = O[k];
          callback.call(T, kValue, k, O);
        }
        k++;
      }
    };
  }

  // classList 填充
  if (!('classList' in document.documentElement)) {
    Object.defineProperty(HTMLElement.prototype, 'classList', {
      get: function() {
        var self = this;
        
        function update(fn) {
          return function(value) {
            var classes = self.className.split(/\s+/);
            var index = classes.indexOf(value);
            fn(classes, index, value);
            self.className = classes.join(' ');
            return self;
          };
        }
        
        return {
          add: update(function(classes, index, value) {
            if (index === -1) classes.push(value);
          }),
          remove: update(function(classes, index) {
            if (index !== -1) classes.splice(index, 1);
          }),
          toggle: update(function(classes, index, value) {
            if (index === -1) {
              classes.push(value);
            } else {
              classes.splice(index, 1);
            }
          }),
          contains: function(value) {
            return self.className.split(/\s+/).indexOf(value) !== -1;
          }
        };
      }
    });
  }
}

/**
 * 为不支持Promise的浏览器应用填充
 * @private
 */
function _applyPromisePolyfill() {
  if (typeof Promise !== 'undefined') return;

  // 基本的Promise填充
  function SimplePromise(executor) {
    var doResolve = function(self, fn) {
      var done = false;
      try {
        fn(
          function(value) {
            if (done) return;
            done = true;
            resolve(self, value);
          },
          function(reason) {
            if (done) return;
            done = true;
            reject(self, reason);
          }
        );
      } catch (e) {
        if (done) return;
        done = true;
        reject(self, e);
      }
    };

    var state = 'pending';
    var value = null;
    var deferreds = [];

    function handle(deferred) {
      if (state === 'pending') {
        deferreds.push(deferred);
        return;
      }

      setTimeout(function() {
        var cb = state === 'fulfilled' ? deferred.onFulfilled : deferred.onRejected;
        if (cb === null) {
          (state === 'fulfilled' ? deferred.resolve : deferred.reject)(value);
          return;
        }
        try {
          var result = cb(value);
          deferred.resolve(result);
        } catch (e) {
          deferred.reject(e);
        }
      }, 0);
    }

    function resolve(self, newValue) {
      try {
        if (newValue === self) throw new TypeError('A promise cannot be resolved with itself');
        if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
          var then = newValue.then;
          if (typeof then === 'function') {
            doResolve(self, then.bind(newValue));
            return;
          }
        }
        state = 'fulfilled';
        value = newValue;
        finale();
      } catch (e) {
        reject(self, e);
      }
    }

    function reject(self, newValue) {
      state = 'rejected';
      value = newValue;
      finale();
    }

    function finale() {
      for (var i = 0, len = deferreds.length; i < len; i++) {
        handle(deferreds[i]);
      }
      deferreds = null;
    }

    this.then = function(onFulfilled, onRejected) {
      var self = this;
      return new SimplePromise(function(resolve, reject) {
        handle({
          onFulfilled: typeof onFulfilled === 'function' ? onFulfilled : null,
          onRejected: typeof onRejected === 'function' ? onRejected : null,
          resolve: resolve,
          reject: reject
        });
      });
    };

    this.catch = function(onRejected) {
      return this.then(null, onRejected);
    };

    doResolve(this, executor);
  }

  SimplePromise.resolve = function(value) {
    if (value && typeof value === 'object' && value.constructor === SimplePromise) {
      return value;
    }

    return new SimplePromise(function(resolve) {
      resolve(value);
    });
  };

  SimplePromise.reject = function(value) {
    return new SimplePromise(function(resolve, reject) {
      reject(value);
    });
  };

  SimplePromise.all = function(arr) {
    return new SimplePromise(function(resolve, reject) {
      if (!Array.isArray(arr)) {
        return reject(new TypeError('Promise.all accepts an array'));
      }

      var args = Array.prototype.slice.call(arr);
      if (args.length === 0) return resolve([]);

      var remaining = args.length;
      var res = Array(remaining);

      function resolver(i) {
        return function(value) {
          try {
            res[i] = value;
            if (--remaining === 0) {
              resolve(res);
            }
          } catch (e) {
            reject(e);
          }
        };
      }

      for (var i = 0; i < args.length; i++) {
        Promise.resolve(args[i]).then(resolver(i), reject);
      }
    });
  };

  window.Promise = SimplePromise;
}

/**
 * 为不支持fetch的浏览器应用填充
 * @private
 */
function _applyFetchPolyfill() {
  if (window.fetch) return;

  // 基本的fetch API填充，使用XHR实现
  window.fetch = function(url, options) {
    options = options || {};
    
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      
      xhr.open(options.method || 'GET', url);
      
      if (options.headers) {
        Object.keys(options.headers).forEach(function(key) {
          xhr.setRequestHeader(key, options.headers[key]);
        });
      }
      
      xhr.onload = function() {
        var response = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: xhr.getAllResponseHeaders(),
          url: xhr.responseURL || url,
          text: function() {
            return Promise.resolve(xhr.responseText);
          },
          json: function() {
            return Promise.resolve(JSON.parse(xhr.responseText));
          },
          blob: function() {
            return Promise.resolve(new Blob([xhr.response]));
          }
        };
        resolve(response);
      };
      
      xhr.onerror = function() {
        reject(new TypeError('Network request failed'));
      };
      
      xhr.ontimeout = function() {
        reject(new TypeError('Network request timed out'));
      };
      
      xhr.send(options.body);
    });
  };
}

/**
 * 为不支持Symbol的浏览器应用填充
 * @private
 */
function _applySymbolPolyfill() {
  if (typeof Symbol !== 'undefined') return;

  // 简单的Symbol模拟
  var Symbol = function(description) {
    if (this instanceof Symbol) throw new TypeError('Symbol is not a constructor');
    var sym = Object.create(Symbol.prototype);
    sym.description = description;
    sym.__name__ = '@@Symbol:' + description;
    return sym;
  };

  Symbol.prototype.toString = function() {
    return this.__name__;
  };

  window.Symbol = Symbol;
}

/**
 * 为不支持Array.from的浏览器应用填充
 * @private
 */
function _applyArrayFromPolyfill() {
  if (Array.from) return;

  Array.from = function(arrayLike, mapFn, thisArg) {
    var arr = [];
    
    if (arrayLike == null) {
      throw new TypeError('Array.from requires an array-like object');
    }
    
    var T = thisArg !== undefined ? thisArg : undefined;
    var len = Number(arrayLike.length) || 0;
    
    for (var i = 0; i < len; i++) {
      var item = arrayLike[i];
      if (mapFn) {
        arr.push(mapFn.call(T, item, i, arrayLike));
      } else {
        arr.push(item);
      }
    }
    
    return arr;
  };
}

/**
 * 为不支持Object.assign的浏览器应用填充
 * @private
 */
function _applyObjectAssignPolyfill() {
  if (Object.assign) return;

  Object.assign = function(target) {
    if (target == null) {
      throw new TypeError('Cannot convert undefined or null to object');
    }

    var to = Object(target);
    
    for (var i = 1; i < arguments.length; i++) {
      var nextSource = arguments[i];
      
      if (nextSource != null) {
        for (var nextKey in nextSource) {
          if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
            to[nextKey] = nextSource[nextKey];
          }
        }
      }
    }
    
    return to;
  };
}

/**
 * 为不支持requestAnimationFrame的浏览器应用填充
 * @private
 */
function _applyRAFPolyfill() {
  var lastTime = 0;
  
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = function(callback) {
      var currTime = new Date().getTime();
      var timeToCall = Math.max(0, 16 - (currTime - lastTime));
      var id = window.setTimeout(function() {
        callback(currTime + timeToCall);
      }, timeToCall);
      lastTime = currTime + timeToCall;
      return id;
    };
  }
  
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = function(id) {
      clearTimeout(id);
    };
  }
}

/**
 * 为不支持localStorage的浏览器提供内存模拟
 * @private
 */
function _applyLocalStoragePolyfill() {
  if (window.localStorage) return;

  var memoryStorage = {};
  
  window.localStorage = {
    getItem: function(key) {
      return memoryStorage[key] || null;
    },
    setItem: function(key, value) {
      memoryStorage[key] = value.toString();
    },
    removeItem: function(key) {
      delete memoryStorage[key];
    },
    clear: function() {
      memoryStorage = {};
    },
    key: function(n) {
      return Object.keys(memoryStorage)[n];
    },
    get length() {
      return Object.keys(memoryStorage).length;
    }
  };
  
  console.warn('使用内存localStorage填充，数据将在页面刷新后丢失');
}

/**
 * 针对特定浏览器应用CSS修复
 * @param {Object} features - 浏览器特性
 * @returns {string} CSS修复字符串
 */
export function getBrowserCSSFixes(features) {
  if (!features) return '';
  
  let cssFixes = '';
  
  // 为IE添加CSS修复
  if (features.isIE) {
    cssFixes += `
      /* IE Flexbox 修复 */
      .flex-container {
        display: -ms-flexbox;
        -ms-flex-direction: row;
      }
      
      /* IE边框盒模型修复 */
      * {
        -ms-box-sizing: border-box;
      }
      
      /* IE透明度修复 */
      .transparent {
        -ms-filter: "progid:DXImageTransform.Microsoft.Alpha(Opacity=50)";
      }
    `;
  }
  
  // 旧Safari浏览器修复
  if (features.isSafari && parseInt(features.version, 10) < 11) {
    cssFixes += `
      /* 旧Safari Flexbox 修复 */
      .flex-container {
        display: -webkit-flex;
        -webkit-flex-direction: row;
      }
      
      /* Safari 滚动平滑修复 */
      body {
        -webkit-overflow-scrolling: touch;
      }
    `;
  }
  
  // 应用对旧版Firefox的修复
  if (features.isFirefox && parseInt(features.version, 10) < 50) {
    cssFixes += `
      /* Firefox Flexbox 修复 */
      .flex-container {
        display: -moz-box;
        -moz-box-orient: horizontal;
      }
    `;
  }
  
  return cssFixes;
}

/**
 * 创建并应用浏览器特定的CSS修复
 * @param {Object} features - 浏览器特性
 */
export function applyBrowserCSSFixes(features) {
  const cssFixes = getBrowserCSSFixes(features);
  
  if (!cssFixes) return;
  
  // 创建样式元素并插入到头部
  const styleElement = document.createElement('style');
  styleElement.type = 'text/css';
  styleElement.id = 'browser-compat-fixes';
  styleElement.innerHTML = cssFixes;
  
  // 将样式追加到head
  if (document.head) {
    document.head.appendChild(styleElement);
  } else {
    // 如果head不可用，则等待DOM加载完成后再追加
    document.addEventListener('DOMContentLoaded', function() {
      document.head.appendChild(styleElement);
    });
  }
}

/**
 * 应用低资源模式的样式修复
 */
export function applyLowResourceModeFixes() {
  const styleElement = document.createElement('style');
  styleElement.type = 'text/css';
  styleElement.id = 'low-resource-mode-fixes';
  styleElement.innerHTML = `
    /* 禁用所有动画 */
    *, *::before, *::after {
      animation: none !important;
      transition: none !important;
    }
    
    /* 简化阴影和渐变 */
    * {
      box-shadow: none !important;
      text-shadow: none !important;
      background-image: none !important;
    }
    
    /* 降低图片质量 */
    img {
      image-rendering: optimizeSpeed;
    }
  `;
  
  if (document.head) {
    document.head.appendChild(styleElement);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      document.head.appendChild(styleElement);
    });
  }
}

/**
 * 创建浏览器警告提示
 * @param {string} message - 警告消息
 * @param {string} type - 警告类型 ('error', 'warning', 'info')
 * @returns {HTMLElement} 创建的警告元素
 */
export function createBrowserWarning(message, type = 'warning') {
  const warningElement = document.createElement('div');
  warningElement.className = `browser-warning browser-warning-${type}`;
  warningElement.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: 10px;
    background-color: ${type === 'error' ? '#ffebee' : type === 'warning' ? '#fff3e0' : '#e3f2fd'};
    color: ${type === 'error' ? '#b71c1c' : type === 'warning' ? '#e65100' : '#0d47a1'};
    border-bottom: 1px solid ${type === 'error' ? '#ef9a9a' : type === 'warning' ? '#ffcc80' : '#90caf9'};
    font-family: Arial, sans-serif;
    font-size: 14px;
    text-align: center;
    z-index: 9999;
  `;
  warningElement.textContent = message;
  
  // 添加关闭按钮
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = `
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: inherit;
    font-size: 18px;
    cursor: pointer;
  `;
  closeButton.onclick = function() {
    if (warningElement.parentNode) {
      warningElement.parentNode.removeChild(warningElement);
    }
  };
  
  warningElement.appendChild(closeButton);
  return warningElement;
}

/**
 * 在文档中显示浏览器警告
 * @param {string} message - 警告消息
 * @param {string} type - 警告类型 ('error', 'warning', 'info')
 */
export function showBrowserWarning(message, type = 'warning') {
  const warningElement = createBrowserWarning(message, type);
  
  if (document.body) {
    document.body.appendChild(warningElement);
  } else {
    window.addEventListener('DOMContentLoaded', function() {
      document.body.appendChild(warningElement);
    });
  }
} 