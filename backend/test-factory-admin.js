import fetch from 'node-fetch';

async function testFactoryAdminLogin() {
  try {
    console.log('Testing factory admin login...');
    
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'factory_admin',
        password: 'SuperAdmin@123',
        factoryId: 'TEST_2024_001'
      })
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('\n✅ Factory admin login successful!');
      console.log('User info:', data.data.user);
      console.log('Permissions:', data.data.user.permissions);
      
      // Check platform_access
      if (data.data.user.permissions.modules.platform_access) {
        console.log('\n❌ ERROR: Factory admin has platform_access = true (should be false)');
      } else {
        console.log('\n✅ CORRECT: Factory admin has platform_access = false');
      }
      
      // Check admin_access
      if (data.data.user.permissions.modules.admin_access) {
        console.log('✅ CORRECT: Factory admin has admin_access = true');
      } else {
        console.log('❌ ERROR: Factory admin has admin_access = false (should be true)');
      }
      
    } else {
      console.log('\n❌ Login failed:', data.message || 'Unknown error');
    }
  } catch (error) {
    console.error('Error testing login:', error);
  }
}

testFactoryAdminLogin();