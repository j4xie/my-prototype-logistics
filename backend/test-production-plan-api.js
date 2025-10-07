/**
 * 生产计划管理系统 API 测试脚本
 * 测试所有新增的 API 端点
 */

const API_BASE = 'http://localhost:3001/api/mobile';

// 测试用户令牌 (需要先登录获取)
let authToken = '';

// 测试数据ID (在测试过程中记录)
let testProductTypeId = '';
let testMaterialTypeId = '';
let testConversionId = '';
let testMerchantId = '';
let testProductionPlanId = '';
let testBatchId = '';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function request(method, endpoint, data = null, requireAuth = true) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (requireAuth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options = {
    method,
    headers,
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const result = await response.json();

  return { status: response.status, data: result };
}

// ==================== 测试步骤 ====================

async function test1_Login() {
  log('\n📝 测试 1: 用户登录', 'blue');

  const { status, data } = await request('POST', '/auth/unified-login', {
    username: 'super_admin',
    password: 'Admin@123456',
    deviceInfo: {
      deviceId: 'TEST_DEVICE_API',
      deviceModel: 'Test Device',
      platform: 'test',
      osVersion: '1.0',
    },
  }, false);

  if (status === 200 && data.success) {
    authToken = data.token;
    log(`✅ 登录成功! Token: ${authToken.substring(0, 20)}...`, 'green');
    return true;
  } else {
    log(`❌ 登录失败: ${JSON.stringify(data)}`, 'red');
    return false;
  }
}

async function test2_CreateProductType() {
  log('\n📝 测试 2: 创建产品类型', 'blue');

  const { status, data } = await request('POST', '/products/types', {
    name: '鱼片',
    code: 'YP001',
    category: '主产品',
    description: '去骨鱼片产品',
  });

  if (status === 201 && data.success) {
    testProductTypeId = data.data.id;
    log(`✅ 产品类型创建成功! ID: ${testProductTypeId}`, 'green');
    return true;
  } else {
    log(`❌ 产品类型创建失败: ${JSON.stringify(data)}`, 'red');
    return false;
  }
}

async function test3_GetProductTypes() {
  log('\n📝 测试 3: 获取产品类型列表', 'blue');

  const { status, data } = await request('GET', '/products/types');

  if (status === 200 && data.success) {
    log(`✅ 获取产品类型成功! 共 ${data.data.length} 个`, 'green');
    console.log(data.data);
    return true;
  } else {
    log(`❌ 获取产品类型失败: ${JSON.stringify(data)}`, 'red');
    return false;
  }
}

async function test4_GetMaterialTypes() {
  log('\n📝 测试 4: 获取原料类型列表', 'blue');

  const { status, data } = await request('GET', '/materials/types');

  if (status === 200 && data.success) {
    if (data.data.length > 0) {
      testMaterialTypeId = data.data[0].id;
      log(`✅ 获取原料类型成功! 共 ${data.data.length} 个`, 'green');
      log(`   使用第一个原料类型: ${data.data[0].name} (ID: ${testMaterialTypeId})`, 'yellow');
      return true;
    } else {
      log(`⚠️  原料类型为空,先创建一个原料类型`, 'yellow');
      // 创建测试原料类型
      const createResult = await request('POST', '/materials/types', {
        name: '鲈鱼',
        category: '鱼类',
        unit: 'kg',
        description: '新鲜鲈鱼',
      });
      if (createResult.status === 201) {
        testMaterialTypeId = createResult.data.data.id;
        log(`✅ 原料类型创建成功! ID: ${testMaterialTypeId}`, 'green');
        return true;
      }
    }
  } else {
    log(`❌ 获取原料类型失败: ${JSON.stringify(data)}`, 'red');
  }
  return false;
}

async function test5_CreateConversionRate() {
  log('\n📝 测试 5: 创建转换率配置', 'blue');

  const { status, data } = await request('POST', '/conversions', {
    materialTypeId: testMaterialTypeId,
    productTypeId: testProductTypeId,
    conversionRate: 60, // 60% 转换率
    wastageRate: 5,     // 5% 损耗率
    notes: '鲈鱼到鱼片的转换率',
  });

  if (status === 201 && data.success) {
    testConversionId = data.data.id;
    log(`✅ 转换率创建成功! ID: ${testConversionId}`, 'green');
    log(`   ${data.data.materialType.name} → ${data.data.productType.name}: ${data.data.conversionRate}%`, 'yellow');
    return true;
  } else {
    log(`❌ 转换率创建失败: ${JSON.stringify(data)}`, 'red');
    return false;
  }
}

async function test6_EstimateMaterial() {
  log('\n📝 测试 6: 预估原料用量', 'blue');

  const { status, data } = await request('POST', '/conversions/estimate', {
    productTypeId: testProductTypeId,
    plannedQuantity: 100, // 计划生产 100kg 鱼片
    materialTypeId: testMaterialTypeId,
  });

  if (status === 200 && data.success) {
    log(`✅ 原料用量预估成功!`, 'green');
    log(`   计划产量: ${data.data.plannedQuantity}kg`, 'yellow');
    log(`   转换率: ${data.data.conversionRate}%`, 'yellow');
    log(`   损耗率: ${data.data.wastageRate}%`, 'yellow');
    log(`   基础需求: ${data.data.baseRequirement}kg`, 'yellow');
    log(`   预估用量: ${data.data.estimatedUsage}kg`, 'yellow');
    return true;
  } else {
    log(`❌ 原料用量预估失败: ${JSON.stringify(data)}`, 'red');
    return false;
  }
}

async function test7_CreateMerchant() {
  log('\n📝 测试 7: 创建商家', 'blue');

  const { status, data } = await request('POST', '/merchants', {
    name: '海鲜批发市场',
    code: 'MER001',
    contactPerson: '张三',
    contactPhone: '13800138000',
    address: '上海市浦东新区海鲜批发市场',
    businessType: '批发',
    creditLevel: 'A',
  });

  if (status === 201 && data.success) {
    testMerchantId = data.data.id;
    log(`✅ 商家创建成功! ID: ${testMerchantId}`, 'green');
    return true;
  } else {
    log(`❌ 商家创建失败: ${JSON.stringify(data)}`, 'red');
    return false;
  }
}

async function test8_CreateProductionPlan() {
  log('\n📝 测试 8: 创建生产计划', 'blue');

  const { status, data } = await request('POST', '/production-plans', {
    productTypeId: testProductTypeId,
    merchantId: testMerchantId,
    plannedQuantity: 100,
    notes: '第一批鱼片生产计划',
  });

  if (status === 201 && data.success) {
    testProductionPlanId = data.data.id;
    log(`✅ 生产计划创建成功! ID: ${testProductionPlanId}`, 'green');
    log(`   计划编号: ${data.data.planNumber}`, 'yellow');
    log(`   产品: ${data.data.productType.name}`, 'yellow');
    log(`   商家: ${data.data.merchant.name}`, 'yellow');
    log(`   计划产量: ${data.data.plannedQuantity}kg`, 'yellow');
    log(`   预估原料: ${data.data.estimatedMaterialUsage}kg`, 'yellow');
    return true;
  } else {
    log(`❌ 生产计划创建失败: ${JSON.stringify(data)}`, 'red');
    return false;
  }
}

async function test9_GetAvailableStock() {
  log('\n📝 测试 9: 获取可用库存', 'blue');

  const { status, data } = await request('GET', '/production-plans/available-stock');

  if (status === 200 && data.success) {
    log(`✅ 获取可用库存成功!`, 'green');
    log(`   总批次数: ${data.data.totalBatches}`, 'yellow');
    if (data.data.stockList.length > 0) {
      log(`   库存明细:`, 'yellow');
      data.data.stockList.slice(0, 3).forEach(stock => {
        log(`     - ${stock.materialCategory}: ${stock.available}kg (${stock.percentage}%)`, 'yellow');
      });
    }
    return true;
  } else {
    log(`❌ 获取可用库存失败: ${JSON.stringify(data)}`, 'red');
    return false;
  }
}

async function test10_GetProductionPlans() {
  log('\n📝 测试 10: 获取生产计划列表', 'blue');

  const { status, data } = await request('GET', '/production-plans?limit=5');

  if (status === 200 && data.success) {
    log(`✅ 获取生产计划列表成功! 共 ${data.data.pagination.count} 个`, 'green');
    if (data.data.plans.length > 0) {
      log(`   最新计划:`, 'yellow');
      data.data.plans.slice(0, 3).forEach(plan => {
        log(`     - ${plan.planNumber}: ${plan.productType.name} (${plan.status})`, 'yellow');
      });
    }
    return true;
  } else {
    log(`❌ 获取生产计划列表失败: ${JSON.stringify(data)}`, 'red');
    return false;
  }
}

// ==================== 运行所有测试 ====================

async function runAllTests() {
  log('\n🚀 开始测试生产计划管理系统 API', 'blue');
  log('='.repeat(50), 'blue');

  const tests = [
    test1_Login,
    test2_CreateProductType,
    test3_GetProductTypes,
    test4_GetMaterialTypes,
    test5_CreateConversionRate,
    test6_EstimateMaterial,
    test7_CreateMerchant,
    test8_CreateProductionPlan,
    test9_GetAvailableStock,
    test10_GetProductionPlans,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      log(`❌ 测试执行错误: ${error.message}`, 'red');
      failed++;
    }
  }

  log('\n' + '='.repeat(50), 'blue');
  log(`\n📊 测试完成!`, 'blue');
  log(`   ✅ 通过: ${passed}`, 'green');
  log(`   ❌ 失败: ${failed}`, 'red');
  log(`   总计: ${tests.length}`, 'yellow');

  process.exit(failed > 0 ? 1 : 0);
}

// 运行测试
runAllTests().catch(error => {
  log(`\n💥 测试运行失败: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
