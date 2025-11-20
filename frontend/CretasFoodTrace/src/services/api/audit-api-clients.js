#!/usr/bin/env node

/**
 * API Client审计脚本
 *
 * 功能：
 * 1. 扫描所有API Client文件
 * 2. 检查未在API_CLIENT_INDEX.md中注册的Client
 * 3. 检查废弃API是否仍被使用
 * 4. 生成代码健康度报告
 *
 * 运行方式：
 *   node audit-api-clients.js
 *   node audit-api-clients.js --verbose
 *   node audit-api-clients.js --output=report.md
 */

const fs = require('fs');
const path = require('path');

// ==================== 配置 ====================

const API_DIR = __dirname;
const ROOT_DIR = path.resolve(__dirname, '../../../');
const INDEX_FILE = path.join(API_DIR, 'API_CLIENT_INDEX.md');
const ESLINT_CONFIG = path.join(ROOT_DIR, '.eslintrc.js');

// 废弃的API Client列表（需要与INDEX保持同步）
// 注: 所有废弃API已删除 (2025-11-19)
const DEPRECATED_APIS = [
  // 'attendanceApiClient',  // 已删除
  // 'employeeApiClient',    // 已删除
  // 'enhancedApiClient',    // 已删除
  // 'materialApiClient',    // 已删除
];

// 忽略的文件（非API Client文件）
const IGNORED_FILES = [
  'apiClient.ts',           // 基础HTTP客户端
  'audit-api-clients.js',   // 本审计脚本
  'index.ts',               // 导出文件
  'types.ts',               // 类型定义文件
];

// ==================== 工具函数 ====================

/**
 * 读取目录中的所有API Client文件
 */
function getAllApiClientFiles() {
  const files = fs.readdirSync(API_DIR);
  return files
    .filter(file => file.endsWith('ApiClient.ts'))
    .filter(file => !IGNORED_FILES.includes(file))
    .map(file => ({
      filename: file,
      basename: file.replace('.ts', ''),
      path: path.join(API_DIR, file),
    }));
}

/**
 * 读取API_CLIENT_INDEX.md中注册的API Client
 */
function getRegisteredApiClients() {
  if (!fs.existsSync(INDEX_FILE)) {
    console.error(`❌ 错误: ${INDEX_FILE} 不存在！`);
    process.exit(1);
  }

  const content = fs.readFileSync(INDEX_FILE, 'utf-8');
  const registered = new Set();
  const deprecated = new Set();

  // 匹配活跃的API Client: #### ✅ xxxApiClient
  const activeMatches = content.matchAll(/####\s*✅\s*(\w+ApiClient)/g);
  for (const match of activeMatches) {
    registered.add(match[1]);
  }

  // 匹配已废弃的API Client: ### ❌ xxxApiClient
  const deprecatedMatches = content.matchAll(/###\s*❌\s*(\w+ApiClient)/g);
  for (const match of deprecatedMatches) {
    deprecated.add(match[1]);
    registered.add(match[1]); // 废弃的也算注册过
  }

  return { registered, deprecated };
}

/**
 * 检查文件是否为废弃状态
 */
function isDeprecatedFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('@deprecated');
}

/**
 * 统计文件的代码行数（排除空行和注释）
 */
function countCodeLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let total = lines.length;
  let code = 0;
  let comment = 0;
  let blank = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      blank++;
    } else if (trimmed.startsWith('//')) {
      comment++;
    } else if (trimmed.startsWith('/*') || trimmed.startsWith('/**')) {
      inBlockComment = true;
      comment++;
    } else if (trimmed.endsWith('*/')) {
      inBlockComment = false;
      comment++;
    } else if (inBlockComment) {
      comment++;
    } else {
      code++;
    }
  }

  return { total, code, comment, blank };
}

/**
 * 搜索项目中使用了某个API Client的文件
 */
