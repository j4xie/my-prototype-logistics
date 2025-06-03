#!/usr/bin/env node

/**
 * API文档更新任务 - 综合验证脚本
 * 
 * 验证AI分析API文档的完整性、一致性和正确性
 * 
 * @fileoverview 按照development-management-unified规则要求创建
 * @version 1.0.0
 * @date 2025-05-31
 */

const fs = require('fs');
const path = require('path');

// ========================= 验证元数据 =========================
const VALIDATION_META = {
  taskId: 'task-api-docs-update',
  taskName: 'AI分析API文档更新和完善',
  validationType: '文档完整性验证',
  targetFiles: [
    'docs/api/ai-analytics.md',
    'docs/api/api-specification.md', 
    'docs/api/README.md',
    'docs/api/mock-api-guide.md'
  ],
  requiredValidations: [
    '文档文件存在性检查',
    'AI接口定义完整性验证',
    '文档交叉引用一致性检查',
    'Mock API状态更新验证',
    'TypeScript类型定义验证'
  ],
  createdAt: new Date().toISOString(),
  taskResponsible: 'AI文档团队'
};

// ========================= 验证配置 =========================
const VALIDATION_CONFIG = {
  baseDir: process.cwd(),
  requiredAIEndpoints: [
    'production-insights',
    'optimize',
    'predict',
    'aggregate',
    'realtime-analysis',
    'model-status',
    'analysis-history'
  ],
  expectedHookFunctions: [
    'useProductionInsights',
    'useOptimizationSuggestions',
    'usePredictiveAnalysis',
    'useDataAggregation',
    'useRealtimeAnalysis'
  ],
  requiredDocSections: [
    '概述',
    '核心AI分析接口',
    '数据类型定义',
    'Mock数据示例',
    '错误处理',
    '使用指南'
  ]
};

// ========================= 验证结果收集器 =========================
class ValidationReporter {
  constructor() {
    this.results = {
      summary: {
        totalChecks: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        startTime: new Date().toISOString(),
        endTime: null
      },
      details: {
        fileExistence: [],
        contentValidation: [],
        consistency: [],
        integration: []
      },
      errors: [],
      warnings: []
    };
  }

  addCheck(category, name, status, details = '') {
    this.results.summary.totalChecks++;
    
    const checkResult = {
      name,
      status, // 'PASS', 'FAIL', 'WARN'
      details,
      timestamp: new Date().toISOString()
    };

    this.results.details[category].push(checkResult);

    if (status === 'PASS') this.results.summary.passed++;
    else if (status === 'FAIL') this.results.summary.failed++;
    else if (status === 'WARN') this.results.summary.warnings++;
  }

