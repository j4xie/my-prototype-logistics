import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001';

// 正常登录测试用例
const normalTestCases = [
  { username: 'admin', password: '123456', expectedType: 'platform', expectedRoute: 'platform -> PlatformDashboard', role: 'platform_super_admin' },
  { username: 'developer', password: '123456', expectedType: 'platform', expectedRoute: 'platform -> PlatformDashboard', role: 'system_developer' },
  { username: 'platform_admin', password: '123456', expectedType: 'platform', expectedRoute: 'platform -> PlatformDashboard', role: 'platform_super_admin' },
  { username: 'super_admin', password: '123456', expectedType: 'factory', expectedRoute: 'home', role: 'factory_super_admin' },
  { username: 'perm_admin', password: '123456', expectedType: 'factory', expectedRoute: 'management -> PermissionManagement', role: 'permission_admin' },
  { username: 'proc_admin', password: '123456', expectedType: 'factory', expectedRoute: 'processing', role: 'department_admin', dept: 'processing' },
  { username: 'farm_admin', password: '123456', expectedType: 'factory', expectedRoute: 'farming', role: 'department_admin', dept: 'farming' },
  { username: 'logi_admin', password: '123456', expectedType: 'factory', expectedRoute: 'logistics', role: 'department_admin', dept: 'logistics' },
  { username: 'proc_user', password: '123456', expectedType: 'factory', expectedRoute: 'processing', role: 'operator', dept: 'processing' },
];

// 边缘测试用例
const edgeCases = [
  { name: '错误密码', username: 'admin', password: 'wrongpassword', shouldFail: true, expectedError: '密码错误' },
  { name: '不存在的用户', username: 'nonexistent_user', password: '123456', shouldFail: true, expectedError: '用户不存在' },
  { name: '空用户名', username: '', password: '123456', shouldFail: true, expectedError: '用户名' },
  { name: '空密码', username: 'admin', password: '', shouldFail: true, expectedError: '密码' },
  { name: 'SQL注入尝试', username: "admin' OR '1'='1", password: '123456', shouldFail: true, expectedError: '不存在' },
  { name: 'XSS尝试', username: '<script>alert(1)</script>', password: '123456', shouldFail: true, expectedError: '不存在' },
  { name: '超长用户名', username: 'a'.repeat(1000), password: '123456', shouldFail: true, expectedError: '不存在' },
  { name: 'null用户名', username: null, password: '123456', shouldFail: true, expectedError: '用户名' },
  { name: 'undefined密码', username: 'admin', password: undefined, shouldFail: true, expectedError: '密码' },
];

