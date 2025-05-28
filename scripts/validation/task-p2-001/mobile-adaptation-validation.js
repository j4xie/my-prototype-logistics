#!/usr/bin/env node

/**
 * TASK-P2-001 移动端UI适配问题修复 - 移动端适配验证
 * 
 * @task TASK-P2-001
 * @module 移动端UI适配问题修复
 * @validation-type mobile-adaptation
 * @description 验证移动端UI适配的完成效果，包括响应式布局、触摸支持、导航组件等
 * @reports-to refactor/phase-2/progress-reports/
 * @created 2025-05-27
 * @updated 2025-05-27
 */

const fs = require('fs');
const path = require('path');

// 验证脚本元数据
const VALIDATION_META = {
  taskId: 'TASK-P2-001',
  validationType: 'mobile-adaptation',
  module: '移动端UI适配问题修复',
  reportPath: 'refactor/phase-2/progress-reports/',
  version: '1.0.0'
};

// 验证配置
const VALIDATION_CONFIG = {
  name: 'TASK-P2-001-移动端适配验证',
  targetFiles: [
    'src/utils/common/media-query-manager.js',
    'src/components/ui/TouchGesture.js',
    'src/components/ui/navigation/MobileNav.js',
    'src/components/ui/navigation/MobileDrawer.js',
    'src/components/ui/layout/FluidContainer.js',
    'src/components/ui/layout/PageLayout.js'
  ],
  checkpoints: [
    'files-existence',
    'component-functionality', 
    'responsive-design',
    'touch-support',
    'navigation-components'
  ],
  thresholds: {
    passRate: 95,
    criticalComponents: 100
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
    files: { passed: 0, failed: 0, items: [] },
    components: { passed: 0, failed: 0, items: [] },
    responsiveDesign: { passed: 0, failed: 0, items: [] },
    touchSupport: { passed: 0, failed: 0, items: [] },
    navigation: { passed: 0, failed: 0, items: [] }
  },
  recommendations: []
};

/**
 * 检查文件是否存在
 */
function checkFile(relativePath, description, critical = false) {
  const fullPath = path.join(webAppPath, relativePath);
  const exists = fs.existsSync(fullPath);
  
  const result = {
    path: relativePath,
    description,
    status: exists ? 'PASS' : 'FAIL',
    critical,
    exists
  };
  
  validationResults.summary.total++;
  
  if (exists) {
    validationResults.details.files.passed++;
    validationResults.summary.passed++;
    console.log(`✅ ${description}`);
  } else {
    validationResults.details.files.failed++;
    validationResults.summary.failed++;
    console.log(`❌ ${description} - 文件不存在: ${relativePath}`);
    
    if (critical) {
      validationResults.recommendations.push(`紧急: 缺少关键文件 ${relativePath}`);
    }
  }
  
  validationResults.details.files.items.push(result);
  return exists;
}

/**
 * 检查文件内容
 */
