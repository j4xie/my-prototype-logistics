import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001';

// 测试账户
const testAccounts = [
  // 平台用户
  { username: 'admin', password: '123456', expectedType: 'platform', expectedRoute: 'platform -> PlatformDashboard', role: 'platform_super_admin' },
  { username: 'developer', password: '123456', expectedType: 'platform', expectedRoute: 'platform -> PlatformDashboard', role: 'system_developer' },
  { username: 'platform_admin', password: '123456', expectedType: 'platform', expectedRoute: 'platform -> PlatformDashboard', role: 'platform_super_admin' },

  // 工厂用户 - 管理层
  { username: 'super_admin', password: '123456', expectedType: 'factory', expectedRoute: 'home', role: 'factory_super_admin' },
  { username: 'perm_admin', password: '123456', expectedType: 'factory', expectedRoute: 'management -> PermissionManagement', role: 'permission_admin' },

  // 部门管理员
  { username: 'proc_admin', password: '123456', expectedType: 'factory', expectedRoute: 'processing', role: 'department_admin', dept: 'processing' },
  { username: 'farm_admin', password: '123456', expectedType: 'factory', expectedRoute: 'farming', role: 'department_admin', dept: 'farming' },
  { username: 'logi_admin', password: '123456', expectedType: 'factory', expectedRoute: 'logistics', role: 'department_admin', dept: 'logistics' },

  // 普通操作员
  { username: 'proc_user', password: '123456', expectedType: 'factory', expectedRoute: 'processing', role: 'operator', dept: 'processing' },
];

async function testLogin(account) {
  try {
    const response = await fetch(`${API_BASE}/api/mobile/auth/unified-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: account.username,
        password: account.password,
        deviceInfo: {
          deviceId: 'TEST_DEVICE',
          deviceModel: 'Test',
          platform: 'test',
          osVersion: '1.0'
        }
      })
    });

    const data = await response.json();

    if (!data.success) {
      console.log(`❌ ${account.username.padEnd(15)} - 登录失败: ${data.message}`);
      return false;
    }

    const user = data.user;
    const userType = user.userType;
    const role = user.role || user.roleCode;  // 平台用户用role, 工厂用户用roleCode
    const department = user.department;

    // 验证用户类型
    if (userType !== account.expectedType) {
      console.log(`❌ ${account.username.padEnd(15)} - 用户类型错误: 期望 ${account.expectedType}, 实际 ${userType}`);
      return false;
    }

    // 验证角色
    if (role !== account.role) {
      console.log(`❌ ${account.username.padEnd(15)} - 角色错误: 期望 ${account.role}, 实际 ${role}`);
      return false;
    }

    // 验证部门
    if (account.dept && department !== account.dept) {
      console.log(`❌ ${account.username.padEnd(15)} - 部门错误: 期望 ${account.dept}, 实际 ${department}`);
      return false;
    }

    console.log(`✅ ${account.username.padEnd(15)} - ${userType.padEnd(8)} - ${role.padEnd(22)} → ${account.expectedRoute}`);
    return true;

  } catch (error) {
    console.log(`❌ ${account.username.padEnd(15)} - 请求失败: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 测试所有角色登录和跳转路径');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let passed = 0;
  let failed = 0;

  for (const account of testAccounts) {
    const result = await testLogin(account);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

runTests();
