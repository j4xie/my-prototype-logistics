/**
 * 生产计划管理流程测试
 * 测试完整的生产计划流程:创建→开始→消耗→完成
 */

const API_BASE = 'http://localhost:3001/api';

// 测试账号 (从backend/scripts/admin/create-test-users.js)
const TEST_USER = {
  username: 'processing_admin',
  password: 'DeptAdmin@123'
};

let authToken = '';
let productTypeId = '';
let merchantId = '';
let planId = '';
let batchId = '';

/**
 * 步骤1: 登录获取Token
 */
async function login() {
  console.log('\n=== 步骤1: 登录 ===');

  const response = await fetch(`${API_BASE}/mobile/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: TEST_USER.username,
      password: TEST_USER.password,
      deviceInfo: {
        deviceId: 'TEST_DEVICE_PRODUCTION',
        deviceModel: 'Test Device',
        platform: 'test',
        osVersion: '1.0'
      }
    })
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(`登录失败: ${data.message}`);
  }

  authToken = data.tokens.token;
  console.log('✅ 登录成功');
  console.log(`   用户: ${data.user.username}`);
  console.log(`   工厂: ${data.user.factoryId || 'N/A'}`);
  console.log(`   Token: ${authToken.substring(0, 20)}...`);
}

/**
 * 步骤2: 获取产品类型列表
 */
async function getProductTypes() {
  console.log('\n=== 步骤2: 获取产品类型列表 ===');

  const response = await fetch(`${API_BASE}/mobile/products?limit=5`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  const data = await response.json();

  if (!data.success || !data.data.productTypes.length) {
    throw new Error('无法获取产品类型');
  }

  productTypeId = data.data.productTypes[0].id;
  console.log('✅ 获取产品类型成功');
  console.log(`   产品数量: ${data.data.productTypes.length}`);
  console.log(`   第一个产品: ${data.data.productTypes[0].name} (${data.data.productTypes[0].code})`);
}

/**
 * 步骤3: 获取商家列表
 */
async function getMerchants() {
  console.log('\n=== 步骤3: 获取商家列表 ===');

  const response = await fetch(`${API_BASE}/mobile/merchants?limit=5`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  const data = await response.json();

  if (!data.success || !data.data.merchants.length) {
    throw new Error('无法获取商家');
  }

  merchantId = data.data.merchants[0].id;
  console.log('✅ 获取商家成功');
  console.log(`   商家数量: ${data.data.merchants.length}`);
  console.log(`   第一个商家: ${data.data.merchants[0].name} (${data.data.merchants[0].code})`);
}

/**
 * 步骤4: 获取可用库存
 */
async function getAvailableStock() {
  console.log('\n=== 步骤4: 获取可用库存 ===');

  const response = await fetch(`${API_BASE}/mobile/production-plans/available-stock`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  const data = await response.json();

  if (!data.success) {
    console.log('⚠️  获取库存失败或无库存数据');
    return;
  }

  console.log('✅ 获取库存成功');
  console.log(`   总批次: ${data.data.totalBatches}`);

  if (data.data.summary.length > 0) {
    console.log('   库存汇总:');
    data.data.summary.forEach(item => {
      console.log(`     - ${item.category}: ${item.totalAvailable}kg (${item.batchCount}批次)`);
    });

    // 保存第一个批次ID用于测试消耗
    if (data.data.stockList.length > 0) {
      batchId = data.data.stockList[0].batchId;
    }
  }
}

/**
 * 步骤5: 创建生产计划
 */
async function createProductionPlan() {
  console.log('\n=== 步骤5: 创建生产计划 ===');

  const response = await fetch(`${API_BASE}/mobile/production-plans`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      productTypeId,
      merchantId,
      plannedQuantity: 50,
      notes: '测试生产计划 - 自动化测试'
    })
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(`创建生产计划失败: ${data.message}`);
  }

  planId = data.data.id;
  console.log('✅ 创建生产计划成功');
  console.log(`   计划编号: ${data.data.planNumber}`);
  console.log(`   产品: ${data.data.productType.name}`);
  console.log(`   商家: ${data.data.merchant.name}`);
  console.log(`   计划产量: ${data.data.plannedQuantity}kg`);
  console.log(`   预估原料: ${data.data.estimatedMaterialUsage}kg`);
  console.log(`   状态: ${data.data.status}`);
}

/**
 * 步骤6: 获取生产计划列表
 */
async function getProductionPlans() {
  console.log('\n=== 步骤6: 获取生产计划列表 ===');

  const response = await fetch(`${API_BASE}/mobile/production-plans?status=pending&limit=5`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error('获取生产计划列表失败');
  }

  console.log('✅ 获取生产计划列表成功');
  console.log(`   总计划数: ${data.data.pagination.count}`);
  console.log(`   待生产: ${data.data.plans.filter(p => p.status === 'pending').length}`);
  console.log(`   当前页计划数: ${data.data.plans.length}`);
}

/**
 * 步骤7: 开始生产
 */
async function startProduction() {
  console.log('\n=== 步骤7: 开始生产 ===');

  const response = await fetch(`${API_BASE}/mobile/production-plans/${planId}/start`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(`开始生产失败: ${data.message}`);
  }

  console.log('✅ 开始生产成功');
  console.log(`   计划编号: ${data.data.planNumber}`);
  console.log(`   新状态: ${data.data.status}`);
}

/**
 * 步骤8: 记录原料消耗 (如果有可用批次)
 */
async function consumeMaterial() {
  if (!batchId) {
    console.log('\n=== 步骤8: 跳过原料消耗 (无可用批次) ===');
    return;
  }

  console.log('\n=== 步骤8: 记录原料消耗 ===');

  const response = await fetch(`${API_BASE}/mobile/production-plans/${planId}/consume-material`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      batchId,
      consumedQuantity: 20,
      notes: '测试消耗记录'
    })
  });

  const data = await response.json();

  if (!data.success) {
    console.log(`⚠️  记录消耗失败: ${data.message}`);
    return;
  }

  console.log('✅ 记录原料消耗成功');
  console.log(`   批次: ${data.data.batch.batchNumber}`);
  console.log(`   消耗量: ${data.data.consumedQuantity}kg`);
}

/**
 * 步骤9: 完成生产
 */
async function completeProduction() {
  console.log('\n=== 步骤9: 完成生产 ===');

  const response = await fetch(`${API_BASE}/mobile/production-plans/${planId}/complete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      actualQuantity: 48
    })
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(`完成生产失败: ${data.message}`);
  }

  console.log('✅ 完成生产成功');
  console.log(`   计划编号: ${data.data.planNumber}`);
  console.log(`   新状态: ${data.data.status}`);
  console.log(`   实际产量: ${data.data.actualQuantity}kg`);
}

/**
 * 步骤10: 获取计划详情
 */
async function getPlanDetail() {
  console.log('\n=== 步骤10: 获取生产计划详情 ===');

  const response = await fetch(`${API_BASE}/mobile/production-plans/${planId}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error('获取计划详情失败');
  }

  console.log('✅ 获取计划详情成功');
  console.log(`   计划编号: ${data.data.planNumber}`);
  console.log(`   状态: ${data.data.status}`);
  console.log(`   计划产量: ${data.data.plannedQuantity}kg`);
  console.log(`   实际产量: ${data.data.actualQuantity || 0}kg`);
  console.log(`   预估原料: ${data.data.estimatedMaterialUsage}kg`);
  console.log(`   实际原料: ${data.data.actualMaterialUsed || 0}kg`);
  console.log(`   消耗记录数: ${data.data._count?.materialConsumptions || 0}`);
}

/**
 * 主测试流程
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       生产计划管理完整流程测试                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await login();
    await getProductTypes();
    await getMerchants();
    await getAvailableStock();
    await createProductionPlan();
    await getProductionPlans();
    await startProduction();
    await consumeMaterial();
    await completeProduction();
    await getPlanDetail();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║       ✅ 所有测试通过!生产计划管理系统正常运行              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

main();
