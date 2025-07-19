#!/usr/bin/env node

/**
 * 测试工厂创建API和智能ID生成功能
 */

const API_BASE = 'http://localhost:3001';

// 测试工厂数据
const testFactoryData = {
  name: '青岛啤酒股份有限公司',
  industry: '啤酒制造',
  contactName: '张三',
  contactEmail: 'zhangsan@tsingtao.com',
  contactPhone: '13800138001',
  address: '山东省青岛市市南区',
  subscriptionPlan: 'basic',
  employeeCount: 200
};

// 平台管理员认证token
const PLATFORM_ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbklkIjoxLCJ1c2VybmFtZSI6InBsYXRmb3JtX2FkbWluIiwiZW1haWwiOiJhZG1pbkBoZWluaXUuY29tIiwidHlwZSI6InBsYXRmb3JtX2FkbWluIiwiaWF0IjoxNzUyNjg3NTk3LCJleHAiOjE3NTI3NzM5OTd9.i367IiXolfGYL8TaD8rvzkSGzlEc5HZpjSnvgX4qdso';

/**
 * 测试工厂创建API
 */
async function testFactoryCreation() {
  console.log('🧪 开始测试工厂创建API');
  console.log('='.repeat(50));
  
  try {
    console.log('📋 测试数据:');
    console.log(JSON.stringify(testFactoryData, null, 2));
    
    console.log('\n📡 发送API请求...');
    const response = await fetch(`${API_BASE}/api/platform/factories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PLATFORM_ADMIN_TOKEN}`
      },
      body: JSON.stringify(testFactoryData)
    });
    
    const responseData = await response.json();
    
    console.log('\n📊 API响应:');
    console.log(`状态码: ${response.status}`);
    console.log(`响应头: ${JSON.stringify(Object.fromEntries(response.headers), null, 2)}`);
    
    if (response.ok) {
      console.log('\n✅ 工厂创建成功!');
      console.log('🏭 工厂信息:');
      console.log(`ID: ${responseData.data.factory.id}`);
      console.log(`名称: ${responseData.data.factory.name}`);
      console.log(`行业: ${responseData.data.factory.industry}`);
      console.log(`地址: ${responseData.data.factory.address}`);
      console.log(`联系人: ${responseData.data.factory.contactName}`);
      console.log(`电话: ${responseData.data.factory.contactPhone}`);
      console.log(`邮箱: ${responseData.data.factory.contactEmail}`);
      
      if (responseData.data.factory.intelligentCoding) {
        console.log('\n🧠 智能编码结果:');
        const coding = responseData.data.factory.intelligentCoding;
        console.log(`行业代码: ${coding.industryCode} (${coding.industryName})`);
        console.log(`地区代码: ${coding.regionCode} (${coding.regionName})`);
        console.log(`年份: ${coding.factoryYear}`);
        console.log(`序号: ${coding.sequenceNumber}`);
        console.log(`置信度: ${(coding.confidence * 100).toFixed(1)}%`);
        console.log(`需要确认: ${coding.needsConfirmation ? '是' : '否'}`);
        console.log(`老格式ID: ${coding.legacyId}`);
        
        if (coding.reasoning) {
          console.log('\n🔍 推断过程:');
          if (coding.reasoning.industry && coding.reasoning.industry.length > 0) {
            console.log(`行业推断: ${coding.reasoning.industry[coding.reasoning.industry.length - 1]}`);
          }
          if (coding.reasoning.region && coding.reasoning.region.length > 0) {
            console.log(`地区推断: ${coding.reasoning.region[coding.reasoning.region.length - 1]}`);
          }
          if (coding.reasoning.warnings && coding.reasoning.warnings.length > 0) {
            console.log(`警告: ${coding.reasoning.warnings.join(', ')}`);
          }
        }
      }
    } else {
      console.log('\n❌ 工厂创建失败!');
      console.log('错误信息:', responseData.message || '未知错误');
      console.log('详细信息:', responseData);
    }
    
  } catch (error) {
    console.error('\n💥 测试失败:', error.message);
    console.error('错误详情:', error);
  }
}

/**
 * 测试服务器连接
 */
async function testServerConnection() {
  console.log('🔗 测试服务器连接...');
  
  try {
    const response = await fetch(`${API_BASE}/health`);
    const healthData = await response.json();
    
    if (response.ok) {
      console.log('✅ 服务器连接正常');
      console.log('服务器状态:', healthData);
    } else {
      console.log('❌ 服务器连接失败');
      console.log('错误:', healthData);
    }
  } catch (error) {
    console.error('❌ 无法连接到服务器:', error.message);
    console.error('请确保后端服务器正在运行在 http://localhost:3001');
    return false;
  }
  
  return true;
}

/**
 * 主测试函数
 */
async function main() {
  console.log('🚀 工厂创建API测试脚本');
  console.log('='.repeat(50));
  
  // 测试服务器连接
  const serverOk = await testServerConnection();
  
  if (!serverOk) {
    console.log('\n❌ 服务器连接失败，测试终止');
    return;
  }
  
  console.log('\n' + '='.repeat(50));
  
  // 测试工厂创建
  await testFactoryCreation();
  
  console.log('\n' + '='.repeat(50));
  console.log('✨ 测试完成!');
  
  console.log('\n📝 注意事项:');
  console.log('1. 本测试需要有效的平台管理员认证token');
  console.log('2. 如果出现认证错误，请先登录平台管理员账户');
  console.log('3. 智能ID生成系统已集成到工厂创建API中');
  console.log('4. 新的工厂ID格式为: III-GG-YYYY-NNN');
  console.log('5. 系统会自动推断行业代码和地区代码');
}

// 运行测试
main().catch(console.error);