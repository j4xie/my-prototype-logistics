/**
 * TASK-P3-018C UI Hook层统一改造 - 最终验证脚本
 *
 * @description 验证UI Hook层统一改造的完成度和质量
 * @created 2025-02-02
 * @dependency TASK-P3-018B中央Mock服务(100%完成) + P3-018C改造完成
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 验证配置
const VALIDATION_CONFIG = {
  PROJECT_ROOT: process.cwd(),
  HOOKS_DIR: 'src/hooks',
  API_CONFIG_FILE: 'src/lib/api-config.ts',
  API_CLIENT_FILE: 'src/lib/api.ts',
  MOCK_STATUS_HOOK: 'src/hooks/useMockStatus.ts',
  API_HOOK_FILE: 'src/hooks/useApi-simple.ts',
  MOCK_TOGGLE_COMPONENT: 'src/components/dev/MockToggle.tsx',
  HOOK_GUIDE: 'src/hooks/api/README.md'
};

/**
 * 验证结果记录器
 */
class ValidationReporter {
  constructor() {
    this.results = {
      technical: [],
      functional: [],
      quality: [],
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        completionRate: 0
      }
    };
  }

  addResult(category, checkName, passed, details = '', recommendation = '') {
    const result = {
      check: checkName,
      passed,
      details,
      recommendation,
      timestamp: new Date().toISOString()
    };

    this.results[category].push(result);
    this.results.summary.totalChecks++;
    if (passed) {
      this.results.summary.passedChecks++;
    } else {
      this.results.summary.failedChecks++;
    }
  }

  generateReport() {
    this.results.summary.completionRate =
      (this.results.summary.passedChecks / this.results.summary.totalChecks * 100).toFixed(1);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const reportPath = `scripts/validation/reports/task-p3-018c-final-report-${timestamp}.md`;

    // 确保报告目录存在
    const reportsDir = path.dirname(reportPath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const report = this.formatReport();
    fs.writeFileSync(reportPath, report);

    return { reportPath, results: this.results };
  }

  formatReport() {
    const { summary, technical, functional, quality } = this.results;

    return `# TASK-P3-018C UI Hook层统一改造 - 最终验证报告

**验证时间**: ${new Date().toLocaleString('zh-CN')}
**完成度**: ${summary.completionRate}% (${summary.passedChecks}/${summary.totalChecks})

## 📊 验证摘要

- ✅ **通过检查**: ${summary.passedChecks}个
- ❌ **失败检查**: ${summary.failedChecks}个
- 📈 **整体完成度**: ${summary.completionRate}%

## 🔧 技术验收

${this.formatSection(technical)}

## 🎯 功能验收

${this.formatSection(functional)}

## 📋 质量验收

${this.formatSection(quality)}

## 🎯 验收结论

${summary.completionRate >= 95
  ? '✅ **TASK-P3-018C验收通过** - UI Hook层统一改造达到质量标准，可以进入下一阶段'
  : summary.completionRate >= 85
  ? '⚠️ **TASK-P3-018C基本完成** - 主要功能正常，有部分待优化项'
  : '❌ **TASK-P3-018C需要完善** - 存在关键问题，需要修复后重新验收'
}

---
**生成时间**: ${new Date().toISOString()}
**验证工具**: task-p3-018c-final-validation.js
`;
  }

  formatSection(items) {
    if (items.length === 0) return '暂无检查项\n';

    return items.map(item => `
### ${item.passed ? '✅' : '❌'} ${item.check}

**结果**: ${item.passed ? '通过' : '失败'}
**详情**: ${item.details}
${item.recommendation ? `**建议**: ${item.recommendation}` : ''}
`).join('\n');
  }
}

/**
 * 主验证器
 */
class P3018CValidator {
  constructor() {
    this.reporter = new ValidationReporter();
    this.projectRoot = VALIDATION_CONFIG.PROJECT_ROOT;
  }

  /**
   * 执行完整验证
   */
  async runFullValidation() {
    console.log('🚀 开始TASK-P3-018C UI Hook层统一改造验证...\n');

    // 技术验收
    await this.validateTechnicalRequirements();

    // 功能验收
    await this.validateFunctionalRequirements();

    // 质量验收
    await this.validateQualityRequirements();

    // 生成报告
    const { reportPath, results } = this.reporter.generateReport();

    console.log(`\n📋 验证完成！报告已生成: ${reportPath}`);
    console.log(`📊 总体完成度: ${results.summary.completionRate}%`);

    return results;
  }

