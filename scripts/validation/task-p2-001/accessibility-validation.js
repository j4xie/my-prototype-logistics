#!/usr/bin/env node

/**
 * TASK-P2-001 移动端UI适配问题修复 - 可访问性验证
 * 
 * @task TASK-P2-001
 * @module 移动端UI适配问题修复
 * @validation-type accessibility
 * @description 验证移动端UI适配的可访问性，包括ARIA属性、键盘导航、语义化标签等
 * @reports-to refactor/phase-2/progress-reports/
 * @created 2025-05-27
 * @updated 2025-05-27
 */

const fs = require('fs');
const path = require('path');

// 验证脚本元数据
const VALIDATION_META = {
  taskId: 'TASK-P2-001',
  validationType: 'accessibility',
  module: '移动端UI适配问题修复',
  reportPath: 'refactor/phase-2/progress-reports/',
  version: '1.0.0'
};

// 验证配置
const VALIDATION_CONFIG = {
  name: 'TASK-P2-001-可访问性验证',
  targetFiles: [
    'src/components/ui/navigation/MobileNav.js',
    'src/components/ui/navigation/MobileDrawer.js',
    'src/components/ui/TouchGesture.js',
    'src/components/ui/layout/PageLayout.js'
  ],
  checkpoints: [
    'aria-attributes',
    'semantic-html',
    'keyboard-navigation',
    'screen-reader-support',
    'focus-management'
  ],
  thresholds: {
    passRate: 90,
    ariaCompliance: 95
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
    ariaAttributes: { passed: 0, failed: 0, items: [] },
    semanticHtml: { passed: 0, failed: 0, items: [] },
    keyboardNavigation: { passed: 0, failed: 0, items: [] },
    focusManagement: { passed: 0, failed: 0, items: [] }
  },
  recommendations: []
};

/**
 * 检查ARIA属性
 */
function checkAriaAttributes(relativePath, requiredAttributes, description) {
  const fullPath = path.join(webAppPath, relativePath);
  
  validationResults.summary.total++;
  
  if (!fs.existsSync(fullPath)) {
    validationResults.details.ariaAttributes.failed++;
    validationResults.summary.failed++;
    console.log(`❌ ${description} - 文件不存在: ${relativePath}`);
    return false;
  }
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const attributeResults = requiredAttributes.map(attr => {
      const isRegex = attr instanceof RegExp;
      const hasAttribute = isRegex ? attr.test(content) : content.includes(attr);
      
      return {
        attribute: isRegex ? attr.toString() : attr,
        found: hasAttribute,
        type: isRegex ? 'regex' : 'string'
      };
    });
    
    const foundAttributes = attributeResults.filter(a => a.found).length;
    const totalAttributes = requiredAttributes.length;
    const score = Math.round((foundAttributes / totalAttributes) * 100);
    const passed = score >= VALIDATION_CONFIG.thresholds.ariaCompliance;
    
    if (passed) {
      validationResults.details.ariaAttributes.passed++;
      validationResults.summary.passed++;
      console.log(`✅ ${description} - ARIA属性: ${foundAttributes}/${totalAttributes} (${score}%)`);
    } else {
      validationResults.details.ariaAttributes.failed++;
      validationResults.summary.failed++;
      console.log(`❌ ${description} - ARIA属性: ${foundAttributes}/${totalAttributes} (${score}%)`);
      
      const missingAttributes = attributeResults
        .filter(a => !a.found)
        .map(a => a.attribute)
        .join(', ');
      validationResults.recommendations.push(`添加ARIA属性: ${relativePath} - 缺少: ${missingAttributes}`);
    }
    
    validationResults.details.ariaAttributes.items.push({
      path: relativePath,
      description,
      status: passed ? 'PASS' : 'FAIL',
      score,
      attributes: attributeResults,
      foundAttributes,
      totalAttributes
    });
    
    return passed;
  } catch (error) {
    validationResults.details.ariaAttributes.failed++;
    validationResults.summary.failed++;
    console.log(`❌ ${description} - 读取文件失败: ${error.message}`);
    return false;
  }
}

/**
 * 检查语义化HTML
 */
