import { NextRequest, NextResponse } from 'next/server';

// raw-materials API路由
// 生成时间: 2025-06-03T15:30:00.000Z
// 模块: processing
// 实体: RawMaterial

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

  // 根据实体类型生成特定数据
  return {
    ...mockData,
    name: randomChoice(['大豆', '玉米', '小麦', '水稻', '花生', '菜籽']),
    code: `RM${randomInt(10000, 99999)}`,
    category: randomChoice(['grain', 'seeds', 'nuts', 'vegetables']),
    origin: randomChoice(['山东', '黑龙江', '吉林', '河南', '内蒙古']),
    supplier: `供应商${randomInt(1, 50)}`,
    purchaseDate: new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000).toISOString(),
    expiryDate: new Date(Date.now() + randomInt(30, 365) * 24 * 60 * 60 * 1000).toISOString(),
    quantity: randomInt(1000, 50000),
    unit: randomChoice(['kg', 'ton', 'bag', 'box']),
    pricePerUnit: 5 + Math.random() * 20,
    totalValue: 0, // 计算得出
    qualityGrade: randomChoice(['A', 'B', 'C']),
    moistureContent: 10 + Math.random() * 5,
    storageLocation: `仓库${randomInt(1, 10)}区域${randomInt(1, 20)}`,
    certifications: ['有机认证', '质量安全认证'],
    description: '优质原料，严格质检'
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search') || '';

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

    // 生成Mock数据
    // 列表资源获取
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
    console.error('GET /processing/raw-materials error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
      message: 'RawMaterial created successfully',
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('POST /processing/raw-materials error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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
      message: 'RawMaterial updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('PUT /processing/raw-materials/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const pathParts = request.url.split('/');
    const id = pathParts[pathParts.length - 1];

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));

    // 模拟删除操作
    return NextResponse.json({
      success: true,
      data: { id },
      message: 'RawMaterial deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('DELETE /processing/raw-materials/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
