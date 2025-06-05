import { NextRequest, NextResponse } from 'next/server';

// finished-products API路由
// 生成时间: 2025-06-03T15:30:00.000Z
// 模块: processing
// 实体: FinishedProduct

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
    name: randomChoice(['精制面粉', '一级豆油', '压榨花生油', '特级玉米油', '大豆分离蛋白']),
    code: `FP${randomInt(10000, 99999)}`,
    batchId: generateId(),
    category: randomChoice(['flour', 'oil', 'protein', 'seasoning']),
    specification: randomChoice(['500g', '1kg', '5kg', '10kg', '25kg']),
    productionDate: new Date(Date.now() - randomInt(1, 15) * 24 * 60 * 60 * 1000).toISOString(),
    expiryDate: new Date(Date.now() + randomInt(180, 730) * 24 * 60 * 60 * 1000).toISOString(),
    quantity: randomInt(1000, 10000),
    unit: randomChoice(['bottle', 'bag', 'box', 'can']),
    costPerUnit: 8 + Math.random() * 15,
    sellingPricePerUnit: 12 + Math.random() * 20,
    qualityGrade: randomChoice(['优等品', '一等品', '合格品']),
    nutritionInfo: {
      protein: 8 + Math.random() * 20,
      fat: 5 + Math.random() * 30,
      carbohydrate: 40 + Math.random() * 50,
      calories: randomInt(300, 600)
    },
    storageRequirements: randomChoice(['常温', '冷藏', '冷冻']),
    packagingType: randomChoice(['瓶装', '袋装', '盒装', '罐装']),
    barcode: `69${randomInt(100000000000, 999999999999)}`,
    status: randomChoice(['in-stock', 'shipped', 'sold']),
    description: '优质产品，营养丰富'
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
    console.error('GET /processing/finished-products error:', error);
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
      message: 'FinishedProduct created successfully',
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('POST /processing/finished-products error:', error);
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
      message: 'FinishedProduct updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('PUT /processing/finished-products/[id] error:', error);
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
      message: 'FinishedProduct deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('DELETE /processing/finished-products/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