  /**
   * 技术验收 - API客户端Mock集成
   */
  async validateTechnicalRequirements() {
    console.log('🔧 执行技术验收...');

    // 1. API配置中心验证
    this.checkFileExists(
      VALIDATION_CONFIG.API_CONFIG_FILE,
      'API配置中心存在',
      'api-config.ts文件包含Mock配置管理'
    );

    // 2. API客户端Mock感知验证
    this.checkApiClientMockIntegration();

    // 3. Mock状态Hook验证
    this.checkFileExists(
      VALIDATION_CONFIG.MOCK_STATUS_HOOK,
      'Mock状态Hook存在',
      'useMockStatus Hook提供Mock状态监控'
    );

    // 4. Hook系统验证
    this.checkHookSystem();

    // 5. TypeScript编译验证
    await this.checkTypeScriptCompilation();
  }

  /**
   * 功能验收 - Mock/Real API透明切换
   */
  async validateFunctionalRequirements() {
    console.log('🎯 执行功能验收...');

    // 1. Mock切换控制台验证
    this.checkFileExists(
      VALIDATION_CONFIG.MOCK_TOGGLE_COMPONENT,
      'Mock切换控制台存在',
      'MockToggle组件提供开发环境切换功能'
    );

    // 2. Hook使用指南验证
    this.checkFileExists(
      VALIDATION_CONFIG.HOOK_GUIDE,
      'Hook使用指南存在',
      'README.md提供完整的Hook使用说明'
    );

    // 3. 环境感知验证
    this.checkEnvironmentAwareness();

    // 4. 业务Hook模块验证
    this.checkBusinessHooks();
  }

  /**
   * 质量验收 - 代码质量和性能
   */
  async validateQualityRequirements() {
    console.log('📋 执行质量验收...');

    // 1. 构建验证
    await this.checkBuildSuccess();

    // 2. 代码风格验证
    await this.checkCodeQuality();

    // 3. 无直接API调用验证
    this.checkNoDirectApiCalls();

    // 4. 文档完整性验证
    this.checkDocumentationCompleteness();
  }

  /**
   * 检查文件是否存在
   */
  checkFileExists(filePath, checkName, details) {
    const fullPath = path.join(this.projectRoot, filePath);
    const exists = fs.existsSync(fullPath);

    this.reporter.addResult(
      'technical',
      checkName,
      exists,
      exists ? `文件存在: ${filePath}` : `文件缺失: ${filePath}`,
      exists ? '' : `需要创建 ${filePath} 文件`
    );
  }

  /**
   * 检查API客户端Mock集成
   */
  checkApiClientMockIntegration() {
    const apiClientPath = path.join(this.projectRoot, VALIDATION_CONFIG.API_CLIENT_FILE);

    if (fs.existsSync(apiClientPath)) {
      const content = fs.readFileSync(apiClientPath, 'utf8');

      const hasMockConfig = content.includes('mockConfig') && content.includes('MockHealthStatus');
      const hasHealthCheck = content.includes('checkMockHealthStatus');
      const hasApiMode = content.includes('getApiMode');

      const integrated = hasMockConfig && hasHealthCheck && hasApiMode;

      this.reporter.addResult(
        'technical',
        'API客户端Mock集成',
        integrated,
        integrated
          ? 'API客户端已集成Mock感知功能(配置管理+健康检查+模式切换)'
          : `API客户端Mock集成不完整: 配置${hasMockConfig}, 健康检查${hasHealthCheck}, 模式${hasApiMode}`,
        integrated ? '' : '需要完善API客户端的Mock感知功能'
      );
    } else {
      this.reporter.addResult(
        'technical',
        'API客户端Mock集成',
        false,
        'API客户端文件不存在',
        '需要创建或检查API客户端文件路径'
      );
    }
  }

