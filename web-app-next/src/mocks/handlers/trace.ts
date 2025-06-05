import { http, HttpResponse } from 'msw'
import { wrapResponse, wrapError } from '../../types/api-response'

/**
 * 溯源模块 MSW Handlers
 * 解决P0问题：业务API缺失 /api/trace/{id} → 404
 *
 * 基于TASK-P3-018B契约修复
 */

// 模拟溯源数据
const mockTraceData = [
  {
    id: '12345', // 添加测试用ID
    productName: '测试产品',
    batchId: 'batch_test_001',
    status: 'completed',
    traceId: '12345', // 添加traceId字段以匹配测试期望
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-12-01T10:30:00Z',
    stages: [
      {
        id: 'stage_test_001',
        name: '测试阶段',
        status: 'completed',
        startDate: '2024-01-15T08:00:00Z',
        endDate: '2024-05-20T18:00:00Z',
        location: '测试地点',
        responsible: '测试负责人',
        details: '这是用于测试的溯源数据'
      }
    ]
  },
  {
    id: 'trace_001',
    productName: '有机大米',
    batchId: 'batch_2024_001',
    status: 'completed',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-12-01T10:30:00Z',
    stages: [
      {
        id: 'stage_001',
        name: '种植',
        status: 'completed',
        startDate: '2024-01-15T08:00:00Z',
        endDate: '2024-05-20T18:00:00Z',
        location: '黑龙江省哈尔滨市',
        responsible: '张农夫',
        details: '有机种植，无农药化肥使用'
      },
      {
        id: 'stage_002',
        name: '收获',
        status: 'completed',
        startDate: '2024-05-21T06:00:00Z',
        endDate: '2024-05-25T20:00:00Z',
        location: '黑龙江省哈尔滨市',
        responsible: '李收获',
        details: '机械收获，品质检测合格'
      },
      {
        id: 'stage_003',
        name: '加工',
        status: 'completed',
        startDate: '2024-05-26T08:00:00Z',
        endDate: '2024-06-01T17:00:00Z',
        location: '黑龙江省加工厂',
        responsible: '王加工',
        details: '清洗、烘干、包装，符合食品安全标准'
      },
      {
        id: 'stage_004',
        name: '物流',
        status: 'completed',
        startDate: '2024-06-02T09:00:00Z',
        endDate: '2024-06-05T16:00:00Z',
        location: '冷链运输',
        responsible: '刘物流',
        details: '全程冷链运输，温度控制在0-4°C'
      }
    ]
  },
  {
    id: 'trace_002',
    productName: '草饲牛肉',
    batchId: 'batch_2024_002',
    status: 'in_progress',
    createdAt: '2024-02-20T09:15:00Z',
    updatedAt: '2024-12-01T14:20:00Z',
    stages: [
      {
        id: 'stage_005',
        name: '养殖',
        status: 'completed',
        startDate: '2024-02-20T09:15:00Z',
        endDate: '2024-11-20T18:00:00Z',
        location: '内蒙古草原',
        responsible: '蒙古牧民',
        details: '草原散养，纯天然牧草喂养'
      },
      {
        id: 'stage_006',
        name: '屠宰',
        status: 'in_progress',
        startDate: '2024-11-21T08:00:00Z',
        endDate: null,
        location: '内蒙古屠宰场',
        responsible: '屠宰专家',
        details: '符合清真认证，人道屠宰'
      }
    ]
  }
]

export const traceHandlers = [
  // GET /api/trace/:id - 获取溯源信息
  http.get('*/api/trace/:id', async ({ params }) => {
    try {
      const { id } = params
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100))

      // 查找溯源数据
      const traceData = mockTraceData.find(trace => trace.id === id)

      if (!traceData) {
        return HttpResponse.json(
          wrapError(`溯源记录不存在: ${id}`, 404),
          { status: 404 }
        )
      }

      console.log(`✅ Trace API: Retrieved trace data for ${id} - ${traceData.productName}`)

      return HttpResponse.json(
        wrapResponse(traceData, '溯源信息获取成功')
      )

    } catch (error) {
      console.error('Trace GET error:', error)
      return HttpResponse.json(
        wrapError('溯源信息获取失败', 500),
        { status: 500 }
      )
    }
  }),

  // GET /api/trace - 获取溯源列表
  http.get('/api/trace', async ({ request }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100))

      const url = new URL(request.url)
      const status = url.searchParams.get('status')
      const productName = url.searchParams.get('productName')

      let filteredData = [...mockTraceData]

      if (status) {
        filteredData = filteredData.filter(trace => trace.status === status)
      }

      if (productName) {
        filteredData = filteredData.filter(trace =>
          trace.productName.toLowerCase().includes(productName.toLowerCase())
        )
      }

      console.log(`✅ Trace API: Retrieved ${filteredData.length} trace records`)

      return HttpResponse.json(
        wrapResponse({
          traces: filteredData,
          total: filteredData.length
        }, '溯源列表获取成功')
      )

    } catch (error) {
      console.error('Trace list GET error:', error)
      return HttpResponse.json(
        wrapError('溯源列表获取失败', 500),
        { status: 500 }
      )
    }
  }),

  // POST /api/trace/:id/verify - 验证溯源码
  http.post('/api/trace/:id/verify', async ({ params, request }) => {
    try {
      const { id } = params
      const body = await request.json() as { code: string; timestamp: string }

      await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100))

      // 查找溯源数据
      const traceData = mockTraceData.find(trace => trace.id === id)

      if (!traceData) {
        return HttpResponse.json(
          wrapError(`溯源记录不存在: ${id}`, 404),
          { status: 404 }
        )
      }

      // 验证溯源码
      const isValid = body.code === id // 简单验证：码等于ID

      console.log(`✅ Trace Verify API: ${isValid ? 'Valid' : 'Invalid'} code ${body.code} for ${id}`)

      return HttpResponse.json(
        wrapResponse({
          verified: isValid,
          traceId: id,
          timestamp: body.timestamp,
          productName: traceData.productName
        }, isValid ? '溯源码验证成功' : '溯源码验证失败')
      )

    } catch (error) {
      console.error('Trace verify error:', error)
      return HttpResponse.json(
        wrapError('溯源码验证失败', 500),
        { status: 500 }
      )
    }
  })
]
