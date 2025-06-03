#!/usr/bin/env node

/**
 * TASK-P2-001 移动端UI适配问题修复 - 性能验证
 * 
 * @task TASK-P2-001
 * @module 移动端UI适配问题修复
 * @validation-type performance
 * @description 验证移动端UI适配的性能指标，包括加载速度、渲染性能、内存使用等
 * @reports-to refactor/phase-2/progress-reports/
 * @created 2025-05-27
 * @updated 2025-05-27
 */

const fs = require('fs');
const path = require('path');

// 验证脚本元数据
const VALIDATION_META = {
  taskId: 'TASK-P2-001',
  validationType: 'performance',
  module: '移动端UI适配问题修复',
  reportPath: 'refactor/phase-2/progress-reports/',
  version: '1.0.0'
};

// 验证配置
const VALIDATION_CONFIG = {
  name: 'TASK-P2-001-性能验证',
  targetFiles: [
    'src/utils/common/media-query-manager.js',
    'src/components/ui/TouchGesture.js',
    'src/components/ui/layout/PageLayout.js'
  ],
  checkpoints: [
    'file-size-optimization',
    'lazy-loading',
    'performance-patterns',
    'memory-efficiency'
  ],
  thresholds: {
    passRate: 85,
    maxFileSize: 50000, // 50KB
    maxComponentSize: 20000 // 20KB
  }
};

console.log(`🎯 开始执行 ${VALIDATION_CONFIG.name}...\n`);
console.log(`📋 任务ID: ${VALIDATION_META.taskId}`);
console.log(`🔧 验证类型: ${VALIDATION_META.validationType}`);
console.log(`📁 模块: ${VALIDATION_META.module}\n`);

const webAppPath = path.join(__dirname, '../../../web-app');
const validationResults = {
  timestamp: new Date().toISOString(),
  config: VALIDATION_CONFIG.name,
  meta: VALIDATION_META,
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    score: 0
  },
  details: {
    fileSizes: { passed: 0, failed: 0, items: [] },
    performancePatterns: { passed: 0, failed: 0, items: [] },
    optimization: { passed: 0, failed: 0, items: [] }
  },
  recommendations: []
};

/**
 * 检查文件大小
 */
function checkFileSize(relativePath, description, maxSize = VALIDATION_CONFIG.thresholds.maxComponentSize) {
  const fullPath = path.join(webAppPath, relativePath);
  
  validationResults.summary.total++;
  
  if (!fs.existsSync(fullPath)) {
    validationResults.details.fileSizes.failed++;
    validationResults.summary.failed++;
    console.log(`❌ ${description} - 文件不存在: ${relativePath}`);
    
    validationResults.details.fileSizes.items.push({
      path: relativePath,
      description,
      status: 'FAIL',
      reason: '文件不存在',
      size: 0,
      maxSize
    });
    return false;
  }
  
  try {
    const stats = fs.statSync(fullPath);
    const sizeBytes = stats.size;
    const sizeKB = Math.round(sizeBytes / 1024 * 100) / 100;
    const maxSizeKB = Math.round(maxSize / 1024 * 100) / 100;
    const passed = sizeBytes <= maxSize;
    
    if (passed) {
      validationResults.details.fileSizes.passed++;
      validationResults.summary.passed++;
      console.log(`✅ ${description} - 大小: ${sizeKB}KB (限制: ${maxSizeKB}KB)`);
    } else {
      validationResults.details.fileSizes.failed++;
      validationResults.summary.failed++;
      console.log(`❌ ${description} - 大小: ${sizeKB}KB 超过限制 ${maxSizeKB}KB`);
      validationResults.recommendations.push(`优化文件大小: ${relativePath} (当前: ${sizeKB}KB, 建议: <${maxSizeKB}KB)`);
    }
    
    validationResults.details.fileSizes.items.push({
      path: relativePath,
      description,
      status: passed ? 'PASS' : 'FAIL',
      size: sizeBytes,
      sizeKB: sizeKB,
      maxSize,
      maxSizeKB
    });
    
    return passed;
  } catch (error) {
    validationResults.details.fileSizes.failed++;
    validationResults.summary.failed++;
    console.log(`❌ ${description} - 读取文件失败: ${error.message}`);
    return false;
  }
}

/**
 * 检查性能模式
 */
function checkPerformancePatterns(relativePath, patterns, description) {
  const fullPath = path.join(webAppPath, relativePath);
  
  validationResults.summary.total++;
  
  if (!fs.existsSync(fullPath)) {
    validationResults.details.performancePatterns.failed++;
    validationResults.summary.failed++;
    return false;
  }
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const patternResults = patterns.map(pattern => {
      const isRegex = pattern instanceof RegExp;
      const hasPattern = isRegex ? pattern.test(content) : content.includes(pattern);
      
      return {
        pattern: isRegex ? pattern.toString() : pattern,
        found: hasPattern,
        type: isRegex ? 'regex' : 'string'
      };
    });
    
    const goodPatterns = patternResults.filter(p => p.found).length;
    const totalPatterns = patterns.length;
    const score = Math.round((goodPatterns / totalPatterns) * 100);
    const passed = score >= 70; // 至少70%的性能模式
    
    if (passed) {
      validationResults.details.performancePatterns.passed++;
      validationResults.summary.passed++;
      console.log(`✅ ${description} - 性能模式: ${goodPatterns}/${totalPatterns} (${score}%)`);
    } else {
      validationResults.details.performancePatterns.failed++;
      validationResults.summary.failed++;
      console.log(`❌ ${description} - 性能模式: ${goodPatterns}/${totalPatterns} (${score}%)`);
      validationResults.recommendations.push(`改进性能模式: ${relativePath} (当前: ${score}%, 建议: ≥70%)`);
    }
    
    validationResults.details.performancePatterns.items.push({
      path: relativePath,
      description,
      status: passed ? 'PASS' : 'FAIL',
      score,
      patterns: patternResults,
      goodPatterns,
      totalPatterns
    });
    
    return passed;
  } catch (error) {
    validationResults.details.performancePatterns.failed++;
    validationResults.summary.failed++;
    console.log(`❌ ${description} - 读取文件失败: ${error.message}`);
    return false;
  }
}

