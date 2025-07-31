/**
 * 测试Vercel后端API连接
 * 验证前端是否能正常连接到部署在Vercel上的后端服务
 */

const API_BASE = "https://backend-theta-taupe-21.vercel.app/api";

console.log('🔄 开始测试Vercel后端连接...');
console.log('🌐 目标API地址:', API_BASE);
console.log('=' .repeat(50));

async function testVercelConnection() {
  try {
    // 测试1: 健康检查
    console.log('\n📋 测试1: API健康检查');
    console.log('发送请求到:', `${API_BASE}/auth/status`);
    
    const healthResponse = await fetch(`${API_BASE}/auth/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('响应状态:', healthResponse.status, healthResponse.statusText);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ 健康检查成功:', healthData);
    } else {
      const errorText = await healthResponse.text();
      console.log('❌ 健康检查失败:', errorText);
    }
    
    // 测试2: 登录测试 (使用默认管理员账户)
    console.log('\n🔐 测试2: 用户登录测试');
    console.log('发送请求到:', `${API_BASE}/auth/login`);
    
    const loginPayload = {
      username: 'factory_admin',
      password: 'admin123',
      factoryId: 'FCT_2024_001'
    };
    
    console.log('登录数据:', loginPayload);
    
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(loginPayload)
    });
    
    console.log('响应状态:', loginResponse.status, loginResponse.statusText);
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('✅ 登录测试成功:', {
        success: loginData.success,
        message: loginData.message,
        hasToken: !!loginData.data?.token,
        user: loginData.data?.user ? {
          id: loginData.data.user.id,
          username: loginData.data.user.username,
          role: loginData.data.user.role
        } : null
      });
      
      // 测试3: 使用token访问受保护的API
      if (loginData.data?.token) {
        console.log('\n🔒 测试3: 受保护API访问测试');
        const profileResponse = await fetch(`${API_BASE}/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${loginData.data.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        console.log('个人信息API响应状态:', profileResponse.status);
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          console.log('✅ 受保护API访问成功:', profileData);
        } else {
          const errorText = await profileResponse.text();
          console.log('❌ 受保护API访问失败:', errorText);
        }
      }
      
    } else {
      const errorData = await loginResponse.json().catch(() => ({ error: '无法解析错误响应' }));
      console.log('❌ 登录测试失败:', errorData);
    }
    
  } catch (error) {
    console.error('💥 连接测试出现异常:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    });
  }
}

// 运行测试
testVercelConnection().then(() => {
  console.log('\n' + '='.repeat(50));
  console.log('🏁 Vercel连接测试完成');
  console.log('请检查上方的测试结果');
}).catch(error => {
  console.error('💥 测试执行失败:', error);
});