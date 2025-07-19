/**
 * 加工模块Mock数据管理
 * 支持原料管理、生产批次、质检记录、成品管理
 */

export interface MockRawMaterial {
  id: string
  name: string
  category: 'grain' | 'additive' | 'packaging' | 'other'
  supplier: string
  batchNumber: string
  quantity: number
  unit: 'kg' | 'ton' | 'pcs' | 'L'
  quality: 'premium' | 'grade-a' | 'grade-b' | 'grade-c'
  receivedDate: string
  expiryDate: string
  storageLocation: string
  moisture?: number
  purity?: number
  price: number
  totalValue: number
  status: 'pending' | 'approved' | 'in-use' | 'used' | 'expired' | 'rejected'
  inspector: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface MockProductionBatch {
  id: string
  batchNumber: string
  productType: string
  productName: string
  plannedQuantity: number
  actualQuantity: number
  unit: 'kg' | 'ton' | 'pcs'
  rawMaterials: {
    materialId: string
    materialName: string
    plannedAmount: number
    actualAmount: number
    unit: string
  }[]
  startDate: string
  endDate?: string
  duration?: number
  status: 'planned' | 'in-progress' | 'completed' | 'quality-check' | 'approved' | 'rejected'
  productionLine: string
  supervisor: string
  operators: string[]
  qualityScore?: number
  yield: number
  energyConsumption: number
  cost: {
    materials: number
    labor: number
    energy: number
    overhead: number
    total: number
  }
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface MockQualityTest {
  id: string
  testNumber: string
  batchId: string
  batchNumber: string
  productType: string
  testType: 'incoming' | 'in-process' | 'final' | 'random'
  testDate: string
  inspector: string
  testItems: {
    parameter: string
    standard: string
    result: string
    unit: string
    status: 'pass' | 'fail' | 'warning'
  }[]
  overallResult: 'pass' | 'fail' | 'conditional-pass'
  qualityScore: number
  defectRate: number
  recommendations?: string[]
  correctiveActions?: string[]
  retestRequired: boolean
  certificateNumber?: string
  status: 'pending' | 'in-progress' | 'completed' | 'approved' | 'rejected'
  approvedBy?: string
  approvedAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface MockFinishedProduct {
  id: string
  productCode: string
  productName: string
  category: 'feed' | 'food' | 'supplement' | 'other'
  batchId: string
  batchNumber: string
  quantity: number
  unit: 'kg' | 'ton' | 'pcs'
  quality: 'premium' | 'grade-a' | 'grade-b' | 'grade-c'
  productionDate: string
  expiryDate: string
  storageLocation: string
  packaging: {
    type: string
    size: string
    quantity: number
  }
  nutritionInfo?: {
    protein?: number
    fat?: number
    fiber?: number
    moisture?: number
    ash?: number
  }
  pricePerUnit: number
  totalValue: number
  status: 'in-production' | 'quality-check' | 'approved' | 'shipped' | 'sold' | 'expired'
  qualityTestId?: string
  certifications: string[]
  marketChannel?: 'domestic' | 'export' | 'retail' | 'wholesale'
  customerReserved?: string
  shippingInfo?: {
    orderId: string
    customer: string
    shippingDate: string
    trackingNumber: string
  }
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface ProcessingQuery {
  page?: number
  pageSize?: number
  search?: string
  category?: string
  status?: string
  batchId?: string
  productType?: string
  testType?: string
  inspector?: string
  dateFrom?: string
  dateTo?: string
  quality?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * Mock原料数据
 */
export const mockRawMaterials: Record<string, MockRawMaterial> = {
  'raw_001': {
    id: 'raw_001',
    name: '优质玉米',
    category: 'grain',
    supplier: '东北农业合作社',
    batchNumber: 'CORN-2024-001',
    quantity: 50000,
    unit: 'kg',
    quality: 'premium',
    receivedDate: '2024-08-15',
    expiryDate: '2025-08-15',
    storageLocation: 'A1仓库',
    moisture: 14.5,
    purity: 99.2,
    price: 2.8,
    totalValue: 140000,
    status: 'approved',
    inspector: '李质检',
    notes: '质量优良，符合所有标准',
    createdAt: '2024-08-15T09:00:00Z',
    updatedAt: '2024-08-15T10:30:00Z'
  },
  'raw_002': {
    id: 'raw_002',
    name: '大豆蛋白粉',
    category: 'additive',
    supplier: '蛋白质科技有限公司',
    batchNumber: 'SOY-2024-015',
    quantity: 5000,
    unit: 'kg',
    quality: 'grade-a',
    receivedDate: '2024-09-01',
    expiryDate: '2025-09-01',
    storageLocation: 'B2仓库',
    purity: 95.8,
    price: 12.5,
    totalValue: 62500,
    status: 'in-use',
    inspector: '王技师',
    createdAt: '2024-09-01T08:30:00Z',
    updatedAt: '2024-09-10T15:20:00Z'
  },
  'raw_003': {
    id: 'raw_003',
    name: '包装袋',
    category: 'packaging',
    supplier: '绿色包装材料厂',
    batchNumber: 'PKG-2024-008',
    quantity: 10000,
    unit: 'pcs',
    quality: 'grade-a',
    receivedDate: '2024-09-05',
    expiryDate: '2027-09-05',
    storageLocation: 'C1仓库',
    price: 0.8,
    totalValue: 8000,
    status: 'approved',
    inspector: '张采购',
    createdAt: '2024-09-05T14:00:00Z',
    updatedAt: '2024-09-05T16:45:00Z'
  }
}

/**
 * 生成Mock生产批次数据
 */
export function generateMockProductionBatches(count: number = 15): MockProductionBatch[] {
  const batches: MockProductionBatch[] = []
  const productTypes = ['优质饲料', '有机肥料', '营养补充剂', '宠物食品']
  const productionLines = ['生产线A', '生产线B', '生产线C']
  const supervisors = ['李主管', '王组长', '张师傅', '赵负责人']
  const operators = ['小张', '小李', '小王', '小赵', '小刘', '小陈']
  const statuses: MockProductionBatch['status'][] = ['planned', 'in-progress', 'completed', 'quality-check', 'approved']

  for (let i = 1; i <= count; i++) {
    const productType = productTypes[Math.floor(Math.random() * productTypes.length)]
    const startDate = new Date(2024, Math.floor(Math.random() * 3) + 7, Math.floor(Math.random() * 28) + 1)
    const duration = Math.floor(Math.random() * 12) + 6
    const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000)
    const plannedQuantity = Math.floor(Math.random() * 5000) + 1000
    const actualQuantity = Math.floor(plannedQuantity * (0.85 + Math.random() * 0.25))
    const materialsCost = Math.floor(Math.random() * 50000) + 20000
    const laborCost = Math.floor(Math.random() * 10000) + 5000
    const energyCost = Math.floor(Math.random() * 8000) + 3000
    const overheadCost = Math.floor(Math.random() * 5000) + 2000

    batches.push({
      id: `batch_${String(i).padStart(3, '0')}`,
      batchNumber: `BATCH-2024-${String(i).padStart(3, '0')}`,
      productType,
      productName: `${productType}-${String(i).padStart(3, '0')}`,
      plannedQuantity,
      actualQuantity,
      unit: 'kg',
      rawMaterials: [
        {
          materialId: 'raw_001',
          materialName: '优质玉米',
          plannedAmount: Math.floor(plannedQuantity * 0.7),
          actualAmount: Math.floor(actualQuantity * 0.7),
          unit: 'kg'
        },
        {
          materialId: 'raw_002',
          materialName: '大豆蛋白粉',
          plannedAmount: Math.floor(plannedQuantity * 0.2),
          actualAmount: Math.floor(actualQuantity * 0.2),
          unit: 'kg'
        }
      ],
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      duration,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      productionLine: productionLines[Math.floor(Math.random() * productionLines.length)],
      supervisor: supervisors[Math.floor(Math.random() * supervisors.length)],
      operators: operators.slice(0, Math.floor(Math.random() * 3) + 2),
      qualityScore: Math.floor(Math.random() * 3) + 8,
      yield: Math.floor((actualQuantity / plannedQuantity) * 100),
      energyConsumption: Math.floor(Math.random() * 500) + 200,
      cost: {
        materials: materialsCost,
        labor: laborCost,
        energy: energyCost,
        overhead: overheadCost,
        total: materialsCost + laborCost + energyCost + overheadCost
      },
      notes: Math.random() > 0.6 ? '生产过程顺利，质量稳定' : undefined,
      createdAt: new Date(startDate.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  return batches
}

/**
 * 生成Mock质检记录数据
 */
export function generateMockQualityTests(count: number = 20): MockQualityTest[] {
  const tests: MockQualityTest[] = []
  const testTypes: MockQualityTest['testType'][] = ['incoming', 'in-process', 'final', 'random']
  const inspectors = ['李质检', '王技师', '张检验员', '赵专员']
  const statuses: MockQualityTest['status'][] = ['completed', 'approved', 'pending', 'in-progress']
  const results: MockQualityTest['overallResult'][] = ['pass', 'pass', 'pass', 'conditional-pass', 'fail']

  for (let i = 1; i <= count; i++) {
    const testDate = new Date(2024, Math.floor(Math.random() * 3) + 7, Math.floor(Math.random() * 28) + 1)
    const overallResult = results[Math.floor(Math.random() * results.length)]
    const qualityScore = overallResult === 'pass' ? Math.floor(Math.random() * 2) + 8 :
                        overallResult === 'conditional-pass' ? Math.floor(Math.random() * 2) + 6 :
                        Math.floor(Math.random() * 3) + 3

    tests.push({
      id: `test_${String(i).padStart(3, '0')}`,
      testNumber: `QT-2024-${String(i).padStart(3, '0')}`,
      batchId: `batch_${String(Math.floor(Math.random() * 15) + 1).padStart(3, '0')}`,
      batchNumber: `BATCH-2024-${String(Math.floor(Math.random() * 15) + 1).padStart(3, '0')}`,
      productType: '优质饲料',
      testType: testTypes[Math.floor(Math.random() * testTypes.length)],
      testDate: testDate.toISOString().split('T')[0],
      inspector: inspectors[Math.floor(Math.random() * inspectors.length)],
      testItems: [
        {
          parameter: '蛋白质含量',
          standard: '≥18%',
          result: `${(Math.random() * 5 + 18).toFixed(1)}%`,
          unit: '%',
          status: Math.random() > 0.1 ? 'pass' : 'warning'
        },
        {
          parameter: '水分含量',
          standard: '≤13%',
          result: `${(Math.random() * 3 + 10).toFixed(1)}%`,
          unit: '%',
          status: Math.random() > 0.05 ? 'pass' : 'fail'
        },
        {
          parameter: '灰分',
          standard: '≤8%',
          result: `${(Math.random() * 2 + 6).toFixed(1)}%`,
          unit: '%',
          status: Math.random() > 0.08 ? 'pass' : 'warning'
        }
      ],
      overallResult,
      qualityScore,
      defectRate: Math.random() * (overallResult === 'pass' ? 2 : 8),
      recommendations: overallResult !== 'pass' ? ['优化生产工艺', '加强原料筛选'] : undefined,
      correctiveActions: overallResult === 'fail' ? ['重新生产', '原料更换'] : undefined,
      retestRequired: overallResult !== 'pass',
      certificateNumber: overallResult === 'pass' ? `CERT-2024-${String(i).padStart(3, '0')}` : undefined,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      approvedBy: overallResult === 'pass' ? '质量主管' : undefined,
      approvedAt: overallResult === 'pass' ? new Date().toISOString() : undefined,
      createdAt: testDate.toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  return tests
}

/**
 * 生成Mock成品数据
 */
export function generateMockFinishedProducts(count: number = 12): MockFinishedProduct[] {
  const products: MockFinishedProduct[] = []
  const categories: MockFinishedProduct['category'][] = ['feed', 'food', 'supplement']
  const qualities: MockFinishedProduct['quality'][] = ['premium', 'grade-a', 'grade-b']
  const statuses: MockFinishedProduct['status'][] = ['approved', 'shipped', 'sold', 'quality-check']
  const storageLocations = ['成品仓A', '成品仓B', '成品仓C', '待发货区']
  const certifications = ['有机认证', 'ISO9001', 'HACCP', 'GMP']

  for (let i = 1; i <= count; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)]
    const productionDate = new Date(2024, Math.floor(Math.random() * 3) + 7, Math.floor(Math.random() * 28) + 1)
    const expiryDate = new Date(productionDate.getTime() + (category === 'feed' ? 365 : 730) * 24 * 60 * 60 * 1000)
    const quantity = Math.floor(Math.random() * 3000) + 500
    const pricePerUnit = Math.random() * 10 + 15

    products.push({
      id: `product_${String(i).padStart(3, '0')}`,
      productCode: `PROD-${category.toUpperCase()}-${String(i).padStart(3, '0')}`,
      productName: `${category === 'feed' ? '优质饲料' : category === 'food' ? '有机食品' : '营养补充剂'}-${String(i).padStart(3, '0')}`,
      category,
      batchId: `batch_${String(Math.floor(Math.random() * 15) + 1).padStart(3, '0')}`,
      batchNumber: `BATCH-2024-${String(Math.floor(Math.random() * 15) + 1).padStart(3, '0')}`,
      quantity,
      unit: 'kg',
      quality: qualities[Math.floor(Math.random() * qualities.length)],
      productionDate: productionDate.toISOString().split('T')[0],
      expiryDate: expiryDate.toISOString().split('T')[0],
      storageLocation: storageLocations[Math.floor(Math.random() * storageLocations.length)],
      packaging: {
        type: Math.random() > 0.5 ? '编织袋' : '纸袋',
        size: Math.random() > 0.5 ? '25kg' : '50kg',
        quantity: Math.floor(quantity / (Math.random() > 0.5 ? 25 : 50))
      },
      nutritionInfo: category === 'feed' ? {
        protein: Math.random() * 5 + 18,
        fat: Math.random() * 3 + 4,
        fiber: Math.random() * 5 + 8,
        moisture: Math.random() * 3 + 10,
        ash: Math.random() * 2 + 6
      } : undefined,
      pricePerUnit,
      totalValue: Math.floor(quantity * pricePerUnit),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      qualityTestId: `test_${String(Math.floor(Math.random() * 20) + 1).padStart(3, '0')}`,
      certifications: certifications.slice(0, Math.floor(Math.random() * 2) + 1),
      marketChannel: Math.random() > 0.5 ? 'domestic' : 'export',
      customerReserved: Math.random() > 0.7 ? '大型养殖场A' : undefined,
      shippingInfo: Math.random() > 0.6 ? {
        orderId: `ORDER-${String(i).padStart(4, '0')}`,
        customer: '客户公司A',
        shippingDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        trackingNumber: `TRACK-${String(i).padStart(6, '0')}`
      } : undefined,
      createdAt: productionDate.toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  return products
}

// 预生成数据实例
export const mockProductionBatches = generateMockProductionBatches()
export const mockQualityTests = generateMockQualityTests()
export const mockFinishedProducts = generateMockFinishedProducts()

/**
 * 数据获取函数
 */
export function getRawMaterialsList(query: ProcessingQuery = {}) {
  let materials = Object.values(mockRawMaterials)

  if (query.search) {
    materials = materials.filter(material =>
      material.name.includes(query.search!) ||
      material.supplier.includes(query.search!) ||
      material.batchNumber.includes(query.search!)
    )
  }

  if (query.category) {
    materials = materials.filter(material => material.category === query.category)
  }

  if (query.status) {
    materials = materials.filter(material => material.status === query.status)
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const total = materials.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    materials: materials.slice(startIndex, endIndex),
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

export function getProductionBatchesList(query: ProcessingQuery = {}) {
  let batches = mockProductionBatches

  if (query.search) {
    batches = batches.filter(batch =>
      batch.batchNumber.includes(query.search!) ||
      batch.productName.includes(query.search!) ||
      batch.supervisor.includes(query.search!)
    )
  }

  if (query.status) {
    batches = batches.filter(batch => batch.status === query.status)
  }

  if (query.productType) {
    batches = batches.filter(batch => batch.productType === query.productType)
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const total = batches.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    batches: batches.slice(startIndex, endIndex),
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

export function getQualityTestsList(query: ProcessingQuery = {}) {
  let tests = mockQualityTests

  if (query.search) {
    tests = tests.filter(test =>
      test.testNumber.includes(query.search!) ||
      test.batchNumber.includes(query.search!) ||
      test.inspector.includes(query.search!)
    )
  }

  if (query.testType) {
    tests = tests.filter(test => test.testType === query.testType)
  }

  if (query.status) {
    tests = tests.filter(test => test.status === query.status)
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const total = tests.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    tests: tests.slice(startIndex, endIndex),
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

export function getFinishedProductsList(query: ProcessingQuery = {}) {
  let products = mockFinishedProducts

  if (query.search) {
    products = products.filter(product =>
      product.productName.includes(query.search!) ||
      product.productCode.includes(query.search!) ||
      product.batchNumber.includes(query.search!)
    )
  }

  if (query.category) {
    products = products.filter(product => product.category === query.category)
  }

  if (query.status) {
    products = products.filter(product => product.status === query.status)
  }

  if (query.quality) {
    products = products.filter(product => product.quality === query.quality)
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const total = products.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    products: products.slice(startIndex, endIndex),
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
 * 加工模块统计数据
 */
export function getProcessingOverviewStats() {
  const totalBatches = mockProductionBatches.length
  const activeBatches = mockProductionBatches.filter(b => ['in-progress', 'quality-check'].includes(b.status)).length
  const completedBatches = mockProductionBatches.filter(b => b.status === 'completed' || b.status === 'approved').length
  const totalProducts = mockFinishedProducts.length
  const qualityTests = mockQualityTests.length
  const passedTests = mockQualityTests.filter(t => t.overallResult === 'pass').length
  const totalRawMaterials = Object.keys(mockRawMaterials).length
  const approvedMaterials = Object.values(mockRawMaterials).filter(m => m.status === 'approved').length

  const averageYield = mockProductionBatches.reduce((sum, b) => sum + b.yield, 0) / totalBatches
  const averageQualityScore = mockQualityTests.reduce((sum, t) => sum + t.qualityScore, 0) / qualityTests
  const totalProduction = mockFinishedProducts.reduce((sum, p) => sum + p.quantity, 0)
  const totalValue = mockFinishedProducts.reduce((sum, p) => sum + p.totalValue, 0)

  return {
    totalBatches,
    activeBatches,
    completedBatches,
    totalProducts,
    qualityTests,
    passedTests,
    qualityPassRate: Math.round((passedTests / qualityTests) * 100),
    totalRawMaterials,
    approvedMaterials,
    averageYield: Math.round(averageYield),
    averageQualityScore: Math.round(averageQualityScore * 10) / 10,
    totalProduction,
    totalValue,
    efficiency: Math.round((completedBatches / totalBatches) * 100)
  }
}
