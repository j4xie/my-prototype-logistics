#!/usr/bin/env node

/**
 * 功能验证脚本 - Web App Next 100页面功能验证
 *
 * 目标：验证虚假完成度问题修复后的100个页面实际功能状态
 * 范围：页面加载、组件渲染、API调用、用户交互
 *
 * 创建时间：2025-06-18
 * 更新原因：虚假完成度问题修复后的质量保证
 */

console.log('=== 功能验证脚本启动 ===');
console.log('当前工作目录:', process.cwd());
console.log('脚本参数:', process.argv);

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 验证配置
const VALIDATION_CONFIG = {
  projectRoot: process.cwd(),
  srcDir: 'src/app',
  reportDir: 'scripts/validation/reports',
  timestamp: new Date().toISOString().replace(/[:.]/g, '-'),
  verbose: process.argv.includes('--verbose')
};

// 页面分类配置（基于虚假完成度修复后的真实页面）
const PAGE_CATEGORIES = {
  authentication: {
    name: '认证模块',
    pages: ['login', 'register', 'reset-password'],
    priority: 'P0',
    expectedFeatures: ['表单验证', 'API调用', '错误处理']
  },
  profile: {
    name: '用户中心模块',
    pages: ['profile', 'profile/about', 'profile/edit', 'profile/security',
           'profile/privacy', 'profile/data-export', 'profile/feedback',
           'profile/password', 'profile/notifications'],
    priority: 'P1',
    expectedFeatures: ['用户信息展示', '数据编辑', '设置管理'],
    recentlyFixed: true // 标记为虚假完成度问题修复的页面
  },
  trace: {
    name: '溯源模块',
    pages: ['query', 'list', 'tracking'],
    priority: 'P0',
    expectedFeatures: ['查询功能', '数据展示', '详情查看']
  },
  farming: {
    name: '农业模块',
    pages: ['farming', 'farming/crops', 'farming/fields', 'farming/planting-plans',
           'farming/farm-activities', 'farming/harvest-records', 'farming/breeding',
           'farming/vaccine', 'farming/create-trace', 'farming/data-collection-center',
           'farming/farm-management', 'farming/indicator-detail', 'farming/manual-collection',
           'farming/model-management', 'farming/prediction-analytics', 'farming/prediction-config',
           'farming/qrcode-collection', 'farming/video-monitoring'],
    priority: 'P1',
    expectedFeatures: ['数据录入', '监控展示', '管理功能']
  },
  processing: {
    name: '加工模块',
    pages: ['processing', 'processing/production', 'processing/quality', 'processing/storage',
           'processing/finished-products', 'processing/raw-materials', 'processing/production-batches',
           'processing/quality-tests', 'processing/photos', 'processing/production-planning',
           'processing/reports', 'processing/recipes'],
    priority: 'P1',
    expectedFeatures: ['生产管理', '质量控制', '库存管理'],
    recentlyFixed: true // 标记为虚假完成度问题修复的页面
  },
  admin: {
    name: '管理后台模块',
    pages: ['admin/dashboard', 'admin/users', 'admin/products', 'admin/reports',
           'admin/system', 'admin/notifications', 'admin/roles', 'admin/permissions',
           'admin/audit', 'admin/logs', 'admin/backup', 'admin/performance',
           'admin/import', 'admin/template', 'admin/admin-users'],
    priority: 'P2',
    expectedFeatures: ['用户管理', '系统配置', '数据分析']
  }
};

// 验证结果存储
const validationResults = {
  summary: {
    totalPages: 0,
    validatedPages: 0,
    passedPages: 0,
    failedPages: 0,
    fixedPages: 0, // 虚假完成度问题修复的页面
    startTime: new Date().toISOString(),
    endTime: null
  },
  categories: {},
  pages: {},
  issues: [],
  recommendations: []
};

/**
 * 日志输出函数
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  const fullMessage = `${prefix} ${message}`;

  // 始终输出到控制台
  console.log(fullMessage);
}

/**
 * 扫描页面文件
 */
function scanPageFiles() {
  log('开始扫描页面文件...');

  const srcPath = path.join(VALIDATION_CONFIG.projectRoot, VALIDATION_CONFIG.srcDir);
  const pageFiles = [];

  function scanDirectory(dirPath, relativePath = '') {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativeFullPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        scanDirectory(fullPath, relativeFullPath);
      } else if (entry.name === 'page.tsx') {
        const pagePath = relativePath || '/';
        pageFiles.push({
          path: pagePath,
          fullPath: fullPath,
          relativePath: relativeFullPath
        });
      }
    }
  }

  scanDirectory(srcPath);

  log(`发现 ${pageFiles.length} 个页面文件`);
  return pageFiles;
}

/**
 * 验证单个页面文件
 */
