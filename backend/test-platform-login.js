import fetch from 'node-fetch';

async function testPlatformLogin() {
  try {
    console.log('Testing platform admin login...');
    
    const response = await fetch('http://localhost:3001/api/auth/platform-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'platform_admin',
        password: 'admin@123456'
      })
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('\n✅ Platform admin login successful!');
      console.log('Admin info:', data.data.admin);
      console.log('Token:', data.data.tokens.token?.substring(0, 50) + '...');
    } else {
      console.log('\n❌ Login failed:', data.message || 'Unknown error');
    }
  } catch (error) {
    console.error('Error testing login:', error);
  }
}

testPlatformLogin();