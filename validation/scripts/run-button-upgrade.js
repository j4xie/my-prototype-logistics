/**
 * 按钮升级执行脚本
 * 版本：1.0.0
 * 
 * 该脚本将执行以下操作：
 * 1. 启动本地服务器（如果尚未运行）
 * 2. 运行按钮扫描和收集先前的按钮状态
 * 3. 在所有页面上应用按钮自动升级
 * 4. 生成升级报告
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');

// 配置信息
const config = {
  port: 8080,
  serverRoot: path.resolve(__dirname, '../../'),
  reportsDir: path.resolve(__dirname, '../../validation/reports'),
  pagesDir: path.resolve(__dirname, '../../pages'),
  upgradeReportScript: path.resolve(__dirname, '../reports/button-tests/upgrade_report.js'),
  pagesJsonPath: path.resolve(__dirname, '../../validation/reports/test_pages_list.json'),
  beforeReportPath: path.resolve(__dirname, '../../validation/reports/button_improvements_report.json')
};

// 确保目录存在
if (!fs.existsSync(config.reportsDir)) {
  fs.mkdirSync(config.reportsDir, { recursive: true });
}

// 检查是否包含指定标签的脚本
function pageHasAutoloadScript(htmlContent) {
  const autoloadScriptPattern = /<script.*src=["'].*autoload-button-upgrade\.js["'].*><\/script>/i;
  return autoloadScriptPattern.test(htmlContent);
}

// 为所有页面注入自动升级脚本
async function injectAutoloadScript() {
  console.log('开始为页面注入自动升级脚本...');
  
  // 递归扫描目录查找所有HTML文件
  function findHtmlFiles(dir, htmlFiles = []) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const isDirectory = fs.statSync(filePath).isDirectory();
      
      if (isDirectory) {
        findHtmlFiles(filePath, htmlFiles);
      } else if (file.endsWith('.html')) {
        // 排除包含以下字符串的文件
        const skipPatterns = ['backup', 'old-', 'test-', 'example-'];
        if (!skipPatterns.some(pattern => file.includes(pattern) || filePath.includes(pattern))) {
          htmlFiles.push(filePath);
        }
      }
    }
    
    return htmlFiles;
  }
  
  // 获取所有HTML文件
  const htmlFiles = findHtmlFiles(config.pagesDir);
  console.log(`发现 ${htmlFiles.length} 个HTML文件`);
  
  // 保存页面路径列表
  const pagePaths = htmlFiles.map(file => {
    return '/' + path.relative(config.serverRoot, file).replace(/\\/g, '/');
  });
  fs.writeFileSync(config.pagesJsonPath, JSON.stringify(pagePaths, null, 2), 'utf8');
  console.log(`页面路径列表已保存到: ${config.pagesJsonPath}`);
  
  let injectedCount = 0;
  let skippedCount = 0;
  
  // 遍历所有HTML文件并检查或注入脚本标签
  for (const filePath of htmlFiles) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // 检查文件是否已经包含自动加载脚本
      if (pageHasAutoloadScript(content)) {
        skippedCount++;
        continue;
      }
      
      // 找到</body>标签的位置
      const bodyCloseIndex = content.lastIndexOf('</body>');
      if (bodyCloseIndex === -1) {
        console.log(`跳过文件 ${filePath}，未找到</body>标签`);
        continue;
      }
      
      // 注入自动加载脚本
      const scriptTag = '\n  <!-- 自动按钮升级脚本 (自动注入) -->\n  <script src="/components/autoload-button-upgrade.js"></script>\n  ';
      const updatedContent = content.slice(0, bodyCloseIndex) + scriptTag + content.slice(bodyCloseIndex);
      
      // 写入修改后的内容
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      injectedCount++;
      
    } catch (error) {
      console.error(`处理文件 ${filePath} 时出错:`, error);
    }
  }
  
  console.log(`完成注入自动升级脚本: ${injectedCount} 个页面已注入, ${skippedCount} 个页面已跳过(已有脚本)`);
  return injectedCount;
}

// 检查服务器是否正在运行
function isServerRunning() {
  return new Promise(resolve => {
    http.get(`http://localhost:${config.port}`, res => {
      resolve(true);
    }).on('error', () => {
      resolve(false);
    });
  });
}

// 启动本地服务器
function startLocalServer() {
  return new Promise((resolve, reject) => {
    console.log('启动本地服务器...');
    
    // 尝试使用npx http-server启动服务器
    const server = spawn('npx', [
      'http-server', 
      config.serverRoot,
      '-p', config.port,
      '-c-1', // 禁用缓存
      '--cors'
    ], {
      shell: true,
      stdio: 'pipe'
    });
    
    let serverStarted = false;
    
    server.stdout.on('data', data => {
      const output = data.toString();
      console.log(`[服务器] ${output.trim()}`);
      
      // 检查服务器是否已成功启动
      if (output.includes('Available on') && !serverStarted) {
        serverStarted = true;
        console.log('本地服务器已启动');
        resolve(server);
      }
    });
    
    server.stderr.on('data', data => {
      console.error(`[服务器错误] ${data.toString().trim()}`);
    });
    
    server.on('error', error => {
      console.error('启动服务器时出错:', error);
      reject(error);
    });
    
    // 30秒后如果服务器还未启动则认为失败
    setTimeout(() => {
      if (!serverStarted) {
        console.error('启动服务器超时');
        server.kill();
        reject(new Error('启动服务器超时'));
      }
    }, 30000);
  });
}

// 备份现有的按钮报告（如果有）
function backupExistingReport() {
  if (fs.existsSync(config.beforeReportPath)) {
    const backupPath = `${config.beforeReportPath}.backup-${Date.now()}.json`;
    fs.copyFileSync(config.beforeReportPath, backupPath);
    console.log(`已备份现有报告到: ${backupPath}`);
  }
}

// 运行按钮升级报告生成器
function runUpgradeReport() {
  return new Promise((resolve, reject) => {
    console.log('运行按钮升级报告生成器...');
    
    const process = spawn('node', [config.upgradeReportScript], {
      shell: true,
      stdio: 'inherit'
    });
    
    process.on('close', code => {
      if (code === 0) {
        console.log('按钮升级报告生成完成');
        resolve();
      } else {
        console.error(`按钮升级报告生成失败，退出代码: ${code}`);
        reject(new Error(`进程退出，代码: ${code}`));
      }
    });
    
    process.on('error', error => {
      console.error('运行按钮升级报告时出错:', error);
      reject(error);
    });
  });
}

// 安装所需依赖
async function ensureDependencies() {
  return new Promise((resolve, reject) => {
    console.log('检查并安装所需依赖...');
    
    // 检查 playwright 是否已安装
    exec('npx playwright --version', (error) => {
      if (error) {
        console.log('正在安装 playwright...');
        const install = spawn('npm', ['install', 'playwright@latest', '--no-save'], {
          shell: true,
          stdio: 'inherit'
        });
        
        install.on('close', code => {
          if (code === 0) {
            console.log('Playwright 已安装');
            
            // 安装浏览器
            console.log('正在安装 Playwright 浏览器...');
            const installBrowsers = spawn('npx', ['playwright', 'install', 'chromium'], {
              shell: true,
              stdio: 'inherit'
            });
            
            installBrowsers.on('close', code => {
              if (code === 0) {
                console.log('Playwright 浏览器已安装');
                resolve();
              } else {
                reject(new Error(`安装 Playwright 浏览器失败，退出代码: ${code}`));
              }
            });
          } else {
            reject(new Error(`安装 Playwright 失败，退出代码: ${code}`));
          }
        });
      } else {
        console.log('Playwright 已安装');
        resolve();
      }
    });
  });
}

// 主函数
async function main() {
  console.log('=== 开始按钮升级流程 ===');
  let server;
  
  try {
    // 1. 确保依赖已安装
    await ensureDependencies();
    
    // 2. 注入自动升级脚本
    const injectedCount = await injectAutoloadScript();
    
    if (injectedCount === 0) {
      console.log('没有页面需要注入自动升级脚本，跳过后续步骤');
      return;
    }
    
    // 3. 检查服务器是否已在运行
    const serverRunning = await isServerRunning();
    
    if (!serverRunning) {
      // 启动本地服务器
      server = await startLocalServer();
    } else {
      console.log('本地服务器已在运行，跳过启动');
    }
    
    // 4. 备份现有报告（如果有）
    backupExistingReport();
    
    // 5. 运行升级报告生成器
    await runUpgradeReport();
    
    console.log('=== 按钮升级流程完成 ===');
    console.log('升级报告已生成，请查看详细报告了解按钮改进情况');
    
  } catch (error) {
    console.error('按钮升级流程出错:', error);
  } finally {
    // 如果由我们启动的服务器，则关闭它
    if (server) {
      console.log('关闭本地服务器...');
      server.kill();
    }
  }
}

// 运行主函数
main(); 