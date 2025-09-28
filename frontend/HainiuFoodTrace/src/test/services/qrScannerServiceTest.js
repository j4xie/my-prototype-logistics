/**
 * 二维码扫描服务逻辑测试
 */

import { QRScannerService } from '../../services/scanner/qrScannerService';

// 测试批次ID解析
function testBatchIdParsing() {
  console.log('🧪 测试批次ID解析...');
  
  const scannerService = QRScannerService.getInstance();
  
  // 测试有效的批次ID
  const validBatchId = 'FAC001-PROD-20240807-001';
  const validResult = scannerService.parseQRData(validBatchId, 'batch_id');
  
  console.log('有效批次ID解析结果:', validResult);
  
  if (validResult.isValid && 
      validResult.factoryId === 'FAC001' &&
      validResult.productType === 'PROD' &&
      validResult.date === '20240807' &&
      validResult.batchNumber === '001') {
    console.log('✅ 有效批次ID解析正确');
  } else {
    console.error('❌ 有效批次ID解析失败');
    return false;
  }
  
  // 测试无效的批次ID
  const invalidBatchId = 'INVALID-FORMAT';
  const invalidResult = scannerService.parseQRData(invalidBatchId, 'batch_id');
  
  if (!invalidResult.isValid) {
    console.log('✅ 无效批次ID正确识别');
  } else {
    console.error('❌ 无效批次ID识别失败');
    return false;
  }
  
  return true;
}

// 测试产品ID解析
function testProductIdParsing() {
  console.log('🧪 测试产品ID解析...');
  
  const scannerService = QRScannerService.getInstance();
  
  // 测试简单格式产品ID
  const simpleProductId = 'PROD-001-20240807';
  const simpleResult = scannerService.parseQRData(simpleProductId, 'product_id');
  
  console.log('简单产品ID解析结果:', simpleResult);
  
  if (simpleResult.isValid &&
      simpleResult.productCode === 'PROD' &&
      simpleResult.serialNumber === '001') {
    console.log('✅ 简单产品ID解析正确');
  } else {
    console.error('❌ 简单产品ID解析失败');
    return false;
  }
  
  // 测试JSON格式产品ID
  const jsonProductId = '{"productId":"P001","batch":"B123","date":"2024-08-07"}';
  const jsonResult = scannerService.parseQRData(jsonProductId, 'product_id');
  
  console.log('JSON产品ID解析结果:', jsonResult);
  
  if (jsonResult.productId === 'P001' && jsonResult.batch === 'B123') {
    console.log('✅ JSON产品ID解析正确');
  } else {
    console.error('❌ JSON产品ID解析失败');
    return false;
  }
  
  return true;
}

// 测试设备ID解析
function testEquipmentIdParsing() {
  console.log('🧪 测试设备ID解析...');
  
  const scannerService = QRScannerService.getInstance();
  
  // 测试设备ID
  const equipmentId = 'EQ-001-MIXER-A';
  const result = scannerService.parseQRData(equipmentId, 'equipment_id');
  
  console.log('设备ID解析结果:', result);
  
  if (result.isValid &&
      result.equipmentId === '001' &&
      result.equipmentType === 'MIXER' &&
      result.zone === 'A') {
    console.log('✅ 设备ID解析正确');
    return true;
  } else {
    console.error('❌ 设备ID解析失败');
    return false;
  }
}

// 测试通用数据解析
function testGeneralDataParsing() {
  console.log('🧪 测试通用数据解析...');
  
  const scannerService = QRScannerService.getInstance();
  
  // 测试URL解析
  const url = 'https://example.com/product?id=123&type=food';
  const urlResult = scannerService.parseQRData(url, 'general');
  
  console.log('URL解析结果:', urlResult);
  
  if (urlResult.type === 'url' && 
      urlResult.domain === 'example.com' &&
      urlResult.params.id === '123') {
    console.log('✅ URL解析正确');
  } else {
    console.error('❌ URL解析失败');
    return false;
  }
  
  // 测试纯文本解析
  const text = 'This is a test text';
  const textResult = scannerService.parseQRData(text, 'general');
  
  if (textResult.type === 'text' && 
      textResult.content === text &&
      textResult.length === text.length) {
    console.log('✅ 纯文本解析正确');
  } else {
    console.error('❌ 纯文本解析失败');
    return false;
  }
  
  return true;
}