  /**
   * 检查Hook系统
   */
  checkHookSystem() {
    const hookPath = path.join(this.projectRoot, VALIDATION_CONFIG.API_HOOK_FILE);

    if (fs.existsSync(hookPath)) {
      const content = fs.readFileSync(hookPath, 'utf8');

      const hasBaseHook = content.includes('function useApi');
      const hasBusinessHooks = content.includes('useFarming') && content.includes('useProcessing');
      const hasMockStatus = content.includes('useMockStatus');
      const hasCache = content.includes('cache') && content.includes('TTL');

      const complete = hasBaseHook && hasBusinessHooks && hasMockStatus && hasCache;

      this.reporter.addResult(
        'technical',
        'Hook系统完整性',
        complete,
        complete
          ? 'Hook系统包含基础Hook、业务Hook、Mock状态、缓存机制'
          : `Hook系统不完整: 基础${hasBaseHook}, 业务${hasBusinessHooks}, Mock${hasMockStatus}, 缓存${hasCache}`,
        complete ? '' : '需要完善Hook系统的缺失功能'
      );
    } else {
      this.reporter.addResult(
        'technical',
        'Hook系统完整性',
        false,
        'Hook文件不存在',
        '需要创建或检查Hook文件路径'
      );
    }
  }

  /**
   * 检查TypeScript编译
   */
  async checkTypeScriptCompilation() {
    try {
      console.log('  检查TypeScript编译...');
      execSync('npx tsc --noEmit', {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });

      this.reporter.addResult(
        'technical',
        'TypeScript编译',
        true,
        'TypeScript编译成功，无类型错误',
        ''
      );
    } catch (error) {
      this.reporter.addResult(
        'technical',
        'TypeScript编译',
        false,
        `TypeScript编译失败: ${error.message.split('\n')[0]}`,
        '需要修复TypeScript类型错误'
      );
    }
  }

