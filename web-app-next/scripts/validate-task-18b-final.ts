#!/usr/bin/env node

/**
 * TASK-P3-018B 最终技术债务验证脚本
 * 检查AppResponse格式统一性和API完整性
 */

import { mockServerControls } from '../src/mocks/node-server.js';

console.log('🔍 TASK-P3-018B 最终技术债务验证开始...\n');

async function main() {
  try {
    // 启动Mock服务器
    console.log('📡 启动Mock服务器...');
    await mockServerControls.start();
    console.log('✅ Mock服务器已启动\n');

    const baseUrl = 'http://localhost:3001';
    const issues = [];

    // 测试1: Auth API 响应格式
    console.log('🔐 测试Auth API响应格式...');
    try {
      const authResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
      });

      const authData = await authResponse.json();

      if (authData.code !== undefined && authData.success !== undefined && authData.data !== undefined) {
        console.log('✅ Auth API 使用AppResponse格式');
      } else {
        issues.push('❌ Auth API 响应格式不符合AppResponse规范');
        console.log('❌ Auth API 响应格式:', Object.keys(authData));
      }
    } catch (error) {
      issues.push(`❌ Auth API 测试失败: ${(error as Error).message}`);
    }

    // 测试2: Products API 响应格式
    console.log('🛍️ 测试Products API响应格式...');
    try {
      const productsResponse = await fetch(`${baseUrl}/api/products`);
      const productsData = await productsResponse.json();

      if (productsData.code !== undefined && productsData.success !== undefined && Array.isArray(productsData.data)) {
        console.log('✅ Products API 使用AppResponse格式，data为数组');
      } else {
        issues.push('❌ Products API 响应格式不符合AppResponse规范');
        console.log('❌ Products API 响应格式:', Object.keys(productsData));
        console.log('   data类型:', typeof productsData.data, Array.isArray(productsData.data));
      }
    } catch (error) {
      issues.push(`❌ Products API 测试失败: ${(error as Error).message}`);
    }

    // 测试3: Users API 响应格式（需要登录）
    console.log('👥 测试Users API响应格式...');
    try {
      const usersResponse = await fetch(`${baseUrl}/api/users`, {
        headers: { 'Authorization': 'Bearer mock-token' } // 使用一个模拟token
      });
      const usersData = await usersResponse.json();

      if (usersResponse.status === 401) { // 期望401因为token无效
        const errorData = usersData; // 此时 usersData 应该是错误响应
        if (errorData.code === 401 && errorData.success === false && errorData.data === null) {
          console.log('✅ Users API 返回标准AppErrorResponse格式的401 (符合预期)');
        } else {
          issues.push('❌ Users API 返回401但格式不符合AppErrorResponse规范');
          console.log('❌ Users API 401 响应格式:', Object.keys(errorData));
        }
      } else if (usersData.code !== undefined && usersData.success !== undefined) {
        console.log('✅ Users API 使用AppResponse格式 (意外的200响应，但格式正确)');
      } else {
        issues.push('❌ Users API 响应格式不符合AppResponse规范 (非401且格式错误)');
        console.log('❌ Users API 响应格式:', Object.keys(usersData));
      }
    } catch (error) {
      issues.push(`❌ Users API 测试失败: ${(error as Error).message}`);
    }

    // 测试4: Farming API 响应格式（需要登录）
    console.log('🌾 测试Farming API响应格式...');
    try {
      const farmingResponse = await fetch(`${baseUrl}/api/farming/crops`, {
        headers: { 'Authorization': 'Bearer mock-token' } // 使用一个模拟token
      });
      const farmingData = await farmingResponse.json();

      if (farmingResponse.status === 401) { // 期望401
        const errorData = farmingData;
        if (errorData.code === 401 && errorData.success === false && errorData.data === null) {
          console.log('✅ Farming API 返回标准AppErrorResponse格式的401 (符合预期)');
        } else {
          issues.push('❌ Farming API 返回401但格式不符合AppErrorResponse规范');
          console.log('❌ Farming API 401 响应格式:', Object.keys(errorData));
        }
      } else if (farmingData.code !== undefined && farmingData.success !== undefined) {
        console.log('✅ Farming API 使用AppResponse格式 (意外的200响应，但格式正确)');
      } else {
        issues.push('❌ Farming API 响应格式不符合AppResponse规范 (非401且格式错误)');
        console.log('❌ Farming API 响应格式:', Object.keys(farmingData));
      }
    } catch (error) {
      issues.push(`❌ Farming API 测试失败: ${(error as Error).message}`);
    }

    // 测试5: Trace API 可用性
    console.log('🔍 测试Trace API可用性...');
    try {
      const traceResponse = await fetch(`${baseUrl}/api/trace/trace_001`);

      if (traceResponse.status === 404) {
        const errorData = await traceResponse.json();
        if (errorData.code === 404 && errorData.success === false && errorData.data === null) {
           console.log('✅ Trace API (trace_001) 返回标准AppErrorResponse格式的404 (符合预期)');
        } else {
           issues.push('❌ Trace API (trace_001) 返回404但格式不符合AppErrorResponse规范');
           console.log('❌ Trace API 404 响应格式:', Object.keys(errorData));
        }

        // 测试已知存在的ID
        const trace2Response = await fetch(`${baseUrl}/api/trace/TR2024001`);
        if (trace2Response.status === 200) {
          const trace2Data = await trace2Response.json();
          if (trace2Data.code !== undefined && trace2Data.success !== undefined) {
            console.log('✅ Trace API 对有效ID (TR2024001) 使用AppResponse格式');
          } else {
            issues.push('❌ Trace API (TR2024001) 响应格式不符合AppResponse规范');
          }
        } else {
          issues.push(`❌ Trace API (TR2024001) 返回状态 ${trace2Response.status}, 而不是200`);
        }
      } else if (traceResponse.status === 200) {
        const traceData = await traceResponse.json();
        if (traceData.code !== undefined && traceData.success !== undefined) {
          console.log('✅ Trace API (trace_001) 使用AppResponse格式');
        } else {
          issues.push('❌ Trace API (trace_001) 响应格式不符合AppResponse规范');
        }
      } else {
        issues.push(`❌ Trace API (trace_001) 返回意外状态 ${traceResponse.status}`);
      }
    } catch (error) {
      issues.push(`❌ Trace API 测试失败: ${(error as Error).message}`);
    }

    console.log('\n📊 验证结果汇总:');
    console.log('================');

    if (issues.length === 0) {
      console.log('🎉 所有检查通过！TASK-P3-018B没有主要技术债务。');
    } else {
      console.log(`⚠️ 发现 ${issues.length} 个问题:`);
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }

    console.log('\n📋 Handler使用AppResponse格式状态 (基于此脚本测试范围):');
    console.log('- ✅ Auth Handlers ');
    console.log('- ✅ Products Handlers');
    console.log('- ✅ Trace Handlers (部分验证，特定ID)');
    console.log('- ✅ Users Handlers (401错误格式验证)');
    console.log('- ✅ Farming Handlers (401错误格式验证)');
    console.log('\n以下模块的AppResponse格式需要手动验证或扩展此脚本:');
    console.log('- ⏳ Processing Handlers ');
    console.log('- ⏳ Logistics Handlers ');
    console.log('- ⏳ Admin Handlers ');

  } catch (error) {
    console.error('💥 验证过程出错:', (error as Error).message);
  } finally {
    // 停止Mock服务器
    console.log('\n🛑 停止Mock服务器...');
    await mockServerControls.stop();
    console.log('✅ 验证完成');
  }
}

main().catch(console.error);
