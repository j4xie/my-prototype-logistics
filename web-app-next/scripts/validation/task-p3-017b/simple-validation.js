/**
 * MSW技术方案可行性验证脚本 - 简化版本
 * TASK-P3-017B Day 3 - 技术验证
 * 遵循规范: development-management-unified.mdc
 */

const fs = require('fs');
const path = require('path');

class SimpleValidation {
  constructor() {
    this.results = [];
    this.projectRoot = path.join(__dirname, '../../../');
  }

  addResult(name, status, message, details = null) {
    this.results.push({
      name,
      status,
      message,
      details,
      timestamp: new Date().toISOString()
    });
  }

  log(message, type = 'info') {
    const symbols = {
      info: 'ℹ',
      success: '✅',
      error: '❌',
      warn: '⚠️'
    };
    console.log(`${symbols[type]} ${message}`);
  }

  // 验证MSW相关依赖
  validateMSWDependencies() {
    this.log('验证MSW核心依赖...', 'info');

    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');

      if (!fs.existsSync(packageJsonPath)) {
        this.addResult('Package.json检查', 'FAIL', 'package.json文件不存在');
        return;
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // 检查Next.js
      if (dependencies['next']) {
        this.addResult('Next.js检查', 'PASS', `Next.js版本: ${dependencies['next']}`);
      } else {
        this.addResult('Next.js检查', 'FAIL', 'Next.js依赖未安装');
      }

      // 检查TypeScript
      if (dependencies['typescript']) {
        this.addResult('TypeScript检查', 'PASS', `TypeScript版本: ${dependencies['typescript']}`);
      } else {
        this.addResult('TypeScript检查', 'WARN', 'TypeScript依赖未安装');
      }

      // 检查React
      if (dependencies['react']) {
        this.addResult('React检查', 'PASS', `React版本: ${dependencies['react']}`);
      } else {
        this.addResult('React检查', 'FAIL', 'React依赖未安装');
      }

      // 检查MSW (可能未安装)
      if (dependencies['msw']) {
        this.addResult('MSW检查', 'PASS', `MSW版本: ${dependencies['msw']}`);
      } else {
        this.addResult('MSW检查', 'WARN', 'MSW依赖未安装，需要安装msw@^2.0.0');
      }

    } catch (error) {
      this.addResult('依赖验证', 'FAIL', '依赖验证过程出错', error.message);
    }
  }

  // 验证项目结构
  validateProjectStructure() {
    this.log('验证项目结构...', 'info');

    try {
      // 检查src目录
      const srcDir = path.join(this.projectRoot, 'src');
      if (fs.existsSync(srcDir)) {
        this.addResult('src目录检查', 'PASS', 'src/目录存在');

        // 检查app目录 (App Router)
        const appDir = path.join(srcDir, 'app');
        if (fs.existsSync(appDir)) {
          this.addResult('App Router检查', 'PASS', 'src/app/目录存在，使用App Router');

          // 检查layout.tsx
          const layoutFile = path.join(appDir, 'layout.tsx');
          if (fs.existsSync(layoutFile)) {
            this.addResult('Root Layout检查', 'PASS', 'layout.tsx文件存在');
          } else {
            this.addResult('Root Layout检查', 'WARN', 'layout.tsx文件不存在');
          }
        } else {
          this.addResult('App Router检查', 'WARN', 'src/app/目录不存在，可能使用Pages Router');
        }

        // 检查组件目录
        const componentsDir = path.join(srcDir, 'components');
        if (fs.existsSync(componentsDir)) {
          this.addResult('组件目录检查', 'PASS', 'src/components/目录存在');
        } else {
          this.addResult('组件目录检查', 'WARN', 'src/components/目录不存在');
        }

      } else {
        this.addResult('src目录检查', 'FAIL', 'src/目录不存在');
      }

      // 检查公共目录
      const publicDir = path.join(this.projectRoot, 'public');
      if (fs.existsSync(publicDir)) {
        this.addResult('public目录检查', 'PASS', 'public/目录存在');
      } else {
        this.addResult('public目录检查', 'WARN', 'public/目录不存在');
      }

    } catch (error) {
      this.addResult('项目结构验证', 'FAIL', '项目结构验证过程出错', error.message);
    }
  }

