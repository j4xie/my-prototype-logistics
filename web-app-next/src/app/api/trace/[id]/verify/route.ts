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
 * 验证结果接口
 */
interface VerificationResult {
  isValid: boolean;
  batchCode: string;
  productName: string;
  verificationDetails: {
    certificateNumber: string;
    issuedBy: string;
    issuedDate: string;
    expiryDate: string;
    verificationScore: number; // 0-100分
    status: 'verified' | 'pending' | 'failed' | 'expired';
  };
  blockchain?: {
    transactionHash: string;
    blockNumber: number;
    network: string;
    timestamp: string;
    confirmed: boolean;
  };
  securityFeatures: {
    digitalSignature: boolean;
    tamperProof: boolean;
    timestampVerified: boolean;
    chainOfCustody: boolean;
  };
  warnings?: string[];
  recommendations?: string[];
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
  const delay = parseInt(process.env.NEXT_PUBLIC_MOCK_DELAY || '500');
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

/**
 * Mock验证数据
 */
const mockVerificationData: Record<string, VerificationResult> = {
  'APPLE-ORG-001': {
    isValid: true,
    batchCode: 'APPLE-ORG-001',
    productName: '有机苹果',
    verificationDetails: {
      certificateNumber: 'ORG-CERT-2024-001',
      issuedBy: '国家有机产品认证中心',
      issuedDate: '2024-01-15T10:30:00Z',
      expiryDate: '2025-01-15T10:30:00Z',
      verificationScore: 98,
      status: 'verified'
    },
    blockchain: {
      transactionHash: '0x1234567890abcdef1234567890abcdef12345678',
      blockNumber: 18500000,
      network: 'ethereum',
      timestamp: '2024-01-15T10:30:00Z',
      confirmed: true
    },
    securityFeatures: {
      digitalSignature: true,
      tamperProof: true,
      timestampVerified: true,
      chainOfCustody: true
    },
    recommendations: [
      '该产品已通过完整的有机认证流程',
      '区块链验证通过，数据完整性可靠',
      '建议在保质期内食用'
    ]
  },
  'PORK-BLK-002': {
    isValid: true,
    batchCode: 'PORK-BLK-002',
    productName: '黑猪肉',
    verificationDetails: {
      certificateNumber: 'MEAT-SAFE-2024-002',
      issuedBy: '国家肉类质量安全检验中心',
      issuedDate: '2024-01-15T11:45:00Z',
      expiryDate: '2024-01-25T00:00:00Z',
      verificationScore: 95,
      status: 'verified'
    },
    securityFeatures: {
      digitalSignature: true,
      tamperProof: true,
      timestampVerified: true,
      chainOfCustody: true
    },
    warnings: [
      '请注意保存温度，建议冷藏储存'
    ],
    recommendations: [
      '该产品已通过动物福利认证',
      '肉品检验合格，安全可食用',
      '建议在保质期内尽快食用'
    ]
  },
  'RICE-ORG-003': {
    isValid: true,
    batchCode: 'RICE-ORG-003',
    productName: '有机大米',
    verificationDetails: {
      certificateNumber: 'RICE-GEO-2023-003',
      issuedBy: '五常大米地理标志保护办公室',
      issuedDate: '2024-01-14T16:20:00Z',
      expiryDate: '2024-10-15T00:00:00Z',
      verificationScore: 100,
      status: 'verified'
    },
    securityFeatures: {
      digitalSignature: true,
      tamperProof: true,
      timestampVerified: true,
      chainOfCustody: true
    },
    recommendations: [
      '正宗五常大米，地理标志保护产品',
      '有机认证，品质优良',
      '建议密封保存，防潮防虫'
    ]
  },
  // 添加一个过期的示例
  'EXPIRED-001': {
    isValid: false,
    batchCode: 'EXPIRED-001',
    productName: '示例过期产品',
    verificationDetails: {
      certificateNumber: 'EXP-CERT-2023-001',
      issuedBy: '示例认证机构',
      issuedDate: '2023-01-01T00:00:00Z',
      expiryDate: '2023-12-31T23:59:59Z',
      verificationScore: 0,
      status: 'expired'
    },
    securityFeatures: {
      digitalSignature: true,
      tamperProof: true,
      timestampVerified: true,
      chainOfCustody: false
    },
    warnings: [
      '该产品认证已过期',
      '请勿购买或食用过期产品',
      '如有疑问请联系相关监管部门'
    ]
  },
  // 添加一个验证失败的示例
  'INVALID-001': {
    isValid: false,
    batchCode: 'INVALID-001',
    productName: '示例无效产品',
    verificationDetails: {
      certificateNumber: 'INV-CERT-2024-001',
      issuedBy: '未知机构',
      issuedDate: '2024-01-01T00:00:00Z',
      expiryDate: '2024-12-31T23:59:59Z',
      verificationScore: 25,
      status: 'failed'
    },
    securityFeatures: {
      digitalSignature: false,
      tamperProof: false,
      timestampVerified: false,
      chainOfCustody: false
    },
    warnings: [
      '该产品验证失败',
      '数字签名不匹配',
      '可能存在伪造风险',
      '请勿购买或食用'
    ]
  }
};

/**
 * 生成动态验证分数
 */
function calculateVerificationScore(batchCode: string): number {
  const baseScore = mockVerificationData[batchCode]?.verificationDetails.verificationScore || 0;
  
  // 添加一些随机性，模拟实时验证
  const randomFactor = Math.random() * 5 - 2.5; // -2.5 到 +2.5 的随机数
  const finalScore = Math.max(0, Math.min(100, baseScore + randomFactor));
  
  return Math.round(finalScore);
}

/**
 * 验证溯源信息 API
 * POST /api/trace/[id]/verify
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await simulateDelay();
    
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    // 解析请求体
    const body = await request.json().catch(() => ({}));
    const { verificationCode } = body;

    console.log(`🔍 验证请求: ${id}, code: ${verificationCode}`);

    if (!id) {
      return createResponse(
        null,
        false,
        '缺少产品批次号',
        400
      );
    }

    // 查找验证数据
    const verificationResult = mockVerificationData[id];

    if (!verificationResult) {
      console.log(`❌ 验证失败: 未找到批次 - ${id}`);
      return createResponse(
        {
          isValid: false,
          batchCode: id,
          productName: '未知产品',
          verificationDetails: {
            certificateNumber: '',
            issuedBy: '',
            issuedDate: '',
            expiryDate: '',
            verificationScore: 0,
            status: 'failed' as const
          },
          securityFeatures: {
            digitalSignature: false,
            tamperProof: false,
            timestampVerified: false,
            chainOfCustody: false
          },
          warnings: ['该批次编码不存在于验证数据库中']
        },
        false,
        '批次验证失败：未找到对应记录',
        404
      );
    }

    // 动态计算验证分数
    const dynamicScore = calculateVerificationScore(id);
    const responseData = {
      ...verificationResult,
      verificationDetails: {
        ...verificationResult.verificationDetails,
        verificationScore: dynamicScore
      }
    };

    // 记录验证日志
    if (responseData.isValid) {
      console.log(`✅ 验证成功: ${responseData.productName} - ${id} (得分: ${dynamicScore})`);
    } else {
      console.log(`❌ 验证失败: ${responseData.productName} - ${id} (状态: ${responseData.verificationDetails.status})`);
    }

    return createResponse(
      responseData,
      responseData.isValid,
      responseData.isValid ? '验证通过' : '验证失败'
    );

  } catch (error) {
    console.error('验证处理错误:', error);
    return createResponse(
      null,
      false,
      '服务器内部错误',
      500
    );
  }
}

/**
 * 快速验证（GET请求）
 * GET /api/trace/[id]/verify
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
        '缺少产品批次号',
        400
      );
    }

    // 查找验证数据
    const verificationResult = mockVerificationData[id];

    if (!verificationResult) {
      return createResponse(
        null,
        false,
        '批次验证失败：未找到对应记录',
        404
      );
    }

    // 返回简化的验证结果
    const quickResult = {
      exists: true,
      isValid: verificationResult.isValid,
      batchCode: verificationResult.batchCode,
      productName: verificationResult.productName,
      status: verificationResult.verificationDetails.status,
      score: verificationResult.verificationDetails.verificationScore
    };

    console.log(`⚡ 快速验证: ${verificationResult.batchCode} - ${verificationResult.isValid ? '有效' : '无效'}`);

    return createResponse(quickResult);

  } catch (error) {
    console.error('快速验证错误:', error);
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 