/**
 * 本地服务器测试模块
 * 测试静态文件服务、API请求处理和错误处理功能
 */

const path = require('path');
const fs = require('fs').promises;
const http = require('http');
const { EventEmitter } = require('events');

// 模拟模块
jest.mock('http', () => {
  const mockServer = new EventEmitter();
  mockServer.listen = jest.fn((port, callback) => {
    callback && callback();
    return mockServer;
  });
  mockServer.close = jest.fn(callback => {
    callback && callback();
    return mockServer;
  });
  
  return {
    createServer: jest.fn(() => mockServer),
    Server: jest.fn().mockImplementation(() => mockServer)
  };
});

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      readFile: jest.fn(),
      stat: jest.fn(),
      readdir: jest.fn()
    }
  };
});

// 测试路径解析
describe('LocalServer 路径解析', () => {
  let LocalServer;
  let server;
  
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    LocalServer = require('../../../local-server');
    server = new LocalServer({
      port: 8080,
      rootDir: '/test-root',
      apiPrefix: '/api'
    });
  });
  
  test('应正确解析文件路径', () => {
    const filePath = server.resolveFilePath('/index.html');
    expect(filePath).toBe(path.join('/test-root', 'index.html'));
    
    const cssPath = server.resolveFilePath('/css/style.css');
    expect(cssPath).toBe(path.join('/test-root', 'css/style.css'));
  });
  
  test('应处理路径遍历攻击', () => {
    const maliciousPath = server.resolveFilePath('/../../../etc/passwd');
    expect(maliciousPath).not.toContain('../');
    expect(path.normalize(maliciousPath)).not.toContain('/etc/passwd');
  });
  
  test('应正确识别API请求', () => {
    expect(server.isApiRequest('/api/users')).toBe(true);
    expect(server.isApiRequest('/api/products')).toBe(true);
    expect(server.isApiRequest('/static/image.jpg')).toBe(false);
  });
});

// 测试静态文件服务
describe('LocalServer 静态文件服务', () => {
  let LocalServer;
  let server;
  
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    LocalServer = require('../../../local-server');
    server = new LocalServer({
      port: 8080,
      rootDir: '/test-root',
      apiPrefix: '/api'
    });
    
    // 模拟请求和响应对象
    server.req = {
      url: '/index.html',
      method: 'GET',
      headers: {}
    };
    
    server.res = {
      statusCode: 200,
      headers: {},
      setHeader: jest.fn(),
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn()
    };
  });
  
  test('应提供HTML文件并设置正确的内容类型', async () => {
    fs.promises.readFile.mockResolvedValue(Buffer.from('<html><body>Test</body></html>'));
    fs.promises.stat.mockResolvedValue({ isDirectory: () => false, size: 100, mtime: new Date() });
    
    server.req.url = '/index.html';
    await server.serveStaticFile(server.req, server.res, '/index.html');
    
    expect(fs.promises.readFile).toHaveBeenCalled();
    expect(server.res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
    expect(server.res.end).toHaveBeenCalled();
  });
  
  test('应提供CSS文件并设置正确的内容类型', async () => {
    fs.promises.readFile.mockResolvedValue(Buffer.from('body { color: red; }'));
    fs.promises.stat.mockResolvedValue({ isDirectory: () => false, size: 100, mtime: new Date() });
    
    server.req.url = '/css/style.css';
    await server.serveStaticFile(server.req, server.res, '/css/style.css');
    
    expect(fs.promises.readFile).toHaveBeenCalled();
    expect(server.res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/css; charset=utf-8');
    expect(server.res.end).toHaveBeenCalled();
  });
  
  test('应处理文件不存在的情况', async () => {
    fs.promises.stat.mockRejectedValue(new Error('ENOENT: not found'));
    
    server.req.url = '/not-found.html';
    await server.serveStaticFile(server.req, server.res, '/not-found.html');
    
    expect(server.res.statusCode).toBe(404);
    expect(server.res.end).toHaveBeenCalled();
  });
  
  test('应处理目录请求并默认到index.html', async () => {
    fs.promises.stat.mockResolvedValueOnce({ isDirectory: () => true });
    fs.promises.stat.mockResolvedValueOnce({ isDirectory: () => false, size: 100, mtime: new Date() });
    fs.promises.readFile.mockResolvedValue(Buffer.from('<html><body>Index Page</body></html>'));
    
    server.req.url = '/';
    await server.serveStaticFile(server.req, server.res, '/');
    
    expect(fs.promises.readFile).toHaveBeenCalledWith(expect.stringContaining('index.html'), expect.anything());
    expect(server.res.end).toHaveBeenCalled();
  });
});

