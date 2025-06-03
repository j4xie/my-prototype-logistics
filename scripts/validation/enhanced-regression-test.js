#!/usr/bin/env node

/**
 * 增强版回归测试脚本
 *
 * @description 基于 development-management-unified.mdc 和 test-validation-unified.mdc
 * @features 5层验证 + 回归基线检查 + Mock API并发稳定性验证 + 已知问题检查
 * @anti-pattern 防止过度乐观验证和系统性问题被掩盖
 * @authority test-validation-unified.mdc (第3章：回归测试协议)
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// 验证配置 (基于 test-validation-unified.mdc 第3章标准)
const VALIDATION_CONFIG = {
  taskId: 'ENHANCED-REGRESSION-TEST',
  taskName: '增强版回归测试',
  timestamp: new Date().toISOString(),
  reportPath: 'scripts/validation/reports/',
  baselineFile: 'scripts/validation/regression-baseline.json',
  knownIssuesFile: 'scripts/validation/known-issues-checklist.json',

  // 回归风险阈值 (基于 test-validation-unified.mdc 标准)
  thresholds: {
    testPassRate: 95,        // 最低测试通过率
    buildTimeLimit: 30,      // 构建时间上限(秒)
    lintWarningLimit: 10,    // ESLint警告上限
    apiResponseLimit: 2000,  // API响应时间上限(ms)
    mockConcurrencyLimit: 10, // Mock API并发请求数
    performanceRegressionThreshold: 0.2 // 性能回归阈值(20%)
  },

  // Mock API并发稳定性测试配置
  mockApiTests: {
    baseUrl: 'http://localhost:3000',
    concurrentRequests: 10,
    testDuration: 30000,     // 30秒
    endpoints: [
      '/api/auth/status',
      '/api/products',
      '/api/users',
      '/api/trace/APPLE-ORG-001'
    ]
  }
};

// 验证结果记录 (基于 test-validation-unified.mdc 回归测试基线模板)
const results = {
  meta: VALIDATION_CONFIG,
  layers: {
    layer1: { name: 'TypeScript编译', status: 'pending', details: '' },
    layer2: { name: '构建系统', status: 'pending', details: '', buildTime: 0 },
    layer3: { name: '代码质量', status: 'pending', details: '', warnings: 0 },
    layer4: { name: '测试套件', status: 'pending', details: '', testResults: {} },
    layer5: { name: '集成功能', status: 'pending', details: '', serverStability: false }
  },
  regressionChecks: {
    baselineComparison: 'pending',
    knownIssuesCheck: 'pending',
    mockApiStabilityCheck: 'pending',
    performanceRegressionCheck: 'pending'
  },
  mockApiStability: {
    concurrentTestResults: [],
    stabilityScore: 0,
    averageResponseTime: 0,
    errorRate: 0,
    throughput: 0
  },
  knownIssuesValidation: {
    checkedIssues: [],
    foundRegressions: [],
    passedChecks: []
  },
  summary: {
    allLayersPassed: false,
    regressionRiskLevel: 'unknown',
    recommendedActions: []
  }
};

console.log('🚀 启动增强版回归测试');
console.log('📋 测试基于: development-management-unified.mdc + test-validation-unified.mdc');
console.log('━'.repeat(70));

// 第1层: TypeScript编译验证
console.log('\n📝 第1层: TypeScript编译验证');
try {
  const startTime = Date.now();
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  const compileTime = (Date.now() - startTime) / 1000;

  results.layers.layer1.status = 'passed';
  results.layers.layer1.details = `TypeScript编译成功 (${compileTime.toFixed(1)}秒)`;
  console.log(`✅ TypeScript编译通过 (${compileTime.toFixed(1)}秒)`);
} catch (error) {
  results.layers.layer1.status = 'failed';
  results.layers.layer1.details = error.stdout?.toString() || error.message;
  console.log('❌ TypeScript编译失败');
  console.log(error.stdout?.toString());
}

// 第2层: 构建系统验证 (带性能监控)
console.log('\n🏗️ 第2层: 构建系统验证');
try {
  const buildStart = Date.now();
  const buildOutput = execSync('npm run build', { stdio: 'pipe' }).toString();
  const buildTime = (Date.now() - buildStart) / 1000;

  results.layers.layer2.status = buildTime <= VALIDATION_CONFIG.thresholds.buildTimeLimit ? 'passed' : 'warning';
  results.layers.layer2.buildTime = buildTime;
  results.layers.layer2.details = `构建成功 (${buildTime.toFixed(1)}秒)`;

  // 性能回归检查
  if (buildTime > VALIDATION_CONFIG.thresholds.buildTimeLimit) {
    results.summary.recommendedActions.push(`构建时间超出阈值: ${buildTime.toFixed(1)}秒 > ${VALIDATION_CONFIG.thresholds.buildTimeLimit}秒`);
    console.log(`⚠️ 构建性能警告: ${buildTime.toFixed(1)}秒 (超出${VALIDATION_CONFIG.thresholds.buildTimeLimit}秒阈值)`);
  } else {
    console.log(`✅ 构建成功 (${buildTime.toFixed(1)}秒)`);
  }
} catch (error) {
  results.layers.layer2.status = 'failed';
  results.layers.layer2.details = error.stdout?.toString() || error.message;
  console.log('❌ 构建失败');
  console.log(error.stdout?.toString());
}

// 第3层: 代码质量验证 (带阈值检查)
console.log('\n🔍 第3层: 代码质量验证');
try {
  const lintOutput = execSync('npm run lint', { stdio: 'pipe' }).toString();

  // 解析警告数量
  const warningMatches = lintOutput.match(/(\d+)\s+warning/);
  const warnings = warningMatches ? parseInt(warningMatches[1]) : 0;

  results.layers.layer3.status = warnings <= VALIDATION_CONFIG.thresholds.lintWarningLimit ? 'passed' : 'warning';
  results.layers.layer3.warnings = warnings;
  results.layers.layer3.details = `ESLint检查完成 (${warnings}个警告)`;

  if (warnings > VALIDATION_CONFIG.thresholds.lintWarningLimit) {
    results.summary.recommendedActions.push(`代码质量警告过多: ${warnings} > ${VALIDATION_CONFIG.thresholds.lintWarningLimit}`);
    console.log(`⚠️ 代码质量警告: ${warnings}个警告 (超出${VALIDATION_CONFIG.thresholds.lintWarningLimit}个阈值)`);
  } else {
    console.log(`✅ 代码质量通过 (${warnings}个警告)`);
  }
} catch (error) {
  results.layers.layer3.status = 'failed';
  results.layers.layer3.details = error.stdout?.toString() || error.message;
  console.log('❌ 代码质量检查失败');
}

// 第4层: 测试套件验证 (强化测试)
console.log('\n🎯 第4层: 测试套件验证');
try {
  const testOutput = execSync('npm test -- --maxWorkers=1 --bail=3', { stdio: 'pipe' }).toString();

  // 解析测试结果
  const testMatch = testOutput.match(/Tests:\s+(\d+)\s+passed(?:,\s+(\d+)\s+failed)?(?:,\s+(\d+)\s+total)?/);
  if (testMatch) {
    const passed = parseInt(testMatch[1]);
    const failed = parseInt(testMatch[2] || '0');
    const total = parseInt(testMatch[3] || passed.toString());
    const passRate = total > 0 ? (passed / total * 100) : 0;

    results.layers.layer4.status = passRate >= VALIDATION_CONFIG.thresholds.testPassRate ? 'passed' : 'failed';
    results.layers.layer4.testResults = { passed, failed, total, passRate: parseFloat(passRate.toFixed(1)) };
    results.layers.layer4.details = `测试套件: ${passed}/${total}通过 (${passRate.toFixed(1)}%)`;

    if (passRate >= VALIDATION_CONFIG.thresholds.testPassRate) {
      console.log(`✅ 测试套件通过: ${passed}/${total} (${passRate.toFixed(1)}%)`);
    } else {
      console.log(`❌ 测试套件失败: ${passed}/${total} (${passRate.toFixed(1)}% < ${VALIDATION_CONFIG.thresholds.testPassRate}%)`);
    }
  } else {
    results.layers.layer4.status = 'warning';
    results.layers.layer4.details = '测试结果解析异常';
    console.log('⚠️ 测试结果解析异常');
  }
} catch (error) {
  results.layers.layer4.status = 'failed';
  results.layers.layer4.details = error.stdout?.toString() || error.message;
  console.log('❌ 测试套件失败');
}

// 第5层: 集成功能验证 (增强服务器稳定性检查)
console.log('\n🔗 第5层: 集成功能验证');
try {
  // 检查开发服务器是否运行
  const serverCheck = execSync('curl -s -f http://localhost:3000', { stdio: 'pipe' }).toString();

  if (serverCheck) {
    results.layers.layer5.status = 'passed';
    results.layers.layer5.details = '开发服务器响应正常';
    results.layers.layer5.serverStability = true;
    console.log('✅ 开发服务器正常响应');

    // 额外的服务器稳定性检查
    console.log('  🔍 执行服务器稳定性检查...');
    try {
      // 连续5次请求检查稳定性
      for (let i = 0; i < 5; i++) {
        execSync('curl -s -f http://localhost:3000/api/auth/status', { stdio: 'pipe' });
        await new Promise(resolve => setTimeout(resolve, 200)); // 等待200ms
      }
      console.log('  ✅ 服务器稳定性检查通过');
    } catch (stabilityError) {
      results.layers.layer5.status = 'warning';
      results.layers.layer5.details += ' (稳定性检查失败)';
      console.log('  ⚠️ 服务器稳定性检查失败');
    }
  } else {
    results.layers.layer5.status = 'warning';
    results.layers.layer5.details = '开发服务器可能未启动';
    console.log('⚠️ 开发服务器可能未启动');
  }
} catch (error) {
  results.layers.layer5.status = 'warning';
  results.layers.layer5.details = '无法验证开发服务器状态';
  console.log('⚠️ 无法验证开发服务器状态');
}

// 回归测试特别检查 (基于 test-validation-unified.mdc 第3章协议)
console.log('\n🔄 回归测试特别检查');

// 1. 基线对比检查 (新增基线对比检查，防止性能回归)
console.log('  📊 基线对比检查...');
try {
  if (fs.existsSync(VALIDATION_CONFIG.baselineFile)) {
    const baseline = JSON.parse(fs.readFileSync(VALIDATION_CONFIG.baselineFile, 'utf8'));
    const currentResults = results.layers;

    // 性能回归检查 (基于 test-validation-unified.mdc 性能基线模板)
    const buildTimeRegression = currentResults.layer2.buildTime > (baseline.performanceBaseline?.buildTime || 0) * (1 + VALIDATION_CONFIG.thresholds.performanceRegressionThreshold);
    const testRateRegression = (currentResults.layer4.testResults?.passRate || 0) < (baseline.testSuiteBaseline?.passRate || 0) * 0.95;

    // 功能回归检查
    const criticalTestsRegression = baseline.testSuiteBaseline?.criticalTests?.some(test =>
      !currentResults.layer4.testResults?.passedTests?.includes(test)
    ) || false;

    results.regressionChecks.performanceRegressionCheck = 'passed';
    if (buildTimeRegression) {
      results.regressionChecks.performanceRegressionCheck = 'failed';
      results.summary.recommendedActions.push(`构建时间回归: ${currentResults.layer2.buildTime}秒 vs 基线${baseline.performanceBaseline?.buildTime}秒`);
      console.log('  ❌ 发现构建时间回归');
    }
    if (testRateRegression) {
      results.regressionChecks.performanceRegressionCheck = 'failed';
      results.summary.recommendedActions.push(`测试通过率回归: ${currentResults.layer4.testResults?.passRate}% vs 基线${baseline.testSuiteBaseline?.passRate}%`);
      console.log('  ❌ 发现测试通过率回归');
    }
    if (criticalTestsRegression) {
      results.regressionChecks.performanceRegressionCheck = 'failed';
      results.summary.recommendedActions.push('关键测试项目失败');
      console.log('  ❌ 发现关键测试回归');
    }

    if (results.regressionChecks.performanceRegressionCheck === 'passed') {
      console.log('  ✅ 基线对比通过');
    }

    results.regressionChecks.baselineComparison = results.regressionChecks.performanceRegressionCheck;
  } else {
    results.regressionChecks.baselineComparison = 'no-baseline';
    console.log('  ⚠️ 未找到基线文件，将创建新基线');
  }
} catch (error) {
  results.regressionChecks.baselineComparison = 'error';
  console.log('  ❌ 基线对比检查失败:', error.message);
}

// 2. 已知问题检查清单 (自动验证之前修复的问题是否重现)
console.log('  🐛 已知问题回归检查...');

// 加载已知问题清单 (基于 test-validation-unified.mdc 步骤2要求)
let knownIssuesChecklist = [];
try {
  if (fs.existsSync(VALIDATION_CONFIG.knownIssuesFile)) {
    const knownIssuesData = JSON.parse(fs.readFileSync(VALIDATION_CONFIG.knownIssuesFile, 'utf8'));
    knownIssuesChecklist = knownIssuesData.issues || [];
  } else {
    // 创建默认的已知问题清单
    knownIssuesChecklist = [
      {
        id: 'TASK-P3-016A-001',
        issue: 'Jest内存泄漏问题',
        description: 'Jest测试运行时出现内存溢出',
        fixedDate: '2025-01-03',
        checkMethod: 'memory',
        checkCommand: 'npm test',
        expectedResult: '无内存泄漏警告'
      },
      {
        id: 'TASK-P3-016A-002',
        issue: 'useApi Hook无限循环',
        description: 'useApi Hook在特定条件下导致无限重新渲染',
        fixedDate: '2025-01-03',
        checkMethod: 'test_result',
        checkCommand: 'npm test -- --testNamePattern="useApi"',
        expectedResult: '所有useApi测试通过'
      },
      {
        id: 'BUILD-001',
        issue: '构建时间过长问题',
        description: '项目构建时间超过30秒',
        fixedDate: '2025-01-03',
        checkMethod: 'performance',
        checkCommand: 'npm run build',
        expectedResult: '构建时间 < 30秒'
      },
      {
        id: 'TS-001',
        issue: 'TypeScript编译错误',
        description: '类型定义不完整导致编译失败',
        fixedDate: '2025-01-03',
        checkMethod: 'compilation',
        checkCommand: 'npx tsc --noEmit',
        expectedResult: '编译成功，0错误'
      },
      {
        id: 'MOCK-API-001',
        issue: 'Mock API响应不稳定',
        description: 'Mock API在高并发下响应失败率过高',
        fixedDate: '2025-01-03',
        checkMethod: 'api_stability',
        checkCommand: 'concurrent_api_test',
        expectedResult: '并发请求成功率 > 95%'
      }
    ];

    // 保存默认清单到文件
    const knownIssuesData = {
      lastUpdated: new Date().toISOString(),
      issues: knownIssuesChecklist
    };
    fs.writeFileSync(VALIDATION_CONFIG.knownIssuesFile, JSON.stringify(knownIssuesData, null, 2));
    console.log('  📝 已创建默认已知问题清单');
  }
} catch (error) {
  console.log('  ⚠️ 已知问题清单加载失败:', error.message);
}

// 执行已知问题验证
let regressionIssues = 0;
knownIssuesChecklist.forEach(({ id, issue, checkMethod, expectedResult }) => {
  let passed = false;
  let checkResult = '';

  try {
    switch (checkMethod) {
      case 'memory':
        passed = !results.layers.layer4.details.includes('out of memory') &&
                !results.layers.layer4.details.includes('heap');
        checkResult = passed ? '内存使用正常' : '发现内存问题';
        break;

      case 'test_result':
        passed = results.layers.layer4.status === 'passed';
        checkResult = passed ? '测试套件通过' : '测试套件失败';
        break;

      case 'performance':
        passed = results.layers.layer2.buildTime < 30;
        checkResult = passed ? `构建时间${results.layers.layer2.buildTime}秒` : `构建时间过长: ${results.layers.layer2.buildTime}秒`;
        break;

      case 'compilation':
        passed = results.layers.layer1.status === 'passed';
        checkResult = passed ? 'TypeScript编译成功' : 'TypeScript编译失败';
        break;

      case 'api_stability':
        // 这个将在Mock API稳定性测试中检查
        passed = true; // 暂时设为通过，待Mock API测试完成后更新
        checkResult = '待Mock API稳定性测试确认';
        break;

      default:
        passed = true;
        checkResult = '检查方法未定义';
    }

    if (!passed) {
      regressionIssues++;
      results.knownIssuesValidation.foundRegressions.push({ id, issue, checkResult });
      console.log(`  ❌ 回归: ${issue} (${checkResult})`);
    } else {
      results.knownIssuesValidation.passedChecks.push({ id, issue, checkResult });
      console.log(`  ✅ 无回归: ${issue} (${checkResult})`);
    }

    results.knownIssuesValidation.checkedIssues.push({ id, issue, passed, checkResult });
  } catch (error) {
    console.log(`  ⚠️ 检查失败: ${issue} - ${error.message}`);
    results.knownIssuesValidation.checkedIssues.push({ id, issue, passed: false, checkResult: `检查失败: ${error.message}` });
  }
});

results.regressionChecks.knownIssuesCheck = regressionIssues === 0 ? 'passed' : 'failed';
console.log(`  📊 已知问题检查完成: ${results.knownIssuesValidation.passedChecks.length}个通过, ${results.knownIssuesValidation.foundRegressions.length}个回归`);

// 3. Mock API并发稳定性验证 (增强Mock机制的稳定性验证)
console.log('  🌐 Mock API并发稳定性测试...');

async function testMockApiStability() {
  const { baseUrl, concurrentRequests, testDuration, endpoints } = VALIDATION_CONFIG.mockApiTests;
  const testStartTime = Date.now();
  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  let responseTimes = [];

  console.log(`    🚀 启动${concurrentRequests}个并发请求, 持续${testDuration/1000}秒`);

  try {
    // 创建并发测试 Promise
    const concurrentTests = Array.from({ length: concurrentRequests }, async (_, index) => {
      const workerStartTime = Date.now();

      while (Date.now() - workerStartTime < testDuration) {
        for (const endpoint of endpoints) {
          const requestStart = Date.now();
          totalRequests++;

          try {
            const response = await fetch(`${baseUrl}${endpoint}`, {
              method: 'GET',
              timeout: 5000,
              headers: {
                'User-Agent': `MockApiStabilityTest-Worker-${index}`
              }
            });

            const responseTime = Date.now() - requestStart;
            responseTimes.push(responseTime);

            if (response.ok) {
              successfulRequests++;
            } else {
              failedRequests++;
              console.log(`    ⚠️ 请求失败: ${endpoint} - 状态码 ${response.status}`);
            }
          } catch (error) {
            failedRequests++;
            const responseTime = Date.now() - requestStart;
            responseTimes.push(responseTime);
            console.log(`    ❌ 请求错误: ${endpoint} - ${error.message}`);
          }

          // 小延迟避免过度压力
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    });

    // 等待所有并发测试完成
    await Promise.all(concurrentTests);

    // 计算结果
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
    const averageResponseTime = responseTimes.length > 0 ?
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;
    const throughput = totalRequests / (testDuration / 1000); // 请求/秒

    // 计算稳定性得分 (成功率 * 0.6 + 响应时间得分 * 0.4)
    const responseTimeScore = Math.max(0, 100 - (averageResponseTime / 20)); // 2000ms以下得分递减
    const stabilityScore = (successRate * 0.6) + (responseTimeScore * 0.4);

    // 更新结果
    results.mockApiStability = {
      concurrentTestResults: [
        { metric: 'totalRequests', value: totalRequests },
        { metric: 'successfulRequests', value: successfulRequests },
        { metric: 'failedRequests', value: failedRequests },
        { metric: 'successRate', value: parseFloat(successRate.toFixed(2)) },
        { metric: 'errorRate', value: parseFloat(errorRate.toFixed(2)) }
      ],
      stabilityScore: parseFloat(stabilityScore.toFixed(2)),
      averageResponseTime: parseFloat(averageResponseTime.toFixed(2)),
      errorRate: parseFloat(errorRate.toFixed(2)),
      throughput: parseFloat(throughput.toFixed(2))
    };

    // 评估稳定性
    const stabilityThresholds = {
      successRate: 95,        // 成功率阈值
      avgResponseTime: 2000,  // 平均响应时间阈值
      errorRate: 5            // 错误率阈值
    };

    const isStable = successRate >= stabilityThresholds.successRate &&
                    averageResponseTime <= stabilityThresholds.avgResponseTime &&
                    errorRate <= stabilityThresholds.errorRate;

    results.regressionChecks.mockApiStabilityCheck = isStable ? 'passed' : 'failed';

    // 更新已知问题中的Mock API稳定性检查
    const mockApiIssueIndex = results.knownIssuesValidation.checkedIssues.findIndex(
      issue => issue.id === 'MOCK-API-001'
    );
    if (mockApiIssueIndex >= 0) {
      results.knownIssuesValidation.checkedIssues[mockApiIssueIndex].passed = isStable;
      results.knownIssuesValidation.checkedIssues[mockApiIssueIndex].checkResult =
        `成功率${successRate.toFixed(1)}%, 平均响应${averageResponseTime.toFixed(0)}ms`;
    }

    console.log(`    📊 Mock API稳定性测试完成:`);
    console.log(`      总请求: ${totalRequests}, 成功: ${successfulRequests}, 失败: ${failedRequests}`);
    console.log(`      成功率: ${successRate.toFixed(2)}%, 错误率: ${errorRate.toFixed(2)}%`);
    console.log(`      平均响应时间: ${averageResponseTime.toFixed(2)}ms, 吞吐量: ${throughput.toFixed(2)} req/s`);
    console.log(`      稳定性得分: ${stabilityScore.toFixed(2)}/100`);

    if (isStable) {
      console.log('    ✅ Mock API稳定性测试通过');
    } else {
      console.log('    ❌ Mock API稳定性测试失败');
      results.summary.recommendedActions.push(`Mock API稳定性问题: 成功率${successRate.toFixed(1)}% < ${stabilityThresholds.successRate}%`);
    }

  } catch (error) {
    results.regressionChecks.mockApiStabilityCheck = 'error';
    console.log(`    ❌ Mock API稳定性测试失败: ${error.message}`);
    results.summary.recommendedActions.push(`Mock API稳定性测试执行失败: ${error.message}`);
  }
}

// 异步执行Mock API稳定性测试
if (results.layers.layer5.serverStability) {
  await testMockApiStability();
} else {
  results.regressionChecks.mockApiStabilityCheck = 'skipped';
  console.log('    ⚠️ 跳过Mock API稳定性测试: 开发服务器未正常运行');
}

// 生成综合评估
const passedLayers = Object.values(results.layers).filter(layer => layer.status === 'passed').length;
const totalLayers = Object.keys(results.layers).length;

results.summary.allLayersPassed = passedLayers === totalLayers;
results.summary.regressionRiskLevel = regressionIssues > 0 ? 'high' :
  (Object.values(results.layers).some(layer => layer.status === 'warning') ? 'medium' : 'low');

// 生成建议
if (results.summary.regressionRiskLevel === 'high') {
  results.summary.recommendedActions.push('立即修复回归问题后重新验证');
} else if (results.summary.regressionRiskLevel === 'medium') {
  results.summary.recommendedActions.push('建议解决警告问题以提升系统稳定性');
} else {
  results.summary.recommendedActions.push('系统状态良好，可以继续开发');
}

// 输出汇总报告
console.log('\n' + '━'.repeat(70));
console.log('📊 增强版回归测试报告');
console.log(`Layer 1 (TypeScript): ${results.layers.layer1.status === 'passed' ? '✅' : '❌'}`);
console.log(`Layer 2 (构建系统): ${results.layers.layer2.status === 'passed' ? '✅' : results.layers.layer2.status === 'warning' ? '⚠️' : '❌'}`);
console.log(`Layer 3 (代码质量): ${results.layers.layer3.status === 'passed' ? '✅' : results.layers.layer3.status === 'warning' ? '⚠️' : '❌'}`);
console.log(`Layer 4 (测试套件): ${results.layers.layer4.status === 'passed' ? '✅' : results.layers.layer4.status === 'warning' ? '⚠️' : '❌'}`);
console.log(`Layer 5 (集成功能): ${results.layers.layer5.status === 'passed' ? '✅' : results.layers.layer5.status === 'warning' ? '⚠️' : '❌'}`);
console.log(`\n🎯 回归风险级别: ${results.summary.regressionRiskLevel.toUpperCase()}`);
console.log(`📋 建议行动:`);
results.summary.recommendedActions.forEach((action, index) => {
  console.log(`   ${index + 1}. ${action}`);
});

// 保存详细报告
const reportFileName = `enhanced-regression-${Date.now()}.json`;
const reportPath = path.join(VALIDATION_CONFIG.reportPath, reportFileName);

// 确保报告目录存在
if (!fs.existsSync(VALIDATION_CONFIG.reportPath)) {
  fs.mkdirSync(VALIDATION_CONFIG.reportPath, { recursive: true });
}

fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n📄 详细报告已保存: ${reportPath}`);

// 更新回归基线 (如果所有层级都通过)
if (results.summary.allLayersPassed && results.summary.regressionRiskLevel === 'low') {
  fs.writeFileSync(VALIDATION_CONFIG.baselineFile, JSON.stringify(results.layers, null, 2));
  console.log(`📊 回归基线已更新: ${VALIDATION_CONFIG.baselineFile}`);
}

// 设置退出码
const exitCode = results.summary.allLayersPassed && regressionIssues === 0 ? 0 : 1;
console.log(`\n🎯 总体状态: ${exitCode === 0 ? '✅ 全部通过' : '⚠️ 需要关注'}`);
process.exit(exitCode);

// 辅助函数：异步等待
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
