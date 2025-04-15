/**
 * 测试环境验证工具
 * @file test-env-validator.js
 * @description 用于验证测试环境配置，检查路径映射和依赖问题
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk') || { green: (t) => t, red: (t) => t, yellow: (t) => t, blue: (t) => t };

// 基本配置
const config = {
  rootDir: path.resolve(__dirname, '..'),
  testDirs: ['tests/unit', 'tests/integration', 'tests/e2e'],
  modulesDirs: ['components/modules'],
  testPattern: /\.test\.js$/,
  jestConfigPath: path.resolve(__dirname, '../jest.config.js'),
  packageJsonPath: path.resolve(__dirname, '../package.json'),
  babelConfigPath: path.resolve(__dirname, '../babel.config.js'),
  importAliases: {
    '@': 'components',
    '@modules': 'components/modules',
    '@utils': 'components/modules/utils',
    '@auth': 'components/modules/auth',
    '@data': 'components/modules/data',
    '@store': 'components/modules/store',
    '@ui': 'components/modules/ui'
  }
};

// 问题严重程度
const SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

/**
 * 测试环境验证类
 */
class TestEnvironmentValidator {
  constructor() {
    this.issues = [];
    this.testFiles = [];
    this.moduleFiles = [];
    this.importMap = new Map();
  }

  /**
   * 运行验证
   */
  async validate() {
    console.log(chalk.blue('🔍 开始验证测试环境...'));
    
    // 验证基础配置文件存在
    this.validateConfigFiles();
    
    // 查找所有测试文件
    this.findTestFiles();
    
    // 查找所有模块文件
    this.findModuleFiles();
    
    // 验证测试文件中的导入路径
    await this.validateImports();
    
    // 验证测试覆盖率配置
    this.validateCoverageConfig();
    
    // 验证Jest配置
    this.validateJestConfig();
    
    // 报告结果
    this.reportResults();
    
    return {
      issues: this.issues,
      testFiles: this.testFiles,
      moduleFiles: this.moduleFiles,
      valid: this.issues.filter(issue => issue.severity === SEVERITY.ERROR).length === 0
    };
  }

  /**
   * 验证配置文件是否存在
   */
  validateConfigFiles() {
    const files = [
      { path: config.jestConfigPath, name: 'Jest配置' },
      { path: config.packageJsonPath, name: 'package.json' },
      { path: config.babelConfigPath, name: 'Babel配置' }
    ];
    
    for (const file of files) {
      if (!fs.existsSync(file.path)) {
        this.addIssue(
          `找不到${file.name}文件: ${file.path}`,
          SEVERITY.ERROR,
          '配置文件缺失可能导致测试环境不完整'
        );
      }
    }
  }

  /**
   * 查找所有测试文件
   */
  findTestFiles() {
    for (const dir of config.testDirs) {
      const fullPath = path.join(config.rootDir, dir);
      if (fs.existsSync(fullPath)) {
        this.findFilesRecursive(fullPath, config.testPattern, this.testFiles);
      } else {
        this.addIssue(
          `测试目录不存在: ${fullPath}`,
          SEVERITY.WARNING,
          '缺少测试目录可能导致部分测试未被发现'
        );
      }
    }
    
    console.log(chalk.blue(`找到 ${this.testFiles.length} 个测试文件`));
  }

  /**
   * 查找所有模块文件
   */
  findModuleFiles() {
    for (const dir of config.modulesDirs) {
      const fullPath = path.join(config.rootDir, dir);
      if (fs.existsSync(fullPath)) {
        this.findFilesRecursive(fullPath, /\.js$/, this.moduleFiles);
      } else {
        this.addIssue(
          `模块目录不存在: ${fullPath}`,
          SEVERITY.ERROR,
          '缺少模块目录将导致测试无法找到被测模块'
        );
      }
    }
    
    console.log(chalk.blue(`找到 ${this.moduleFiles.length} 个模块文件`));
  }

