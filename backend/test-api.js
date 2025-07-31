// 简单的API测试工具
const API_BASE = 'https://backend-theta-taupe-21.vercel.app';

async function testEndpoints() {
  const endpoints = [
    '/',
    '/health',
    '/api/auth/status',
    '/api/auth/login'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n测试: ${API_BASE}${endpoint}`);
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: endpoint === '/api/auth/login' ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://my-prototype-logistics.vercel.app'
        },
        ...(endpoint === '/api/auth/login' && {
          body: JSON.stringify({
            username: 'factory_admin',
            password: 'SuperAdmin@123'
          })
        })
      });

      console.log(`状态: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.log(`响应: ${text.substring(0, 200)}...`);
    } catch (error) {
      console.log(`错误: ${error.message}`);
    }
  }
}

testEndpoints();
