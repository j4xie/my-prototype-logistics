#!/usr/bin/env node

/**
 * 快速API测试脚本
 */

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
  const endpoints = [
    { method: 'GET', path: '/api/auth/status', description: '认证状态' },
    { method: 'GET', path: '/api/products', description: '产品列表' },
    { method: 'POST', path: '/api/auth/login', data: { username: 'admin', password: 'admin123' }, description: '用户登录' }
  ];

  console.log('🚀 开始API快速测试...\n');

  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 测试: ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);

      const options = {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' }
      };

      if (endpoint.data) {
        options.body = JSON.stringify(endpoint.data);
      }

      // 使用全局fetch (在Node.js 18+中可用)
      const response = await fetch(`${BASE_URL}${endpoint.path}`, options);
      const data = await response.json();

      console.log(`  ✅ 状态: ${response.status} - ${data.message || '成功'}`);
    } catch (error) {
      console.log(`  ❌ 错误: ${error.message}`);
    }
  }

  console.log('\n✅ API快速测试完成');
}

testAPI().catch(console.error);


/**
 * 快速API测试脚本
 */

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
  const endpoints = [
    { method: 'GET', path: '/api/auth/status', description: '认证状态' },
    { method: 'GET', path: '/api/products', description: '产品列表' },
    { method: 'POST', path: '/api/auth/login', data: { username: 'admin', password: 'admin123' }, description: '用户登录' }
  ];

  console.log('🚀 开始API快速测试...\n');

  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 测试: ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);

      const options = {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' }
      };

      if (endpoint.data) {
        options.body = JSON.stringify(endpoint.data);
      }

      // 使用全局fetch (在Node.js 18+中可用)
      const response = await fetch(`${BASE_URL}${endpoint.path}`, options);
      const data = await response.json();

      console.log(`  ✅ 状态: ${response.status} - ${data.message || '成功'}`);
    } catch (error) {
      console.log(`  ❌ 错误: ${error.message}`);
    }
  }

  console.log('\n✅ API快速测试完成');
}

testAPI().catch(console.error);
