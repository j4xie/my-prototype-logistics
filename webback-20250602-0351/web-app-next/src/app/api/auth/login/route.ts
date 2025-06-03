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
 * 登录请求接口
 */
interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * 登录响应接口
 */
interface LoginResponse {
  token: string;
  refreshToken: string;
  user: {
    id: number;
    username: string;
    email: string;
    role: 'admin' | 'manager' | 'user';
    permissions: string[];
    lastLogin: string;
    isActive: boolean;
  };
  expiresAt: string;
  sessionId: string;
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
 * Mock用户凭据
 */
const mockCredentials = {
  admin: {
    username: 'admin',
    password: 'admin123',
    user: {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin' as const,
      permissions: ['read', 'write', 'delete', 'admin'],
      lastLogin: new Date().toISOString(),
      isActive: true,
    },
    token: 'mock-jwt-token-admin',
  },
  manager: {
    username: 'manager',
    password: 'manager123',
    user: {
      id: 2,
      username: 'manager',
      email: 'manager@example.com',
      role: 'manager' as const,
      permissions: ['read', 'write'],
      lastLogin: new Date().toISOString(),
      isActive: true,
    },
    token: 'mock-jwt-token-manager',
  },
  user: {
    username: 'user',
    password: 'user123',
    user: {
      id: 3,
      username: 'user',
      email: 'user@example.com',
      role: 'user' as const,
      permissions: ['read'],
      lastLogin: new Date().toISOString(),
      isActive: true,
    },
    token: 'mock-jwt-token-user',
  },
  test: {
    username: 'test',
    password: 'test123',
    user: {
      id: 4,
      username: 'test',
      email: 'test@example.com',
      role: 'user' as const,
      permissions: ['read'],
      lastLogin: new Date().toISOString(),
      isActive: true,
    },
    token: 'mock-jwt-token-test',
  },
};

/**
 * 验证输入数据
 */
function validateLoginRequest(data: any): data is LoginRequest {
  return (
    data &&
    typeof data.username === 'string' &&
    typeof data.password === 'string' &&
    data.username.length > 0 &&
    data.password.length > 0
  );
}

/**
 * 用户登录 API
 * POST /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    // 模拟网络延迟
    await simulateDelay();

    // 获取请求体
    const body = await request.json();

    // 验证请求数据
    if (!validateLoginRequest(body)) {
      return createResponse(
        null,
        false,
        '用户名和密码不能为空',
        400
      );
    }

    const { username, password, rememberMe = false } = body as LoginRequest;

    // 查找用户凭据
    const credential = Object.values(mockCredentials).find(
      cred => cred.username === username
    );

    if (!credential) {
      // 模拟用户不存在的情况
      console.log(`❌ 登录失败: 用户不存在 - ${username}`);
      return createResponse(
        null,
        false,
        '用户名或密码错误',
        401
      );
    }

    // 验证密码
    if (credential.password !== password) {
      console.log(`❌ 登录失败: 密码错误 - ${username}`);
      return createResponse(
        null,
        false,
        '用户名或密码错误',
        401
      );
    }

    // 检查用户状态
    if (!credential.user.isActive) {
      console.log(`❌ 登录失败: 用户已被禁用 - ${username}`);
      return createResponse(
        null,
        false,
        '用户账户已被禁用',
        403
      );
    }

    // 生成令牌过期时间
    const now = new Date();
    const expiresIn = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 记住我: 30天，否则: 24小时
    const expiresAt = new Date(now.getTime() + expiresIn);

    // 生成会话ID
    const sessionId = `session-${credential.user.id}-${Date.now()}`;

    // 生成refreshToken
    const refreshToken = `refresh-${credential.token}-${Date.now()}`;

    // 更新用户最后登录时间
    const updatedUser = {
      ...credential.user,
      lastLogin: now.toISOString(),
    };

    // 构建登录响应
    const loginResponse: LoginResponse = {
      token: credential.token,
      refreshToken,
      user: updatedUser,
      expiresAt: expiresAt.toISOString(),
      sessionId,
    };

    console.log(`✅ 登录成功: ${username} (${credential.user.role}) - Session: ${sessionId}`);
    
    return createResponse(
      loginResponse,
      true,
      `欢迎回来，${credential.user.username}！`
    );

  } catch (error) {
    console.error('登录API错误:', error);
    
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