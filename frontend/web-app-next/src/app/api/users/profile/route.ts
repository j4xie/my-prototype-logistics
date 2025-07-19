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
 * 用户资料接口
 */
interface UserProfile {
  id: number;
  username: string;
  email: string;
  fullName: string;
  avatar?: string;
  role: 'admin' | 'manager' | 'user';
  permissions: string[];
  preferences: {
    language: 'zh-CN' | 'en-US';
    theme: 'light' | 'dark' | 'auto';
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
  };
  profile: {
    phone?: string;
    company?: string;
    department?: string;
    position?: string;
    address?: string;
    bio?: string;
  };
  statistics: {
    lastLogin: string;
    loginCount: number;
    tracesViewed: number;
    verificationsMade: number;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 用户资料更新请求接口
 */
interface UpdateProfileRequest {
  fullName?: string;
  email?: string;
  phone?: string;
  company?: string;
  department?: string;
  position?: string;
  address?: string;
  bio?: string;
  preferences?: {
    language?: 'zh-CN' | 'en-US';
    theme?: 'light' | 'dark' | 'auto';
    timezone?: string;
    notifications?: {
      email?: boolean;
      push?: boolean;
      sms?: boolean;
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
 * 验证授权令牌
 */
function extractUserFromToken(authHeader: string | null): UserProfile | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  // Mock token 到用户映射
  const tokenUserMap: Record<string, UserProfile> = {
    'mock-jwt-token-admin': {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      fullName: '系统管理员',
      avatar: '/avatars/admin.jpg',
      role: 'admin',
      permissions: ['read', 'write', 'delete', 'admin'],
      preferences: {
        language: 'zh-CN',
        theme: 'light',
        timezone: 'Asia/Shanghai',
        notifications: {
          email: true,
          push: true,
          sms: false
        }
      },
      profile: {
        phone: '13800138000',
        company: '食品安全管理中心',
        department: '技术部',
        position: '系统管理员',
        address: '北京市朝阳区',
        bio: '负责食品溯源系统的整体管理和维护'
      },
      statistics: {
        lastLogin: new Date().toISOString(),
        loginCount: 523,
        tracesViewed: 1245,
        verificationsMade: 890
      },
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: new Date().toISOString()
    },
    'mock-jwt-token-manager': {
      id: 2,
      username: 'manager',
      email: 'manager@example.com',
      fullName: '业务经理',
      avatar: '/avatars/manager.jpg',
      role: 'manager',
      permissions: ['read', 'write'],
      preferences: {
        language: 'zh-CN',
        theme: 'auto',
        timezone: 'Asia/Shanghai',
        notifications: {
          email: true,
          push: true,
          sms: true
        }
      },
      profile: {
        phone: '13800138001',
        company: '绿源农场',
        department: '质量管理部',
        position: '质量经理',
        address: '山东省烟台市',
        bio: '专注于农产品质量管理和溯源流程优化'
      },
      statistics: {
        lastLogin: new Date(Date.now() - 3600000).toISOString(), // 1小时前
        loginCount: 156,
        tracesViewed: 678,
        verificationsMade: 234
      },
      isActive: true,
      createdAt: '2023-02-15T00:00:00Z',
      updatedAt: new Date().toISOString()
    },
    'mock-jwt-token-user': {
      id: 3,
      username: 'user',
      email: 'user@example.com',
      fullName: '普通用户',
      avatar: '/avatars/user.jpg',
      role: 'user',
      permissions: ['read'],
      preferences: {
        language: 'zh-CN',
        theme: 'light',
        timezone: 'Asia/Shanghai',
        notifications: {
          email: false,
          push: true,
          sms: false
        }
      },
      profile: {
        phone: '13800138002',
        company: '消费者',
        bio: '关注食品安全，重视产品溯源'
      },
      statistics: {
        lastLogin: new Date(Date.now() - 7200000).toISOString(), // 2小时前
        loginCount: 45,
        tracesViewed: 123,
        verificationsMade: 67
      },
      isActive: true,
      createdAt: '2023-06-01T00:00:00Z',
      updatedAt: new Date().toISOString()
    },
    'mock-jwt-token-test': {
      id: 4,
      username: 'test',
      email: 'test@example.com',
      fullName: '测试用户',
      role: 'user',
      permissions: ['read'],
      preferences: {
        language: 'en-US',
        theme: 'dark',
        timezone: 'Asia/Shanghai',
        notifications: {
          email: true,
          push: false,
          sms: false
        }
      },
      profile: {
        bio: '测试账户，用于系统功能验证'
      },
      statistics: {
        lastLogin: new Date(Date.now() - 86400000).toISOString(), // 1天前
        loginCount: 12,
        tracesViewed: 25,
        verificationsMade: 8
      },
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: new Date().toISOString()
    }
  };

  return tokenUserMap[token] || null;
}

/**
 * 验证更新数据
 */
function validateUpdateData(data: any): data is UpdateProfileRequest {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // 验证邮箱格式
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return false;
  }

  // 验证手机号格式（中国手机号）
  if (data.phone && !/^1[3-9]\d{9}$/.test(data.phone)) {
    return false;
  }

  return true;
}

/**
 * 获取用户资料 API
 * GET /api/users/profile
 */
export async function GET(request: NextRequest) {
  try {
    // 模拟网络延迟
    await simulateDelay();

    // 验证授权
    const authHeader = request.headers.get('Authorization');
    const user = extractUserFromToken(authHeader);

    if (!user) {
      return createResponse(
        null,
        false,
        '未授权访问',
        401
      );
    }

    console.log(`✅ 获取用户资料: ${user.username} (${user.fullName})`);

    return createResponse(user);

  } catch (error) {
    console.error('获取用户资料错误:', error);
    return createResponse(
      null,
      false,
      '服务器内部错误',
      500
    );
  }
}

/**
 * 更新用户资料 API
 * PUT /api/users/profile
 */
export async function PUT(request: NextRequest) {
  try {
    // 模拟网络延迟
    await simulateDelay();

    // 验证授权
    const authHeader = request.headers.get('Authorization');
    const user = extractUserFromToken(authHeader);

    if (!user) {
      return createResponse(
        null,
        false,
        '未授权访问',
        401
      );
    }

    // 获取请求体
    const updateData = await request.json();

    // 验证更新数据
    if (!validateUpdateData(updateData)) {
      return createResponse(
        null,
        false,
        '更新数据格式不正确',
        400
      );
    }

    // 模拟更新用户资料
    const updatedUser: UserProfile = {
      ...user,
      fullName: updateData.fullName || user.fullName,
      email: updateData.email || user.email,
      profile: {
        ...user.profile,
        phone: updateData.phone || user.profile.phone,
        company: updateData.company || user.profile.company,
        department: updateData.department || user.profile.department,
        position: updateData.position || user.profile.position,
        address: updateData.address || user.profile.address,
        bio: updateData.bio || user.profile.bio,
      },
      preferences: {
        ...user.preferences,
        ...updateData.preferences,
        notifications: {
          ...user.preferences.notifications,
          ...(updateData.preferences?.notifications || {})
        }
      },
      updatedAt: new Date().toISOString()
    };

    console.log(`✅ 更新用户资料: ${user.username} - 更新字段: ${Object.keys(updateData).join(', ')}`);

    return createResponse(
      updatedUser,
      true,
      '用户资料更新成功'
    );

  } catch (error) {
    console.error('更新用户资料错误:', error);
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
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
