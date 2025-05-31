import { NextRequest, NextResponse } from 'next/server';

/**
 * 标准化API响应格式
 */
interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  code?: number;
}

/**
 * 溯源事件接口
 */
interface TraceEvent {
  id: string;
  type: 'farming' | 'processing' | 'logistics' | 'quality_check' | 'packaging';
  title: string;
  description: string;
  timestamp: string;
  location: string;
  operator: string;
  details: Record<string, unknown>;
  attachments?: Array<{
    type: 'image' | 'document' | 'certificate';
    url: string;
    title: string;
  }>;
}

/**
 * 产品溯源信息接口
 */
interface TraceInfo {
  productInfo: {
    id: string;
    name: string;
    category: string;
    origin: string;
    productionDate: string;
    expirationDate: string;
    batchCode: string;
    certifications: string[];
  };
  traceInfo: TraceEvent[];
  timeline: Array<{
    date: string;
    events: TraceEvent[];
  }>;
  verification: {
    isVerified: boolean;
    verificationCode: string;
    verificationDate: string;
    blockchain?: {
      transactionHash: string;
      blockNumber: number;
      network: string;
    };
  };
}

/**
 * 创建标准化响应
 */
function createResponse<T>(
  data: T,
  success: boolean = true,
  message?: string,
  status: number = 200
): NextResponse {
  const response: ApiResponse<T> = {
    success,
    data,
    message,
    code: status,
  };

  return NextResponse.json(response, { status });
}

/**
 * 模拟响应延迟
 */
