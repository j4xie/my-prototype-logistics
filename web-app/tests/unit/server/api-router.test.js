/**
 * API路由器测试模块
 * 测试路由注册、参数解析和中间件功能
 */

const ApiRouter = require('../../../api-router');

// 创建模拟请求对象
const createMockRequest = (method, url, params = {}, body = {}, headers = {}) => {
  const [path, queryString] = url.split('?');
  const query = {};
  
  if (queryString) {
    queryString.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      query[key] = value;
    });
  }
  
  return {
    method,
    url,
    path,
    params: { ...params },
    query,
    body,
    headers,
    cookies: {},
  };
};

// 创建模拟响应对象
const createMockResponse = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    
    status(code) {
      this.statusCode = code;
      return this;
    },
    
    json(data) {
      this.body = data;
      this.headers['Content-Type'] = 'application/json';
      return this;
    },
    
    send(data) {
      this.body = data;
      return this;
    },
    
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    
    end(data) {
      if (data) this.body = data;
      return this;
    }
  };
  
  return res;
};

describe('API Router', () => {
  // 基本功能测试
  describe('Basic Functionality', () => {
    test('应该能创建API路由器实例', () => {
      const router = new ApiRouter();
      expect(router).toBeDefined();
      expect(typeof router.get).toBe('function');
      expect(typeof router.post).toBe('function');
      expect(typeof router.handle).toBe('function');
    });
    
    test('应该能处理GET请求', async () => {
      const router = new ApiRouter();
      const handler = jest.fn((req, res) => res.json({ success: true }));
      
      router.get('/test', handler);
      
      const req = createMockRequest('GET', '/test');
      const res = createMockResponse();
      
      await router.handle(req, res);
      
      expect(handler).toHaveBeenCalledWith(req, res, expect.any(Function));
      expect(res.body).toEqual({ success: true });
    });
    
    test('应该能处理POST请求', async () => {
      const router = new ApiRouter();
      const handler = jest.fn((req, res) => res.json({ success: true }));
      
      router.post('/test', handler);
      
      const req = createMockRequest('POST', '/test', {}, { data: 'test data' });
      const res = createMockResponse();
      
      await router.handle(req, res);
      
      expect(handler).toHaveBeenCalledWith(req, res, expect.any(Function));
      expect(res.body).toEqual({ success: true });
    });
    
    test('应该能处理未匹配的路由', async () => {
      const router = new ApiRouter();
      const req = createMockRequest('GET', '/not-found');
      const res = createMockResponse();
      
      await router.handle(req, res);
      
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });
  
  // 路由注册测试
  describe('Route Registration', () => {
    test('应该能正确匹配注册的路由', async () => {
      const router = new ApiRouter();
      
      router.get('/users', (req, res) => res.json({ route: 'users' }));
      router.get('/products', (req, res) => res.json({ route: 'products' }));
      
      const req1 = createMockRequest('GET', '/users');
      const res1 = createMockResponse();
      
      await router.handle(req1, res1);
      expect(res1.body).toEqual({ route: 'users' });
      
      const req2 = createMockRequest('GET', '/products');
      const res2 = createMockResponse();
      
      await router.handle(req2, res2);
      expect(res2.body).toEqual({ route: 'products' });
    });
    
    test('应该能正确区分HTTP方法', async () => {
      const router = new ApiRouter();
      
      router.get('/api', (req, res) => res.json({ method: 'GET' }));
      router.post('/api', (req, res) => res.json({ method: 'POST' }));
      
      const req1 = createMockRequest('GET', '/api');
      const res1 = createMockResponse();
      
      await router.handle(req1, res1);
      expect(res1.body).toEqual({ method: 'GET' });
      
      const req2 = createMockRequest('POST', '/api');
      const res2 = createMockResponse();
      
      await router.handle(req2, res2);
      expect(res2.body).toEqual({ method: 'POST' });
    });
  });
  
  // 路径参数测试
  describe('Path Parameters', () => {
    test('应该能解析路径参数', async () => {
      const router = new ApiRouter();
      
      router.get('/users/:id', (req, res) => {
        res.json({ id: req.params.id });
      });
      
      const req = createMockRequest('GET', '/users/123');
      const res = createMockResponse();
      
      await router.handle(req, res);
      
      expect(res.body).toEqual({ id: '123' });
    });
    
    test('应该能解析多个路径参数', async () => {
      const router = new ApiRouter();
      
      router.get('/users/:userId/posts/:postId', (req, res) => {
        res.json({
          userId: req.params.userId,
          postId: req.params.postId
        });
      });
      
      const req = createMockRequest('GET', '/users/123/posts/456');
      const res = createMockResponse();
      
      await router.handle(req, res);
      
      expect(res.body).toEqual({
        userId: '123',
        postId: '456'
      });
    });
  });
  
  // 查询参数测试
  describe('Query Parameters', () => {
    test('应该能解析查询参数', async () => {
      const router = new ApiRouter();
      
      router.get('/search', (req, res) => {
        res.json({ query: req.query });
      });
      
      const req = createMockRequest('GET', '/search?q=test&page=1&limit=10');
      const res = createMockResponse();
      
      await router.handle(req, res);
      
      expect(res.body).toEqual({
        query: {
          q: 'test',
          page: '1',
          limit: '10'
        }
      });
    });
  });
  
  // 中间件测试
  describe('Middleware', () => {
    test('应该能正确执行中间件', async () => {
      const router = new ApiRouter();
      const middleware = jest.fn((req, res, next) => {
        req.middlewareExecuted = true;
        next();
      });
      
      router.use(middleware);
      router.get('/test', (req, res) => {
        res.json({ middlewareExecuted: req.middlewareExecuted });
      });
      
      const req = createMockRequest('GET', '/test');
      const res = createMockResponse();
      
      await router.handle(req, res);
      
      expect(middleware).toHaveBeenCalled();
      expect(res.body).toEqual({ middlewareExecuted: true });
    });
    
    test('应该能执行多个中间件', async () => {
      const router = new ApiRouter();
      const middleware1 = jest.fn((req, res, next) => {
        req.m1 = true;
        next();
      });
      
      const middleware2 = jest.fn((req, res, next) => {
        req.m2 = true;
        next();
      });
      
      router.use(middleware1);
      router.use(middleware2);
      router.get('/test', (req, res) => {
        res.json({ m1: req.m1, m2: req.m2 });
      });
      
      const req = createMockRequest('GET', '/test');
      const res = createMockResponse();
      
      await router.handle(req, res);
      
      expect(middleware1).toHaveBeenCalled();
      expect(middleware2).toHaveBeenCalled();
      expect(res.body).toEqual({ m1: true, m2: true });
    });
    
    test('中间件应该能终止请求处理', async () => {
      const router = new ApiRouter();
      const middleware = jest.fn((req, res, next) => {
        res.status(403).json({ error: 'Forbidden' });
        // 不调用next()，结束处理
      });
      
      const handler = jest.fn((req, res) => {
        res.json({ success: true });
      });
      
      router.use(middleware);
      router.get('/test', handler);
      
      const req = createMockRequest('GET', '/test');
      const res = createMockResponse();
      
      await router.handle(req, res);
      
      expect(middleware).toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: 'Forbidden' });
    });
  });
  
  // 错误处理测试
  describe('Error Handling', () => {
    test('应该处理路由处理器中的同步错误', async () => {
      const router = new ApiRouter();
      
      router.get('/error', (req, res) => {
        throw new Error('Test error');
      });
      
      const req = createMockRequest('GET', '/error');
      const res = createMockResponse();
      
      await router.handle(req, res);
      
      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
    
    test('应该处理路由处理器中的异步错误', async () => {
      const router = new ApiRouter();
      
      router.get('/async-error', async (req, res) => {
        await Promise.resolve();
        throw new Error('Async test error');
      });
      
      const req = createMockRequest('GET', '/async-error');
      const res = createMockResponse();
      
      await router.handle(req, res);
      
      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
    
    test('应该能注册自定义错误处理器', async () => {
      const router = new ApiRouter();
      const errorHandler = jest.fn((err, req, res, next) => {
        res.status(500).json({
          customError: true,
          message: err.message
        });
      });
      
      router.use((req, res, next) => next());
      router.get('/error', () => {
        throw new Error('Custom handler test');
      });
      router.useErrorHandler(errorHandler);
      
      const req = createMockRequest('GET', '/error');
      const res = createMockResponse();
      
      await router.handle(req, res);
      
      expect(errorHandler).toHaveBeenCalled();
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({
        customError: true,
        message: 'Custom handler test'
      });
    });
  });
}); 