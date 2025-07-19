import { NextRequest, NextResponse } from 'next/server';

interface VerifyResetCodeRequest {
  email: string;
  code: string;
}

interface VerifyResetCodeResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
    verified: boolean;
  };
}

// 导入验证码存储（与send-reset-code共享）
// 实际应用中应使用共享的Redis或数据库
declare global {
  // eslint-disable-next-line no-var
  var mockVerificationCodes: Array<{
    email: string;
    code: string;
    createdAt: string;
    expiresAt: string;
    used: boolean;
  }>;
}

// 初始化全局变量（如果不存在）
if (!global.mockVerificationCodes) {
  global.mockVerificationCodes = [];
}

export async function POST(request: NextRequest): Promise<NextResponse<VerifyResetCodeResponse>> {
  try {
    const body: VerifyResetCodeRequest = await request.json();
    const { email, code } = body;

    // 验证输入参数
    if (!email || !code) {
      return NextResponse.json({
        success: false,
        message: '邮箱和验证码不能为空'
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

    // 查找匹配的验证码
    const codeRecord = global.mockVerificationCodes
      .filter(record => record.email === email && record.code === code && !record.used)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!codeRecord) {
      // 记录验证失败
      console.log('验证码验证失败:', {
        email,
        code,
        reason: '验证码不存在或已使用',
        timestamp: new Date().toISOString()
      });

      return NextResponse.json({
        success: false,
        message: '验证码错误或已失效'
      }, { status: 400 });
    }

    // 检查验证码是否过期
    const now = new Date();
    const expiresAt = new Date(codeRecord.expiresAt);

    if (now > expiresAt) {
      // 记录过期
      console.log('验证码已过期:', {
        email,
        code,
        expiresAt: codeRecord.expiresAt,
        currentTime: now.toISOString()
      });

      return NextResponse.json({
        success: false,
        message: '验证码已过期，请重新获取'
      }, { status: 400 });
    }

    // 标记验证码为已使用
    codeRecord.used = true;

    // 记录验证成功
    console.log('验证码验证成功:', {
      email,
      code,
      timestamp: now.toISOString()
    });

    return NextResponse.json({
      success: true,
      message: '验证码验证成功',
      data: {
        email,
        verified: true
      }
    });

  } catch (error) {
    console.error('验证码验证API错误:', error);

    return NextResponse.json({
      success: false,
      message: '服务器内部错误，请稍后重试'
    }, { status: 500 });
  }
}

// 获取验证码状态（调试用）
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({
        success: false,
        message: '请提供邮箱地址'
      }, { status: 400 });
    }

    // 查找该邮箱的所有验证码记录
    const userCodes = global.mockVerificationCodes
      .filter(record => record.email === email)
      .map(record => ({
        code: record.code.replace(/\d{4}/, '****'), // 隐藏部分验证码
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        used: record.used,
        expired: new Date() > new Date(record.expiresAt)
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      data: {
        email,
        codes: userCodes,
        total: userCodes.length,
        activeCount: userCodes.filter(code => !code.used && !code.expired).length
      }
    });

  } catch (error) {
    console.error('获取验证码状态错误:', error);

    return NextResponse.json({
      success: false,
      message: '获取状态失败'
    }, { status: 500 });
  }
}
