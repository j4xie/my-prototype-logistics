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
 * 用户登出 API
 * POST /api/auth/logout
 */
export async function POST(request: NextRequest) {
  try {
    // 模拟网络延迟
    await simulateDelay();

    // 获取请求头中的认证信息
    const authorization = request.headers.get('authorization');
    const token = authorization?.replace('Bearer ', '');

    if (!token) {
      return createResponse(
        null,
        false,
        '未提供认证令牌',
        401
      );
    }

    // Mock登出逻辑 - 在实际应用中，这里会在服务器端使令牌失效
    console.log(`🔓 用户登出: token=${token.substring(0, 10)}...`);

    // 返回成功响应
    return createResponse(
      {
        message: '登出成功',
        logoutTime: new Date().toISOString(),
      },
      true,
      '用户已成功登出'
    );

  } catch (error) {
    console.error('登出API错误:', error);
    
    return createResponse(
      null,
      false,
      '服务器内部错误',
      500
    );
  }
}

/**
 * 处理OPTIONS请求 (CORS预检)
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
} 