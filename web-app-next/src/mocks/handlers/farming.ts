import { http, HttpResponse } from 'msw'
import { wrapResponse, wrapError } from '../../types/api-response'
import {
  getFieldsList,
  getCropsList,
  getFarmingOverviewStats,
  getPlantingPlansList,
  getFarmActivitiesList,
  getHarvestRecordsList,
  mockFields,
  mockCrops,
  type FarmingQuery
} from '../data/farming-data'
import { validateMockJWT } from '../data/auth-data'
import { getCurrentSchemaVersion } from '../config/middleware'

/**
 * 农业模块 MSW Handlers
 * Day 4上午扩展：完整农业管理系统
 *
 * 包含的API端点：
 * - GET /api/farming/overview - 农业概览统计
 * - GET /api/farming/fields - 田地列表 (支持分页、搜索、过滤)
 * - GET /api/farming/fields/:id - 田地详情
 * - GET /api/farming/crops - 作物列表 (支持分页、搜索、过滤)
 * - GET /api/farming/crops/:id - 作物详情
 * - GET /api/farming/plans - 种植计划列表 (新增)
 * - GET /api/farming/activities - 农事活动列表 (新增)
 * - GET /api/farming/harvests - 收获记录列表 (新增)
 */

// 统一认证检查
const authenticateRequest = (request: Request): { isValid: boolean; user?: any; error?: string } => {
  // 测试环境早退：直接返回mock admin用户
  if (process.env.NODE_ENV === 'test') {
    const mockAdminUser = {
      id: 'user_001',
      username: 'admin',
      role: 'admin',
      permissions: ['farming:read', 'farming:write']
    }
    console.log(`✅ Auth Debug: Farming test env bypass - using mock admin user`)
    return { isValid: true, user: mockAdminUser }
  }

  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return { isValid: false, error: '缺少认证token' }
  }

  const payload = validateMockJWT(token)
  if (!payload) {
    return { isValid: false, error: 'Token无效或已过期' }
  }

  return { isValid: true, user: payload }
}

// 统一响应格式
const createMockHeaders = () => {
  const headers = new Headers()
  headers.set('x-mock-enabled', 'true')
  headers.set('x-mock-version', '1.0.0')
  headers.set('x-api-version', getCurrentSchemaVersion())
  headers.set('x-schema-version', getCurrentSchemaVersion())

  if (process.env.NODE_ENV === 'development') {
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-version')
  }

  return headers
}

const createErrorResponse = (message: string, status: number = 400) => {
  return HttpResponse.json(
    wrapError(message, status),
    {
      status,
      headers: createMockHeaders()
    }
  )
}

const createSuccessResponse = (data: any, message?: string) => {
  return HttpResponse.json(
    wrapResponse(data, message),
    {
      headers: createMockHeaders()
    }
  )
}