async function simulateDelay(): Promise<void> {
  const delay = parseInt(process.env.NEXT_PUBLIC_MOCK_DELAY || '300');
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

/**
 * Mock溯源数据
 */
const mockTraceData: Record<string, TraceInfo> = {
  'APPLE-ORG-001': {
    productInfo: {
      id: '1',
      name: '有机苹果',
      category: '水果',
      origin: '山东烟台',
      productionDate: '2024-01-08T00:00:00Z',
      expirationDate: '2024-02-08T00:00:00Z',
      batchCode: 'APPLE-ORG-001',
      certifications: ['有机认证', 'ISO9001', '绿色食品']
    },
    traceInfo: [
      {
        id: 'event-001',
        type: 'farming',
        title: '种植',
        description: '有机苹果种植开始',
        timestamp: '2023-04-15T08:00:00Z',
        location: '山东烟台绿源有机农场',
        operator: '张农夫',
        details: {
          soilType: '有机土壤',
          seedVariety: '红富士',
          plantingArea: '5公顷',
          weather: '晴朗，适合种植'
        }
      },
      {
        id: 'event-002',
        type: 'quality_check',
        title: '生长期检测',
        description: '苹果生长期质量检测',
        timestamp: '2023-08-20T10:30:00Z',
        location: '山东烟台绿源有机农场',
        operator: '李检测员',
        details: {
          pesticidesUsed: '无',
          organicFertilizer: '有机肥料',
          fruitSize: '正常',
          healthStatus: '健康'
        },
        attachments: [
          {
            type: 'certificate',
            url: '/documents/organic-growth-cert.pdf',
            title: '有机生长认证'
          }
        ]
      },
      {
        id: 'event-003',
        type: 'farming',
        title: '采摘',
        description: '苹果成熟采摘',
        timestamp: '2024-01-08T06:00:00Z',
        location: '山东烟台绿源有机农场',
        operator: '王采摘员',
        details: {
          harvestMethod: '人工采摘',
          weather: '晴朗，22°C',
          quantity: '1000kg',
          quality: '优等'
        },
        attachments: [
          {
            type: 'image',
            url: '/images/harvest-apple-001.jpg',
            title: '采摘现场'
          }
        ]
      },
      {
        id: 'event-004',
        type: 'processing',
        title: '清洗包装',
        description: '苹果清洗和包装处理',
        timestamp: '2024-01-08T14:00:00Z',
        location: '烟台果品加工中心',
        operator: '陈加工员',
        details: {
          washingMethod: '清水冲洗',
          packagingType: '环保包装盒',
          batchSize: '150斤',
          qualityGrade: 'A级'
        }
      },
      {
        id: 'event-005',
        type: 'logistics',
        title: '冷链运输',
        description: '冷链运输到销售点',
        timestamp: '2024-01-09T08:00:00Z',
        location: '烟台-北京运输线',
        operator: '赵司机',
        details: {
          transportMethod: '冷链车',
          temperature: '2-4°C',
          humidity: '85-90%',
          expectedArrival: '2024-01-10T18:00:00Z'
        }
      }
    ],
    timeline: [],
    verification: {
      isVerified: true,
      verificationCode: 'VRF-APPLE-001-2024',
      verificationDate: '2024-01-15T10:30:00Z',
      blockchain: {
        transactionHash: '0x1234567890abcdef',
        blockNumber: 18500000,
        network: 'ethereum'
      }
    }
  },
  'PORK-BLK-002': {
    productInfo: {
      id: '2',
      name: '黑猪肉',
      category: '肉类',
      origin: '黑龙江哈尔滨',
      productionDate: '2024-01-10T00:00:00Z',
      expirationDate: '2024-01-25T00:00:00Z',
      batchCode: 'PORK-BLK-002',
      certifications: ['无公害农产品', '动物福利认证']
    },
    traceInfo: [
      {
        id: 'event-101',
        type: 'farming',
        title: '生猪养殖',
        description: '黑猪散养开始',
        timestamp: '2023-01-01T00:00:00Z',
        location: '黑龙江哈尔滨黑土地牧场',
        operator: '牧场主李老板',
        details: {
          breedType: '东北黑猪',
          feedType: '有机饲料',
          livingSpace: '散养环境',
          animalWelfare: '符合动物福利标准'
        }
      },
      {
        id: 'event-102',
        type: 'quality_check',
        title: '兽医检查',
        description: '定期兽医健康检查',
        timestamp: '2023-12-15T09:00:00Z',
        location: '黑龙江哈尔滨黑土地牧场',
        operator: '兽医师王医生',
        details: {
          healthStatus: '健康',
          vaccinations: '已完成全部疫苗',
          weight: '120kg',
          condition: '优良'
        },
        attachments: [
          {
            type: 'certificate',
            url: '/documents/veterinary-check-002.pdf',
            title: '兽医检查报告'
          }
        ]
      },
      {
        id: 'event-103',
        type: 'processing',
        title: '屠宰加工',
        description: '规范屠宰和初加工',
        timestamp: '2024-01-10T05:00:00Z',
        location: '哈尔滨肉类加工厂',
        operator: '屠宰师傅张师傅',
        details: {
          slaughterMethod: '人道屠宰',
          temperature: '2-4°C',
          hygiene: '符合HACCP标准',
          cutType: '分割包装'
        }
      },
      {
        id: 'event-104',
        type: 'quality_check',
        title: '肉品检验',
        description: '肉品质量安全检验',
        timestamp: '2024-01-10T10:00:00Z',
        location: '哈尔滨肉类检验中心',
        operator: '检验员李技师',
        details: {
          microbialTest: '合格',
          residueTest: '无残留',
          freshnessTest: '新鲜',
          grade: 'A级'
        },
        attachments: [
          {
            type: 'certificate',
            url: '/documents/meat-inspection-002.pdf',
            title: '肉品检验报告'
          }
        ]
      },
      {
        id: 'event-105',
        type: 'logistics',
        title: '冷链配送',
        description: '冷链运输到零售终端',
        timestamp: '2024-01-11T06:00:00Z',
        location: '哈尔滨-北京冷链专线',
        operator: '冷链司机赵师傅',
        details: {
          transportMethod: '冷链车',
          temperature: '0-2°C',
          packaging: '真空包装',
          expectedArrival: '2024-01-12T14:00:00Z'
        }
      }
    ],
    timeline: [],
    verification: {
      isVerified: true,
      verificationCode: 'VRF-PORK-002-2024',
      verificationDate: '2024-01-15T11:45:00Z'
    }
  },
  'RICE-ORG-003': {
    productInfo: {
      id: '3',
      name: '有机大米',
      category: '谷物',
      origin: '黑龙江五常',
      productionDate: '2023-10-15T00:00:00Z',
      expirationDate: '2024-10-15T00:00:00Z',
      batchCode: 'RICE-ORG-003',
      certifications: ['有机认证', '地理标志保护产品']
    },
    traceInfo: [
      {
        id: 'event-201',
        type: 'farming',
        title: '水稻种植',
        description: '有机水稻种植开始',
        timestamp: '2023-05-01T06:00:00Z',
        location: '黑龙江五常稻香村有机农场',
        operator: '农场主刘老板',
        details: {
          riceVariety: '五常大米',
          plantingMethod: '有机种植',
          waterSource: '天然山泉水',
          soilType: '黑土地'
        }
      },
      {
        id: 'event-202',
        type: 'quality_check',
        title: '生长期监测',
        description: '水稻生长期质量监测',
        timestamp: '2023-08-15T09:00:00Z',
        location: '黑龙江五常稻香村有机农场',
        operator: '农技员孙技师',
        details: {
          growthStatus: '正常',
          pesticidesUsed: '无',
          fertilizer: '有机肥',
          waterQuality: '优良'
        },
        attachments: [
          {
            type: 'certificate',
            url: '/documents/rice-growth-monitoring.pdf',
            title: '生长期监测报告'
          }
        ]
      },
      {
        id: 'event-203',
        type: 'farming',
        title: '收割',
        description: '水稻成熟收割',
        timestamp: '2023-10-15T07:00:00Z',
        location: '黑龙江五常稻香村有机农场',
        operator: '收割队长老王',
        details: {
          harvestMethod: '机械收割',
          weather: '晴朗干燥',
          moisture: '13.5%',
          yield: '8吨/公顷'
        }
      },
      {
        id: 'event-204',
        type: 'processing',
        title: '加工处理',
        description: '稻谷脱壳和精加工',
        timestamp: '2023-10-16T08:00:00Z',
        location: '五常大米加工厂',
        operator: '加工主管周师傅',
        details: {
          processingMethod: '低温脱壳',
          polishingLevel: '一级精米',
          packaging: '真空包装',
          weight: '5kg/袋'
        }
      },
      {
        id: 'event-205',
        type: 'quality_check',
        title: '成品检验',
        description: '大米成品质量检验',
        timestamp: '2023-10-17T10:00:00Z',
        location: '五常质检中心',
        operator: '质检员林检验师',
        details: {
          appearance: '颗粒饱满',
          aroma: '香味浓郁',
          taste: '口感甘甜',
          grade: '特级'
        },
        attachments: [
          {
            type: 'certificate',
            url: '/documents/rice-quality-inspection.pdf',
            title: '大米质量检验报告'
          }
        ]
      }
    ],
    timeline: [],
    verification: {
      isVerified: true,
      verificationCode: 'VRF-RICE-003-2023',
      verificationDate: '2024-01-14T16:20:00Z'
    }
  }
};

/**
 * 生成时间线数据
 */
function generateTimeline(traceEvents: TraceEvent[]): Array<{ date: string; events: TraceEvent[] }> {
  const timelineMap = new Map<string, TraceEvent[]>();
  
  traceEvents.forEach(event => {
    const date = event.timestamp.split('T')[0];
    if (!timelineMap.has(date)) {
      timelineMap.set(date, []);
    }
    timelineMap.get(date)!.push(event);
  });
  
  return Array.from(timelineMap.entries())
    .map(([date, events]) => ({ date, events }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 获取溯源信息 API
 * GET /api/trace/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await simulateDelay();
    
    // Next.js 15中params是Promise
    const { id } = await params;

    if (!id) {
      return createResponse(
        null,
        false,
        '溯源ID不能为空',
        400
      );
    }

    // 查找溯源数据
    const traceData = mockTraceData[id];

    if (!traceData) {
      console.log(`❌ 溯源查询失败: 未找到产品 - ${id}`);
      return createResponse(
        null,
        false,
        '未找到对应的溯源信息',
        404
      );
    }

    // 生成时间线
    const timeline = generateTimeline(traceData.traceInfo);
    
    const responseData = {
      ...traceData,
      timeline
    };

    console.log(`✅ 溯源查询成功: ${traceData.productInfo.name} - ${id}`);

    return createResponse(responseData);

  } catch (error) {
    console.error('溯源查询错误:', error);
    return createResponse(
      null,
      false,
      '服务器内部错误',
      500
    );
  }
}

/**
 * 支持CORS预检请求
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 