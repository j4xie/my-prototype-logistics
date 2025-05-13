/**
 * Mock服务器
 * 用于性能测试，提供可控延迟和带宽限制的资源响应
 * 
 * 用法: node test/mock-server/index.js [--port=9090] [--delay=200] [--bandwidth=1024]
 */

const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

// 命令行参数解析
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value;
  return acc;
}, {});

// 配置
const config = {
  port: parseInt(args.port || '9090'),
  delay: parseInt(args.delay || '200'),
  bandwidth: parseInt(args.bandwidth || '1024'), // KB/s
  host: args.host || 'localhost'
};

// 简单的资源类型映射
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

// 带宽限制器
function throttle(data, bandwidth) {
  const chunkSize = Math.max(1024, bandwidth); // 最小1KB
  const chunks = [];
  
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  
  return chunks;
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  // 解析请求URL
  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;
  
  // 确保路径是绝对路径
  const safePathname = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  
  // 处理API路径
  if (safePathname.startsWith('/api/')) {
    handleApiRequest(req, res, safePathname);
    return;
  }
  
  // 处理静态资源
  handleStaticRequest(req, res, safePathname);
});

// 处理API请求
function handleApiRequest(req, res, pathname) {
  // 模拟API处理延迟
  setTimeout(() => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    // 生成随机资源数据
    const data = {
      success: true,
      timestamp: Date.now(),
      path: pathname,
      method: req.method,
      data: generateMockData(pathname)
    };
    
    // 发送响应
    res.end(JSON.stringify(data));
    
    console.log(`${req.method} ${pathname} - 200 (${config.delay}ms)`);
  }, config.delay);
}

// 处理静态资源请求
function handleStaticRequest(req, res, pathname) {
  // 默认提供测试资源
  const filePath = path.join(process.cwd(), 'test/mock-server/static', pathname);
  const extname = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';
  
  // 检查文件是否存在
  fs.stat(filePath, (err, stats) => {
    if (err) {
      // 文件不存在，生成模拟资源
      generateMockResource(req, res, pathname, contentType);
      return;
    }
    
    // 文件存在，读取并发送
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end(`Error reading file: ${err.message}`);
        return;
      }
      
      // 模拟网络延迟
      setTimeout(() => {
        sendThrottledResponse(res, data, contentType);
      }, config.delay);
    });
  });
}

// 生成模拟资源
function generateMockResource(req, res, pathname, contentType) {
  // 根据路径和类型生成模拟资源
  let data;
  
  // 根据内容类型生成不同的模拟数据
  if (contentType.startsWith('image/')) {
    // 生成1KB-500KB的随机二进制数据模拟图片
    const size = Math.floor(Math.random() * 500 * 1024) + 1024;
    data = Buffer.alloc(size);
  } else if (contentType === 'application/json') {
    // 生成JSON数据
    data = Buffer.from(JSON.stringify(generateMockData(pathname)));
  } else {
    // 生成文本数据
    data = Buffer.from(`Mock resource for ${pathname} - ${Date.now()}`);
  }
  
  // 模拟网络延迟
  setTimeout(() => {
    sendThrottledResponse(res, data, contentType);
  }, config.delay);
}

// 限制带宽发送响应
function sendThrottledResponse(res, data, contentType) {
  res.writeHead(200, { 'Content-Type': contentType });
  
  // 如果带宽限制未启用或文件很小，直接发送
  if (config.bandwidth <= 0 || data.length < 1024) {
    res.end(data);
    return;
  }
  
  // 分块发送以模拟带宽限制
  const chunks = throttle(data, config.bandwidth);
  let index = 0;
  
  function sendNextChunk() {
    if (index >= chunks.length) {
      res.end();
      return;
    }
    
    res.write(chunks[index++]);
    
    // 计算下一个块的发送延迟
    const delay = (chunks[0].length * 1000) / (config.bandwidth * 1024);
    setTimeout(sendNextChunk, delay);
  }
  
  // 开始发送
  sendNextChunk();
}

// 根据路径生成模拟数据
function generateMockData(pathname) {
  // 基于路径生成一致的模拟数据
  const parts = pathname.split('/').filter(Boolean);
  const resourceType = parts[parts.length - 1];
  
  // 通用模拟数据
  return {
    id: `mock-${Date.now()}`,
    path: pathname,
    type: resourceType,
    timestamp: Date.now(),
    size: Math.floor(Math.random() * 1000) + 100,
    metadata: {
      created: new Date().toISOString(),
      version: '1.0.0',
      mime: mimeTypes[`.${resourceType}`] || 'application/octet-stream'
    }
  };
}

// 创建静态目录（如果不存在）
const staticDir = path.join(process.cwd(), 'test/mock-server/static');
if (!fs.existsSync(staticDir)) {
  fs.mkdirSync(staticDir, { recursive: true });
  console.log(`Created static directory: ${staticDir}`);
}

// 启动服务器
server.listen(config.port, config.host, () => {
  console.log(`Mock服务器已启动: http://${config.host}:${config.port}`);
  console.log(`配置: 延迟=${config.delay}ms, 带宽=${config.bandwidth}KB/s`);
  console.log('按 Ctrl+C 停止服务器');
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('正在关闭Mock服务器...');
  server.close(() => {
    console.log('Mock服务器已关闭');
    process.exit(0);
  });
}); 