function checkSemanticHtml(relativePath, semanticElements, description) {
  const fullPath = path.join(webAppPath, relativePath);
  
  validationResults.summary.total++;
  
  if (!fs.existsSync(fullPath)) {
    validationResults.details.semanticHtml.failed++;
    validationResults.summary.failed++;
    return false;
  }
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const elementResults = semanticElements.map(element => {
      const isRegex = element instanceof RegExp;
      const hasElement = isRegex ? element.test(content) : content.includes(element);
      
      return {
        element: isRegex ? element.toString() : element,
        found: hasElement,
        type: isRegex ? 'regex' : 'string'
      };
    });
    
    const foundElements = elementResults.filter(e => e.found).length;
    const totalElements = semanticElements.length;
    const score = Math.round((foundElements / totalElements) * 100);
    const passed = score >= 80; // 至少80%的语义化元素
    
    if (passed) {
      validationResults.details.semanticHtml.passed++;
      validationResults.summary.passed++;
      console.log(`✅ ${description} - 语义化元素: ${foundElements}/${totalElements} (${score}%)`);
    } else {
      validationResults.details.semanticHtml.failed++;
      validationResults.summary.failed++;
      console.log(`❌ ${description} - 语义化元素: ${foundElements}/${totalElements} (${score}%)`);
      validationResults.recommendations.push(`改进语义化HTML: ${relativePath} (当前: ${score}%, 建议: ≥80%)`);
    }
    
    validationResults.details.semanticHtml.items.push({
      path: relativePath,
      description,
      status: passed ? 'PASS' : 'FAIL',
      score,
      elements: elementResults,
      foundElements,
      totalElements
    });
    
    return passed;
  } catch (error) {
    validationResults.details.semanticHtml.failed++;
    validationResults.summary.failed++;
    console.log(`❌ ${description} - 读取文件失败: ${error.message}`);
    return false;
  }
}

/**
 * 检查键盘导航支持
 */
