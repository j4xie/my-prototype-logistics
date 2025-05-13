/**
 * 食品溯源系统 - 本地HTTP服务器模块
 * 版本: 1.0.0
 * 
 * 此模块提供本地HTTP服务器功能，用于：
 * - 处理静态文件请求
 * - 转发API请求到API路由模块
 * - 提供开发环境支持
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const url = require('url');

// 导入新模块 (如果存在则使用，不存在则使用默认配置)
let apiRouter, serverConfig;
try {
  // 尝试导入API路由模块
  apiRouter = require('./api-router');
} catch (error) {
  console.log('API路由模块未找到，使用默认路由处理。');
  apiRouter = null;
}

try {
  // 尝试导入服务器配置模块
  const configModule = require('./server-config');
  serverConfig = configModule.serverConfig;
} catch (error) {
  console.log('服务器配置模块未找到，使用默认配置。');
  serverConfig = null;
}

// MIME类型映射
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm',
  '.ico': 'image/x-icon'
};

/**
 * 本地HTTP服务器
 */
const localServer = {
  server: null,
  config: null,
  isRunning: false,
  startTime: null,
  requestsServed: 0,
  
  /**
   * 初始化服务器
   * @param {Object} [customConfig=null] - 自定义配置对象
   * @returns {Object} 服务器实例
   */
  init(customConfig = null) {
    // 设置默认配置
    const defaultOptions = {
      port: 8080,
      host: 'localhost',
      root: './',
      mode: 'development',
      timeout: 30000,
      caching: true,
      etag: true,
      compression: true,
      cacheMaxAge: 3600,
      serveSinglePageApp: true
    };
    
    // 加载和合并配置
    this.config = customConfig || defaultOptions;
    
    // 如果存在服务器配置模块，使用它来合并配置
    if (serverConfig && typeof serverConfig.getConfig === 'function') {
      try {
        const configFromModule = serverConfig.getConfig();
        this.config = { ...this.config, ...configFromModule };
      } catch (error) {
        console.warn('使用服务器配置模块获取配置失败，使用默认配置。');
      }
    }
    
    // 如果存在API路由模块，进行初始化
    if (apiRouter && typeof apiRouter.init === 'function') {
      try {
        apiRouter.init(this.config);
      } catch (error) {
        console.warn('初始化API路由模块失败:', error.message);
      }
    }
    
    // 初始化统计信息
    this.startTime = null;
    this.requestsServed = 0;
    this.isRunning = false;
    
    console.log('本地服务器初始化完成');
    
    return this;
  },
  
  /**
   * 启动服务器
   * @param {Object} options - 启动选项
   */
  async start(options = {}) {
    // 合并默认选项和自定义选项
    const config = { ...this.config, ...options };
    this.config = config;
    
    try {
      // 创建HTTP服务器
      this.server = http.createServer(this.handleRequest.bind(this));
      
      // 设置超时时间
      this.server.timeout = config.timeout;
      
      // 使用配置的端口或查找可用端口
      let port = config.port;
      
      // 如果有serverConfig模块，使用它来查找可用端口
      if (serverConfig) {
        try {
          port = await serverConfig.findAvailablePort();
          console.log(`使用服务器配置模块找到可用端口: ${port}`);
        } catch (portError) {
          console.warn(`查找可用端口失败: ${portError.message}`);
          // 回退到默认端口
        }
      }
      
      // 启动服务器
      this.server.listen(port, config.host, () => {
        const address = this.server.address();
        this.startTime = Date.now();
        
        console.log(`本地开发服务器启动成功:`);
        console.log(`- 地址: http://${config.host}:${address.port}`);
        console.log(`- 模式: ${config.mode}`);
        console.log(`- 根目录: ${path.resolve(config.root)}`);
        
        // 如果有API路由，显示可用的API路径
        if (apiRouter) {
          console.log(`- API前缀: ${apiRouter.config.prefix}`);
        }
        
        // 如果有serverConfig模块，设置启动时间
        if (serverConfig) {
          serverConfig.setStartTime();
        }
      });
      
      // 错误处理
      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`端口 ${port} 已被占用.`);
          
          if (serverConfig) {
            console.log('尝试使用其他端口...');
            // 递归调用，尝试其他端口
            this.start(options);
          } else {
            console.error('请尝试使用其他端口.');
          }
        } else {
          console.error(`服务器错误: ${err.message}`);
        }
      });
    } catch (error) {
      console.error(`启动服务器失败: ${error.message}`);
      throw error;
    }
  },
  
  /**
   * 停止服务器
   * @returns {Promise<Object>} 包含停止结果的Promise
   */
  stop() {
    return new Promise((resolve, reject) => {
      if (!this.isRunning || !this.server) {
        resolve({
          success: true,
          message: '服务器未运行'
        });
        return;
      }
      
      try {
        this.server.close(err => {
          if (err) {
            console.error('停止服务器时出错:', err);
            reject(err);
            return;
          }
          
          this.isRunning = false;
          this.server = null;
          
          console.log('服务器已停止');
          resolve({
            success: true,
            message: '服务器已停止'
          });
        });
      } catch (err) {
        console.error('停止服务器时出错:', err);
        reject(err);
      }
    });
  },
  
  /**
   * 启动健康检查
   */
  startHealthCheck() {
    if (!this.config.healthCheck.enabled) return;
    
    const interval = this.config.healthCheck.interval;
    
    console.log(`健康检查已启动，间隔: ${interval}ms`);
    
    // 定期检查服务器健康状态
    this.healthCheckInterval = setInterval(() => {
      serverConfig.checkHealth(this.getServerStatus())
        .then(result => {
          if (!result.healthy) {
            console.warn(`健康检查不通过: ${result.message}`);
            // 如果配置了自动重启，执行重启
            if (this.config.healthCheck.autoRestart && result.action === 'restart') {
              console.log('自动重启服务器...');
              this.restart().catch(err => {
                console.error('重启服务器失败:', err);
              });
            }
          }
        })
        .catch(err => {
          console.error('健康检查错误:', err);
        });
    }, interval);
  },
  
  /**
   * 停止健康检查
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('健康检查已停止');
    }
  },
  
  /**
   * 重启服务器
   * @returns {Promise<Object>} 包含重启结果的Promise
   */
  async restart() {
    console.log('重启服务器...');
    
    try {
      // 获取当前服务器信息
      const serverInfo = this.server?.address();
      const port = serverInfo?.port || this.config.server.port;
      const host = serverInfo?.address || this.config.server.host;
      
      // 停止服务器
      await this.stop();
      
      // 短暂延迟确保端口释放
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 重新启动服务器
      const result = await this.start(port, host);
      
      return {
        success: true,
        ...result
      };
    } catch (err) {
      console.error('重启服务器失败:', err);
      throw err;
    }
  },
  
  /**
   * 获取服务器状态
   * @returns {Object} 服务器状态对象
   */
  getServerStatus() {
    const uptime = this.startTime ? (new Date() - this.startTime) : 0;
    
    return {
      running: this.isRunning,
      uptime,
      requestsServed: this.requestsServed,
      startTime: this.startTime,
      address: this.server?.address() || null,
      memoryUsage: process.memoryUsage()
    };
  },
  
  /**
   * 处理HTTP请求
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async handleRequest(req, res) {
    // 增加请求计数
    this.requestsServed++;
    
    // 记录请求
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
    // 设置默认的CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // 处理OPTIONS请求
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    
    try {
      // 如果有API路由模块，先尝试处理API请求
      if (apiRouter) {
        const isApiRequest = await apiRouter.handleRequest(req, res);
        if (isApiRequest) {
          // 已处理API请求，直接返回
          return;
        }
      }
      
      // 非API请求，处理静态文件
      await this.serveStaticFile(req, res);
    } catch (error) {
      console.error(`请求处理错误: ${error.message}`);
      console.error(error.stack);
      
      // 发送错误响应
      if (!res.headersSent) {
        this.serveErrorPage(res, 500, '服务器内部错误');
      }
    }
  },
  
  /**
   * 处理静态文件请求
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async serveStaticFile(req, res) {
    // 解析URL
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;
    
    // 规范化路径（移除多余的斜杠等）
    pathname = decodeURIComponent(pathname);
    
    // 防止目录遍历攻击，检查路径是否尝试访问父目录
    if (pathname.includes('..')) {
      this.serveErrorPage(res, 403, '禁止访问此路径');
      return;
    }
    
    // 构建文件系统路径
    let filePath = path.join(this.config.root, pathname);
    
    // 检查文件是否存在
    try {
      const stats = await fs.promises.stat(filePath);
      
      if (stats.isDirectory()) {
        // 如果请求的是目录，尝试查找默认索引文件
        for (const indexFile of ['index.html', 'index.htm']) {
          const indexPath = path.join(filePath, indexFile);
          
          try {
            const indexStats = await fs.promises.stat(indexPath);
            if (indexStats.isFile()) {
              filePath = indexPath;
              break;
            }
          } catch (err) {
            // 索引文件不存在，继续尝试下一个
            continue;
          }
        }
        
        // 如果仍然是目录（没有找到索引文件）
        if ((await fs.promises.stat(filePath)).isDirectory()) {
          // 如果配置为支持单页应用，返回根index.html
          if (this.config.serveSinglePageApp) {
            try {
              filePath = path.join(this.config.root, 'index.html');
              await fs.promises.access(filePath);
            } catch (err) {
              this.serveErrorPage(res, 404, '找不到页面');
              return;
            }
          } else {
            // 不支持单页应用，返回目录列表或错误
            this.serveErrorPage(res, 403, '禁止目录浏览');
            return;
          }
        }
      }
    } catch (err) {
      // 如果文件不存在，且支持单页应用，尝试返回index.html
      if (this.config.serveSinglePageApp) {
        try {
          const indexPath = path.join(this.config.root, 'index.html');
          await fs.promises.access(indexPath);
          filePath = indexPath;
        } catch (err) {
          this.serveErrorPage(res, 404, '找不到页面');
          return;
        }
      } else {
        this.serveErrorPage(res, 404, '找不到文件');
        return;
      }
    }
    
    // 获取文件的MIME类型
    const ext = path.extname(filePath).toLowerCase();
    const contentType = this.mimeTypes[ext] || 'application/octet-stream';
    
    try {
      // 读取文件
      let content = await fs.promises.readFile(filePath);
      
      // 设置基本响应头
      res.setHeader('Content-Type', contentType);
      
      // 如果启用了缓存控制
      if (this.config.caching) {
        const maxAge = this.config.cacheMaxAge || 3600;
        res.setHeader('Cache-Control', `max-age=${maxAge}`);
        
        // 如果启用了ETag
        if (this.config.etag) {
          // 简单的ETag实现，根据文件大小和修改时间
          const stats = await fs.promises.stat(filePath);
          const etag = `W/"${stats.size}-${stats.mtime.getTime()}"`;
          res.setHeader('ETag', etag);
          
          // 处理条件请求
          if (req.headers['if-none-match'] === etag) {
            res.statusCode = 304; // Not Modified
            res.end();
            return;
          }
        }
      } else {
        // 禁用缓存
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      
      // 处理压缩
      const acceptEncoding = req.headers['accept-encoding'] || '';
      
      if (this.config.compression && acceptEncoding.includes('gzip') && 
          /text|javascript|json|css|xml|svg/.test(contentType)) {
        res.setHeader('Content-Encoding', 'gzip');
        content = await new Promise((resolve, reject) => {
          zlib.gzip(content, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      }
      
      // 发送响应
      res.statusCode = 200;
      res.end(content);
      
    } catch (err) {
      console.error(`提供文件时出错: ${err.message}`);
      this.serveErrorPage(res, 500, '服务器内部错误');
    }
  },
  
  /**
   * 提供错误页面
   * @param {Object} res - HTTP响应对象
   * @param {number} statusCode - HTTP状态码
   * @param {string} message - 错误消息
   */
  serveErrorPage(res, statusCode, message) {
    res.statusCode = statusCode;
    
    // 尝试查找自定义错误页面
    const errorPagePath = path.join(this.config.paths.static, `${statusCode}.html`);
    
    fs.access(errorPagePath, fs.constants.R_OK, (err) => {
      if (!err) {
        // 存在自定义错误页面，提供它
        res.setHeader('Content-Type', 'text/html');
        fs.createReadStream(errorPagePath).pipe(res);
      } else {
        // 不存在自定义错误页面，生成简单的错误页面
        res.setHeader('Content-Type', 'text/html');
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${statusCode} - ${message}</title>
              <style>
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  background-color: #f7f8f9;
                  color: #333;
                }
                .error-container {
                  text-align: center;
                  padding: 2rem;
                  border-radius: 8px;
                  background-color: white;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                  max-width: 500px;
                }
                h1 { 
                  font-size: 4rem;
                  margin: 0;
                  color: #e74c3c;
                }
                p { 
                  font-size: 1.2rem;
                  margin: 1rem 0;
                }
                .btn {
                  display: inline-block;
                  margin-top: 1rem;
                  padding: 0.75rem 1.5rem;
                  background-color: #3498db;
                  color: white;
                  text-decoration: none;
                  border-radius: 4px;
                  transition: background-color 0.2s;
                }
                .btn:hover {
                  background-color: #2980b9;
                }
              </style>
            </head>
            <body>
              <div class="error-container">
                <h1>${statusCode}</h1>
                <p>${message}</p>
                <a href="/" class="btn">返回首页</a>
              </div>
            </body>
          </html>
        `);
      }
    });
  }
};

// 默认配置选项
localServer.defaultOptions = {
  port: 8080,
  host: 'localhost',
  root: './',
  mode: 'development',
  timeout: 30000,
  caching: true,
  etag: true,
  compression: true,
  cacheMaxAge: 3600,
  serveSinglePageApp: true
};

// 初始化服务器
localServer.init();

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  localServer.start().catch(err => {
    console.error('启动服务器失败:', err);
    process.exit(1);
  });
}

// 导出服务器对象
module.exports = localServer; 