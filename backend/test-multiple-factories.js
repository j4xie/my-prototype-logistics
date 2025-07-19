#!/usr/bin/env node

/**
 * 批量测试工厂创建API和智能ID生成功能
 * 展示智能编码系统的多样性和准确性
 */

const API_BASE = 'http://localhost:3001';
const PLATFORM_ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbklkIjoxLCJ1c2VybmFtZSI6InBsYXRmb3JtX2FkbWluIiwiZW1haWwiOiJhZG1pbkBoZWluaXUuY29tIiwidHlwZSI6InBsYXRmb3JtX2FkbWluIiwiaWF0IjoxNzUyNjg3NTk3LCJleHAiOjE3NTI3NzM5OTd9.i367IiXolfGYL8TaD8rvzkSGzlEc5HZpjSnvgX4qdso';

// 测试工厂数据集
const testFactories = [
  {
    name: '伊利乳业有限公司',
    industry: '乳制品制造',
    contactName: '李四',
    contactEmail: 'lisi@yili.com',
    contactPhone: '13900139001',
    address: '内蒙古呼和浩特市',
    subscriptionPlan: 'premium',
    employeeCount: 500
  },
  {
    name: '双汇肉类加工厂',
    industry: '肉制品加工',
    contactName: '王五',
    contactEmail: 'wangwu@shuanghui.com',
    contactPhone: '13700137001',
    address: '河南省漯河市',
    subscriptionPlan: 'basic',
    employeeCount: 300
  },
  {
    name: '三只松鼠坚果加工厂',
    industry: '坚果加工',
    contactName: '赵六',
    contactEmail: 'zhaoliu@3songshu.com',
    contactPhone: '13600136001',
    address: '安徽省芜湖市',
    subscriptionPlan: 'premium',
    employeeCount: 150
  },
  {
    name: '康师傅方便面厂',
    industry: '方便食品制造',
    contactName: '刘七',
    contactEmail: 'liuqi@tingyi.com',
    contactPhone: '13500135001',
    address: '天津市滨海新区',
    subscriptionPlan: 'enterprise',
    employeeCount: 800
  },
  {
    name: '老干妈调味品厂',
    industry: '调味品制造',
    contactName: '陈八',
    contactEmail: 'chenba@laoganma.com',
    contactPhone: '13400134001',
    address: '贵州省贵阳市',
    subscriptionPlan: 'basic',
    employeeCount: 200
  },
  {
    name: '上海光明乳业',
    industry: '乳制品',
    contactName: '钱九',
    contactEmail: 'qianjiu@brightdairy.com',
    contactPhone: '13300133001',
    address: '上海市徐汇区',
    subscriptionPlan: 'premium',
    employeeCount: 600
  },
  {
    name: '五粮液酒业集团',
    industry: '白酒制造',
    contactName: '孙十',
    contactEmail: 'sunshi@wuliangye.com',
    contactPhone: '13200132001',
    address: '四川省宜宾市',
    subscriptionPlan: 'enterprise',
    employeeCount: 1000
  },
  {
    name: '北京稻香村食品厂',
    industry: '糕点制造',
    contactName: '周十一',
    contactEmail: 'zhoushiyi@daoxiangcun.com',
    contactPhone: '13100131001',
    address: '北京市东城区',
    subscriptionPlan: 'basic',
    employeeCount: 100
  },
  {
    name: '西湖龙井茶厂',
    industry: '茶叶加工',
    contactName: '吴十二',
    contactEmail: 'wushier@xihu.com',
    contactPhone: '13000130001',
    address: '浙江省杭州市西湖区',
    subscriptionPlan: 'premium',
    employeeCount: 80
  },
  {
    name: '新疆天山雪莲茶业',
    industry: '茶叶制造',
    contactName: '郑十三',
    contactEmail: 'zhengshisan@tianshan.com',
    contactPhone: '13990139901',
    address: '新疆乌鲁木齐市',
    subscriptionPlan: 'basic',
    employeeCount: 50
  }
];

/**
 * 创建单个工厂
 */
async function createFactory(factoryData, index) {
  try {
    const response = await fetch(`${API_BASE}/api/platform/factories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PLATFORM_ADMIN_TOKEN}`
      },
      body: JSON.stringify(factoryData)
    });
    
    const responseData = await response.json();
    
    if (response.ok) {
      return {
        success: true,
        factory: responseData.data.factory,
        index: index + 1,
        name: factoryData.name
      };
    } else {
      return {
        success: false,
        error: responseData.message || '创建失败',
        index: index + 1,
        name: factoryData.name
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      index: index + 1,
      name: factoryData.name
    };
  }
}

/**
 * 批量创建工厂
 */
