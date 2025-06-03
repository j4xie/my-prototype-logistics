import { NextRequest, NextResponse } from 'next/server';

// production-batches API路由
// 生成时间: 2025-06-03T15:30:00.000Z
// 模块: processing
// 实体: ProductionBatch

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
    batchNumber: `PB${new Date().getFullYear()}${String(Date.now()).slice(-6)}`,
    productType: randomChoice(['面粉', '豆油', '花生油', '玉米油', '大豆蛋白']),
    rawMaterialIds: Array.from({length: randomInt(2, 5)}, () => generateId()),
    startDate: new Date(Date.now() - randomInt(1, 7) * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + randomInt(1, 3) * 24 * 60 * 60 * 1000).toISOString(),
    plannedQuantity: randomInt(5000, 20000),
    actualQuantity: randomInt(4500, 19500),
    productionLine: `生产线${randomInt(1, 8)}`,
    supervisor: `生产主管${randomInt(1, 20)}`,
    shift: randomChoice(['早班', '中班', '夜班']),
    status: randomChoice(['planned', 'in-progress', 'completed', 'quality-check', 'approved']),
    qualityScore: 85 + Math.random() * 15,
    efficiency: 80 + Math.random() * 20,
    energyConsumption: randomInt(1000, 5000), // kWh
    wasteGenerated: randomInt(50, 500), // kg
    notes: '生产过程正常，质量稳定'
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
    console.error('GET /processing/production-batches error:', error);
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
      message: 'ProductionBatch created successfully',
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('POST /processing/production-batches error:', error);
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
      message: 'ProductionBatch updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('PUT /processing/production-batches/[id] error:', error);
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
      message: 'ProductionBatch deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('DELETE /processing/production-batches/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