  /**
   * 检查环境感知
   */
  checkEnvironmentAwareness() {
    const configPath = path.join(this.projectRoot, VALIDATION_CONFIG.API_CONFIG_FILE);

    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');

      const hasEnvVar = content.includes('NEXT_PUBLIC_MOCK_ENABLED');
      const hasHealthCheck = content.includes('checkMockHealth');
      const hasUrlOverride = content.includes('getMockEnabledFromURL');

      const aware = hasEnvVar && hasHealthCheck && hasUrlOverride;

      this.reporter.addResult(
        'functional',
        '环境感知能力',
        aware,
        aware
          ? '支持环境变量、健康检查、URL参数覆盖'
          : `环境感知不完整: 环境变量${hasEnvVar}, 健康检查${hasHealthCheck}, URL覆盖${hasUrlOverride}`,
        aware ? '' : '需要完善环境感知功能'
      );
    }
  }

  /**
   * 检查业务Hook模块
   */
  checkBusinessHooks() {
    const hookPath = path.join(this.projectRoot, VALIDATION_CONFIG.API_HOOK_FILE);

    if (fs.existsSync(hookPath)) {
      const content = fs.readFileSync(hookPath, 'utf8');

      const modules = ['useAuth', 'useFarming', 'useProcessing', 'useAIAnalytics'];
      const existingModules = modules.filter(module => content.includes(`function ${module}`));

      const complete = existingModules.length >= 3; // 至少3个核心模块

      this.reporter.addResult(
        'functional',
        '业务Hook模块',
        complete,
        complete
          ? `业务Hook模块完整 (${existingModules.length}/${modules.length}): ${existingModules.join(', ')}`
          : `业务Hook模块不足 (${existingModules.length}/${modules.length}): ${existingModules.join(', ')}`,
        complete ? '' : '需要完善缺失的业务Hook模块'
      );
    }
  }

  /**
   * 检查构建成功
   */
  async checkBuildSuccess() {
    try {
      console.log('  检查Next.js构建...');
      execSync('npm run build', {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });

      this.reporter.addResult(
        'quality',
        'Next.js构建',
        true,
        'Next.js构建成功，所有页面正常生成',
        ''
      );
    } catch (error) {
      this.reporter.addResult(
        'quality',
        'Next.js构建',
        false,
        `Next.js构建失败: ${error.message.split('\n')[0]}`,
        '需要修复构建错误'
      );
    }
  }

  /**
   * 检查代码质量
   */
  async checkCodeQuality() {
    try {
      console.log('  检查ESLint代码质量...');
      const output = execSync('npx eslint src/ --format=json', {
        cwd: this.projectRoot,
        stdio: 'pipe',
        encoding: 'utf8'
      });

      const results = JSON.parse(output);
      const errorCount = results.reduce((sum, file) => sum + file.errorCount, 0);
      const warningCount = results.reduce((sum, file) => sum + file.warningCount, 0);

      const quality = errorCount === 0 && warningCount <= 5; // 允许少量警告

      this.reporter.addResult(
        'quality',
        'ESLint代码质量',
        quality,
        quality
          ? `代码质量良好: ${errorCount}个错误, ${warningCount}个警告`
          : `代码质量待改善: ${errorCount}个错误, ${warningCount}个警告`,
        quality ? '' : '需要修复ESLint报告的问题'
      );
    } catch (error) {
      // ESLint可能有警告但不算失败
      const output = error.stdout || '';
      try {
        const results = JSON.parse(output);
        const errorCount = results.reduce((sum, file) => sum + file.errorCount, 0);
        const warningCount = results.reduce((sum, file) => sum + file.warningCount, 0);

        this.reporter.addResult(
          'quality',
          'ESLint代码质量',
          errorCount === 0,
          `ESLint检查完成: ${errorCount}个错误, ${warningCount}个警告`,
          errorCount > 0 ? '需要修复ESLint错误' : ''
        );
      } catch {
        this.reporter.addResult(
          'quality',
          'ESLint代码质量',
          false,
          'ESLint检查失败',
          '需要检查ESLint配置'
        );
      }
    }
  }

  /**
   * 检查无直接API调用
   */
  checkNoDirectApiCalls() {
    const searchDirs = ['src/components', 'src/app'];
    let hasDirectCalls = false;
    let directCallFiles = [];

    for (const dir of searchDirs) {
      const fullDir = path.join(this.projectRoot, dir);
      if (fs.existsSync(fullDir)) {
        const files = this.getAllTsxFiles(fullDir);

        for (const file of files) {
          const content = fs.readFileSync(file, 'utf8');
          if (content.includes('fetch(') || content.includes('apiClient.')) {
            hasDirectCalls = true;
            directCallFiles.push(path.relative(this.projectRoot, file));
          }
        }
      }
    }

    this.reporter.addResult(
      'quality',
      '无直接API调用',
      !hasDirectCalls,
      !hasDirectCalls
        ? '所有组件都通过Hook访问API'
        : `发现直接API调用: ${directCallFiles.join(', ')}`,
      !hasDirectCalls ? '' : '需要将直接API调用改为Hook方式'
    );
  }

  /**
   * 检查文档完整性
   */
  checkDocumentationCompleteness() {
    const requiredDocs = [
      VALIDATION_CONFIG.HOOK_GUIDE,
      'src/hooks/api/README.md'
    ];

    let completeCount = 0;
    const missingDocs = [];

    for (const doc of requiredDocs) {
      const fullPath = path.join(this.projectRoot, doc);
      if (fs.existsSync(fullPath)) {
        completeCount++;
      } else {
        missingDocs.push(doc);
      }
    }

    const complete = completeCount === requiredDocs.length;

    this.reporter.addResult(
      'quality',
      '文档完整性',
      complete,
      complete
        ? `所有必需文档存在 (${completeCount}/${requiredDocs.length})`
        : `缺失文档 (${completeCount}/${requiredDocs.length}): ${missingDocs.join(', ')}`,
      complete ? '' : '需要创建缺失的文档'
    );
  }

  /**
   * 获取所有TSX文件
   */
  getAllTsxFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...this.getAllTsxFiles(fullPath));
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        files.push(fullPath);
      }
    }

    return files;
  }
}

/**
 * 主函数
 */
async function main() {
  const validator = new P3018CValidator();
  const results = await validator.runFullValidation();

  // 退出码基于完成度
  const exitCode = results.summary.completionRate >= 85 ? 0 : 1;
  process.exit(exitCode);
}

// 执行验证
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 验证过程出错:', error);
    process.exit(1);
  });
}

module.exports = { P3018CValidator, ValidationReporter };
