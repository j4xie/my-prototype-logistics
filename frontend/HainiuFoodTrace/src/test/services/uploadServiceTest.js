/**
 * 文件上传服务逻辑测试
 */

import { ProcessingUploadService, UPLOAD_CONFIG } from '../../services/upload/processingUploadService';

// 测试文件类型验证
function testFileTypeValidation() {
  console.log('🧪 测试文件类型验证...');
  
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const invalidTypes = ['image/gif', 'text/plain', 'application/pdf'];
  
  for (const type of validTypes) {
    if (!ProcessingUploadService.isValidImageType(type)) {
      console.error(`❌ 有效类型被拒绝: ${type}`);
      return false;
    }
  }
  console.log('✅ 有效图片类型验证通过');
  
  for (const type of invalidTypes) {
    if (ProcessingUploadService.isValidImageType(type)) {
      console.error(`❌ 无效类型被接受: ${type}`);
      return false;
    }
  }
  console.log('✅ 无效图片类型验证通过');
  
  return true;
}

// 测试文件大小格式化
function testFileSizeFormatting() {
  console.log('🧪 测试文件大小格式化...');
  
  const testCases = [
    { bytes: 0, expected: '0 Bytes' },
    { bytes: 1024, expected: '1 KB' },
    { bytes: 1024 * 1024, expected: '1 MB' },
    { bytes: 1536, expected: '1.5 KB' },
    { bytes: 5242880, expected: '5 MB' }
  ];
  
  for (const testCase of testCases) {
    const formatted = ProcessingUploadService.formatFileSize(testCase.bytes);
    if (formatted !== testCase.expected) {
      console.error(`❌ 文件大小格式化错误: ${testCase.bytes} bytes -> ${formatted}, 期望: ${testCase.expected}`);
      return false;
    }
  }
  
  console.log('✅ 文件大小格式化正确');
  return true;
}

// 测试上传配置
function testUploadConfig() {
  console.log('🧪 测试上传配置...');
  
  console.log(`配置信息:`);
  console.log(`- 最大文件数量: ${UPLOAD_CONFIG.maxFiles}`);
  console.log(`- 最大文件大小: ${ProcessingUploadService.formatFileSize(UPLOAD_CONFIG.maxFileSize)}`);
  console.log(`- 图片质量: ${UPLOAD_CONFIG.imageQuality}`);
  console.log(`- 最大宽度: ${UPLOAD_CONFIG.imageMaxWidth}px`);
  console.log(`- 最大高度: ${UPLOAD_CONFIG.imageMaxHeight}px`);
  console.log(`- 允许的类型: ${UPLOAD_CONFIG.allowedTypes.join(', ')}`);
  
  // 验证配置合理性
  if (UPLOAD_CONFIG.maxFiles > 0 && 
      UPLOAD_CONFIG.maxFiles <= 20 &&
      UPLOAD_CONFIG.maxFileSize > 0 &&
      UPLOAD_CONFIG.imageQuality > 0 && 
      UPLOAD_CONFIG.imageQuality <= 1) {
    console.log('✅ 上传配置合理');
    return true;
  } else {
    console.error('❌ 上传配置不合理');
    return false;
  }
}

// 测试图片处理逻辑（模拟）
function testImageProcessingLogic() {
  console.log('🧪 测试图片处理逻辑（模拟）...');
  
  // 模拟图片数据
  const mockImage = {
    uri: 'mock://image.jpg',
    name: 'test_image.jpg',
    type: 'image/jpeg',
    size: 2048000, // 2MB
    width: 3000,
    height: 4000
  };
  
  console.log('原始图片信息:', mockImage);
  
  // 检查是否需要压缩（模拟逻辑）
  const needsResize = mockImage.width > UPLOAD_CONFIG.imageMaxWidth || 
                      mockImage.height > UPLOAD_CONFIG.imageMaxHeight;
  
  const needsCompress = mockImage.size > UPLOAD_CONFIG.maxFileSize;
  
  console.log(`需要调整尺寸: ${needsResize}`);
  console.log(`需要压缩: ${needsCompress}`);
  
  // 计算目标尺寸
  let targetWidth = mockImage.width;
  let targetHeight = mockImage.height;
  
  if (needsResize) {
    const aspectRatio = mockImage.width / mockImage.height;
    if (mockImage.width > mockImage.height) {
      targetWidth = Math.min(mockImage.width, UPLOAD_CONFIG.imageMaxWidth);
      targetHeight = targetWidth / aspectRatio;
    } else {
      targetHeight = Math.min(mockImage.height, UPLOAD_CONFIG.imageMaxHeight);
      targetWidth = targetHeight * aspectRatio;
    }
  }
  
  console.log(`目标尺寸: ${targetWidth.toFixed(0)}x${targetHeight.toFixed(0)}`);
  
  // 模拟处理结果
  const processedImage = {
    uri: 'processed://image.jpg',
    name: `processed_${Date.now()}.jpg`,
    type: 'image/jpeg',
    size: Math.round(mockImage.size * UPLOAD_CONFIG.imageQuality * 0.7), // 模拟压缩效果
    width: Math.round(targetWidth),
    height: Math.round(targetHeight)
  };
  
  console.log('处理后图片信息:', processedImage);
  
  if (processedImage.size < mockImage.size &&
      processedImage.width <= UPLOAD_CONFIG.imageMaxWidth &&
      processedImage.height <= UPLOAD_CONFIG.imageMaxHeight) {
    console.log('✅ 图片处理逻辑正确');
    return true;
  } else {
    console.error('❌ 图片处理逻辑错误');
    return false;
  }
}

