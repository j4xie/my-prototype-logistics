const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  const filePath = req.url === '/' ? './test-trace.html' : '.' + req.url;
  
  console.log(`请求: ${req.url} -> ${filePath}`);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(`错误: ${err.message}`);
      res.writeHead(404);
      res.end(`找不到文件: ${filePath}`);
      return;
    }
    
    const ext = path.extname(filePath);
    let contentType = 'text/plain';
    
    switch (ext) {
      case '.html':
        contentType = 'text/html';
        break;
      case '.js':
        contentType = 'application/javascript';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.json':
        contentType = 'application/json';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.svg':
        contentType = 'image/svg+xml';
        break;
    }
    
    res.writeHead(200, {'Content-Type': `${contentType}; charset=utf-8`});
    res.end(data);
  });
});

const PORT = 3000;

server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`提供文件: ${path.resolve('./test-trace.html')}`);
}); 