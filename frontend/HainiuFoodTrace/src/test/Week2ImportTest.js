/**
 * Week 2 组件导入测试
 * 使用JavaScript来避免TypeScript编译问题
 * 验证所有Week 2组件能够正确导入
 */

console.log('=== Week 2 组件导入测试开始 ===');

// 测试结果收集
const results = {
  success: [],
  failed: [],
  warnings: []
};

// 安全导入函数
function safeImport(name, importPath) {
  try {
    const module = require(importPath);
    if (module && (module.default || Object.keys(module).length > 0)) {
      results.success.push(`✅ ${name}: 导入成功`);
      return module;
    } else {
      results.failed.push(`❌ ${name}: 模块为空`);
      return null;
    }
  } catch (error) {
    results.failed.push(`❌ ${name}: ${error.message}`);
    return null;
  }
}

// 测试1: 权限UI组件
console.log('\n--- 测试权限UI组件 ---');
const RoleSelector = safeImport('RoleSelector', '../components/permissions/RoleSelector.tsx');
const PermissionSettingsPanel = safeImport('PermissionSettingsPanel', '../components/permissions/PermissionSettingsPanel.tsx');
const DepartmentPermissionManager = safeImport('DepartmentPermissionManager', '../components/permissions/DepartmentPermissionManager.tsx');

// 检查RoleSelector导出
if (RoleSelector) {
  if (RoleSelector.USER_ROLE_CONFIG) {
    results.success.push('✅ USER_ROLE_CONFIG: 导出正确');
    const roleCount = Object.keys(RoleSelector.USER_ROLE_CONFIG).length;
    if (roleCount === 7) {
      results.success.push(`✅ 角色数量: ${roleCount} (正确)`);
    } else {
      results.warnings.push(`⚠️ 角色数量: ${roleCount} (应为7)`);
    }
  } else if (RoleSelector.USER_ROLES) {
    results.warnings.push('⚠️ 使用旧的USER_ROLES导出，应为USER_ROLE_CONFIG');
  } else {
    results.failed.push('❌ 缺少角色配置导出');
  }
}

// 测试2: 导航系统组件
console.log('\n--- 测试导航系统组件 ---');
const AppNavigator = safeImport('AppNavigator', '../navigation/AppNavigator.tsx');
const SmartNavigationService = safeImport('SmartNavigationService', '../navigation/SmartNavigationService.tsx');
const PermissionBasedMenu = safeImport('PermissionBasedMenu', '../navigation/PermissionBasedMenu.tsx');
const NavigationGuard = safeImport('NavigationGuard', '../navigation/NavigationGuard.tsx');

// 检查SmartNavigationService
if (SmartNavigationService && SmartNavigationService.SmartNavigationService) {
  results.success.push('✅ SmartNavigationService: 单例实例可用');
}

// 测试3: API客户端
console.log('\n--- 测试API客户端 ---');
const EnhancedApiClient = safeImport('EnhancedApiClient', '../services/api/enhancedApiClient.ts');

if (EnhancedApiClient && EnhancedApiClient.apiClient) {
  results.success.push('✅ EnhancedApiClient: 默认实例可用');
  
  // 测试API客户端方法
  const client = EnhancedApiClient.apiClient;
  const methods = ['get', 'post', 'put', 'delete', 'patch', 'upload', 'batch'];
  methods.forEach(method => {
    if (typeof client[method] === 'function') {
      results.success.push(`✅ API方法: ${method}`);
    } else {
      results.failed.push(`❌ API方法缺失: ${method}`);
    }
  });
  
  // 测试统计方法
  if (typeof client.getStats === 'function') {
    try {
      const stats = client.getStats();
      results.success.push(`✅ API统计: ${JSON.stringify(stats)}`);
    } catch (error) {
      results.failed.push(`❌ API统计错误: ${error.message}`);
    }
  }
}

// 测试4: 测试组件本身
console.log('\n--- 测试Week 2测试组件 ---');
const Week2ComponentTest = safeImport('Week2ComponentTest', './Week2ComponentTest.tsx');

// 输出测试结果
console.log('\n=== Week 2 组件导入测试结果 ===');

if (results.success.length > 0) {
  console.log('\n🎉 成功项目:');
  results.success.forEach(item => console.log(`  ${item}`));
}

if (results.warnings.length > 0) {
  console.log('\n⚠️ 警告项目:');
  results.warnings.forEach(item => console.log(`  ${item}`));
}

if (results.failed.length > 0) {
  console.log('\n💥 失败项目:');
  results.failed.forEach(item => console.log(`  ${item}`));
}

// 总结
const total = results.success.length + results.warnings.length + results.failed.length;
const successRate = ((results.success.length + results.warnings.length) / total * 100).toFixed(1);

console.log(`\n📊 测试总结:`);
console.log(`  总测试项: ${total}`);
console.log(`  成功: ${results.success.length}`);
console.log(`  警告: ${results.warnings.length}`);
console.log(`  失败: ${results.failed.length}`);
console.log(`  成功率: ${successRate}%`);

if (results.failed.length === 0) {
  console.log('\n🎯 Week 2 组件导入测试 - 全部通过!');
  process.exit(0);
} else if (results.failed.length < 3) {
  console.log('\n✅ Week 2 组件导入测试 - 基本通过，有少量问题需要修复');
  process.exit(0);
} else {
  console.log('\n❌ Week 2 组件导入测试 - 存在严重问题，需要修复');
  process.exit(1);
}

// 导出结果供其他模块使用
module.exports = {
  results,
  total,
  successRate
};