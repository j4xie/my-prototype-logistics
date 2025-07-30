import { NextRequest, NextResponse } from 'next/server'

/**
 * 路由权限映射配置
 * 定义各路由的访问权限要求
 */
const ROUTE_PERMISSIONS = {
  // 农业管理模块
  '/farming': { module: 'farming', level: 50 },
  '/farming/(.*)': { module: 'farming', level: 50 },
  
  // 生产加工模块
  '/processing': { module: 'processing', level: 50 },
  '/processing/(.*)': { module: 'processing', level: 50 },
  
  // 物流配送模块
  '/logistics': { module: 'logistics', level: 50 },
  '/logistics/(.*)': { module: 'logistics', level: 50 },
  
  // 产品溯源模块
  '/trace': { module: 'trace', level: 50 },
  '/trace/(.*)': { module: 'trace', level: 50 },
  
  // 系统管理模块
  '/admin': { module: 'admin', level: 10 },
  '/admin/(.*)': { module: 'admin', level: 10 },
  
  // 平台管理模块
  '/platform': { module: 'platform', level: 0 },
  '/platform/(.*)': { module: 'platform', level: 0 },
  
  // 测试页面（开发环境）
  '/test/(.*)': { level: 50 },
  
  // API调试页面
  '/api-debug': { level: 10 },
} as const;

/**
 * 检查路由权限
 */
function checkRoutePermissions(pathname: string): { module?: string; level?: number } | null {
  for (const [pattern, permissions] of Object.entries(ROUTE_PERMISSIONS)) {
    const regex = new RegExp(`^${pattern}$`);
    if (regex.test(pathname)) {
      return permissions;
    }
  }
  return null;
}

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

  // 跳过静态文件和API路由
  if (
    request.nextUrl.pathname.startsWith('/_next/') ||
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/static/') ||
    request.nextUrl.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 检查是否为预览模式
  const isPreviewMode = request.headers.get('x-preview-mode') === 'true' ||
                       request.cookies.get('preview_mode_enabled')?.value;

  // 预览模式跳过权限检查
  if (isPreviewMode) {
    const response = NextResponse.next();
    response.headers.set('x-preview-mode', 'true');
    return response;
  }

  // 检查路由权限要求
  const routePermissions = checkRoutePermissions(request.nextUrl.pathname);
  
  if (routePermissions) {
    // 添加权限要求到响应头，供客户端组件使用
    const response = NextResponse.next();
    
    if (routePermissions.module) {
      response.headers.set('x-required-module', routePermissions.module);
    }
    
    if (routePermissions.level !== undefined) {
      response.headers.set('x-required-level', routePermissions.level.toString());
    }
    
    response.headers.set('x-route-protected', 'true');
    
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/mock-status',
    '/api/:path*'
  ]
}
