import { NextRequest, NextResponse } from 'next/server';

// farm-activities/[id] API路由
// 生成时间: 2025-06-03T14:10:37.457Z
// 模块: farming
// 实体: FarmActivity


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


export async function GET(request: NextRequest) {
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
    console.error('GET /farming/farm-activities/[id] error:', error);
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
      message: 'FarmActivity updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('PUT /farming/farm-activities/[id] error:', error);
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
      message: 'FarmActivity deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('DELETE /farming/farm-activities/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
