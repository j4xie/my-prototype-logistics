#!/usr/bin/env node

/**
 * 智能工厂ID生成系统 - 最终演示
 * 完整展示系统的所有功能
 */

const API_BASE = 'http://localhost:3001';
const PLATFORM_ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbklkIjoxLCJ1c2VybmFtZSI6InBsYXRmb3JtX2FkbWluIiwiZW1haWwiOiJhZG1pbkBoZWluaXUuY29tIiwidHlwZSI6InBsYXRmb3JtX2FkbWluIiwiaWF0IjoxNzUyNjg3NTk3LCJleHAiOjE3NTI3NzM5OTd9.i367IiXolfGYL8TaD8rvzkSGzlEc5HZpjSnvgX4qdso';

// 测试案例 - 展示不同类型的工厂
const demoFactory = {
  name: `海底捞火锅食品有限公司_${Date.now()}`,
  industry: '餐饮食品制造',
  contactName: '张经理',
  contactEmail: `manager_${Date.now()}@haidilao.com`,
  contactPhone: '13800138888',
  address: '四川省成都市高新区',
  subscriptionPlan: 'enterprise',
  employeeCount: 2000
};

async function createDemoFactory() {
  console.log('🎯 智能工厂ID生成系统 - 最终演示');
  console.log('='.repeat(60));
  
  console.log('📋 演示工厂数据:');
  console.log(JSON.stringify(demoFactory, null, 2));
  
  console.log('\n🚀 创建工厂...');
  
  try {
    const response = await fetch(`${API_BASE}/api/platform/factories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PLATFORM_ADMIN_TOKEN}`
      },
      body: JSON.stringify(demoFactory)
    });
    
    const responseData = await response.json();
    
    if (response.ok) {
      console.log('\n✅ 工厂创建成功!');
      console.log('='.repeat(60));
      
      const factory = responseData.data.factory;
      const coding = factory.intelligentCoding;
      
      console.log('\n🏭 基本信息:');
      console.log(`   工厂名称: ${factory.name}`);
      console.log(`   所属行业: ${factory.industry}`);
      console.log(`   工厂地址: ${factory.address}`);
      console.log(`   联系人: ${factory.contactName || '未设置'}`);
      console.log(`   联系电话: ${factory.contactPhone}`);
      console.log(`   联系邮箱: ${factory.contactEmail}`);
      console.log(`   员工数量: ${demoFactory.employeeCount}人`);
      console.log(`   订阅套餐: ${demoFactory.subscriptionPlan}`);
      
      console.log('\n🆔 智能ID生成结果:');
      console.log(`   新格式ID: ${factory.id}`);
      console.log(`   老格式ID: ${coding.legacyId}`);
      
      console.log('\n🧠 智能编码解析:');
      console.log(`   行业代码: ${coding.industryCode} (${coding.industryName})`);
      console.log(`   地区代码: ${coding.regionCode} (${coding.regionName})`);
      console.log(`   建厂年份: ${coding.factoryYear}`);
      console.log(`   序列号: ${coding.sequenceNumber.toString().padStart(3, '0')}`);
      
      console.log('\n📊 推断质量:');
      console.log(`   综合置信度: ${(coding.confidence * 100).toFixed(1)}%`);
      console.log(`   需要人工确认: ${coding.needsConfirmation ? '是' : '否'}`);
      
      console.log('\n🔍 推断过程:');
      if (coding.reasoning.industry && coding.reasoning.industry.length > 0) {
        console.log(`   行业推断: ${coding.reasoning.industry[coding.reasoning.industry.length - 1]}`);
      }
      if (coding.reasoning.region && coding.reasoning.region.length > 0) {
        console.log(`   地区推断: ${coding.reasoning.region[coding.reasoning.region.length - 1]}`);
      }
      if (coding.reasoning.warnings && coding.reasoning.warnings.length > 0) {
        console.log(`   ⚠️  警告: ${coding.reasoning.warnings.join(', ')}`);
      }
      
      console.log('\n🎨 ID格式说明:');
      console.log(`   新格式: ${factory.id}`);
      console.log(`   格式解释: ${coding.industryCode}-${coding.regionCode}-${coding.factoryYear}-${coding.sequenceNumber.toString().padStart(3, '0')}`);
      console.log(`   含义: 行业代码-地区代码-年份-序号`);
      
      console.log('\n📈 系统优势:');
      console.log('   ✅ 智能推断行业和地区');
      console.log('   ✅ 符合GB/T 4754-2017标准');
      console.log('   ✅ 支持多种信息源推断');
      console.log('   ✅ 提供置信度评分');
      console.log('   ✅ 兼容老格式ID');
      console.log('   ✅ 自动序号管理');
      console.log('   ✅ 冲突检测和处理');
      
      console.log('\n🔧 技术特性:');
      console.log('   🎯 基于关键词匹配的智能推断');
      console.log('   🌍 支持全国34个省级行政区');
      console.log('   🏭 覆盖20+主要食品加工行业');
      console.log('   📱 手机号归属地推断');
      console.log('   📧 邮箱域名地理信息提取');
      console.log('   🔍 多层次地址解析');
      console.log('   📊 置信度评分系统');
      
    } else {
      console.log('\n❌ 工厂创建失败');
      console.log('错误信息:', responseData.message);
      console.log('详细信息:', responseData);
    }
    
  } catch (error) {
    console.error('\n💥 演示失败:', error.message);
  }
  
  console.log('\n='.repeat(60));
  console.log('✨ 智能工厂ID生成系统演示完成!');
  console.log('='.repeat(60));
}

// 运行演示
createDemoFactory().catch(console.error);