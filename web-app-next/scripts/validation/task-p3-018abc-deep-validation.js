#!/usr/bin/env node

/**
 * TASK-P3-018ABC深度验证脚本
 *
 * 验证Mock架构重组阶段的三个关键任务：
 * - P3-017B (原P3-018A): Mock API统一架构设计
 * - P3-018B: 中央Mock服务实现
 * - P3-018C: UI Hook层统一改造
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 开始TASK-P3-018ABC深度验证...\n');

// 项目根目录 - 需要向上两级到heiniu目录
const projectRoot = path.resolve(__dirname, '../../..');
const webAppNext = path.resolve(__dirname, '..');

// 验证结果收集
const results = {
  'P3-017B': { passed: 0, failed: 0, checks: [] },
  'P3-018B': { passed: 0, failed: 0, checks: [] },
  'P3-018C': { passed: 0, failed: 0, checks: [] },
  'integration': { passed: 0, failed: 0, checks: [] }
};

function checkFile(filePath, taskName, checkName) {
  const fullPath = path.resolve(projectRoot, filePath);
  const exists = fs.existsSync(fullPath);

  if (exists) {
    const stats = fs.statSync(fullPath);
    const size = stats.size;
    results[taskName].passed++;
    results[taskName].checks.push(`✅ ${checkName} (${size} bytes)`);
    return true;
  } else {
    results[taskName].failed++;
    results[taskName].checks.push(`❌ ${checkName} - 文件不存在: ${fullPath}`);
    return false;
  }
}

function checkContent(filePath, searchText, taskName, checkName) {
  try {
    const fullPath = path.resolve(projectRoot, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const found = content.includes(searchText);

    if (found) {
      results[taskName].passed++;
      results[taskName].checks.push(`✅ ${checkName}`);
      return true;
    } else {
      results[taskName].failed++;
      results[taskName].checks.push(`❌ ${checkName} - 内容未找到`);
      return false;
    }
  } catch (error) {
    results[taskName].failed++;
    results[taskName].checks.push(`❌ ${checkName} - 文件读取失败: ${error.message}`);
    return false;
  }
}

function countLines(filePath) {
  try {
    const fullPath = path.resolve(projectRoot, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    return content.split('\n').length;
  } catch (error) {
    return 0;
  }
}

// =============================================================================
// P3-017B (原P3-018A) Mock API统一架构设计验证
// =============================================================================
console.log('📋 验证P3-017B: Mock API统一架构设计');

// 1. 架构设计文档
checkFile('docs/architecture/mock-api-architecture.md', 'P3-017B', '架构设计文档');
checkContent('docs/architecture/mock-api-architecture.md', 'MSW (Mock Service Worker)', 'P3-017B', 'MSW技术选型');
checkContent('docs/architecture/mock-api-architecture.md', 'OpenAPI 3.0', 'P3-017B', 'OpenAPI Schema');

// 2. Schema文件
checkFile('docs/api/openapi.yaml', 'P3-017B', 'OpenAPI Schema文件');
checkFile('docs/api/async-api.yaml', 'P3-017B', 'AsyncAPI Schema文件');

const openapiLines = countLines('docs/api/openapi.yaml');
if (openapiLines > 1000) {
  results['P3-017B'].passed++;
  results['P3-017B'].checks.push(`✅ OpenAPI Schema详细度 (${openapiLines} 行)`);
} else {
  results['P3-017B'].failed++;
  results['P3-017B'].checks.push(`❌ OpenAPI Schema不够详细 (仅${openapiLines}行)`);
}

// =============================================================================
// P3-018B 中央Mock服务实现验证
// =============================================================================
console.log('\n📋 验证P3-018B: 中央Mock服务实现');

// 1. MSW核心架构
checkFile('web-app-next/src/mocks/handlers/index.ts', 'P3-018B', 'MSW Handlers统一入口');
checkFile('web-app-next/src/mocks/node-server.ts', 'P3-018B', 'MSW Node端服务器');
checkFile('web-app-next/tests/jest-environment-msw.js', 'P3-018B', 'MSW Jest环境');

// 2. 业务模块Handlers
const mockModules = ['auth', 'users', 'farming', 'processing', 'logistics', 'admin', 'trace', 'products'];
mockModules.forEach(module => {
  checkFile(`web-app-next/src/mocks/handlers/${module}.ts`, 'P3-018B', `${module}模块Handler`);
});

// 3. 验证Handler数量
checkContent('web-app-next/src/mocks/handlers/index.ts', 'total handlers', 'P3-018B', 'Handlers统计系统');

// 4. MSW配置
checkFile('web-app-next/src/mocks/config/environments.ts', 'P3-018B', '环境配置文件');
checkFile('web-app-next/src/mocks/config/middleware.ts', 'P3-018B', '中间件配置');

// =============================================================================
// P3-018C UI Hook层统一改造验证
// =============================================================================
console.log('\n📋 验证P3-018C: UI Hook层统一改造');

// 1. API配置中心
checkFile('web-app-next/src/lib/api-config.ts', 'P3-018C', 'API配置中心');
checkContent('web-app-next/src/lib/api-config.ts', 'mockEnabled', 'P3-018C', 'Mock环境感知');

// 2. 升级后的API客户端
checkFile('web-app-next/src/lib/api.ts', 'P3-018C', '升级API客户端');
checkContent('web-app-next/src/lib/api.ts', 'mockConfig', 'P3-018C', 'Mock感知集成');

// 3. Mock状态Hook
checkFile('web-app-next/src/hooks/useMockStatus.ts', 'P3-018C', 'Mock状态Hook');
checkContent('web-app-next/src/hooks/useMockStatus.ts', 'MockStatusResult', 'P3-018C', 'Mock状态接口');

// 4. 开发工具
checkFile('web-app-next/src/components/dev/MockToggle.tsx', 'P3-018C', 'Mock切换控制台');
checkContent('web-app-next/src/components/dev/MockToggle.tsx', 'useMockStatus', 'P3-018C', 'Hook集成');

// 5. Hook使用指南
checkFile('web-app-next/src/hooks/api/README.md', 'P3-018C', 'Hook使用指南');

// =============================================================================
// 集成验证
// =============================================================================
console.log('\n📋 验证集成功能');

// 1. TypeScript编译验证
try {
  const { execSync } = require('child_process');
  execSync('npx tsc --noEmit', {
    cwd: webAppNext,
    stdio: 'pipe'
  });
  results.integration.passed++;
  results.integration.checks.push('✅ TypeScript编译通过');
} catch (error) {
  results.integration.failed++;
  results.integration.checks.push('❌ TypeScript编译失败');
}

// 2. ESLint验证
try {
  const { execSync } = require('child_process');
  const output = execSync('npm run lint', {
    cwd: webAppNext,
    stdio: 'pipe'
  }).toString();

  if (output.includes('No ESLint warnings or errors')) {
    results.integration.passed++;
    results.integration.checks.push('✅ ESLint检查通过');
  } else {
    results.integration.failed++;
    results.integration.checks.push('❌ ESLint存在警告或错误');
  }
} catch (error) {
  results.integration.failed++;
  results.integration.checks.push('❌ ESLint检查失败');
}

// 3. Jest测试核心验证
try {
  const { execSync } = require('child_process');
  execSync('npm test -- --testNamePattern="contract-validation" --passWithNoTests', {
    cwd: webAppNext,
    stdio: 'pipe'
  });
  results.integration.passed++;
  results.integration.checks.push('✅ Contract验证测试通过');
} catch (error) {
  results.integration.failed++;
  results.integration.checks.push('❌ Contract验证测试失败');
}

// =============================================================================
// 生成验证报告
// =============================================================================
console.log('\n📊 深度验证报告\n');

Object.keys(results).forEach(taskName => {
  const task = results[taskName];
  const total = task.passed + task.failed;
  const percentage = total > 0 ? ((task.passed / total) * 100).toFixed(1) : '0.0';

  console.log(`\n=== ${taskName.toUpperCase()} ===`);
  console.log(`完成度: ${percentage}% (${task.passed}/${total})`);
  console.log('检查详情:');
  task.checks.forEach(check => console.log(`  ${check}`));
});

// 总体统计
const totalPassed = Object.values(results).reduce((sum, task) => sum + task.passed, 0);
const totalChecks = Object.values(results).reduce((sum, task) => sum + task.passed + task.failed, 0);
const overallPercentage = totalChecks > 0 ? ((totalPassed / totalChecks) * 100).toFixed(1) : '0.0';

console.log('\n' + '='.repeat(50));
console.log(`🎯 总体完成度: ${overallPercentage}% (${totalPassed}/${totalChecks})`);

if (overallPercentage >= 95) {
  console.log('🎉 验证结果: TASK-P3-018ABC达到优秀水平 (≥95%)');
} else if (overallPercentage >= 85) {
  console.log('✅ 验证结果: TASK-P3-018ABC达到良好水平 (≥85%)');
} else if (overallPercentage >= 70) {
  console.log('⚠️ 验证结果: TASK-P3-018ABC达到及格水平 (≥70%)，建议改进');
} else {
  console.log('❌ 验证结果: TASK-P3-018ABC未达到最低标准 (<70%)，需要重点修复');
}

console.log('\n深度验证完成！');
console.log('\n调试信息:');
console.log(`项目根目录: ${projectRoot}`);
console.log(`Web应用目录: ${webAppNext}`);