function checkKeyboardNavigation(relativePath, keyboardPatterns, description) {
  const fullPath = path.join(webAppPath, relativePath);
  
  validationResults.summary.total++;
  
  if (!fs.existsSync(fullPath)) {
    validationResults.details.keyboardNavigation.failed++;
    validationResults.summary.failed++;
    return false;
  }
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const patternResults = keyboardPatterns.map(pattern => {
      const isRegex = pattern instanceof RegExp;
      const hasPattern = isRegex ? pattern.test(content) : content.includes(pattern);
      
      return {
        pattern: isRegex ? pattern.toString() : pattern,
        found: hasPattern,
        type: isRegex ? 'regex' : 'string'
      };
    });
    
    const foundPatterns = patternResults.filter(p => p.found).length;
    const totalPatterns = keyboardPatterns.length;
    const score = Math.round((foundPatterns / totalPatterns) * 100);
    const passed = score >= 75; // 至少75%的键盘导航模式
    
    if (passed) {
      validationResults.details.keyboardNavigation.passed++;
      validationResults.summary.passed++;
      console.log(`✅ ${description} - 键盘导航: ${foundPatterns}/${totalPatterns} (${score}%)`);
    } else {
      validationResults.details.keyboardNavigation.failed++;
      validationResults.summary.failed++;
      console.log(`❌ ${description} - 键盘导航: ${foundPatterns}/${totalPatterns} (${score}%)`);
      validationResults.recommendations.push(`改进键盘导航: ${relativePath} (当前: ${score}%, 建议: ≥75%)`);
    }
    
    validationResults.details.keyboardNavigation.items.push({
      path: relativePath,
      description,
      status: passed ? 'PASS' : 'FAIL',
      score,
      patterns: patternResults,
      foundPatterns,
      totalPatterns
    });
    
    return passed;
  } catch (error) {
    validationResults.details.keyboardNavigation.failed++;
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
    console.log('♿ 检查ARIA属性...');
    console.log('=====================================');

    // 1. 检查ARIA属性
    checkAriaAttributes('src/components/ui/navigation/MobileDrawer.js', [
      'role="dialog"',
      'aria-modal="true"',
      'aria-labelledby',
      'aria-describedby',
      /aria-hidden/
    ], '移动端抽屉ARIA属性');

    checkAriaAttributes('src/components/ui/navigation/MobileNav.js', [
      'role="navigation"',
      'aria-label',
      'aria-expanded',
      'aria-current',
      /aria-hidden/
    ], '移动端导航ARIA属性');

    console.log('\n🏷️ 检查语义化HTML...');
    console.log('=====================================');

    // 2. 检查语义化HTML
    checkSemanticHtml('src/components/ui/navigation/MobileDrawer.js', [
      '<nav',
      '<button',
      '<dialog',
      /<header|<main|<aside/,
      /role=/
    ], '移动端抽屉语义化HTML');

    checkSemanticHtml('src/components/ui/navigation/MobileNav.js', [
      '<nav',
      '<button',
      '<ul',
      '<li',
      /<a\s/
    ], '移动端导航语义化HTML');

    console.log('\n⌨️ 检查键盘导航...');
    console.log('=====================================');

    // 3. 检查键盘导航
    checkKeyboardNavigation('src/components/ui/TouchGesture.js', [
      'onKeyDown',
      'onKeyUp',
      'tabIndex',
      /keyCode|key.*Enter|key.*Space/,
      'focus()',
      'blur()'
    ], '触摸手势键盘导航');

    checkKeyboardNavigation('src/components/ui/navigation/MobileDrawer.js', [
      'onKeyDown',
      'tabIndex',
      /Escape|escape/,
      'focus()',
      'autoFocus'
    ], '移动端抽屉键盘导航');

    console.log('\n🎯 检查焦点管理...');
    console.log('=====================================');

    // 4. 检查焦点管理
    validationResults.summary.total++;
    const pageLayoutPath = path.join(webAppPath, 'src/components/ui/layout/PageLayout.js');
    if (fs.existsSync(pageLayoutPath)) {
      const content = fs.readFileSync(pageLayoutPath, 'utf8');
      
      const focusPatterns = [
        /useRef/,
        /focus\(\)/,
        /blur\(\)/,
        /tabIndex/,
        /outline.*none/,
        /:focus/
      ];
      
      const foundPatterns = focusPatterns.filter(pattern => pattern.test(content)).length;
      const score = Math.round((foundPatterns / focusPatterns.length) * 100);
      const passed = score >= 60; // 至少60%的焦点管理模式
      
      if (passed) {
        validationResults.details.focusManagement.passed++;
        validationResults.summary.passed++;
        console.log(`✅ 页面布局焦点管理 - 模式: ${foundPatterns}/${focusPatterns.length} (${score}%)`);
      } else {
        validationResults.details.focusManagement.failed++;
        validationResults.summary.failed++;
        console.log(`❌ 页面布局焦点管理 - 模式: ${foundPatterns}/${focusPatterns.length} (${score}%)`);
        validationResults.recommendations.push('改进焦点管理：添加更多焦点相关的处理逻辑');
      }
      
      validationResults.details.focusManagement.items.push({
        path: 'src/components/ui/layout/PageLayout.js',
        description: '页面布局焦点管理',
        status: passed ? 'PASS' : 'FAIL',
        score,
        foundPatterns,
        totalPatterns: focusPatterns.length
      });
    } else {
      validationResults.details.focusManagement.failed++;
      validationResults.summary.failed++;
      console.log('❌ 页面布局组件不存在');
    }

    // 计算总分
    validationResults.summary.score = Math.round((validationResults.summary.passed / validationResults.summary.total) * 100);
    
    console.log('\n📊 可访问性验证结果汇总...');
    console.log('=====================================');
    console.log(`总检查项: ${validationResults.summary.total}`);
    console.log(`通过: ${validationResults.summary.passed}`);
    console.log(`失败: ${validationResults.summary.failed}`);
    console.log(`得分: ${validationResults.summary.score}%`);
    
    if (validationResults.recommendations.length > 0) {
      console.log('\n⚠️  可访问性改进建议:');
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
  const reportFile = path.join(reportDir, `task-p2-001-accessibility-report.json`);
  
  fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
  console.log(`\n📄 可访问性验证报告已生成: ${reportFile}`);
}

// 执行验证
if (require.main === module) {
  runValidation()
    .then(results => {
      const success = results.summary.score >= VALIDATION_CONFIG.thresholds.passRate;
      console.log(`\n${success ? '✅' : '❌'} 可访问性验证完成! 总分: ${results.summary.score}%`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 可访问性验证失败:', error.message);
      process.exit(1);
    });
}

module.exports = { runValidation, VALIDATION_CONFIG, VALIDATION_META }; 