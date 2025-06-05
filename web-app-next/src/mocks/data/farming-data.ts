/**
 * 农业模块Mock数据管理
 * 支持田地管理、作物管理、种植计划、农事活动、收获记录
 */

export interface MockField {
  id: string
  name: string
  location: string
  area: number // 面积(亩)
  soilType: string
  status: 'active' | 'fallow' | 'maintenance'
  coordinates?: {
    latitude: number
    longitude: number
  }
  currentCrop?: string
  plantingDate?: string
  expectedHarvestDate?: string
  manager: string
  createdAt: string
  updatedAt: string
}

export interface MockCrop {
  id: string
  name: string
  variety: string
  category: 'grain' | 'vegetable' | 'fruit' | 'herb'
  growthPeriod: number // 生长周期(天)
  optimalTemp: {
    min: number
    max: number
  }
  waterRequirement: 'low' | 'medium' | 'high'
  soilRequirement: string[]
  yieldPerAcre: number // 每亩产量(kg)
  marketPrice: number // 市场价格(元/kg)
  nutritionInfo?: {
    protein?: number
    carbs?: number
    vitamins?: string[]
  }
  status: 'active' | 'discontinued'
  createdAt: string
  updatedAt: string
}

export interface MockPlantingPlan {
  id: string
  fieldId: string
  cropId: string
  plannedArea: number
  plantingDate: string
  expectedHarvestDate: string
  seedQuantity: number
  estimatedYield: number
  estimatedRevenue: number
  status: 'planned' | 'in-progress' | 'completed' | 'cancelled'
  responsiblePerson: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface MockFarmActivity {
  id: string
  fieldId: string
  cropId?: string
  type: 'planting' | 'watering' | 'fertilizing' | 'pest-control' | 'weeding' | 'harvesting' | 'maintenance'
  description: string
  date: string
  duration: number // 持续时间(小时)
  workers: string[]
  equipment?: string[]
  materials?: {
    name: string
    quantity: number
    unit: string
  }[]
  cost: number
  weather?: {
    temperature: number
    humidity: number
    rainfall: number
  }
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  result?: string
  createdAt: string
  updatedAt: string
}

export interface MockHarvestRecord {
  id: string
  fieldId: string
  cropId: string
  harvestDate: string
  actualYield: number
  quality: 'premium' | 'grade-a' | 'grade-b' | 'grade-c'
  moisture: number // 含水量(%
  impurity: number // 杂质率(%
  storageLocation: string
  harvesters: string[]
  weatherConditions: {
    temperature: number
    humidity: number
    rainfall: number
  }
  marketPrice: number
  totalRevenue: number
  notes?: string
  status: 'harvested' | 'processed' | 'sold'
  createdAt: string
  updatedAt: string
}

export interface FarmingQuery {
  page?: number
  pageSize?: number
  search?: string
  fieldId?: string
  cropId?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * Mock田地数据
 */
export const mockFields: Record<string, MockField> = {
  'field_001': {
    id: 'field_001',
    name: '北区1号田',
    location: '黑牛农场北区',
    area: 50.5,
    soilType: '黑土',
    status: 'active',
    coordinates: { latitude: 45.8123, longitude: 126.5456 },
    currentCrop: 'crop_001',
    plantingDate: '2024-05-15',
    expectedHarvestDate: '2024-09-20',
    manager: '张三',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-05-15T10:30:00Z'
  },
  'field_002': {
    id: 'field_002',
    name: '南区2号田',
    location: '黑牛农场南区',
    area: 38.2,
    soilType: '沙壤土',
    status: 'active',
    coordinates: { latitude: 45.7998, longitude: 126.5234 },
    currentCrop: 'crop_002',
    plantingDate: '2024-06-01',
    expectedHarvestDate: '2024-10-15',
    manager: '李四',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-06-01T09:15:00Z'
  },
  'field_003': {
    id: 'field_003',
    name: '东区3号田',
    location: '黑牛农场东区',
    area: 42.8,
    soilType: '黑土',
    status: 'fallow',
    coordinates: { latitude: 45.8067, longitude: 126.5678 },
    manager: '王五',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-03-10T14:20:00Z'
  }
}

/**
 * Mock作物数据
 */
export const mockCrops: Record<string, MockCrop> = {
  'crop_001': {
    id: 'crop_001',
    name: '玉米',
    variety: '先玉335',
    category: 'grain',
    growthPeriod: 128,
    optimalTemp: { min: 15, max: 32 },
    waterRequirement: 'medium',
    soilRequirement: ['黑土', '沙壤土'],
    yieldPerAcre: 800,
    marketPrice: 2.8,
    nutritionInfo: {
      protein: 8.7,
      carbs: 74.3,
      vitamins: ['维生素B1', '维生素B6', '维生素E']
    },
    status: 'active',
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-10T08:00:00Z'
  },
  'crop_002': {
    id: 'crop_002',
    name: '大豆',
    variety: '黑豆28',
    category: 'grain',
    growthPeriod: 135,
    optimalTemp: { min: 18, max: 28 },
    waterRequirement: 'medium',
    soilRequirement: ['黑土', '壤土'],
    yieldPerAcre: 300,
    marketPrice: 6.2,
    nutritionInfo: {
      protein: 35.1,
      carbs: 16.9,
      vitamins: ['维生素K', '叶酸', '维生素B6']
    },
    status: 'active',
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-10T08:00:00Z'
  },
  'crop_003': {
    id: 'crop_003',
    name: '小麦',
    variety: '龙麦26',
    category: 'grain',
    growthPeriod: 280,
    optimalTemp: { min: 12, max: 25 },
    waterRequirement: 'medium',
    soilRequirement: ['黑土', '壤土', '沙壤土'],
    yieldPerAcre: 450,
    marketPrice: 2.6,
    nutritionInfo: {
      protein: 13.2,
      carbs: 71.2,
      vitamins: ['维生素B1', '维生素B3', '维生素B6']
    },
    status: 'active',
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-10T08:00:00Z'
  }
}

/**
 * 生成Mock种植计划数据
 */
export function generateMockPlantingPlans(count: number = 10): MockPlantingPlan[] {
  const plans: MockPlantingPlan[] = []
  const fieldIds = Object.keys(mockFields)
  const cropIds = Object.keys(mockCrops)
  const statuses: MockPlantingPlan['status'][] = ['planned', 'in-progress', 'completed', 'cancelled']
  const responsiblePersons = ['张三', '李四', '王五', '赵六', '孙七']

  for (let i = 1; i <= count; i++) {
    const fieldId = fieldIds[Math.floor(Math.random() * fieldIds.length)]
    const cropId = cropIds[Math.floor(Math.random() * cropIds.length)]
    const crop = mockCrops[cropId]
    const plannedArea = Math.floor(Math.random() * 40) + 10
    const plantingDate = new Date(2024, Math.floor(Math.random() * 8) + 4, Math.floor(Math.random() * 28) + 1)
    const expectedHarvestDate = new Date(plantingDate.getTime() + crop.growthPeriod * 24 * 60 * 60 * 1000)

    plans.push({
      id: `plan_${String(i).padStart(3, '0')}`,
      fieldId,
      cropId,
      plannedArea,
      plantingDate: plantingDate.toISOString().split('T')[0],
      expectedHarvestDate: expectedHarvestDate.toISOString().split('T')[0],
      seedQuantity: Math.floor(plannedArea * (Math.random() * 5 + 8)), // 8-13 kg/亩
      estimatedYield: Math.floor(plannedArea * crop.yieldPerAcre * (0.8 + Math.random() * 0.4)),
      estimatedRevenue: 0, // 将在后面计算
      status: statuses[Math.floor(Math.random() * statuses.length)],
      responsiblePerson: responsiblePersons[Math.floor(Math.random() * responsiblePersons.length)],
      notes: Math.random() > 0.7 ? `${crop.name}种植计划，注意天气变化` : undefined,
      createdAt: new Date(2024, 0, Math.floor(Math.random() * 30) + 1).toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  // 计算预估收入
  plans.forEach(plan => {
    const crop = mockCrops[plan.cropId]
    plan.estimatedRevenue = Math.floor(plan.estimatedYield * crop.marketPrice)
  })

  return plans
}

/**
 * 生成Mock农事活动数据
 */
export function generateMockFarmActivities(count: number = 20): MockFarmActivity[] {
  const activities: MockFarmActivity[] = []
  const fieldIds = Object.keys(mockFields)
  const cropIds = Object.keys(mockCrops)
  const types: MockFarmActivity['type'][] = [
    'planting', 'watering', 'fertilizing', 'pest-control', 'weeding', 'harvesting', 'maintenance'
  ]
  const statuses: MockFarmActivity['status'][] = ['scheduled', 'in-progress', 'completed', 'cancelled']
  const workers = ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九']
  const equipment = ['拖拉机', '播种机', '收割机', '喷雾器', '犁具', '耙具']

  for (let i = 1; i <= count; i++) {
    const type = types[Math.floor(Math.random() * types.length)]
    const fieldId = fieldIds[Math.floor(Math.random() * fieldIds.length)]
    const cropId = Math.random() > 0.3 ? cropIds[Math.floor(Math.random() * cropIds.length)] : undefined
    const activityDate = new Date(2024, Math.floor(Math.random() * 8) + 2, Math.floor(Math.random() * 28) + 1)

    activities.push({
      id: `activity_${String(i).padStart(3, '0')}`,
      fieldId,
      cropId,
      type,
      description: `${mockFields[fieldId].name} - ${getActivityDescription(type)}`,
      date: activityDate.toISOString().split('T')[0],
      duration: Math.floor(Math.random() * 8) + 2, // 2-10小时
      workers: workers.slice(0, Math.floor(Math.random() * 3) + 1),
      equipment: Math.random() > 0.5 ? [equipment[Math.floor(Math.random() * equipment.length)]] : undefined,
      materials: getMaterialsForActivity(type),
      cost: Math.floor(Math.random() * 2000) + 500,
      weather: {
        temperature: Math.floor(Math.random() * 20) + 15,
        humidity: Math.floor(Math.random() * 40) + 40,
        rainfall: Math.random() * 10
      },
      status: statuses[Math.floor(Math.random() * statuses.length)],
      result: statuses[Math.floor(Math.random() * statuses.length)] === 'completed' ? '作业完成，效果良好' : undefined,
      createdAt: new Date(activityDate.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  return activities
}

/**
 * 生成Mock收获记录数据
 */
export function generateMockHarvestRecords(count: number = 8): MockHarvestRecord[] {
  const records: MockHarvestRecord[] = []
  const fieldIds = Object.keys(mockFields)
  const cropIds = Object.keys(mockCrops)
  const qualities: MockHarvestRecord['quality'][] = ['premium', 'grade-a', 'grade-b', 'grade-c']
  const statuses: MockHarvestRecord['status'][] = ['harvested', 'processed', 'sold']
  const harvesters = ['张三', '李四', '王五', '赵六']
  const storageLocations = ['1号仓库', '2号仓库', '3号仓库', '临时储存区']

  for (let i = 1; i <= count; i++) {
    const fieldId = fieldIds[Math.floor(Math.random() * fieldIds.length)]
    const cropId = cropIds[Math.floor(Math.random() * cropIds.length)]
    const crop = mockCrops[cropId]
    const field = mockFields[fieldId]
    const harvestDate = new Date(2024, Math.floor(Math.random() * 4) + 6, Math.floor(Math.random() * 28) + 1) // 7-10月
    const actualYield = Math.floor(field.area * crop.yieldPerAcre * (0.7 + Math.random() * 0.5)) // 70%-120%产量

    records.push({
      id: `harvest_${String(i).padStart(3, '0')}`,
      fieldId,
      cropId,
      harvestDate: harvestDate.toISOString().split('T')[0],
      actualYield,
      quality: qualities[Math.floor(Math.random() * qualities.length)],
      moisture: Math.floor(Math.random() * 10) + 12, // 12%-22%
      impurity: Math.random() * 3, // 0%-3%
      storageLocation: storageLocations[Math.floor(Math.random() * storageLocations.length)],
      harvesters: harvesters.slice(0, Math.floor(Math.random() * 3) + 2),
      weatherConditions: {
        temperature: Math.floor(Math.random() * 15) + 15, // 15-30度
        humidity: Math.floor(Math.random() * 30) + 50, // 50%-80%
        rainfall: Math.random() * 5 // 0-5mm
      },
      marketPrice: crop.marketPrice * (0.9 + Math.random() * 0.2), // 价格波动
      totalRevenue: 0, // 将在后面计算
      notes: Math.random() > 0.6 ? '收获时天气良好，作物质量佳' : undefined,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      createdAt: harvestDate.toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  // 计算总收入
  records.forEach(record => {
    record.totalRevenue = Math.floor(record.actualYield * record.marketPrice)
  })

  return records
}

/**
 * 工具函数
 */
function getActivityDescription(type: MockFarmActivity['type']): string {
  const descriptions = {
    planting: '播种作业',
    watering: '浇水灌溉',
    fertilizing: '施肥作业',
    'pest-control': '病虫害防治',
    weeding: '除草作业',
    harvesting: '收获作业',
    maintenance: '田间维护'
  }
  return descriptions[type]
}

function getMaterialsForActivity(type: MockFarmActivity['type']): MockFarmActivity['materials'] {
  const materialMap = {
    planting: [{ name: '种子', quantity: Math.floor(Math.random() * 50) + 20, unit: 'kg' }],
    watering: [],
    fertilizing: [{ name: '复合肥', quantity: Math.floor(Math.random() * 100) + 50, unit: 'kg' }],
    'pest-control': [{ name: '杀虫剂', quantity: Math.floor(Math.random() * 5) + 2, unit: 'L' }],
    weeding: [{ name: '除草剂', quantity: Math.floor(Math.random() * 3) + 1, unit: 'L' }],
    harvesting: [],
    maintenance: [{ name: '维修材料', quantity: 1, unit: '套' }]
  }
  return materialMap[type] || []
}

// 预生成数据实例
export const mockPlantingPlans = generateMockPlantingPlans()
export const mockFarmActivities = generateMockFarmActivities()
export const mockHarvestRecords = generateMockHarvestRecords()

/**
 * 农业模块数据获取函数
 */
export function getFieldsList(query: FarmingQuery = {}) {
  let fields = Object.values(mockFields)

  if (query.search) {
    fields = fields.filter(field =>
      field.name.includes(query.search!) ||
      field.location.includes(query.search!) ||
      field.manager.includes(query.search!)
    )
  }

  if (query.status) {
    fields = fields.filter(field => field.status === query.status)
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const total = fields.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    fields: fields.slice(startIndex, endIndex),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: endIndex < total,
      hasPrev: page > 1
    }
  }
}

export function getCropsList(query: FarmingQuery = {}) {
  let crops = Object.values(mockCrops)

  if (query.search) {
    crops = crops.filter(crop =>
      crop.name.includes(query.search!) ||
      crop.variety.includes(query.search!) ||
      crop.category.includes(query.search!)
    )
  }

  if (query.status) {
    crops = crops.filter(crop => crop.status === query.status)
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const total = crops.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    crops: crops.slice(startIndex, endIndex),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: endIndex < total,
      hasPrev: page > 1
    }
  }
}

export function getPlantingPlansList(query: FarmingQuery = {}) {
  let plans = mockPlantingPlans

  if (query.fieldId) {
    plans = plans.filter(plan => plan.fieldId === query.fieldId)
  }

  if (query.cropId) {
    plans = plans.filter(plan => plan.cropId === query.cropId)
  }

  if (query.status) {
    plans = plans.filter(plan => plan.status === query.status)
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const total = plans.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    plans: plans.slice(startIndex, endIndex),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: endIndex < total,
      hasPrev: page > 1
    }
  }
}

export function getFarmActivitiesList(query: FarmingQuery = {}) {
  let activities = mockFarmActivities

  if (query.fieldId) {
    activities = activities.filter(activity => activity.fieldId === query.fieldId)
  }

  if (query.cropId) {
    activities = activities.filter(activity => activity.cropId === query.cropId)
  }

  if (query.status) {
    activities = activities.filter(activity => activity.status === query.status)
  }

  if (query.dateFrom) {
    activities = activities.filter(activity => activity.date >= query.dateFrom!)
  }

  if (query.dateTo) {
    activities = activities.filter(activity => activity.date <= query.dateTo!)
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const total = activities.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    activities: activities.slice(startIndex, endIndex),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: endIndex < total,
      hasPrev: page > 1
    }
  }
}

export function getHarvestRecordsList(query: FarmingQuery = {}) {
  let records = mockHarvestRecords

  if (query.fieldId) {
    records = records.filter(record => record.fieldId === query.fieldId)
  }

  if (query.cropId) {
    records = records.filter(record => record.cropId === query.cropId)
  }

  if (query.status) {
    records = records.filter(record => record.status === query.status)
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const total = records.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    records: records.slice(startIndex, endIndex),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: endIndex < total,
      hasPrev: page > 1
    }
  }
}

/**
 * 农业数据统计函数
 */
export function getFarmingOverviewStats() {
  const totalFields = Object.keys(mockFields).length
  const activeFields = Object.values(mockFields).filter(f => f.status === 'active').length
  const totalCrops = Object.keys(mockCrops).length
  const activePlans = mockPlantingPlans.filter(p => p.status === 'in-progress').length
  const completedHarvests = mockHarvestRecords.filter(r => r.status !== 'harvested').length
  const totalRevenue = mockHarvestRecords.reduce((sum, r) => sum + r.totalRevenue, 0)

  return {
    totalFields,
    activeFields,
    totalCrops,
    activePlans,
    completedHarvests,
    totalRevenue,
    averageYield: mockHarvestRecords.reduce((sum, r) => sum + r.actualYield, 0) / mockHarvestRecords.length
  }
}
