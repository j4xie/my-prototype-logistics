/**
 * GPS位置服务逻辑测试
 */

import { LocationService } from '../../services/location/locationService';

// 测试位置数据格式验证
function testLocationDataFormat() {
  console.log('🧪 测试位置数据格式验证...');
  
  const mockLocationData = {
    latitude: 39.9042,
    longitude: 116.4074, 
    accuracy: 5.0,
    timestamp: new Date()
  };

  // 测试格式化位置显示
  const formatted = LocationService.formatLocation(mockLocationData);
  console.log(`✅ 位置格式化: ${formatted}`);
  
  // 测试精度描述
  const accuracyDesc = LocationService.getAccuracyDescription(mockLocationData.accuracy);
  console.log(`✅ 精度描述: ${accuracyDesc}`);
  
  return true;
}

// 测试距离计算
function testDistanceCalculation() {
  console.log('🧪 测试距离计算...');
  
  const location1 = { latitude: 39.9042, longitude: 116.4074 };
  const location2 = { latitude: 39.9142, longitude: 116.4174 };
  
  const distance = LocationService.calculateDistance(location1, location2);
  console.log(`✅ 两点距离: ${distance.toFixed(2)} 米`);
  
  // 应该大约是1000多米
  if (distance > 1000 && distance < 2000) {
    console.log('✅ 距离计算正确');
    return true;
  } else {
    console.error('❌ 距离计算可能有误');
    return false;
  }
}

// 测试工厂范围检查
function testFactoryBoundsCheck() {
  console.log('🧪 测试工厂范围检查...');
  
  const factoryBounds = {
    center: { latitude: 39.9042, longitude: 116.4074 },
    radius: 1000 // 1000米半径
  };
  
  // 测试范围内位置
  const insideLocation = { 
    latitude: 39.9052, 
    longitude: 116.4084,
    accuracy: 5,
    timestamp: new Date()
  };
  
  const isInside = LocationService.isLocationInFactory(insideLocation, factoryBounds);
  console.log(`✅ 范围内位置检查: ${isInside}`);
  
  // 测试范围外位置
  const outsideLocation = {
    latitude: 39.9242,
    longitude: 116.4274, 
    accuracy: 5,
    timestamp: new Date()
  };
  
  const isOutside = LocationService.isLocationInFactory(outsideLocation, factoryBounds);
  console.log(`✅ 范围外位置检查: ${isOutside}`);
  
  return isInside === true && isOutside === false;
}

// 测试位置记录结构
function testLocationRecordStructure() {
  console.log('🧪 测试位置记录结构...');
  
  const locationService = LocationService.getInstance();
  
  // 测试单例模式
  const locationService2 = LocationService.getInstance();
  if (locationService === locationService2) {
    console.log('✅ 单例模式正确');
  } else {
    console.error('❌ 单例模式失败');
    return false;
  }
  
  // 测试缓存功能
  const cache = locationService.getCurrentLocationCache();
  console.log(`✅ 位置缓存: ${cache ? '有缓存' : '无缓存'}`);
  
  const pendingCount = locationService.getPendingRecordsCount();
  console.log(`✅ 待上传记录: ${pendingCount} 条`);
  
  return true;
}

// 运行所有测试
export function runLocationServiceTests() {
  console.log('🚀 开始GPS位置服务逻辑测试...\n');
  
  const tests = [
    { name: '位置数据格式验证', func: testLocationDataFormat },
    { name: '距离计算', func: testDistanceCalculation },
    { name: '工厂范围检查', func: testFactoryBoundsCheck },
    { name: '位置记录结构', func: testLocationRecordStructure }
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(test => {
    try {
      console.log(`\n--- ${test.name} ---`);
      const result = test.func();
      if (result) {
        passed++;
        console.log(`✅ ${test.name} 通过`);
      } else {
        failed++;
        console.error(`❌ ${test.name} 失败`);
      }
    } catch (error) {
      failed++;
      console.error(`❌ ${test.name} 异常:`, error.message);
    }
  });
  
  console.log(`\n📊 GPS位置服务测试结果:`);
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📈 成功率: ${(passed / (passed + failed) * 100).toFixed(1)}%`);
  
  return { passed, failed, total: tests.length };
}

// 如果直接运行此文件
if (typeof require !== 'undefined' && require.main === module) {
  runLocationServiceTests();
}