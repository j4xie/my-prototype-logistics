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
 * 用户信息接口
 */
interface UserInfo {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  permissions: string[];
  lastLogin?: string;
  isActive: boolean;
}

/**
 * 认证状态响应
 */
interface AuthStatusResponse {
  isAuthenticated: boolean;
  user?: UserInfo;
  tokenExpiry?: string;
  sessionId?: string;
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
 * Mock用户数据
 */
const mockUsers: Record<string, UserInfo> = {
  'mock-jwt-token-admin': {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    permissions: ['read', 'write', 'delete', 'admin'],
    lastLogin: '2024-01-15T10:30:00Z',
    isActive: true,
  },
  'mock-jwt-token-manager': {
    id: 2,
    username: 'manager',
    email: 'manager@example.com',
    role: 'manager',
    permissions: ['read', 'write'],
    lastLogin: '2024-01-15T09:15:00Z',
    isActive: true,
  },
  'mock-jwt-token-user': {
    id: 3,
    username: 'user',
    email: 'user@example.com',
    role: 'user',
    permissions: ['read'],
    lastLogin: '2024-01-15T08:45:00Z',
    isActive: true,
  },
};

/**
 * 认证状态查询 API
 * GET /api/auth/status
 */
export async function GET(request: NextRequest) {
  try {
    // 模拟网络延迟
    await simulateDelay();

    // 获取认证令牌
    const authorization = request.headers.get('authorization');
    const token = authorization?.replace('Bearer ', '');

    if (!token) {
      const response: AuthStatusResponse = {
        isAuthenticated: false,
      };

      return createResponse(
        response,
        true,
        '未提供认证令牌'
      );
    }

    // 检查令牌有效性 (Mock逻辑)
    const user = mockUsers[token];
    
    if (!user) {
      const response: AuthStatusResponse = {
        isAuthenticated: false,
      };

      return createResponse(
        response,
        true,
        '无效的认证令牌'
      );
    }

    // 模拟令牌过期检查
    const now = new Date();
    const tokenExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24小时后过期

    const response: AuthStatusResponse = {
      isAuthenticated: true,
      user,
      tokenExpiry: tokenExpiry.toISOString(),
      sessionId: `session-${user.id}-${Date.now()}`,
    };

    console.log(`✅ 认证状态查询: ${user.username} (${user.role})`);

    return createResponse(
      response,
      true,
      '认证状态查询成功'
    );

  } catch (error) {
    console.error('认证状态查询API错误:', error);
    
    const response: AuthStatusResponse = {
      isAuthenticated: false,
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
} 