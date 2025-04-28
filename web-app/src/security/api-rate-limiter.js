/**
 * @file API限速器实现
 * @description 实现API请求限速、节流和防抖功能，保护API免受过度调用
 * @version 1.0.0
 * @created 2025-07-22
 */

/**
 * 令牌桶算法实现的限速器
 * @class
 */
class RateLimiter {
  /**
   * 创建新的限速器实例
   * @param {Object} options - 限速器配置选项
   * @param {number} options.maxRequests - 令牌桶容量（最大请求数）
   * @param {number} options.timeWindowMs - 时间窗口（毫秒）
   * @param {number} [options.tokensPerInterval=0] - 每个间隔添加的令牌数（0表示不自动添加）
   * @param {number} [options.intervalMs=1000] - 添加令牌的时间间隔（毫秒）
   */
  constructor(options) {
    this.maxRequests = options.maxRequests || 60;
    this.timeWindowMs = options.timeWindowMs || 60000; // 默认60秒
    this.tokensPerInterval = options.tokensPerInterval || 0;
    this.intervalMs = options.intervalMs || 1000; // 默认1秒
    
    this.tokens = this.maxRequests; // 初始令牌数为最大容量
    this.lastRefillTime = Date.now();
    this.resetTime = 0;
    this._refillInterval = null;
    
    // 如果配置了自动添加令牌，创建定时器
    if (this.tokensPerInterval > 0) {
      this._startPeriodicRefill();
    }
  }
  
  /**
   * 启动定期添加令牌的定时器
   * @private
   */
  _startPeriodicRefill() {
    if (this._refillInterval) {
      clearInterval(this._refillInterval);
    }
    
    this._refillInterval = setInterval(() => {
      this.addTokens(this.tokensPerInterval);
    }, this.intervalMs);
  }
  
  /**
   * 停止定期添加令牌的定时器
   * @public
   */
  stopPeriodicRefill() {
    if (this._refillInterval) {
      clearInterval(this._refillInterval);
      this._refillInterval = null;
    }
  }
  
  /**
   * 重新填充令牌桶
   * @private
   */
  _refill() {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillTime;
    
    if (elapsedMs >= this.timeWindowMs) {
      // 如果经过的时间大于等于时间窗口，完全重置令牌
      this.tokens = this.maxRequests;
      this.resetTime = 0;
    } else if (this.tokens < this.maxRequests && this.tokensPerInterval > 0 && this._refillInterval) {
      // 只有当定时器存在且令牌配置为自动添加时才添加令牌
      // 根据时间按比例添加令牌
      const tokensToAdd = Math.floor(elapsedMs / this.intervalMs) * this.tokensPerInterval;
      if (tokensToAdd > 0) {
        this.tokens = Math.min(this.maxRequests, this.tokens + tokensToAdd);
      }
      
      // 如果令牌未满，计算重置时间
      if (this.tokens < this.maxRequests) {
        const tokensNeeded = this.maxRequests - this.tokens;
        const intervalsNeeded = Math.ceil(tokensNeeded / this.tokensPerInterval);
        this.resetTime = intervalsNeeded * this.intervalMs;
      } else {
        this.resetTime = 0;
      }
    } else if (this.tokens < this.maxRequests) {
      // 没有配置自动添加令牌，计算到完全重置的剩余时间
      this.resetTime = this.timeWindowMs - elapsedMs;
    }
    
    this.lastRefillTime = now;
  }
  
  /**
   * 手动添加令牌到桶中
   * @param {number} count - 要添加的令牌数量
   * @returns {number} 添加后的令牌数量
   * @public
   */
  addTokens(count) {
    this._refill(); // 先进行自动添加
    this.tokens = Math.min(this.maxRequests, this.tokens + count);
    
    // 更新重置时间
    if (this.tokens < this.maxRequests) {
      const tokensNeeded = this.maxRequests - this.tokens;
      if (this.tokensPerInterval > 0 && this._refillInterval) {
        const intervalsNeeded = Math.ceil(tokensNeeded / this.tokensPerInterval);
        this.resetTime = intervalsNeeded * this.intervalMs;
      } else {
        this.resetTime = this.timeWindowMs - (Date.now() - this.lastRefillTime);
      }
    } else {
      this.resetTime = 0;
    }
    
    return this.tokens;
  }
  
  /**
   * 检查是否允许请求并消耗令牌
   * @returns {Object} 包含请求是否被允许、剩余令牌数和重置时间的对象
   * @public
   */
  checkAndConsume() {
    this._refill();
    
    const allowed = this.tokens > 0;
    if (allowed) {
      this.tokens--;
      
      // 更新重置时间
      if (this.tokens === 0) {
        if (this.tokensPerInterval > 0 && this._refillInterval) {
          this.resetTime = this.intervalMs;
        } else {
          this.resetTime = this.timeWindowMs;
        }
      }
    }
    
    return {
      allowed,
      remaining: this.tokens,
      limit: this.maxRequests,
      resetTime: this.resetTime
    };
  }
}

// 保存所有活跃限速器的映射
const limiters = new Map();

/**
 * 清理过期的限速器以防止内存泄漏
 * @private
 */
function _cleanupExpiredLimiters() {
  const now = Date.now();
  for (const [key, limiterData] of limiters.entries()) {
    const { limiter, lastAccess } = limiterData;
    
    // 如果限速器超过30分钟未使用，则移除它
    if (now - lastAccess > 30 * 60 * 1000) {
      limiter.stopPeriodicRefill();
      limiters.delete(key);
    }
  }
}