  // 验证Mock API架构准备情况
  validateMockAPIReadiness() {
    this.log('验证Mock API架构准备情况...', 'info');

    try {
      // 检查是否有现有的Mock相关目录
      const srcDir = path.join(this.projectRoot, 'src');

      // 检查mocks目录
      const mocksDir = path.join(srcDir, 'mocks');
      if (fs.existsSync(mocksDir)) {
        this.addResult('Mocks目录检查', 'PASS', 'src/mocks/目录已存在');

        // 检查子目录
        const subdirs = ['handlers', 'data', 'schemas', 'config'];
        subdirs.forEach(subdir => {
          const subdirPath = path.join(mocksDir, subdir);
          if (fs.existsSync(subdirPath)) {
            this.addResult(`${subdir}目录检查`, 'PASS', `src/mocks/${subdir}/目录存在`);
          } else {
            this.addResult(`${subdir}目录检查`, 'WARN', `src/mocks/${subdir}/目录需要创建`);
          }
        });
      } else {
        this.addResult('Mocks目录检查', 'WARN', 'src/mocks/目录不存在，需要创建完整的Mock架构');
      }

      // 检查现有API相关文件
      const possibleApiDirs = [
        path.join(srcDir, 'api'),
        path.join(srcDir, 'services'),
        path.join(srcDir, 'lib'),
        path.join(srcDir, 'utils')
      ];

      let hasApiStructure = false;
      possibleApiDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
          this.addResult('API相关目录检查', 'PASS', `${path.basename(dir)}/目录存在`);
          hasApiStructure = true;
        }
      });

      if (!hasApiStructure) {
        this.addResult('API结构检查', 'WARN', '未发现明显的API相关目录结构');
      }

    } catch (error) {
      this.addResult('Mock API准备验证', 'FAIL', 'Mock API准备验证过程出错', error.message);
    }
  }

  // 生成验证报告
  generateReport() {
    const reportDir = path.join(this.projectRoot, 'scripts/validation/task-p3-017b/reports');

    // 确保报告目录存在
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'PASS').length,
      warned: this.results.filter(r => r.status === 'WARN').length,
      failed: this.results.filter(r => r.status === 'FAIL').length
    };

    const report = {
      taskId: 'TASK-P3-017B',
      validationType: 'MSW技术方案可行性验证',
      timestamp: new Date().toISOString(),
      summary,
      results: this.results
    };

    // 生成JSON报告
    const jsonReportPath = path.join(reportDir, 'msw-validation-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

    // 生成Markdown报告
    this.generateMarkdownReport(report, reportDir);

    this.log(`验证报告已生成: ${jsonReportPath}`, 'success');
  }

  generateMarkdownReport(report, reportDir) {
    const markdownPath = path.join(reportDir, 'msw-validation-report.md');

    let markdown = `# MSW技术方案可行性验证报告

**任务ID**: ${report.taskId}
**验证类型**: ${report.validationType}
**验证时间**: ${report.timestamp}

## 📊 验证摘要

- **总计**: ${report.summary.total}
- **通过**: ${report.summary.passed} ✅
- **警告**: ${report.summary.warned} ⚠️
- **失败**: ${report.summary.failed} ❌

## 📋 详细结果

`;

    for (const result of report.results) {
      const statusSymbol = {
        'PASS': '✅',
        'WARN': '⚠️',
        'FAIL': '❌'
      }[result.status];

      markdown += `### ${statusSymbol} ${result.name}

**状态**: ${result.status}
**消息**: ${result.message}
**时间**: ${result.timestamp}

`;

      if (result.details) {
        markdown += `**详情**: ${result.details}

`;
      }
    }

    markdown += `## 🎯 建议行动

`;

    const warnings = report.results.filter(r => r.status === 'WARN');
    const failures = report.results.filter(r => r.status === 'FAIL');

    if (failures.length > 0) {
      markdown += `### 🚨 优先处理（失败项）

`;
      failures.forEach(failure => {
        markdown += `- **${failure.name}**: ${failure.message}
`;
      });
    }

    if (warnings.length > 0) {
      markdown += `### ⚠️ 建议改进（警告项）

`;
      warnings.forEach(warning => {
        markdown += `- **${warning.name}**: ${warning.message}
`;
      });
    }

    if (failures.length === 0 && warnings.length === 0) {
      markdown += `### 🎉 验证通过

所有验证项目均已通过，MSW技术方案可行性得到确认。

`;
    }

    markdown += `---

**生成时间**: ${new Date().toISOString()}
**遵循规范**: development-management-unified.mdc
`;

    fs.writeFileSync(markdownPath, markdown);
  }

  // 运行完整验证
  async runFullValidation() {
    console.log('🚀 开始MSW技术方案可行性验证');
    console.log('='.repeat(60));

    this.validateMSWDependencies();
    this.validateProjectStructure();
    this.validateMockAPIReadiness();

    console.log('='.repeat(60));

    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'PASS').length,
      warned: this.results.filter(r => r.status === 'WARN').length,
      failed: this.results.filter(r => r.status === 'FAIL').length
    };

    this.log(`验证完成! 总计: ${summary.total}, 通过: ${summary.passed}, 警告: ${summary.warned}, 失败: ${summary.failed}`, 'info');

    if (summary.failed > 0) {
      this.log('存在验证失败项，请检查报告详情', 'error');
    } else if (summary.warned > 0) {
      this.log('存在警告项，建议优化配置', 'warn');
    } else {
      this.log('所有验证项目通过! MSW技术方案可行性确认', 'success');
    }

    this.generateReport();
  }
}

// 主执行
async function main() {
  const validator = new SimpleValidation();
  await validator.runFullValidation();
}

main().catch(console.error);
