/**
 * 加工模块Mock API处理器
 * 从基础3个API扩展到完整8个API端点
 * 支持原料管理、生产批次、质检记录、成品管理等完整业务流程
 * TASK-P3-025扩展：增加HACCP、温度监控、肉质评定、班组管理等数据支撑
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

/**
 * TASK-P3-025数据生成器：快速生成新页面所需数据
 */
function generateQuickMockData() {
  return {
    // 班组管理数据 (for /processing/production/teams)
    teams: [
      {
        id: 'team_001',
        teamName: '早班生产组',
        shift: 'morning',
        supervisor: '张班长',
        members: [
          { name: '小李', role: '操作员', experience: 3 },
          { name: '小王', role: '质检员', experience: 2 },
          { name: '小赵', role: '设备员', experience: 5 }
        ],
        performance: { efficiency: 92, quality: 95, safety: 98 },
        workstation: '生产线A'
      },
      {
        id: 'team_002',
        teamName: '中班生产组',
        shift: 'afternoon',
        supervisor: '李班长',
        members: [
          { name: '小陈', role: '操作员', experience: 4 },
          { name: '小周', role: '质检员', experience: 3 },
          { name: '小吴', role: '设备员', experience: 2 }
        ],
        performance: { efficiency: 88, quality: 93, safety: 96 },
        workstation: '生产线B'
      }
    ],

    // 工艺流程数据 (for /processing/production/workflow)
    workflows: [
      {
        id: 'wf_001',
        workflowName: '标准加工流程',
        productType: '冷鲜肉',
        steps: [
          { stepName: '原料验收', duration: 30, equipment: '检验台', operator: '质检员' },
          { stepName: '清洗处理', duration: 45, equipment: '清洗机', operator: '操作员' },
          { stepName: '分割加工', duration: 120, equipment: '分割台', operator: '技师' },
          { stepName: '包装封装', duration: 60, equipment: '包装机', operator: '包装员' },
          { stepName: '冷链储存', duration: 0, equipment: '冷库', operator: '仓管员' }
        ],
        totalDuration: 255,
        qualityStandards: { temperature: '≤4°C', humidity: '85-90%' }
      }
    ],

    // 冷链监控数据 (for /processing/storage/cold-chain)
    coldChain: Array.from({length: 10}, (_, i) => ({
      id: `cold_${String(i + 1).padStart(3, '0')}`,
      productName: ['猪肉', '牛肉', '鸡肉'][Math.floor(Math.random() * 3)],
      storageZone: `冷库${String.fromCharCode(65 + Math.floor(Math.random() * 3))}`,
      targetTemperature: -2,
      actualTemperature: Math.round((Math.random() * 2 - 3) * 10) / 10,
      humidity: Math.round((Math.random() * 10 + 85) * 10) / 10,
      status: Math.random() > 0.8 ? 'alarm' : 'active',
      startTime: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
    })),

    // 库存盘点数据 (for /processing/storage/inventory-check)
    inventoryChecks: [
      {
        id: 'inv_001',
        checkNumber: 'INV-2024-001',
        checkDate: new Date().toISOString().split('T')[0],
        checkType: 'scheduled',
        warehouse: '原料仓库A',
        checker: '张盘点员',
        items: [
          { productName: '玉米', expectedQuantity: 1000, actualQuantity: 998, difference: -2 },
          { productName: '大豆', expectedQuantity: 500, actualQuantity: 502, difference: 2 }
        ],
        status: 'completed',
        accuracyRate: 99.8
      }
    ]
  }
}

