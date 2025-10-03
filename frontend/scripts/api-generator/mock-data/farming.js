/**
 * 农业模块Mock数据工厂
 * @description TASK-P3-019A Day 0 - 农业模块Mock数据生成
 * @created 2025-06-03
 */

const { faker } = require('@faker-js/faker');

// 设置中文locale
faker.setLocale('zh_CN');

// 农业相关常量数据
const AGRICULTURAL_DATA = {
  crops: ['玉米', '小麦', '大豆', '水稻', '花生', '棉花', '甘蔗', '烟草'],
  varieties: {
    '玉米': ['金秋', '丰收1号', '黄金玉米', '甜玉米'],
    '小麦': ['冬小麦', '春小麦', '硬质小麦', '软质小麦'],
    '大豆': ['黑豆', '黄豆', '青豆', '毛豆'],
    '水稻': ['籼稻', '粳稻', '糯稻', '香稻']
  },
  soilTypes: ['sandy', 'clay', 'loam', 'silt'],
  irrigationTypes: ['drip', 'sprinkler', 'flood', 'none'],
  activityTypes: ['planting', 'irrigation', 'fertilizing', 'pest_control', 'weeding', 'harvesting'],
  weatherConditions: ['sunny', 'cloudy', 'rainy', 'stormy'],
  certifications: ['有机认证', '绿色食品', 'GAP认证', '无公害认证'],
  equipmentList: ['拖拉机', '播种机', '收割机', '喷灌设备', '施肥机']
};

// 生成地理位置 (中国农业区域)
function generateChineseLocation() {
  const regions = [
    { province: '山东', city: '济南', lat: 36.6512, lng: 117.1201 },
    { province: '河南', city: '郑州', lat: 34.7466, lng: 113.6253 },
    { province: '河北', city: '石家庄', lat: 38.0428, lng: 114.5149 },
    { province: '江苏', city: '南京', lat: 32.0603, lng: 118.7969 },
    { province: '安徽', city: '合肥', lat: 31.8206, lng: 117.2272 },
    { province: '湖南', city: '长沙', lat: 28.2278, lng: 112.9388 },
    { province: '湖北', city: '武汉', lat: 30.5928, lng: 114.3055 }
  ];

  const region = faker.helpers.arrayElement(regions);

  return {
    latitude: region.lat + faker.datatype.float({ min: -0.5, max: 0.5, precision: 0.0001 }),
    longitude: region.lng + faker.datatype.float({ min: -0.5, max: 0.5, precision: 0.0001 }),
    address: `${region.province}${region.city}${faker.address.county()}${faker.address.streetName()}${faker.datatype.number({ min: 1, max: 999 })}号`,
    city: region.city,
    province: region.province,
    country: '中国'
  };
}

// 生成田地Mock数据
function generateFieldMockData(overrides = {}) {
  const soilType = faker.helpers.arrayElement(AGRICULTURAL_DATA.soilTypes);
  const irrigation = faker.helpers.arrayElement(AGRICULTURAL_DATA.irrigationTypes);

  return {
    id: faker.datatype.uuid(),
    name: `${faker.address.county()}${faker.datatype.number({ min: 1, max: 99 })}号田`,
    code: `F${faker.datatype.number({ min: 10000, max: 99999 })}`,
    location: generateChineseLocation(),
    area: faker.datatype.number({ min: 50, max: 2000 }), // 面积(亩)
    soilType,
    soilPh: faker.datatype.float({ min: 5.5, max: 8.5, precision: 0.1 }),
    irrigation,
    owner: faker.name.findName(),
    manager: faker.name.findName(),
    status: faker.helpers.arrayElement(['active', 'inactive', 'maintenance']),
    certifications: faker.helpers.arrayElements(AGRICULTURAL_DATA.certifications, { min: 0, max: 3 }),
    description: `${soilType}土质，${irrigation}灌溉，适合种植多种农作物`,
    createdAt: faker.date.past(2).toISOString(),
    updatedAt: faker.date.recent(30).toISOString(),
    deletedAt: null,
    ...overrides
  };
}

