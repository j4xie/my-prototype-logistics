/**
 * 认证API代理路由
 * 解决Vercel HTTPS到HTTP API的跨域问题
 */

import { NextRequest, NextResponse } from 'next/server';

const REAL_API_BASE = 'http://47.251.121.76:10010';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams, 'DELETE');
}

async function handleRequest(
  request: NextRequest,
  params: { path: string[] },
  method: string
) {
  const requestId = Math.random().toString(36).substr(2, 9);
  
  try {
    const path = params.path.join('/');
    const targetUrl = `${REAL_API_BASE}/${path}`;
    
    console.log(`[API Proxy ${requestId}] Starting ${method} ${targetUrl}`);
    console.log(`[API Proxy ${requestId}] Original URL: ${request.url}`);
    
    // 构建请求头 - 移除不必要的头
    const headers: Record<string, string> = {};
    
    // 只复制必要的头
    const contentType = request.headers.get('content-type');
    if (contentType) {
      headers['Content-Type'] = contentType;
    } else if (method === 'POST' || method === 'PUT') {
      headers['Content-Type'] = 'application/json';
    }
    
    // 复制认证头
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    console.log(`[API Proxy ${requestId}] Headers:`, headers);
    
    // 构建请求体
    let body: string | undefined = undefined;
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      try {
        const textBody = await request.text();
        if (textBody) {
          body = textBody;
          console.log(`[API Proxy ${requestId}] Body:`, body);
        }
      } catch (error) {
        console.log(`[API Proxy ${requestId}] No body or body read error:`, error);
      }
    }
    
    // 发送请求到真实API，增加超时
    console.log(`[API Proxy ${requestId}] Sending request...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    console.log(`[API Proxy ${requestId}] Response received - Status: ${response.status}`);
    console.log(`[API Proxy ${requestId}] Response headers:`, Object.fromEntries(response.headers.entries()));
    
    // 读取响应数据
    const responseData = await response.text();
    console.log(`[API Proxy ${requestId}] Response data:`, responseData.substring(0, 200) + (responseData.length > 200 ? '...' : ''));
    
    // 返回响应，添加CORS头
    return new NextResponse(responseData, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
    
  } catch (error) {
    console.error(`[API Proxy ${requestId}] Error:`, error);
    
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error(`[API Proxy ${requestId}] Error details:`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: '代理请求失败',
        error: errorMessage,
        requestId,
        timestamp: new Date().toISOString(),
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

// 处理OPTIONS预检请求
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 