/**
 * 加工模块Mock API处理器
 * 从基础3个API扩展到完整8个API端点
 * 支持原料管理、生产批次、质检记录、成品管理等完整业务流程
 */

import { http, HttpResponse } from 'msw'
import { wrapResponse, wrapError } from '../../types/api-response'
import {
  getProcessingOverviewStats,
  getRawMaterialsList,
  mockRawMaterials,
  getProductionBatchesList,
  mockProductionBatches,
  getQualityTestsList,
  mockQualityTests,
  getFinishedProductsList,
  mockFinishedProducts,
  type ProcessingQuery
} from '../data/processing-data'

/**
 * 统一认证检查
 */
function authenticateRequest(request: Request): { success: boolean; error?: any } {
  // 测试环境早退：直接返回成功
  if (process.env.NODE_ENV === 'test') {
    console.log(`✅ Auth Debug: Processing test env bypass - authentication skipped`)
    return { success: true }
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: HttpResponse.json(
        wrapError('未授权访问', 401, { type: 'UNAUTHORIZED' }),
        { status: 401 }
      )
    }
  }
  return { success: true }
}

/**
 * 创建统一响应头
 */
function createMockHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Mock-API': 'processing-module',
    'X-API-Version': '1.0'
  }
}

/**
 * 解析查询参数
 */
function parseQuery(url: URL): ProcessingQuery {
  const params = new URLSearchParams(url.search)
  return {
    page: params.get('page') ? parseInt(params.get('page')!) : 1,
    pageSize: params.get('pageSize') ? parseInt(params.get('pageSize')!) : 10,
    search: params.get('search') || undefined,
    category: params.get('category') || undefined,
    status: params.get('status') || undefined,
    batchId: params.get('batchId') || undefined,
    productType: params.get('productType') || undefined,
    testType: params.get('testType') || undefined,
    inspector: params.get('inspector') || undefined,
    dateFrom: params.get('dateFrom') || undefined,
    dateTo: params.get('dateTo') || undefined,
    quality: params.get('quality') || undefined,
    sortBy: params.get('sortBy') || undefined,
    sortOrder: (params.get('sortOrder') as 'asc' | 'desc') || 'desc'
  }
}

/**
 * 网络延迟模拟
 */
function createNetworkDelay() {
  return new Promise(resolve => setTimeout(resolve, Math.random() * 350 + 150)) // 150-500ms
}

