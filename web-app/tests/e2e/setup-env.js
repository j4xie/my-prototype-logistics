/**
 * 食品溯源系统 - 端到端测试环境设置
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 检查并启动本地服务器
 * @returns {Object} 服务器进程信息
 */
function setupTestServer() {
  console.log('正在设置测试服务器环境...');
  
  // 检查当前目录
  const currentDir = process.cwd();
  console.log(`当前工作目录: ${currentDir}`);
  
  // 定位到web-app目录
  let webAppDir = currentDir;
  if (!currentDir.endsWith('web-app')) {
    if (fs.existsSync(path.join(currentDir, 'web-app'))) {
      webAppDir = path.join(currentDir, 'web-app');
    } else {
      // 尝试向上寻找
      let parentDir = path.dirname(currentDir);
      if (fs.existsSync(path.join(parentDir, 'web-app'))) {
        webAppDir = path.join(parentDir, 'web-app');
      }
    }
  }
  
  console.log(`使用web-app目录: ${webAppDir}`);
  
  // 检查package.json是否存在
  const packageJsonPath = path.join(webAppDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`找不到package.json，路径: ${packageJsonPath}`);
  }
  
  // 读取package.json以验证
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  console.log(`验证项目: ${packageJson.name} v${packageJson.version}`);
  
  // 准备测试数据
  setupTestData(webAppDir);
  
  return {
    webAppDir,
    packageJson
  };
}

/**
 * 设置测试数据
 * @param {string} webAppDir - web-app目录路径
 */
function setupTestData(webAppDir) {
  console.log('正在准备测试数据...');
  
  // 测试用户数据
  const testUserData = {
    username: 'testuser',
    password: 'password123',
    role: 'user',
    email: 'test@example.com'
  };
  
  // 测试产品数据
  const testProductData = {
    id: 'p001',
    name: '有机大米',
    producer: '湖南农场',
    category: '粮食',
    production_date: '2025-03-01',
    records: [
      {
        operation: '种植',
        location: '湖南省长沙市',
        date: '2025-01-15',
        operator: '张农民'
      },
      {
        operation: '收获',
        location: '湖南省长沙市',
        date: '2025-03-01',
        operator: '李收割'
      }
    ]
  };
  
  // 将测试数据写入临时文件，以便测试时加载
  const testDataDir = path.join(webAppDir, 'tests', 'e2e', 'test-data');
  
  // 创建测试数据目录（如果不存在）
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
  
  // 写入测试用户数据
  fs.writeFileSync(
    path.join(testDataDir, 'test-user.json'),
    JSON.stringify(testUserData, null, 2)
  );
  
  // 写入测试产品数据
  fs.writeFileSync(
    path.join(testDataDir, 'test-product.json'),
    JSON.stringify(testProductData, null, 2)
  );
  
  console.log('测试数据准备完成');
}

/**
 * 检查环境变量
 */
function checkEnvironment() {
  console.log('正在检查环境变量...');
  
  // 设置测试环境变量
  process.env.NODE_ENV = 'test';
  process.env.TEST_SERVER_PORT = process.env.TEST_SERVER_PORT || '8080';
  
  console.log(`测试服务器端口: ${process.env.TEST_SERVER_PORT}`);
  console.log('环境变量设置完成');
}

// 执行设置
try {
  checkEnvironment();
  const { webAppDir, packageJson } = setupTestServer();
  
  console.log('测试环境设置成功！');
  console.log(`项目: ${packageJson.name}`);
  console.log(`目录: ${webAppDir}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  
  // 导出设置结果供测试文件使用
  module.exports = {
    webAppDir,
    testServerPort: process.env.TEST_SERVER_PORT,
    testDataDir: path.join(webAppDir, 'tests', 'e2e', 'test-data')
  };
} catch (error) {
  console.error('测试环境设置失败:', error.message);
  process.exit(1);
} 