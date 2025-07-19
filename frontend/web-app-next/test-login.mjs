#!/usr/bin/env node

// 简单的登录测试脚本
import fetch from 'node-fetch';

const BACKEND_URL = 'http://localhost:3001';

console.log('=====================================');
console.log('    登录功能测试');
console.log('=====================================');
console.log('');

async function testLogin() {
  try {
    console.log('🔐 测试平台管理员登录...');
    
    const response = await fetch(`${BACKEND_URL}/api/auth/platform-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'platform_admin',
        password: 'Admin@123456'
      })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ 登录成功！');
      console.log('👤 用户信息:', data.data.admin?.username);
      console.log('🔑 Token:', data.data.tokens?.token ? '已获取' : '未获取');
      console.log('');
      
      // 测试带token的API调用
      console.log('🏭 测试平台工厂列表...');
      const factoryResponse = await fetch(`${BACKEND_URL}/api/platform/factories?page=1&pageSize=10`, {
        headers: {
          'Authorization': `Bearer ${data.data.tokens?.token}`,
          'Content-Type': 'application/json',
        }
      });
      
      const factoryData = await factoryResponse.json();
      
      if (factoryResponse.ok && factoryData.success) {
        console.log('✅ 平台工厂列表获取成功！');
        console.log('📊 工厂数量:', factoryData.data?.factories?.length || 0);
      } else {
        console.log('❌ 平台工厂列表获取失败:', factoryData.message);
      }
      
    } else {
      console.log('❌ 登录失败:', data.message || '未知错误');
    }
    
  } catch (error) {
    console.error('❌ 登录测试失败:', error.message);
  }
}

testLogin();