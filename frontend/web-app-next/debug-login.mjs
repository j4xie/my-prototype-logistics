#!/usr/bin/env node

// 调试登录响应结构
import fetch from 'node-fetch';

const BACKEND_URL = 'http://localhost:3001';

async function debugLogin() {
  try {
    console.log('🔍 调试登录响应结构...');
    
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
    
    console.log('📋 完整响应数据:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ 调试失败:', error.message);
  }
}

debugLogin();