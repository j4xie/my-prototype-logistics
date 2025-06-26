import { http, HttpResponse } from 'msw'
import { wrapResponse, wrapError } from '../../types/api-response'

/**
 * 溯源模块 MSW Handlers
 * 解决P0问题：业务API缺失 /api/trace/{id} → 404
 * 增强：动态生成任意ID的溯源数据，避免404错误
 */

// 产品信息映射表
const getProductInfoById = (id: string) => {
  const productMap = [
    { name: '有机大米', origin: '黑龙江五常', category: '谷物', grade: 'A级' },
    { name: '草饲牛肉', origin: '内蒙古草原', category: '肉类', grade: 'A5级' },
    { name: '野生三文鱼', origin: '挪威北海', category: '海鲜', grade: '特级' },
    { name: '有机蔬菜', origin: '山东寿光', category: '蔬菜', grade: 'A级' },
    { name: '天然蜂蜜', origin: '云南大理', category: '特产', grade: '优级' },
    { name: '有机茶叶', origin: '福建武夷山', category: '茶叶', grade: '特级' },
    { name: '有机水果', origin: '新疆天山', category: '水果', grade: 'A级' },
    { name: '纯牛奶', origin: '内蒙古呼伦贝尔', category: '乳制品', grade: 'A级' }
  ];

  // 根据ID生成稳定的索引
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = Math.abs(hash) % productMap.length;
  return productMap[index];
};

// 动态生成溯源数据
const generateTraceData = (id: string) => {
  const productInfo = getProductInfoById(id);
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 180) + 10; // 10-190天前
  const baseDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

  return {
    id,
    productName: productInfo.name,
    batchId: `batch_${id}_001`,
    status: Math.random() > 0.1 ? 'completed' : 'in_progress', // 90%概率完成
    traceId: id,
    createdAt: baseDate.toISOString(),
    updatedAt: now.toISOString(),
    productInfo: {
      id,
      name: productInfo.name,
      category: productInfo.category,
      origin: productInfo.origin,
      productionDate: new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      expirationDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      batchCode: `${productInfo.category.slice(0,2).toUpperCase()}-${id}`,
      certifications: ['有机认证', '质量认证', 'ISO9001']
    },
    traceInfo: [
      {
        id: `event_${id}_001`,
        type: 'farming',
        title: '生产开始',
        description: `${productInfo.name}的专业生产阶段开始`,
        timestamp: new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        location: productInfo.origin,
        operator: '生产负责人',
        details: {
          method: '有机生产',
          standards: 'ISO认证',
          quality: '符合标准'
        }
      },
      {
        id: `event_${id}_002`,
        type: 'quality_check',
        title: '质量检测',
        description: '全面质量检测完成',
        timestamp: new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        location: '质检中心',
        operator: '质检员',
        details: {
          result: '合格',
          grade: productInfo.grade,
          certification: '通过'
        }
      },
      {
        id: `event_${id}_003`,
        type: 'processing',
        title: '包装处理',
        description: '产品包装和标识',
        timestamp: new Date(baseDate.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString(),
        location: '包装车间',
        operator: '包装工',
        details: {
          packaging: '真空包装',
          labeling: '完成',
          batchCode: `${productInfo.category.slice(0,2).toUpperCase()}-${id}`
        }
      },
      {
        id: `event_${id}_004`,
        type: 'logistics',
        title: '物流配送',
        description: '冷链运输配送',
        timestamp: new Date(baseDate.getTime() + 40 * 24 * 60 * 60 * 1000).toISOString(),
        location: '冷链运输',
        operator: '物流司机',
        details: {
          temperature: '2-8°C',
          vehicle: '冷藏车',
          route: '已规划'
        }
      }
    ],
    timeline: [],
    verification: {
      isVerified: true,
      verificationCode: `VRF-${id}-${Date.now()}`,
      verificationDate: now.toISOString()
    }
  };
};

// 预设的热门测试数据
const popularTestIds = ['12345', 'trace_001', 'trace_002', 'WG25031701', '001', '002', '003'];
const mockTraceCache = new Map<string, any>();

// 预生成热门测试数据
popularTestIds.forEach(id => {
  mockTraceCache.set(id, generateTraceData(id));
});

export const traceHandlers = [
  // GET /api/trace/:id - 获取溯源信息
  http.get('*/api/trace/:id', async ({ params }) => {
    try {
      const { id } = params as { id: string };

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));

      // 首先检查缓存
      let traceData = mockTraceCache.get(id);

      // 如果缓存中没有，动态生成
      if (!traceData) {
        console.log(`🔄 Trace API: Generating data for new ID: ${id}`);
        traceData = generateTraceData(id);
        mockTraceCache.set(id, traceData);
      }

      console.log(`✅ Trace API: Retrieved trace data for ${id} - ${traceData.productName}`);

      return HttpResponse.json(
        wrapResponse(traceData, '溯源信息获取成功'),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );

    } catch (error) {
      console.error('Trace GET error:', error);
      return HttpResponse.json(
        wrapError('溯源信息获取失败', 500),
        { status: 500 }
      );
    }
  }),

  // GET /api/trace - 获取溯源列表
  http.get(/.*\/api\/trace$/, async ({ request }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));

      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const productName = url.searchParams.get('productName');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '10');

      // 获取所有缓存的数据
      const allData = Array.from(mockTraceCache.values());

      // 如果缓存为空，生成一些示例数据
      if (allData.length === 0) {
        popularTestIds.forEach(id => {
          const data = generateTraceData(id);
          mockTraceCache.set(id, data);
          allData.push(data);
        });
      }

      // 应用筛选
      let filteredData = [...allData];

      if (status) {
        filteredData = filteredData.filter(trace => trace.status === status);
      }

      if (productName) {
        filteredData = filteredData.filter(trace =>
          trace.productName.toLowerCase().includes(productName.toLowerCase())
        );
      }

      // 分页
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = filteredData.slice(startIndex, endIndex);

      console.log(`✅ Trace API: Retrieved ${paginatedData.length}/${filteredData.length} trace records`);

      return HttpResponse.json(
        wrapResponse({
          traces: paginatedData,
          total: filteredData.length,
          page,
          limit,
          totalPages: Math.ceil(filteredData.length / limit)
        }, '溯源列表获取成功')
      );

    } catch (error) {
      console.error('Trace list GET error:', error);
      return HttpResponse.json(
        wrapError('溯源列表获取失败', 500),
        { status: 500 }
      );
    }
  }),

  // POST /api/trace/:id/verify - 验证溯源码
  http.post('*/api/trace/:id/verify', async ({ params, request }) => {
    try {
      const { id } = params as { id: string };

      await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));

      // 确保有数据
      let traceData = mockTraceCache.get(id);
      if (!traceData) {
        traceData = generateTraceData(id);
        mockTraceCache.set(id, traceData);
      }

      console.log(`✅ Trace API: Verified trace data for ${id}`);

      return HttpResponse.json(
        wrapResponse({
          verified: true,
          verificationCode: `VRF-${id}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          productName: traceData.productName,
          batchId: traceData.batchId
        }, '溯源验证成功')
      );

    } catch (error) {
      console.error('Trace verification error:', error);
      return HttpResponse.json(
        wrapError('溯源验证失败', 500),
        { status: 500 }
      );
    }
  })
];