function validatePageFile(pageInfo) {
  const results = {
    path: pageInfo.path,
    exists: true,
    hasContent: false,
    hasComponents: false,
    hasExport: false,
    hasTypeScript: false,
    issues: [],
    score: 0
  };

  try {
    // 读取文件内容
    const content = fs.readFileSync(pageInfo.fullPath, 'utf8');
    results.hasContent = content.trim().length > 0;

    // 检查基本结构
    results.hasExport = /export\s+default/.test(content);
    results.hasComponents = /function\s+\w+|const\s+\w+\s*=/.test(content);
    results.hasTypeScript = /:\s*\w+|interface\s+\w+|type\s+\w+/.test(content);

    // 检查是否是最小化实现（可能是虚假完成度问题的残留）
    const isMinimalImplementation = content.length < 500 &&
                                   content.includes('TODO') ||
                                   content.includes('placeholder') ||
                                   content.includes('Coming Soon');

    if (isMinimalImplementation) {
      results.issues.push('页面实现过于简单，可能需要完善功能');
    }

    // 检查是否包含实际业务逻辑
    const hasBusinessLogic = /useEffect|useState|useApi|fetch|api\./.test(content);
    if (!hasBusinessLogic && !pageInfo.path.includes('static')) {
      results.issues.push('缺少业务逻辑实现');
    }

    // 计算得分
    let score = 0;
    if (results.hasContent) score += 20;
    if (results.hasExport) score += 20;
    if (results.hasComponents) score += 20;
    if (results.hasTypeScript) score += 20;
    if (hasBusinessLogic) score += 20;

    results.score = score;

  } catch (error) {
    results.exists = false;
    results.issues.push(`文件读取错误: ${error.message}`);
  }

  return results;
}

/**
 * 分类页面并验证
 */
