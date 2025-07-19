#!/usr/bin/env node

/**
 * API接口完整性测试脚本
 * 测试所有认证相关的API接口
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_FACTORY_ID = 'TEST_2024_001';

// 测试数据
const testData = {
  platformAdmin: {
    username: 'platform_admin',
    password: 'Admin@123456'
  },
  factoryAdmin: {
    username: 'factory_admin',
    password: 'SuperAdmin@123',
    factoryId: TEST_FACTORY_ID
  },
  newUser: {
    phoneNumber: '13900139003',
    username: 'api_test_user',
    password: 'TestUser@123',
    email: 'api_test@heiniu.com',
    fullName: 'API测试用户',
    factoryId: TEST_FACTORY_ID
  }
};

let tokens = {
  platformAdmin: null,
  factoryAdmin: null
};

/**
 * 发送HTTP请求的通用函数
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  const response = await fetch(url, { ...defaultOptions, ...options });
  const data = await response.json();
  
  return {
    status: response.status,
    ok: response.ok,
    data
  };
}

/**
 * 测试健康检查接口
 */
async function testHealthCheck() {
  console.log('\n📋 1. 测试健康检查接口...');
  
  try {
    const response = await apiRequest('/health');
    
    if (response.ok) {
      console.log('✅ 健康检查通过');
      console.log(`   服务器状态: ${response.data.status}`);
      console.log(`   运行时间: ${Math.floor(response.data.uptime)}秒`);
    } else {
      console.log('❌ 健康检查失败');
    }
  } catch (error) {
    console.log('❌ 健康检查请求失败:', error.message);
    console.log('   请确保服务器已启动 (npm run dev)');
    process.exit(1);
  }
}

/**
 * 测试平台管理员登录
 */
async function testPlatformAdminLogin() {
  console.log('\n🔐 2. 测试平台管理员登录...');
  
  try {
    const response = await apiRequest('/api/auth/platform-login', {
      method: 'POST',
      body: JSON.stringify(testData.platformAdmin)
    });
    
    if (response.ok) {
      tokens.platformAdmin = response.data.data.tokens.token;
      console.log('✅ 平台管理员登录成功');
      console.log(`   管理员: ${response.data.data.admin.username}`);
    } else {
      console.log('❌ 平台管理员登录失败:', response.data.message);
    }
  } catch (error) {
    console.log('❌ 平台管理员登录请求失败:', error.message);
  }
}

/**
 * 测试工厂创建
 */