// 每10分钟清理一次过期的限速器
setInterval(_cleanupExpiredLimiters, 10 * 60 * 1000);

/**
 * 限制API请求，使用令牌桶算法
 * @param {string} endpoint - API端点标识符
 * @param {string} identifier - 请求方标识符（如用户ID或IP地址）
 * @param {Object} options - 限速配置选项
 * @param {number} [options.maxRequests=60] - 最大请求数量（令牌桶容量）
 * @param {number} [options.timeWindowMs=60000] - 时间窗口（毫秒）
 * @param {number} [options.tokensPerInterval=0] - 每个间隔添加的令牌数
 * @param {number} [options.intervalMs=1000] - 添加令牌的间隔（毫秒）
 * @returns {Object} 包含请求是否被允许、剩余令牌数和重置时间的对象
 * @public
 */
function limitApiRequest(endpoint, identifier, options = {}) {
  const key = `${endpoint}:${identifier}`;
  
  // 获取或创建限速器
  let limiterData = limiters.get(key);
  if (!limiterData) {
    limiterData = {
      limiter: new RateLimiter(options),
      lastAccess: Date.now()
    };
    limiters.set(key, limiterData);
  } else {
    limiterData.lastAccess = Date.now();
  }
  
  // 检查并消耗令牌
  return limiterData.limiter.checkAndConsume();
}

/**
 * 清除所有限速器
 * @public
 */
function clearAllLimiters() {
  for (const [, limiterData] of limiters.entries()) {
    limiterData.limiter.stopPeriodicRefill();
  }
  limiters.clear();
}

/**
 * 节流函数 - 限制函数在一定时间内最多执行一次
 * @param {Function} func - 要节流的函数
 * @param {number} wait - 等待时间（毫秒）
 * @param {Object} [options] - 配置选项
 * @param {boolean} [options.leading=true] - 是否在等待开始前调用
 * @param {boolean} [options.trailing=true] - 是否在等待结束后调用
 * @returns {Function} 节流后的函数
 * @public
 */
function throttle(func, wait, options = {}) {
  let timeout = null;
  let previous = 0;
  const { leading = true, trailing = true } = options;
  
  return function(...args) {
    const now = Date.now();
    
    if (!previous && leading === false) {
      previous = now;
    }
    
    const remaining = wait - (now - previous);
    
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      
      previous = now;
      func.apply(this, args);
    } else if (!timeout && trailing) {
      timeout = setTimeout(() => {
        previous = leading === false ? 0 : Date.now();
        timeout = null;
        func.apply(this, args);
      }, remaining);
    }
  };
}

/**
 * 防抖函数 - 延迟函数执行，如果指定时间内再次调用则重新计时
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @param {Object} [options] - 配置选项
 * @param {boolean} [options.leading=false] - 是否在等待开始前调用
 * @param {boolean} [options.trailing=true] - 是否在等待结束后调用
 * @param {number} [options.maxWait] - 最大等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 * @public
 */
function debounce(func, wait, options = {}) {
  let timeout = null;
  let lastArgs = null;
  let lastThis = null;
  let lastCallTime = 0;
  let lastInvokeTime = 0;
  let result = null;
  
  const { leading = false, trailing = true, maxWait = null } = options;
  
  // 检查是否有最大等待时间设置
  const shouldInvokeMax = function() {
    const timeSinceLastInvoke = Date.now() - lastInvokeTime;
    return maxWait !== null && timeSinceLastInvoke >= maxWait;
  };
  
  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;
    
    lastArgs = lastThis = null;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    
    return result;
  }
  
  function startTimer(pendingFunc, wait) {
    return setTimeout(pendingFunc, wait);
  }
  
  function cancelTimer() {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  }
  
  function trailingEdge(time) {
    timeout = null;
    
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    
    lastArgs = lastThis = null;
    return result;
  }
  
  function leadingEdge(time) {
    // 重置任何定时器
    lastCallTime = time;
    lastInvokeTime = time;
    timeout = startTimer(timerExpired, wait);
    
    // 如果设置了leading，立即调用
    return leading ? invokeFunc(time) : result;
  }
  
  function remainingWait(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeWaiting = wait - timeSinceLastCall;
    
    return maxWait !== null
      ? Math.min(timeWaiting, maxWait - (time - lastInvokeTime))
      : timeWaiting;
  }
  
  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    
    return (
      lastCallTime === 0 || // 首次调用
      timeSinceLastCall >= wait || // 超过等待时间
      shouldInvokeMax() // 超过最大等待时间
    );
  }
  
  function timerExpired() {
    const time = Date.now();
    
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    
    // 重启定时器以在下一个截止时间前调用
    timeout = startTimer(timerExpired, remainingWait(time));
  }
  
  return function(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);
    
    lastArgs = args;
    lastThis = this;
    lastCallTime = time;
    
    if (isInvoking) {
      if (timeout === null) {
        return leadingEdge(lastCallTime);
      }
      
      if (maxWait !== null) {
        // 处理同时进行的调用
        cancelTimer();
        timeout = startTimer(timerExpired, wait);
        return invokeFunc(lastCallTime);
      }
    }
    
    if (timeout === null) {
      timeout = startTimer(timerExpired, wait);
    }
    
    // 检查最大等待时间
    if (maxWait !== null && shouldInvokeMax()) {
      cancelTimer();
      return invokeFunc(time);
    }
    
    return result;
  };
}

module.exports = {
  RateLimiter,
  limitApiRequest,
  throttle,
  debounce,
  clearAllLimiters
}; 