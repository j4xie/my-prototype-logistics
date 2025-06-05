import { NextRequest, NextResponse } from 'next/server';

// crops/[id] API路由
// 生成时间: 2025-06-03T14:10:37.450Z
// 模块: farming
// 实体: Crop


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
  
  const cropNames = ['玉米', '小麦', '大豆', '水稻'];
  const cropName = randomChoice(cropNames);
  return {
    ...mockData,
    name: cropName,
    variety: `${cropName}优质品种`,
    category: randomChoice(['grain', 'vegetable', 'fruit', 'cash', 'feed']),
    growthCycle: randomInt(90, 180),
    description: `${cropName}，适应性强，产量稳定`,
    requirements: {
      minTemperature: randomInt(5, 15),
      maxTemperature: randomInt(25, 35),
      waterNeed: randomChoice(['low', 'medium', 'high']),
      lightRequirement: randomChoice(['full', 'partial', 'shade']),
      soilType: ['loam', 'clay']
    },
    nutritionInfo: {
      protein: 8 + Math.random() * 20,
      carbohydrate: 50 + Math.random() * 30,
      fat: 1 + Math.random() * 10,
      calories: randomInt(200, 400)
    }
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
    console.error('GET /farming/crops/[id] error:', error);
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
      message: 'Crop updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('PUT /farming/crops/[id] error:', error);
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
      message: 'Crop deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('DELETE /farming/crops/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