// 测试批次ID验证
function testBatchIdValidation() {
  console.log('🧪 测试批次ID验证...');
  
  const validIds = [
    'FAC001-PROD-20240807-001',
    'FACTORY001-PRODUCT123-20240807-999'
  ];
  
  const invalidIds = [
    'invalid-format',
    'FAC001-PROD-2024-001', // 日期格式错误
    'FAC001-20240807-001',  // 缺少产品类型
  ];
  
  for (const id of validIds) {
    if (!QRScannerService.validateBatchId(id)) {
      console.error(`❌ 有效ID被误判为无效: ${id}`);
      return false;
    }
  }
  console.log('✅ 有效ID验证通过');
  
  for (const id of invalidIds) {
    if (QRScannerService.validateBatchId(id)) {
      console.error(`❌ 无效ID被误判为有效: ${id}`);
      return false;
    }
  }
  console.log('✅ 无效ID验证通过');
  
  return true;
}

// 测试批次ID生成
function testBatchIdGeneration() {
  console.log('🧪 测试批次ID生成...');
  
  const factoryId = 'FAC001';
  const productType = 'PROD';
  const date = new Date('2024-08-07');
  const sequence = 123;
  
  const generatedId = QRScannerService.generateBatchId(factoryId, productType, date, sequence);
  console.log(`生成的批次ID: ${generatedId}`);
  
  const expectedId = 'FAC001-PROD-20240807-123';
  
  if (generatedId === expectedId) {
    console.log('✅ 批次ID生成正确');
    return true;
  } else {
    console.error(`❌ 批次ID生成错误，期望: ${expectedId}, 实际: ${generatedId}`);
    return false;
  }
}

// 测试扫描历史功能
function testScanHistory() {
  console.log('🧪 测试扫描历史功能...');
  
  const scannerService = QRScannerService.getInstance();
  
  // 清空历史记录
  scannerService.clearScanHistory();
  
  // 模拟扫描记录
  const mockScanResult = {
    data: 'FAC001-PROD-20240807-001',
    type: 'qr',
    timestamp: new Date()
  };
  
  const mockBarcodeScanResult = {
    data: mockScanResult.data,
    type: mockScanResult.type,
    bounds: undefined
  };
  
  // 处理扫描结果
  const record = scannerService.handleScanResult(mockBarcodeScanResult, 'batch_id');
  
  // 检查历史记录
  const history = scannerService.getScanHistory(5);
  
  if (history.length === 1 && history[0].scanResult.data === mockScanResult.data) {
    console.log('✅ 扫描历史记录正确');
  } else {
    console.error('❌ 扫描历史记录失败');
    return false;
  }
  
  // 测试统计功能
  const stats = scannerService.getTodayStats();
  console.log('今日统计:', stats);
  
  if (stats.total === 1 && stats.byContext.batch_id === 1) {
    console.log('✅ 统计功能正确');
  } else {
    console.error('❌ 统计功能失败');
    return false;
  }
  
  // 测试搜索功能
  const searchResults = scannerService.searchHistory('FAC001');
  
  if (searchResults.length === 1) {
    console.log('✅ 搜索功能正确');
  } else {
    console.error('❌ 搜索功能失败');
    return false;
  }
  
  return true;
}

// 运行所有测试
export function runQRScannerServiceTests() {
  console.log('🚀 开始二维码扫描服务逻辑测试...\n');
  
  const tests = [
    { name: '批次ID解析', func: testBatchIdParsing },
    { name: '产品ID解析', func: testProductIdParsing },
    { name: '设备ID解析', func: testEquipmentIdParsing },
    { name: '通用数据解析', func: testGeneralDataParsing },
    { name: '批次ID验证', func: testBatchIdValidation },
    { name: '批次ID生成', func: testBatchIdGeneration },
    { name: '扫描历史功能', func: testScanHistory }
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
  
  console.log(`\n📊 二维码扫描服务测试结果:`);
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📈 成功率: ${(passed / (passed + failed) * 100).toFixed(1)}%`);
  
  return { passed, failed, total: tests.length };
}

// 如果直接运行此文件
if (typeof require !== 'undefined' && require.main === module) {
  runQRScannerServiceTests();
}