// 生成作物Mock数据
function generateCropMockData(overrides = {}) {
  const cropName = faker.helpers.arrayElement(AGRICULTURAL_DATA.crops);
  const varieties = AGRICULTURAL_DATA.varieties[cropName] || [faker.lorem.word()];
  const variety = faker.helpers.arrayElement(varieties);

  return {
    id: faker.datatype.uuid(),
    name: cropName,
    variety,
    category: faker.helpers.arrayElement(['grain', 'vegetable', 'fruit', 'cash', 'feed']),
    growthCycle: faker.datatype.number({ min: 60, max: 200 }), // 生长周期(天)
    description: `${cropName}${variety}，适应性强，产量稳定`,
    requirements: {
      minTemperature: faker.datatype.number({ min: 5, max: 15 }),
      maxTemperature: faker.datatype.number({ min: 25, max: 40 }),
      waterNeed: faker.helpers.arrayElement(['low', 'medium', 'high']),
      lightRequirement: faker.helpers.arrayElement(['full', 'partial', 'shade']),
      soilType: faker.helpers.arrayElements(AGRICULTURAL_DATA.soilTypes, { min: 1, max: 3 })
    },
    nutritionInfo: {
      protein: faker.datatype.float({ min: 8, max: 35, precision: 0.1 }),
      carbohydrate: faker.datatype.float({ min: 45, max: 80, precision: 0.1 }),
      fat: faker.datatype.float({ min: 1, max: 20, precision: 0.1 }),
      calories: faker.datatype.number({ min: 200, max: 400 })
    },
    createdAt: faker.date.past(1).toISOString(),
    updatedAt: faker.date.recent(30).toISOString(),
    deletedAt: null,
    ...overrides
  };
}

// 生成种植计划Mock数据
function generatePlantingPlanMockData(overrides = {}) {
  const plantingDate = faker.date.between('2025-03-01', '2025-06-30');
  const crop = generateCropMockData();
  const expectedHarvestDate = new Date(plantingDate);
  expectedHarvestDate.setDate(expectedHarvestDate.getDate() + crop.growthCycle);

  const plannedArea = faker.datatype.number({ min: 10, max: 500 });
  const expectedYield = plannedArea * faker.datatype.float({ min: 300, max: 800 }); // kg

  return {
    id: faker.datatype.uuid(),
    fieldId: faker.datatype.uuid(),
    cropId: crop.id,
    planName: `${crop.name}种植计划-${plantingDate.getFullYear()}年`,
    plantingDate: plantingDate.toISOString(),
    expectedHarvestDate: expectedHarvestDate.toISOString(),
    plannedArea,
    expectedYield,
    status: faker.helpers.arrayElement(['planned', 'in_progress', 'completed', 'cancelled']),

    // 关联信息
    field: generateFieldMockData(),
    crop,

    // 种植细节
    seedSource: faker.company.companyName() + '种业',
    seedQuantity: faker.datatype.float({ min: 10, max: 100, precision: 0.1 }),
    plantingMethod: faker.helpers.arrayElement(['direct', 'transplant', 'broadcast']),
    rowSpacing: faker.datatype.number({ min: 20, max: 50 }),
    plantSpacing: faker.datatype.number({ min: 10, max: 30 }),

    // 成本预算
    budgetedCost: {
      seeds: faker.datatype.number({ min: 1000, max: 5000 }),
      fertilizer: faker.datatype.number({ min: 2000, max: 8000 }),
      pesticide: faker.datatype.number({ min: 500, max: 3000 }),
      labor: faker.datatype.number({ min: 3000, max: 10000 }),
      irrigation: faker.datatype.number({ min: 1000, max: 4000 }),
      other: faker.datatype.number({ min: 500, max: 2000 }),
      total: 0
    },

    createdAt: faker.date.past(1).toISOString(),
    updatedAt: faker.date.recent(30).toISOString(),
    deletedAt: null,
    ...overrides
  };
}

// 生成农事记录Mock数据
function generateFarmActivityMockData(overrides = {}) {
  const activityType = faker.helpers.arrayElement(AGRICULTURAL_DATA.activityTypes);
  const activityDate = faker.date.recent(90);

  const materialsCost = faker.datatype.number({ min: 200, max: 2000 });
  const laborCost = faker.datatype.number({ min: 300, max: 1500 });
  const equipmentCost = faker.datatype.number({ min: 100, max: 800 });
  const otherCost = faker.datatype.number({ min: 50, max: 500 });

  return {
    id: faker.datatype.uuid(),
    fieldId: faker.datatype.uuid(),
    plantingPlanId: faker.datatype.uuid(),
    activityType,
    activityDate: activityDate.toISOString(),
    description: `${activityType}作业，${faker.lorem.sentence()}`,

    // 活动详情
    details: {
      materials: activityType === 'fertilizing' || activityType === 'pest_control' ? [
        {
          name: activityType === 'fertilizing' ? '复合肥' : '杀虫剂',
          quantity: faker.datatype.float({ min: 10, max: 100, precision: 0.1 }),
          unit: 'kg',
          cost: materialsCost
        }
      ] : [],
      equipment: faker.helpers.arrayElements(AGRICULTURAL_DATA.equipmentList, { min: 1, max: 3 }),
      duration: faker.datatype.float({ min: 2, max: 8, precision: 0.5 }),
      laborCount: faker.datatype.number({ min: 2, max: 8 }),
      weather: {
        temperature: faker.datatype.number({ min: 10, max: 35 }),
        humidity: faker.datatype.number({ min: 40, max: 90 }),
        rainfall: faker.datatype.float({ min: 0, max: 20, precision: 0.1 }),
        condition: faker.helpers.arrayElement(AGRICULTURAL_DATA.weatherConditions)
      }
    },

    // 成本记录
    cost: {
      materials: materialsCost,
      labor: laborCost,
      equipment: equipmentCost,
      other: otherCost,
      total: materialsCost + laborCost + equipmentCost + otherCost
    },

    // 关联信息
    field: generateFieldMockData(),
    plantingPlan: generatePlantingPlanMockData(),

    status: 'completed',
    notes: faker.lorem.paragraph(),

    createdAt: activityDate.toISOString(),
    updatedAt: faker.date.between(activityDate, new Date()).toISOString(),
    deletedAt: null,
    ...overrides
  };
}

