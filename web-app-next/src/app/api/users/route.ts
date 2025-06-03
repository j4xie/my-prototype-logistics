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
 * 用户接口
 */
interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  isActive: boolean;
  lastLogin: string;
  createdAt: string;
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
    department?: string;
  };
}

/**
 * 分页响应接口
 */
interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters?: {
    role?: string;
    isActive?: boolean;
    searchQuery?: string;
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
 * Mock用户数据
 */
const mockUsers: User[] = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    isActive: true,
    lastLogin: '2024-01-15T10:30:00Z',
    createdAt: '2024-01-01T08:00:00Z',
    profile: {
      firstName: '管理员',
      lastName: '系统',
      phone: '18800000001',
      department: '系统管理部'
    }
  },
  {
    id: 2,
    username: 'manager',
    email: 'manager@example.com',
    role: 'manager',
    isActive: true,
    lastLogin: '2024-01-15T09:15:00Z',
    createdAt: '2024-01-02T08:00:00Z',
    profile: {
      firstName: '王',
      lastName: '经理',
      phone: '18800000002',
      department: '生产管理部'
    }
  },
  {
    id: 3,
    username: 'user',
    email: 'user@example.com',
    role: 'user',
    isActive: true,
    lastLogin: '2024-01-14T16:45:00Z',
    createdAt: '2024-01-03T08:00:00Z',
    profile: {
      firstName: '李',
      lastName: '用户',
      phone: '18800000003',
      department: '操作部'
    }
  },
  {
    id: 4,
    username: 'test',
    email: 'test@example.com',
    role: 'user',
    isActive: false,
    lastLogin: '2024-01-10T12:00:00Z',
    createdAt: '2024-01-04T08:00:00Z',
    profile: {
      firstName: '测试',
      lastName: '用户',
      department: '测试部'
    }
  }
];

/**
 * 用户列表查询 API
 * GET /api/users
 */
export async function GET(request: NextRequest) {
  try {
    // 模拟网络延迟
    await simulateDelay();

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const role = searchParams.get('role');
    const isActive = searchParams.get('isActive');
    const searchQuery = searchParams.get('q') || searchParams.get('search');

    // 验证分页参数
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return createResponse(
        null,
        false,
        '分页参数无效',
        400
      );
    }

    // 过滤用户数据
    let filteredUsers = [...mockUsers];

    if (role) {
      filteredUsers = filteredUsers.filter(user => user.role === role);
    }

    if (isActive !== null && isActive !== undefined) {
      const activeFilter = isActive === 'true';
      filteredUsers = filteredUsers.filter(user => user.isActive === activeFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredUsers = filteredUsers.filter(user =>
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.profile.firstName.toLowerCase().includes(query) ||
        user.profile.lastName.toLowerCase().includes(query)
      );
    }

    // 计算分页
    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const items = filteredUsers.slice(startIndex, endIndex);

    const response: PaginatedResponse<User> = {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: {
        role: role || undefined,
        isActive: isActive ? isActive === 'true' : undefined,
        searchQuery: searchQuery || undefined
      }
    };

    console.log(`✅ 用户列表查询成功: 第${page}页, ${items.length}/${total}个用户`);

    return createResponse(
      response,
      true,
      `成功获取 ${items.length} 个用户`
    );

  } catch (error) {
    console.error('用户列表API错误:', error);

    return createResponse(
      null,
      false,
      '服务器内部错误',
      500
    );
  }
}
