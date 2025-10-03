import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001';

// 错误场景测试用例
const errorTestCases = [
  {
    name: '错误密码',
    username: 'admin',
    password: 'wrongpassword',
    expectedMessage: '用户名或密码错误',
    expectedSuccess: false
  },
  {
    name: '不存在的用户',
    username: 'nonexistent_user_12345',
    password: '123456',
    expectedMessage: '用户名或密码错误',
    expectedSuccess: false
  },
  {
    name: '空用户名',
    username: '',
    password: '123456',
    expectedMessage: '用户名',
    expectedSuccess: false
  },
  {
    name: '空密码',
    username: 'admin',
    password: '',
    expectedMessage: '密码',
    expectedSuccess: false
  },
  {
    name: 'SQL注入尝试',
    username: "admin' OR '1'='1",
    password: '123456',
    expectedMessage: '用户名或密码错误',
    expectedSuccess: false
  },
  {
    name: '未激活用户',
    username: 'inactive_test',
    password: '123456',
    expectedMessage: '未激活',
    expectedSuccess: false
  },
  {
    name: '正确登录（对照组）',
    username: 'admin',
    password: '123456',
    expectedMessage: '登录成功',
    expectedSuccess: true
  }
];

async function testErrorMessage(testCase) {
  try {
    const response = await fetch(`${API_BASE}/api/mobile/auth/unified-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testCase.username,
        password: testCase.password,
        deviceInfo: {
          deviceId: 'TEST_DEVICE',
          deviceModel: 'Test',
          platform: 'test',
          osVersion: '1.0'
        }
      })
    });

    const data = await response.json();

    // 检查success字段
    if (data.success !== testCase.expectedSuccess) {
      console.log(`❌ ${testCase.name.padEnd(25)} - success字段错误`);
      console.log(`   期望: success=${testCase.expectedSuccess}, 实际: success=${data.success}`);
      return false;
    }

    // 检查错误消息
    if (!data.message.includes(testCase.expectedMessage)) {
      console.log(`❌ ${testCase.name.padEnd(25)} - 错误消息不匹配`);
      console.log(`   期望包含: "${testCase.expectedMessage}"`);
      console.log(`   实际消息: "${data.message}"`);
      return false;
    }

    // 检查响应格式
    if (!testCase.expectedSuccess) {
      // 失败的响应应该只有 success 和 message
      if (data.user || data.tokens) {
        console.log(`❌ ${testCase.name.padEnd(25)} - 失败响应不应该包含 user 或 tokens`);
        return false;
      }
    } else {
      // 成功的响应应该有 user 和 tokens
      if (!data.user || !data.tokens) {
        console.log(`❌ ${testCase.name.padEnd(25)} - 成功响应缺少 user 或 tokens`);
        return false;
      }
    }

    console.log(`✅ ${testCase.name.padEnd(25)} - 响应正确`);
    console.log(`   success: ${data.success}, message: "${data.message}"`);
    return true;

  } catch (error) {
    console.log(`❌ ${testCase.name.padEnd(25)} - 请求异常: ${error.message}`);
    return false;
  }
}

async function runErrorMessageTests() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 错误消息和响应格式测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let passed = 0;
  let failed = 0;

  for (const testCase of errorTestCases) {
    const result = await testErrorMessage(testCase);
    console.log(''); // 空行分隔
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (failed === 0) {
    console.log('🎉 所有错误消息和响应格式都正确！\n');
    console.log('✅ 验证通过的内容:');
    console.log('   - 错误消息清晰明确');
    console.log('   - success 字段正确');
    console.log('   - 失败响应不泄露敏感信息');
    console.log('   - 成功响应包含完整数据');
    console.log('   - 响应格式统一规范\n');
  }
}

runErrorMessageTests();
