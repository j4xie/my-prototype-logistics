#!/usr/bin/env node

/**
 * 工厂ID生成系统测试脚本
 * 测试智能推断引擎和新的工厂ID生成功能
 */

import { factoryIdGenerator } from './src/utils/factory-id-generator.js';

// 测试数据
const testFactories = [
  {
    name: '青岛啤酒股份有限公司',
    industry: '啤酒制造',
    address: '山东省青岛市市南区',
    contactPhone: '13800138001',
    contactEmail: 'info@tsingtao.com'
  },
  {
    name: '伊利乳业有限公司',
    industry: '乳制品制造',
    address: '内蒙古呼和浩特市',
    contactPhone: '13900139001',
    contactEmail: 'contact@yili.com'
  },
  {
    name: '双汇肉类加工厂',
    industry: '肉制品',
    address: '河南省漯河市',
    contactPhone: '13700137001',
    contactEmail: 'service@shuanghui.com'
  },
  {
    name: '三只松鼠坚果加工厂',
    industry: '坚果加工',
    address: '安徽省芜湖市',
    contactPhone: '13600136001',
    contactEmail: 'hello@3songshu.com'
  },
  {
    name: '康师傅方便面厂',
    industry: '方便食品',
    address: '天津市滨海新区',
    contactPhone: '13500135001',
    contactEmail: 'info@tingyi.com'
  },
  {
    name: '老干妈调味品厂',
    industry: '调味品制造',
    address: '贵州省贵阳市',
    contactPhone: '13400134001',
    contactEmail: 'service@laoganma.com'
  },
  {
    name: '上海光明乳业',
    industry: '乳制品',
    address: '上海市徐汇区',
    contactPhone: '13300133001',
    contactEmail: 'info@brightdairy.com'
  },
  {
    name: '五粮液酒业集团',
    industry: '白酒制造',
    address: '四川省宜宾市',
    contactPhone: '13200132001',
    contactEmail: 'contact@wuliangye.com'
  },
  {
    name: '北京稻香村食品厂',
    industry: '糕点制造',
    address: '北京市东城区',
    contactPhone: '13100131001',
    contactEmail: 'info@daoxiangcun.com'
  },
  {
    name: '西湖龙井茶厂',
    industry: '茶叶加工',
    address: '浙江省杭州市西湖区',
    contactPhone: '13000130001',
    contactEmail: 'tea@xihu.com'
  }
];

/**
 * 运行测试
 */
