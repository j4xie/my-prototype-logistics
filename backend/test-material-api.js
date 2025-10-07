/**
 * 原料类型 API 测试脚本
 * 测试 GET /api/mobile/materials/types 和 POST /api/mobile/materials/types
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';
const TEST_FACTORY_ID = 'TEST_2024_001';

// 测试用户登录信息
const TEST_USER = {
  username: 'processing_admin',
  password: '123456',  // 标准测试密码
  deviceInfo: {
    deviceId: 'TEST_DEVICE_MATERIAL',
    deviceModel: 'Test Device',
    platform: 'test',
    osVersion: '1.0'
  }
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`Step ${step}: ${message}`, 'cyan');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// 登录获取 token
async function login() {
  logStep(1, '用户登录获取 Token');

  try {
    const response = await fetch(`${BASE_URL}/api/mobile/auth/unified-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: TEST_USER.username,
        password: TEST_USER.password,
        deviceInfo: TEST_USER.deviceInfo,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      logSuccess(`登录成功: ${data.user.username}`);
      logInfo(`User ID: ${data.user.id}`);
      logInfo(`Factory ID: ${data.user.factoryId}`);
      logInfo(`Role: ${data.user.roleCode || data.user.role || 'N/A'}`);
      const token = data.accessToken || data.tokens?.token || data.token;
      if (token) {
        logInfo(`Token: ${token.substring(0, 50)}...`);
        return token;
      } else {
        logError('登录响应中没有找到 token');
        console.log('完整响应:', JSON.stringify(data, null, 2));
        return null;
      }
    } else {
      logError(`登录失败: ${data.message}`);
      return null;
    }
  } catch (error) {
    logError(`登录请求失败: ${error.message}`);
    return null;
  }
}

// 获取原料类型列表
async function getMaterialTypes(token) {
  logStep(2, '获取原料类型列表');

  try {
    const response = await fetch(`${BASE_URL}/api/mobile/materials/types`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      logSuccess(`获取原料类型成功 (共 ${data.data?.length || 0} 条)`);

      if (data.data && data.data.length > 0) {
        log('\n原料类型列表:', 'yellow');
        data.data.forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.name} (${item.category}) - ${item.unit}`);
        });
      } else {
        logInfo('当前无原料类型数据');
      }

      return data.data || [];
    } else {
      logError(`获取原料类型失败: ${data.message || response.statusText}`);
      return [];
    }
  } catch (error) {
    logError(`获取原料类型请求失败: ${error.message}`);
    return [];
  }
}

// 创建新的原料类型
async function createMaterialType(token, materialData) {
  logStep(3, `创建新原料类型: ${materialData.name}`);

  try {
    const response = await fetch(`${BASE_URL}/api/mobile/materials/types`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(materialData),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      logSuccess(`创建原料类型成功: ${data.data.name}`);
      logInfo(`ID: ${data.data.id}`);
      logInfo(`名称: ${data.data.name}`);
      logInfo(`分类: ${data.data.category}`);
      logInfo(`单位: ${data.data.unit}`);
      return data.data;
    } else {
      logError(`创建原料类型失败: ${data.message || response.statusText}`);
      return null;
    }
  } catch (error) {
    logError(`创建原料类型请求失败: ${error.message}`);
    return null;
  }
}

// 验证新创建的原料类型是否在列表中
async function verifyMaterialType(token, materialName) {
  logStep(4, `验证新创建的原料类型: ${materialName}`);

  const materials = await getMaterialTypes(token);
  const found = materials.find(m => m.name === materialName);

  if (found) {
    logSuccess(`验证成功: 在列表中找到 "${materialName}"`);
    return true;
  } else {
    logError(`验证失败: 在列表中未找到 "${materialName}"`);
    return false;
  }
}

// 测试创建重复原料类型（应该失败）
async function testDuplicateCreation(token, materialData) {
  logStep(5, `测试重复创建原料类型: ${materialData.name}`);

  try {
    const response = await fetch(`${BASE_URL}/api/mobile/materials/types`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(materialData),
    });

    const data = await response.json();

    if (response.status === 400 && !data.success) {
      logSuccess(`重复检测正常: ${data.message}`);
      return true;
    } else {
      logError('重复检测失败: 应该返回错误但实际成功了');
      return false;
    }
  } catch (error) {
    logError(`重复检测请求失败: ${error.message}`);
    return false;
  }
}

// 主测试流程
async function runTests() {
  log('\n🚀 开始测试原料类型 API 接口...', 'cyan');
  log(`📡 服务器地址: ${BASE_URL}`, 'cyan');
  log(`🏭 工厂ID: ${TEST_FACTORY_ID}`, 'cyan');

  // Step 1: 登录
  const token = await login();
  if (!token) {
    logError('登录失败，终止测试');
    process.exit(1);
  }

  // Step 2: 获取现有原料类型列表
  const existingMaterials = await getMaterialTypes(token);

  // Step 3: 创建新的原料类型
  const testMaterials = [
    { name: '黄鱼', category: '鱼类', unit: 'kg', description: '测试用黄鱼原料' },
    { name: '大虾', category: '虾蟹类', unit: 'kg', description: '测试用大虾原料' },
    { name: '扇贝', category: '贝类', unit: 'kg', description: '测试用扇贝原料' },
  ];

  const createdMaterials = [];
  for (const material of testMaterials) {
    const created = await createMaterialType(token, material);
    if (created) {
      createdMaterials.push(created);
    }
    // 添加延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Step 4: 验证创建的原料类型
  if (createdMaterials.length > 0) {
    for (const material of createdMaterials) {
      await verifyMaterialType(token, material.name);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // Step 5: 测试重复创建
  if (createdMaterials.length > 0) {
    await testDuplicateCreation(token, {
      name: createdMaterials[0].name,
      category: createdMaterials[0].category,
      unit: 'kg',
    });
  }

  // 最终总结
  logStep(6, '测试总结');
  log('\n📊 测试结果统计:', 'yellow');
  log(`  • 尝试创建: ${testMaterials.length} 个原料类型`, 'yellow');
  log(`  • 成功创建: ${createdMaterials.length} 个原料类型`, 'yellow');
  log(`  • 现有总数: ${existingMaterials.length} → ${existingMaterials.length + createdMaterials.length} 个`, 'yellow');

  if (createdMaterials.length === testMaterials.length) {
    log('\n🎉 所有测试通过！', 'green');
  } else {
    log('\n⚠️  部分测试失败，请检查日志', 'yellow');
  }

  log('\n✨ 测试完成！\n', 'cyan');
}

// 运行测试
runTests().catch(error => {
  logError(`测试过程发生错误: ${error.message}`);
  console.error(error);
  process.exit(1);
});
