/**
 * 食品溯源系统 - 端到端测试运行脚本
 * 版本：1.0.0
 * 
 * 此脚本用于自动运行端到端测试，能自动定位web-app目录并使用正确的包环境。
 * 使用project-paths模块解决路径问题。
 * 
 * 使用方法：
 * node run-e2e-tests.js [参数]
 * 
 * 可用参数：
 * --ui              以UI模式运行测试（打开浏览器可视界面）
 * --debug           以调试模式运行（暂停在每个测试步骤）
 * --test=文件名      运行特定的测试文件（例如: --test=login.spec.js）
 * 
 * 示例：
 * node run-e2e-tests.js --ui                    # 使用UI模式运行所有测试
 * node run-e2e-tests.js --test=login.spec.js    # 只运行登录测试
 * node run-e2e-tests.js --debug --ui            # 以调试模式运行并显示UI
 */

const path = require('path');
const projectPaths = require('../../config/project-paths');
const { spawnSync } = require('child_process');
const fs = require('fs');

/**
 * 查找web-app目录
 * 使用project-paths模块获取standardized路径
 * @returns {string} 找到的web-app目录的绝对路径
 */
function findWebAppDir() {
  // 首先检查当前目录
  let currentDir = process.cwd();
  let foundDirs = [];
  
  // 从当前目录开始向上查找，最多查找5层
  for (let i = 0; i < 5; i++) {
    // 检查当前目录是否包含package.json
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      // 找到了可能的web-app目录
      foundDirs.push(currentDir);
    }
    
    // 如果目录名称是web-app或者e2e，这也是个强信号
    if (path.basename(currentDir) === 'web-app') {
      foundDirs.push(currentDir);
    }
    
    // 检查当前目录下是否有web-app子目录
    const webAppSubDir = path.join(currentDir, 'web-app');
    if (fs.existsSync(webAppSubDir) && fs.statSync(webAppSubDir).isDirectory()) {
      // 如果子目录包含package.json，这是很可能的目标目录
      if (fs.existsSync(path.join(webAppSubDir, 'package.json'))) {
        foundDirs.push(webAppSubDir);
      } else {
        // 否则只是作为候选添加
        foundDirs.push(webAppSubDir);
      }
    }
    
    // 向上一级目录
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // 已经到达根目录，停止查找
      break;
    }
    currentDir = parentDir;
  }
  
  // 如果找到多个可能的目录，优先选择具有package.json的目录
  for (const dir of foundDirs) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      console.log(`找到web-app目录: ${dir}`);
      return dir;
    }
  }
  
  // 如果没有找到带package.json的目录，但找到了其他可能的目录
  if (foundDirs.length > 0) {
    console.log(`找到可能的web-app目录: ${foundDirs[0]}`);
    return foundDirs[0];
  }
  
  // 兜底方案：返回当前目录
  console.warn('警告: 无法找到web-app目录，将使用当前目录');
  return process.cwd();
}

/**
 * 运行端到端测试
 * 根据命令行参数运行不同模式的测试
 * @param {Object} options 包含测试选项的对象
 * @param {boolean} options.ui 是否使用UI模式
 * @param {boolean} options.debug 是否使用调试模式
 * @param {string} options.testFile 要运行的特定测试文件
 */
function runE2ETests(options) {
  try {
    // 找到web-app目录
    const webAppDir = findWebAppDir();
    console.log(`使用web-app目录: ${webAppDir}`);
    
    // 检查package.json是否存在
    const packageJsonPath = path.join(webAppDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`找不到package.json，路径: ${packageJsonPath}`);
    }
    
    // 切换到web-app目录
    process.chdir(webAppDir);
    console.log(`当前工作目录已切换到: ${process.cwd()}`);
    
    // 加载环境设置
    console.log('加载测试环境设置...');
    const setupEnvPath = path.join(projectPaths.paths.e2eTests, 'setup-env.js');
    if (fs.existsSync(setupEnvPath)) {
      require('./setup-env');
    } else {
      console.warn('警告: 找不到setup-env.js文件，测试环境可能未正确初始化');
    }
    
    // 构建测试命令
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const cmdArgs = ['playwright', 'test'];
    
    if (options.ui) {
      cmdArgs.push('--ui');
    }
    
    if (options.debug) {
      cmdArgs.push('--debug');
    }
    
    if (options.testFile) {
      // 检查测试文件是否存在
      const testFilePath = options.testFile.includes(path.sep) 
        ? path.resolve(options.testFile)
        : path.join(projectPaths.paths.e2eTests, options.testFile);
        
      if (fs.existsSync(testFilePath)) {
        cmdArgs.push(testFilePath);
      } else {
        console.warn(`警告: 测试文件 ${testFilePath} 不存在，将运行所有测试`);
      }
    }
    
    // 运行测试命令
    console.log(`运行命令: ${cmd} ${cmdArgs.join(' ')}`);
    const result = spawnSync(cmd, cmdArgs, {
      stdio: 'inherit',
      shell: true
    });
    
    // 处理结果
    if (result.error) {
      throw result.error;
    }
    
    if (result.status !== 0) {
      console.error(`测试运行失败，退出代码: ${result.status}`);
      process.exit(result.status);
    }
    
    console.log('端到端测试完成!');
    
  } catch (error) {
    console.error('端到端测试运行错误:', error.message);
    process.exit(1);
  }
}

// 解析命令行参数
const args = process.argv.slice(2);
const options = {
  ui: args.includes('--ui'),
  debug: args.includes('--debug'),
  testFile: args.find(arg => arg.startsWith('--test=')) 
            ? args.find(arg => arg.startsWith('--test=')).replace('--test=', '')
            : args.find(arg => !arg.startsWith('--'))
};

// 开始运行测试
console.log('============================================');
console.log('     食品溯源系统 - 开始运行端到端测试     ');
console.log('============================================');
console.log(`UI模式: ${options.ui ? '是' : '否'}`);
console.log(`调试模式: ${options.debug ? '是' : '否'}`);
if (options.testFile) {
  console.log(`测试文件: ${options.testFile}`);
}
console.log('--------------------------------------------');

// 显示项目路径信息
console.log('项目路径信息:');
console.log(`- 项目根目录: ${projectPaths.paths.root}`);
console.log(`- Web应用目录: ${projectPaths.paths.webApp}`);
console.log(`- 端到端测试目录: ${projectPaths.paths.e2eTests}`);
console.log('--------------------------------------------');

runE2ETests(options); 