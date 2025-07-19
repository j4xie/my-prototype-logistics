#!/usr/bin/env node

// 测试真实API连接的简单脚本
const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001';

async function testRealAPI() {
  console.log('🔍 测试真实后端API连接...');
  console.log('目标地址:', API_BASE_URL);
  console.log('');

  const tests = [
    {
      name: '健康检查',
      url: `${API_BASE_URL}/health`,
      method: 'GET'
    },
    {
      name: '登录接口',
      url: `${API_BASE_URL}/auth/login`,
      method: 'POST',
      body: {
        username: 'platform_admin',
        password: 'Admin@123456'
      }
    },
    {
      name: '用户信息',
      url: `${API_BASE_URL}/users/profile`,
      method: 'GET'
    }
  ];

  for (const test of tests) {
    console.log(`📡 测试: ${test.name}`);
    console.log(`URL: ${test.url}`);
    
    try {
      const options = {
        method: test.method,
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
          console.log('✅ 成功:', JSON.stringify(data, null, 2));
        } catch (parseError) {
          const text = await response.text();
          console.log('✅ 成功 (文本):', text);
        }
      } else {
        const error = await response.text();
        console.log('❌ 失败:', error);
      }
    } catch (error) {
      console.log('❌ 连接失败:', error.message);
    }
    
    console.log('');
  }
}

// 检查环境变量
function checkEnvironment() {
  console.log('📋 环境检查:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('');
  
  // 检查 .env.local 文件
  const fs = require('fs');
  const path = require('path');
  
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    console.log('📄 .env.local 文件内容:');
    const envContent = fs.readFileSync(envPath, 'utf8');
    console.log(envContent);
  } else {
    console.log('⚠️  .env.local 文件不存在');
  }
  console.log('');
}

async function main() {
  console.log('=====================================');
  console.log('    海牛食品溯源系统 - API测试工具');
  console.log('=====================================');
  console.log('');
  
  checkEnvironment();
  await testRealAPI();
  
  console.log('=====================================');
  console.log('测试完成！');
  console.log('');
  console.log('如果后端API连接失败，请检查:');
  console.log('1. 后端服务是否运行在 http://localhost:3001');
  console.log('2. MySQL数据库是否正常运行');
  console.log('3. 防火墙是否阻止了端口3001');
  console.log('');
  console.log('启动后端服务: npm run dev (在backend目录)');
  console.log('启动前端服务: npm run dev (在frontend/web-app-next目录)');
  console.log('=====================================');
}

main().catch(console.error);