/**
 * @file tests/integration/api-router.test.js
 * @description API路由器集成测试
 */

// 导入API路由器
const apiRouter = require('../../api-router');
const mockFetch = require('./mock-server/mockFetch');

// 创建模拟请求和响应对象
function createMockReq(method, path, headers = {}) {
  return {
    method,
    url: path,
    headers: {
      host: 'localhost:8080',
      ...headers
    }
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(data) {
      this.data = data;
    }
  };
  return res;
}

describe('API路由器集成测试', () => {
  beforeAll(() => {
    // 初始化API路由器
    apiRouter.init();
    
    // 模拟全局fetch
    global.fetch = mockFetch;
  });
  
  test('应正确识别API请求', () => {
    // 测试API请求识别
    expect(apiRouter.isApiRequest('/api/products')).toBe(true);
    expect(apiRouter.isApiRequest('/api/v1/products')).toBe(true);
    expect(apiRouter.isApiRequest('/products')).toBe(false);
    expect(apiRouter.isApiRequest('/assets/images/logo.png')).toBe(false);
  });
  
  test('应能正确从URL中提取API路径', () => {
    // 测试API路径提取
    expect(apiRouter.extractApiPath('/api/products')).toBe('products');
    expect(apiRouter.extractApiPath('/api/v1/products')).toBe('products');
  });
  
  test('应能处理API请求并返回JSON数据', async () => {
    // 创建模拟请求和响应
    const req = createMockReq('GET', '/api/products');
    const res = createMockRes();
    
    // 处理请求
    await apiRouter.handleRequest(req, res);
    
    // 验证响应
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/json');
    
    // 解析响应数据
    const responseData = JSON.parse(res.data);
    expect(responseData).toBeDefined();
    expect(Array.isArray(responseData.products)).toBe(true);
  });
  
  test('应能处理不存在的API路径', async () => {
    // 创建模拟请求和响应
    const req = createMockReq('GET', '/api/not-exists');
    const res = createMockRes();
    
    // 处理请求
    await apiRouter.handleRequest(req, res);
    
    // 验证响应
    expect(res.statusCode).toBe(404);
    
    // 解析响应数据
    const responseData = JSON.parse(res.data);
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBeDefined();
  });
  
  test('应能处理API路径中的参数', async () => {
    // 创建模拟请求和响应 (带产品ID参数)
    const productId = 'P12345';
    const req = createMockReq('GET', `/api/products/${productId}`);
    const res = createMockRes();
    
    // 处理请求
    await apiRouter.handleRequest(req, res);
    
    // 验证响应
    expect(res.statusCode).toBe(200);
    
    // 解析响应数据
    const responseData = JSON.parse(res.data);
    
    // 数据可能为成功找到产品或未找到产品
    if (responseData.success) {
      expect(responseData.product).toBeDefined();
      expect(responseData.product.id).toBe(productId);
    } else {
      expect(responseData.error.code).toBe('PRODUCT_NOT_FOUND');
    }
  });
}); 