  /**
   * 递归查找文件
   * @param {string} dir - 目录路径
   * @param {RegExp} pattern - 文件名模式
   * @param {Array} results - 结果数组
   */
  findFilesRecursive(dir, pattern, results) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        this.findFilesRecursive(fullPath, pattern, results);
      } else if (pattern.test(file)) {
        results.push(fullPath);
      }
    }
  }

  /**
   * 验证导入语句
   */
  async validateImports() {
    console.log(chalk.blue('验证测试文件中的导入路径...'));
    
    for (const file of this.testFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const requireMatches = content.match(/require\(['"]([^'"]+)['"]\)/g) || [];
        const importMatches = content.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/g) || [];
        
        const relDir = path.relative(config.rootDir, path.dirname(file));
        
        // 分析 require 语句
        for (const match of requireMatches) {
          const modulePath = match.match(/require\(['"]([^'"]+)['"]\)/)[1];
          this.analyzeImport(file, modulePath, relDir);
        }
        
        // 分析 import 语句
        for (const match of importMatches) {
          const modulePath = match.match(/from\s+['"]([^'"]+)['"]/)[1];
          this.analyzeImport(file, modulePath, relDir);
        }
      } catch (err) {
        this.addIssue(
          `解析文件 ${file} 失败: ${err.message}`,
          SEVERITY.ERROR,
          '无法解析文件内容可能导致导入分析不完整'
        );
      }
    }
  }

  /**
   * 分析导入路径
   * @param {string} file - 文件路径
   * @param {string} importPath - 导入路径
   * @param {string} relDir - 相对目录
   */
  analyzeImport(file, importPath, relDir) {
    // 忽略内置模块和第三方模块
    if (!importPath.startsWith('.') && !importPath.startsWith('@') && !importPath.startsWith('/')) {
      return;
    }
    
    // 记录导入关系
    if (!this.importMap.has(file)) {
      this.importMap.set(file, []);
    }
    this.importMap.get(file).push(importPath);
    
    // 检查别名导入
    if (importPath.startsWith('@')) {
      const aliasKey = Object.keys(config.importAliases).find(alias => 
        importPath === alias || importPath.startsWith(`${alias}/`)
      );
      
      if (!aliasKey) {
        this.addIssue(
          `文件 ${file} 使用了未配置的导入别名: ${importPath}`,
          SEVERITY.WARNING,
          '未配置的导入别名可能导致模块解析失败'
        );
      }
      return;
    }
    
    // 检查相对路径导入
    if (importPath.startsWith('.')) {
      const basePath = path.dirname(file);
      let resolvedPath;
      
      try {
        resolvedPath = path.resolve(basePath, importPath);
        
        // 尝试添加.js扩展名如果未指定
        if (!path.extname(resolvedPath)) {
          resolvedPath += '.js';
        }
        
        if (!fs.existsSync(resolvedPath)) {
          this.addIssue(
            `文件 ${file} 导入的模块不存在: ${importPath} (解析为 ${resolvedPath})`,
            SEVERITY.ERROR,
            '导入不存在的模块将导致测试失败'
          );
        }
      } catch (err) {
        this.addIssue(
          `解析导入路径失败 ${file} -> ${importPath}: ${err.message}`,
          SEVERITY.ERROR,
          '导入路径解析失败将导致测试无法运行'
        );
      }
    }
  }

  /**
   * 验证测试覆盖率配置
   */
  validateCoverageConfig() {
    try {
      // 尝试加载 Jest 配置
      let jestConfig;
      if (fs.existsSync(config.jestConfigPath)) {
        jestConfig = require(config.jestConfigPath);
      } else {
        // 尝试从 package.json 读取
        const packageJson = JSON.parse(fs.readFileSync(config.packageJsonPath, 'utf8'));
        jestConfig = packageJson.jest || {};
      }
      
      // 检查测试覆盖率配置
      const coverageConfig = jestConfig.collectCoverage !== undefined ? 
        jestConfig : 
        { collectCoverage: false };
      
      if (!coverageConfig.collectCoverage) {
        this.addIssue(
          '测试覆盖率收集未启用',
          SEVERITY.WARNING,
          '未启用测试覆盖率收集将无法生成覆盖率报告'
        );
      }
      
      if (!coverageConfig.coverageDirectory) {
        this.addIssue(
          '未指定测试覆盖率报告目录',
          SEVERITY.WARNING,
          '未指定覆盖率报告目录可能导致覆盖率数据未正确保存'
        );
      }
      
      if (!coverageConfig.collectCoverageFrom || coverageConfig.collectCoverageFrom.length === 0) {
        this.addIssue(
          '未指定测试覆盖率收集模式',
          SEVERITY.WARNING,
          '未指定覆盖率收集模式可能导致部分模块未被纳入覆盖率统计'
        );
      }
    } catch (err) {
      this.addIssue(
        `验证测试覆盖率配置失败: ${err.message}`,
        SEVERITY.ERROR,
        '无法验证测试覆盖率配置可能导致覆盖率统计不准确'
      );
    }
  }

  /**
   * 验证Jest配置
   */
  validateJestConfig() {
    try {
      let jestConfig;
      if (fs.existsSync(config.jestConfigPath)) {
        jestConfig = require(config.jestConfigPath);
      } else {
        const packageJson = JSON.parse(fs.readFileSync(config.packageJsonPath, 'utf8'));
        jestConfig = packageJson.jest || {};
      }
      
      // 检查模块解析配置
      if (!jestConfig.moduleNameMapper || Object.keys(jestConfig.moduleNameMapper).length === 0) {
        this.addIssue(
          'Jest配置缺少模块名称映射',
          SEVERITY.WARNING,
          '缺少模块名称映射可能导致别名导入解析失败'
        );
      }
      
      // 检查测试环境
      if (!jestConfig.testEnvironment) {
        this.addIssue(
          'Jest配置未指定测试环境',
          SEVERITY.INFO,
          '未指定测试环境将使用默认环境，可能不适用于所有测试'
        );
      }
      
      // 检查测试匹配模式
      if (!jestConfig.testMatch && !jestConfig.testRegex) {
        this.addIssue(
          'Jest配置未指定测试文件匹配模式',
          SEVERITY.WARNING,
          '未指定测试文件匹配模式可能导致测试文件未被发现'
        );
      }
      
      // 检查转换器配置
      if (!jestConfig.transform) {
        this.addIssue(
          'Jest配置未指定代码转换器',
          SEVERITY.INFO,
          '未指定代码转换器可能导致ES6+语法无法正确解析'
        );
      }
    } catch (err) {
      this.addIssue(
        `验证Jest配置失败: ${err.message}`,
        SEVERITY.ERROR,
        '无法验证Jest配置可能导致测试环境不完整'
      );
    }
  }

  /**
   * 添加问题
   * @param {string} message - 问题描述
   * @param {string} severity - 严重程度
   * @param {string} impact - 影响
   * @param {Array} fixes - 修复建议
   */
  addIssue(message, severity = SEVERITY.WARNING, impact = '', fixes = []) {
    this.issues.push({
      message,
      severity,
      impact,
      fixes: fixes || [],
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 报告结果
   */
  reportResults() {
    const errors = this.issues.filter(issue => issue.severity === SEVERITY.ERROR);
    const warnings = this.issues.filter(issue => issue.severity === SEVERITY.WARNING);
    const infos = this.issues.filter(issue => issue.severity === SEVERITY.INFO);
    
    console.log('\n' + chalk.blue('📊 测试环境验证结果:'));
    console.log(chalk.blue(`找到 ${this.testFiles.length} 个测试文件`));
    console.log(chalk.blue(`找到 ${this.moduleFiles.length} 个模块文件`));
    console.log(chalk.red(`错误: ${errors.length}`));
    console.log(chalk.yellow(`警告: ${warnings.length}`));
    console.log(chalk.blue(`信息: ${infos.length}`));
    
    if (errors.length > 0) {
      console.log('\n' + chalk.red('🚨 错误:'));
      errors.forEach((issue, index) => {
        console.log(chalk.red(`${index + 1}. ${issue.message}`));
        if (issue.impact) console.log(chalk.yellow(`   影响: ${issue.impact}`));
        if (issue.fixes && issue.fixes.length > 0) {
          console.log(chalk.green('   建议修复:'));
          issue.fixes.forEach(fix => console.log(chalk.green(`   - ${fix}`)));
        }
      });
    }
    
    if (warnings.length > 0) {
      console.log('\n' + chalk.yellow('⚠️ 警告:'));
      warnings.forEach((issue, index) => {
        console.log(chalk.yellow(`${index + 1}. ${issue.message}`));
        if (issue.impact) console.log(chalk.yellow(`   影响: ${issue.impact}`));
      });
    }
    
    if (errors.length === 0 && warnings.length === 0) {
      console.log('\n' + chalk.green('✅ 未发现任何问题，测试环境配置正确!'));
    } else {
      console.log('\n' + chalk.yellow('⚠️ 发现问题，需要修复以确保测试环境正常工作'));
    }
  }

  /**
   * 生成修复建议
   */
  generateFixSuggestions() {
    const suggestions = [];
    
    // 根据发现的问题自动生成修复建议
    for (const issue of this.issues) {
      if (issue.message.includes('别名')) {
        suggestions.push({
          issue: issue.message,
          fix: `更新Jest配置中的moduleNameMapper，添加正确的别名映射`
        });
      } else if (issue.message.includes('导入的模块不存在')) {
        suggestions.push({
          issue: issue.message,
          fix: `检查导入路径是否正确，可能需要更新相对路径或添加文件扩展名`
        });
      } else if (issue.message.includes('测试覆盖率收集未启用')) {
        suggestions.push({
          issue: issue.message,
          fix: `在Jest配置中添加 "collectCoverage": true`
        });
      }
    }
    
    return suggestions;
  }

  /**
   * 输出JSON报告
   * @param {string} outputPath - 输出路径
   */
  writeJsonReport(outputPath) {
    const report = {
      timestamp: new Date().toISOString(),
      testFiles: this.testFiles.length,
      moduleFiles: this.moduleFiles.length,
      issues: this.issues,
      fixSuggestions: this.generateFixSuggestions()
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(chalk.green(`📝 报告已保存到: ${outputPath}`));
  }
}

// 如果直接运行脚本
if (require.main === module) {
  const validator = new TestEnvironmentValidator();
  validator.validate().then(() => {
    // 输出JSON报告
    validator.writeJsonReport(path.join(config.rootDir, 'test-env-report.json'));
  }).catch(err => {
    console.error(chalk.red(`❌ 验证失败: ${err.message}`));
    process.exit(1);
  });
}

module.exports = TestEnvironmentValidator; 