export const processingHandlers = [
  // 0. 加工模块基础信息
  http.get('/api/processing', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const moduleInfo = {
        module: 'processing',
        name: '加工管理系统',
        version: '1.0.0',
        status: 'active',
        endpoints: [
          'GET /api/processing/overview - 加工概览统计',
          'GET /api/processing/raw-materials - 原料管理',
          'GET /api/processing/production-batches - 生产批次',
          'GET /api/processing/quality-tests - 质检记录',
          'GET /api/processing/finished-products - 成品管理',
          'GET /api/processing/equipment - 设备管理',
          'GET /api/processing/storage - 仓储管理',
          'GET /api/processing/reports - 报表统计'
        ],
        lastUpdated: new Date().toISOString()
      }

      return HttpResponse.json(
        wrapResponse(moduleInfo, '加工模块信息获取成功'),
        {
          status: 200,
          headers: createMockHeaders()
        }
      )

    } catch (error) {
      console.error('[Mock] Processing module info error:', error)
      return HttpResponse.json(
        wrapError('获取加工模块信息失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500, headers: createMockHeaders() }
      )
    }
  }),

  // 1. 加工模块总览统计 (增强版 + TASK-P3-025设备监控数据)
  http.get('/api/processing/overview', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const stats = getProcessingOverviewStats()
      const quickData = generateQuickMockData()

      // 扩展统计信息 + 设备监控数据
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
        // 设备监控数据 (for /processing/production/equipment-monitor)
        equipment: [
          {
            id: 'eq_001',
            name: '生产线A',
            status: 'running',
            efficiency: 94,
            temperature: 25,
            pressure: 0.8,
            speed: 120,
            lastMaintenance: '2024-11-15',
            nextMaintenance: '2024-12-15'
          },
          {
            id: 'eq_002',
            name: '包装机B',
            status: 'warning',
            efficiency: 87,
            temperature: 28,
            pressure: 0.6,
            speed: 95,
            lastMaintenance: '2024-11-20',
            nextMaintenance: '2024-12-20'
          }
        ],
        // 冷链监控数据
        coldChain: quickData.coldChain.slice(0, 5),
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
        return HttpResponse.json(
          wrapError('原料不存在', 404, { type: 'MATERIAL_NOT_FOUND' }),
          {
            status: 404,
            headers: createMockHeaders()
          }
        )
      }

      // 扩展原料详情信息
      const extendedMaterial = {
        ...material,
        usage: {
          totalUsed: Math.floor(material.quantity * 0.3),
          remainingStock: Math.floor(material.quantity * 0.7),
          lastUsedDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          averageDailyUsage: Math.floor(material.quantity * 0.01)
        },
        qualityHistory: [
          {
            date: '2024-11-15',
            inspector: '李质检',
            result: 'pass',
            notes: '质量符合标准'
          },
          {
            date: '2024-11-01',
            inspector: '王检验',
            result: 'pass',
            notes: '各项指标正常'
          }
        ],
        relatedBatches: mockProductionBatches
          .filter(batch => batch.rawMaterials.some(rm => rm.materialId === id))
          .slice(0, 3)
          .map(batch => ({
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            usedQuantity: batch.rawMaterials.find(rm => rm.materialId === id)?.actualAmount || 0,
            usedDate: batch.startDate
          }))
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

  // 4. 生产批次列表 (分页+搜索+筛选 + TASK-P3-025班组数据)
  http.get('/api/processing/batches', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const url = new URL(request.url)
      const query = parseQuery(url)
      const result = getProductionBatchesList(query)
      const quickData = generateQuickMockData()

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
        // 班组管理数据 (for /processing/production/teams)
        teams: quickData.teams,
        // 工艺流程数据 (for /processing/production/workflow)
        workflows: quickData.workflows,
        statistics: {
          totalBatches: mockProductionBatches.length,
          completedBatches: mockProductionBatches.filter(b => b.status === 'completed').length,
          inProgressBatches: mockProductionBatches.filter(b => b.status === 'in-progress').length,
          averageYield: mockProductionBatches.reduce((sum, b) => sum + b.yield, 0) / mockProductionBatches.length
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

  // 5. 生产批次详情 (NEW - 单个批次详细信息)
  http.get('/api/processing/batches/:id', async ({ request, params }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const { id } = params
      const batch = mockProductionBatches.find(b => b.id === id)

      if (!batch) {
        return HttpResponse.json(
          wrapError('生产批次不存在', 404, { type: 'BATCH_NOT_FOUND' }),
          {
            status: 404,
            headers: createMockHeaders()
          }
        )
      }

      // 扩展批次详情信息
      const extendedBatch = {
        ...batch,
        qualityTests: mockQualityTests.filter(t => t.batchId === id),
        finishedProducts: mockFinishedProducts.filter(p => p.batchId === id),
        realTimeData: {
          currentStep: batch.status === 'in-progress' ? '分割加工' : null,
          progress: batch.status === 'completed' ? 100 : Math.floor(Math.random() * 80 + 10),
          currentOperator: batch.operators[0],
          equipmentStatus: 'normal',
          nextQualityCheck: batch.status === 'in-progress' ?
            new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() : null
        },
        traceability: {
          rawMaterialsDetails: batch.rawMaterials.map(rm => ({
            ...rm,
            supplier: mockRawMaterials[rm.materialId]?.supplier || '未知供应商',
            batchNumber: mockRawMaterials[rm.materialId]?.batchNumber || '未知批次',
            quality: mockRawMaterials[rm.materialId]?.quality || 'grade-a'
          }))
        }
      }

      return HttpResponse.json(
        wrapResponse(extendedBatch, '生产批次详情获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Batch detail error:', error)
      return HttpResponse.json(
        wrapError('获取批次详情失败', 500, { type: 'BATCH_DETAIL_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 6. 质检记录列表 (分页+搜索+筛选)
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
          results: ['pass', 'fail', 'conditional-pass'],
          statuses: ['pending', 'in-progress', 'completed', 'approved', 'rejected'],
          inspectors: [...new Set(mockQualityTests.map(t => t.inspector))],
          productTypes: [...new Set(mockQualityTests.map(t => t.productType))]
        },
        summary: {
          totalTests: mockQualityTests.length,
          passRate: (mockQualityTests.filter(t => t.overallResult === 'pass').length / mockQualityTests.length * 100).toFixed(1),
          averageScore: (mockQualityTests.reduce((sum, t) => sum + t.qualityScore, 0) / mockQualityTests.length).toFixed(1),
          testsToday: mockQualityTests.filter(t =>
            new Date(t.testDate).toDateString() === new Date().toDateString()
          ).length
        }
      }

      return HttpResponse.json(
        wrapResponse(responseData, `成功获取质检记录列表，共 ${result.pagination.total} 条记录`, 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Quality tests list error:', error)
      return HttpResponse.json(
        wrapError('获取质检记录列表失败', 500, { type: 'TESTS_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 7. 质检详情 (NEW - 单个质检详细信息 + TASK-P3-025完整数据支撑)
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

      // 扩展质检详情信息 + TASK-P3-025新页面数据支撑
      const extendedTest = {
        ...test,
        batchInfo: mockProductionBatches.find(b => b.id === test.batchId),

        // HACCP控制点数据 (for /processing/quality/haccp)
        haccp: [
          {
            id: 'ccp_001',
            controlPoint: '接收原料温度控制',
            criticalLimit: '冷冻原料≤-18°C，冷藏原料≤4°C',
            monitoringMethod: '每批次接收时测量温度',
            frequency: '每批次',
            responsible: '质检员',
            status: 'compliant',
            lastCheck: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            corrective: '不符合温度要求的原料拒收'
          },
          {
            id: 'ccp_002',
            controlPoint: '加工过程pH值控制',
            criticalLimit: 'pH值6.0-6.8',
            monitoringMethod: 'pH计实时监测',
            frequency: '每30分钟',
            responsible: '生产员',
            status: 'warning',
            lastCheck: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            corrective: '调整pH值至标准范围'
          },
          {
            id: 'ccp_003',
            controlPoint: '金属检测控制',
            criticalLimit: '无金属异物',
            monitoringMethod: '金属检测器检测',
            frequency: '每件产品',
            responsible: '品控员',
            status: 'compliant',
            lastCheck: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            corrective: '剔除含金属异物产品'
          }
        ],

        // 温度监控历史数据 (for /processing/quality/temperature)
        temperatureHistory: Array.from({length: 24}, (_, i) => ({
          id: `temp_${String(i + 1).padStart(3, '0')}`,
          timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
          location: ['冷库A', '生产车间', '包装区', '发酵室'][Math.floor(Math.random() * 4)],
          temperature: Math.round((Math.random() * 20 - 5) * 10) / 10, // -5°C 到 15°C
          humidity: Math.round((Math.random() * 30 + 50) * 10) / 10, // 50-80%
          alertLevel: Math.random() > 0.9 ? 'warning' : 'normal',
          equipment: `传感器${String(Math.floor(Math.random() * 5) + 1).padStart(2, '0')}`
        })),

        // 肉质评定数据 (for /processing/quality/meat-evaluation)
        meatEvaluation: {
          appearance: {
            color: '鲜红色',
            glossiness: '有光泽',
            marbling: 'A级',
            score: 92
          },
          texture: {
            firmness: '紧实',
            elasticity: '良好',
            tenderness: '嫩',
            score: 89
          },
          smell: {
            freshness: '新鲜',
            abnormalOdor: '无',
            score: 95
          },
          overall: {
            grade: 'premium',
            totalScore: 92,
            evaluator: test.inspector,
            evaluationDate: test.testDate
          }
        },

        // 质量标准配置 (for /processing/quality/standards)
        qualityStandards: {
          physicalStandards: [
            { parameter: '水分含量', standard: '≤78%', tolerance: '±2%' },
            { parameter: '蛋白质含量', standard: '≥18%', tolerance: '±1%' },
            { parameter: '脂肪含量', standard: '2-8%', tolerance: '±0.5%' },
            { parameter: 'pH值', standard: '5.8-6.2', tolerance: '±0.2' }
          ],
          microbiologicalStandards: [
            { parameter: '菌落总数', standard: '≤10^5 CFU/g', method: 'GB 4789.2' },
            { parameter: '大肠菌群', standard: '≤10^2 CFU/g', method: 'GB 4789.3' },
            { parameter: '沙门氏菌', standard: '不得检出/25g', method: 'GB 4789.4' }
          ]
        },

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

  // 8. 成品管理 (NEW - 分页+搜索+筛选 + TASK-P3-025存储数据)
  http.get('/api/processing/finished-products', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const url = new URL(request.url)
      const query = parseQuery(url)
      const result = getFinishedProductsList(query)
      const quickData = generateQuickMockData()

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
        // 冷链监控数据 (for /processing/storage/cold-chain)
        coldChain: quickData.coldChain,
        // 库存盘点数据 (for /processing/storage/inventory-check)
        inventoryChecks: quickData.inventoryChecks,
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

  // 9. 成品详情 (NEW - 单个成品详细信息)
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
        storageInfo: {
          currentLocation: product.storageLocation,
          temperature: `${Math.floor(Math.random() * 8) - 2}°C`,
          humidity: `${Math.floor(Math.random() * 10) + 80}%`,
          storageDate: product.productionDate,
          shelfLife: Math.floor(
            (new Date(product.expiryDate).getTime() - new Date(product.productionDate).getTime())
            / (1000 * 60 * 60 * 24)
          )
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

  // **TASK-P3-025 新页面专门API端点**

  // 10. HACCP控制点管理 (for /processing/quality/haccp)
  http.get('/api/processing/quality/haccp/points', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const haccpPoints = [
        {
          id: 'ccp_001',
          pointName: 'CCP-1 原料接收',
          processStep: '原料验收',
          hazardType: 'biological',
          criticalLimit: '冷冻原料≤-18°C，冷藏原料≤4°C',
          monitoringMethod: '每批次接收时测量温度',
          frequency: '每批次',
          responsibility: '质检员',
          correctiveAction: '不符合温度要求的原料拒收',
          status: 'normal',
          lastCheck: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          nextCheck: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'ccp_002',
          pointName: 'CCP-2 pH控制',
          processStep: '发酵加工',
          hazardType: 'chemical',
          criticalLimit: 'pH值6.0-6.8',
          monitoringMethod: 'pH计实时监测',
          frequency: '每30分钟',
          responsibility: '生产员',
          correctiveAction: '调整pH值至标准范围',
          status: 'deviation',
          lastCheck: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          nextCheck: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        },
        {
          id: 'ccp_003',
          pointName: 'CCP-3 金属检测',
          processStep: '包装前检测',
          hazardType: 'physical',
          criticalLimit: '无金属异物',
          monitoringMethod: '金属检测器检测',
          frequency: '每件产品',
          responsibility: '品控员',
          correctiveAction: '剔除含金属异物产品',
          status: 'normal',
          lastCheck: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          nextCheck: new Date(Date.now() + 50 * 60 * 1000).toISOString()
        },
        {
          id: 'ccp_004',
          pointName: 'CCP-4 杀菌温度',
          processStep: '高温杀菌',
          hazardType: 'biological',
          criticalLimit: '核心温度≥75°C保持2分钟',
          monitoringMethod: '温度记录仪连续监测',
          frequency: '连续',
          responsibility: '操作员',
          correctiveAction: '重新加热至标准温度',
          status: 'normal',
          lastCheck: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          nextCheck: new Date(Date.now() + 45 * 60 * 1000).toISOString()
        },
        {
          id: 'ccp_005',
          pointName: 'CCP-5 包装密封',
          processStep: '真空包装',
          hazardType: 'biological',
          criticalLimit: '真空度≥-0.8bar',
          monitoringMethod: '真空表检测',
          frequency: '每批次抽检10%',
          responsibility: '包装员',
          correctiveAction: '重新包装不合格产品',
          status: 'critical',
          lastCheck: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          nextCheck: new Date(Date.now() + 55 * 60 * 1000).toISOString()
        }
      ]

      return HttpResponse.json(
        wrapResponse(haccpPoints, 'HACCP控制点获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('HACCP points error:', error)
      return HttpResponse.json(
        wrapError('获取HACCP控制点失败', 500, { type: 'HACCP_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 11. 温度监控数据 (for /processing/quality/temperature)
  http.get('/api/processing/quality/temperature', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const temperatureData = Array.from({length: 48}, (_, i) => ({
        id: `temp_${String(i + 1).padStart(3, '0')}`,
        timestamp: new Date(Date.now() - (47 - i) * 30 * 60 * 1000).toISOString(),
        location: ['冷库A', '生产车间', '包装区', '发酵室', '原料仓库'][Math.floor(Math.random() * 5)],
        temperature: Math.round((Math.random() * 25 - 5) * 10) / 10, // -5°C 到 20°C
        humidity: Math.round((Math.random() * 40 + 40) * 10) / 10, // 40-80%
        alertLevel: Math.random() > 0.85 ? (Math.random() > 0.5 ? 'warning' : 'danger') : 'normal',
        equipment: `传感器${String(Math.floor(Math.random() * 8) + 1).padStart(2, '0')}`,
        targetRange: {
          min: -2,
          max: 4
        }
      }))

      const summary = {
        totalSensors: 8,
        normalSensors: temperatureData.filter(t => t.alertLevel === 'normal').length,
        warningSensors: temperatureData.filter(t => t.alertLevel === 'warning').length,
        dangerSensors: temperatureData.filter(t => t.alertLevel === 'danger').length,
        averageTemperature: Math.round(temperatureData.reduce((sum, t) => sum + t.temperature, 0) / temperatureData.length * 10) / 10,
        averageHumidity: Math.round(temperatureData.reduce((sum, t) => sum + t.humidity, 0) / temperatureData.length * 10) / 10
      }

      return HttpResponse.json(
        wrapResponse({ data: temperatureData, summary }, '温度监控数据获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Temperature monitoring error:', error)
      return HttpResponse.json(
        wrapError('获取温度监控数据失败', 500, { type: 'TEMPERATURE_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 12. 肉质评定数据 (for /processing/quality/meat-evaluation)
  http.get('/api/processing/quality/meat-evaluation', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const evaluations = Array.from({length: 12}, (_, i) => ({
        id: `eval_${String(i + 1).padStart(3, '0')}`,
        sampleId: `SAMPLE-${String(i + 1).padStart(4, '0')}`,
        productType: ['猪肉', '牛肉', '鸡肉'][Math.floor(Math.random() * 3)],
        evaluationDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        evaluator: ['李质检', '王评定员', '张技师'][Math.floor(Math.random() * 3)],
        appearance: {
          color: ['鲜红色', '淡红色', '深红色'][Math.floor(Math.random() * 3)],
          glossiness: ['有光泽', '略有光泽', '无光泽'][Math.floor(Math.random() * 3)],
          marbling: ['A级', 'B级', 'C级'][Math.floor(Math.random() * 3)],
          score: Math.floor(Math.random() * 20) + 80
        },
        texture: {
          firmness: ['紧实', '一般', '松软'][Math.floor(Math.random() * 3)],
          elasticity: ['良好', '一般', '较差'][Math.floor(Math.random() * 3)],
          tenderness: ['嫩', '适中', '老'][Math.floor(Math.random() * 3)],
          score: Math.floor(Math.random() * 20) + 80
        },
        smell: {
          freshness: ['新鲜', '较新鲜', '不新鲜'][Math.floor(Math.random() * 3)],
          abnormalOdor: ['无', '轻微', '明显'][Math.floor(Math.random() * 3)],
          score: Math.floor(Math.random() * 20) + 80
        },
        overall: {
          grade: ['premium', 'grade-a', 'grade-b', 'grade-c'][Math.floor(Math.random() * 4)],
          totalScore: Math.floor(Math.random() * 20) + 80,
          result: ['优秀', '良好', '合格', '不合格'][Math.floor(Math.random() * 4)]
        }
      }))

      return HttpResponse.json(
        wrapResponse(evaluations, '肉质评定数据获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Meat evaluation error:', error)
      return HttpResponse.json(
        wrapError('获取肉质评定数据失败', 500, { type: 'MEAT_EVAL_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 13. 质量标准配置 (for /processing/quality/standards)
  http.get('/api/processing/quality/standards', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const standards = {
        physicalStandards: [
          {
            id: 'ps_001',
            parameter: '水分含量',
            standard: '≤78%',
            tolerance: '±2%',
            testMethod: 'GB/T 9695.15',
            frequency: '每批次'
          },
          {
            id: 'ps_002',
            parameter: '蛋白质含量',
            standard: '≥18%',
            tolerance: '±1%',
            testMethod: 'GB/T 9695.11',
            frequency: '每批次'
          },
          {
            id: 'ps_003',
            parameter: '脂肪含量',
            standard: '2-8%',
            tolerance: '±0.5%',
            testMethod: 'GB/T 9695.7',
            frequency: '每批次'
          },
          {
            id: 'ps_004',
            parameter: 'pH值',
            standard: '5.8-6.2',
            tolerance: '±0.2',
            testMethod: 'GB/T 9695.5',
            frequency: '每2小时'
          }
        ],
        microbiologicalStandards: [
          {
            id: 'ms_001',
            parameter: '菌落总数',
            standard: '≤10^5 CFU/g',
            method: 'GB 4789.2',
            sampleSize: '5个/批次',
            incubationCondition: '36±1°C, 48h'
          },
          {
            id: 'ms_002',
            parameter: '大肠菌群',
            standard: '≤10^2 CFU/g',
            method: 'GB 4789.3',
            sampleSize: '5个/批次',
            incubationCondition: '36±1°C, 24h'
          },
          {
            id: 'ms_003',
            parameter: '沙门氏菌',
            standard: '不得检出/25g',
            method: 'GB 4789.4',
            sampleSize: '5个/批次',
            incubationCondition: '36±1°C, 24h'
          },
          {
            id: 'ms_004',
            parameter: '金黄色葡萄球菌',
            standard: '≤10^2 CFU/g',
            method: 'GB 4789.10',
            sampleSize: '5个/批次',
            incubationCondition: '36±1°C, 48h'
          }
        ],
        additiveStandards: [
          {
            id: 'as_001',
            additive: '亚硝酸钠',
            maxLimit: '30mg/kg',
            testMethod: 'GB 5009.33',
            note: '仅限腌制肉制品'
          },
          {
            id: 'as_002',
            additive: '苯甲酸',
            maxLimit: '1000mg/kg',
            testMethod: 'GB 5009.28',
            note: '以苯甲酸计'
          }
        ]
      }

      return HttpResponse.json(
        wrapResponse(standards, '质量标准获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Quality standards error:', error)
      return HttpResponse.json(
        wrapError('获取质量标准失败', 500, { type: 'STANDARDS_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 14. 班组管理数据 (for /processing/production/teams)
  http.get('/api/processing/production/teams', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const quickData = generateQuickMockData()

      return HttpResponse.json(
        wrapResponse(quickData.teams, '班组管理数据获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Teams error:', error)
      return HttpResponse.json(
        wrapError('获取班组数据失败', 500, { type: 'TEAMS_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 15. 工艺流程数据 (for /processing/production/workflow)
  http.get('/api/processing/production/workflow', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const quickData = generateQuickMockData()

      return HttpResponse.json(
        wrapResponse(quickData.workflows, '工艺流程数据获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Workflow error:', error)
      return HttpResponse.json(
        wrapError('获取工艺流程数据失败', 500, { type: 'WORKFLOW_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 16. 冷链监控数据 (for /processing/storage/cold-chain)
  http.get('/api/processing/storage/cold-chain', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const quickData = generateQuickMockData()

      return HttpResponse.json(
        wrapResponse(quickData.coldChain, '冷链监控数据获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Cold chain error:', error)
      return HttpResponse.json(
        wrapError('获取冷链监控数据失败', 500, { type: 'COLD_CHAIN_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 17. 库存盘点数据 (for /processing/storage/inventory-check)
  http.get('/api/processing/storage/inventory-check', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const quickData = generateQuickMockData()

      return HttpResponse.json(
        wrapResponse(quickData.inventoryChecks, '库存盘点数据获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Inventory check error:', error)
      return HttpResponse.json(
        wrapError('获取库存盘点数据失败', 500, { type: 'INVENTORY_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 18. 质量报告详情 (for /processing/quality/reports/[id]) - 修复404错误
  http.get('/api/processing/quality/reports/:id', async ({ request, params }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const { id } = params as { id: string }

      // 生成详细的质量报告数据
      const reportDetail = {
        id: id,
        reportNumber: `QR-2024-${String(parseInt(id) || 1).padStart(4, '0')}`,
        testDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        productName: ['猪肉制品', '牛肉制品', '鸡肉制品'][Math.floor(Math.random() * 3)],
        batchNumber: `BATCH-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        inspector: ['张质检员', '李质检员', '王质检员'][Math.floor(Math.random() * 3)],
        testType: 'comprehensive',
        overallResult: Math.random() > 0.2 ? 'qualified' : 'unqualified',

        // 物理指标
        physicalTests: [
          {
            parameter: '外观',
            standard: '新鲜、无异味',
            result: '符合标准',
            status: 'pass'
          },
          {
            parameter: '色泽',
            standard: '鲜红色或粉红色',
            result: '鲜红色',
            status: 'pass'
          },
          {
            parameter: '质地',
            standard: '紧实有弹性',
            result: '符合标准',
            status: 'pass'
          }
        ],

        // 化学指标
        chemicalTests: [
          {
            parameter: '蛋白质含量',
            standard: '≥18%',
            result: `${(18 + Math.random() * 5).toFixed(1)}%`,
            status: 'pass'
          },
          {
            parameter: '脂肪含量',
            standard: '2-8%',
            result: `${(2 + Math.random() * 6).toFixed(1)}%`,
            status: 'pass'
          },
          {
            parameter: 'pH值',
            standard: '5.8-6.2',
            result: (5.8 + Math.random() * 0.4).toFixed(2),
            status: 'pass'
          }
        ],

        // 微生物指标
        microbiologicalTests: [
          {
            parameter: '菌落总数',
            standard: '≤10^5 CFU/g',
            result: `${Math.floor(Math.random() * 50000)} CFU/g`,
            status: 'pass'
          },
          {
            parameter: '大肠菌群',
            standard: '≤10^2 CFU/g',
            result: `${Math.floor(Math.random() * 50)} CFU/g`,
            status: 'pass'
          },
          {
            parameter: '沙门氏菌',
            standard: '不得检出/25g',
            result: '未检出',
            status: 'pass'
          }
        ],

        // 重金属指标
        heavyMetalTests: [
          {
            parameter: '铅(Pb)',
            standard: '≤0.2 mg/kg',
            result: `${(Math.random() * 0.1).toFixed(3)} mg/kg`,
            status: 'pass'
          },
          {
            parameter: '镉(Cd)',
            standard: '≤0.1 mg/kg',
            result: `${(Math.random() * 0.05).toFixed(3)} mg/kg`,
            status: 'pass'
          }
        ],

        // 结论和建议
        conclusion: {
          summary: '该批次产品各项指标均符合国家标准要求，质量合格。',
          recommendations: [
            '继续保持现有生产工艺标准',
            '加强原料验收环节管控',
            '定期校准检测设备'
          ],
          approver: '质量部主管',
          approveDate: new Date().toISOString().split('T')[0]
        },

        // 附件信息
        attachments: [
          {
            name: '检测原始数据.xlsx',
            type: 'excel',
            size: '245KB',
            url: '/mock/attachments/test-data.xlsx'
          },
          {
            name: '检测照片.jpg',
            type: 'image',
            size: '1.2MB',
            url: '/mock/attachments/test-photo.jpg'
          }
        ],

        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      }

      return HttpResponse.json(
        wrapResponse(reportDetail, '质量报告详情获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Quality report detail error:', error)
      return HttpResponse.json(
        wrapError('获取质量报告详情失败', 500, { type: 'REPORT_DETAIL_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 19. 生产计划接口 (for /processing/schedule) - 修复404错误
  http.get('/api/processing/schedule', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const url = new URL(request.url)
      const query = parseQuery(url)

      // 生成生产计划数据
      const pageSize = query.pageSize || 10
      const currentPage = query.page || 1
      const schedules = Array.from({length: pageSize}, (_, i) => ({
        id: `schedule_${String(i + 1).padStart(3, '0')}`,
        planNumber: `PLAN-2024-${String(i + 1).padStart(4, '0')}`,
        productName: ['猪肉香肠', '牛肉丸', '鸡肉串'][Math.floor(Math.random() * 3)],
        productionLine: `生产线${String.fromCharCode(65 + Math.floor(Math.random() * 3))}`,
        plannedQuantity: Math.floor(Math.random() * 5000) + 1000,
        actualQuantity: Math.floor(Math.random() * 4800) + 900,
        planDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        startTime: '08:00',
        endTime: '17:00',
        supervisor: ['张班长', '李班长', '王班长'][Math.floor(Math.random() * 3)],
        status: ['planned', 'in-progress', 'completed', 'delayed'][Math.floor(Math.random() * 4)],
        priority: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
        rawMaterialsRequired: [
          {
            material: '猪肉',
            requiredQuantity: Math.floor(Math.random() * 500) + 100,
            unit: 'kg',
            supplier: '牧场A'
          },
          {
            material: '调料包',
            requiredQuantity: Math.floor(Math.random() * 100) + 50,
            unit: '包',
            supplier: '调料厂B'
          }
        ],
        estimatedOutput: Math.floor(Math.random() * 4000) + 1000,
        qualityRequirements: '按照GB标准执行',
        notes: '注意温度控制和卫生标准',
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      }))

      const total = 245 // 模拟总数
      const totalPages = Math.ceil(total / pageSize)

      return HttpResponse.json(
        wrapResponse({
          data: schedules,
          pagination: {
            page: currentPage,
            pageSize: pageSize,
            total,
            totalPages,
            hasNext: currentPage < totalPages,
            hasPrev: currentPage > 1
          }
        }, '生产计划获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Production schedule error:', error)
      return HttpResponse.json(
        wrapError('获取生产计划失败', 500, { type: 'SCHEDULE_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  })
]