// 测试API请求处理
describe('LocalServer API请求处理', () => {
  let LocalServer;
  let server;
  let mockApiRouter;
  
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    // 创建模拟API路由器
    mockApiRouter = {
      handle: jest.fn(),
      get: jest.fn(),
      post: jest.fn()
    };
    
    // 模拟API路由器
    jest.mock('../../../api-router', () => {
      return jest.fn().mockImplementation(() => mockApiRouter);
    });
    
    LocalServer = require('../../../local-server');
    server = new LocalServer({
      port: 8080,
      rootDir: '/test-root',
      apiPrefix: '/api'
    });
    
    // 模拟请求和响应对象
    server.req = {
      url: '/api/users',
      method: 'GET',
      headers: {}
    };
    
    server.res = {
      statusCode: 200,
      headers: {},
      setHeader: jest.fn(),
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn()
    };
  });
  
  test('应将API请求传递给API路由器', async () => {
    server.req.url = '/api/users';
    await server.handleApiRequest(server.req, server.res);
    
    expect(mockApiRouter.handle).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/users' }),
      expect.anything()
    );
  });
  
  test('应处理API路由器中的错误', async () => {
    mockApiRouter.handle.mockImplementation(() => {
      throw new Error('API处理错误');
    });
    
    server.req.url = '/api/broken';
    await server.handleApiRequest(server.req, server.res);
    
    expect(server.res.statusCode).toBe(500);
    expect(server.res.end).toHaveBeenCalled();
  });
});

// 测试服务器启动和停止
describe('LocalServer 启动和停止', () => {
  let LocalServer;
  let server;
  
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    LocalServer = require('../../../local-server');
    server = new LocalServer({
      port: 8080,
      rootDir: '/test-root',
      apiPrefix: '/api'
    });
  });
  
  test('应成功启动服务器', async () => {
    await server.start();
    expect(http.createServer).toHaveBeenCalled();
    expect(http.createServer().listen).toHaveBeenCalledWith(
      8080,
      expect.any(Function)
    );
  });
  
  test('应成功停止服务器', async () => {
    await server.start();
    await server.stop();
    expect(http.createServer().close).toHaveBeenCalled();
  });
  
  test('重复启动应该报错', async () => {
    await server.start();
    server.running = true;  // 模拟服务器已经在运行
    
    await expect(server.start()).rejects.toThrow();
  });
  
  test('未启动时停止应该报错', async () => {
    server.running = false;  // 确保服务器未运行
    
    await expect(server.stop()).rejects.toThrow();
  });
});

// 测试HTTP请求处理
describe('LocalServer HTTP请求处理', () => {
  let LocalServer;
  let server;
  
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    LocalServer = require('../../../local-server');
    server = new LocalServer({
      port: 8080,
      rootDir: '/test-root',
      apiPrefix: '/api'
    });
    
    // Spy和模拟处理方法
    server.serveStaticFile = jest.fn();
    server.handleApiRequest = jest.fn();
    server.handleNotFound = jest.fn();
  });
  
  test('应处理静态文件请求', async () => {
    const req = { url: '/index.html', method: 'GET', headers: {} };
    const res = { setHeader: jest.fn(), end: jest.fn() };
    
    await server.handleRequest(req, res);
    
    expect(server.serveStaticFile).toHaveBeenCalled();
    expect(server.handleApiRequest).not.toHaveBeenCalled();
  });
  
  test('应处理API请求', async () => {
    const req = { url: '/api/users', method: 'GET', headers: {} };
    const res = { setHeader: jest.fn(), end: jest.fn() };
    
    await server.handleRequest(req, res);
    
    expect(server.handleApiRequest).toHaveBeenCalled();
    expect(server.serveStaticFile).not.toHaveBeenCalled();
  });
  
  test('应处理未找到的路径', async () => {
    server.serveStaticFile.mockImplementation(() => {
      const error = new Error('Not Found');
      error.code = 'ENOENT';
      throw error;
    });
    
    const req = { url: '/not-exists.html', method: 'GET', headers: {} };
    const res = { statusCode: 200, setHeader: jest.fn(), end: jest.fn() };
    
    await server.handleRequest(req, res);
    
    expect(server.serveStaticFile).toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
  });
  
  test('应处理内部服务器错误', async () => {
    server.serveStaticFile.mockImplementation(() => {
      throw new Error('Internal Error');
    });
    
    const req = { url: '/error.html', method: 'GET', headers: {} };
    const res = { statusCode: 200, setHeader: jest.fn(), end: jest.fn() };
    
    await server.handleRequest(req, res);
    
    expect(server.serveStaticFile).toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
  });
});

// 测试配置和选项
describe('LocalServer 配置和选项', () => {
  let LocalServer;
  
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    LocalServer = require('../../../local-server');
  });
  
  test('应使用默认配置', () => {
    const server = new LocalServer();
    
    expect(server.port).toBeGreaterThan(0);
    expect(server.rootDir).toBeDefined();
    expect(server.apiPrefix).toBe('/api');
  });
  
  test('应应用自定义配置', () => {
    const server = new LocalServer({
      port: 9090,
      rootDir: '/custom-root',
      apiPrefix: '/custom-api',
      corsEnabled: true,
      cacheEnabled: false
    });
    
    expect(server.port).toBe(9090);
    expect(server.rootDir).toBe('/custom-root');
    expect(server.apiPrefix).toBe('/custom-api');
    expect(server.corsEnabled).toBe(true);
    expect(server.cacheEnabled).toBe(false);
  });
}); 