/**
 * 核心验证函数
 */
async function runValidation() {
  try {
    console.log('📊 检查文件大小优化...');
    console.log('=====================================');

    // 1. 检查文件大小
    const fileSizeChecks = [
      ['src/utils/common/media-query-manager.js', '媒体查询管理器', 15000], // 15KB
      ['src/components/ui/TouchGesture.js', '触摸手势组件', 20000], // 20KB
      ['src/components/ui/navigation/MobileNav.js', '移动端导航组件', 25000], // 25KB
      ['src/components/ui/navigation/MobileDrawer.js', '移动端抽屉组件', 20000], // 20KB
      ['src/components/ui/layout/FluidContainer.js', '流式容器组件', 10000], // 10KB
      ['src/components/ui/layout/PageLayout.js', '页面布局组件', 15000] // 15KB
    ];

    fileSizeChecks.forEach(([path, desc, maxSize]) => checkFileSize(path, desc, maxSize));

    console.log('\n⚡ 检查性能优化模式...');
    console.log('=====================================');

    // 2. 检查性能模式
    checkPerformancePatterns('src/utils/common/media-query-manager.js', [
      /useMemo/,
      /useCallback/,
      /React\.memo/,
      /lazy/,
      'debounce',
      'throttle'
    ], '媒体查询管理器性能优化');

    checkPerformancePatterns('src/components/ui/TouchGesture.js', [
      /useCallback/,
      /preventDefault/,
      /passive.*true/,
      /removeEventListener/,
      'cleanup'
    ], '触摸手势组件性能优化');

    checkPerformancePatterns('src/components/ui/layout/PageLayout.js', [
      /React\.memo/,
      /useMemo/,
      /shouldComponentUpdate/,
      'will-change',
      'transform3d'
    ], '页面布局组件性能优化');

    console.log('\n🚀 检查加载优化...');
    console.log('=====================================');

    // 3. 检查加载优化
    validationResults.summary.total++;
    const indexPath = path.join(webAppPath, 'src/components/ui/index.js');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf8');
      const hasLazyLoading = /React\.lazy|lazy\(/.test(content);
      const hasDynamicImport = /import\(/.test(content);
      const hasTreeShaking = /export.*\{/.test(content);
      
      const optimizationScore = [hasLazyLoading, hasDynamicImport, hasTreeShaking].filter(Boolean).length;
      const passed = optimizationScore >= 2; // 至少2种优化技术
      
      if (passed) {
        validationResults.details.optimization.passed++;
        validationResults.summary.passed++;
        console.log(`✅ UI组件加载优化 - 优化技术: ${optimizationScore}/3`);
      } else {
        validationResults.details.optimization.failed++;
        validationResults.summary.failed++;
        console.log(`❌ UI组件加载优化 - 优化技术: ${optimizationScore}/3`);
        validationResults.recommendations.push('增加组件懒加载和代码分割优化');
      }
      
      validationResults.details.optimization.items.push({
        path: 'src/components/ui/index.js',
        description: 'UI组件加载优化',
        status: passed ? 'PASS' : 'FAIL',
        optimizations: {
          lazyLoading: hasLazyLoading,
          dynamicImport: hasDynamicImport,
          treeShaking: hasTreeShaking
        },
        score: optimizationScore
      });
    } else {
      validationResults.details.optimization.failed++;
      validationResults.summary.failed++;
      console.log('❌ UI组件导出索引文件不存在');
    }

    // 计算总分
    validationResults.summary.score = Math.round((validationResults.summary.passed / validationResults.summary.total) * 100);
    
    console.log('\n📊 性能验证结果汇总...');
    console.log('=====================================');
    console.log(`总检查项: ${validationResults.summary.total}`);
    console.log(`通过: ${validationResults.summary.passed}`);
    console.log(`失败: ${validationResults.summary.failed}`);
    console.log(`得分: ${validationResults.summary.score}%`);
    
    if (validationResults.recommendations.length > 0) {
      console.log('\n⚠️  性能优化建议:');
      validationResults.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    // 生成报告
    await generateReport(validationResults);
    
    return validationResults;
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error);
    throw error;
  }
}

/**
 * 生成验证报告
 */
async function generateReport(results) {
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().split('T')[0];
  const reportFile = path.join(reportDir, `task-p2-001-performance-report.json`);
  
  fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
  console.log(`\n📄 性能验证报告已生成: ${reportFile}`);
}

// 执行验证
if (require.main === module) {
  runValidation()
    .then(results => {
      const success = results.summary.score >= VALIDATION_CONFIG.thresholds.passRate;
      console.log(`\n${success ? '✅' : '❌'} 性能验证完成! 总分: ${results.summary.score}%`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 性能验证失败:', error.message);
      process.exit(1);
    });
}

module.exports = { runValidation, VALIDATION_CONFIG, VALIDATION_META }; 