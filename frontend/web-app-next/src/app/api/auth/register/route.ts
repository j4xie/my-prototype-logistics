import { NextRequest, NextResponse } from 'next/server';

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  realName: string;
  phone: string;
  department: string;
  role: string;
}

interface RegisterResponse {
  success: boolean;
  message: string;
  data?: {
    userId: string;
    username: string;
    email: string;
  };
}

// Mock数据存储（实际应用中应使用数据库）
const mockUsers: Array<{
  id: string;
  username: string;
  email: string;
  password: string;
  realName: string;
  phone: string;
  department: string;
  role: string;
  createdAt: string;
}> = [];

export async function POST(request: NextRequest): Promise<NextResponse<RegisterResponse>> {
  try {
    const body: RegisterRequest = await request.json();

    // 验证必填字段
    const { username, email, password, realName, phone, department, role } = body;

    if (!username || !email || !password || !realName || !phone || !department) {
      return NextResponse.json({
        success: false,
        message: '请填写所有必填字段'
      }, { status: 400 });
    }

    // 验证用户名格式
    if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({
        success: false,
        message: '用户名格式不正确'
      }, { status: 400 });
    }

    // 验证邮箱格式
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({
        success: false,
        message: '邮箱格式不正确'
      }, { status: 400 });
    }

    // 验证密码强度
    if (password.length < 6 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      return NextResponse.json({
        success: false,
        message: '密码必须至少6个字符，包含字母和数字'
      }, { status: 400 });
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({
        success: false,
        message: '手机号格式不正确'
      }, { status: 400 });
    }

    // 检查用户名是否已存在
    const existingUserByUsername = mockUsers.find(user => user.username === username);
    if (existingUserByUsername) {
      return NextResponse.json({
        success: false,
        message: '用户名已存在'
      }, { status: 409 });
    }

    // 检查邮箱是否已存在
    const existingUserByEmail = mockUsers.find(user => user.email === email);
    if (existingUserByEmail) {
      return NextResponse.json({
        success: false,
        message: '邮箱已被注册'
      }, { status: 409 });
    }

    // 创建新用户
    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      username,
      email,
      password, // 实际应用中应该加密存储
      realName,
      phone,
      department,
      role: role || 'user',
      createdAt: new Date().toISOString()
    };

    // 添加到Mock数据存储
    mockUsers.push(newUser);

    // 记录注册日志
    console.log('用户注册成功:', {
      userId: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      department: newUser.department
    });

    // 返回成功响应
    return NextResponse.json({
      success: true,
      message: '注册成功',
      data: {
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email
      }
    }, { status: 201 });

  } catch (error) {
    console.error('注册API错误:', error);

    // 返回服务器错误
    return NextResponse.json({
      success: false,
      message: '服务器内部错误，请稍后重试'
    }, { status: 500 });
  }
}

// 可选：获取注册统计信息（仅管理员）
export async function GET(): Promise<NextResponse> {
  try {
    // 这里可以添加管理员权限验证

    const stats = {
      totalUsers: mockUsers.length,
      usersByRole: mockUsers.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      usersByDepartment: mockUsers.reduce((acc, user) => {
        acc[user.department] = (acc[user.department] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recentRegistrations: mockUsers
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          department: user.department,
          createdAt: user.createdAt
        }))
    };

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('获取注册统计错误:', error);

    return NextResponse.json({
      success: false,
      message: '获取统计信息失败'
    }, { status: 500 });
  }
}
