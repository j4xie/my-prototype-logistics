/**
 * @file 数据库性能测试运行脚本
 * @description 自动运行数据库读写性能测试和极端数据量内存优化测试
 * @version 1.0.0
 * @created 2025-07-16
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// 配置选项
const config = {
  // 默认不运行极端测试（超过50000条数据的测试）
  runExtremeTests: process.env.RUN_EXTREME_TESTS === 'true',
  // 测试超时时间（毫秒）
  timeout: process.env.TEST_TIMEOUT || 600000, // 10分钟
  // 测试输出目录
  outputDir: path.resolve(__dirname, '../../test-coverage/database-performance'),
  // 测试文件
  testFiles: [
    './database-performance.test.js',
    './extreme-data-memory.test.js'
  ]
};

// 确保输出目录存在
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
}

console.log('====================================');
console.log('数据库性能测试运行脚本');
console.log('====================================');
console.log(`运行时间: ${new Date().toISOString()}`);
console.log(`运行极端测试: ${config.runExtremeTests ? '是' : '否'}`);
console.log(`测试超时时间: ${config.timeout / 1000}秒`);
console.log('测试文件:');
config.testFiles.forEach(file => console.log(`- ${file}`));
console.log('====================================');

// 为每个测试文件创建Jest命令
const createJestCommand = (testFile) => {
  const outputBase = path.basename(testFile, '.test.js');
  return `npx jest ${testFile} --testTimeout=${config.timeout} ` +
         `--no-cache --forceExit ` +
         `--json --outputFile=${path.join(config.outputDir, `${outputBase}-results.json`)} ` +
         `--testEnvironment=node`;
};

// 记录开始时间，用于计算总运行时间
const startTime = Date.now();

// 逐个运行测试文件
const runTests = async () => {
  for (const testFile of config.testFiles) {
    const command = createJestCommand(testFile);
    console.log(`\n执行测试: ${testFile}`);
    console.log(`命令: ${command}\n`);
    
    try {
      // 使用Promise包装exec以便使用async/await
      await new Promise((resolve, reject) => {
        const process = exec(command, {
          cwd: __dirname,
          env: {
            ...process.env,
            RUN_EXTREME_TESTS: config.runExtremeTests ? 'true' : 'false'
          }
        });
        
        // 将输出传递到控制台
        process.stdout.pipe(process.stdout);
        process.stderr.pipe(process.stderr);
        
        process.on('close', (code) => {
          if (code === 0) {
            console.log(`\n✅ 测试 ${testFile} 成功完成`);
            resolve();
          } else {
            console.error(`\n❌ 测试 ${testFile} 失败，退出代码 ${code}`);
            reject(new Error(`测试失败，退出代码 ${code}`));
          }
        });
      });
    } catch (error) {
      console.error(`运行测试时出错: ${error.message}`);
      // 继续执行下一个测试，而不是中断整个过程
    }
  }
};

runTests()
  .then(() => {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n====================================');
    console.log('所有测试完成');
    console.log(`总运行时间: ${duration.toFixed(2)}秒`);
    console.log('====================================');
    
    // 尝试生成汇总报告
    try {
      const results = [];
      for (const testFile of config.testFiles) {
        const outputBase = path.basename(testFile, '.test.js');
        const resultPath = path.join(config.outputDir, `${outputBase}-results.json`);
        
        if (fs.existsSync(resultPath)) {
          const testResult = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
          results.push({
            name: outputBase,
            numPassedTests: testResult.numPassedTests,
            numFailedTests: testResult.numFailedTests,
            numTotalTests: testResult.numTotalTests,
            testResults: testResult.testResults
          });
        }
      }
      
      // 写入汇总报告
      const summaryPath = path.join(config.outputDir, 'summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        duration,
        results
      }, null, 2));
      
      console.log(`汇总报告已生成: ${summaryPath}`);
    } catch (error) {
      console.error(`生成汇总报告时出错: ${error.message}`);
    }
  })
  .catch(error => {
    console.error(`测试过程中出错: ${error.message}`);
    process.exit(1);
  }); 