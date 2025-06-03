/**
 * @file tests/e2e/global-setup.js
 * @description Playwright端到端测试全局设置
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const childProcess = require('child_process');

/**
 * 启动测试服务器
 * @returns {Promise<childProcess.ChildProcess>} 服务器进程
 */
async function startTestServer() {
  console.log('正在启动测试服务器...');
  
  // 启动测试服务器作为子进程
  const serverProcess = childProcess.spawn(
    'node', 
    [path.join(__dirname, '../../local-server.js')], 
    {
      env: { ...process.env, NODE_ENV: 'test', PORT: '8080' },
      stdio: 'pipe',
    }
  );
  
  // 处理服务器日志
  serverProcess.stdout.on('data', (data) => {
    console.log(`[测试服务器] ${data.toString()}`);
  });
  
  serverProcess.stderr.on('data', (data) => {
    console.error(`[测试服务器错误] ${data.toString()}`);
  });
  
  // 等待服务器启动
  return new Promise((resolve, reject) => {
    let isStarted = false;
    
    // 监听服务器启动消息
    serverProcess.stdout.on('data', (data) => {
      if (!isStarted && data.toString().includes('服务器已启动')) {
        isStarted = true;
        console.log('测试服务器已启动');
        resolve(serverProcess);
      }
    });
    
    // 设置超时
    const timeout = setTimeout(() => {
      if (!isStarted) {
        reject(new Error('测试服务器启动超时'));
      }
    }, 10000);
    
    // 处理错误
    serverProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`测试服务器启动失败: ${err.message}`));
    });
    
    serverProcess.on('exit', (code) => {
      if (!isStarted) {
        clearTimeout(timeout);
        reject(new Error(`测试服务器异常退出，退出码: ${code}`));
      }
    });
  });
}

/**
 * 全局设置函数
 * 在所有测试运行前执行
 */
module.exports = async () => {
  // 启动测试服务器
  const serverProcess = await startTestServer();
  
  // 注册浏览器全局作用域
  global.__SERVER__ = serverProcess;
  
  // 创建认证状态
  console.log('正在预设认证状态...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // 导航到登录页面
  await page.goto('http://localhost:8080/auth/login');
  
  // 执行登录操作
  await page.fill('input[name="username"]', 'testuser');
  await page.fill('input[name="password"]', 'testpass');
  await page.click('button[type="submit"]');
  
  // 等待登录完成
  await page.waitForURL('http://localhost:8080/dashboard');
  
  // 保存认证状态
  await page.context().storageState({ 
    path: path.join(__dirname, 'auth-state.json') 
  });
  
  console.log('认证状态已保存');
  await browser.close();
};

/**
 * 全局清理函数
 * 在所有测试运行后执行
 */
module.exports.teardown = async () => {
  // 关闭测试服务器
  if (global.__SERVER__) {
    console.log('正在关闭测试服务器...');
    global.__SERVER__.kill();
  }
}; 