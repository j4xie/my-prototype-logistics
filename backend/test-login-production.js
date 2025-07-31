import axios from 'axios';

const testLogin = async () => {
  console.log('🔍 测试生产环境登录API...');
  
  const loginData = {
    username: 'factory_admin',
    password: 'SuperAdmin@123',
    factoryId: 'FCT_2025_001'
  };
  
  try {
    console.log('📤 发送登录请求:', {
      url: 'https://backend-theta-taupe-21.vercel.app/api/auth/login',
      data: loginData
    });
    
    const response = await axios.post(
      'https://backend-theta-taupe-21.vercel.app/api/auth/login',
      loginData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('✅ 登录成功:', response.data);
    
  } catch (error) {
    console.log('❌ 登录失败:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    
    // 显示详细的验证错误
    if (error.response?.data?.errors) {
      console.log('📋 详细验证错误:');
      error.response.data.errors.forEach((err, index) => {
        console.log(`  ${index + 1}. ${JSON.stringify(err, null, 2)}`);
      });
    }
  }
};

testLogin();