export const farmingHandlers = [
  // GET /api/farming/overview - 农业概览统计
  http.get('/api/farming/overview', async ({ request }) => {
    try {
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100))

      const stats = getFarmingOverviewStats()

      return createSuccessResponse({
        ...stats,
        summary: {
          farmingEfficiency: Math.round((stats.activeFields / stats.totalFields) * 100),
          cropDiversity: stats.totalCrops,
          harvestStatus: '秋季收获进行中',
          lastUpdated: new Date().toISOString()
        }
      }, '农业概览获取成功')

    } catch (error) {
      console.error('Farming overview error:', error)
      return createErrorResponse('获取农业概览失败', 500)
    }
  }),

  // GET /api/farming/fields - 田地列表
  http.get('/api/farming/fields', async ({ request }) => {
    try {
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      // 解析查询参数
      const url = new URL(request.url)
      const query: FarmingQuery = {
        page: parseInt(url.searchParams.get('page') || '1'),
        pageSize: parseInt(url.searchParams.get('pageSize') || '10'),
        search: url.searchParams.get('search') || undefined,
        status: url.searchParams.get('status') || undefined,
        sortBy: url.searchParams.get('sortBy') as any || undefined,
        sortOrder: url.searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc'
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 150))

      const result = getFieldsList(query)

      return createSuccessResponse(result, '田地列表获取成功')

    } catch (error) {
      console.error('Farming fields error:', error)
      return createErrorResponse('获取田地列表失败', 500)
    }
  }),

  // GET /api/farming/fields/:id - 田地详情
  http.get('/api/farming/fields/:id', async ({ request, params }) => {
    try {
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      const { id } = params

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100))

      const field = mockFields[id as string]
      if (!field) {
        return createErrorResponse('田地不存在', 404)
      }

      // 获取相关作物信息
      const crop = field.currentCrop ? mockCrops[field.currentCrop] : null

      return createSuccessResponse({
        ...field,
        cropInfo: crop,
        weatherForecast: {
          temperature: Math.floor(Math.random() * 15) + 15,
          humidity: Math.floor(Math.random() * 30) + 50,
          rainfall: Math.random() * 10,
          forecast: '晴朗'
        }
      }, '田地详情获取成功')

    } catch (error) {
      console.error('Farming field detail error:', error)
      return createErrorResponse('获取田地详情失败', 500)
    }
  }),

  // GET /api/farming/crops - 作物列表
  http.get('/api/farming/crops', async ({ request }) => {
    try {
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      // 解析查询参数
      const url = new URL(request.url)
      const query: FarmingQuery = {
        page: parseInt(url.searchParams.get('page') || '1'),
        pageSize: parseInt(url.searchParams.get('pageSize') || '10'),
        search: url.searchParams.get('search') || undefined,
        status: url.searchParams.get('status') || undefined
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 250 + 100))

      const result = getCropsList(query)

      return createSuccessResponse(result, '作物列表获取成功')

    } catch (error) {
      console.error('Farming crops error:', error)
      return createErrorResponse('获取作物列表失败', 500)
    }
  }),

  // GET /api/farming/crops/:id - 作物详情
  http.get('/api/farming/crops/:id', async ({ request, params }) => {
    try {
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      const { id } = params

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100))

      const crop = mockCrops[id as string]
      if (!crop) {
        return createErrorResponse('作物不存在', 404)
      }

      // 获取相关田地信息
      const relatedFields = Object.values(mockFields).filter(field => field.currentCrop === id)

      return createSuccessResponse({
        ...crop,
        relatedFields,
        marketTrends: {
          priceChange: (Math.random() - 0.5) * 0.2, // -10% to +10%
          demandLevel: Math.random() > 0.5 ? 'high' : 'medium',
          recommendation: Math.random() > 0.3 ? '适合种植' : '谨慎考虑'
        }
      }, '作物详情获取成功')

    } catch (error) {
      console.error('Farming crop detail error:', error)
      return createErrorResponse('获取作物详情失败', 500)
    }
  }),

  // GET /api/farming/plans - 种植计划列表 (新增)
  http.get('/api/farming/plans', async ({ request }) => {
    try {
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      // 解析查询参数
      const url = new URL(request.url)
      const query: FarmingQuery = {
        page: parseInt(url.searchParams.get('page') || '1'),
        pageSize: parseInt(url.searchParams.get('pageSize') || '10'),
        fieldId: url.searchParams.get('fieldId') || undefined,
        cropId: url.searchParams.get('cropId') || undefined,
        status: url.searchParams.get('status') || undefined
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 150))

      const result = getPlantingPlansList(query)

      return createSuccessResponse(result, '种植计划列表获取成功')

    } catch (error) {
      console.error('Farming plans error:', error)
      return createErrorResponse('获取种植计划失败', 500)
    }
  }),

  // GET /api/farming/activities - 农事活动列表 (新增)
  http.get('/api/farming/activities', async ({ request }) => {
    try {
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      // 解析查询参数
      const url = new URL(request.url)
      const query: FarmingQuery = {
        page: parseInt(url.searchParams.get('page') || '1'),
        pageSize: parseInt(url.searchParams.get('pageSize') || '10'),
        fieldId: url.searchParams.get('fieldId') || undefined,
        cropId: url.searchParams.get('cropId') || undefined,
        status: url.searchParams.get('status') || undefined,
        dateFrom: url.searchParams.get('dateFrom') || undefined,
        dateTo: url.searchParams.get('dateTo') || undefined
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 350 + 200))

      const result = getFarmActivitiesList(query)

      return createSuccessResponse(result, '农事活动列表获取成功')

    } catch (error) {
      console.error('Farming activities error:', error)
      return createErrorResponse('获取农事活动失败', 500)
    }
  }),

  // GET /api/farming/harvests - 收获记录列表 (新增)
  http.get('/api/farming/harvests', async ({ request }) => {
    try {
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      // 解析查询参数
      const url = new URL(request.url)
      const query: FarmingQuery = {
        page: parseInt(url.searchParams.get('page') || '1'),
        pageSize: parseInt(url.searchParams.get('pageSize') || '10'),
        fieldId: url.searchParams.get('fieldId') || undefined,
        cropId: url.searchParams.get('cropId') || undefined,
        status: url.searchParams.get('status') || undefined
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 150))

      const result = getHarvestRecordsList(query)

      return createSuccessResponse(result, '收获记录列表获取成功')

    } catch (error) {
      console.error('Farming harvests error:', error)
      return createErrorResponse('获取收获记录失败', 500)
    }
  }),

  // POST /api/farming/plans - 创建种植计划
  http.post('/api/farming/plans', async ({ request }) => {
    try {
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      const body = await request.json() as any as any

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 200))

      // 创建新的种植计划
      const newPlan = {
        id: `plan_${Date.now()}`,
        fieldId: body.fieldId,
        cropId: body.cropId,
        plannedDate: body.plannedDate,
        expectedHarvestDate: body.expectedHarvestDate,
        status: 'planned',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      return HttpResponse.json(
        wrapResponse(newPlan, '种植计划创建成功', 201),
        {
          status: 201,
          headers: createMockHeaders()
        }
      )

    } catch (error) {
      console.error('Create farming plan error:', error)
      return createErrorResponse('创建种植计划失败', 500)
    }
  })
]
