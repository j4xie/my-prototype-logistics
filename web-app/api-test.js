/**
 * @file api-test.js
 * @description 测试API服务器 - 食品溯源系统
 * @version 1.0.0
 */

const http = require('http');
const url = require('url');
const testData = require('./test-data');

// 用于解析请求体的辅助函数
function parseRequestBody(req) {
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
    
    req.on('error', reject);
  });
}

// 用于发送 JSON 响应的辅助函数
function sendJSONResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// API 路由处理
const routes = {
  // 获取产品类别
  'GET /api/categories': (req, res) => {
    const categories = [
      { id: '水果', name: '水果' },
      { id: '蔬菜', name: '蔬菜' },
      { id: '肉类', name: '肉类' },
      { id: '海鲜', name: '海鲜' },
      { id: '乳制品', name: '乳制品' },
      { id: '谷物', name: '谷物' }
    ];
    
    sendJSONResponse(res, 200, { 
      success: true, 
      categories 
    });
  },
  
  // 获取产品列表
  'GET /api/products': (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const query = parsedUrl.query;
    
    // 解析查询参数
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const category = query.category || '';
    const origin = query.origin || '';
    const search = query.search || '';
    
    // 应用筛选条件
    const filters = {
      category: category,
      origin: origin,
      search: search
    };
    
    // 获取筛选后的产品列表
    const allProducts = testData.getAllProducts(filters);
    
    // 分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const products = allProducts.slice(startIndex, endIndex);
    const totalCount = allProducts.length;
    const totalPages = Math.ceil(totalCount / limit);
    
    sendJSONResponse(res, 200, {
      success: true,
      products,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages
      }
    });
  },
  
  // 获取产品详情
  'GET /api/products/': (req, res, params) => {
    const productId = params.id;
    
    if (!productId) {
      return sendJSONResponse(res, 400, {
        success: false,
        error: '缺少产品ID'
      });
    }
    
    const product = testData.getProductById(productId);
    
    if (!product) {
      return sendJSONResponse(res, 404, {
        success: false,
        error: '未找到产品'
      });
    }
    
    sendJSONResponse(res, 200, {
      success: true,
      product
    });
  },
  
  // 获取溯源记录
  'GET /api/trace/': (req, res, params) => {
    const productId = params.id;
    
    if (!productId) {
      return sendJSONResponse(res, 400, {
        success: false,
        error: '缺少产品ID'
      });
    }
    
    const records = testData.getProductTraceRecords(productId);
    
    sendJSONResponse(res, 200, {
      success: true,
      records
    });
  },
  
  // 登录验证
  'POST /api/auth/login': async (req, res) => {
    try {
      const body = await parseRequestBody(req);
      const { username, password } = body;
      
      if (!username || !password) {
        return sendJSONResponse(res, 400, {
          success: false,
          error: '用户名和密码不能为空'
        });
      }
      
      const user = testData.getTestUser(username, password);
      
      if (!user) {
        return sendJSONResponse(res, 401, {
          success: false,
          error: '用户名或密码不正确'
        });
      }
      
      // 模拟生成令牌
      const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
      
      sendJSONResponse(res, 200, {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role
        },
        token
      });
    } catch (error) {
      sendJSONResponse(res, 500, {
        success: false,
        error: '服务器错误'
      });
    }
  },
  
  // 认证状态
  'GET /api/auth/status': (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendJSONResponse(res, 401, {
        success: false,
        error: '未授权访问'
      });
    }
    
    // 模拟认证检查
    // 在实际应用中，应该验证令牌并查询用户信息
    sendJSONResponse(res, 200, {
      success: true,
      isAuthenticated: true,
      user: {
        id: 'admin123',
        username: 'admin',
        name: '系统管理员',
        role: 'admin'
      }
    });
  },
  
  // 登出
  'POST /api/auth/logout': (req, res) => {
    sendJSONResponse(res, 200, {
      success: true,
      message: '已成功登出'
    });
  }
};

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  // 添加 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;
  
  // 查找精确匹配的路由
  const routeKey = `${req.method} ${pathname}`;
  let handler = routes[routeKey];
  let params = {};
  
  // 如果没有精确匹配，尝试路径参数匹配
  if (!handler) {
    for (const route in routes) {
      const [routeMethod, routePath] = route.split(' ');
      
      // 检查 HTTP 方法是否匹配
      if (routeMethod !== req.method) {
        continue;
      }
      
      // 检查是否是带参数的路由 (以 / 结尾)
      if (!routePath.endsWith('/')) {
        continue;
      }
      
      // 检查前缀是否匹配
      if (pathname.startsWith(routePath)) {
        const paramId = pathname.substring(routePath.length);
        if (paramId) {
          handler = routes[route];
          params = { id: paramId };
          break;
        }
      }
    }
  }
  
  if (handler) {
    try {
      // 模拟网络延迟
      const delay = Math.floor(Math.random() * 100) + 100; // 100-200ms
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // 调用处理函数
      await handler(req, res, params);
    } catch (error) {
      console.error('API 处理错误:', error);
      sendJSONResponse(res, 500, {
        success: false,
        error: '服务器内部错误'
      });
    }
  } else {
    sendJSONResponse(res, 404, {
      success: false,
      error: '接口不存在'
    });
  }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`测试API服务器运行在 http://localhost:${PORT}`);
  console.log('可用接口:');
  console.log('- GET  /api/categories - 获取产品类别');
  console.log('- GET  /api/products - 获取产品列表');
  console.log('- GET  /api/products/:id - 获取产品详情');
  console.log('- GET  /api/trace/:id - 获取溯源记录');
  console.log('- POST /api/auth/login - 用户登录');
  console.log('- GET  /api/auth/status - 检查认证状态');
  console.log('- POST /api/auth/logout - 用户登出');
}); 