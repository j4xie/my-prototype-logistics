const fs = require('fs');
const path = require('path');

console.log('🚀 TASK-P3-016A 调试验证启动');
console.log('📋 重点: 发现原本项目代码问题');

try {
  // 检查关键文件
  console.log('\n🔍 文件存在性检查:');
  const files = [
    './src/lib/api.ts',
    './src/hooks/useApi-simple.ts',
    './src/components/test/ApiTestPage.tsx',
    './src/app/api'
  ];

  files.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  });

  // 检查API客户端质量
  console.log('\n🔍 API客户端代码分析:');
  const apiContent = fs.readFileSync('./src/lib/api.ts', 'utf8');

  const checks = [
    { name: '错误处理', pattern: /class ApiError|class NetworkError/g },
    { name: '认证管理', pattern: /setAuthToken|getAuthToken/g },
    { name: '重试机制', pattern: /retryAttempts|requestWithRetry/g },
    { name: '超时处理', pattern: /timeout|AbortController/g }
  ];

  checks.forEach(check => {
    const matches = apiContent.match(check.pattern);
    console.log(`  ${matches ? '✅' : '❌'} ${check.name}: ${matches ? matches.length + '处实现' : '未实现'}`);
  });

  // 检查Hook架构
  console.log('\n🔍 Hook架构分析:');
  const hookContent = fs.readFileSync('./src/hooks/useApi-simple.ts', 'utf8');

  const hookChecks = [
    { name: 'useState使用', pattern: /useState/g },
    { name: '缓存机制', pattern: /cache.*Map|TTL/g },
    { name: '业务Hook', pattern: /export function use[A-Z]/g }
  ];

  hookChecks.forEach(check => {
    const matches = hookContent.match(check.pattern);
    console.log(`  ${matches ? '✅' : '❌'} ${check.name}: ${matches ? matches.length + '处实现' : '未实现'}`);
  });

  // 列出业务Hook
  const businessHooks = hookContent.match(/export function (use[A-Z]\w+)/g) || [];
  console.log('  📋 已实现的Hook:', businessHooks.map(h => h.replace('export function ', '')).join(', '));

  // 检查API路由
  console.log('\n🔍 Mock API路由检查:');
  const apiDir = './src/app/api';
  if (fs.existsSync(apiDir)) {
    const routes = fs.readdirSync(apiDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    console.log('  📋 现有路由:', routes.join(', '));

    const requiredRoutes = ['auth', 'trace', 'products', 'users'];
    requiredRoutes.forEach(route => {
      const exists = routes.includes(route);
      console.log(`  ${exists ? '✅' : '❌'} ${route}路由`);
    });
  } else {
    console.log('  ❌ API路由目录不存在');
  }

  console.log('\n📊 验证完成');

} catch (error) {
  console.error('❌ 验证过程错误:', error.message);
  console.error('堆栈:', error.stack);
}