async function testLogin(testCase, isEdgeCase = false) {
  try {
    const body = {
      username: testCase.username,
      password: testCase.password,
      deviceInfo: {
        deviceId: 'TEST_DEVICE',
        deviceModel: 'Test',
        platform: 'test',
        osVersion: '1.0'
      }
    };

    const response = await fetch(`${API_BASE}/api/mobile/auth/unified-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (isEdgeCase) {
      // 边缘测试：应该失败
      if (testCase.shouldFail) {
        if (!data.success) {
          console.log(`✅ ${testCase.name.padEnd(20)} - 正确拒绝: ${data.message}`);
          return true;
        } else {
          console.log(`❌ ${testCase.name.padEnd(20)} - 应该失败但成功了`);
          return false;
        }
      }
    } else {
      // 正常测试：应该成功
      if (!data.success) {
        console.log(`❌ ${testCase.username.padEnd(15)} - 登录失败: ${data.message}`);
        return false;
      }

      const user = data.user;
      const userType = user.userType;
      const role = user.role || user.roleCode;
      const department = user.department;

      // 验证用户类型
      if (userType !== testCase.expectedType) {
        console.log(`❌ ${testCase.username.padEnd(15)} - 用户类型错误: 期望 ${testCase.expectedType}, 实际 ${userType}`);
        return false;
      }

      // 验证角色
      if (role !== testCase.role) {
        console.log(`❌ ${testCase.username.padEnd(15)} - 角色错误: 期望 ${testCase.role}, 实际 ${role}`);
        return false;
      }

      // 验证部门
      if (testCase.dept && department !== testCase.dept) {
        console.log(`❌ ${testCase.username.padEnd(15)} - 部门错误: 期望 ${testCase.dept}, 实际 ${department}`);
        return false;
      }

      console.log(`✅ ${testCase.username.padEnd(15)} - ${userType.padEnd(8)} - ${role.padEnd(22)} → ${testCase.expectedRoute}`);
      return true;
    }

  } catch (error) {
    if (isEdgeCase && testCase.shouldFail) {
      console.log(`✅ ${testCase.name.padEnd(20)} - 正确拒绝: ${error.message}`);
      return true;
    }
    console.log(`❌ ${isEdgeCase ? testCase.name.padEnd(20) : testCase.username.padEnd(15)} - 请求失败: ${error.message}`);
    return false;
  }
}

// 测试未激活用户
async function testInactiveUser() {
  try {
    // 先创建一个未激活的测试用户
    const { PrismaClient } = await import('@prisma/client');
    const { hashPassword } = await import('../src/utils/password.js');
    const prisma = new PrismaClient();

    const factory = await prisma.factory.findFirst();
    const pwd = await hashPassword('123456');

    // 创建未激活用户
    const inactiveUser = await prisma.user.upsert({
      where: { factoryId_username: { factoryId: factory.id, username: 'inactive_test' } },
      update: { isActive: false },
      create: {
        factoryId: factory.id,
        username: 'inactive_test',
        passwordHash: pwd,
        email: 'inactive@test.com',
        phone: '13800000000',
        fullName: '未激活测试用户',
        roleCode: 'operator',
        department: 'processing',
        isActive: false
      }
    });

    await prisma.$disconnect();

    // 测试登录
    const response = await fetch(`${API_BASE}/api/mobile/auth/unified-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'inactive_test',
        password: '123456',
        deviceInfo: {
          deviceId: 'TEST_DEVICE',
          deviceModel: 'Test',
          platform: 'test',
          osVersion: '1.0'
        }
      })
    });

    const data = await response.json();

    if (!data.success && data.message.includes('未激活')) {
      console.log(`✅ ${'未激活用户'.padEnd(20)} - 正确拒绝: ${data.message}`);
      return true;
    } else {
      console.log(`❌ ${'未激活用户'.padEnd(20)} - 应该拒绝未激活用户`);
      return false;
    }

  } catch (error) {
    console.log(`❌ ${'未激活用户'.padEnd(20)} - 测试失败: ${error.message}`);
    return false;
  }
}

async function runComprehensiveTests() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 综合登录测试（包含边缘情况）');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let totalPassed = 0;
  let totalFailed = 0;

  // 第一部分：正常登录测试
  console.log('【第一部分：正常登录测试】\n');
  let normalPassed = 0;
  let normalFailed = 0;

  for (const testCase of normalTestCases) {
    const result = await testLogin(testCase, false);
    if (result) {
      normalPassed++;
    } else {
      normalFailed++;
    }
  }

  console.log(`\n小结: ${normalPassed} 通过, ${normalFailed} 失败\n`);
  totalPassed += normalPassed;
  totalFailed += normalFailed;

  // 第二部分：边缘测试
  console.log('\n【第二部分：边缘情况测试】\n');
  let edgePassed = 0;
  let edgeFailed = 0;

  for (const testCase of edgeCases) {
    const result = await testLogin(testCase, true);
    if (result) {
      edgePassed++;
    } else {
      edgeFailed++;
    }
  }

  console.log(`\n小结: ${edgePassed} 通过, ${edgeFailed} 失败\n`);
  totalPassed += edgePassed;
  totalFailed += edgeFailed;

  // 第三部分：未激活用户测试
  console.log('\n【第三部分：未激活用户测试】\n');
  const inactiveResult = await testInactiveUser();
  if (inactiveResult) {
    totalPassed++;
  } else {
    totalFailed++;
  }

  // 总结
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 总测试结果: ${totalPassed} 通过, ${totalFailed} 失败`);
  console.log(`   - 正常登录: ${normalPassed}/${normalTestCases.length}`);
  console.log(`   - 边缘测试: ${edgePassed}/${edgeCases.length}`);
  console.log(`   - 特殊测试: ${inactiveResult ? 1 : 0}/1`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

runComprehensiveTests();
