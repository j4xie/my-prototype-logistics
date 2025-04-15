/**
 * @file api-router.js
 * @description API路由模块 - 食品溯源系统
 * @version 1.0.0
 * 
 * 功能:
 * - API端点注册与路由
 * - 请求参数验证
 * - 中间件支持
 * - 标准化响应格式
 * - 模拟数据支持
 * - API文档生成
 */

const url = require('url');
const querystring = require('querystring');
const testData = require('./test-data');
const serverConfig = require('./server-config');

/**
 * 路由处理器类型定义
 * @typedef {function(Object, Object, function):void} RouteHandler
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {function} next - 下一个处理器函数
 */

/**
 * API路由管理类
 */
class ApiRouter {
  constructor() {
    this.routes = new Map();
    this.setupRoutes();
    
    this.middlewares = [];
    this.errorHandlers = [];
    
    // API配置
    this.config = {
      prefix: serverConfig.getSection('api').prefix || '/api',
      responseDelay: serverConfig.getSection('api').responseDelay || {
        enabled: false,
        min: 100,
        max: 1000
      }
    };
  }
  
  /**
   * 设置 API 路由
   */
  setupRoutes() {
    // 认证 API
    this.addRoute('POST', '/api/auth/login', this.handleLogin.bind(this));
    this.addRoute('POST', '/api/auth/logout', this.handleLogout.bind(this));
    this.addRoute('GET', '/api/auth/status', this.handleAuthStatus.bind(this));
    
    // 产品 API
    this.addRoute('GET', '/api/products', this.handleGetProducts.bind(this));
    this.addRoute('GET', '/api/products/:id', this.handleGetProduct.bind(this));
    this.addRoute('GET', '/api/categories', this.handleGetCategories.bind(this));
    
    // 溯源 API
    this.addRoute('GET', '/api/trace/:id', this.handleGetTrace.bind(this));
    this.addRoute('POST', '/api/trace/:id/verify', this.handleVerifyTrace.bind(this));
    
    // 用户 API
    this.addRoute('GET', '/api/users/profile', this.handleGetUserProfile.bind(this));
    this.addRoute('PUT', '/api/users/profile', this.handleUpdateUserProfile.bind(this));
  }
  
  /**
   * 添加路由
   * @param {string} method - HTTP 方法 (GET, POST 等)
   * @param {string} path - 路由路径
   * @param {Function} handler - 处理函数
   */
  addRoute(method, path, handler) {
    const routeKey = `${method.toUpperCase()}:${path}`;
    this.routes.set(routeKey, handler);
  }
  
  /**
   * 注册中间件
   * @param {RouteHandler} middleware - 中间件函数
   * @returns {ApiRouter} - 当前实例，支持链式调用
   */
  use(middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('中间件必须是函数');
    }
    