async function runTests() {
  console.log('🧪 开始测试工厂ID生成系统');
  console.log('='.repeat(60));
  
  let successCount = 0;
  let totalCount = testFactories.length;
  
  for (const [index, factory] of testFactories.entries()) {
    console.log(`\n${index + 1}. 测试工厂: ${factory.name}`);
    console.log('-'.repeat(40));
    
    try {
      // 生成工厂ID
      const result = await factoryIdGenerator.generateNewFactoryId(factory);
      
      console.log(`✅ 生成成功:`);
      console.log(`   新ID: ${result.factoryId}`);
      console.log(`   行业: ${result.industryName} (${result.industryCode})`);
      console.log(`   地区: ${result.regionName} (${result.regionCode})`);
      console.log(`   年份: ${result.factoryYear}`);
      console.log(`   序号: ${result.sequenceNumber.toString().padStart(3, '0')}`);
      console.log(`   置信度: ${(result.confidence.overall * 100).toFixed(1)}%`);
      
      // 显示推断过程
      if (result.reasoning.industry.length > 0) {
        console.log(`   行业推断: ${result.reasoning.industry[result.reasoning.industry.length - 1]}`);
      }
      if (result.reasoning.region.length > 0) {
        console.log(`   地区推断: ${result.reasoning.region[result.reasoning.region.length - 1]}`);
      }
      
      // 显示警告
      if (result.reasoning.warnings.length > 0) {
        console.log(`   ⚠️  警告: ${result.reasoning.warnings.join(', ')}`);
      }
      
      // 显示是否需要确认
      if (result.needsConfirmation) {
        console.log(`   🔍 需要人工确认`);
      } else {
        console.log(`   ✅ 自动确认`);
      }
      
      // 验证生成的ID格式
      const validation = factoryIdGenerator.validateFactoryId(result.factoryId);
      if (validation.isValid) {
        console.log(`   ✅ ID格式验证通过`);
      } else {
        console.log(`   ❌ ID格式验证失败: ${validation.error}`);
      }
      
      successCount++;
      
    } catch (error) {
      console.log(`❌ 生成失败: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`🎉 测试完成! 成功率: ${successCount}/${totalCount} (${((successCount/totalCount)*100).toFixed(1)}%)`);
  
  // 统计结果
  console.log('\n📊 统计信息:');
  console.log(`   总测试数量: ${totalCount}`);
  console.log(`   成功生成: ${successCount}`);
  console.log(`   失败数量: ${totalCount - successCount}`);
  
  if (successCount === totalCount) {
    console.log('✅ 所有测试通过！');
  } else {
    console.log('⚠️  部分测试失败，请检查相关配置');
  }
}

/**
 * 测试ID格式验证
 */
function testIdValidation() {
  console.log('\n🔍 测试ID格式验证功能');
  console.log('-'.repeat(40));
  
  const testIds = [
    '144-GD-2025-001',  // 有效
    '151-SD-2025-002',  // 有效
    '135-HA-2025-003',  // 有效
    'FCT_2024_001',     // 无效（老格式）
    '1440-GD-2025-001', // 无效（行业代码太长）
    '144-GDD-2025-001', // 无效（地区代码太长）
    '144-GD-25-001',    // 无效（年份格式错误）
    '144-GD-2025-1',    // 无效（序号格式错误）
  ];
  
  testIds.forEach(id => {
    const validation = factoryIdGenerator.validateFactoryId(id);
    if (validation.isValid) {
      console.log(`✅ ${id} - 有效`);
      console.log(`   解析结果: ${validation.parsed.industryName} | ${validation.parsed.regionName} | ${validation.parsed.year} | ${validation.parsed.sequenceNumber}`);
    } else {
      console.log(`❌ ${id} - 无效: ${validation.error}`);
    }
  });
}

/**
 * 测试关键词匹配
 */
async function testKeywordMatching() {
  console.log('\n🔤 测试关键词匹配功能');
  console.log('-'.repeat(40));
  
  const { matchIndustryKeywords } = await import('./src/config/industry-keywords.js');
  const { matchRegionKeywords } = await import('./src/config/region-keywords.js');
  const { inferRegionFromPhone } = await import('./src/config/mobile-regions.js');
  
  console.log('行业关键词匹配测试:');
  const industryTests = [
    '青岛啤酒股份有限公司',
    '伊利乳业有限公司',
    '双汇肉类加工厂',
    '康师傅方便面厂'
  ];
  
  industryTests.forEach(text => {
    const match = matchIndustryKeywords(text);
    console.log(`  "${text}" -> ${match.industryName} (${match.industryCode}) [${(match.confidence * 100).toFixed(1)}%]`);
  });
  
  console.log('\n地区关键词匹配测试:');
  const regionTests = [
    '山东省青岛市市南区',
    '内蒙古呼和浩特市',
    '河南省漯河市',
    '北京市东城区'
  ];
  
  regionTests.forEach(text => {
    const match = matchRegionKeywords(text);
    console.log(`  "${text}" -> ${match.regionName} (${match.regionCode}) [${(match.confidence * 100).toFixed(1)}%]`);
  });
  
  console.log('\n手机号归属地推断测试:');
  const phoneTests = [
    '13800138001',
    '13900139001',
    '13700137001',
    '13600136001'
  ];
  
  phoneTests.forEach(phone => {
    const match = inferRegionFromPhone(phone);
    console.log(`  "${phone}" -> ${match.regionName} (${match.regionCode}) [${(match.confidence * 100).toFixed(1)}%] (${match.method})`);
  });
}

/**
 * 主函数
 */
async function main() {
  try {
    await runTests();
    testIdValidation();
    await testKeywordMatching();
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
main().catch(console.error);