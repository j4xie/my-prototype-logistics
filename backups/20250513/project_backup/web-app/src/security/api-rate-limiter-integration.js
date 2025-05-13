/**
 * @file API限速器集成示例
 * @description 展示如何在实际项目中集成和使用API限速器
 * @version 1.0.0
 * @created 2025-07-22
 */

const { limitApiRequest, throttle, debounce } = require('./api-rate-limiter');

/**
 * API请求中间件 - 服务器端使用示例
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件函数
 */
function rateLimitMiddleware(req, res, next) {
  // 从请求中获取身份标识（IP地址、用户ID等）
  const identifier = req.user ? req.user.id : req.ip || req.headers['x-forwarded-for'];
  
  // 从请求路径获取端点
  const endpoint = req.path;
  
  // 根据端点类型设置不同的限制
  let options = {};
  
  if (endpoint.startsWith('/api/public')) {
    // 公共API使用较严格的限制
    options = {
      maxRequests: 30,
      timeWindowMs: 60000, // 每分钟30个请求
      tokensPerInterval: 1,
      intervalMs: 2000 // 每2秒恢复1个令牌
    };
  } else if (endpoint.startsWith('/api/user')) {
    // 用户API使用中等限制
    options = {
      maxRequests: 100,
      timeWindowMs: 60000, // 每分钟100个请求
      tokensPerInterval: 5,
      intervalMs: 3000 // 每3秒恢复5个令牌
    };
  } else if (endpoint.startsWith('/api/admin')) {
    // 管理员API使用较宽松的限制
    options = {
      maxRequests: 300,
      timeWindowMs: 60000, // 每分钟300个请求
      tokensPerInterval: 10,
      intervalMs: 2000 // 每2秒恢复10个令牌
    };
  } else {
    // 其他API使用默认限制
    options = {
      maxRequests: 60,
      timeWindowMs: 60000 // 每分钟60个请求
    };
  }
  
  // 检查请求是否在限制范围内
  const result = limitApiRequest(endpoint, identifier, options);
  
  if (!result.allowed) {
    // 如果超出限制，返回429状态码
    res.status(429).json({
      error: '请求过于频繁，请稍后再试',
      retryAfter: Math.ceil(result.resetTime / 1000) // 转换为秒
    });
    
    // 设置标准的响应头部
    res.set('Retry-After', Math.ceil(result.resetTime / 1000));
    res.set('X-RateLimit-Limit', result.limit);
    res.set('X-RateLimit-Remaining', result.remaining);
    res.set('X-RateLimit-Reset', Math.ceil(Date.now() + result.resetTime) / 1000);
    
    return;
  }
  
  // 设置信息性头部
  res.set('X-RateLimit-Limit', result.limit);
  res.set('X-RateLimit-Remaining', result.remaining);
  res.set('X-RateLimit-Reset', Math.ceil(Date.now() + result.resetTime) / 1000);
  
  // 继续处理请求
  next();
}

/**
 * 前端API客户端示例
 */
class ApiClient {
  constructor() {
    // 创建节流和防抖的API方法
    this.search = debounce(this._search.bind(this), 500);
    this.saveData = throttle(this._saveData.bind(this), 2000);
  }
  
  /**
   * 原始搜索方法（将被防抖包装）
   * @param {string} query - 搜索查询
   * @returns {Promise<Object>} 搜索结果
   * @private
   */
  async _search(query) {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      
      // 处理限速响应
      if (response.status === 429) {
        const data = await response.json();
        const retryAfter = response.headers.get('Retry-After') || 30;
        
        console.warn(`搜索请求被限速，${retryAfter}秒后重试`);
        return { error: '请求过于频繁', retryAfter };
      }
      
      return await response.json();
    } catch (error) {
      console.error('搜索请求失败', error);
      return { error: '搜索请求失败' };
    }
  }
  
  /**
   * 原始保存方法（将被节流包装）
   * @param {Object} data - 要保存的数据
   * @returns {Promise<Object>} 保存结果
   * @private
   */
  async _saveData(data) {
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      // 处理限速响应
      if (response.status === 429) {
        const result = await response.json();
        const retryAfter = response.headers.get('Retry-After') || 30;
        
        console.warn(`保存请求被限速，${retryAfter}秒后重试`);
        return { error: '请求过于频繁', retryAfter };
      }
      
      return await response.json();
    } catch (error) {
      console.error('保存请求失败', error);
      return { error: '保存请求失败' };
    }
  }
  
  /**
   * 检查当前API端点的限速状态
   * @param {string} endpoint - API端点
   * @returns {Promise<Object>} 限速状态
   */
  async checkRateLimitStatus(endpoint) {
    try {
      const response = await fetch(`/api/rate-limit-status?endpoint=${encodeURIComponent(endpoint)}`);
      const headers = {
        limit: response.headers.get('X-RateLimit-Limit'),
        remaining: response.headers.get('X-RateLimit-Remaining'),
        reset: response.headers.get('X-RateLimit-Reset')
      };
      
      return {
        ...headers,
        resetDate: headers.reset ? new Date(headers.reset * 1000).toLocaleString() : null
      };
    } catch (error) {
      console.error('检查限速状态失败', error);
      return { error: '检查限速状态失败' };
    }
  }
}

/**
 * 在Express服务器中注册限速中间件的示例
 * @param {Object} app - Express应用实例
 */
function setupRateLimiting(app) {
  // 为所有API路由添加限速
  app.use('/api', rateLimitMiddleware);
  
  // 或者为特定路由添加不同的限速设置
  app.use('/api/login', (req, res, next) => {
    const identifier = req.ip || req.headers['x-forwarded-for'];
    const endpoint = '/api/login';
    
    // 登录API使用更严格的限制
    const options = {
      maxRequests: 5,
      timeWindowMs: 60000, // 每分钟5次尝试
      tokensPerInterval: 1,
      intervalMs: 12000 // 每12秒恢复1个令牌
    };
    
    const result = limitApiRequest(endpoint, identifier, options);
    
    if (!result.allowed) {
      // 如果超出限制，返回429状态码
      return res.status(429).json({
        error: '登录尝试过于频繁，请稍后再试',
        retryAfter: Math.ceil(result.resetTime / 1000)
      });
    }
    
    next();
  });
  
  // 为文件上传API添加特殊限速
  app.use('/api/upload', (req, res, next) => {
    const identifier = req.user ? req.user.id : req.ip;
    const endpoint = '/api/upload';
    
    // 对于已登录和未登录用户使用不同限制
    const options = req.user ? {
      maxRequests: 10,
      timeWindowMs: 3600000 // 每小时10次上传
    } : {
      maxRequests: 3,
      timeWindowMs: 3600000 // 未登录用户每小时3次上传
    };
    
    const result = limitApiRequest(endpoint, identifier, options);
    
    if (!result.allowed) {
      return res.status(429).json({
        error: '上传次数已达上限，请稍后再试',
        retryAfter: Math.ceil(result.resetTime / 1000)
      });
    }
    
    next();
  });
}

module.exports = {
  rateLimitMiddleware,
  ApiClient,
  setupRateLimiting
}; 