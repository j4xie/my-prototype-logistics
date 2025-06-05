/**
 * 物流模块Mock Handler实现
 * 支持仓库管理、运输订单、车辆管理、司机管理、库存追踪的完整API端点
 */

import { http, HttpResponse } from 'msw'
import { wrapResponse, wrapError } from '../../types/api-response'
import {
  getLogisticsOverviewStats,
  getWarehousesList,
  getTransportOrdersList,
  getVehiclesList,
  getDriversList,
  mockWarehouses,
  mockTransportOrders,
  mockVehicles,
  mockDrivers,
  type LogisticsQuery
} from '../data/logistics-data'
import { validateMockJWT, getUserById } from '../data/auth-data'

/**
 * 统一认证检查
 */
const authenticateRequest = (request: Request): { success: boolean; user?: any; error?: string } => {
  // 测试环境早退：直接返回mock admin用户
  if (process.env.NODE_ENV === 'test') {
    const mockAdminUser = {
      id: 'user_001',
      username: 'admin',
      name: 'admin',
      role: 'admin',
      permissions: ['logistics:read', 'logistics:write']
    }
    console.log(`✅ Auth Debug: Logistics test env bypass - using mock admin user`)
    return { success: true, user: mockAdminUser }
  }

  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return { success: false, error: '缺少认证token' }
  }

  const payload = validateMockJWT(token)
  if (!payload) {
    return { success: false, error: 'Token无效或已过期' }
  }

  const user = getUserById(payload.sub)
  if (!user) {
    return { success: false, error: '用户不存在' }
  }

  return { success: true, user }
}

/**
 * 物流模块Handler配置
 */
