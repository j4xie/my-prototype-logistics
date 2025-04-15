/**
 * 食品溯源系统 - API路由模块
 * 版本: 1.0.0
 * 
 * 此模块实现API路由处理，包括：
 * - 用户身份验证API
 * - 产品溯源数据API
 * - 系统管理API
 * - 模拟数据支持
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 模拟用户数据
const mockUsers = [
  { 
    id: 'u1001', 
    username: 'admin', 
    password: 'admin123', 
    role: 'admin',
    name: '管理员',
    email: 'admin@trace.example.com',
    permissions: ['read', 'write', 'admin'],
    lastLogin: '2023-05-10T08:30:15Z'
  },
  { 
    id: 'u1002', 
    username: 'user', 
    password: 'user123', 
    role: 'user',
    name: '普通用户',
    email: 'user@trace.example.com',
    permissions: ['read'],
    lastLogin: '2023-05-09T14:22:33Z'
  },
  { 
    id: 'u1003', 
    username: 'inspector', 
    password: 'inspect123', 
    role: 'inspector',
    name: '质检员',
    email: 'inspector@trace.example.com',
    permissions: ['read', 'inspect'],
    lastLogin: '2023-05-08T09:45:21Z'
  }
];

// 模拟产品溯源数据
const mockProducts = {
  'TR123456': { 
    id: 'TR123456',
    name: '有机西红柿',
    category: '蔬菜',
    origin: '山东省青岛市',
    producer: '青岛绿色农场',
    productionDate: '2023-04-28',
    expiryDate: '2023-05-15',
    batchNumber: 'B2023042801',
    certifications: ['有机认证', 'GAP认证'],
    trackingPoints: [
      { 
        timestamp: '2023-04-28T08:00:00Z', 
        location: '青岛绿色农场', 
        action: '收获', 
        operator: '张农民'
      },
      { 
        timestamp: '2023-04-28T14:30:00Z', 
        location: '青岛分拣中心', 
        action: '分拣包装', 
        operator: '李分拣'
      },
      { 
        timestamp: '2023-04-29T06:45:00Z', 
        location: '青岛物流中心', 
        action: '发货', 
        operator: '王物流'
      },
      { 
        timestamp: '2023-04-30T09:20:00Z', 
        location: '北京配送中心', 
        action: '到货', 
        operator: '赵配送'
      },
      { 
        timestamp: '2023-05-01T07:10:00Z', 
        location: '北京超市', 
        action: '上架', 
        operator: '钱售货'
      }
    ],
    qualityTests: [
      {
        testId: 'QT2023042801',
        testDate: '2023-04-28T10:30:00Z',
        testType: '农药残留',
        result: '合格',
        tester: '孙检测',
        details: '未检出违禁农药'
      }
    ]
  },
  'TR789012': { 
    id: 'TR789012',
    name: '生态猪肉',
    category: '肉类',
    origin: '黑龙江省哈尔滨市',
    producer: '黑龙江生态养殖场',
    productionDate: '2023-05-01',
    expiryDate: '2023-05-10',
    batchNumber: 'B2023050101',
    certifications: ['绿色食品认证', 'HACCP认证'],
    trackingPoints: [
      { 
        timestamp: '2023-05-01T09:15:00Z', 
        location: '黑龙江生态养殖场', 
        action: '屠宰', 
        operator: '周养殖'
      },
      { 
        timestamp: '2023-05-01T11:40:00Z', 
        location: '哈尔滨肉类加工中心', 
        action: '分割包装', 
        operator: '吴加工'
      },
      { 
        timestamp: '2023-05-01T16:20:00Z', 
        location: '哈尔滨冷链物流中心', 
        action: '冷链发货', 
        operator: '郑物流'
      },
      { 
        timestamp: '2023-05-03T08:50:00Z', 
        location: '北京冷链配送中心', 
        action: '到货', 
        operator: '冯配送'
      },
      { 
        timestamp: '2023-05-03T14:30:00Z', 
        location: '北京生鲜超市', 
        action: '冷柜上架', 
        operator: '陈售货'
      }
    ],
    qualityTests: [
      {
        testId: 'QT2023050102',
        testDate: '2023-05-01T10:15:00Z',
        testType: '微生物检测',
        result: '合格',
        tester: '徐检测',
        details: '未检出大肠杆菌等有害微生物'
      },
      {
        testId: 'QT2023050103',
        testDate: '2023-05-01T10:30:00Z',
        testType: '瘦肉精检测',
        result: '合格',
        tester: '徐检测',
        details: '未检出莱克多巴胺等违禁物质'
      }
    ]
  },
  'TR345678': { 
    id: 'TR345678',
    name: '纯天然蜂蜜',
    category: '蜜制品',
    origin: '云南省大理市',
    producer: '云南蜜蜂养殖合作社',
    productionDate: '2023-03-15',
    expiryDate: '2024-03-14',
    batchNumber: 'B2023031501',
    certifications: ['有机认证', 'ISO22000认证'],
    trackingPoints: [
      { 
        timestamp: '2023-03-15T08:30:00Z', 
        location: '云南蜜蜂养殖合作社', 
        action: '采集', 
        operator: '何养蜂'
      },
      { 
        timestamp: '2023-03-16T10:20:00Z', 
        location: '大理蜜制品加工厂', 
        action: '过滤灌装', 
        operator: '刘加工'
      },
      { 
        timestamp: '2023-03-17T09:40:00Z', 
        location: '大理物流中心', 
        action: '发货', 
        operator: '唐物流'
      },
      { 
        timestamp: '2023-03-20T14:10:00Z', 
        location: '广州配送中心', 
        action: '到货', 
        operator: '马配送'
      },
      { 
        timestamp: '2023-03-21T08:45:00Z', 
        location: '广州有机食品专卖店', 
        action: '上架', 
        operator: '龙售货'
      }
    ],
    qualityTests: [
      {
        testId: 'QT2023031601',
        testDate: '2023-03-16T09:15:00Z',
        testType: '农药残留',
        result: '合格',
        tester: '宋检测',
        details: '未检出农药残留'
      },
      {
        testId: 'QT2023031602',
        testDate: '2023-03-16T09:30:00Z',
        testType: '重金属检测',
        result: '合格',
        tester: '宋检测',
        details: '未检出重金属污染'
      },
      {
        testId: 'QT2023031603',
        testDate: '2023-03-16T09:45:00Z',
        testType: '成分分析',
        result: '合格',
        tester: '宋检测',
        details: '蜂蜜纯度95%以上，符合国家标准'
      }
    ]
  }
};

// 存储中间状态（例如登录令牌）
const tokens = {};

/**
 * 路由处理程序
 */