async function testFactoryCreation() {
  if (!tokens.platformAdmin) {
    console.log('\n⏭️  跳过工厂创建测试 (平台管理员未登录)');
    return;
  }

  console.log('\n🏭 3. 测试工厂创建...');
  
  try {
    const factoryData = {
      name: 'API测试工厂',
      industry: '食品加工',
      contactEmail: 'api-test-factory@heiniu.com',
      contactPhone: '13800138999',
      address: '测试地址123号',
      description: 'API接口测试工厂'
    };

    const response = await apiRequest('/api/platform/factories', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.platformAdmin}`
      },
      body: JSON.stringify(factoryData)
    });
    
    if (response.ok) {
      console.log('✅ 工厂创建成功');
      console.log(`   工厂名称: ${response.data.data.factory.name}`);
      console.log(`   工厂ID: ${response.data.data.factory.id}`);
    } else {
      console.log('❌ 工厂创建失败:', response.data.message);
    }
  } catch (error) {
    console.log('❌ 工厂创建请求失败:', error.message);
  }
}

/**
 * 测试工厂用户登录
 */
async function testFactoryUserLogin() {
  console.log('\n👤 4. 测试工厂用户登录...');
  
  try {
    const response = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(testData.factoryAdmin)
    });
    
    if (response.ok) {
      tokens.factoryAdmin = response.data.data.tokens.token;
      console.log('✅ 工厂用户登录成功');
      console.log(`   用户: ${response.data.data.user.username}`);
      console.log(`   角色: ${response.data.data.user.roleCode}`);
      console.log(`   工厂: ${response.data.data.factory.name}`);
    } else {
      console.log('❌ 工厂用户登录失败:', response.data.message);
    }
  } catch (error) {
    console.log('❌ 工厂用户登录请求失败:', error.message);
  }
}

/**
 * 测试白名单管理
 */
async function testWhitelistManagement() {
  if (!tokens.factoryAdmin) {
    console.log('\n⏭️  跳过白名单测试 (工厂管理员未登录)');
    return;
  }

  console.log('\n📱 5. 测试白名单管理...');
  
  try {
    // 添加白名单
    const addResponse = await apiRequest('/api/whitelist', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.factoryAdmin}`
      },
      body: JSON.stringify({
        phoneNumbers: ['13900999001', '13900999002'],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
    });
    
    if (addResponse.ok) {
      console.log('✅ 白名单添加成功');
      console.log(`   添加数量: ${addResponse.data.data.addedCount}`);
    } else {
      console.log('❌ 白名单添加失败:', addResponse.data.message);
    }

    // 获取白名单列表
    const listResponse = await apiRequest('/api/whitelist?page=1&pageSize=10', {
      headers: {
        'Authorization': `Bearer ${tokens.factoryAdmin}`
      }
    });
    
    if (listResponse.ok) {
      console.log('✅ 白名单列表获取成功');
      console.log(`   总记录数: ${listResponse.data.data.pagination.total}`);
    } else {
      console.log('❌ 白名单列表获取失败:', listResponse.data.message);
    }

    // 获取白名单统计
    const statsResponse = await apiRequest('/api/whitelist/stats', {
      headers: {
        'Authorization': `Bearer ${tokens.factoryAdmin}`
      }
    });
    
    if (statsResponse.ok) {
      console.log('✅ 白名单统计获取成功');
      console.log(`   总数: ${statsResponse.data.data.total}`);
      console.log(`   待注册: ${statsResponse.data.data.statusStats.PENDING}`);
      console.log(`   已注册: ${statsResponse.data.data.statusStats.REGISTERED}`);
    } else {
      console.log('❌ 白名单统计获取失败:', statsResponse.data.message);
    }

  } catch (error) {
    console.log('❌ 白名单管理请求失败:', error.message);
  }
}

/**
 * 测试用户注册流程
 */
async function testUserRegistration() {
  console.log('\n👥 6. 测试用户注册流程...');
  
  try {
    // 第一步：手机号验证
    const verifyResponse = await apiRequest('/api/auth/verify-phone', {
      method: 'POST',
      body: JSON.stringify({
        phoneNumber: testData.newUser.phoneNumber,
        factoryId: testData.newUser.factoryId
      })
    });
    
    if (verifyResponse.ok) {
      console.log('✅ 手机号验证成功');
      
      // 第二步：完成注册
      const registerResponse = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          ...testData.newUser,
          tempToken: verifyResponse.data.data.tempToken
        })
      });
      
      if (registerResponse.ok) {
        console.log('✅ 用户注册成功');
        console.log(`   用户ID: ${registerResponse.data.data.userId}`);
        console.log(`   用户名: ${registerResponse.data.data.username}`);
        console.log(`   激活状态: ${registerResponse.data.data.isActive ? '已激活' : '待激活'}`);
      } else {
        console.log('❌ 用户注册失败:', registerResponse.data.message);
      }
    } else {
      console.log('❌ 手机号验证失败:', verifyResponse.data.message);
    }
  } catch (error) {
    console.log('❌ 用户注册请求失败:', error.message);
  }
}

/**
 * 测试用户管理
 */
