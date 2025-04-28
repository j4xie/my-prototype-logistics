/**
 * 测试运行器 - 用于直接运行大规模数据处理测试
 */

// 导入所需模块
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('====== 开始执行大规模数据处理测试 ======');
console.log('当前目录:', process.cwd());

try {
  // 确保我们在web-app目录下
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const isInWebAppDir = fs.existsSync(packageJsonPath);
  
  if (!isInWebAppDir) {
    console.log('切换到web-app目录...');
    process.chdir(path.join(process.cwd(), 'web-app'));
    console.log('当前目录已更改为:', process.cwd());
  }
  
  console.log('正在运行大规模数据处理测试...');
  
  // 检查Jest是否可用
  try {
    require.resolve('jest');
    console.log('Jest已安装，继续测试...');
  } catch (e) {
    console.log('Jest未找到，尝试安装Jest...');
    execSync('npm install --no-save jest', { stdio: 'inherit' });
  }
  
  // 运行测试
  const testCommand = 'npx jest src/network/load-balancing.test.js --verbose';
  console.log('执行命令:', testCommand);
  
  const result = execSync(testCommand, { stdio: 'inherit' });
  
  console.log('====== 测试完成 ======');
} catch (error) {
  console.error('测试执行失败:', error.message);
  console.log('错误详情:', error);
  console.log('尝试使用以下替代命令:');
  console.log('cd web-app && npx jest src/network/load-balancing.test.js');
}

// 等待用户输入，防止窗口关闭
console.log('按Ctrl+C退出...');
process.stdin.resume(); 