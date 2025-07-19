#!/usr/bin/env node

// 测试混合API模式的脚本
import fetch from 'node-fetch';

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:3001';

console.log('=====================================');
console.log('    混合API模式测试工具');
console.log('=====================================');
console.log('');

async function testMixedAPI() {
  console.log('🔍 测试混合API模式...');
  console.log('前端地址:', FRONTEND_URL);
  console.log('后端地址:', BACKEND_URL);
  console.log('');

  // 测试真实API端点
  console.log('📡 测试真实后端API:');
  const realApiTests = [
    {
      name: '后端健康检查',
      url: `${BACKEND_URL}/health`,
      expected: 'real'
    },
    {
      name: '平台管理员登录',
      url: `${BACKEND_URL}/api/auth/platform-login`,
      method: 'POST',
      body: {
        username: 'platform_admin',
        password: 'Admin@123456'
      },
      expected: 'real'
    },
    {
      name: '平台工厂列表',
      url: `${BACKEND_URL}/api/platform/factories`,
      expected: 'real'
    }
  ];

  for (const test of realApiTests) {
    await runTest(test);
  }

  console.log('');
  console.log('📡 测试Mock API端点:');
  
  // 测试Mock API端点
  const mockApiTests = [
    {
      name: 'Mock状态检查',
      url: `${FRONTEND_URL}/api/mock-status`,
      expected: 'mock'
    },
    {
      name: '养殖管理',
      url: `${FRONTEND_URL}/api/farming/batches`,
      expected: 'mock'
    },
    {
      name: '加工管理',
      url: `${FRONTEND_URL}/api/processing/batches`,
      expected: 'mock'
    },
    {
      name: '物流管理',
      url: `${FRONTEND_URL}/api/logistics/shipments`,
      expected: 'mock'
    }
  ];

  for (const test of mockApiTests) {
    await runTest(test);
  }
}

async function runTest(test) {
  console.log(`\n🧪 ${test.name}:`);
  console.log(`URL: ${test.url}`);
  
  try {
    const options = {
      method: test.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000
    };

    if (test.body) {
      options.body = JSON.stringify(test.body);
    }

    const response = await fetch(test.url, options);
    
    console.log(`状态码: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      try {
        const data = await response.json();
        console.log(`✅ 成功 (${test.expected}):`, JSON.stringify(data, null, 2).substring(0, 200) + '...');
      } catch (parseError) {
        const text = await response.text();
        console.log(`✅ 成功 (${test.expected}) - 文本:`, text.substring(0, 100) + '...');
      }
    } else {
      const error = await response.text();
      console.log(`❌ 失败:`, error.substring(0, 100) + '...');
    }
  } catch (error) {
    console.log(`❌ 连接失败:`, error.message);
  }
}

async function checkServices() {
  console.log('📋 服务状态检查:');
  
  // 检查后端服务
  try {
    const backendResponse = await fetch(`${BACKEND_URL}/health`, { timeout: 3000 });
    if (backendResponse.ok) {
      console.log('✅ 后端服务正常');
    } else {
      console.log('⚠️  后端服务异常');
    }
  } catch (error) {
    console.log('❌ 后端服务无法连接');
  }
  
  // 检查前端服务
  try {
    const frontendResponse = await fetch(`${FRONTEND_URL}/api/mock-status`, { timeout: 3000 });
    if (frontendResponse.ok) {
      console.log('✅ 前端Mock服务正常');
    } else {
      console.log('⚠️  前端Mock服务异常');
    }
  } catch (error) {
    console.log('❌ 前端服务无法连接');
  }
  
  console.log('');
}

async function main() {
  await checkServices();
  await testMixedAPI();
  
  console.log('');
  console.log('=====================================');
  console.log('测试完成！');
  console.log('');
  console.log('如果测试失败，请检查:');
  console.log('1. 后端服务是否运行在', BACKEND_URL);
  console.log('2. 前端服务是否运行在', FRONTEND_URL);
  console.log('3. MySQL数据库是否正常运行');
  console.log('4. .env.local 配置是否正确');
  console.log('');
  console.log('预期结果:');
  console.log('- auth, users, platform 使用真实后端API');
  console.log('- farming, processing, logistics 等使用Mock API');
  console.log('=====================================');
}

main().catch(console.error);