async function testUserManagement() {
  if (!tokens.factoryAdmin) {
    console.log('\n⏭️  跳过用户管理测试 (工厂管理员未登录)');
    return;
  }

  console.log('\n🔧 7. 测试用户管理...');
  
  try {
    // 获取待激活用户列表
    const pendingResponse = await apiRequest('/api/users/pending', {
      headers: {
        'Authorization': `Bearer ${tokens.factoryAdmin}`
      }
    });
    
    if (pendingResponse.ok) {
      console.log('✅ 待激活用户列表获取成功');
      console.log(`   待激活用户数: ${pendingResponse.data.data.count}`);
      
      // 如果有待激活用户，尝试激活第一个
      if (pendingResponse.data.data.items.length > 0) {
        const userId = pendingResponse.data.data.items[0].id;
        
        const activateResponse = await apiRequest(`/api/users/${userId}/activate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokens.factoryAdmin}`
          },
          body: JSON.stringify({
            roleCode: 'user',
            roleLevel: 50,
            department: 'farming',
            position: '普通员工',
            permissions: ['farming:read', 'common:read']
          })
        });
        
        if (activateResponse.ok) {
          console.log('✅ 用户激活成功');
          console.log(`   用户: ${activateResponse.data.data.user.username}`);
          console.log(`   角色: ${activateResponse.data.data.user.roleCode}`);
        } else {
          console.log('❌ 用户激活失败:', activateResponse.data.message);
        }
      }
    } else {
      console.log('❌ 待激活用户列表获取失败:', pendingResponse.data.message);
    }

    // 获取用户统计
    const statsResponse = await apiRequest('/api/users/stats', {
      headers: {
        'Authorization': `Bearer ${tokens.factoryAdmin}`
      }
    });
    
    if (statsResponse.ok) {
      console.log('✅ 用户统计获取成功');
      console.log(`   总用户数: ${statsResponse.data.data.totalUsers}`);
      console.log(`   活跃用户: ${statsResponse.data.data.activeUsers}`);
      console.log(`   待激活: ${statsResponse.data.data.pendingUsers}`);
    } else {
      console.log('❌ 用户统计获取失败:', statsResponse.data.message);
    }

  } catch (error) {
    console.log('❌ 用户管理请求失败:', error.message);
  }
}

/**
 * 测试认证状态检查
 */
async function testAuthStatus() {
  console.log('\n🔍 8. 测试认证状态检查...');
  
  try {
    // 测试无token的情况
    const noTokenResponse = await apiRequest('/api/auth/status');
    
    if (noTokenResponse.ok) {
      console.log('✅ 无认证状态检查成功');
      console.log(`   认证状态: ${noTokenResponse.data.data.isAuthenticated}`);
    }

    // 测试工厂用户token
    if (tokens.factoryAdmin) {
      const factoryResponse = await apiRequest('/api/auth/status', {
        headers: {
          'Authorization': `Bearer ${tokens.factoryAdmin}`
        }
      });
      
      if (factoryResponse.ok) {
        console.log('✅ 工厂用户认证状态检查成功');
        console.log(`   用户类型: ${factoryResponse.data.data.type}`);
        console.log(`   认证状态: ${factoryResponse.data.data.isAuthenticated}`);
      }
    }

    // 测试平台管理员token
    if (tokens.platformAdmin) {
      const platformResponse = await apiRequest('/api/auth/status', {
        headers: {
          'Authorization': `Bearer ${tokens.platformAdmin}`
        }
      });
      
      if (platformResponse.ok) {
        console.log('✅ 平台管理员认证状态检查成功');
        console.log(`   管理员类型: ${platformResponse.data.data.type}`);
        console.log(`   认证状态: ${platformResponse.data.data.isAuthenticated}`);
      }
    }

  } catch (error) {
    console.log('❌ 认证状态检查请求失败:', error.message);
  }
}

/**
 * 主测试函数
 */
async function runAllTests() {
  console.log('🧪 开始API接口完整性测试...');
  console.log(`📡 测试服务器: ${BASE_URL}`);
  console.log(`🏭 测试工厂: ${TEST_FACTORY_ID}`);
  
  await testHealthCheck();
  await testPlatformAdminLogin();
  await testFactoryCreation();
  await testFactoryUserLogin();
  await testWhitelistManagement();
  await testUserRegistration();
  await testUserManagement();
  await testAuthStatus();
  
  console.log('\n🎉 API接口测试完成!');
  console.log('\n📋 测试总结:');
  console.log('   如果所有项目都显示 ✅，说明API接口工作正常');
  console.log('   如果有 ❌ 项目，请检查对应的错误信息');
  console.log('   如果服务器未启动，请先运行: npm run dev');
  console.log('');
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}