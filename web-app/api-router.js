/**
 * @file api-router.js
 * @description 统一API路由模块 - 食品溯源系统
 * @version 1.1.0
 * 
 * 功能:
 * - API端点注册与路由
 * - 请求参数验证
 * - 中间件支持
 * - 标准化响应格式
 * - 模拟数据支持
 * - API文档生成
 * - 版本化API支持
 */

const url = require('url');
const querystring = require('querystring');
const crypto = require('crypto');
const testData = require('./test-data');
const serverConfig = require('./server-config');

/**
 * 路由处理器类型定义
 * @typedef {function(Object, Object, function):void} RouteHandler
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {function} next - 下一个处理器函数
 */

// 存储中间状态（例如登录令牌）
const tokens = {};

/**
 * API路由管理类
 */
class ApiRouter {
  constructor() {
    this.routes = new Map();
    this.middlewares = [];
    this.errorHandlers = [];
    
    // API配置
    this.config = {
      prefix: '/api',
      version: 'v1',
      responseDelay: {
        enabled: false,
        min: 100,
        max: 1000
      },
      mockDelay: 300,
      cors: {
        enabled: true,
        allowOrigin: '*',
        allowMethods: 'GET, POST, PUT, DELETE, OPTIONS',
        allowHeaders: 'Content-Type, Authorization',
        maxAge: 86400
      }
    };

    // 从服务器配置加载
    if (serverConfig && typeof serverConfig.getSection === 'function') {
      const apiConfig = serverConfig.getSection('api');
      const corsConfig = serverConfig.getSection('cors');
      
      if (apiConfig) {
        this.config.prefix = apiConfig.prefix || this.config.prefix;
        this.config.version = apiConfig.version || this.config.version;
        this.config.responseDelay = apiConfig.responseDelay || this.config.responseDelay;
        this.config.mockDelay = apiConfig.mockDelay || this.config.mockDelay;
      }
      
      if (corsConfig) {
        this.config.cors = { ...this.config.cors, ...corsConfig };
      }
    }
  }
  
  /**
   * 初始化API路由
   * @param {Object} config - 服务器配置对象
   */
  init(config) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    // 设置路由
    this.setupRoutes();
    