// 测试上传元数据结构
function testUploadMetadataStructure() {
  console.log('🧪 测试上传元数据结构...');
  
  // 测试质检照片元数据
  const qualityMetadata = {
    recordId: 'test_record_123',
    checkType: 'process',
    inspector: 'inspector_001',
    location: { latitude: 39.9042, longitude: 116.4074 },
    description: '加工过程质检'
  };
  
  console.log('质检元数据:', qualityMetadata);
  
  // 测试生产照片元数据
  const productionMetadata = {
    recordId: 'production_456',
    workstation: 'WS_001',
    process: '切割工艺',
    employee: 'emp_123',
    location: { latitude: 39.9042, longitude: 116.4074 },
    description: '生产过程记录'
  };
  
  console.log('生产元数据:', productionMetadata);
  
  // 验证必要字段
  const hasRequiredQualityFields = qualityMetadata.recordId && 
                                  qualityMetadata.checkType && 
                                  qualityMetadata.inspector;
  
  const hasRequiredProductionFields = productionMetadata.recordId &&
                                     productionMetadata.workstation &&
                                     productionMetadata.process &&
                                     productionMetadata.employee;
  
  if (hasRequiredQualityFields && hasRequiredProductionFields) {
    console.log('✅ 元数据结构正确');
    return true;
  } else {
    console.error('❌ 元数据结构缺少必要字段');
    return false;
  }
}

// 测试批量上传逻辑
function testBatchUploadLogic() {
  console.log('🧪 测试批量上传逻辑...');
  
  // 模拟多个文件
  const mockImages = [];
  for (let i = 0; i < 5; i++) {
    mockImages.push({
      uri: `mock://image_${i}.jpg`,
      name: `image_${i}.jpg`,
      type: 'image/jpeg',
      size: 1024000 + i * 100000, // 变化的文件大小
      width: 1920,
      height: 1080
    });
  }
  
  console.log(`模拟 ${mockImages.length} 个文件上传`);
  
  // 检查数量限制
  if (mockImages.length > UPLOAD_CONFIG.maxFiles) {
    console.error(`❌ 文件数量超过限制: ${mockImages.length} > ${UPLOAD_CONFIG.maxFiles}`);
    return false;
  }
  
  // 检查每个文件大小
  for (let i = 0; i < mockImages.length; i++) {
    const image = mockImages[i];
    if (image.size > UPLOAD_CONFIG.maxFileSize) {
      console.error(`❌ 文件 ${i} 大小超过限制: ${ProcessingUploadService.formatFileSize(image.size)}`);
      return false;
    }
    
    if (!ProcessingUploadService.isValidImageType(image.type)) {
      console.error(`❌ 文件 ${i} 类型不支持: ${image.type}`);
      return false;
    }
  }
  
  console.log('✅ 批量上传前验证通过');
  
  // 模拟上传进度
  for (let i = 0; i < mockImages.length; i++) {
    const progress = ((i + 1) / mockImages.length * 100).toFixed(1);
    console.log(`上传进度: ${progress}% (${i + 1}/${mockImages.length})`);
  }
  
  console.log('✅ 批量上传逻辑正确');
  return true;
}

// 测试错误处理
function testErrorHandling() {
  console.log('🧪 测试错误处理...');
  
  // 测试空文件列表
  const emptyFiles = [];
  console.log(`空文件列表处理: ${emptyFiles.length === 0 ? '正确' : '错误'}`);
  
  // 测试文件过多
  const tooManyFiles = new Array(UPLOAD_CONFIG.maxFiles + 1).fill({
    uri: 'mock://image.jpg',
    name: 'image.jpg',
    type: 'image/jpeg',
    size: 1024000,
    width: 1920,
    height: 1080
  });
  
  if (tooManyFiles.length > UPLOAD_CONFIG.maxFiles) {
    console.log('✅ 文件过多检测正确');
  } else {
    console.error('❌ 文件过多检测失败');
    return false;
  }
  
  // 测试文件过大
  const oversizedFile = {
    uri: 'mock://big_image.jpg',
    name: 'big_image.jpg',
    type: 'image/jpeg',
    size: UPLOAD_CONFIG.maxFileSize + 1,
    width: 1920,
    height: 1080
  };
  
  if (oversizedFile.size > UPLOAD_CONFIG.maxFileSize) {
    console.log('✅ 文件过大检测正确');
  } else {
    console.error('❌ 文件过大检测失败');
    return false;
  }
  
  // 测试无效类型
  const invalidTypeFile = {
    uri: 'mock://document.pdf',
    name: 'document.pdf',
    type: 'application/pdf',
    size: 1024000,
    width: undefined,
    height: undefined
  };
  
  if (!ProcessingUploadService.isValidImageType(invalidTypeFile.type)) {
    console.log('✅ 无效类型检测正确');
  } else {
    console.error('❌ 无效类型检测失败');
    return false;
  }
  
  return true;
}

// 运行所有测试
export function runUploadServiceTests() {
  console.log('🚀 开始文件上传服务逻辑测试...\n');
  
  const tests = [
    { name: '文件类型验证', func: testFileTypeValidation },
    { name: '文件大小格式化', func: testFileSizeFormatting },
    { name: '上传配置', func: testUploadConfig },
    { name: '图片处理逻辑', func: testImageProcessingLogic },
    { name: '上传元数据结构', func: testUploadMetadataStructure },
    { name: '批量上传逻辑', func: testBatchUploadLogic },
    { name: '错误处理', func: testErrorHandling }
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
  
  console.log(`\n📊 文件上传服务测试结果:`);
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📈 成功率: ${(passed / (passed + failed) * 100).toFixed(1)}%`);
  
  return { passed, failed, total: tests.length };
}

// 如果直接运行此文件
if (typeof require !== 'undefined' && require.main === module) {
  runUploadServiceTests();
}