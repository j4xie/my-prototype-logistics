#!/usr/bin/env node

/**
 * UI设计系统规范合规性检查脚本
 * Phase-3: 食品溯源系统 - TASK-P3-019C
 * 
 * 检查项目中是否遵循Neo Minimal iOS-Style Admin UI设计规范
 */

const fs = require('fs');
const path = require('path');

// 违规项目检查配置
const COMPLIANCE_RULES = {
  // 颜色规范检查
  colorCompliance: {
    patterns: [
      { deprecated: 'text-blue-600', recommended: 'text-[#1890FF]', severity: 'P1' },
      { deprecated: 'bg-blue-600', recommended: 'bg-[#1890FF]', severity: 'P1' },
      { deprecated: 'border-blue-600', recommended: 'border-[#1890FF]', severity: 'P1' },
      { deprecated: 'hover:bg-blue-700', recommended: 'hover:bg-[#4096FF]', severity: 'P1' },
    ]
  },
  
  // 布局规范检查
  layoutCompliance: {
    requiredPatterns: [
      { pattern: 'flex flex-col min-h-screen', description: '页面外层包装器', severity: 'P0' },
      { pattern: 'max-w-\\[390px\\]', description: '最大宽度限制', severity: 'P0' },
      { pattern: 'mx-auto', description: '水平居中', severity: 'P0' },
    ]
  },

  // 卡片设计规范检查
  cardCompliance: {
    requiredPatterns: [
      { pattern: 'bg-white rounded-lg shadow-sm', description: '卡片基础样式', severity: 'P1' },
      { pattern: 'p-4', description: '卡片内边距', severity: 'P2' },
    ]
  }
};

