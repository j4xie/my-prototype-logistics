// MIGRATED TO MSW: This route has been migrated to MSW handlers
// Original file backed up and disabled on: 2025-06-04T04:13:25.847Z
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

// quality-tests API路由
// 生成时间: 2025-06-03T15:30:00.000Z
// 模块: processing
// 实体: QualityTest

// 内联Mock数据生成器
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function randomChoice(array: any[]) {
  return array[Math.floor(Math.random() * array.length)];
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

  return {
    ...mockData,
    testNumber: `QT${new Date().getFullYear()}${String(Date.now()).slice(-6)}`,
    productId: generateId(),
    productType: randomChoice(['raw-material', 'finished-product', 'intermediate']),
    testType: randomChoice(['incoming', 'in-process', 'final', 'stability']),
    testDate: new Date(Date.now() - randomInt(1, 7) * 24 * 60 * 60 * 1000).toISOString(),
    tester: `质检员${randomInt(1, 15)}`,
    testParameters: [
      {
        parameter: '水分含量',
        standardValue: '≤12%',
        actualValue: `${(10 + Math.random() * 3).toFixed(1)}%`,
        result: randomChoice(['合格', '不合格'])
      },
      {
        parameter: '蛋白质含量',
        standardValue: '≥85%',
        actualValue: `${(85 + Math.random() * 10).toFixed(1)}%`,
        result: randomChoice(['合格', '不合格'])
      },
      {
        parameter: '酸价',
        standardValue: '≤4mg KOH/g',
        actualValue: `${(2 + Math.random() * 3).toFixed(1)}mg KOH/g`,
        result: randomChoice(['合格', '不合格'])
      }
    ],
    overallResult: randomChoice(['合格', '不合格', '待复检']),
    qualityScore: 75 + Math.random() * 25,
    notes: '检测过程规范，结果可靠',
    certificateNumber: `CERT${randomInt(100000, 999999)}`,
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    status: randomChoice(['pending', 'completed', 'approved', 'rejected'])
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search') || '';

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

    // 生成Mock数据
    const total = 50 + Math.floor(Math.random() * 100);
    const data = Array.from({ length: Math.min(pageSize, total) }, () =>
      generateMockData()
    );

    // 搜索过滤
    const filteredData = search
      ? data.filter(item => JSON.stringify(item).toLowerCase().includes(search.toLowerCase()))
      : data;

    return NextResponse.json({
      success: true,
      data: filteredData,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('GET /processing/quality-tests error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  try {
    const body = await request.json();

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));

    // 验证必填字段 (简化版)
    if (!body) {
      return NextResponse.json({
        success: false,
        message: 'Request body is required',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // 生成新资源
    const newData = generateMockData(body);

    return NextResponse.json({
      success: true,
      data: newData,
      message: 'QualityTest created successfully',
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('POST /processing/quality-tests error:', error);
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
      message: 'QualityTest updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('PUT /processing/quality-tests/[id] error:', error);
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
      message: 'QualityTest deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('DELETE /processing/quality-tests/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

===============================================
*/