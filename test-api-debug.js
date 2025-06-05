const fetch = require('undici').fetch;

async function testAPIs() {
  // 设置环境变量
  process.env.NODE_ENV = 'test';
  process.env.API_BASE = 'http://localhost:3000';

  // 启动MSW
  const { setupServer } = require('msw/node');
  const { handlers } = require('./src/mocks/handlers');
  const server = setupServer(...handlers);
  server.listen();

  try {
    console.log('=== Testing API Responses ===\n');

    // 测试auth status
    console.log('1. Auth Status:');
    const authRes = await fetch('http://localhost:3000/api/auth/status');
    console.log('Status:', authRes.status);
    const authData = await authRes.json();
    console.log('Auth Keys:', Object.keys(authData));
    console.log('Auth Sample:', JSON.stringify(authData, null, 2).substring(0, 300) + '...\n');

    // 测试users profile
    console.log('2. Profile Status:');
    const profileRes = await fetch('http://localhost:3000/api/users/profile');
    console.log('Status:', profileRes.status);
    if (profileRes.status === 200) {
      const profileData = await profileRes.json();
      console.log('Profile Keys:', Object.keys(profileData));
    } else {
      console.log('Profile Error:', await profileRes.text());
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    server.close();
  }
}

testAPIs();
