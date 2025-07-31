// 测试完整的登录流程
const API_BASE = 'https://backend-theta-taupe-21.vercel.app';

async function testLogin() {
  try {
    console.log('测试工厂用户登录...');

    const loginData = {
      username: 'factory_admin',
      password: 'SuperAdmin@123',
      factoryId: 'TEST_2024_001'
    };

    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://my-prototype-logistics.vercel.app'
      },
      body: JSON.stringify(loginData)
    });

    console.log(`状态: ${response.status} ${response.statusText}`);
    const responseData = await response.json();
    console.log('响应数据:', JSON.stringify(responseData, null, 2));

  } catch (error) {
    console.error('错误:', error.message);
  }
}

testLogin();
