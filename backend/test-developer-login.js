import fetch from 'node-fetch';

async function testDeveloperLogin() {
  try {
    console.log('Testing developer login...');
    
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'developer',
        password: 'Dev@123456',
        factoryId: 'TEST_2024_001'
      })
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('\n✅ Developer login successful!');
      console.log('User info:', data.data.user);
      console.log('Permissions:', data.data.user.permissions);
      console.log('Token:', data.data.tokens.token?.substring(0, 50) + '...');
    } else {
      console.log('\n❌ Login failed:', data.message || 'Unknown error');
    }
  } catch (error) {
    console.error('Error testing login:', error);
  }
}

testDeveloperLogin();