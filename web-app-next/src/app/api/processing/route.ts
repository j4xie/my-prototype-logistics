// MIGRATED TO MSW: This route has been migrated to MSW handlers
// Original file backed up and disabled on: 2025-06-04T04:13:25.822Z
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
import { NextResponse } from 'next/server';

// processing dashboard API路由
// 生成时间: 2025-06-03T15:30:00.000Z
// 模块: processing
// 实体: ProcessingDashboard

// 内联Mock数据生成器
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMockData() {
  // Dashboard不需要标准实体字段
  return {
    totalBatches: randomInt(50, 200),
    activeBatches: randomInt(5, 20),
    completedToday: randomInt(2, 8),
    totalProduction: randomInt(100000, 500000), // kg
    qualityPassRate: 92 + Math.random() * 8,
    equipmentUtilization: 75 + Math.random() * 20,
    energyConsumptionToday: randomInt(5000, 15000), // kWh
    wasteGeneratedToday: randomInt(200, 800), // kg
    alertsCount: randomInt(0, 5),
    topProducts: [
      { name: '精制面粉', quantity: randomInt(5000, 15000) },
      { name: '一级豆油', quantity: randomInt(3000, 10000) },
      { name: '花生油', quantity: randomInt(2000, 8000) }
    ],
    recentBatches: []
  };
}

export async function GET() {
  try {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

    // 生成Mock数据
    // Dashboard数据获取
    const data = generateMockData();

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('GET /processing error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

===============================================
*/