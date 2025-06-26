import { NextRequest, NextResponse } from 'next/server';

// 模拟用户数据
const mockUsers = [
  {
    id: 'user-001',
    username: 'admin',
    email: 'admin@example.com',
    realName: '张管理员',
    phone: '13800138001',
    department: '技术部',
    role: 'admin',
    avatar: null,
    bio: '负责系统管理和技术架构设计，有10年以上的软件开发经验。',
    joinDate: '2023-01-15T08:00:00Z',
    lastLogin: '2024-02-02T09:30:00Z',
        status: 'active' as 'active' | 'inactive' | 'deleted'
  },
  {
    id: 'user-002',
    username: 'manager',
    email: 'manager@example.com',
    realName: '李经理',
    phone: '13800138002',
    department: '质量部',
    role: 'manager',
    avatar: null,
    bio: '质量管理专家，负责产品质量控制和流程改进。',
    joinDate: '2023-03-10T08:00:00Z',
    lastLogin: '2024-02-01T15:20:00Z',
    status: 'active' as 'active' | 'inactive' | 'deleted'
  },
  {
    id: 'user-003',
    username: 'operator',
    email: 'operator@example.com',
    realName: '王操作员',
    phone: '13800138003',
    department: '运营部',
    role: 'operator',
    avatar: null,
    bio: '系统操作专员，负责日常业务操作和数据维护。',
    joinDate: '2023-06-01T08:00:00Z',
    lastLogin: '2024-02-02T08:45:00Z',
    status: 'active' as 'active' | 'inactive' | 'deleted'
  },
  {
    id: 'user-004',
    username: 'testuser',
    email: 'user@example.com',
    realName: '赵用户',
    phone: '13800138004',
    department: '市场部',
    role: 'user',
    avatar: null,
    bio: null,
    joinDate: '2023-09-15T08:00:00Z',
    lastLogin: '2024-02-01T11:10:00Z',
    status: 'active' as 'active' | 'inactive' | 'deleted'
  }
];

// GET - 获取当前用户资料
export async function GET() {
  try {
    // 模拟从session/token获取用户ID
    // 这里默认返回第一个用户（admin）
    const currentUser = mockUsers[0];

    console.log('获取用户资料:', currentUser.username);

    return NextResponse.json({
      success: true,
      message: '获取用户资料成功',
      profile: currentUser
    });
  } catch (error) {
    console.error('获取用户资料失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '获取用户资料失败'
      },
      { status: 500 }
    );
  }
}

// PUT - 更新用户资料
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { realName, phone, department, bio } = body;

    console.log('更新用户资料请求:', body);

    // 基本验证
    if (!realName || !phone || !department) {
      return NextResponse.json(
        {
          success: false,
          message: '真实姓名、手机号和部门为必填项'
        },
        { status: 400 }
      );
    }

    // 手机号格式验证
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        {
          success: false,
          message: '手机号格式不正确'
        },
        { status: 400 }
      );
    }

    // 模拟更新当前用户（这里是admin）
    const currentUser = mockUsers[0];
    const updatedUser = {
      ...currentUser,
      realName,
      phone,
      department,
      bio: bio || null,
      // 更新最后修改时间
      lastLogin: new Date().toISOString()
    };

    // 在实际应用中，这里会更新数据库
    // 这里只是更新内存中的数据
    mockUsers[0] = updatedUser;

    console.log('用户资料更新成功:', updatedUser.username);

    return NextResponse.json({
      success: true,
      message: '用户资料更新成功',
      profile: updatedUser
    });

  } catch (error) {
    console.error('更新用户资料失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '更新用户资料失败'
      },
      { status: 500 }
    );
  }
}

// DELETE 删除用户账户 (敏感操作，需要额外验证)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, password } = body;

    if (!id || !password) {
      return NextResponse.json(
        {
          success: false,
          message: '缺少必要参数'
        },
        { status: 400 }
      );
    }

    const userIndex = mockUsers.findIndex(u => u.id === id);

    if (userIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          message: '用户不存在'
        },
        { status: 404 }
      );
    }

    // 在实际项目中，这里应该验证密码
    // 这里简化处理，假设密码验证通过

    // 标记用户为删除状态 (而不是真正删除)
    mockUsers[userIndex].status = 'deleted';

    return NextResponse.json({
      success: true,
      message: '账户删除成功'
    });

  } catch (error) {
    console.error('删除用户账户失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '服务器错误，请稍后重试'
      },
      { status: 500 }
    );
  }
}