export const logisticsHandlers = [
  /**
   * 获取物流管理概览统计
   * GET /api/logistics/overview
   */
  http.get('/api/logistics/overview', async ({ request }) => {
    try {
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 350 + 150))

      // JWT认证检查
      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      // 权限检查 - 需要logistics:read权限
      if (!authResult.user.permissions.includes('logistics:read')) {
        return HttpResponse.json(
          wrapError('无权限访问物流数据', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      console.log(`[Mock] 物流概览统计请求 - 用户: ${authResult.user.name}`)

      const stats = getLogisticsOverviewStats()

      // 增加趋势和预警数据
      const enhancedStats = {
        ...stats,
        trends: {
          orderGrowth: '+12.5%',
          deliveryEfficiency: '+8.3%',
          costOptimization: '-5.2%',
          customerSatisfaction: '4.7/5.0'
        },
        alerts: [
          { type: 'warning', message: '3台车辆需要定期保养', count: 3 },
          { type: 'info', message: '5个订单延迟交付', count: 5 },
          { type: 'success', message: '本月准时交付率达98%', count: 0 }
        ],
        recentActivities: [
          {
            time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            action: '新增运输订单',
            details: 'TO-2024-0026 已创建',
            operator: '物流调度员'
          },
          {
            time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            action: '车辆状态更新',
            details: '京A12345 已到达目的地',
            operator: '系统自动'
          },
          {
            time: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
            action: '司机签到',
            details: '张师傅 开始今日班次',
            operator: '张师傅'
          }
        ]
      }

      return HttpResponse.json(
        wrapResponse(enhancedStats, '物流概览数据获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'logistics-overview',
            'X-Mock-Timestamp': new Date().toISOString(),
            'X-Total-Records': String(stats.totalOrders + stats.totalVehicles + stats.totalDrivers)
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 物流概览统计错误:', error)
      return HttpResponse.json(
        wrapError('获取物流概览数据失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  }),

  /**
   * 获取仓库列表
   * GET /api/logistics/warehouses
   */
  http.get('/api/logistics/warehouses', async ({ request }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 200))

      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      if (!authResult.user.permissions.includes('logistics:read')) {
        return HttpResponse.json(
          wrapError('无权限访问仓库数据', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      // 解析查询参数
      const url = new URL(request.url)
      const query: LogisticsQuery = {
        page: parseInt(url.searchParams.get('page') || '1'),
        pageSize: parseInt(url.searchParams.get('pageSize') || '10'),
        search: url.searchParams.get('search') || undefined,
        type: url.searchParams.get('type') || undefined,
        status: url.searchParams.get('status') || undefined,
        city: url.searchParams.get('city') || undefined,
        sortBy: url.searchParams.get('sortBy') || 'name',
        sortOrder: (url.searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc'
      }

      console.log(`[Mock] 仓库列表请求 - 用户: ${authResult.user.name}, 查询:`, query)

      const result = getWarehousesList(query)

      return HttpResponse.json(
        wrapResponse(result, '仓库列表获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'warehouses-list',
            'X-Mock-Timestamp': new Date().toISOString(),
            'X-Total-Records': String(result.pagination.total),
            'X-Current-Page': String(result.pagination.page)
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 仓库列表错误:', error)
      return HttpResponse.json(
        wrapError('获取仓库列表失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  }),

  /**
   * 获取单个仓库详情
   * GET /api/logistics/warehouses/:id
   */
  http.get('/api/logistics/warehouses/:id', async ({ request, params }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100))

      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      if (!authResult.user.permissions.includes('logistics:read')) {
        return HttpResponse.json(
          wrapError('无权限访问仓库详情', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      const warehouseId = params.id as string
      const warehouse = mockWarehouses[warehouseId]

      if (!warehouse) {
        return HttpResponse.json(
          wrapError('仓库不存在', 404, { type: 'NOT_FOUND' }),
          { status: 404 }
        )
      }

      console.log(`[Mock] 仓库详情请求 - 用户: ${authResult.user.name}, 仓库ID: ${warehouseId}`)

      // 增加库存统计和近期活动
      const enhancedWarehouse = {
        ...warehouse,
        inventoryStats: {
          totalSKUs: Math.floor(Math.random() * 500) + 1000,
          totalValue: Math.floor(Math.random() * 1000000) + 5000000,
          inboundToday: Math.floor(Math.random() * 50) + 20,
          outboundToday: Math.floor(Math.random() * 80) + 30,
          turnoverRate: Math.floor(Math.random() * 20) + 65 // 65-85%
        },
        operationStatus: {
          activeStaff: Math.floor(Math.random() * 20) + 15,
          equipmentStatus: {
            forklifts: { total: 8, active: 6, maintenance: 2 },
            conveyors: { total: 4, active: 4, maintenance: 0 },
            scanners: { total: 12, active: 11, maintenance: 1 }
          },
          safetyRecord: {
            daysWithoutIncident: Math.floor(Math.random() * 100) + 150,
            lastSafetyInspection: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        },
        recentActivities: [
          {
            time: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
            activity: '货物入库',
            details: '饲料批次 FB-2024-001 入库完成',
            operator: '仓库作业员A'
          },
          {
            time: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            activity: '库存盘点',
            details: 'A区货架盘点进行中',
            operator: '盘点组'
          }
        ]
      }

      return HttpResponse.json(
        wrapResponse(enhancedWarehouse, '仓库详情获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'warehouse-detail',
            'X-Mock-Timestamp': new Date().toISOString(),
            'X-Warehouse-Code': warehouse.code
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 仓库详情错误:', error)
      return HttpResponse.json(
        wrapError('获取仓库详情失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  }),

  /**
   * 获取运输订单列表
   * GET /api/logistics/orders
   */
  http.get('/api/logistics/orders', async ({ request }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 450 + 200))

      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      if (!authResult.user.permissions.includes('logistics:read')) {
        return HttpResponse.json(
          wrapError('无权限访问运输订单', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      const url = new URL(request.url)
      const query: LogisticsQuery = {
        page: parseInt(url.searchParams.get('page') || '1'),
        pageSize: parseInt(url.searchParams.get('pageSize') || '10'),
        search: url.searchParams.get('search') || undefined,
        type: url.searchParams.get('type') || undefined,
        status: url.searchParams.get('status') || undefined,
        priority: url.searchParams.get('priority') || undefined,
        dateFrom: url.searchParams.get('dateFrom') || undefined,
        dateTo: url.searchParams.get('dateTo') || undefined,
        sortBy: url.searchParams.get('sortBy') || 'createdAt',
        sortOrder: (url.searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
      }

      console.log(`[Mock] 运输订单列表请求 - 用户: ${authResult.user.name}, 查询:`, query)

      const result = getTransportOrdersList(query)

      return HttpResponse.json(
        wrapResponse(result, '运输订单列表获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'transport-orders-list',
            'X-Mock-Timestamp': new Date().toISOString(),
            'X-Total-Records': String(result.pagination.total),
            'X-Current-Page': String(result.pagination.page)
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 运输订单列表错误:', error)
      return HttpResponse.json(
        wrapError('获取运输订单列表失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  }),

  /**
   * 获取单个运输订单详情
   * GET /api/logistics/orders/:id
   */
  http.get('/api/logistics/orders/:id', async ({ request, params }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 150))

      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      if (!authResult.user.permissions.includes('logistics:read')) {
        return HttpResponse.json(
          wrapError('无权限访问订单详情', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      const orderId = params.id as string
      const order = mockTransportOrders.find(o => o.id === orderId)

      if (!order) {
        return HttpResponse.json(
          wrapError('运输订单不存在', 404, { type: 'NOT_FOUND' }),
          { status: 404 }
        )
      }

      console.log(`[Mock] 运输订单详情请求 - 用户: ${authResult.user.name}, 订单ID: ${orderId}`)

      // 增加详细跟踪信息和风险评估
      const enhancedOrder = {
        ...order,
        riskAssessment: {
          weatherRisk: Math.random() > 0.7 ? 'high' : 'low',
          trafficRisk: Math.random() > 0.6 ? 'medium' : 'low',
          securityRisk: 'low',
          delayProbability: Math.floor(Math.random() * 30) + 5, // 5-35%
          recommendations: [
            '建议关注天气预报',
            '提前规划避堵路线',
            '确保货物安全包装'
          ]
        },
        performance: {
          onTimeRate: Math.floor(Math.random() * 20) + 80, // 80-100%
          fuelEfficiency: Math.floor(Math.random() * 5) + 12, // 12-17L/100km
          customerRating: Math.floor(Math.random() * 10) / 10 + 4.0, // 4.0-4.9
          costPerKm: Math.floor(Math.random() * 2) + 3 // 3-5元/km
        },
        relatedOrders: mockTransportOrders
          .filter(o => o.id !== orderId && o.customer.id === order.customer.id)
          .slice(0, 3)
          .map(o => ({
            id: o.id,
            orderNumber: o.orderNumber,
            status: o.status,
            createdAt: o.createdAt
          }))
      }

      return HttpResponse.json(
        wrapResponse(enhancedOrder, '运输订单详情获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'transport-order-detail',
            'X-Mock-Timestamp': new Date().toISOString(),
            'X-Order-Number': order.orderNumber
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 运输订单详情错误:', error)
      return HttpResponse.json(
        wrapError('获取运输订单详情失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  }),

  /**
   * 获取车辆列表
   * GET /api/logistics/vehicles
   */
  http.get('/api/logistics/vehicles', async ({ request }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 150))

      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      if (!authResult.user.permissions.includes('logistics:read')) {
        return HttpResponse.json(
          wrapError('无权限访问车辆数据', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      const url = new URL(request.url)
      const query: LogisticsQuery = {
        page: parseInt(url.searchParams.get('page') || '1'),
        pageSize: parseInt(url.searchParams.get('pageSize') || '10'),
        search: url.searchParams.get('search') || undefined,
        type: url.searchParams.get('type') || undefined,
        status: url.searchParams.get('status') || undefined,
        sortBy: url.searchParams.get('sortBy') || 'vehicleNumber',
        sortOrder: (url.searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc'
      }

      console.log(`[Mock] 车辆列表请求 - 用户: ${authResult.user.name}, 查询:`, query)

      const result = getVehiclesList(query)

      return HttpResponse.json(
        wrapResponse(result, '车辆列表获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'vehicles-list',
            'X-Mock-Timestamp': new Date().toISOString(),
            'X-Total-Records': String(result.pagination.total),
            'X-Current-Page': String(result.pagination.page)
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 车辆列表错误:', error)
      return HttpResponse.json(
        wrapError('获取车辆列表失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  }),

  /**
   * 获取单个车辆详情
   * GET /api/logistics/vehicles/:id
   */
  http.get('/api/logistics/vehicles/:id', async ({ request, params }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 350 + 100))

      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      if (!authResult.user.permissions.includes('logistics:read')) {
        return HttpResponse.json(
          wrapError('无权限访问车辆详情', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      const vehicleId = params.id as string
      const vehicle = mockVehicles.find(v => v.id === vehicleId)

      if (!vehicle) {
        return HttpResponse.json(
          wrapError('车辆不存在', 404, { type: 'NOT_FOUND' }),
          { status: 404 }
        )
      }

      console.log(`[Mock] 车辆详情请求 - 用户: ${authResult.user.name}, 车辆ID: ${vehicleId}`)

      // 增加实时状态和历史记录
      const enhancedVehicle = {
        ...vehicle,
        realTimeStatus: {
          speed: vehicle.status === 'in-use' ? Math.floor(Math.random() * 40) + 40 : 0, // 40-80 km/h
          fuelLevel: Math.floor(Math.random() * 60) + 40, // 40-100%
          engineTemp: Math.floor(Math.random() * 20) + 85, // 85-105°C
          tirePressure: {
            front: Math.floor(Math.random() * 20) + 220, // 220-240 kPa
            rear: Math.floor(Math.random() * 20) + 220
          },
          lastSignal: new Date().toISOString()
        },
        utilizationStats: {
          thisMonth: {
            totalKm: Math.floor(Math.random() * 3000) + 2000,
            totalHours: Math.floor(Math.random() * 200) + 150,
            totalTrips: Math.floor(Math.random() * 50) + 30,
            fuelConsumed: Math.floor(Math.random() * 500) + 300 // 升
          },
          efficiency: {
            avgFuelConsumption: Math.floor(Math.random() * 5) + 12, // L/100km
            avgSpeed: Math.floor(Math.random() * 15) + 55, // km/h
            utilizationRate: Math.floor(Math.random() * 30) + 70 // 70-100%
          }
        },
        upcomingMaintenance: [
          {
            type: '定期保养',
            dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            dueMileage: vehicle.maintenance.mileage + 5000,
            priority: 'normal'
          },
          {
            type: '年检',
            dueDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            priority: 'high'
          }
        ]
      }

      return HttpResponse.json(
        wrapResponse(enhancedVehicle, '车辆详情获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'vehicle-detail',
            'X-Mock-Timestamp': new Date().toISOString(),
            'X-Vehicle-Number': vehicle.vehicleNumber
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 车辆详情错误:', error)
      return HttpResponse.json(
        wrapError('获取车辆详情失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  }),

  /**
   * 获取司机列表
   * GET /api/logistics/drivers
   */
  http.get('/api/logistics/drivers', async ({ request }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 180))

      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      if (!authResult.user.permissions.includes('logistics:read')) {
        return HttpResponse.json(
          wrapError('无权限访问司机数据', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      const url = new URL(request.url)
      const query: LogisticsQuery = {
        page: parseInt(url.searchParams.get('page') || '1'),
        pageSize: parseInt(url.searchParams.get('pageSize') || '10'),
        search: url.searchParams.get('search') || undefined,
        status: url.searchParams.get('status') || undefined,
        sortBy: url.searchParams.get('sortBy') || 'name',
        sortOrder: (url.searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc'
      }

      console.log(`[Mock] 司机列表请求 - 用户: ${authResult.user.name}, 查询:`, query)

      const result = getDriversList(query)

      return HttpResponse.json(
        wrapResponse(result, '司机列表获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'drivers-list',
            'X-Mock-Timestamp': new Date().toISOString(),
            'X-Total-Records': String(result.pagination.total),
            'X-Current-Page': String(result.pagination.page)
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 司机列表错误:', error)
      return HttpResponse.json(
        wrapError('获取司机列表失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  }),

  /**
   * 获取单个司机详情
   * GET /api/logistics/drivers/:id
   */
  http.get('/api/logistics/drivers/:id', async ({ request, params }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 120))

      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      if (!authResult.user.permissions.includes('logistics:read')) {
        return HttpResponse.json(
          wrapError('无权限访问司机详情', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      const driverId = params.id as string
      const driver = mockDrivers.find(d => d.id === driverId)

      if (!driver) {
        return HttpResponse.json(
          wrapError('司机不存在', 404, { type: 'NOT_FOUND' }),
          { status: 404 }
        )
      }

      console.log(`[Mock] 司机详情请求 - 用户: ${authResult.user.name}, 司机ID: ${driverId}`)

      // 增加工作状态和绩效分析
      const enhancedDriver = {
        ...driver,
        currentStatus: {
          location: driver.currentAssignment ? {
            latitude: 39.9042 + Math.random() * 2,
            longitude: 116.4074 + Math.random() * 2,
            address: '运输途中',
            timestamp: new Date().toISOString()
          } : {
            latitude: 39.9042,
            longitude: 116.4074,
            address: '公司驻地',
            timestamp: new Date().toISOString()
          },
          workStatus: driver.status,
          drivingHours: Math.floor(Math.random() * 8) + 2, // 今日驾驶小时数
          breakTime: Math.floor(Math.random() * 60) + 30 // 休息时间(分钟)
        },
        monthlyPerformance: {
          totalTrips: Math.floor(Math.random() * 30) + 20,
          totalDistance: Math.floor(Math.random() * 5000) + 3000,
          onTimeRate: Math.floor(Math.random() * 15) + 85, // 85-100%
          fuelEfficiency: Math.floor(Math.random() * 5) + 12, // L/100km
          safetyIncidents: Math.floor(Math.random() * 2), // 0-1
          customerComplaints: Math.floor(Math.random() * 2) // 0-1
        },
        upcomingSchedule: [
          {
            date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            shift: '08:00-18:00',
            assignment: '待分配',
            route: '待确定'
          },
          {
            date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            shift: '08:00-18:00',
            assignment: '长途运输',
            route: '北京-上海'
          }
        ],
        certificationStatus: {
          licenseExpiry: driver.license.expiryDate,
          certificationExpiry: driver.certifications[0]?.expiryDate,
          healthCheckDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          trainingDue: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      }

      return HttpResponse.json(
        wrapResponse(enhancedDriver, '司机详情获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'driver-detail',
            'X-Mock-Timestamp': new Date().toISOString(),
            'X-Driver-Employee-Id': driver.employeeId
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 司机详情错误:', error)
      return HttpResponse.json(
        wrapError('获取司机详情失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  })
]

console.log(`[Mock] 物流模块Handler初始化完成 - 共${logisticsHandlers.length}个API端点`)
