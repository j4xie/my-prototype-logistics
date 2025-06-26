/**
 * 销售模块Mock API处理器
 * TASK-P3-025扩展：为销售管理4个新页面提供完整数据支撑
 * 页面列表：客户管理、订单管理、销售报表、定价管理
 */

import { http, HttpResponse } from 'msw'
import { wrapResponse, wrapError } from '../../types/api-response'

/**
 * 统一认证检查
 */
function authenticateRequest(request: Request): { success: boolean; error?: any } {
  // 测试环境早退：直接返回成功
  if (process.env.NODE_ENV === 'test') {
    console.log(`✅ Auth Debug: Sales test env bypass - authentication skipped`)
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
    'X-Mock-API': 'sales-module',
    'X-API-Version': '1.0'
  }
}

/**
 * 网络延迟模拟
 */
function createNetworkDelay() {
  return new Promise(resolve => setTimeout(resolve, Math.random() * 350 + 150)) // 150-500ms
}

/**
 * TASK-P3-025销售管理数据生成器
 */
function generateSalesData() {
  // 客户数据
  const customers = Array.from({length: 25}, (_, i) => ({
    id: `customer_${String(i + 1).padStart(3, '0')}`,
    customerName: [
      '优质食品有限公司', '绿色餐饮连锁', '新鲜超市', '便民小店', '高端酒店',
      '学校食堂', '企业餐厅', '社区超市', '批发市场', '出口贸易公司'
    ][Math.floor(Math.random() * 10)],
    customerType: ['wholesale', 'retail', 'restaurant', 'export'][Math.floor(Math.random() * 4)],
    contactPerson: `联系人${i + 1}`,
    phone: `138${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
    email: `customer${i + 1}@example.com`,
    address: `城市${Math.floor(Math.random() * 10) + 1}号地址${i + 1}`,
    creditLevel: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
    totalPurchases: Math.floor(Math.random() * 500000) + 50000,
    lastOrderDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: ['active', 'inactive', 'suspended'][Math.floor(Math.random() * 3)],
    registrationDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }))

  // 订单数据
  const orders = Array.from({length: 40}, (_, i) => ({
    id: `order_${String(i + 1).padStart(3, '0')}`,
    orderNumber: `SO-2024-${String(i + 1).padStart(4, '0')}`,
    customerId: customers[Math.floor(Math.random() * customers.length)].id,
    customerName: customers[Math.floor(Math.random() * customers.length)].customerName,
    orderDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    deliveryDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: ['pending', 'confirmed', 'in-production', 'shipped', 'delivered', 'cancelled'][Math.floor(Math.random() * 6)],
    totalAmount: Math.floor(Math.random() * 50000) + 5000,
    items: [
      {
        productId: `prod_${String(Math.floor(Math.random() * 20) + 1).padStart(3, '0')}`,
        productName: ['冷鲜猪肉', '冷冻牛肉', '鸡胸肉', '羊肉卷'][Math.floor(Math.random() * 4)],
        quantity: Math.floor(Math.random() * 100) + 10,
        unit: 'kg',
        unitPrice: Math.floor(Math.random() * 50) + 20,
        subtotal: Math.floor(Math.random() * 5000) + 500
      }
    ],
    paymentStatus: ['unpaid', 'partial', 'paid'][Math.floor(Math.random() * 3)],
    salesPerson: ['小张', '小李', '小王', '小赵'][Math.floor(Math.random() * 4)]
  }))

  // 销售报表数据
  const salesReports = {
    dailyReports: Array.from({length: 30}, (_, i) => ({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totalSales: Math.floor(Math.random() * 100000) + 20000,
      orderCount: Math.floor(Math.random() * 50) + 10,
      customerCount: Math.floor(Math.random() * 20) + 5,
      averageOrderValue: Math.floor(Math.random() * 5000) + 1000
    })),
    monthlyReports: Array.from({length: 12}, (_, i) => ({
      month: `2024-${String(12 - i).padStart(2, '0')}`,
      totalSales: Math.floor(Math.random() * 1000000) + 500000,
      orderCount: Math.floor(Math.random() * 500) + 200,
      customerCount: Math.floor(Math.random() * 100) + 50,
      growthRate: Math.round((Math.random() * 40 - 20) * 10) / 10 // -20% to 20%
    })),
    productReports: Array.from({length: 10}, (_, i) => ({
      productName: ['冷鲜猪肉', '冷冻牛肉', '鸡胸肉', '羊肉卷', '香肠', '火腿', '培根', '牛排', '鸡翅', '排骨'][i],
      salesVolume: Math.floor(Math.random() * 10000) + 1000,
      salesAmount: Math.floor(Math.random() * 500000) + 50000,
      profit: Math.floor(Math.random() * 100000) + 10000,
      profitMargin: Math.round((Math.random() * 30 + 10) * 10) / 10 // 10-40%
    }))
  }

  // 定价数据
  const pricing = Array.from({length: 20}, (_, i) => ({
    id: `price_${String(i + 1).padStart(3, '0')}`,
    productId: `prod_${String(i + 1).padStart(3, '0')}`,
    productName: ['冷鲜猪肉', '冷冻牛肉', '鸡胸肉', '羊肉卷', '香肠'][Math.floor(Math.random() * 5)],
    basePrice: Math.floor(Math.random() * 50) + 20,
    customerTierPricing: {
      wholesale: Math.floor(Math.random() * 50) + 15, // 批发价
      retail: Math.floor(Math.random() * 50) + 25,    // 零售价
      vip: Math.floor(Math.random() * 50) + 20        // VIP价
    },
    seasonalAdjustment: Math.round((Math.random() * 20 - 10) * 10) / 10, // -10% to 10%
    promotionPrice: Math.floor(Math.random() * 40) + 10,
    effectiveDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: ['active', 'inactive', 'pending'][Math.floor(Math.random() * 3)]
  }))

  return {
    customers,
    orders,
    salesReports,
    pricing
  }
}

export const salesHandlers = [
  // 1. 销售模块总览 (for /processing/sales/overview)
  http.get('/api/sales/overview', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const salesData = generateSalesData()

      const overview = {
        summary: {
          totalCustomers: salesData.customers.length,
          activeCustomers: salesData.customers.filter(c => c.status === 'active').length,
          totalOrders: salesData.orders.length,
          pendingOrders: salesData.orders.filter(o => o.status === 'pending').length,
          totalSales: salesData.orders.reduce((sum, o) => sum + o.totalAmount, 0),
          averageOrderValue: Math.round(salesData.orders.reduce((sum, o) => sum + o.totalAmount, 0) / salesData.orders.length)
        },
        trends: {
          salesGrowth: '+15%',
          customerGrowth: '+8%',
          orderGrowth: '+12%'
        },
        topProducts: salesData.salesReports.productReports.slice(0, 5),
        recentOrders: salesData.orders.slice(0, 10),
        alerts: {
          lowStockProducts: 3,
          overduePayments: 5,
          expiredPricing: 2
        }
      }

      return HttpResponse.json(
        wrapResponse(overview, '销售概览数据获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Sales overview error:', error)
      return HttpResponse.json(
        wrapError('获取销售概览数据失败', 500, { type: 'SALES_OVERVIEW_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 2. 客户管理 (for /processing/sales/customers)
  http.get('/api/sales/customers', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const url = new URL(request.url)
      const page = parseInt(url.searchParams.get('page') || '1')
      const pageSize = parseInt(url.searchParams.get('pageSize') || '10')
      const search = url.searchParams.get('search') || ''
      const customerType = url.searchParams.get('customerType') || ''
      const status = url.searchParams.get('status') || ''

      const salesData = generateSalesData()
      let filteredCustomers = salesData.customers

      // 筛选逻辑
      if (search) {
        filteredCustomers = filteredCustomers.filter(c =>
          c.customerName.includes(search) ||
          c.contactPerson.includes(search) ||
          c.phone.includes(search)
        )
      }
      if (customerType) {
        filteredCustomers = filteredCustomers.filter(c => c.customerType === customerType)
      }
      if (status) {
        filteredCustomers = filteredCustomers.filter(c => c.status === status)
      }

      // 分页
      const total = filteredCustomers.length
      const startIndex = (page - 1) * pageSize
      const endIndex = startIndex + pageSize
      const customers = filteredCustomers.slice(startIndex, endIndex)

      const responseData = {
        customers,
        pagination: {
          current: page,
          pageSize,
          total,
          pages: Math.ceil(total / pageSize)
        },
        filters: {
          customerTypes: ['wholesale', 'retail', 'restaurant', 'export'],
          statuses: ['active', 'inactive', 'suspended'],
          creditLevels: ['A', 'B', 'C']
        }
      }

      return HttpResponse.json(
        wrapResponse(responseData, `成功获取客户列表，共 ${total} 条记录`, 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Customers error:', error)
      return HttpResponse.json(
        wrapError('获取客户列表失败', 500, { type: 'CUSTOMERS_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 3. 客户详情 (for /processing/sales/customers/:id)
  http.get('/api/sales/customers/:id', async ({ request, params }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const { id } = params
      const salesData = generateSalesData()
      const customer = salesData.customers.find(c => c.id === id)

      if (!customer) {
        return HttpResponse.json(
          wrapError('客户不存在', 404, { type: 'CUSTOMER_NOT_FOUND' }),
          {
            status: 404,
            headers: createMockHeaders()
          }
        )
      }

      // 扩展客户详情
      const extendedCustomer = {
        ...customer,
        orderHistory: salesData.orders.filter(o => o.customerId === id).slice(0, 10),
        paymentHistory: Array.from({length: 5}, (_, i) => ({
          id: `payment_${i + 1}`,
          orderNumber: `SO-2024-${String(Math.floor(Math.random() * 1000)).padStart(4, '0')}`,
          amount: Math.floor(Math.random() * 20000) + 5000,
          paymentDate: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          paymentMethod: ['银行转账', '现金', '支票', '在线支付'][Math.floor(Math.random() * 4)],
          status: 'completed'
        })),
        analytics: {
          totalOrders: Math.floor(Math.random() * 50) + 10,
          averageOrderValue: Math.floor(Math.random() * 10000) + 5000,
          totalSpent: Math.floor(Math.random() * 500000) + 100000,
          lastOrderDays: Math.floor(Math.random() * 30) + 1
        }
      }

      return HttpResponse.json(
        wrapResponse(extendedCustomer, '客户详情获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Customer detail error:', error)
      return HttpResponse.json(
        wrapError('获取客户详情失败', 500, { type: 'CUSTOMER_DETAIL_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 4. 订单管理 (for /processing/sales/orders)
  http.get('/api/sales/orders', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const url = new URL(request.url)
      const page = parseInt(url.searchParams.get('page') || '1')
      const pageSize = parseInt(url.searchParams.get('pageSize') || '10')
      const search = url.searchParams.get('search') || ''
      const status = url.searchParams.get('status') || ''
      const dateFrom = url.searchParams.get('dateFrom') || ''
      const dateTo = url.searchParams.get('dateTo') || ''

      const salesData = generateSalesData()
      let filteredOrders = salesData.orders

      // 筛选逻辑
      if (search) {
        filteredOrders = filteredOrders.filter(o =>
          o.orderNumber.includes(search) ||
          o.customerName.includes(search) ||
          o.salesPerson.includes(search)
        )
      }
      if (status) {
        filteredOrders = filteredOrders.filter(o => o.status === status)
      }
      if (dateFrom) {
        filteredOrders = filteredOrders.filter(o => o.orderDate >= dateFrom)
      }
      if (dateTo) {
        filteredOrders = filteredOrders.filter(o => o.orderDate <= dateTo)
      }

      // 分页
      const total = filteredOrders.length
      const startIndex = (page - 1) * pageSize
      const endIndex = startIndex + pageSize
      const orders = filteredOrders.slice(startIndex, endIndex)

      const responseData = {
        orders,
        pagination: {
          current: page,
          pageSize,
          total,
          pages: Math.ceil(total / pageSize)
        },
        filters: {
          statuses: ['pending', 'confirmed', 'in-production', 'shipped', 'delivered', 'cancelled'],
          paymentStatuses: ['unpaid', 'partial', 'paid'],
          salesPersons: ['小张', '小李', '小王', '小赵']
        },
        summary: {
          totalOrders: salesData.orders.length,
          pendingOrders: salesData.orders.filter(o => o.status === 'pending').length,
          totalValue: salesData.orders.reduce((sum, o) => sum + o.totalAmount, 0),
          averageValue: Math.round(salesData.orders.reduce((sum, o) => sum + o.totalAmount, 0) / salesData.orders.length)
        }
      }

      return HttpResponse.json(
        wrapResponse(responseData, `成功获取订单列表，共 ${total} 条记录`, 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Orders error:', error)
      return HttpResponse.json(
        wrapError('获取订单列表失败', 500, { type: 'ORDERS_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 5. 订单详情 (for /processing/sales/orders/:id)
  http.get('/api/sales/orders/:id', async ({ request, params }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const { id } = params
      const salesData = generateSalesData()
      const order = salesData.orders.find(o => o.id === id)

      if (!order) {
        return HttpResponse.json(
          wrapError('订单不存在', 404, { type: 'ORDER_NOT_FOUND' }),
          {
            status: 404,
            headers: createMockHeaders()
          }
        )
      }

      // 扩展订单详情
      const extendedOrder = {
        ...order,
        customer: salesData.customers.find(c => c.id === order.customerId),
        logistics: {
          shippingMethod: '冷链配送',
          trackingNumber: `TRK-${String(Math.floor(Math.random() * 100000)).padStart(8, '0')}`,
          estimatedDelivery: order.deliveryDate,
          shippingCost: Math.floor(Math.random() * 500) + 100,
          carrier: '冷链物流有限公司'
        },
        production: {
          batchId: `batch_${String(Math.floor(Math.random() * 100)).padStart(3, '0')}`,
          productionDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          qualityCheck: '已通过',
          packagingDate: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        timeline: [
          {
            stage: '订单创建',
            status: 'completed',
            date: order.orderDate,
            operator: order.salesPerson
          },
          {
            stage: '订单确认',
            status: order.status === 'pending' ? 'pending' : 'completed',
            date: order.status !== 'pending' ? order.orderDate : null,
            operator: order.status !== 'pending' ? '销售经理' : null
          },
          {
            stage: '生产安排',
            status: ['in-production', 'shipped', 'delivered'].includes(order.status) ? 'completed' : 'pending',
            date: ['in-production', 'shipped', 'delivered'].includes(order.status) ? order.orderDate : null,
            operator: ['in-production', 'shipped', 'delivered'].includes(order.status) ? '生产调度' : null
          },
          {
            stage: '质量检验',
            status: ['shipped', 'delivered'].includes(order.status) ? 'completed' : 'pending',
            date: ['shipped', 'delivered'].includes(order.status) ? order.orderDate : null,
            operator: ['shipped', 'delivered'].includes(order.status) ? '质检员' : null
          },
          {
            stage: '发货配送',
            status: order.status === 'delivered' ? 'completed' : order.status === 'shipped' ? 'in-progress' : 'pending',
            date: ['shipped', 'delivered'].includes(order.status) ? order.orderDate : null,
            operator: ['shipped', 'delivered'].includes(order.status) ? '物流员' : null
          }
        ]
      }

      return HttpResponse.json(
        wrapResponse(extendedOrder, '订单详情获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Order detail error:', error)
      return HttpResponse.json(
        wrapError('获取订单详情失败', 500, { type: 'ORDER_DETAIL_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 6. 销售报表 (for /processing/sales/reports)
  http.get('/api/sales/reports', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const url = new URL(request.url)
      const reportType = url.searchParams.get('type') || 'daily'
      const dateFrom = url.searchParams.get('dateFrom') || ''
      const dateTo = url.searchParams.get('dateTo') || ''

      const salesData = generateSalesData()

      let reportData
      switch (reportType) {
        case 'daily':
          reportData = salesData.salesReports.dailyReports
          break
        case 'monthly':
          reportData = salesData.salesReports.monthlyReports
          break
        case 'product':
          reportData = salesData.salesReports.productReports
          break
        default:
          reportData = salesData.salesReports.dailyReports
      }

            // 日期筛选
      if (dateFrom && reportType === 'daily') {
        reportData = reportData.filter((r: any) => r.date >= dateFrom)
      }
      if (dateTo && reportType === 'daily') {
        reportData = reportData.filter((r: any) => r.date <= dateTo)
      }

      const summary = {
        totalSales: reportData.reduce((sum: number, r: any) => sum + (r.totalSales || r.salesAmount || 0), 0),
        totalOrders: reportData.reduce((sum: number, r: any) => sum + (r.orderCount || 0), 0),
        averageOrderValue: reportData.length > 0 ?
          Math.round(reportData.reduce((sum: number, r: any) => sum + (r.averageOrderValue || r.totalSales / Math.max(r.orderCount, 1) || 0), 0) / reportData.length) : 0,
        topPerformer: reportType === 'product' ?
          (reportData as any[]).sort((a: any, b: any) => (b.salesAmount || 0) - (a.salesAmount || 0))[0]?.productName : null
      }

      return HttpResponse.json(
        wrapResponse({ data: reportData, summary, type: reportType }, '销售报表获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Sales reports error:', error)
      return HttpResponse.json(
        wrapError('获取销售报表失败', 500, { type: 'REPORTS_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 7. 定价管理 (for /processing/sales/pricing)
  http.get('/api/sales/pricing', async ({ request }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const url = new URL(request.url)
      const page = parseInt(url.searchParams.get('page') || '1')
      const pageSize = parseInt(url.searchParams.get('pageSize') || '10')
      const search = url.searchParams.get('search') || ''
      const status = url.searchParams.get('status') || ''

      const salesData = generateSalesData()
      let filteredPricing = salesData.pricing

      // 筛选逻辑
      if (search) {
        filteredPricing = filteredPricing.filter(p =>
          p.productName.includes(search) ||
          p.productId.includes(search)
        )
      }
      if (status) {
        filteredPricing = filteredPricing.filter(p => p.status === status)
      }

      // 分页
      const total = filteredPricing.length
      const startIndex = (page - 1) * pageSize
      const endIndex = startIndex + pageSize
      const pricing = filteredPricing.slice(startIndex, endIndex)

      const responseData = {
        pricing,
        pagination: {
          current: page,
          pageSize,
          total,
          pages: Math.ceil(total / pageSize)
        },
        filters: {
          statuses: ['active', 'inactive', 'pending']
        },
        summary: {
          totalProducts: salesData.pricing.length,
          activeProducts: salesData.pricing.filter(p => p.status === 'active').length,
          averagePrice: Math.round(salesData.pricing.reduce((sum, p) => sum + p.basePrice, 0) / salesData.pricing.length * 100) / 100,
          expiringSoon: salesData.pricing.filter(p => {
            const expiryDate = new Date(p.expiryDate)
            const today = new Date()
            const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            return diffDays <= 7 && diffDays > 0
          }).length
        }
      }

      return HttpResponse.json(
        wrapResponse(responseData, `成功获取定价列表，共 ${total} 条记录`, 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Pricing error:', error)
      return HttpResponse.json(
        wrapError('获取定价列表失败', 500, { type: 'PRICING_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  }),

  // 8. 定价详情 (for /processing/sales/pricing/:id)
  http.get('/api/sales/pricing/:id', async ({ request, params }) => {
    await createNetworkDelay()

    const auth = authenticateRequest(request)
    if (!auth.success) return auth.error

    try {
      const { id } = params
      const salesData = generateSalesData()
      const priceItem = salesData.pricing.find(p => p.id === id)

      if (!priceItem) {
        return HttpResponse.json(
          wrapError('定价记录不存在', 404, { type: 'PRICING_NOT_FOUND' }),
          {
            status: 404,
            headers: createMockHeaders()
          }
        )
      }

      // 扩展定价详情
      const extendedPricing = {
        ...priceItem,
        priceHistory: Array.from({length: 6}, (_, i) => ({
          id: `history_${i + 1}`,
          effectiveDate: new Date(Date.now() - (i + 1) * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          basePrice: Math.floor(Math.random() * 50) + 15,
          reason: ['市场调整', '成本变化', '促销活动', '季节调整'][Math.floor(Math.random() * 4)],
          operator: ['定价经理', '销售总监'][Math.floor(Math.random() * 2)]
        })),
        competitorPricing: [
          {
            competitor: '竞争对手A',
            price: priceItem.basePrice * (0.9 + Math.random() * 0.2),
            lastUpdated: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          },
          {
            competitor: '竞争对手B',
            price: priceItem.basePrice * (0.85 + Math.random() * 0.3),
            lastUpdated: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        ],
        salesImpact: {
          totalSales: Math.floor(Math.random() * 100000) + 50000,
          unitsSold: Math.floor(Math.random() * 1000) + 500,
          revenueImpact: Math.round((Math.random() * 20 - 10) * 100) / 100 // -10% to 10%
        }
      }

      return HttpResponse.json(
        wrapResponse(extendedPricing, '定价详情获取成功', 200),
        {
          headers: createMockHeaders()
        }
      )
    } catch (error) {
      console.error('Pricing detail error:', error)
      return HttpResponse.json(
        wrapError('获取定价详情失败', 500, { type: 'PRICING_DETAIL_ERROR' }),
        {
          status: 500,
          headers: createMockHeaders()
        }
      )
    }
  })
]
