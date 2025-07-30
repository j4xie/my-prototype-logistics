import { NextRequest, NextResponse } from 'next/server';

/**
 * Mock登录API - 已禁用
 * 
 * 此API路由已被禁用，因为项目现在使用真实的后端API进行认证。
 * 所有登录请求应该通过 authService 发送到真实的后端服务器。
 * 
 * 如需重新启用mock功能，请：
 * 1. 恢复原始的mock凭据和逻辑
 * 2. 更新 NEXT_PUBLIC_USE_MOCK_API 环境变量
 */

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      message: 'Mock登录API已禁用，请使用真实后端API认证',
      error: 'MOCK_API_DISABLED'
    },
    { status: 501 } // 501 Not Implemented
  );
}

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