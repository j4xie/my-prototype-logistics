import { NextRequest, NextResponse } from 'next/server';

// quality-tests/[id] API路由
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

export async function GET(request: NextRequest) {
  try {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

    // 生成Mock数据
    const pathParts = request.url.split('/');
    const id = pathParts[pathParts.length - 1] || generateId();
    const data = generateMockData({ id });

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('GET /processing/quality-tests/[id] error:', error);
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
