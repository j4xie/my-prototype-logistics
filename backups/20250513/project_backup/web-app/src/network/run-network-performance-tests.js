/**
 * @file 网络性能测试运行脚本
 * @description 自动运行网络性能相关的测试
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 配置选项
const config = {
  // 测试超时时间（毫秒）
  timeout: process.env.TEST_TIMEOUT || 600000, // 10分钟
  // 测试输出目录
  outputDir: path.resolve(__dirname, '../../test-coverage/network-performance'),
  // 测试文件
  testFiles: [
    'batch-size-optimization.test.js',
    'network-fast-switch.test.js',
    'memory-usage-analysis.test.js'
  ]
};

// 确保输出目录存在
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
}

console.log('====================================');
console.log('网络性能测试运行脚本');
console.log('====================================');
console.log(`运行时间: ${new Date().toISOString()}`);
console.log(`测试超时时间: ${config.timeout / 1000}秒`);
console.log('测试文件:');
config.testFiles.forEach(file => console.log(`- ${file}`));
console.log('====================================');

// 记录开始时间，用于计算总运行时间
const startTime = Date.now();

// 运行测试文件
const runTest = (testFile) => {
  return new Promise((resolve, reject) => {
    console.log(`\n执行测试: ${testFile}`);
    
    const args = [
      '--experimental-vm-modules',
      testFile
    ];
    
    const testProcess = spawn('node', args, {
      cwd: __dirname,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ 测试 ${testFile} 成功完成`);
        resolve(true);
      } else {
        console.error(`\n❌ 测试 ${testFile} 失败，退出代码 ${code}`);
        resolve(false); // 仍然解析，而不是拒绝，以便继续执行下一个测试
      }
    });
    
    testProcess.on('error', (err) => {
      console.error(`\n❌ 测试 ${testFile} 错误:`, err);
      resolve(false);
    });
  });
};

// 按顺序运行所有测试
async function runAll() {
  const results = [];
  
  for (const testFile of config.testFiles) {
    const success = await runTest(testFile);
    results.push({ testFile, success });
  }
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  
  console.log('\n====================================');
  console.log('所有测试完成');
  console.log(`总运行时间: ${duration.toFixed(2)}秒`);
  
  // 显示测试结果摘要
  console.log('\n测试结果摘要:');
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  
  console.log(`通过测试: ${successful}/${results.length}`);
  if (failed > 0) {
    console.log('失败的测试:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`- ${r.testFile}`);
    });
  }
  
  console.log('====================================');
  
  // 如果有任何测试失败，以非零状态码退出
  if (failed > 0) {
    process.exit(1);
  }
}

runAll()
  .catch(err => {
    console.error('运行测试时发生错误:', err);
    process.exit(1);
  }); 