  addError(error) {
    this.results.errors.push({
      message: error.message || error,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }

  addWarning(warning) {
    this.results.warnings.push({
      message: warning,
      timestamp: new Date().toISOString()
    });
  }

  getSuccessRate() {
    const { totalChecks, passed } = this.results.summary;
    return totalChecks > 0 ? ((passed / totalChecks) * 100).toFixed(2) : 0;
  }

  generateReport() {
    this.results.summary.endTime = new Date().toISOString();
    this.results.summary.successRate = this.getSuccessRate();
    
    return {
      meta: VALIDATION_META,
      config: VALIDATION_CONFIG,
      results: this.results,
      recommendations: this.generateRecommendations()
    };
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.results.summary.failed > 0) {
      recommendations.push('修复所有失败的验证项目');
    }
    
    if (this.results.summary.warnings > 0) {
      recommendations.push('检查并处理所有警告项');
    }
    
    if (this.results.summary.successRate < 95) {
      recommendations.push('提高文档完整性和一致性');
    }

    return recommendations;
  }
}

// ========================= 验证函数 =========================

/**
 * 检查文件存在性
 */
function validateFileExistence(reporter) {
  console.log('🔍 检查文档文件存在性...');
  
  VALIDATION_META.targetFiles.forEach(filePath => {
    const fullPath = path.join(VALIDATION_CONFIG.baseDir, filePath);
    const exists = fs.existsSync(fullPath);
    
    if (exists) {
      const stats = fs.statSync(fullPath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      reporter.addCheck('fileExistence', `文件存在: ${filePath}`, 'PASS', `文件大小: ${sizeKB}KB`);
    } else {
      reporter.addCheck('fileExistence', `文件存在: ${filePath}`, 'FAIL', '文件不存在');
    }
  });
}

/**
 * 验证AI接口文档完整性
 */
function validateAIDocumentation(reporter) {
  console.log('🧠 验证AI接口文档完整性...');
  
  const aiDocPath = path.join(VALIDATION_CONFIG.baseDir, 'docs/api/ai-analytics.md');
  
  if (!fs.existsSync(aiDocPath)) {
    reporter.addCheck('contentValidation', 'AI文档存在', 'FAIL', 'ai-analytics.md文件不存在');
    return;
  }

  const content = fs.readFileSync(aiDocPath, 'utf8');
  
  // 检查必需的接口端点
  VALIDATION_CONFIG.requiredAIEndpoints.forEach(endpoint => {
    if (content.includes(endpoint)) {
      reporter.addCheck('contentValidation', `AI接口: ${endpoint}`, 'PASS', '接口文档已定义');
    } else {
      reporter.addCheck('contentValidation', `AI接口: ${endpoint}`, 'FAIL', '接口文档缺失');
    }
  });

  // 检查Hook函数
  VALIDATION_CONFIG.expectedHookFunctions.forEach(hookFunc => {
    if (content.includes(hookFunc)) {
      reporter.addCheck('contentValidation', `Hook函数: ${hookFunc}`, 'PASS', 'Hook函数已说明');
    } else {
      reporter.addCheck('contentValidation', `Hook函数: ${hookFunc}`, 'WARN', 'Hook函数未在文档中提及');
    }
  });

  // 检查必需的文档章节
  VALIDATION_CONFIG.requiredDocSections.forEach(section => {
    if (content.includes(section)) {
      reporter.addCheck('contentValidation', `文档章节: ${section}`, 'PASS', '章节存在');
    } else {
      reporter.addCheck('contentValidation', `文档章节: ${section}`, 'FAIL', '必需章节缺失');
    }
  });

  // 检查TypeScript类型定义
  const hasTypeDefinitions = content.includes('interface') && content.includes('Response');
  reporter.addCheck('contentValidation', 'TypeScript类型定义', 
    hasTypeDefinitions ? 'PASS' : 'FAIL', 
    hasTypeDefinitions ? '包含完整类型定义' : '缺少TypeScript类型定义'
  );
}

/**
 * 验证文档交叉引用一致性
 */
function validateCrossReferences(reporter) {
  console.log('🔗 验证文档交叉引用一致性...');
  
  const files = [
    'docs/api/README.md',
    'docs/api/api-specification.md',
    'docs/api/mock-api-guide.md'
  ];

  files.forEach(filePath => {
    const fullPath = path.join(VALIDATION_CONFIG.baseDir, filePath);
    
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // 检查是否引用了AI文档
      if (content.includes('ai-analytics.md')) {
        reporter.addCheck('consistency', `AI文档引用: ${filePath}`, 'PASS', '包含AI文档引用');
      } else {
        reporter.addCheck('consistency', `AI文档引用: ${filePath}`, 'WARN', '未引用AI文档');
      }

      // 检查接口数量是否更新（从11个更新为18个）
      if (content.includes('18个') || content.includes('18 个')) {
        reporter.addCheck('consistency', `接口数量更新: ${filePath}`, 'PASS', '接口数量已更新为18个');
      } else if (content.includes('11个') || content.includes('11 个')) {
        reporter.addCheck('consistency', `接口数量更新: ${filePath}`, 'FAIL', '接口数量仍显示旧的11个');
      } else {
        reporter.addCheck('consistency', `接口数量更新: ${filePath}`, 'WARN', '未明确说明接口数量');
      }
    }
  });
}

/**
 * 验证与已实现代码的集成
 */
function validateCodeIntegration(reporter) {
  console.log('⚙️ 验证与已实现代码的集成...');
  
  const hookFile = path.join(VALIDATION_CONFIG.baseDir, 'web-app-next/src/hooks/useApi-simple.ts');
  const apiFile = path.join(VALIDATION_CONFIG.baseDir, 'web-app-next/src/lib/api.ts');

  // 检查Hook文件
  if (fs.existsSync(hookFile)) {
    const hookContent = fs.readFileSync(hookFile, 'utf8');
    
    if (hookContent.includes('useAIAnalytics')) {
      reporter.addCheck('integration', 'useAIAnalytics Hook', 'PASS', 'Hook函数已实现');
    } else {
      reporter.addCheck('integration', 'useAIAnalytics Hook', 'FAIL', 'Hook函数未找到');
    }

    // 检查AI相关Hook函数
    VALIDATION_CONFIG.expectedHookFunctions.forEach(hookFunc => {
      if (hookContent.includes(hookFunc)) {
        reporter.addCheck('integration', `Hook实现: ${hookFunc}`, 'PASS', 'Hook函数已实现');
      } else {
        reporter.addCheck('integration', `Hook实现: ${hookFunc}`, 'FAIL', 'Hook函数未实现');
      }
    });
  } else {
    reporter.addCheck('integration', 'Hook文件存在', 'FAIL', 'useApi-simple.ts文件不存在');
  }

  // 检查API客户端文件
  if (fs.existsSync(apiFile)) {
    const apiContent = fs.readFileSync(apiFile, 'utf8');
    
    if (apiContent.includes('aiAnalyticsApi')) {
      reporter.addCheck('integration', 'AI API客户端', 'PASS', 'AI API客户端已实现');
    } else {
      reporter.addCheck('integration', 'AI API客户端', 'FAIL', 'AI API客户端未找到');
    }
  } else {
    reporter.addCheck('integration', 'API客户端文件存在', 'FAIL', 'api.ts文件不存在');
  }
}

// ========================= 主验证流程 =========================

async function runComprehensiveValidation() {
  console.log('🚀 开始API文档更新任务综合验证');
  console.log('=' .repeat(60));
  
  const reporter = new ValidationReporter();
  
  try {
    // 阶段1: 文件存在性检查
    validateFileExistence(reporter);
    
    // 阶段2: AI文档内容验证
    validateAIDocumentation(reporter);
    
    // 阶段3: 文档一致性检查
    validateCrossReferences(reporter);
    
    // 阶段4: 代码集成验证
    validateCodeIntegration(reporter);
    
    // 生成报告
    const report = reporter.generateReport();
    
    // 输出结果
    console.log('\n📊 验证结果摘要');
    console.log('=' .repeat(60));
    console.log(`总检查项: ${report.results.summary.totalChecks}`);
    console.log(`✅ 通过: ${report.results.summary.passed}`);
    console.log(`❌ 失败: ${report.results.summary.failed}`);
    console.log(`⚠️  警告: ${report.results.summary.warnings}`);
    console.log(`📈 成功率: ${report.results.summary.successRate}%`);
    
    // 保存详细报告
    const reportPath = path.join(__dirname, 'reports', `validation-report-${Date.now()}.json`);
    const reportDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📋 详细报告已保存: ${reportPath}`);
    
    // 输出建议
    if (report.recommendations.length > 0) {
      console.log('\n💡 改进建议:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
    
    // 返回验证结果
    const success = report.results.summary.failed === 0;
    console.log(`\n🎯 验证结果: ${success ? '✅ 验证通过' : '❌ 验证失败'}`);
    
    return {
      success,
      report,
      exitCode: success ? 0 : 1
    };
    
  } catch (error) {
    reporter.addError(error);
    console.error('❌ 验证过程中发生错误:', error.message);
    
    return {
      success: false,
      report: reporter.generateReport(),
      exitCode: 1
    };
  }
}

// ========================= 脚本执行 =========================

if (require.main === module) {
  runComprehensiveValidation()
    .then(({ success, exitCode }) => {
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('💥 验证脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = {
  runComprehensiveValidation,
  VALIDATION_META,
  VALIDATION_CONFIG
}; 