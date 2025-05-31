#!/usr/bin/env node

/**
 * Mock API 测试脚本
 * 用于验证所有API端点的功能是否正常
 */

const BASE_URL = 'http://localhost:3000/api';

/**
 * 发送HTTP请求
 */
async function request(method, url, data = null, headers = {}) {
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${BASE_URL}${url}`, config);
    const result = await response.json();
    
    return {
      status: response.status,
      success: response.ok,
      data: result
    };
  } catch (error) {
    return {
      status: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * 测试结果输出
 */
function logTest(name, result, expected = null) {
  const status = result.success ? '✅' : '❌';
  const statusCode = result.status || 'N/A';
  
  console.log(`${status} ${name} (${statusCode})`);
  
  if (!result.success) {
    console.log(`   错误: ${result.error || result.data?.message || '未知错误'}`);
  } else if (expected && !expected(result)) {
    console.log(`   ⚠️  响应格式不符合预期`);
  }
  
  if (process.env.VERBOSE) {
    console.log(`   响应:`, JSON.stringify(result.data, null, 2));
  }
  
  console.log('');
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🚀 开始测试 Mock API 端点...\n');
  
  let passedTests = 0;
  let totalTests = 0;
  let authToken = null;

  // 测试1: 用户登录
  totalTests++;
  console.log('📋 测试认证相关API');
  const loginResult = await request('POST', '/auth/login', {
    username: 'admin',
    password: 'admin123'
  });
  
  logTest('用户登录', loginResult, (r) => {
    if (r.data?.success && r.data?.data?.token) {
      authToken = r.data.data.token;
      return true;
    }
    return false;
  });
  if (loginResult.success) passedTests++;

  // 测试2: 认证状态检查
  totalTests++;
  const statusResult = await request('GET', '/auth/status', null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  logTest('认证状态检查', statusResult, (r) => r.data?.success);
  if (statusResult.success) passedTests++;

  // 测试3: 令牌验证
  totalTests++;
  const verifyResult = await request('POST', '/auth/verify', {
    token: authToken
  });
  
  logTest('令牌验证', verifyResult, (r) => r.data?.success);
  if (verifyResult.success) passedTests++;

  // 测试4: 产品列表
  totalTests++;
  console.log('📦 测试产品相关API');
  const productsResult = await request('GET', '/products');
  
  logTest('产品列表获取', productsResult, (r) => {
    return r.data?.success && Array.isArray(r.data?.data?.items);
  });
  if (productsResult.success) passedTests++;

  // 测试5: 溯源查询
  totalTests++;
  console.log('🔍 测试溯源相关API');
  const traceResult = await request('GET', '/trace/APPLE-ORG-001');
  
  logTest('溯源信息查询', traceResult, (r) => {
    return r.data?.success && r.data?.data?.productInfo;
  });
  if (traceResult.success) passedTests++;

  // 测试6: 溯源验证
  totalTests++;
  const verifyTraceResult = await request('POST', '/trace/APPLE-ORG-001/verify');
  
  logTest('溯源信息验证', verifyTraceResult, (r) => {
    return r.data?.success && r.data?.data?.verificationDetails;
  });
  if (verifyTraceResult.success) passedTests++;

  // 测试7: 用户资料
  totalTests++;
  console.log('👤 测试用户相关API');
  const profileResult = await request('GET', '/users/profile', null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  logTest('用户资料获取', profileResult, (r) => {
    return r.data?.success && r.data?.data?.username;
  });
  if (profileResult.success) passedTests++;

  // 测试8: Mock数据管理
  totalTests++;
  console.log('⚙️  测试Mock数据管理API');
  const mockDataResult = await request('GET', '/mock-data');
  
  logTest('Mock数据概览', mockDataResult, (r) => {
    return r.data?.success && r.data?.data?.overview;
  });
  if (mockDataResult.success) passedTests++;

  // 测试9: Mock数据统计
  totalTests++;
  const mockStatsResult = await request('GET', '/mock-data?action=stats');
  
  logTest('Mock数据统计', mockStatsResult, (r) => {
    return r.data?.success && typeof r.data?.data?.totalProducts === 'number';
  });
  if (mockStatsResult.success) passedTests++;

  // 测试10: 快速溯源验证
  totalTests++;
  const quickVerifyResult = await request('GET', '/trace/APPLE-ORG-001/verify');
  
  logTest('快速溯源验证', quickVerifyResult, (r) => {
    return r.data?.success && typeof r.data?.data?.isValid === 'boolean';
  });
  if (quickVerifyResult.success) passedTests++;

  // 测试11: 用户注销
  totalTests++;
  const logoutResult = await request('POST', '/auth/logout', null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  logTest('用户注销', logoutResult, (r) => r.data?.success);
  if (logoutResult.success) passedTests++;

  // 测试12: 错误处理 - 无效溯源ID
  totalTests++;
  console.log('🚫 测试错误处理');
  const invalidTraceResult = await request('GET', '/trace/INVALID-ID');
  
  logTest('无效溯源ID处理', invalidTraceResult, (r) => {
    return !r.data?.success && r.status === 404;
  });
  if (!invalidTraceResult.success && invalidTraceResult.status === 404) passedTests++;

  // 测试13: 错误处理 - 未授权访问
  totalTests++;
  const unauthorizedResult = await request('GET', '/users/profile');
  
  logTest('未授权访问处理', unauthorizedResult, (r) => {
    return !r.data?.success && r.status === 401;
  });
  if (!unauthorizedResult.success && unauthorizedResult.status === 401) passedTests++;

  // 输出测试结果
  console.log('📊 测试结果总结');
  console.log('='.repeat(50));
  console.log(`总测试数: ${totalTests}`);
  console.log(`通过测试: ${passedTests}`);
  console.log(`失败测试: ${totalTests - passedTests}`);
  console.log(`通过率: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 所有测试通过！Mock API 运行正常。');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分测试失败，请检查API实现。');
    process.exit(1);
  }
}

// 检查是否在Node.js环境中运行
if (typeof fetch === 'undefined') {
  console.log('❌ 此脚本需要Node.js 18+版本运行（支持fetch API）');
  console.log('或者安装node-fetch: npm install node-fetch');
  process.exit(1);
}

// 运行测试
runTests().catch((error) => {
  console.error('❌ 测试运行失败:', error);
  process.exit(1);
}); 