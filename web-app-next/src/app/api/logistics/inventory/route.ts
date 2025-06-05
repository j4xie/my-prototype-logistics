// MIGRATED TO MSW: This route has been migrated to MSW handlers
// Original file backed up and disabled on: 2025-06-04T04:13:25.857Z
// New location: src/mocks/handlers/

import { NextRequest, NextResponse } from 'next/server'

// This API route has been migrated to MSW for better development experience
// and centralized mock data management.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'This API has been migrated to MSW. Please ensure MSW is enabled.',
    migrated: true,
    newLocation: 'MSW Handler',
    timestamp: new Date().toISOString()
  }, { status: 410 }) // Gone
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'This API has been migrated to MSW. Please ensure MSW is enabled.',
    migrated: true,
    newLocation: 'MSW Handler',
    timestamp: new Date().toISOString()
  }, { status: 410 })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function PUT(_request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'This API has been migrated to MSW. Please ensure MSW is enabled.',
    migrated: true,
    newLocation: 'MSW Handler',
    timestamp: new Date().toISOString()
  }, { status: 410 })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function DELETE(_request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'This API has been migrated to MSW. Please ensure MSW is enabled.',
    migrated: true,
    newLocation: 'MSW Handler',
    timestamp: new Date().toISOString()
  }, { status: 410 })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function PATCH(_request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'This API has been migrated to MSW. Please ensure MSW is enabled.',
    migrated: true,
    newLocation: 'MSW Handler',
    timestamp: new Date().toISOString()
  }, { status: 410 })
}

/*
ORIGINAL CONTENT BACKED UP:
===============================================
import { NextRequest, NextResponse } from 'next/server';

// inventory/[id] API路由
// 生成时间: 2025-06-03T14:10:37.496Z
// 模块: logistics
// 实体: InventoryItem


// 内联Mock数据生成器
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}



function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMockData(overrides: any = {}) {
  const mockData = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides
  };

  // 根据实体类型生成特定数据
  
  return {
    ...mockData,
    name: `Mock ${randomInt(1, 999)}`,
    description: 'Generated mock data'
  };
}


// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

    // 生成Mock数据
    
    // 单个资源获取
    const pathParts = request.url.split('/');
    const id = pathParts[pathParts.length - 1] || generateId();
    const data = generateMockData({ id });

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('GET /logistics/inventory/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}




// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function PUT(_request: NextRequest) {
  try {
    const body = await request.json();
    const pathParts = request.url.split('/');
    const id = pathParts[pathParts.length - 1];

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 100));

    // 生成更新后的资源
    const updatedData = generateMockData({ id, ...body });

    return NextResponse.json({
      success: true,
      data: updatedData,
      message: 'InventoryItem updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('PUT /logistics/inventory/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}


// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function DELETE(_request: NextRequest) {
  try {
    const pathParts = request.url.split('/');
    const id = pathParts[pathParts.length - 1];

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));

    // 模拟删除操作
    return NextResponse.json({
      success: true,
      data: { id },
      message: 'InventoryItem deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('DELETE /logistics/inventory/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

===============================================
*/