const apiRoutes = {
  /**
   * 初始化API路由
   * @param {Object} config - 服务器配置对象
   */
  init(config) {
    this.config = config || {};
    this.apiPrefix = this.config.api?.prefix || '/api';
    this.apiVersion = this.config.api?.version || 'v1';
    this.mockDelay = this.config.api?.mockDelay || 300;
    console.log(`API路由初始化完成，前缀: ${this.apiPrefix}/${this.apiVersion}`);
  },
  
  /**
   * 根据请求路径判断是否为API请求
   * @param {string} url - 请求URL
   * @returns {boolean} 是否为API请求
   */
  isApiRequest(url) {
    return url.startsWith(`${this.apiPrefix}/${this.apiVersion}/`);
  },
  
  /**
   * 从URL中提取API路径
   * @param {string} url - 完整URL
   * @returns {string} API路径（不含前缀和版本）
   */
  extractApiPath(url) {
    const prefix = `${this.apiPrefix}/${this.apiVersion}/`;
    return url.substring(prefix.length);
  },
  
  /**
   * 生成随机令牌
   * @returns {string} 随机生成的令牌
   */
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  },
  
  /**
   * 解析请求体
   * @param {Object} req - HTTP请求对象
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
          const data = body.trim().length > 0 ? JSON.parse(body) : {};
          resolve(data);
        } catch (err) {
          reject(new Error(`无效的JSON格式: ${err.message}`));
        }
      });
      
      req.on('error', err => {
        reject(err);
      });
    });
  },
  
  /**
   * 处理API请求
   * @param {Object} req - HTTP请求对象
   * @param {Object} res - HTTP响应对象
   * @returns {Promise<boolean>} 是否成功处理请求
   */
  async handleRequest(req, res) {
    // 检查是否是API请求
    if (!this.isApiRequest(req.url)) {
      return false;
    }
    
    // 提取API路径
    const apiPath = this.extractApiPath(req.url);
    
    // 记录API请求
    console.log(`API请求: ${req.method} ${apiPath}`);
    
    try {
      // 模拟网络延迟
      if (this.mockDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.mockDelay));
      }
      
      // 根据请求路径和方法分发到不同的处理程序
      let result;
      
      // 身份验证相关API
      if (apiPath === 'auth/login' && req.method === 'POST') {
        const body = await this.parseRequestBody(req);
        result = await this.handleLogin(body);
      }
      else if (apiPath === 'auth/logout' && req.method === 'POST') {
        const body = await this.parseRequestBody(req);
        result = await this.handleLogout(body);
      }
      else if (apiPath === 'auth/verify' && req.method === 'POST') {
        const body = await this.parseRequestBody(req);
        result = await this.handleVerifyToken(body);
      }
      // 用户相关API
      else if (apiPath === 'users/profile' && req.method === 'GET') {
        const token = this.extractToken(req);
        result = await this.handleGetUserProfile(token);
      }
      // 产品溯源相关API
      else if (apiPath.match(/^products\/\w+$/) && req.method === 'GET') {
        const productId = apiPath.split('/')[1];
        result = await this.handleGetProduct(productId);
      }
      else if (apiPath === 'products' && req.method === 'GET') {
        result = await this.handleGetAllProducts();
      }
      // 未知API路径
      else {
        result = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `未知的API路径: ${apiPath}`
          }
        };
        
        res.statusCode = 404;
      }
      
      // 设置CORS头部
      if (this.config.api?.cors) {
        res.setHeader('Access-Control-Allow-Origin', this.config.api.corsOrigin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      }
      
      // 发送响应
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
      
      return true;
    } catch (err) {
      // 处理错误
      console.error(`API错误: ${err.message}`);
      
      // 设置CORS头部
      if (this.config.api?.cors) {
        res.setHeader('Access-Control-Allow-Origin', this.config.api.corsOrigin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      }
      
      // 发送错误响应
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message
        }
      }));
      
      return true;
    }
  },
  
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
  },
  
  /**
   * 处理登录请求
   * @param {Object} data - 请求数据
   * @returns {Promise<Object>} 响应对象
   */
  async handleLogin(data) {
    const { username, password } = data;
    
    if (!username || !password) {
      return {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '用户名和密码不能为空'
        }
      };
    }
    
    // 查找匹配的用户
    const user = mockUsers.find(u => u.username === username && u.password === password);
    
    if (!user) {
      return {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '用户名或密码错误'
        }
      };
    }
    
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
    
    // 更新用户最后登录时间
    const userIndex = mockUsers.findIndex(u => u.id === user.id);
    if (userIndex >= 0) {
      mockUsers[userIndex].lastLogin = new Date().toISOString();
    }
    
    // 返回响应
    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          email: user.email,
          permissions: user.permissions
        }
      }
    };
  },
  
  /**
   * 处理登出请求
   * @param {Object} data - 请求数据
   * @returns {Promise<Object>} 响应对象
   */
  async handleLogout(data) {
    const { token } = data;
    
    if (!token || !tokens[token]) {
      return {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: '无效的令牌'
        }
      };
    }
    
    // 删除令牌
    delete tokens[token];
    
    // 返回响应
    return {
      success: true,
      data: {
        message: '已成功登出'
      }
    };
  },
  
  /**
   * 验证令牌
   * @param {Object} data - 请求数据
   * @returns {Promise<Object>} 响应对象
   */
  async handleVerifyToken(data) {
    const { token } = data;
    
    if (!token || !tokens[token]) {
      return {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: '无效的令牌'
        }
      };
    }
    
    // 检查令牌是否过期
    if (tokens[token].expiry < Date.now()) {
      delete tokens[token];
      
      return {
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: '令牌已过期'
        }
      };
    }
    
    // 返回令牌信息
    return {
      success: true,
      data: {
        valid: true,
        userId: tokens[token].userId,
        username: tokens[token].username,
        role: tokens[token].role
      }
    };
  },
  
  /**
   * 获取用户个人资料
   * @param {string} token - 认证令牌
   * @returns {Promise<Object>} 响应对象
   */
  async handleGetUserProfile(token) {
    if (!token || !tokens[token]) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未授权的访问'
        }
      };
    }
    
    // 检查令牌是否过期
    if (tokens[token].expiry < Date.now()) {
      delete tokens[token];
      
      return {
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: '令牌已过期'
        }
      };
    }
    
    // 获取用户信息
    const userId = tokens[token].userId;
    const user = mockUsers.find(u => u.id === userId);
    
    if (!user) {
      return {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在'
        }
      };
    }
    
    // 返回用户信息（排除密码）
    const { password, ...userProfile } = user;
    
    return {
      success: true,
      data: userProfile
    };
  },
  
  /**
   * 获取单个产品信息
   * @param {string} productId - 产品ID
   * @returns {Promise<Object>} 响应对象
   */
  async handleGetProduct(productId) {
    if (!productId || !mockProducts[productId]) {
      return {
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: `未找到ID为${productId}的产品`
        }
      };
    }
    
    return {
      success: true,
      data: mockProducts[productId]
    };
  },
  
  /**
   * 获取所有产品列表
   * @returns {Promise<Object>} 响应对象
   */
  async handleGetAllProducts() {
    const productsList = Object.values(mockProducts).map(product => ({
      id: product.id,
      name: product.name,
      category: product.category,
      origin: product.origin,
      producer: product.producer,
      productionDate: product.productionDate,
      expiryDate: product.expiryDate
    }));
    
    return {
      success: true,
      data: productsList
    };
  }
};

module.exports = apiRoutes; 