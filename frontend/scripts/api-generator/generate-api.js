#!/usr/bin/env node

/**
 * Mock API自动化生成脚手架
 * @description TASK-P3-019A Day 1 - 自动化脚手架工具修正版
 * @created 2025-06-03
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  baseDir: path.join(__dirname, '../web-app-next/src/app/api'),
  typesDir: path.join(__dirname, '../web-app-next/src/types/api'),

  modules: [
    {
      name: 'farming',
      endpoints: [
        { path: 'fields', methods: ['GET', 'POST'], entity: 'Field' },
        { path: 'fields/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'Field' },
        { path: 'crops', methods: ['GET', 'POST'], entity: 'Crop' },
        { path: 'crops/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'Crop' },
        { path: 'planting-plans', methods: ['GET', 'POST'], entity: 'PlantingPlan' },
        { path: 'planting-plans/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'PlantingPlan' },
        { path: 'farm-activities', methods: ['GET', 'POST'], entity: 'FarmActivity' },
        { path: 'farm-activities/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'FarmActivity' },
        { path: 'harvest-records', methods: ['GET', 'POST'], entity: 'HarvestRecord' },
        { path: 'harvest-records/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'HarvestRecord' },
        { path: 'dashboard', methods: ['GET'], entity: 'FarmingDashboard' }
      ]
    },
    {
      name: 'processing',
      endpoints: [
        { path: 'raw-materials', methods: ['GET', 'POST'], entity: 'RawMaterial' },
        { path: 'raw-materials/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'RawMaterial' },
        { path: 'production-batches', methods: ['GET', 'POST'], entity: 'ProductionBatch' },
        { path: 'production-batches/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'ProductionBatch' },
        { path: 'finished-products', methods: ['GET', 'POST'], entity: 'FinishedProduct' },
        { path: 'finished-products/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'FinishedProduct' },
        { path: 'quality-tests', methods: ['GET', 'POST'], entity: 'QualityTest' },
        { path: 'quality-tests/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'QualityTest' },
        { path: 'dashboard', methods: ['GET'], entity: 'ProcessingDashboard' }
      ]
    },
    {
      name: 'logistics',
      endpoints: [
        { path: 'transport-orders', methods: ['GET', 'POST'], entity: 'TransportOrder' },
        { path: 'transport-orders/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'TransportOrder' },
        { path: 'vehicles', methods: ['GET', 'POST'], entity: 'Vehicle' },
        { path: 'vehicles/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'Vehicle' },
        { path: 'drivers', methods: ['GET', 'POST'], entity: 'Driver' },
        { path: 'drivers/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'Driver' },
        { path: 'warehouses', methods: ['GET', 'POST'], entity: 'Warehouse' },
        { path: 'warehouses/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'Warehouse' },
        { path: 'inventory', methods: ['GET', 'POST'], entity: 'InventoryItem' },
        { path: 'inventory/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'InventoryItem' },
        { path: 'dashboard', methods: ['GET'], entity: 'LogisticsDashboard' }
      ]
    },
    {
      name: 'admin',
      endpoints: [
        { path: 'users', methods: ['GET', 'POST'], entity: 'User' },
        { path: 'users/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'User' },
        { path: 'roles', methods: ['GET', 'POST'], entity: 'Role' },
        { path: 'roles/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'Role' },
        { path: 'permissions', methods: ['GET'], entity: 'Permission' },
        { path: 'audit-logs', methods: ['GET', 'POST'], entity: 'AuditLog' },
        { path: 'audit-logs/[id]', methods: ['GET'], entity: 'AuditLog' },
        { path: 'system-config', methods: ['GET', 'PUT'], entity: 'SystemConfig' },
        { path: 'system-config/[key]', methods: ['GET', 'PUT'], entity: 'SystemConfig' },
        { path: 'notifications', methods: ['GET', 'POST'], entity: 'Notification' },
        { path: 'notifications/[id]', methods: ['GET', 'PUT', 'DELETE'], entity: 'Notification' },
        { path: 'dashboard', methods: ['GET'], entity: 'AdminDashboard' }
      ]
    }
  ]
};

// 工具函数
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 内联Mock数据生成器
function generateInlineMockData(entityName, overrides = {}) {
  const mockData = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides
  };

  // 根据实体类型生成特定数据
  switch (entityName) {
    case 'Field':
      return {
        ...mockData,
        name: `农田${randomInt(1, 999)}号`,
        code: `F${randomInt(10000, 99999)}`,
        location: {
          latitude: 39.9 + Math.random() * 0.2,
          longitude: 116.3 + Math.random() * 0.2,
          address: `北京市朝阳区农田路${randomInt(1, 200)}号`,
          city: '北京',
          province: '北京市',
          country: '中国'
        },
        area: randomInt(50, 2000),
        soilType: randomChoice(['sandy', 'clay', 'loam', 'silt']),
        soilPh: 6.5 + Math.random() * 2,
        irrigation: randomChoice(['drip', 'sprinkler', 'flood', 'none']),
        owner: `农户${randomInt(1, 100)}`,
        manager: `管理员${randomInt(1, 50)}`,
        status: randomChoice(['active', 'inactive', 'maintenance']),
        certifications: ['有机认证', '绿色食品'],
        description: '优质农田，土壤肥沃'
      };

    case 'Crop':
      const cropNames = ['玉米', '小麦', '大豆', '水稻'];
      const cropName = randomChoice(cropNames);
      return {
        ...mockData,
        name: cropName,
        variety: `${cropName}优质品种`,
        category: randomChoice(['grain', 'vegetable', 'fruit', 'cash', 'feed']),
        growthCycle: randomInt(90, 180),
        description: `${cropName}，适应性强，产量稳定`,
        requirements: {
          minTemperature: randomInt(5, 15),
          maxTemperature: randomInt(25, 35),
          waterNeed: randomChoice(['low', 'medium', 'high']),
          lightRequirement: randomChoice(['full', 'partial', 'shade']),
          soilType: ['loam', 'clay']
        },
        nutritionInfo: {
          protein: 8 + Math.random() * 20,
          carbohydrate: 50 + Math.random() * 30,
          fat: 1 + Math.random() * 10,
          calories: randomInt(200, 400)
        }
      };

    case 'FarmingDashboard':
      return {
        fieldCount: randomInt(20, 100),
        totalArea: randomInt(5000, 50000),
        activePlantingPlans: randomInt(15, 80),
        upcomingHarvests: randomInt(5, 25),
        totalYieldThisYear: randomInt(50000, 500000),
        averageYieldPerAcre: 400 + Math.random() * 400,
        recentActivities: []
      };

    default:
      return mockData;
  }
}

// 生成实体特定数据的函数
function generateEntitySpecificData(entityName) {
  switch (entityName) {
    case 'Field':
      return `
  return {
    ...mockData,
    name: \`农田\${randomInt(1, 999)}号\`,
    code: \`F\${randomInt(10000, 99999)}\`,
    location: {
      latitude: 39.9 + Math.random() * 0.2,
      longitude: 116.3 + Math.random() * 0.2,
      address: \`北京市朝阳区农田路\${randomInt(1, 200)}号\`,
      city: '北京',
      province: '北京市',
      country: '中国'
    },
    area: randomInt(50, 2000),
    soilType: randomChoice(['sandy', 'clay', 'loam', 'silt']),
    soilPh: 6.5 + Math.random() * 2,
    irrigation: randomChoice(['drip', 'sprinkler', 'flood', 'none']),
    owner: \`农户\${randomInt(1, 100)}\`,
    manager: \`管理员\${randomInt(1, 50)}\`,
    status: randomChoice(['active', 'inactive', 'maintenance']),
    certifications: ['有机认证', '绿色食品'],
    description: '优质农田，土壤肥沃'
  };`;

    case 'Crop':
      return `
  const cropNames = ['玉米', '小麦', '大豆', '水稻'];
  const cropName = randomChoice(cropNames);
  return {
    ...mockData,
    name: cropName,
    variety: \`\${cropName}优质品种\`,
    category: randomChoice(['grain', 'vegetable', 'fruit', 'cash', 'feed']),
    growthCycle: randomInt(90, 180),
    description: \`\${cropName}，适应性强，产量稳定\`,
    requirements: {
      minTemperature: randomInt(5, 15),
      maxTemperature: randomInt(25, 35),
      waterNeed: randomChoice(['low', 'medium', 'high']),
      lightRequirement: randomChoice(['full', 'partial', 'shade']),
      soilType: ['loam', 'clay']
    },
    nutritionInfo: {
      protein: 8 + Math.random() * 20,
      carbohydrate: 50 + Math.random() * 30,
      fat: 1 + Math.random() * 10,
      calories: randomInt(200, 400)
    }
  };`;

    case 'RawMaterial':
      return `
  return {
    ...mockData,
    name: randomChoice(['大豆', '玉米', '小麦', '水稻', '花生', '菜籽']),
    code: \`RM\${randomInt(10000, 99999)}\`,
    category: randomChoice(['grain', 'seeds', 'nuts', 'vegetables']),
    origin: randomChoice(['山东', '黑龙江', '吉林', '河南', '内蒙古']),
    supplier: \`供应商\${randomInt(1, 50)}\`,
    purchaseDate: new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000).toISOString(),
    expiryDate: new Date(Date.now() + randomInt(30, 365) * 24 * 60 * 60 * 1000).toISOString(),
    quantity: randomInt(1000, 50000),
    unit: randomChoice(['kg', 'ton', 'bag', 'box']),
    pricePerUnit: 5 + Math.random() * 20,
    totalValue: 0, // 计算得出
    qualityGrade: randomChoice(['A', 'B', 'C']),
    moistureContent: 10 + Math.random() * 5,
    storageLocation: \`仓库\${randomInt(1, 10)}区域\${randomInt(1, 20)}\`,
    certifications: ['有机认证', '质量安全认证'],
    description: '优质原料，严格质检'
  };`;

    case 'ProductionBatch':
      return `
  return {
    ...mockData,
    batchNumber: \`PB\${new Date().getFullYear()}\${String(Date.now()).slice(-6)}\`,
    productType: randomChoice(['面粉', '豆油', '花生油', '玉米油', '大豆蛋白']),
    rawMaterialIds: Array.from({length: randomInt(2, 5)}, () => generateId()),
    startDate: new Date(Date.now() - randomInt(1, 7) * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + randomInt(1, 3) * 24 * 60 * 60 * 1000).toISOString(),
    plannedQuantity: randomInt(5000, 20000),
    actualQuantity: randomInt(4500, 19500),
    productionLine: \`生产线\${randomInt(1, 8)}\`,
    supervisor: \`生产主管\${randomInt(1, 20)}\`,
    shift: randomChoice(['早班', '中班', '夜班']),
    status: randomChoice(['planned', 'in-progress', 'completed', 'quality-check', 'approved']),
    qualityScore: 85 + Math.random() * 15,
    efficiency: 80 + Math.random() * 20,
    energyConsumption: randomInt(1000, 5000), // kWh
    wasteGenerated: randomInt(50, 500), // kg
    notes: '生产过程正常，质量稳定'
  };`;

    case 'FinishedProduct':
      return `
  return {
    ...mockData,
    name: randomChoice(['精制面粉', '一级豆油', '压榨花生油', '特级玉米油', '大豆分离蛋白']),
    code: \`FP\${randomInt(10000, 99999)}\`,
    batchId: generateId(),
    category: randomChoice(['flour', 'oil', 'protein', 'seasoning']),
    specification: randomChoice(['500g', '1kg', '5kg', '10kg', '25kg']),
    productionDate: new Date(Date.now() - randomInt(1, 15) * 24 * 60 * 60 * 1000).toISOString(),
    expiryDate: new Date(Date.now() + randomInt(180, 730) * 24 * 60 * 60 * 1000).toISOString(),
    quantity: randomInt(1000, 10000),
    unit: randomChoice(['bottle', 'bag', 'box', 'can']),
    costPerUnit: 8 + Math.random() * 15,
    sellingPricePerUnit: 12 + Math.random() * 20,
    qualityGrade: randomChoice(['优等品', '一等品', '合格品']),
    nutritionInfo: {
      protein: 8 + Math.random() * 20,
      fat: 5 + Math.random() * 30,
      carbohydrate: 40 + Math.random() * 50,
      calories: randomInt(300, 600)
    },
    storageRequirements: randomChoice(['常温', '冷藏', '冷冻']),
    packagingType: randomChoice(['瓶装', '袋装', '盒装', '罐装']),
    barcode: \`69\${randomInt(100000000000, 999999999999)}\`,
    status: randomChoice(['in-stock', 'shipped', 'sold']),
    description: '优质产品，营养丰富'
  };`;

    case 'QualityTest':
      return `
  return {
    ...mockData,
    testNumber: \`QT\${new Date().getFullYear()}\${String(Date.now()).slice(-6)}\`,
    productId: generateId(),
    productType: randomChoice(['raw-material', 'finished-product', 'intermediate']),
    testType: randomChoice(['incoming', 'in-process', 'final', 'stability']),
    testDate: new Date(Date.now() - randomInt(1, 7) * 24 * 60 * 60 * 1000).toISOString(),
    tester: \`质检员\${randomInt(1, 15)}\`,
    testParameters: [
      {
        parameter: '水分含量',
        standardValue: '≤12%',
        actualValue: \`\${(10 + Math.random() * 3).toFixed(1)}%\`,
        result: randomChoice(['合格', '不合格'])
      },
      {
        parameter: '蛋白质含量',
        standardValue: '≥85%',
        actualValue: \`\${(85 + Math.random() * 10).toFixed(1)}%\`,
        result: randomChoice(['合格', '不合格'])
      },
      {
        parameter: '酸价',
        standardValue: '≤4mg KOH/g',
        actualValue: \`\${(2 + Math.random() * 3).toFixed(1)}mg KOH/g\`,
        result: randomChoice(['合格', '不合格'])
      }
    ],
    overallResult: randomChoice(['合格', '不合格', '待复检']),
    qualityScore: 75 + Math.random() * 25,
    notes: '检测过程规范，结果可靠',
    certificateNumber: \`CERT\${randomInt(100000, 999999)}\`,
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    status: randomChoice(['pending', 'completed', 'approved', 'rejected'])
  };`;

    case 'ProcessingDashboard':
      return `
  // Dashboard不需要标准实体字段
  return {
    totalBatches: randomInt(50, 200),
    activeBatches: randomInt(5, 20),
    completedToday: randomInt(2, 8),
    totalProduction: randomInt(100000, 500000), // kg
    qualityPassRate: 92 + Math.random() * 8,
    equipmentUtilization: 75 + Math.random() * 20,
    energyConsumptionToday: randomInt(5000, 15000), // kWh
    wasteGeneratedToday: randomInt(200, 800), // kg
    alertsCount: randomInt(0, 5),
    topProducts: [
      { name: '精制面粉', quantity: randomInt(5000, 15000) },
      { name: '一级豆油', quantity: randomInt(3000, 10000) },
      { name: '花生油', quantity: randomInt(2000, 8000) }
    ],
    recentBatches: []
  };`;

    case 'FarmingDashboard':
    case 'LogisticsDashboard':
    case 'AdminDashboard':
      return `
  // Dashboard不需要标准实体字段
  return {
    fieldCount: randomInt(20, 100),
    totalArea: randomInt(5000, 50000),
    activePlantingPlans: randomInt(15, 80),
    upcomingHarvests: randomInt(5, 25),
    totalYieldThisYear: randomInt(50000, 500000),
    averageYieldPerAcre: 400 + Math.random() * 400,
    recentActivities: []
  };`;

    default:
      return `
  return {
    ...mockData,
    name: \`Mock \${randomInt(1, 999)}\`,
    description: 'Generated mock data'
  };`;
  }
}

// 生成工具函数，根据实体类型决定是否需要randomChoice和mockData
function generateUtilityFunctions(entityName) {
  const needsRandomChoice = ['Field', 'Crop', 'RawMaterial', 'ProductionBatch', 'FinishedProduct', 'QualityTest'].includes(entityName);
  const isDashboard = entityName.includes('Dashboard');

  return `
// 内联Mock数据生成器
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

${needsRandomChoice ? `
function randomChoice(array: any[]) {
  return array[Math.floor(Math.random() * array.length)];
}` : ''}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}`;
}

// 生成API路由文件
function generateApiRoute(module, endpoint) {
  const routePath = path.join(CONFIG.baseDir, module.name, endpoint.path);
  const routeDir = path.dirname(routePath);

  ensureDir(routeDir);

  const routeFile = path.join(routeDir, 'route.ts');
  const entityName = endpoint.entity;

  // 检查是否需要分页参数和是否为dashboard
  const needsPagination = endpoint.methods.includes('GET') && !endpoint.path.includes('[id]') && !endpoint.path.includes('dashboard');
  const isDashboard = endpoint.path.includes('dashboard');

  // 生成路由内容
  const routeContent = `import { NextRequest, NextResponse } from 'next/server';

// ${endpoint.path} API路由
// 生成时间: ${new Date().toISOString()}
// 模块: ${module.name}
// 实体: ${entityName}

${generateUtilityFunctions(entityName)}

function generateMockData(overrides: any = {}) {
  ${!isDashboard ? `const mockData = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides
  };

  // 根据实体类型生成特定数据` : '// 根据实体类型生成特定数据'}
  ${generateEntitySpecificData(entityName)}
}

${endpoint.methods.includes('GET') ? `
export async function GET(request: NextRequest) {
  try {${needsPagination ? `
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search') || '';` : ''}

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

    // 生成Mock数据
    ${endpoint.path.includes('[id]') ? `
    // 单个资源获取
    const pathParts = request.url.split('/');
    const id = pathParts[pathParts.length - 1] || generateId();
    const data = generateMockData({ id });

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });` : isDashboard ? `
    // Dashboard数据获取
    const data = generateMockData();

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });` : `
    // 列表资源获取
    const total = 50 + Math.floor(Math.random() * 100);
    const data = Array.from({ length: Math.min(pageSize, total) }, () =>
      generateMockData()
    );

    // 搜索过滤
    const filteredData = search
      ? data.filter(item => JSON.stringify(item).toLowerCase().includes(search.toLowerCase()))
      : data;

    return NextResponse.json({
      success: true,
      data: filteredData,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1
      },
      timestamp: new Date().toISOString()
    });`}
  } catch (error) {
    console.error('GET /${module.name}/${endpoint.path} error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}` : ''}

${endpoint.methods.includes('POST') ? `
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));

    // 验证必填字段 (简化版)
    if (!body) {
      return NextResponse.json({
        success: false,
        message: 'Request body is required',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // 生成新资源
    const newData = generateMockData(body);

    return NextResponse.json({
      success: true,
      data: newData,
      message: '${entityName} created successfully',
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('POST /${module.name}/${endpoint.path} error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}` : ''}

${endpoint.methods.includes('PUT') ? `
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const pathParts = request.url.split('/');
    const id = pathParts[pathParts.length - 1];

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 100));

    // 生成更新后的资源
    const updatedData = generateMockData({ id, ...body });

    return NextResponse.json({
      success: true,
      data: updatedData,
      message: '${entityName} updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('PUT /${module.name}/${endpoint.path} error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}` : ''}

${endpoint.methods.includes('DELETE') ? `
export async function DELETE(request: NextRequest) {
  try {
    const pathParts = request.url.split('/');
    const id = pathParts[pathParts.length - 1];

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));

    // 模拟删除操作
    return NextResponse.json({
      success: true,
      data: { id },
      message: '${entityName} deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('DELETE /${module.name}/${endpoint.path} error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}` : ''}
`;

  fs.writeFileSync(routeFile, routeContent);
  console.log(`✅ 生成API路由: ${module.name}/${endpoint.path}`);
}

// 主函数
async function generateAllApis() {
  console.log('🚀 开始生成Mock API...');
  console.log('━'.repeat(50));

  let totalEndpoints = 0;

  for (const module of CONFIG.modules) {
    console.log(`\n📦 处理模块: ${module.name}`);

    for (const endpoint of module.endpoints) {
      generateApiRoute(module, endpoint);
      totalEndpoints++;
    }

    console.log(`   完成 ${module.endpoints.length} 个端点`);
  }

  console.log('\n━'.repeat(50));
  console.log(`🎯 总计生成 ${totalEndpoints} 个API端点`);
  console.log('✅ Mock API生成完成！');
}

// 生成单个模块的API
async function generateModuleApi(moduleName) {
  console.log(`🚀 开始生成 ${moduleName} 模块Mock API...`);
  console.log('━'.repeat(50));

  const module = CONFIG.modules.find(m => m.name === moduleName);
  if (!module) {
    console.error(`❌ 模块 "${moduleName}" 不存在！`);
    console.log('可用模块:', CONFIG.modules.map(m => m.name).join(', '));
    return;
  }

  console.log(`\n📦 处理模块: ${module.name}`);

  let endpointCount = 0;
  for (const endpoint of module.endpoints) {
    generateApiRoute(module, endpoint);
    endpointCount++;
  }

  console.log('\n━'.repeat(50));
  console.log(`🎯 ${moduleName} 模块生成 ${endpointCount} 个API端点`);
  console.log('✅ Mock API生成完成！');
}

// 如果直接运行此脚本
if (require.main === module) {
  const args = process.argv.slice(2);
  const moduleName = args[0];

  if (moduleName) {
    generateModuleApi(moduleName).catch(console.error);
  } else {
    generateAllApis().catch(console.error);
  }
}

module.exports = {
  generateAllApis,
  generateApiRoute,
  CONFIG
};