    console.log(`API路由初始化完成，前缀: ${this.config.prefix}/${this.config.version}`);
    return this;
  }
  
  /**
   * 根据请求路径判断是否为API请求(带版本)
   * @param {string} reqUrl - 请求URL
   * @returns {boolean} 是否为API请求
   */
  isVersionedApiRequest(reqUrl) {
    return reqUrl.startsWith(`${this.config.prefix}/${this.config.version}/`);
  }
  
  /**
   * 根据请求路径判断是否为API请求(不带版本)
   * @param {string} reqUrl - 请求URL
   * @returns {boolean} 是否为API请求
   */
  isApiRequest(reqUrl) {
    return reqUrl.startsWith(`${this.config.prefix}/`);
  }
  
  /**
   * 从URL中提取API路径
   * @param {string} reqUrl - 完整URL
   * @returns {string} API路径（不含前缀和版本）
   */
  extractApiPath(reqUrl) {
    if (this.isVersionedApiRequest(reqUrl)) {
      const prefix = `${this.config.prefix}/${this.config.version}/`;
      return reqUrl.substring(prefix.length);
    } else {
      const prefix = `${this.config.prefix}/`;
      return reqUrl.substring(prefix.length);
    }
  }
  
  /**
   * 生成随机令牌
   * @returns {string} 随机生成的令牌
   */
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * 设置 API 路由
   */
  setupRoutes() {
    // 认证 API
    this.addRoute('POST', `${this.config.prefix}/auth/login`, this.handleLogin.bind(this));
    this.addRoute('POST', `${this.config.prefix}/auth/logout`, this.handleLogout.bind(this));
    this.addRoute('GET', `${this.config.prefix}/auth/status`, this.handleAuthStatus.bind(this));
    this.addRoute('POST', `${this.config.prefix}/auth/verify`, this.handleVerifyToken.bind(this));
    
    // 产品 API
    this.addRoute('GET', `${this.config.prefix}/products`, this.handleGetProducts.bind(this));
    this.addRoute('GET', `${this.config.prefix}/products/:id`, this.handleGetProduct.bind(this));
    this.addRoute('GET', `${this.config.prefix}/categories`, this.handleGetCategories.bind(this));
    
    // 溯源 API
    this.addRoute('GET', `${this.config.prefix}/trace/:id`, this.handleGetTrace.bind(this));
    this.addRoute('POST', `${this.config.prefix}/trace/:id/verify`, this.handleVerifyTrace.bind(this));
    
    // 用户 API
    this.addRoute('GET', `${this.config.prefix}/users/profile`, this.handleGetUserProfile.bind(this));
    this.addRoute('PUT', `${this.config.prefix}/users/profile`, this.handleUpdateUserProfile.bind(this));
    
    // 版本化API
    this.addRoute('GET', `${this.config.prefix}/${this.config.version}/products`, this.handleGetAllProducts.bind(this));
    this.addRoute('GET', `${this.config.prefix}/${this.config.version}/users/profile`, this.handleGetUserProfile.bind(this));
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
    const { method, url: reqUrl } = req;
    
    // 检查是否是API请求
    if (!this.isApiRequest(reqUrl)) {
      return false;
    }
    
    // 提取API路径
    const apiPath = this.extractApiPath(reqUrl);
    
    // 记录API请求
    console.log(`API请求: ${method} ${apiPath}`);
    
    try {
      // 解析请求路径和查询参数
      const urlObj = new URL(reqUrl, `http://${req.headers.host}`);
      const path = urlObj.pathname;
      const queryParams = {};
      
      // 处理查询参数
      for (const [key, value] of urlObj.searchParams.entries()) {
        queryParams[key] = value;
      }
      
      // 模拟网络延迟
      if (this.config.mockDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.config.mockDelay));
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
      }
      
      // 没有找到匹配的路由
      this.sendJSONResponse(res, 404, {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `未知的API路径: ${apiPath}`
        }
      });
      
      return true;
    } catch (error) {
      console.error('API 处理错误:', error);
      
      // 发送错误响应
      if (!res.headersSent) {
        this.sendJSONResponse(res, 500, {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error.message
          }
        });
      }
      
      return true;
    }
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
        
        // 防止请求体过大导致内存问题
        if (body.length > 1e6) {
          req.connection.destroy();
          reject(new Error('请求体过大'));
        }
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
          reject(new Error(`无效的JSON格式: ${error.message}`));
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
   * 从请求头中提取令牌
   * @param {Object} req - HTTP请求对象
   * @returns {string|null} 提取的令牌或null
   */
  extractToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    return authHeader.substring(7);
  }
  
  /**
   * 处理登录请求
   * @param {Object} context - 请求上下文
   */
  async handleLogin(context) {
    const { res, body } = context;
    const { username, password } = body;
    
    if (!username || !password) {
      this.sendJSONResponse(res, 400, {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '用户名和密码不能为空'
        }
      });
      return;
    }
    
    // 验证用户信息
    const user = testData.users.find(
      u => u.username === username && u.password === password
    );
    
    if (user) {
      // 生成令牌
      const token = this.generateToken();
      const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24小时后过期
      
      // 存储令牌
      tokens[token] = {
        userId: user.id,
        username: user.username,
        role: user.role,
        expiry
      };
      
      // 登录成功，返回用户信息和令牌
      const userData = { ...user };
      delete userData.password; // 不返回密码
      
      this.sendJSONResponse(res, 200, {
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role
          }
        }
      });
    } else {
      // 登录失败
      this.sendJSONResponse(res, 401, {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '用户名或密码错误'
        }
      });
    }
  }
  
  /**
   * 处理登出请求
   * @param {Object} context - 请求上下文
   */
  async handleLogout(context) {
    const { res, body } = context;
    const { token } = body;
    
    if (token && tokens[token]) {
      // 删除令牌
      delete tokens[token];
      
      this.sendJSONResponse(res, 200, {
        success: true,
        data: {
          message: '已成功登出'
        }
      });
    } else {
      this.sendJSONResponse(res, 200, {
        success: true,
        message: '已登出'
      });
    }
  }
  
  /**
   * 验证令牌
   * @param {Object} context - 请求上下文
   */
  async handleVerifyToken(context) {
    const { res, body } = context;
    const { token } = body;
    
    if (!token || !tokens[token]) {
      this.sendJSONResponse(res, 401, {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: '无效的令牌'
        }
      });
      return;
    }
    
    // 检查令牌是否过期
    if (tokens[token].expiry < Date.now()) {
      delete tokens[token];
      
      this.sendJSONResponse(res, 401, {
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: '令牌已过期'
        }
      });
      return;
    }
    
    // 返回令牌信息
    this.sendJSONResponse(res, 200, {
      success: true,
      data: {
        valid: true,
        userId: tokens[token].userId,
        username: tokens[token].username,
        role: tokens[token].role
      }
    });
  }
  
  /**
   * 处理认证状态请求
   * @param {Object} context - 请求上下文
   */
  async handleAuthStatus(context) {
    const { req, res } = context;
    const token = this.extractToken(req);
    
    if (token && tokens[token] && tokens[token].expiry >= Date.now()) {
      // 令牌有效
      const userId = tokens[token].userId;
      const user = testData.users.find(u => u.id === userId);
      
      if (user) {
        this.sendJSONResponse(res, 200, {
          authenticated: true,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role
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
   * 处理获取所有产品列表请求 (版本化API)
   * @param {Object} context - 请求上下文
   */
  async handleGetAllProducts(context) {
    const { res } = context;
    
    const productsList = Object.values(testData.getProducts()).map(product => ({
      id: product.id,
      name: product.name,
      category: product.category,
      origin: product.origin,
      producer: product.producer || '',
      productionDate: product.productionDate,
      expiryDate: product.expirationDate || product.expiryDate
    }));
    
    this.sendJSONResponse(res, 200, {
      success: true,
      data: productsList
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
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: `未找到ID为${productId}的产品`
        }
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
      categories: testData.productCategories || [
        { id: '水果', name: '水果' },
        { id: '蔬菜', name: '蔬菜' },
        { id: '肉类', name: '肉类' },
        { id: '海鲜', name: '海鲜' },
        { id: '乳制品', name: '乳制品' },
        { id: '谷物', name: '谷物' }
      ]
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
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: '产品不存在'
        }
      });
      return;
    }
    
    // 获取溯源信息
    const trace = testData.getTraceInfo ? testData.getTraceInfo(traceId) : 
                 (testData.getProductTraceRecords ? testData.getProductTraceRecords(traceId) : []);
    
    this.sendJSONResponse(res, 200, {
      success: true,
      productInfo: {
        id: product.id,
        name: product.name,
        category: product.category,
        origin: product.origin,
        productionDate: product.productionDate,
        expirationDate: product.expirationDate || product.expiryDate
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
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: '产品不存在'
        }
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
    const token = this.extractToken(req);
    
    if (!token || !tokens[token] || tokens[token].expiry < Date.now()) {
      this.sendJSONResponse(res, 401, {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未授权的访问'
        }
      });
      return;
    }
    
    // 获取用户信息
    const userId = tokens[token].userId;
    const user = testData.users.find(u => u.id === userId);
    
    if (!user) {
      this.sendJSONResponse(res, 404, {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在'
        }
      });
      return;
    }
    
    // 返回用户信息（排除密码）
    const { password, ...userProfile } = user;
    
    this.sendJSONResponse(res, 200, {
      success: true,
      data: userProfile
    });
  }
  
  /**
   * 处理更新用户资料请求
   * @param {Object} context - 请求上下文
   */
  async handleUpdateUserProfile(context) {
    const { req, res, body } = context;
    const token = this.extractToken(req);
    
    if (!token || !tokens[token] || tokens[token].expiry < Date.now()) {
      this.sendJSONResponse(res, 401, {
        success: false,
        error: {
          code: 'UNAUTHORIZED', 
          message: '未授权的访问'
        }
      });
      return;
    }
    
    // 获取用户信息
    const userId = tokens[token].userId;
    const userIndex = testData.users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      this.sendJSONResponse(res, 404, {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在'
        }
      });
      return;
    }
    
    // 模拟更新用户资料
    const updatedUser = { ...testData.users[userIndex], ...body };
    delete updatedUser.password; // 不返回密码
    
    this.sendJSONResponse(res, 200, {
      success: true,
      message: '资料更新成功',
      profile: updatedUser
    });
  }
}

// 创建默认API路由实例
const apiRouter = new ApiRouter();

// 添加默认CORS中间件
apiRouter.use((req, res, next) => {
  const corsConfig = apiRouter.config.cors;
  
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