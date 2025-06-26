import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // 处理Mock API状态检查端点
  if (request.nextUrl.pathname === '/api/mock-status') {
    return NextResponse.json({
      success: true,
      data: {
        available: true,
        handlers: 58,
        environment: 'mock-api',
        version: '1.0.0-baseline',
        timestamp: Date.now()
      },
      message: 'Mock API is healthy'
    }, {
      status: 200,
      headers: {
        'x-mock-enabled': 'true',
        'x-api-version': '1.0.0-baseline',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/mock-status',
    '/api/:path*'
  ]
}
