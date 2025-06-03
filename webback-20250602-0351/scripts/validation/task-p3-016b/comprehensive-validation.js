#!/usr/bin/env node

/**
 * TASK-P3-016B 综合验证脚本
 * AI数据分析API优化与智能缓存 - 完整验证流程
 * 
 * @validation-type comprehensive-5-layer
 * @task TASK-P3-016B
 * @description AI数据分析API优化与智能缓存验证
 * @anti-pattern 防止AI组件集成问题被忽视
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 验证元数据
const VALIDATION_META = {
  taskId: 'TASK-P3-016B',
  taskName: 'AI数据分析API优化与智能缓存',
  validationType: 'comprehensive-ai-integration',
  targetFiles: [
    'web-app-next/src/lib/ai-cache-manager.ts',
    'web-app-next/src/lib/ai-batch-controller.ts', 
    'web-app-next/src/lib/storage-adapter.ts',
    'web-app-next/src/lib/ai-error-handler.ts',
    'web-app-next/src/hooks/useAiDataFetch.ts',
    'web-app-next/src/components/ui/ai-performance-monitor.tsx',
    'web-app-next/src/components/ai-global-monitor.tsx',
    'web-app-next/src/app/ai-demo/page.tsx'
  ],
  aiComponents: [
    'AiCacheManager',
    'AiBatchController', 
    'useAiDataFetch',
    'AiPerformanceMonitor'
  ],
  dependencies: ['TASK-P3-016A'],
  timestamp: new Date().toISOString()
};

// 验证结果记录
const results = {
  layer1: { name: 'TypeScript编译', status: 'pending', errors: [] },
  layer2: { name: '构建系统', status: 'pending', errors: [] },
  layer3: { name: '代码质量', status: 'pending', warnings: [] },
  layer4: { name: '测试套件', status: 'pending', results: {} },
  layer5: { name: '集成功能', status: 'pending', responses: [] },
  aiComponents: { name: 'AI组件验证', status: 'pending', components: {} },
  summary: {}
};

console.log('🔍 开始TASK-P3-016B综合验证流程...\n');
console.log('📋 验证目标:', VALIDATION_META.taskName);
console.log('🎯 AI组件:', VALIDATION_META.aiComponents.join(', '));
console.log('━'.repeat(60));

// 第1层: TypeScript编译检查
console.log('\n📝 第1层: TypeScript编译检查');
try {
  execSync('cd web-app-next && npm run type-check', { stdio: 'pipe' });
  results.layer1.status = 'passed';
  console.log('✅ TypeScript编译通过 (0错误)');
} catch (error) {
  results.layer1.status = 'failed';
  results.layer1.errors = error.stdout?.toString().split('\n').filter(line => line.trim());
  console.log('❌ TypeScript编译失败');
  console.log(error.stdout?.toString());
}

// 第2层: 构建系统验证
console.log('\n🏗️ 第2层: 构建系统验证');
try {
  const buildStart = Date.now();
  execSync('cd web-app-next && npm run build', { stdio: 'pipe' });
  const buildTime = (Date.now() - buildStart) / 1000;
  results.layer2.status = 'passed';
  results.layer2.buildTime = buildTime;
  console.log(`✅ 构建成功 (${buildTime.toFixed(1)}秒)`);
} catch (error) {
  results.layer2.status = 'failed';
  results.layer2.errors = error.stdout?.toString().split('\n').filter(line => line.includes('Error'));
  console.log('❌ 构建失败');
  console.log(error.stdout?.toString());
}

// 第3层: 代码质量检查
console.log('\n🔍 第3层: 代码质量检查');
try {
  const lintOutput = execSync('cd web-app-next && npm run lint', { stdio: 'pipe' }).toString();
  const warnings = lintOutput.split('\n').filter(line => line.includes('Warning')).length;
  results.layer3.status = warnings < 10 ? 'passed' : 'warning';
  results.layer3.warnings = warnings;
  console.log(`${warnings < 10 ? '✅' : '⚠️'} ESLint检查 (${warnings}个警告)`);
} catch (error) {
  results.layer3.status = 'failed';
  console.log('❌ ESLint检查失败');
  console.log(error.stdout?.toString());
}

// 第4层: 测试套件验证
console.log('\n🎯 第4层: 测试套件验证');
try {
  const testOutput = execSync('cd web-app-next && npm test', { stdio: 'pipe' }).toString();
  const testMatch = testOutput.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
  if (testMatch) {
    const passed = parseInt(testMatch[1]);
    const total = parseInt(testMatch[2]);
    const passRate = (passed / total * 100).toFixed(1);
    results.layer4.status = passRate >= 95 ? 'passed' : 'warning';
    results.layer4.results = { passed, total, passRate: parseFloat(passRate) };
    console.log(`${passRate >= 95 ? '✅' : '⚠️'} 测试套件 (${passed}/${total}通过, ${passRate}%)`);
  }
} catch (error) {
  results.layer4.status = 'failed';
  console.log('❌ 测试套件失败');
  console.log(error.stdout?.toString());
}

// 第5层: 集成功能验证
console.log('\n🔗 第5层: 集成功能验证');
try {
  // 检查开发服务器端口 (Next.js在3004端口)
  const curlOutput = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:3004', { stdio: 'pipe' }).toString();
  if (curlOutput.includes('200')) {
    results.layer5.status = 'passed';
    results.layer5.responses.push('HTTP 200');
    console.log('✅ 开发服务器正常响应 (HTTP 200)');
  } else {
    results.layer5.status = 'warning';
    console.log('⚠️ 开发服务器可能未启动或使用不同端口');
  }
} catch (error) {
  results.layer5.status = 'warning';
  console.log('⚠️ 无法验证开发服务器状态');
}

// AI组件特别验证
console.log('\n🤖 AI组件特别验证');
VALIDATION_META.targetFiles.forEach(file => {
  try {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const size = (content.length / 1024).toFixed(1);
      results.aiComponents.components[file] = { exists: true, size: `${size}KB` };
      console.log(`✅ ${file} (${size}KB)`);
    } else {
      results.aiComponents.components[file] = { exists: false };
      console.log(`❌ ${file} (文件不存在)`);
    }
  } catch (error) {
    results.aiComponents.components[file] = { exists: false, error: error.message };
    console.log(`❌ ${file} (读取失败)`);
  }
});

// 生成验证报告
const allPassed = [
  results.layer1.status,
  results.layer2.status, 
  results.layer3.status,
  results.layer4.status,
  results.layer5.status
].every(status => status === 'passed');

results.summary = {
  allLayersPassed: allPassed,
  timestamp: new Date().toISOString(),
  overallStatus: allPassed ? 'PASSED' : 'NEEDS_ATTENTION',
  meta: VALIDATION_META
};

console.log('\n' + '━'.repeat(60));
console.log('📊 验证结果汇总:');
console.log(`第1层 (TypeScript): ${results.layer1.status === 'passed' ? '✅' : '❌'}`);
console.log(`第2层 (构建系统): ${results.layer2.status === 'passed' ? '✅' : '❌'}`);
console.log(`第3层 (代码质量): ${results.layer3.status === 'passed' ? '✅' : results.layer3.status === 'warning' ? '⚠️' : '❌'}`);
console.log(`第4层 (测试套件): ${results.layer4.status === 'passed' ? '✅' : results.layer4.status === 'warning' ? '⚠️' : '❌'}`);
console.log(`第5层 (集成功能): ${results.layer5.status === 'passed' ? '✅' : results.layer5.status === 'warning' ? '⚠️' : '❌'}`);
console.log(`\n🎯 总体状态: ${allPassed ? '✅ 全部通过' : '⚠️ 需要关注'}`);

// 保存验证报告
const reportPath = path.join(__dirname, 'reports', `validation-${Date.now()}.json`);
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n📄 验证报告已保存: ${reportPath}`);

// 退出码
process.exit(allPassed ? 0 : 1); 