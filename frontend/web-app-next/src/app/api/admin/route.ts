// MIGRATED TO MSW: This route has been migrated to MSW handlers
// Original file backed up and disabled on: 2025-06-04T04:13:25.830Z
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

// dashboard API路由
// 生成时间: 2025-06-03T14:10:37.462Z
// 模块: admin
// 实体: AdminDashboard


// 内联Mock数据生成器
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMockData() {
  // 根据实体类型生成特定数据

  // Dashboard不需要标准实体字段
  return {
    fieldCount: randomInt(20, 100),
    totalArea: randomInt(5000, 50000),
    activePlantingPlans: randomInt(15, 80),
    upcomingHarvests: randomInt(5, 25),
    totalYieldThisYear: randomInt(50000, 500000),
    averageYieldPerAcre: 400 + Math.random() * 400,
    recentActivities: []
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
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
    console.error('GET /admin/dashboard error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

===============================================
*/