async function batchCreateFactories() {
  console.log('🚀 批量工厂创建测试');
  console.log('='.repeat(60));
  
  const results = [];
  
  // 顺序创建，避免并发问题
  for (let i = 0; i < testFactories.length; i++) {
    const factory = testFactories[i];
    console.log(`\n${i + 1}. 创建工厂: ${factory.name}`);
    console.log('-'.repeat(40));
    
    const result = await createFactory(factory, i);
    results.push(result);
    
    if (result.success) {
      const f = result.factory;
      const coding = f.intelligentCoding;
      
      console.log(`✅ 创建成功`);
      console.log(`   新ID: ${f.id}`);
      console.log(`   行业: ${coding.industryName} (${coding.industryCode})`);
      console.log(`   地区: ${coding.regionName} (${coding.regionCode})`);
      console.log(`   年份: ${coding.factoryYear}`);
      console.log(`   序号: ${coding.sequenceNumber.toString().padStart(3, '0')}`);
      console.log(`   置信度: ${(coding.confidence * 100).toFixed(1)}%`);
      console.log(`   需要确认: ${coding.needsConfirmation ? '是' : '否'}`);
      console.log(`   老格式ID: ${coding.legacyId}`);
    } else {
      console.log(`❌ 创建失败: ${result.error}`);
    }
    
    // 短暂延迟，避免过快请求
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

/**
 * 分析结果统计
 */
function analyzeResults(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 批量创建结果分析');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n📈 总体统计:`);
  console.log(`   总数量: ${results.length}`);
  console.log(`   成功: ${successful.length}`);
  console.log(`   失败: ${failed.length}`);
  console.log(`   成功率: ${((successful.length / results.length) * 100).toFixed(1)}%`);
  
  if (successful.length > 0) {
    console.log(`\n🏭 成功创建的工厂:`);
    
    // 按行业分组
    const byIndustry = {};
    const byRegion = {};
    
    successful.forEach(result => {
      const coding = result.factory.intelligentCoding;
      const industryKey = `${coding.industryCode}-${coding.industryName}`;
      const regionKey = `${coding.regionCode}-${coding.regionName}`;
      
      if (!byIndustry[industryKey]) byIndustry[industryKey] = [];
      if (!byRegion[regionKey]) byRegion[regionKey] = [];
      
      byIndustry[industryKey].push(result);
      byRegion[regionKey].push(result);
    });
    
    console.log(`\n🏢 按行业分组:`);
    Object.keys(byIndustry).forEach(industry => {
      const factories = byIndustry[industry];
      console.log(`   ${industry}: ${factories.length}个工厂`);
      factories.forEach(f => {
        console.log(`     - ${f.factory.id}: ${f.name}`);
      });
    });
    
    console.log(`\n🌍 按地区分组:`);
    Object.keys(byRegion).forEach(region => {
      const factories = byRegion[region];
      console.log(`   ${region}: ${factories.length}个工厂`);
      factories.forEach(f => {
        console.log(`     - ${f.factory.id}: ${f.name}`);
      });
    });
    
    console.log(`\n🧠 智能编码准确性分析:`);
    const confidenceStats = successful.map(r => r.factory.intelligentCoding.confidence);
    const avgConfidence = confidenceStats.reduce((a, b) => a + b, 0) / confidenceStats.length;
    const highConfidence = confidenceStats.filter(c => c >= 0.8).length;
    const needsConfirmation = successful.filter(r => r.factory.intelligentCoding.needsConfirmation).length;
    
    console.log(`   平均置信度: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log(`   高置信度(>=80%): ${highConfidence}/${successful.length} (${((highConfidence/successful.length)*100).toFixed(1)}%)`);
    console.log(`   需要人工确认: ${needsConfirmation}/${successful.length} (${((needsConfirmation/successful.length)*100).toFixed(1)}%)`);
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ 失败的工厂:`);
    failed.forEach(result => {
      console.log(`   ${result.index}. ${result.name}: ${result.error}`);
    });
  }
  
  console.log(`\n✨ 智能工厂ID生成系统性能总结:`);
  console.log(`   🎯 成功率: ${((successful.length / results.length) * 100).toFixed(1)}%`);
  if (successful.length > 0) {
    console.log(`   🏭 支持多行业: ${Object.keys(byIndustry).length}个不同行业`);
    console.log(`   🌍 覆盖多地区: ${Object.keys(byRegion).length}个不同地区`);
    console.log(`   📊 平均置信度: ${(avgConfidence * 100).toFixed(1)}%`);
  }
  console.log(`   🎨 新ID格式: III-GG-YYYY-NNN`);
  console.log(`   📝 兼容老格式: FCT_YYYY_XXX`);
}

/**
 * 主函数
 */
async function main() {
  console.log('🌟 智能工厂ID生成系统 - 批量测试');
  console.log('='.repeat(60));
  
  try {
    // 批量创建工厂
    const results = await batchCreateFactories();
    
    // 分析结果
    analyzeResults(results);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 批量测试完成!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ 批量测试失败:', error);
  }
}

// 运行测试
main().catch(console.error);