export const processingHandlers = [
  // 1. 加工模块总览统计 (增强版)
  http.get('/api/processing/overview', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const stats = getProcessingOverviewStats()

      // 扩展统计信息
      const extendedStats = {
        ...stats,
        trends: {
          productionTrend: '+12%',
          qualityTrend: '+5%',
          efficiencyTrend: '+8%',
          yieldTrend: '+3%'
        },
        alerts: {
          lowStock: 3,
          qualityIssues: 1,
          equipmentMaintenance: 2,
          expiringMaterials: 5
        },
        recentActivity: [
          {
            type: 'production_completed',
            message: '生产批次 BATCH-2024-015 已完成',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          },
          {
            type: 'quality_test_passed',
            message: '质检 QT-2024-018 通过检验',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
          },
          {
            type: 'material_received',
            message: '新批次原料已入库',
            timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
          }
        ]
      }

      return HttpResponse.json(
        wrapResponse(extendedStats, '加工模块总览数据获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Processing overview error:', error)
      return HttpResponse.json(
        wrapError('获取加工总览数据失败', 500, { type: 'PROCESSING_OVERVIEW_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 2. 原料管理列表 (分页+搜索+筛选)
  http.get('/api/processing/raw-materials', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const url = new URL(request.url)
      const query = parseQuery(url)
      const result = getRawMaterialsList(query)

      const responseData = {
        materials: result.materials,
        pagination: result.pagination,
        query: query,
        filters: {
          categories: ['grain', 'additive', 'packaging', 'other'],
          statuses: ['pending', 'approved', 'in-use', 'used', 'expired', 'rejected'],
          suppliers: [...new Set(Object.values(mockRawMaterials).map(m => m.supplier))]
        }
      }

      return HttpResponse.json(
        wrapResponse(responseData, `成功获取原料列表，共 ${result.pagination.total} 条记录`, 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Raw materials list error:', error)
      return HttpResponse.json(
        wrapError('获取原料列表失败', 500, { type: 'RAW_MATERIALS_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 3. 原料详情 (NEW - 单个原料详细信息)
  http.get('/api/processing/raw-materials/:id', async ({ request, params }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const { id } = params
      const material = mockRawMaterials[id as string]

      if (!material) {
        return HttpResponse.json({
          success: false,
          message: '原料不存在',
          error: 'MATERIAL_NOT_FOUND'
        }, {
          status: 404,
          headers: createMockHeaders()
        })
      }

      // 扩展原料详情信息
      const extendedMaterial = {
        ...material,
        usage: {
          totalUsed: Math.floor(material.quantity * 0.3),
          remainingQuantity: Math.floor(material.quantity * 0.7),
          usageRate: '30%',
          estimatedDepletionDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        qualityHistory: [
          {
            testDate: '2024-09-01',
            parameter: '纯度检测',
            result: '99.2%',
            status: 'pass'
          },
          {
            testDate: '2024-09-01',
            parameter: '水分含量',
            result: '14.5%',
            status: 'pass'
          }
        ],
        relatedBatches: [
          'BATCH-2024-001',
          'BATCH-2024-005',
          'BATCH-2024-008'
        ]
      }

      return HttpResponse.json(
        wrapResponse(extendedMaterial, '原料详情获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Raw material detail error:', error)
      return HttpResponse.json(
        wrapError('获取原料详情失败', 500, { type: 'MATERIAL_DETAIL_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 4. 生产批次管理 (NEW - 分页+搜索+筛选)
  http.get('/api/processing/batches', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const url = new URL(request.url)
      const query = parseQuery(url)
      const result = getProductionBatchesList(query)

      const responseData = {
        batches: result.batches,
        pagination: result.pagination,
        query: query,
        filters: {
          statuses: ['planned', 'in-progress', 'completed', 'quality-check', 'approved', 'rejected'],
          productTypes: [...new Set(mockProductionBatches.map(b => b.productType))],
          productionLines: [...new Set(mockProductionBatches.map(b => b.productionLine))],
          supervisors: [...new Set(mockProductionBatches.map(b => b.supervisor))]
        },
        summary: {
          totalBatches: mockProductionBatches.length,
          activeBatches: mockProductionBatches.filter(b => ['in-progress', 'quality-check'].includes(b.status)).length,
          completedToday: mockProductionBatches.filter(b =>
            b.status === 'completed' &&
            new Date(b.endDate!).toDateString() === new Date().toDateString()
          ).length,
          averageYield: Math.round(
            mockProductionBatches.reduce((sum, b) => sum + b.yield, 0) / mockProductionBatches.length
          )
        }
      }

      return HttpResponse.json(
        wrapResponse(responseData, `成功获取生产批次列表，共 ${result.pagination.total} 条记录`, 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Production batches error:', error)
      return HttpResponse.json(
        wrapError('获取生产批次列表失败', 500, { type: 'BATCHES_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 5. 质检记录管理 (NEW - 分页+搜索+筛选)
  http.get('/api/processing/quality-tests', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const url = new URL(request.url)
      const query = parseQuery(url)
      const result = getQualityTestsList(query)

      const responseData = {
        tests: result.tests,
        pagination: result.pagination,
        query: query,
        filters: {
          testTypes: ['incoming', 'in-process', 'final', 'random'],
          statuses: ['pending', 'in-progress', 'completed', 'approved', 'rejected'],
          inspectors: [...new Set(mockQualityTests.map(t => t.inspector))],
          results: ['pass', 'fail', 'conditional-pass']
        },
        statistics: {
          totalTests: mockQualityTests.length,
          passedTests: mockQualityTests.filter(t => t.overallResult === 'pass').length,
          failedTests: mockQualityTests.filter(t => t.overallResult === 'fail').length,
          averageScore: Math.round(
            mockQualityTests.reduce((sum, t) => sum + t.qualityScore, 0) / mockQualityTests.length * 10
          ) / 10,
          passRate: Math.round(
            (mockQualityTests.filter(t => t.overallResult === 'pass').length / mockQualityTests.length) * 100
          )
        }
      }

      return HttpResponse.json(
        wrapResponse(responseData, `成功获取质检记录列表，共 ${result.pagination.total} 条记录`, 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Quality tests error:', error)
      return HttpResponse.json(
        wrapError('获取质检记录失败', 500, { type: 'QUALITY_TESTS_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 6. 质检详情 (NEW - 单个质检记录详细信息)
  http.get('/api/processing/quality-tests/:id', async ({ request, params }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const { id } = params
      const test = mockQualityTests.find(t => t.id === id)

      if (!test) {
        return HttpResponse.json({
          success: false,
          message: '质检记录不存在',
          error: 'TEST_NOT_FOUND'
        }, {
          status: 404,
          headers: createMockHeaders()
        })
      }

      // 扩展质检详情信息
      const extendedTest = {
        ...test,
        batchInfo: mockProductionBatches.find(b => b.id === test.batchId),
        equipmentUsed: [
          '检测设备A-001',
          '分析仪B-002',
          '电子秤C-003'
        ],
        environmentConditions: {
          temperature: `${Math.floor(Math.random() * 5) + 20}°C`,
          humidity: `${Math.floor(Math.random() * 10) + 45}%`,
          pressure: '1013 hPa'
        },
        timeline: [
          {
            stage: '样品采集',
            time: '08:30',
            status: 'completed',
            operator: test.inspector
          },
          {
            stage: '实验室检测',
            time: '09:15',
            status: 'completed',
            operator: test.inspector
          },
          {
            stage: '数据分析',
            time: '10:45',
            status: 'completed',
            operator: test.inspector
          },
          {
            stage: '报告审核',
            time: '11:30',
            status: test.status === 'approved' ? 'completed' : 'pending',
            operator: test.approvedBy || '待定'
          }
        ]
      }

      return HttpResponse.json(
        wrapResponse(extendedTest, '质检详情获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Quality test detail error:', error)
      return HttpResponse.json(
        wrapError('获取质检详情失败', 500, { type: 'TEST_DETAIL_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 7. 成品管理 (NEW - 分页+搜索+筛选)
  http.get('/api/processing/finished-products', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const url = new URL(request.url)
      const query = parseQuery(url)
      const result = getFinishedProductsList(query)

      const responseData = {
        products: result.products,
        pagination: result.pagination,
        query: query,
        filters: {
          categories: ['feed', 'food', 'supplement', 'other'],
          qualities: ['premium', 'grade-a', 'grade-b', 'grade-c'],
          statuses: ['in-production', 'quality-check', 'approved', 'shipped', 'sold', 'expired'],
          storageLocations: [...new Set(mockFinishedProducts.map(p => p.storageLocation))],
          marketChannels: ['domestic', 'export', 'retail', 'wholesale']
        },
        inventory: {
          totalProducts: mockFinishedProducts.length,
          totalQuantity: mockFinishedProducts.reduce((sum, p) => sum + p.quantity, 0),
          totalValue: mockFinishedProducts.reduce((sum, p) => sum + p.totalValue, 0),
          readyForShipment: mockFinishedProducts.filter(p => p.status === 'approved').length,
          inQualityCheck: mockFinishedProducts.filter(p => p.status === 'quality-check').length
        }
      }

      return HttpResponse.json(
        wrapResponse(responseData, `成功获取成品列表，共 ${result.pagination.total} 条记录`, 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Finished products error:', error)
      return HttpResponse.json(
        wrapError('获取成品列表失败', 500, { type: 'PRODUCTS_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 8. 成品详情 (NEW - 单个成品详细信息)
  http.get('/api/processing/finished-products/:id', async ({ request, params }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const { id } = params
      const product = mockFinishedProducts.find(p => p.id === id)

      if (!product) {
        return HttpResponse.json(
          wrapError('成品不存在', 404, { type: 'PRODUCT_NOT_FOUND' }),
          {
            status: 404,
            headers: createMockHeaders()
          }
        )
      }

      // 扩展成品详情信息
      const extendedProduct = {
        ...product,
        batchInfo: mockProductionBatches.find(b => b.id === product.batchId),
        qualityInfo: product.qualityTestId ?
          mockQualityTests.find(t => t.id === product.qualityTestId) : null,
        traceability: {
          rawMaterials: [
            {
              materialId: 'raw_001',
              materialName: '优质玉米',
              batchNumber: 'CORN-2024-001',
              quantity: Math.floor(product.quantity * 0.7),
              supplier: '东北农业合作社'
            },
            {
              materialId: 'raw_002',
              materialName: '大豆蛋白粉',
              batchNumber: 'SOY-2024-015',
              quantity: Math.floor(product.quantity * 0.2),
              supplier: '蛋白质科技有限公司'
            }
          ],
          productionProcess: [
            {
              step: '原料混合',
              time: '2小时',
              temperature: '25°C',
              operator: '小张'
            },
            {
              step: '加工处理',
              time: '4小时',
              temperature: '80°C',
              operator: '小李'
            },
            {
              step: '质量检测',
              time: '1小时',
              temperature: '25°C',
              operator: '李质检'
            },
            {
              step: '包装封装',
              time: '2小时',
              temperature: '25°C',
              operator: '小王'
            }
          ]
        },
        marketInfo: {
          currentPrice: product.pricePerUnit,
          priceHistory: [
            { date: '2024-08-01', price: product.pricePerUnit * 0.95 },
            { date: '2024-08-15', price: product.pricePerUnit * 0.98 },
            { date: '2024-09-01', price: product.pricePerUnit }
          ],
          demandTrend: 'increasing',
          competitorPrices: [
            { competitor: '竞争对手A', price: product.pricePerUnit * 1.05 },
            { competitor: '竞争对手B', price: product.pricePerUnit * 0.92 }
          ]
        }
      }

      return HttpResponse.json(
        wrapResponse(extendedProduct, '成品详情获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Product detail error:', error)
      return HttpResponse.json(
        wrapError('获取成品详情失败', 500, { type: 'PRODUCT_DETAIL_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // POST /api/processing/batches - 创建生产批次
  http.post('/api/processing/batches', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const body = await request.json() as any

      // 创建新的生产批次
      const newBatch = {
        id: `batch_${Date.now()}`,
        productId: body.productId,
        quantity: body.quantity,
        startDate: body.startDate,
        status: 'planned',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      return HttpResponse.json(
        wrapResponse(newBatch, '生产批次创建成功', 201),
        {
          status: 201,
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Create production batch error:', error)
      return HttpResponse.json(
        wrapError('创建生产批次失败', 500, { type: 'CREATE_BATCH_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  })
]