    this.middlewares.push(middleware);
    return this;
  }
  
  /**
   * 注册错误处理中间件
   * @param {function(Error, Object, Object, function):void} handler - 错误处理中间件
   * @returns {ApiRouter} - 当前实例，支持链式调用
   */
  onError(handler) {
    if (typeof handler !== 'function') {
      throw new Error('错误处理器必须是函数');
    }
    
    this.errorHandlers.push(handler);
    return this;
  }
  
  /**
   * 处理 API 请求
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @returns {Promise<boolean>} 如果处理了请求则返回 true，否则返回 false
   */
  async handleRequest(req, res) {
    const { method, url } = req;
    
    // 检查是否是 API 请求 (以 /api 开头)
    if (!url.startsWith('/api')) {
      return false;
    }
    
    // 解析请求路径和查询参数
    const urlObj = new URL(url, `http://${req.headers.host}`);
    const path = urlObj.pathname;
    const queryParams = {};
    
    // 处理查询参数
    for (const [key, value] of urlObj.searchParams.entries()) {
      queryParams[key] = value;
    }
    
    // 查找匹配的路由
    let handler = null;
    let pathParams = {};
    
    // 首先尝试精确匹配
    const exactRouteKey = `${method.toUpperCase()}:${path}`;
    handler = this.routes.get(exactRouteKey);
    
    // 如果没有找到精确匹配，尝试路径参数匹配
    if (!handler) {
      for (const [routeKey, routeHandler] of this.routes.entries()) {
        const [routeMethod, routePath] = routeKey.split(':');
        
        // 检查 HTTP 方法是否匹配
        if (routeMethod !== method.toUpperCase()) {
          continue;
        }
        
        // 检查是否是带参数的路由 (包含 :)
        if (!routePath.includes(':')) {
          continue;
        }
        
        // 转换路由路径为正则表达式
        const routeParts = routePath.split('/');
        const pathParts = path.split('/');
        
        // 路径段数必须相同
        if (routeParts.length !== pathParts.length) {
          continue;
        }
        
        // 检查每个路径段
        let match = true;
        const params = {};
        
        for (let i = 0; i < routeParts.length; i++) {
          const routePart = routeParts[i];
          const pathPart = pathParts[i];
          
          if (routePart.startsWith(':')) {
            // 这是一个参数
            const paramName = routePart.substring(1);
            params[paramName] = pathPart;
          } else if (routePart !== pathPart) {
            // 固定部分不匹配
            match = false;
            break;
          }
        }
        
        if (match) {
          handler = routeHandler;
          pathParams = params;
          break;
        }
      }
    }
    
    // 如果找到匹配的路由，处理请求
    if (handler) {
      try {
        // 解析请求体 (对于 POST, PUT 请求)
        let body = {};
        if (method === 'POST' || method === 'PUT') {
          body = await this.parseRequestBody(req);
        }
        
        // 创建请求上下文
        const context = {
          req,
          res,
          params: pathParams,
          query: queryParams,
          body
        };
        
        // 调用处理函数
        await handler(context);
        return true;
      } catch (error) {
        console.error('API 处理错误:', error);
        this.sendJSONResponse(res, 500, {
          error: 'Internal Server Error',
          message: error.message
        });
        return true;
      }
    }
    
    // 没有找到匹配的路由
    return false;
  }
  
  /**
   * 解析请求体
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 解析后的请求体
   */
  parseRequestBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          // 尝试解析为 JSON
          if (body && body.trim()) {
            resolve(JSON.parse(body));
          } else {
            resolve({});
          }
        } catch (error) {
          reject(error);
        }
      });
      
      req.on('error', error => {
        reject(error);
      });
    });
  }
  
  /**
   * 发送 JSON 响应
   * @param {Object} res - 响应对象
   * @param {number} statusCode - HTTP 状态码
   * @param {Object} data - 响应数据
   */
  sendJSONResponse(res, statusCode, data) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  }
  
  /**
   * 处理登录请求
   * @param {Object} context - 请求上下文
   */
  async handleLogin(context) {
    const { res, body } = context;
    const { username, password } = body;
    
    // 验证用户信息
    const user = testData.users.find(
      u => u.username === username && u.password === password
    );
    
    if (user) {
      // 登录成功，返回用户信息和令牌
      const userData = { ...user };
      delete userData.password; // 不返回密码
      
      this.sendJSONResponse(res, 200, {
        success: true,
        user: userData,
        token: 'mock-jwt-token-' + Date.now()
      });
    } else {
      // 登录失败
      this.sendJSONResponse(res, 401, {
        success: false,
        error: 'Invalid username or password'
      });
    }
  }
  
  /**
   * 处理登出请求
   * @param {Object} context - 请求上下文
   */
  async handleLogout(context) {
    const { res } = context;
    
    this.sendJSONResponse(res, 200, {
      success: true,
      message: 'Logged out successfully'
    });
  }
  
  /**
   * 处理认证状态请求
   * @param {Object} context - 请求上下文
   */
  async handleAuthStatus(context) {
    const { req, res } = context;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // 模拟令牌验证
      const token = authHeader.substring(7);
      
      // 这里应该有真正的令牌验证逻辑
      const isValid = token.startsWith('mock-jwt-token-');
      
      if (isValid) {
        this.sendJSONResponse(res, 200, {
          authenticated: true,
          user: {
            id: testData.users[0].id,
            username: testData.users[0].username,
            name: testData.users[0].name,
            role: testData.users[0].role
          }
        });
        return;
      }
    }
    
    this.sendJSONResponse(res, 401, {
      authenticated: false,
      message: 'Not authenticated'
    });
  }
  
  /**
   * 处理获取产品列表请求
   * @param {Object} context - 请求上下文
   */
  async handleGetProducts(context) {
    const { res, query } = context;
    let products = testData.getProducts();
    
    // 应用过滤器
    if (query.category) {
      products = products.filter(p => p.category === query.category);
    }
    
    if (query.origin) {
      products = products.filter(p => p.origin === query.origin);
    }
    
    // 应用分页
    let page = parseInt(query.page) || 1;
    let limit = parseInt(query.limit) || 10;
    
    // 确保页面和限制是有效的
    page = Math.max(1, page);
    limit = Math.min(50, Math.max(1, limit));
    
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedProducts = products.slice(startIndex, endIndex);
    
    this.sendJSONResponse(res, 200, {
      total: products.length,
      page,
      limit,
      totalPages: Math.ceil(products.length / limit),
      products: paginatedProducts
    });
  }
  
  /**
   * 处理获取单个产品请求
   * @param {Object} context - 请求上下文
   */
  async handleGetProduct(context) {
    const { res, params } = context;
    const productId = params.id;
    
    const products = testData.getProducts();
    const product = products.find(p => p.id === productId);
    
    if (product) {
      this.sendJSONResponse(res, 200, {
        success: true,
        product
      });
    } else {
      this.sendJSONResponse(res, 404, {
        success: false,
        error: 'Product not found'
      });
    }
  }
  
  /**
   * 处理获取产品类别请求
   * @param {Object} context - 请求上下文
   */
  async handleGetCategories(context) {
    const { res } = context;
    
    this.sendJSONResponse(res, 200, {
      success: true,
      categories: testData.productCategories
    });
  }
  
  /**
   * 处理获取溯源信息请求
   * @param {Object} context - 请求上下文
   */
  async handleGetTrace(context) {
    const { res, params } = context;
    const traceId = params.id;
    
    // 获取产品
    const products = testData.getProducts();
    const product = products.find(p => p.id === traceId);
    
    if (!product) {
      this.sendJSONResponse(res, 404, {
        success: false,
        error: 'Product not found'
      });
      return;
    }
    
    // 获取溯源信息
    const trace = testData.getTraceInfo(traceId);
    
    this.sendJSONResponse(res, 200, {
      success: true,
      productInfo: {
        id: product.id,
        name: product.name,
        category: product.category,
        origin: product.origin,
        productionDate: product.productionDate,
        expirationDate: product.expirationDate
      },
      traceInfo: trace
    });
  }
  
  /**
   * 处理验证溯源信息请求
   * @param {Object} context - 请求上下文
   */
  async handleVerifyTrace(context) {
    const { res, params } = context;
    const traceId = params.id;
    
    // 获取产品
    const products = testData.getProducts();
    const product = products.find(p => p.id === traceId);
    
    if (!product) {
      this.sendJSONResponse(res, 404, {
        success: false,
        error: 'Product not found'
      });
      return;
    }
    
    // 模拟验证
    this.sendJSONResponse(res, 200, {
      success: true,
      verified: true,
      verificationTimestamp: new Date().toISOString(),
      message: '溯源信息已通过验证，数据完整且真实。'
    });
  }
  
  /**
   * 处理获取用户资料请求
   * @param {Object} context - 请求上下文
   */
  async handleGetUserProfile(context) {
    const { req, res } = context;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.sendJSONResponse(res, 401, {
        success: false,
        error: 'Authentication required'
      });
      return;
    }
    
    // 模拟获取用户资料
    const user = { ...testData.users[0] };
    delete user.password;
    
    this.sendJSONResponse(res, 200, {
      success: true,
      profile: user
    });
  }
  
  /**
   * 处理更新用户资料请求
   * @param {Object} context - 请求上下文
   */
  async handleUpdateUserProfile(context) {
    const { req, res, body } = context;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.sendJSONResponse(res, 401, {
        success: false,
        error: 'Authentication required'
      });
      return;
    }
    
    // 模拟更新用户资料
    const updatedUser = { ...testData.users[0], ...body };
    delete updatedUser.password;
    
    this.sendJSONResponse(res, 200, {
      success: true,
      message: 'Profile updated successfully',
      profile: updatedUser
    });
  }
}

// 创建默认API路由实例
const apiRouter = new ApiRouter();

// 添加默认CORS中间件
apiRouter.use((req, res, next) => {
  const corsConfig = serverConfig.getSection('cors');
  
  if (corsConfig.enabled) {
    res.setHeader('Access-Control-Allow-Origin', corsConfig.allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', corsConfig.allowMethods);
    res.setHeader('Access-Control-Allow-Headers', corsConfig.allowHeaders);
    res.setHeader('Access-Control-Max-Age', corsConfig.maxAge.toString());
    
    // 对于CORS预检请求，直接返回200
    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      res.end();
      return;
    }
  }
  
  next();
});

// 导出API路由实例
module.exports = apiRouter; 