/**
 * 获取目录下的所有文件
 */
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // 跳过特定目录
      if (!['node_modules', '.git', '.next', 'dist', 'build', 'webback-'].some(skip => file.includes(skip))) {
        getAllFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * UI合规性检查器类
 */
class UIComplianceChecker {
  constructor() {
    this.violations = [];
    this.stats = {
      totalFiles: 0,
      violatingFiles: 0,
      totalViolations: 0,
      severityCount: { P0: 0, P1: 0, P2: 0 }
    };
  }

  /**
   * 获取需要检查的文件列表
   */
  getFilesToCheck() {
    const srcDir = path.join(process.cwd(), 'src');
    if (!fs.existsSync(srcDir)) {
      console.log('❌ src目录不存在');
      return [];
    }

    const allFiles = getAllFiles(srcDir);
    
    // 过滤掉测试文件和demo文件
    return allFiles.filter(file => {
      const relativePath = path.relative(process.cwd(), file);
      return !relativePath.includes('test') && 
             !relativePath.includes('demo') && 
             !relativePath.includes('ai-demo') &&
             !file.includes('.test.') &&
             !file.includes('.spec.');
    });
  }

  /**
   * 检查单个文件的合规性
   */
  checkFile(filePath) {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const fileViolations = [];

    // 检查颜色规范
    this.checkColorCompliance(filePath, content, lines, fileViolations);
    
    // 检查布局规范（仅页面文件）
    if (filePath.includes('/app/') && filePath.endsWith('page.tsx')) {
      this.checkLayoutCompliance(filePath, content, lines, fileViolations);
    }

    // 检查卡片设计规范
    this.checkCardCompliance(filePath, content, lines, fileViolations);

    if (fileViolations.length > 0) {
      this.violations.push({
        file: path.relative(process.cwd(), filePath),
        violations: fileViolations
      });
      this.stats.violatingFiles++;
    }

    this.stats.totalFiles++;
  }

  /**
   * 检查颜色规范合规性
   */
  checkColorCompliance(filePath, content, lines, violations) {
    COMPLIANCE_RULES.colorCompliance.patterns.forEach(rule => {
      const regex = new RegExp(rule.deprecated, 'g');
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        violations.push({
          type: 'color',
          severity: rule.severity,
          line: lineNumber,
          issue: `使用已弃用的颜色类: ${rule.deprecated}`,
          recommendation: `建议使用: ${rule.recommended}`,
          context: lines[lineNumber - 1]?.trim()
        });
        this.stats.totalViolations++;
        this.stats.severityCount[rule.severity]++;
      }
    });
  }

  /**
   * 检查页面布局规范合规性
   */
  checkLayoutCompliance(filePath, content, lines, violations) {
    COMPLIANCE_RULES.layoutCompliance.requiredPatterns.forEach(rule => {
      const regex = new RegExp(rule.pattern, 'g');
      
      if (!regex.test(content)) {
        violations.push({
          type: 'layout',
          severity: rule.severity,
          line: 1,
          issue: `页面缺少必需的布局模式: ${rule.description}`,
          recommendation: `添加: ${rule.pattern}`,
          context: '页面级别检查'
        });
        this.stats.totalViolations++;
        this.stats.severityCount[rule.severity]++;
      }
    });
  }

  /**
   * 检查卡片设计规范合规性
   */
  checkCardCompliance(filePath, content, lines, violations) {
    // 如果文件包含卡片相关代码，检查是否符合规范
    if (content.includes('Card') || content.includes('card')) {
      COMPLIANCE_RULES.cardCompliance.requiredPatterns.forEach(rule => {
        const regex = new RegExp(rule.pattern, 'g');
        
        if (!regex.test(content)) {
          violations.push({
            type: 'card',
            severity: rule.severity,
            line: 1,
            issue: `卡片组件缺少推荐样式: ${rule.description}`,
            recommendation: `建议添加: ${rule.pattern}`,
            context: '卡片设计规范检查'
          });
          this.stats.totalViolations++;
          this.stats.severityCount[rule.severity]++;
        }
      });
    }
  }

  /**
   * 运行完整的合规性检查
   */
  run() {
    console.log('🚀 开始UI设计系统规范合规性检查...\n');
    
    const filesToCheck = this.getFilesToCheck();
    
    console.log(`📁 检查文件数量: ${filesToCheck.length}\n`);
    
    filesToCheck.forEach(file => {
      this.checkFile(file);
    });

    this.generateReport();
  }

  /**
   * 生成检查报告
   */
  generateReport() {
    console.log('📊 UI合规性检查报告');
    console.log('='.repeat(50));
    
    // 总体统计
    console.log(`\n📈 总体统计:`);
    console.log(`   总文件数: ${this.stats.totalFiles}`);
    console.log(`   违规文件数: ${this.stats.violatingFiles}`);
    console.log(`   总违规项: ${this.stats.totalViolations}`);
    console.log(`   合规率: ${((this.stats.totalFiles - this.stats.violatingFiles) / this.stats.totalFiles * 100).toFixed(1)}%`);
    
    // 严重程度统计
    console.log(`\n🚨 违规严重程度分布:`);
    console.log(`   P0 (严重): ${this.stats.severityCount.P0}`);
    console.log(`   P1 (中等): ${this.stats.severityCount.P1}`);
    console.log(`   P2 (轻微): ${this.stats.severityCount.P2}`);

    // 详细违规清单
    if (this.violations.length > 0) {
      console.log(`\n🔍 详细违规清单:`);
      
      this.violations.forEach(fileViolation => {
        console.log(`\n📄 ${fileViolation.file}:`);
        
        fileViolation.violations.forEach(violation => {
          const severityIcon = {
            'P0': '🔴',
            'P1': '🟡', 
            'P2': '🟠'
          }[violation.severity];
          
          console.log(`   ${severityIcon} 第${violation.line}行: ${violation.issue}`);
          console.log(`      💡 ${violation.recommendation}`);
          if (violation.context !== '页面级别检查' && violation.context !== '卡片设计规范检查') {
            console.log(`      📝 ${violation.context}`);
          }
        });
      });
    } else {
      console.log(`\n✅ 恭喜！所有检查文件都符合UI设计系统规范！`);
    }

    // 建议
    console.log(`\n💡 改进建议:`);
    if (this.stats.severityCount.P0 > 0) {
      console.log(`   🔴 立即修复 ${this.stats.severityCount.P0} 个P0严重违规项`);
    }
    if (this.stats.severityCount.P1 > 0) {
      console.log(`   🟡 计划修复 ${this.stats.severityCount.P1} 个P1中等违规项`);
    }
    if (this.stats.severityCount.P2 > 0) {
      console.log(`   🟠 优化 ${this.stats.severityCount.P2} 个P2轻微违规项`);
    }

    // 保存报告到文件
    this.saveReport();
  }

  /**
   * 保存报告到文件
   */
  saveReport() {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const reportPath = `scripts/reports/ui-compliance-${timestamp}.json`;
    
    // 确保目录存在
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const report = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      violations: this.violations,
      summary: {
        complianceRate: ((this.stats.totalFiles - this.stats.violatingFiles) / this.stats.totalFiles * 100).toFixed(1),
        needsImmediateAttention: this.stats.severityCount.P0 > 0,
        overallHealth: this.stats.severityCount.P0 === 0 && this.stats.severityCount.P1 <= 5 ? 'Good' : 
                      this.stats.severityCount.P0 === 0 ? 'Fair' : 'Poor'
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 报告已保存到: ${reportPath}`);
  }
}

// 运行检查
if (require.main === module) {
  const checker = new UIComplianceChecker();
  checker.run();
}

module.exports = UIComplianceChecker; 