// 生成收获记录Mock数据
function generateHarvestRecordMockData(overrides = {}) {
  const harvestDate = faker.date.recent(60);
  const harvestArea = faker.datatype.number({ min: 50, max: 300 });
  const actualYield = harvestArea * faker.datatype.float({ min: 400, max: 1200 });
  const lossRate = faker.datatype.float({ min: 2, max: 8, precision: 0.1 });

  const laborCost = faker.datatype.number({ min: 1000, max: 3000 });
  const equipmentCost = faker.datatype.number({ min: 800, max: 2000 });
  const processingCost = faker.datatype.number({ min: 500, max: 1500 });
  const storageCost = faker.datatype.number({ min: 300, max: 1000 });
  const transportCost = faker.datatype.number({ min: 400, max: 1200 });

  return {
    id: faker.datatype.uuid(),
    fieldId: faker.datatype.uuid(),
    plantingPlanId: faker.datatype.uuid(),
    harvestDate: harvestDate.toISOString(),
    actualYield,
    quality: faker.helpers.arrayElement(['A', 'B', 'C', 'D']),
    moistureContent: faker.datatype.float({ min: 12, max: 18, precision: 0.1 }),

    // 收获详情
    harvestArea,
    lossRate,

    // 质量检测
    qualityMetrics: {
      size: faker.helpers.arrayElement(['large', 'medium', 'small']),
      color: faker.helpers.arrayElement(['优', '良', '中', '差']),
      defectRate: faker.datatype.float({ min: 1, max: 5, precision: 0.1 }),
      pestResidueTest: faker.datatype.boolean(),
      organicCertified: faker.datatype.boolean()
    },

    // 收获后处理
    postHarvest: {
      drying: faker.datatype.boolean(),
      cleaning: faker.datatype.boolean(),
      sorting: faker.datatype.boolean(),
      packaging: faker.datatype.boolean(),
      storage: faker.datatype.boolean()
    },

    // 成本记录
    harvestCost: {
      labor: laborCost,
      equipment: equipmentCost,
      processing: processingCost,
      storage: storageCost,
      transport: transportCost,
      total: laborCost + equipmentCost + processingCost + storageCost + transportCost
    },

    // 关联信息
    field: generateFieldMockData(),
    plantingPlan: generatePlantingPlanMockData(),

    notes: faker.lorem.paragraph(),

    createdAt: harvestDate.toISOString(),
    updatedAt: faker.date.between(harvestDate, new Date()).toISOString(),
    deletedAt: null,
    ...overrides
  };
}

// 生成农业仪表板Mock数据
function generateFarmingDashboardMockData(overrides = {}) {
  return {
    fieldCount: faker.datatype.number({ min: 20, max: 100 }),
    totalArea: faker.datatype.number({ min: 5000, max: 50000 }),
    activePlantingPlans: faker.datatype.number({ min: 15, max: 80 }),
    upcomingHarvests: faker.datatype.number({ min: 5, max: 25 }),
    totalYieldThisYear: faker.datatype.number({ min: 50000, max: 500000 }),
    averageYieldPerAcre: faker.datatype.float({ min: 400, max: 800, precision: 0.1 }),
    recentActivities: Array.from({ length: 5 }, () => generateFarmActivityMockData()),
    ...overrides
  };
}

module.exports = {
  generateFieldMockData,
  generateCropMockData,
  generatePlantingPlanMockData,
  generateFarmActivityMockData,
  generateHarvestRecordMockData,
  generateFarmingDashboardMockData,
  AGRICULTURAL_DATA
};
