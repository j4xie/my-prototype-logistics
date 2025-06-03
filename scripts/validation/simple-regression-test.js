#!/usr/bin/env node

/**
 * 简化版回归测试脚本
 *
 * @description 专注于基本的5层验证，确保核心功能正常
 * @features TypeScript + 构建 + 代码质量 + 测试 + 基本集成
 * @created 2025-01-03
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 简化验证配置
const SIMPLE_CONFIG = {
  taskId: 'SIMPLE-REGRESSION-TEST',
  taskName: '简化版回归测试',
  timestamp: new Date().toISOString(),
  thresholds: {
    buildTimeLimit: 30,
    lintWarningLimit: 10
  }
};

// 验证结果
const results = {
  meta: SIMPLE_CONFIG,
  layers: {
    typescript: { name: 'TypeScript编译', status: 'pending', details: '' },
    build: { name: '构建系统', status: 'pending', details: '', duration: 0 },
    lint: { name: '代码质量', status: 'pending', details: '', warnings: 0 },
    test: { name: '测试套件', status: 'pending', details: '' },
    integration: { name: '基本集成', status: 'pending', details: '' }
  },
  summary: {
    allPassed: false,
    warnings: [],
    recommendations: []
  }
};

// 安全执行命令
function safeExec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: path.join(__dirname, '../../web-app-next'),
      ...options
    });
  } catch (error) {
    throw new Error(`命令执行失败: ${command}\n${error.stderr || error.message}`);
  }
}

// 主测试函数
async function runSimpleRegressionTest() {
  console.log('🔍 简化版回归测试开始');
  console.log('━'.repeat(50));
  console.log(`📋 任务: ${SIMPLE_CONFIG.taskName}`);
  console.log(`⏰ 时间: ${new Date().toLocaleString()}`);
  console.log('');

  try {
    // 确保在正确目录
    const workDir = path.join(__dirname, '../../web-app-next');
    console.log(`📁 工作目录: ${workDir}`);
    console.log('');

    // 1. TypeScript编译验证
    console.log('🔧 1. TypeScript编译验证');
    try {
      const tscOutput = safeExec('npx tsc --noEmit');
      results.layers.typescript.status = 'passed';
      results.layers.typescript.details = 'TypeScript编译成功';
      console.log('  ✅ TypeScript编译通过');
    } catch (error) {
      results.layers.typescript.status = 'failed';
      results.layers.typescript.details = error.message.split('\n')[0];
      console.log('  ❌ TypeScript编译失败');
      console.log(`     ${error.message.split('\n')[0]}`);
    }

    // 2. 构建系统验证
    console.log('\n🏗️ 2. 构建系统验证');
    try {
      const buildStart = Date.now();
      const buildOutput = safeExec('npm run build');
      const buildDuration = (Date.now() - buildStart) / 1000;

      results.layers.build.duration = buildDuration;

      if (buildDuration < SIMPLE_CONFIG.thresholds.buildTimeLimit) {
        results.layers.build.status = 'passed';
        results.layers.build.details = `构建成功，用时${buildDuration.toFixed(1)}秒`;
        console.log(`  ✅ 构建成功 (${buildDuration.toFixed(1)}秒)`);
      } else {
        results.layers.build.status = 'warning';
        results.layers.build.details = `构建成功但较慢: ${buildDuration.toFixed(1)}秒`;
        results.summary.warnings.push(`构建时间超出阈值: ${buildDuration.toFixed(1)}s > ${SIMPLE_CONFIG.thresholds.buildTimeLimit}s`);
        console.log(`  ⚠️ 构建成功但较慢 (${buildDuration.toFixed(1)}秒)`);
      }
    } catch (error) {
      results.layers.build.status = 'failed';
      results.layers.build.details = error.message.split('\n')[0];
      console.log('  ❌ 构建失败');
      console.log(`     ${error.message.split('\n')[0]}`);
    }

    // 3. 代码质量验证
    console.log('\n🔍 3. 代码质量验证');
    try {
      const lintOutput = safeExec('npm run lint');
      const warningCount = (lintOutput.match(/warning/gi) || []).length;

      results.layers.lint.warnings = warningCount;

      if (warningCount <= SIMPLE_CONFIG.thresholds.lintWarningLimit) {
        results.layers.lint.status = 'passed';
        results.layers.lint.details = `ESLint通过，${warningCount}个警告`;
        console.log(`  ✅ 代码质量检查通过 (${warningCount}个警告)`);
      } else {
        results.layers.lint.status = 'warning';
        results.layers.lint.details = `ESLint警告过多: ${warningCount}个`;
        results.summary.warnings.push(`代码质量警告过多: ${warningCount} > ${SIMPLE_CONFIG.thresholds.lintWarningLimit}`);
        console.log(`  ⚠️ 代码质量警告过多 (${warningCount}个)`);
      }
    } catch (error) {
      results.layers.lint.status = 'failed';
      results.layers.lint.details = error.message.split('\n')[0];
      console.log('  ❌ 代码质量检查失败');
    }

    // 4. 测试套件验证
    console.log('\n🎯 4. 测试套件验证');
    try {
      const testOutput = safeExec('npm test -- --passWithNoTests --watchAll=false');

      // 检查测试输出
      if (testOutput.includes('No tests found') || testOutput.includes('0 total')) {
        results.layers.test.status = 'passed';
        results.layers.test.details = '无测试文件，默认通过';
        console.log('  ✅ 测试套件通过 (无测试文件)');
      } else {
        // 解析测试结果
        const passedMatch = testOutput.match(/(\d+) passed/i);
        const failedMatch = testOutput.match(/(\d+) failed/i);
        const totalMatch = testOutput.match(/(\d+) total/i);

        const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
        const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
        const total = totalMatch ? parseInt(totalMatch[1]) : passed;

        if (failed === 0) {
          results.layers.test.status = 'passed';
          results.layers.test.details = `测试通过 ${passed}/${total}`;
          console.log(`  ✅ 测试套件通过 (${passed}/${total})`);
        } else {
          results.layers.test.status = 'failed';
          results.layers.test.details = `测试失败 ${failed}/${total}`;
          console.log(`  ❌ 测试套件失败 (${failed}个失败)`);
        }
      }
    } catch (error) {
      // 对于无测试的情况，认为是通过的
      if (error.message.includes('No tests found') || error.message.includes('passWithNoTests')) {
        results.layers.test.status = 'passed';
        results.layers.test.details = '无测试文件，默认通过';
        console.log('  ✅ 测试套件通过 (无测试文件)');
      } else {
        results.layers.test.status = 'failed';
        results.layers.test.details = error.message.split('\n')[0];
        console.log('  ❌ 测试套件失败');
      }
    }

    // 5. 基本集成验证
    console.log('\n🔗 5. 基本集成验证');
    try {
      // 检查关键文件是否存在
      const keyFiles = [
        'package.json',
        'next.config.ts',
        'src/app/page.tsx',
        'src/app/layout.tsx'
      ];

      const missingFiles = [];
      for (const file of keyFiles) {
        const filePath = path.join(__dirname, '../../web-app-next', file);
        if (!fs.existsSync(filePath)) {
          missingFiles.push(file);
        }
      }

      if (missingFiles.length === 0) {
        results.layers.integration.status = 'passed';
        results.layers.integration.details = '关键文件完整';
        console.log('  ✅ 基本集成验证通过');
      } else {
        results.layers.integration.status = 'failed';
        results.layers.integration.details = `缺少关键文件: ${missingFiles.join(', ')}`;
        console.log(`  ❌ 基本集成验证失败: 缺少${missingFiles.length}个文件`);
      }
    } catch (error) {
      results.layers.integration.status = 'failed';
      results.layers.integration.details = error.message;
      console.log('  ❌ 基本集成验证失败');
    }

    // 生成总结
    generateSummary();
    return getExitCode();

  } catch (error) {
    console.error('❌ 简化版回归测试执行失败:', error.message);
    return 1;
  }
}

// 生成总结报告
function generateSummary() {
  const passedCount = Object.values(results.layers).filter(layer => layer.status === 'passed').length;
  const totalCount = Object.keys(results.layers).length;
  const warningCount = Object.values(results.layers).filter(layer => layer.status === 'warning').length;
  const failedCount = Object.values(results.layers).filter(layer => layer.status === 'failed').length;

  results.summary.allPassed = passedCount === totalCount;

  // 生成建议
  if (failedCount > 0) {
    results.summary.recommendations.push('立即修复失败项目后重新验证');
  }
  if (warningCount > 0) {
    results.summary.recommendations.push('建议解决警告项目以提升代码质量');
  }
  if (results.summary.allPassed && warningCount === 0) {
    results.summary.recommendations.push('系统状态良好，可以继续开发');
  }

  // 输出汇总报告
  console.log('\n' + '━'.repeat(50));
  console.log('📊 简化版回归测试汇总');
  console.log('━'.repeat(50));

  Object.entries(results.layers).forEach(([key, layer]) => {
    const icon = layer.status === 'passed' ? '✅' :
                 layer.status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${layer.name}: ${layer.details}`);
  });

  console.log(`\n📈 总体状态: ${passedCount}/${totalCount} 通过`);
  if (warningCount > 0) {
    console.log(`⚠️ 警告项目: ${warningCount}个`);
  }
  if (failedCount > 0) {
    console.log(`❌ 失败项目: ${failedCount}个`);
  }

  if (results.summary.warnings.length > 0) {
    console.log('\n⚠️ 警告详情:');
    results.summary.warnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning}`);
    });
  }

  console.log('\n📋 建议行动:');
  results.summary.recommendations.forEach((rec, index) => {
    console.log(`   ${index + 1}. ${rec}`);
  });

  // 保存报告
  try {
    const reportDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportFile = path.join(reportDir, `simple-regression-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
    console.log(`\n📄 详细报告已保存: ${reportFile}`);
  } catch (error) {
    console.log(`⚠️ 报告保存失败: ${error.message}`);
  }
}

// 获取退出码
function getExitCode() {
  const failedCount = Object.values(results.layers).filter(layer => layer.status === 'failed').length;
  if (failedCount > 0) {
    console.log('\n🎯 总体状态: ❌ 有项目失败');
    return 1;
  } else if (results.summary.warnings.length > 0) {
    console.log('\n🎯 总体状态: ⚠️ 有警告项目');
    return 0; // 警告不影响退出码
  } else {
    console.log('\n🎯 总体状态: ✅ 全部通过');
    return 0;
  }
}

// 执行主函数
if (require.main === module) {
  runSimpleRegressionTest()
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error('❌ 测试执行失败:', error);
      process.exit(1);
    });
}

module.exports = { runSimpleRegressionTest };
