/**
 * 测试供应商和客户API
 */

const API_BASE = 'http://localhost:3001/api/mobile';

let authToken = '';

// 登录
async function login() {
  const response = await fetch(`${API_BASE}/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'super_admin',
      password: '123456'
    })
  });

  const data = await response.json();
  if (data.success) {
    authToken = data.accessToken;
    console.log('✅ 登录成功');
    console.log(`   用户: ${data.user.username}`);
    console.log(`   工厂: ${data.user.factoryId}`);
    return true;
  } else {
    console.error('❌ 登录失败:', data.message);
    return false;
  }
}

// 获取客户列表
async function getCustomers() {
  console.log('\n📋 获取客户列表...');
  const response = await fetch(`${API_BASE}/customers`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  const data = await response.json();
  if (data.success) {
    console.log(`✅ 找到 ${data.data.length} 个客户:`);
    data.data.forEach(customer => {
      console.log(`   - ${customer.name} (${customer.code})`);
      console.log(`     联系人: ${customer.contactPerson || '无'}`);
      console.log(`     电话: ${customer.contactPhone || '无'}`);
      console.log(`     订单数: ${customer._count?.productionPlans || 0}`);
    });
    return data.data;
  } else {
    console.error('❌ 获取失败:', data.message);
    return [];
  }
}

// 创建供应商
async function createSupplier() {
  console.log('\n➕ 创建供应商...');
  const response = await fetch(`${API_BASE}/suppliers`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: '陈老板海鲜批发',
      contactPerson: '陈老板',
      contactPhone: '+8613800001111',
      address: '深圳市水产批发市场A区101',
      businessType: '水产批发',
      creditLevel: 'A',
      deliveryArea: '深圳市',
      paymentTerms: '月结30天'
    })
  });

  const data = await response.json();
  if (data.success) {
    console.log('✅ 供应商创建成功:');
    console.log(`   名称: ${data.data.name}`);
    console.log(`   代码: ${data.data.code}`);
    console.log(`   联系人: ${data.data.contactPerson}`);
    return data.data;
  } else {
    console.error('❌ 创建失败:', data.message);
    return null;
  }
}

// 获取供应商列表
async function getSuppliers() {
  console.log('\n📋 获取供应商列表...');
  const response = await fetch(`${API_BASE}/suppliers`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  const data = await response.json();
  if (data.success) {
    console.log(`✅ 找到 ${data.data.length} 个供应商:`);
    data.data.forEach(supplier => {
      console.log(`   - ${supplier.name} (${supplier.code})`);
      console.log(`     联系人: ${supplier.contactPerson || '无'}`);
      console.log(`     电话: ${supplier.contactPhone || '无'}`);
      console.log(`     批次数: ${supplier._count?.materialBatches || 0}`);
    });
    return data.data;
  } else {
    console.error('❌ 获取失败:', data.message);
    return [];
  }
}

// 创建客户
async function createCustomer() {
  console.log('\n➕ 创建客户...');
  const response = await fetch(`${API_BASE}/customers`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: '李老板餐饮连锁',
      contactPerson: '李总',
      contactPhone: '+8613900002222',
      address: '广州市天河区美食街88号',
      businessType: '餐饮连锁',
      creditLevel: 'B',
      deliveryArea: '广州市',
      paymentTerms: '货到付款'
    })
  });

  const data = await response.json();
  if (data.success) {
    console.log('✅ 客户创建成功:');
    console.log(`   名称: ${data.data.name}`);
    console.log(`   代码: ${data.data.code}`);
    console.log(`   联系人: ${data.data.contactPerson}`);
    return data.data;
  } else {
    console.error('❌ 创建失败:', data.message);
    return null;
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始测试供应商/客户API\n');
  console.log('='.repeat(60));

  // 1. 登录
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.error('\n❌ 无法继续测试，登录失败');
    return;
  }

  console.log('\n' + '='.repeat(60));

  // 2. 获取现有客户
  await getCustomers();

  console.log('\n' + '='.repeat(60));

  // 3. 获取现有供应商
  await getSuppliers();

  console.log('\n' + '='.repeat(60));

  // 4. 创建新供应商
  await createSupplier();

  console.log('\n' + '='.repeat(60));

  // 5. 创建新客户
  await createCustomer();

  console.log('\n' + '='.repeat(60));

  // 6. 再次获取列表验证
  console.log('\n🔍 验证创建结果:');
  await getSuppliers();
  await getCustomers();

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ 测试完成！');
}

// 执行测试
runTests().catch(error => {
  console.error('\n💥 测试失败:', error);
  process.exit(1);
});