function findUsageFiles(apiClientName) {
  const usageFiles = [];
  const searchDirs = [
    path.join(ROOT_DIR, 'src/screens'),
    path.join(ROOT_DIR, 'src/components'),
    path.join(ROOT_DIR, 'src/services'),
    path.join(ROOT_DIR, 'src/hooks'),
  ];

  function searchInDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir);
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        searchInDirectory(itemPath);
      } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
        const content = fs.readFileSync(itemPath, 'utf-8');
        // 检查import语句
        const importRegex = new RegExp(`from ['"].*/${apiClientName}['"]`, 'g');
        if (importRegex.test(content)) {
          usageFiles.push(path.relative(ROOT_DIR, itemPath));
        }
      }
    }
  }

  searchDirs.forEach(searchInDirectory);
  return usageFiles;
}

/**
 * 检查ESLint配置中的废弃API限制
 */
function checkEslintConfig() {
  if (!fs.existsSync(ESLINT_CONFIG)) {
    return { configured: false, rules: [] };
  }

  const content = fs.readFileSync(ESLINT_CONFIG, 'utf-8');
  const hasRestriction = content.includes('no-restricted-imports');

  const restrictedApis = [];
  const matches = content.matchAll(/name:\s*['"].*\/(\w+ApiClient)['"]/g);
  for (const match of matches) {
    restrictedApis.push(match[1]);
  }

  return {
    configured: hasRestriction,
    rules: restrictedApis,
  };
}

// ==================== 审计逻辑 ====================

/**
 * 主审计函数
 */
function auditApiClients(options = {}) {
  console.log('🔍 开始API Client审计...\n');

  const allFiles = getAllApiClientFiles();
  const { registered, deprecated } = getRegisteredApiClients();
  const eslintCheck = checkEslintConfig();

  // 统计数据
  const stats = {
    totalFiles: allFiles.length,
    registeredCount: registered.size,
    deprecatedCount: deprecated.size,
    activeCount: registered.size - deprecated.size,
    unregisteredFiles: [],
    deprecatedButUsed: [],
    totalCodeLines: 0,
    deprecatedCodeLines: 0,
  };

  const issues = [];

  // 1. 检查未注册的API Client
  console.log('📋 检查1: API Client注册状态');
  for (const file of allFiles) {
    const isRegistered = registered.has(file.basename);

    if (!isRegistered) {
      stats.unregisteredFiles.push(file.basename);
      issues.push({
        severity: 'high',
        type: 'unregistered',
        file: file.filename,
        message: `❌ ${file.basename} 未在 API_CLIENT_INDEX.md 中注册`,
      });
    }

    // 统计代码行数
    const lines = countCodeLines(file.path);
    stats.totalCodeLines += lines.code;

    if (deprecated.has(file.basename)) {
      stats.deprecatedCodeLines += lines.code;
    }

    if (options.verbose) {
      const status = isRegistered
        ? (deprecated.has(file.basename) ? '❌ 已废弃' : '✅ 已注册')
        : '⚠️  未注册';
      console.log(`  ${status} ${file.basename} (${lines.code} 行代码)`);
    }
  }

  // 2. 检查废弃API的使用情况
  console.log('\n🔎 检查2: 废弃API使用情况');
  for (const apiName of deprecated) {
    const usageFiles = findUsageFiles(apiName);

    if (usageFiles.length > 0) {
      stats.deprecatedButUsed.push({
        api: apiName,
        count: usageFiles.length,
        files: usageFiles,
      });

      issues.push({
        severity: 'medium',
        type: 'deprecated_usage',
        file: apiName,
        message: `⚠️  ${apiName} 已废弃但仍被 ${usageFiles.length} 个文件使用`,
        details: usageFiles,
      });

      if (options.verbose) {
        console.log(`  ⚠️  ${apiName} 仍被使用:`);
        usageFiles.forEach(f => console.log(`      - ${f}`));
      }
    } else {
      if (options.verbose) {
        console.log(`  ✅ ${apiName} 已废弃且无使用`);
      }
    }
  }

  // 3. 检查ESLint配置
  console.log('\n⚙️  检查3: ESLint配置状态');
  if (!eslintCheck.configured) {
    issues.push({
      severity: 'high',
      type: 'eslint',
      message: '❌ ESLint未配置废弃API限制规则',
    });
    console.log('  ❌ ESLint未配置 no-restricted-imports 规则');
  } else {
    const missingInEslint = Array.from(deprecated).filter(
      api => !eslintCheck.rules.includes(api)
    );

    if (missingInEslint.length > 0) {
      issues.push({
        severity: 'medium',
        type: 'eslint',
        message: `⚠️  ${missingInEslint.length} 个废弃API未在ESLint中配置限制`,
        details: missingInEslint,
      });
      console.log(`  ⚠️  以下废弃API未在ESLint中限制:`);
      missingInEslint.forEach(api => console.log(`      - ${api}`));
    } else {
      console.log(`  ✅ ESLint已配置所有废弃API限制 (${eslintCheck.rules.length}个)`);
    }
  }

  return { stats, issues, eslintCheck };
}

/**
 * 生成审计报告（Markdown格式）
 */
function generateReport(auditResult) {
  const { stats, issues, eslintCheck } = auditResult;

  const timestamp = new Date().toISOString().split('T')[0];

  let report = `# API Client审计报告\n\n`;
  report += `**生成日期**: ${timestamp}\n`;
  report += `**审计范围**: \`src/services/api/\`\n\n`;
  report += `---\n\n`;

  // 统计摘要
  report += `## 📊 统计摘要\n\n`;
  report += `| 指标 | 数值 |\n`;
  report += `|------|------|\n`;
  report += `| **总API Client数** | ${stats.totalFiles} 个 |\n`;
  report += `| **已注册** | ${stats.registeredCount} 个 (${Math.round(stats.registeredCount/stats.totalFiles*100)}%) |\n`;
  report += `| **活跃使用** | ${stats.activeCount} 个 (${Math.round(stats.activeCount/stats.totalFiles*100)}%) |\n`;
  report += `| **已废弃** | ${stats.deprecatedCount} 个 (${Math.round(stats.deprecatedCount/stats.totalFiles*100)}%) |\n`;
  report += `| **未注册** | ${stats.unregisteredFiles.length} 个 |\n`;
  report += `| **废弃但仍使用** | ${stats.deprecatedButUsed.length} 个 |\n`;
  report += `| **总代码行数** | ${stats.totalCodeLines} 行 |\n`;
  report += `| **废弃代码行数** | ${stats.deprecatedCodeLines} 行 (${Math.round(stats.deprecatedCodeLines/stats.totalCodeLines*100)}%) |\n\n`;

  // 代码健康度
  const healthScore = calculateHealthScore(stats, issues);
  report += `## 🏥 代码健康度\n\n`;
  report += `**总体评分**: ${healthScore.score}/100\n\n`;
  report += `**健康状态**: ${healthScore.status}\n\n`;
  report += `**评分说明**:\n`;
  report += `- ✅ 90-100分: 优秀 (Excellent)\n`;
  report += `- ⚠️  70-89分: 良好 (Good)\n`;
  report += `- ⚠️  50-69分: 需要改进 (Needs Improvement)\n`;
  report += `- ❌ 0-49分: 紧急处理 (Critical)\n\n`;

  // 问题列表
  if (issues.length > 0) {
    report += `## ⚠️  发现的问题\n\n`;
    report += `**问题总数**: ${issues.length} 个\n\n`;

    const highIssues = issues.filter(i => i.severity === 'high');
    const mediumIssues = issues.filter(i => i.severity === 'medium');
    const lowIssues = issues.filter(i => i.severity === 'low');

    if (highIssues.length > 0) {
      report += `### 🔴 高优先级 (${highIssues.length}个)\n\n`;
      highIssues.forEach((issue, i) => {
        report += `${i+1}. **${issue.file || issue.type}**\n`;
        report += `   - ${issue.message}\n`;
        if (issue.details && Array.isArray(issue.details)) {
          issue.details.forEach(d => report += `     - ${d}\n`);
        }
        report += `\n`;
      });
    }

    if (mediumIssues.length > 0) {
      report += `### 🟡 中优先级 (${mediumIssues.length}个)\n\n`;
      mediumIssues.forEach((issue, i) => {
        report += `${i+1}. **${issue.file || issue.type}**\n`;
        report += `   - ${issue.message}\n`;
        if (issue.details && Array.isArray(issue.details)) {
          report += `   - 涉及文件:\n`;
          issue.details.slice(0, 5).forEach(d => report += `     - ${d}\n`);
          if (issue.details.length > 5) {
            report += `     - ... 以及其他 ${issue.details.length - 5} 个文件\n`;
          }
        }
        report += `\n`;
      });
    }

    if (lowIssues.length > 0) {
      report += `### 🟢 低优先级 (${lowIssues.length}个)\n\n`;
      lowIssues.forEach((issue, i) => {
        report += `${i+1}. ${issue.message}\n`;
      });
      report += `\n`;
    }
  } else {
    report += `## ✅ 未发现问题\n\n`;
    report += `所有API Client都已正确注册和维护！\n\n`;
  }

  // ESLint状态
  report += `## ⚙️  ESLint配置状态\n\n`;
  if (eslintCheck.configured) {
    report += `✅ **已配置**: ESLint已启用 \`no-restricted-imports\` 规则\n\n`;
    report += `**受限制的API** (${eslintCheck.rules.length}个):\n`;
    eslintCheck.rules.forEach(api => report += `- ${api}\n`);
  } else {
    report += `❌ **未配置**: ESLint未启用废弃API限制\n\n`;
    report += `**建议**: 参考 \`ESLINT_SETUP_GUIDE.md\` 配置ESLint规则\n`;
  }
  report += `\n`;

  // 建议行动
  report += `## 💡 建议行动\n\n`;

  if (stats.unregisteredFiles.length > 0) {
    report += `### 1. 注册未注册的API Client\n\n`;
    report += `以下API Client需要在 \`API_CLIENT_INDEX.md\` 中注册:\n\n`;
    stats.unregisteredFiles.forEach(api => report += `- [ ] ${api}\n`);
    report += `\n`;
  }

  if (stats.deprecatedButUsed.length > 0) {
    report += `### 2. 迁移废弃API的使用\n\n`;
    stats.deprecatedButUsed.forEach(item => {
      report += `- [ ] **${item.api}** (${item.count}个文件使用中)\n`;
      report += `  - 参考 \`${item.api}.ts\` 中的迁移指南\n`;
    });
    report += `\n`;
  }

  if (!eslintCheck.configured || issues.some(i => i.type === 'eslint')) {
    report += `### 3. 完善ESLint配置\n\n`;
    report += `- [ ] 配置 ESLint \`no-restricted-imports\` 规则\n`;
    report += `- [ ] 添加所有废弃API的限制规则\n`;
    report += `- [ ] 参考: \`ESLINT_SETUP_GUIDE.md\`\n\n`;
  }

  if (stats.deprecatedCodeLines > 0) {
    report += `### 4. 清理废弃代码\n\n`;
    report += `- [ ] Phase 4: 删除 ${stats.deprecatedCount} 个废弃的API Client文件\n`;
    report += `- [ ] 预计减少代码: ${stats.deprecatedCodeLines} 行 (${Math.round(stats.deprecatedCodeLines/stats.totalCodeLines*100)}%)\n\n`;
  }

  report += `---\n\n`;
  report += `**审计完成时间**: ${new Date().toISOString()}\n`;
  report += `**审计工具**: \`audit-api-clients.js\`\n`;

  return report;
}

/**
 * 计算代码健康度评分
 */
function calculateHealthScore(stats, issues) {
  let score = 100;

  // 扣分项
  const registrationRate = stats.registeredCount / stats.totalFiles;
  score -= (1 - registrationRate) * 30; // 未注册扣30分

  const deprecatedUsageRate = stats.deprecatedButUsed.length / Math.max(stats.deprecatedCount, 1);
  score -= deprecatedUsageRate * 20; // 废弃但仍使用扣20分

  const deprecatedCodeRate = stats.deprecatedCodeLines / stats.totalCodeLines;
  score -= deprecatedCodeRate * 20; // 废弃代码占比扣20分

  const highIssues = issues.filter(i => i.severity === 'high').length;
  score -= highIssues * 10; // 每个高优先级问题扣10分

  const mediumIssues = issues.filter(i => i.severity === 'medium').length;
  score -= mediumIssues * 5; // 每个中优先级问题扣5分

  score = Math.max(0, Math.round(score));

  let status;
  let emoji;
  if (score >= 90) {
    status = '✅ 优秀 (Excellent)';
    emoji = '✅';
  } else if (score >= 70) {
    status = '⚠️  良好 (Good)';
    emoji = '⚠️';
  } else if (score >= 50) {
    status = '⚠️  需要改进 (Needs Improvement)';
    emoji = '⚠️';
  } else {
    status = '❌ 紧急处理 (Critical)';
    emoji = '❌';
  }

  return { score, status, emoji };
}

// ==================== CLI入口 ====================

function main() {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    outputFile: null,
  };

  // 解析输出文件参数
  const outputArg = args.find(arg => arg.startsWith('--output='));
  if (outputArg) {
    options.outputFile = outputArg.split('=')[1];
  }

  // 执行审计
  const result = auditApiClients(options);
  const { stats, issues } = result;

  // 生成报告
  const report = generateReport(result);

  // 输出报告
  console.log('\n' + '='.repeat(60));
  console.log('📋 审计完成！');
  console.log('='.repeat(60));

  const healthScore = calculateHealthScore(stats, issues);
  console.log(`\n${healthScore.emoji} 代码健康度: ${healthScore.score}/100 - ${healthScore.status}`);

  console.log(`\n📊 统计:`);
  console.log(`  - 总计: ${stats.totalFiles} 个API Client`);
  console.log(`  - 活跃: ${stats.activeCount} 个 (${Math.round(stats.activeCount/stats.totalFiles*100)}%)`);
  console.log(`  - 废弃: ${stats.deprecatedCount} 个 (${Math.round(stats.deprecatedCount/stats.totalFiles*100)}%)`);
  console.log(`  - 未注册: ${stats.unregisteredFiles.length} 个`);
  console.log(`  - 废弃但仍使用: ${stats.deprecatedButUsed.length} 个`);

  if (issues.length > 0) {
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;
    console.log(`\n⚠️  发现 ${issues.length} 个问题:`);
    if (highIssues > 0) console.log(`  - 🔴 高优先级: ${highIssues} 个`);
    if (mediumIssues > 0) console.log(`  - 🟡 中优先级: ${mediumIssues} 个`);
  } else {
    console.log(`\n✅ 未发现问题！`);
  }

  // 保存报告
  if (options.outputFile) {
    const outputPath = path.resolve(options.outputFile);
    fs.writeFileSync(outputPath, report, 'utf-8');
    console.log(`\n📄 完整报告已保存到: ${outputPath}`);
  } else {
    const defaultOutput = path.join(API_DIR, 'API_AUDIT_REPORT.md');
    fs.writeFileSync(defaultOutput, report, 'utf-8');
    console.log(`\n📄 完整报告已保存到: ${defaultOutput}`);
  }

  console.log(`\n💡 运行 \`node audit-api-clients.js --verbose\` 查看详细信息\n`);

  // 返回退出码（如果有高优先级问题则返回1）
  const hasHighIssues = issues.some(i => i.severity === 'high');
  process.exit(hasHighIssues ? 1 : 0);
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { auditApiClients, generateReport, calculateHealthScore };
