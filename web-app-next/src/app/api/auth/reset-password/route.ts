import { NextRequest, NextResponse } from 'next/server';

interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

interface ResetPasswordResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
    username?: string;
  };
}

// 导入全局变量声明
declare global {
  // eslint-disable-next-line no-var
  var mockVerificationCodes: Array<{
    email: string;
    code: string;
    createdAt: string;
    expiresAt: string;
    used: boolean;
  }>;
  // eslint-disable-next-line no-var
  var mockUsers: Array<{
    id: string;
    username: string;
    email: string;
    password: string;
    realName: string;
    phone: string;
    department: string;
    role: string;
    createdAt: string;
    lastPasswordReset?: string;
  }>;
}

// 初始化全局变量
if (!global.mockVerificationCodes) {
  global.mockVerificationCodes = [];
}

if (!global.mockUsers) {
  global.mockUsers = [];
}

// 密码加密函数（实际应用中应使用bcrypt等）
function hashPassword(password: string): string {
  // 这里只是简单示例，实际应用中应使用适当的加密算法
  return `hashed_${password}_${Date.now()}`;
}

export async function POST(request: NextRequest): Promise<NextResponse<ResetPasswordResponse>> {
  try {
    const body: ResetPasswordRequest = await request.json();
    const { email, code, newPassword } = body;

    // 验证输入参数
    if (!email || !code || !newPassword) {
      return NextResponse.json({
        success: false,
        message: '邮箱、验证码和新密码不能为空'
      }, { status: 400 });
    }

    // 验证邮箱格式
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({
        success: false,
        message: '邮箱格式不正确'
      }, { status: 400 });
    }

    // 验证验证码格式
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({
        success: false,
        message: '验证码应为6位数字'
      }, { status: 400 });
    }

    // 验证新密码强度
    if (newPassword.length < 6 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      return NextResponse.json({
        success: false,
        message: '密码必须至少6个字符，包含字母和数字'
      }, { status: 400 });
    }

    // 验证验证码的有效性
    const codeRecord = global.mockVerificationCodes
      .filter(record => record.email === email && record.code === code && !record.used)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!codeRecord) {
      return NextResponse.json({
        success: false,
        message: '验证码错误或已失效'
      }, { status: 400 });
    }

    // 检查验证码是否过期
    const now = new Date();
    const expiresAt = new Date(codeRecord.expiresAt);

    if (now > expiresAt) {
      return NextResponse.json({
        success: false,
        message: '验证码已过期，请重新获取'
      }, { status: 400 });
    }

    // 查找用户
    const user = global.mockUsers.find(user => user.email === email);

    if (!user) {
      // 为了安全，不告诉用户具体是用户不存在还是其他问题
      return NextResponse.json({
        success: false,
        message: '重置密码失败，请检查邮箱地址'
      }, { status: 400 });
    }

    // 防止重复重置（5分钟内）
    if (user.lastPasswordReset) {
      const lastResetTime = new Date(user.lastPasswordReset);
      const timeDiff = now.getTime() - lastResetTime.getTime();
      const cooldownTime = 5 * 60 * 1000; // 5分钟

      if (timeDiff < cooldownTime) {
        const remainingTime = Math.ceil((cooldownTime - timeDiff) / 1000 / 60);
        return NextResponse.json({
          success: false,
          message: `请等待 ${remainingTime} 分钟后再次重置密码`
        }, { status: 429 });
      }
    }

    // 检查新密码是否与当前密码相同
    // 实际应用中需要正确比较加密后的密码
    if (user.password === newPassword) {
      return NextResponse.json({
        success: false,
        message: '新密码不能与原密码相同'
      }, { status: 400 });
    }

    // 更新用户密码
    const hashedNewPassword = hashPassword(newPassword);
    user.password = hashedNewPassword;
    user.lastPasswordReset = now.toISOString();

    // 标记验证码为已使用
    codeRecord.used = true;

    // 使该用户的所有其他验证码失效
    global.mockVerificationCodes
      .filter(record => record.email === email && record !== codeRecord)
      .forEach(record => record.used = true);

    // 记录密码重置日志
    console.log('密码重置成功:', {
      userId: user.id,
      username: user.username,
      email: user.email,
      timestamp: now.toISOString(),
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    });

    // 在实际应用中，这里应该：
    // 1. 记录安全日志
    // 2. 发送密码重置成功的通知邮件
    // 3. 可能需要强制用户重新登录（使现有会话失效）

    return NextResponse.json({
      success: true,
      message: '密码重置成功',
      data: {
        email: user.email,
        username: user.username
      }
    });

  } catch (error) {
    console.error('密码重置API错误:', error);

    return NextResponse.json({
      success: false,
      message: '服务器内部错误，请稍后重试'
    }, { status: 500 });
  }
}

// 获取密码重置统计信息（管理员用）
export async function GET(): Promise<NextResponse> {
  try {
    // 这里应该添加管理员权限验证

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 统计最近的密码重置活动
    const recentResets = global.mockUsers
      .filter(user => user.lastPasswordReset)
      .map(user => ({
        username: user.username,
        email: user.email,
        resetTime: user.lastPasswordReset
      }))
      .sort((a, b) => new Date(b.resetTime!).getTime() - new Date(a.resetTime!).getTime());

    const todayResets = recentResets.filter(reset =>
      new Date(reset.resetTime!) > oneDayAgo
    );

    const weekResets = recentResets.filter(reset =>
      new Date(reset.resetTime!) > oneWeekAgo
    );

    // 统计验证码使用情况
    const codeStats = {
      total: global.mockVerificationCodes.length,
      used: global.mockVerificationCodes.filter(code => code.used).length,
      expired: global.mockVerificationCodes.filter(code =>
        new Date(code.expiresAt) < now
      ).length,
      active: global.mockVerificationCodes.filter(code =>
        !code.used && new Date(code.expiresAt) > now
      ).length
    };

    return NextResponse.json({
      success: true,
      data: {
        passwordResets: {
          today: todayResets.length,
          thisWeek: weekResets.length,
          total: recentResets.length,
          recent: recentResets.slice(0, 10)
        },
        verificationCodes: codeStats,
        lastUpdated: now.toISOString()
      }
    });

  } catch (error) {
    console.error('获取密码重置统计错误:', error);

    return NextResponse.json({
      success: false,
      message: '获取统计信息失败'
    }, { status: 500 });
  }
}