function checkFileContent(relativePath, checks, description, critical = false) {
  const fullPath = path.join(webAppPath, relativePath);
  
  validationResults.summary.total++;
  
  if (!fs.existsSync(fullPath)) {
    validationResults.details.components.failed++;
    validationResults.summary.failed++;
    validationResults.details.components.items.push({
      path: relativePath,
      description,
      status: 'FAIL',
      critical,
      reason: '文件不存在'
    });
    return false;
  }
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const checkResults = checks.map(check => {
      if (typeof check === 'string') {
        return { check, passed: content.includes(check) };
      } else if (check instanceof RegExp) {
        return { check: check.toString(), passed: check.test(content) };
      }
      return { check, passed: false };
    });
    
    const allChecksPassed = checkResults.every(result => result.passed);
    
    if (allChecksPassed) {
      validationResults.details.components.passed++;
      validationResults.summary.passed++;
      console.log(`✅ ${description}`);
    } else {
      validationResults.details.components.failed++;
      validationResults.summary.failed++;
      console.log(`❌ ${description} - 内容检查失败`);
      
      if (critical) {
        validationResults.recommendations.push(`紧急: ${description} 功能不完整`);
      }
    }
    
    validationResults.details.components.items.push({
      path: relativePath,
      description,
      status: allChecksPassed ? 'PASS' : 'FAIL',
      critical,
      checks: checkResults
    });
    
    return allChecksPassed;
  } catch (error) {
    validationResults.details.components.failed++;
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
    console.log('📁 检查关键文件存在性...');
    console.log('=====================================');

    // 1. 检查核心文件存在性
    const coreFiles = [
      ['src/utils/common/media-query-manager.js', '媒体查询管理器', true],
      ['src/components/ui/index.js', 'UI组件导出索引', true],
      ['src/components/ui/TouchGesture.js', '触摸手势组件', true],
      ['src/components/ui/MobileSearch.js', '移动端搜索组件', false],
      ['src/components/ui/navigation/MobileNav.js', '移动端导航组件', true],
      ['src/components/ui/navigation/MobileDrawer.js', '移动端抽屉组件', true],
      ['src/components/ui/layout/FluidContainer.js', '流式容器组件', true],
      ['src/components/ui/layout/PageLayout.js', '页面布局组件', true]
    ];

    coreFiles.forEach(([path, desc, critical]) => checkFile(path, desc, critical));

    console.log('\n🧩 检查组件功能实现...');
    console.log('=====================================');

    // 2. 检查组件功能实现
    checkFileContent('src/utils/common/media-query-manager.js', [
      'BREAKPOINTS',
      'isMobile()',
      'isTablet()',
      'isDesktop()',
      'isTouchDevice()',
      'max-w-[390px]'
    ], '媒体查询管理器功能完整性', true);

    checkFileContent('src/components/ui/TouchGesture.js', [
      'onTap',
      'onDoubleTap',
      'onLongPress',
      'onSwipeLeft',
      'onSwipeRight',
      'touchstart',
      'touchmove',
      'touchend'
    ], '触摸手势支持完整性', true);

    checkFileContent('src/components/ui/navigation/MobileDrawer.js', [
      'position',
      'enableSwipeToClose',
      'closeOnOverlayClick',
      'TouchGesture',
      'max-w-[390px]',
      'role="dialog"',
      'aria-modal="true"'
    ], '移动端抽屉组件功能', true);

    checkFileContent('src/components/ui/layout/FluidContainer.js', [
      'max-w-[390px]',
      'mx-auto',
      'responsive',
      /@media/
    ], '流式容器响应式布局', true);

    console.log('\n📱 检查响应式设计实现...');
    console.log('=====================================');

    // 3. 检查响应式设计模式
    const responsiveChecks = [
      {
        file: 'src/components/ui/layout/PageLayout.js',
        patterns: [
          /pt-\[80px\]/,
          /pb-\[80px\]/,
          /max-w-\[390px\]/,
          /flex flex-col min-h-screen/
        ],
        description: '页面布局响应式规范',
        critical: true
      }
    ];

    responsiveChecks.forEach(check => {
      validationResults.summary.total++;
      const fullPath = path.join(webAppPath, check.file);
      
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const passed = check.patterns.every(pattern => pattern.test(content));
        
        if (passed) {
          validationResults.details.responsiveDesign.passed++;
          validationResults.summary.passed++;
          console.log(`✅ ${check.description}`);
        } else {
          validationResults.details.responsiveDesign.failed++;
          validationResults.summary.failed++;
          console.log(`❌ ${check.description} - 响应式模式检查失败`);
          
          if (check.critical) {
            validationResults.recommendations.push(`紧急: ${check.description} 不符合规范`);
          }
        }
        
        validationResults.details.responsiveDesign.items.push({
          file: check.file,
          description: check.description,
          status: passed ? 'PASS' : 'FAIL',
          critical: check.critical,
          patterns: check.patterns.map(p => ({
            pattern: p.toString(),
            passed: p.test(content)
          }))
        });
      } else {
        validationResults.details.responsiveDesign.failed++;
        validationResults.summary.failed++;
        console.log(`❌ ${check.description} - 文件不存在`);
      }
    });

    // 计算总分
    validationResults.summary.score = Math.round((validationResults.summary.passed / validationResults.summary.total) * 100);
    
    console.log('\n📊 验证结果汇总...');
    console.log('=====================================');
    console.log(`总检查项: ${validationResults.summary.total}`);
    console.log(`通过: ${validationResults.summary.passed}`);
    console.log(`失败: ${validationResults.summary.failed}`);
    console.log(`得分: ${validationResults.summary.score}%`);
    
    if (validationResults.recommendations.length > 0) {
      console.log('\n⚠️  重要建议:');
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
  const reportFile = path.join(reportDir, `task-p2-001-mobile-adaptation-report.json`);
  
  fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
  console.log(`\n📄 验证报告已生成: ${reportFile}`);
}

// 执行验证
if (require.main === module) {
  runValidation()
    .then(results => {
      const success = results.summary.score >= VALIDATION_CONFIG.thresholds.passRate;
      console.log(`\n${success ? '✅' : '❌'} 验证完成! 总分: ${results.summary.score}%`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 验证失败:', error.message);
      process.exit(1);
    });
}

module.exports = { runValidation, VALIDATION_CONFIG, VALIDATION_META }; 