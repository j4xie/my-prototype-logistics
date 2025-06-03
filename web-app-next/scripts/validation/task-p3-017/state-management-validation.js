#!/usr/bin/env node

/**
 * TASK-P3-017 状态管理集成扩展验证脚本
 * 验证AI状态管理和离线状态管理功能
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 TASK-P3-017 状态管理集成扩展验证开始...\n');

// 验证结果收集
const results = {
  typeDefinitions: { passed: 0, total: 0, details: [] },
  storeImplementation: { passed: 0, total: 0, details: [] },
  hooksImplementation: { passed: 0, total: 0, details: [] },
  demoComponent: { passed: 0, total: 0, details: [] },
  integration: { passed: 0, total: 0, details: [] }
};

// 1. 验证类型定义扩展
console.log('📋 1. 验证状态类型定义扩展...');

const stateTypesPath = path.join(__dirname, '../../../src/types/state.ts');
if (fs.existsSync(stateTypesPath)) {
  const stateTypesContent = fs.readFileSync(stateTypesPath, 'utf8');

  // 检查AI状态类型
  const aiStateChecks = [
    { name: 'AiState接口', pattern: /interface AiState\s*{/ },
    { name: 'AI缓存状态', pattern: /cache:\s*{/ },
    { name: 'AI批量处理状态', pattern: /batch:\s*{/ },
    { name: 'AI性能监控状态', pattern: /performance:\s*{/ },
    { name: 'AI错误处理状态', pattern: /errors:\s*{/ }
  ];

  aiStateChecks.forEach(check => {
    results.typeDefinitions.total++;
    if (check.pattern.test(stateTypesContent)) {
      results.typeDefinitions.passed++;
      results.typeDefinitions.details.push(`✅ ${check.name}`);
    } else {
      results.typeDefinitions.details.push(`❌ ${check.name}`);
    }
  });

  // 检查离线状态类型
  const offlineStateChecks = [
    { name: 'ExtendedOfflineState接口', pattern: /interface ExtendedOfflineState\s*{/ },
    { name: 'QueueStatus枚举', pattern: /enum QueueStatus\s*{/ },
    { name: 'SyncStatus枚举', pattern: /enum SyncStatus\s*{/ },
    { name: 'AiOperation类型', pattern: /interface AiOperation\s*{/ },
    { name: 'ExtendedAppState接口', pattern: /interface ExtendedAppState.*extends.*AppState/ }
  ];

  offlineStateChecks.forEach(check => {
    results.typeDefinitions.total++;
    if (check.pattern.test(stateTypesContent)) {
      results.typeDefinitions.passed++;
      results.typeDefinitions.details.push(`✅ ${check.name}`);
    } else {
      results.typeDefinitions.details.push(`❌ ${check.name}`);
    }
  });
} else {
  results.typeDefinitions.details.push('❌ state.ts文件不存在');
}

// 2. 验证Store实现
console.log('📋 2. 验证应用状态管理Store实现...');

const appStorePath = path.join(__dirname, '../../../src/store/appStore.ts');
if (fs.existsSync(appStorePath)) {
  const appStoreContent = fs.readFileSync(appStorePath, 'utf8');

  const storeChecks = [
    { name: 'AI状态默认值', pattern: /getDefaultAiState/ },
    { name: '离线状态默认值', pattern: /getDefaultOfflineState/ },
    { name: 'AI缓存更新方法', pattern: /updateAiCache:/ },
    { name: 'AI批量处理更新方法', pattern: /updateAiBatch:/ },
    { name: 'AI性能监控更新方法', pattern: /updateAiPerformance:/ },
    { name: 'AI错误处理更新方法', pattern: /updateAiErrors:/ },
    { name: '离线模式设置方法', pattern: /setOfflineMode:/ },
    { name: '队列状态更新方法', pattern: /updateQueueStatus:/ },
    { name: '同步触发方法', pattern: /triggerSync:/ },
    { name: 'AI操作管理方法', pattern: /addAiOperation:/ }
  ];

  storeChecks.forEach(check => {
    results.storeImplementation.total++;
    if (check.pattern.test(appStoreContent)) {
      results.storeImplementation.passed++;
      results.storeImplementation.details.push(`✅ ${check.name}`);
    } else {
      results.storeImplementation.details.push(`❌ ${check.name}`);
    }
  });
} else {
  results.storeImplementation.details.push('❌ appStore.ts文件不存在');
}

// 3. 验证Hooks实现
console.log('📋 3. 验证状态管理Hooks实现...');

const aiStateHooksPath = path.join(__dirname, '../../../src/hooks/useAiState.ts');
if (fs.existsSync(aiStateHooksPath)) {
  const aiStateHooksContent = fs.readFileSync(aiStateHooksPath, 'utf8');

  const hooksChecks = [
    { name: 'useAiCache Hook', pattern: /export const useAiCache/ },
    { name: 'useAiBatch Hook', pattern: /export const useAiBatch/ },
    { name: 'useAiPerformance Hook', pattern: /export const useAiPerformance/ },
    { name: 'useAiErrors Hook', pattern: /export const useAiErrors/ },
    { name: 'useAiState综合Hook', pattern: /export const useAiState/ },
    { name: 'useOfflineState Hook', pattern: /export const useOfflineState/ },
    { name: '缓存命中率计算', pattern: /updateHitRate/ },
    { name: '性能健康度计算', pattern: /updateSystemHealth/ },
    { name: '网络状态监听', pattern: /addEventListener.*online/ }
  ];

  hooksChecks.forEach(check => {
    results.hooksImplementation.total++;
    if (check.pattern.test(aiStateHooksContent)) {
      results.hooksImplementation.passed++;
      results.hooksImplementation.details.push(`✅ ${check.name}`);
    } else {
      results.hooksImplementation.details.push(`❌ ${check.name}`);
    }
  });
} else {
  results.hooksImplementation.details.push('❌ useAiState.ts文件不存在');
}

// 4. 验证演示组件
console.log('📋 4. 验证状态管理演示组件...');

const demoComponentPath = path.join(__dirname, '../../../src/components/test/StateManagementDemo.tsx');
if (fs.existsSync(demoComponentPath)) {
  const demoContent = fs.readFileSync(demoComponentPath, 'utf8');

  const demoChecks = [
    { name: '演示组件导出', pattern: /export.*StateManagementDemo/ },
    { name: 'AI缓存演示', pattern: /AI缓存状态/ },
    { name: 'AI批量处理演示', pattern: /AI批量处理/ },
    { name: '离线状态演示', pattern: /离线状态管理/ },
    { name: 'AI操作队列演示', pattern: /AI操作队列/ },
    { name: '交互式测试按钮', pattern: /button.*onClick/ }
  ];

  demoChecks.forEach(check => {
    results.demoComponent.total++;
    if (check.pattern.test(demoContent)) {
      results.demoComponent.passed++;
      results.demoComponent.details.push(`✅ ${check.name}`);
    } else {
      results.demoComponent.details.push(`❌ ${check.name}`);
    }
  });

  // 检查文件大小
  const stats = fs.statSync(demoComponentPath);
  const fileSizeKB = (stats.size / 1024).toFixed(1);
  results.demoComponent.total++;
  if (stats.size > 5000) { // 至少5KB，表示有实质内容
    results.demoComponent.passed++;
    results.demoComponent.details.push(`✅ 组件文件大小: ${fileSizeKB}KB`);
  } else {
    results.demoComponent.details.push(`❌ 组件文件过小: ${fileSizeKB}KB`);
  }
} else {
  results.demoComponent.details.push('❌ StateManagementDemo.tsx文件不存在');
}

// 5. 验证集成完整性
console.log('📋 5. 验证系统集成完整性...');

// 检查导入导出
const indexPath = path.join(__dirname, '../../../src/hooks/index.ts');
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  results.integration.total++;
  if (indexContent.includes('useAiState')) {
    results.integration.passed++;
    results.integration.details.push('✅ useAiState Hook已导出');
  } else {
    results.integration.details.push('❌ useAiState Hook未导出');
  }
}

// 检查类型导出
if (fs.existsSync(stateTypesPath)) {
  const stateTypesContent = fs.readFileSync(stateTypesPath, 'utf8');
  results.integration.total++;
  if (stateTypesContent.includes('export') && stateTypesContent.includes('AiState')) {
    results.integration.passed++;
    results.integration.details.push('✅ AI状态类型已导出');
  } else {
    results.integration.details.push('❌ AI状态类型未正确导出');
  }
}

// 检查Store集成
if (fs.existsSync(appStorePath)) {
  const appStoreContent = fs.readFileSync(appStorePath, 'utf8');
  results.integration.total++;
  if (appStoreContent.includes('ai:') && appStoreContent.includes('offlineExtended:')) {
    results.integration.passed++;
    results.integration.details.push('✅ AI和离线状态已集成到Store');
  } else {
    results.integration.details.push('❌ AI和离线状态未完全集成到Store');
  }
}

// 输出验证结果
console.log('\n📊 验证结果汇总:');
console.log('=====================================');

Object.entries(results).forEach(([category, result]) => {
  const percentage = result.total > 0 ? ((result.passed / result.total) * 100).toFixed(1) : '0.0';
  const status = result.passed === result.total ? '✅' : result.passed > 0 ? '⚠️' : '❌';

  console.log(`\n${status} ${category}: ${result.passed}/${result.total} (${percentage}%)`);
  result.details.forEach(detail => console.log(`   ${detail}`));
});

// 计算总体通过率
const totalPassed = Object.values(results).reduce((sum, result) => sum + result.passed, 0);
const totalTests = Object.values(results).reduce((sum, result) => sum + result.total, 0);
const overallPercentage = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';

console.log('\n🎯 总体验证结果:');
console.log('=====================================');
console.log(`总通过率: ${totalPassed}/${totalTests} (${overallPercentage}%)`);

if (overallPercentage >= 90) {
  console.log('🎉 TASK-P3-017 状态管理集成扩展验证通过！');
  process.exit(0);
} else if (overallPercentage >= 70) {
  console.log('⚠️ TASK-P3-017 状态管理集成扩展基本完成，但需要优化');
  process.exit(1);
} else {
  console.log('❌ TASK-P3-017 状态管理集成扩展验证失败，需要重大修复');
  process.exit(2);
}
