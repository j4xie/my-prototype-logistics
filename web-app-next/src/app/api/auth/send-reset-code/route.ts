import { NextRequest, NextResponse } from 'next/server';

interface SendResetCodeRequest {
  email: string;
}

interface SendResetCodeResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
    expiresAt: string;
  };
}

// Mock验证码存储（实际应用中应使用Redis等缓存）
const mockVerificationCodes: Array<{
  email: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
}> = [];

// 生成6位数字验证码
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 模拟发送邮件
async function sendEmailMock(email: string, code: string): Promise<boolean> {
  // 实际应用中这里应该调用邮件服务API
  console.log(`模拟发送验证码邮件到 ${email}:`);
  console.log(`验证码: ${code}`);
  console.log(`有效期: 10分钟`);

  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 500));

  return true; // 模拟发送成功
}

export async function POST(request: NextRequest): Promise<NextResponse<SendResetCodeResponse>> {
  try {
    const body: SendResetCodeRequest = await request.json();
    const { email } = body;

    // 验证邮箱格式
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({
        success: false,
        message: '请输入有效的邮箱地址'
      }, { status: 400 });
    }

    // 检查是否最近已发送过验证码（防刷机制）
    const recentCode = mockVerificationCodes
      .filter(code => code.email === email && !code.used)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (recentCode) {
      const timeDiff = Date.now() - new Date(recentCode.createdAt).getTime();
      const remainingTime = 60000 - timeDiff; // 60秒限制

      if (remainingTime > 0) {
        return NextResponse.json({
          success: false,
          message: `请等待 ${Math.ceil(remainingTime / 1000)} 秒后再重新发送`
        }, { status: 429 });
      }
    }

    // 生成验证码
    const verificationCode = generateVerificationCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10分钟后过期

    // 存储验证码
    const codeRecord = {
      email,
      code: verificationCode,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      used: false
    };

    mockVerificationCodes.push(codeRecord);

    // 发送邮件
    try {
      const emailSent = await sendEmailMock(email, verificationCode);

      if (!emailSent) {
        return NextResponse.json({
          success: false,
          message: '邮件发送失败，请稍后重试'
        }, { status: 500 });
      }

      // 记录日志
      console.log('密码重置验证码发送成功:', {
        email,
        timestamp: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      });

      return NextResponse.json({
        success: true,
        message: '验证码已发送到您的邮箱',
        data: {
          email,
          expiresAt: expiresAt.toISOString()
        }
      });

    } catch (error) {
      console.error('发送邮件错误:', error);

      return NextResponse.json({
        success: false,
        message: '邮件发送服务暂时不可用，请稍后重试'
      }, { status: 503 });
    }

  } catch (error) {
    console.error('发送重置验证码API错误:', error);

    return NextResponse.json({
      success: false,
      message: '服务器内部错误，请稍后重试'
    }, { status: 500 });
  }
}

// 清理过期验证码的定期任务
export async function DELETE(): Promise<NextResponse> {
  try {
    const now = new Date();
    const beforeCount = mockVerificationCodes.length;

    // 删除过期的验证码
    for (let i = mockVerificationCodes.length - 1; i >= 0; i--) {
      const code = mockVerificationCodes[i];
      if (new Date(code.expiresAt) < now || code.used) {
        mockVerificationCodes.splice(i, 1);
      }
    }

    const afterCount = mockVerificationCodes.length;
    const cleanedCount = beforeCount - afterCount;

    console.log(`清理过期验证码: ${cleanedCount} 个`);

    return NextResponse.json({
      success: true,
      message: `清理了 ${cleanedCount} 个过期验证码`,
      data: {
        cleaned: cleanedCount,
        remaining: afterCount
      }
    });

  } catch (error) {
    console.error('清理验证码错误:', error);

    return NextResponse.json({
      success: false,
      message: '清理操作失败'
    }, { status: 500 });
  }
}
