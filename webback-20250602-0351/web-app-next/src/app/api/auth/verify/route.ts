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
 * 令牌验证请求
 */
interface VerifyTokenRequest {
  token: string;
}

/**
 * 令牌验证响应
 */
interface VerifyTokenResponse {
  isValid: boolean;
  userId?: number;
  username?: string;
  role?: string;
  permissions?: string[];
  expiresAt?: string;
  issuedAt?: string;
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
 * Mock令牌数据
 */
const mockTokens: Record<string, {
  userId: number;
  username: string;
  role: string;
  permissions: string[];
  issuedAt: string;
  expiresAt: string;
}> = {
  'mock-jwt-token-admin': {
    userId: 1,
    username: 'admin',
    role: 'admin',
    permissions: ['read', 'write', 'delete', 'admin'],
    issuedAt: '2024-01-15T08:00:00Z',
    expiresAt: '2024-01-16T08:00:00Z',
  },
  'mock-jwt-token-manager': {
    userId: 2,
    username: 'manager',
    role: 'manager', 
    permissions: ['read', 'write'],
    issuedAt: '2024-01-15T08:00:00Z',
    expiresAt: '2024-01-16T08:00:00Z',
  },
  'mock-jwt-token-user': {
    userId: 3,
    username: 'user',
    role: 'user',
    permissions: ['read'],
    issuedAt: '2024-01-15T08:00:00Z',
    expiresAt: '2024-01-16T08:00:00Z',
  },
  // 过期令牌示例
  'mock-jwt-token-expired': {
    userId: 4,
    username: 'expired-user',
    role: 'user',
    permissions: ['read'],
    issuedAt: '2024-01-14T08:00:00Z',
    expiresAt: '2024-01-14T20:00:00Z', // 已过期
  },
};

/**
 * 检查令牌是否过期
 */
function isTokenExpired(expiresAt: string): boolean {
  const expiry = new Date(expiresAt);
  const now = new Date();
  return now > expiry;
}

/**
 * 令牌验证 API
 * POST /api/auth/verify
 */
export async function POST(request: NextRequest) {
  try {
    // 模拟网络延迟
    await simulateDelay();

    // 获取请求体
    const body: VerifyTokenRequest = await request.json();
    const { token } = body;

    if (!token) {
      const response: VerifyTokenResponse = {
        isValid: false,
      };

      return createResponse(
        response,
        false,
        '令牌不能为空',
        400
      );
    }

    // 验证令牌格式 (简单检查)
    if (typeof token !== 'string' || token.length < 10) {
      const response: VerifyTokenResponse = {
        isValid: false,
      };

      return createResponse(
        response,
        false,
        '令牌格式无效',
        400
      );
    }

    // 查找令牌信息
    const tokenInfo = mockTokens[token];
    
    if (!tokenInfo) {
      const response: VerifyTokenResponse = {
        isValid: false,
      };

      return createResponse(
        response,
        false,
        '令牌不存在或已失效',
        401
      );
    }

    // 检查令牌是否过期
    if (isTokenExpired(tokenInfo.expiresAt)) {
      const response: VerifyTokenResponse = {
        isValid: false,
      };

      return createResponse(
        response,
        false,
        '令牌已过期',
        401
      );
    }

    // 令牌有效
    const response: VerifyTokenResponse = {
      isValid: true,
      userId: tokenInfo.userId,
      username: tokenInfo.username,
      role: tokenInfo.role,
      permissions: tokenInfo.permissions,
      expiresAt: tokenInfo.expiresAt,
      issuedAt: tokenInfo.issuedAt,
    };

    console.log(`✅ 令牌验证成功: ${tokenInfo.username} (${tokenInfo.role})`);

    return createResponse(
      response,
      true,
      '令牌验证成功'
    );

  } catch (error) {
    console.error('令牌验证API错误:', error);
    
    const response: VerifyTokenResponse = {
      isValid: false,
    };

    return createResponse(
      response,
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