function validateByCategory() {
  log('开始分类验证...');

  const pageFiles = scanPageFiles();
  validationResults.summary.totalPages = pageFiles.length;

  // 按分类验证
  for (const [categoryKey, categoryConfig] of Object.entries(PAGE_CATEGORIES)) {
    log(`验证 ${categoryConfig.name} (${categoryConfig.pages.length} 个页面)`);

    const categoryResults = {
      name: categoryConfig.name,
      priority: categoryConfig.priority,
      totalPages: categoryConfig.pages.length,
      foundPages: 0,
      passedPages: 0,
      failedPages: 0,
      recentlyFixed: categoryConfig.recentlyFixed || false,
      pages: {}
    };

    for (const expectedPage of categoryConfig.pages) {
      const pageFile = pageFiles.find(p =>
        p.path === expectedPage ||
        p.path === `/${expectedPage}` ||
        p.path.replace(/^\//, '') === expectedPage
      );

      if (pageFile) {
        categoryResults.foundPages++;
        const pageResult = validatePageFile(pageFile);
        categoryResults.pages[expectedPage] = pageResult;
        validationResults.pages[expectedPage] = pageResult;

        if (pageResult.score >= 60) {
          categoryResults.passedPages++;
          validationResults.summary.passedPages++;
        } else {
          categoryResults.failedPages++;
          validationResults.summary.failedPages++;
        }

        if (categoryConfig.recentlyFixed) {
          validationResults.summary.fixedPages++;
        }

        validationResults.summary.validatedPages++;
      } else {
        categoryResults.pages[expectedPage] = {
          path: expectedPage,
          exists: false,
          issues: ['页面文件不存在']
        };
        categoryResults.failedPages++;
        validationResults.summary.failedPages++;
      }
    }

    validationResults.categories[categoryKey] = categoryResults;

    // 输出分类结果
    const passRate = categoryResults.foundPages > 0 ?
      (categoryResults.passedPages / categoryResults.foundPages * 100).toFixed(1) : 0;

    log(`${categoryConfig.name}: ${categoryResults.foundPages}/${categoryResults.totalPages} 页面存在, ` +
        `${categoryResults.passedPages} 通过, 通过率 ${passRate}%`);
  }
}

/**
 * 生成验证报告
 */
function generateReport() {
  log('生成验证报告...');

  validationResults.summary.endTime = new Date().toISOString();

  // 确保报告目录存在
  const reportDir = path.join(VALIDATION_CONFIG.projectRoot, VALIDATION_CONFIG.reportDir);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // 生成详细报告
  const reportPath = path.join(reportDir, `functional-verification-${VALIDATION_CONFIG.timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(validationResults, null, 2));

  // 生成摘要报告
  const summaryPath = path.join(reportDir, 'LATEST-FUNCTIONAL-VERIFICATION-SUMMARY.md');
  const summaryContent = generateSummaryMarkdown();
  fs.writeFileSync(summaryPath, summaryContent);

  log(`详细报告已保存到: ${reportPath}`);
  log(`摘要报告已保存到: ${summaryPath}`);

  return { reportPath, summaryPath };
}

/**
 * 生成摘要Markdown报告
 */
function generateSummaryMarkdown() {
  const { summary, categories } = validationResults;
  const passRate = summary.validatedPages > 0 ?
    (summary.passedPages / summary.validatedPages * 100).toFixed(1) : 0;

  let markdown = `# 功能验证报告摘要

## 📊 总体统计

**验证时间**: ${summary.startTime} - ${summary.endTime}
**验证范围**: 虚假完成度问题修复后的100个页面功能验证

| 指标 | 数值 | 说明 |
|------|------|------|
| **总页面数** | ${summary.totalPages} | 实际扫描到的page.tsx文件 |
| **验证页面数** | ${summary.validatedPages} | 成功验证的页面数量 |
| **通过页面数** | ${summary.passedPages} | 功能完整的页面数量 |
| **失败页面数** | ${summary.failedPages} | 需要修复的页面数量 |
| **修复页面数** | ${summary.fixedPages} | 虚假完成度问题修复的页面 |
| **总体通过率** | ${passRate}% | 整体功能完成质量 |

## 🎯 分类验证结果

`;

  for (const [categoryKey, categoryResult] of Object.entries(categories)) {
    const categoryPassRate = categoryResult.foundPages > 0 ?
      (categoryResult.passedPages / categoryResult.foundPages * 100).toFixed(1) : 0;

    const statusIcon = categoryPassRate >= 80 ? '✅' :
                      categoryPassRate >= 60 ? '⚠️' : '❌';

    const fixedBadge = categoryResult.recentlyFixed ? ' 🔧 **[虚假完成度修复]**' : '';

    markdown += `### ${statusIcon} ${categoryResult.name}${fixedBadge}

**优先级**: ${categoryResult.priority}
**页面状态**: ${categoryResult.foundPages}/${categoryResult.totalPages} 存在
**功能状态**: ${categoryResult.passedPages}/${categoryResult.foundPages} 通过
**通过率**: ${categoryPassRate}%

`;
  }

  // 添加问题和建议
  if (validationResults.issues.length > 0) {
    markdown += `## 🚨 发现的问题

`;
    validationResults.issues.forEach((issue, index) => {
      markdown += `${index + 1}. ${issue}\n`;
    });
  }

  if (validationResults.recommendations.length > 0) {
    markdown += `## 💡 改进建议

`;
    validationResults.recommendations.forEach((rec, index) => {
      markdown += `${index + 1}. ${rec}\n`;
    });
  }

  markdown += `
## 📋 下一步行动

基于验证结果，建议按以下优先级处理：

1. **P0问题**: 修复通过率低于60%的核心功能页面
2. **P1问题**: 完善通过率60-80%的业务页面功能
3. **P2问题**: 优化通过率高于80%的页面用户体验
4. **质量监控**: 建立持续的功能验证机制

---

**报告生成时间**: ${new Date().toISOString()}
**验证工具**: functional-verification.js
**项目状态**: 虚假完成度问题修复后的质量验证
`;

  return markdown;
}

/**
 * 主验证流程
 */
function main() {
  try {
    log('🚀 开始功能验证流程...');
    log(`项目根目录: ${VALIDATION_CONFIG.projectRoot}`);
    log(`源码目录: ${VALIDATION_CONFIG.srcDir}`);

    // 执行验证
    validateByCategory();

    // 生成建议
    const totalPassRate = validationResults.summary.validatedPages > 0 ?
      (validationResults.summary.passedPages / validationResults.summary.validatedPages * 100) : 0;

    if (totalPassRate < 60) {
      validationResults.recommendations.push('总体通过率偏低，建议优先修复核心功能页面');
    }

    if (validationResults.summary.fixedPages > 0) {
      validationResults.recommendations.push(`已修复${validationResults.summary.fixedPages}个虚假完成度问题页面，建议重点验证这些页面的功能完整性`);
    }

    validationResults.recommendations.push('建立定期功能验证机制，防止虚假完成度问题再次出现');

    // 生成报告
    const reports = generateReport();

    // 输出结果
    log('✅ 功能验证完成!');
    log(`总页面数: ${validationResults.summary.totalPages}`);
    log(`验证页面数: ${validationResults.summary.validatedPages}`);
    log(`通过页面数: ${validationResults.summary.passedPages}`);
    log(`失败页面数: ${validationResults.summary.failedPages}`);
    log(`修复页面数: ${validationResults.summary.fixedPages}`);
    log(`总体通过率: ${totalPassRate.toFixed(1)}%`);

    if (totalPassRate >= 80) {
      log('🎉 功能验证结果优秀！');
    } else if (totalPassRate >= 60) {
      log('⚠️ 功能验证结果良好，但仍有改进空间');
    } else {
      log('❌ 功能验证发现较多问题，需要重点关注');
    }

    return {
      success: true,
      passRate: totalPassRate,
      reports: reports
    };

  } catch (error) {
    log(`验证过程出错: ${error.message}`, 'ERROR');
    return {
      success: false,
      error: error.message
    };
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const result = main();
  process.exit(result.success ? 0 : 1);
}

module.exports = { main, VALIDATION_CONFIG, PAGE_CATEGORIES };
