/**
 * @file test-env-verifier.js
 * @description 测试环境验证工具，用于检查测试配置和环境是否正确
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

/**
 * 测试环境验证类
 */
class TestEnvironmentVerifier {
  constructor(options = {}) {
    this.webAppDir = options.webAppDir || findWebAppDir();
    this.issues = [];
    this.modulePaths = {};
    this.testPaths = {};
    this.configFiles = {};
  }

  /**
   * 运行所有验证检查
   * @returns {Object} 验证结果
   */
  verifyAll() {
    this.verifyDirectoryStructure();
    this.verifyJestConfig();
    this.verifyPackageJson();
    this.verifyModuleImports();
    this.verifyTestFiles();
    
    return {
      success: this.issues.length === 0,
      webAppDir: this.webAppDir,
      issues: this.issues,
      modulePaths: this.modulePaths,
      testPaths: this.testPaths,
      configFiles: this.configFiles
    };
  }

  /**
   * 验证目录结构
   */
  verifyDirectoryStructure() {
    console.log('正在验证目录结构...');
    
    // 检查关键目录是否存在
    const requiredDirs = [
      'components',
      'components/modules',
      'components/modules/auth',
      'components/modules/data',
      'components/modules/store',
      'components/modules/ui',
      'components/modules/utils',
      'tests',
      'tests/unit',
      'tests/integration',
      'tests/e2e',
      'coverage'
    ];
    
    for (const dir of requiredDirs) {
      const dirPath = path.join(this.webAppDir, dir);
      if (!fs.existsSync(dirPath)) {
        this.issues.push({
          type: 'directory',
          level: 'error',
          message: `必需的目录不存在: ${dir}`,
          path: dirPath
        });
      } else {
        console.log(`✓ 目录存在: ${dir}`);
      }
    }
    
    // 检查模块目录结构
    this.checkModuleStructure();
  }

  /**
   * 检查模块目录结构
   */
  checkModuleStructure() {
    const modulesRoot = path.join(this.webAppDir, 'components/modules');
    const moduleNames = ['auth', 'data', 'store', 'ui', 'utils'];
    
    for (const moduleName of moduleNames) {
      const moduleDir = path.join(modulesRoot, moduleName);
      if (fs.existsSync(moduleDir)) {
        // 检查模块是否有索引文件
        const indexFile = path.join(moduleDir, 'index.js');
        if (!fs.existsSync(indexFile)) {
          this.issues.push({
            type: 'file',
            level: 'warning',
            message: `模块 ${moduleName} 缺少索引文件`,
            path: indexFile
          });
        } else {
          console.log(`✓ 模块 ${moduleName} 索引文件存在`);
          this.modulePaths[moduleName] = moduleDir;
        }
        
        // 获取模块中的所有JavaScript文件
        const moduleFiles = fs.readdirSync(moduleDir)
          .filter(file => file.endsWith('.js'));
        
        console.log(`模块 ${moduleName} 包含 ${moduleFiles.length} 个JavaScript文件`);
      }
    }
  }

  /**
   * 验证Jest配置
   */
  verifyJestConfig() {
    console.log('正在验证Jest配置...');
    
    // 检查jest.config.js是否存在
    const jestConfigPath = path.join(this.webAppDir, 'jest.config.js');
    if (fs.existsSync(jestConfigPath)) {
      console.log('✓ Jest配置文件存在');
      
      try {
        // 读取并解析Jest配置
        const jestConfigContent = fs.readFileSync(jestConfigPath, 'utf8');
        this.configFiles.jest = jestConfigContent;
        
        // 检查常见配置问题
        this.checkJestConfigIssues(jestConfigContent);
      } catch (error) {
        this.issues.push({
          type: 'config',
          level: 'error',
          message: `无法读取Jest配置: ${error.message}`,
          path: jestConfigPath
        });
      }
    } else {
      // 检查package.json中是否有Jest配置
      const packageJsonPath = path.join(this.webAppDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          if (packageJson.jest) {
            console.log('✓ Jest配置在package.json中');
            this.checkJestConfigIssues(JSON.stringify(packageJson.jest));
          } else {
            this.issues.push({
              type: 'config',
              level: 'error',
              message: '缺少Jest配置文件，且package.json中也没有Jest配置',
              path: jestConfigPath
            });
          }
        } catch (error) {
          this.issues.push({
            type: 'config',
            level: 'error',
            message: `读取package.json失败: ${error.message}`,
            path: packageJsonPath
          });
        }
      } else {
        this.issues.push({
          type: 'config',
          level: 'error',
          message: '缺少Jest配置文件和package.json',
          path: jestConfigPath
        });
      }
    }
  }

  /**
   * 检查Jest配置中的常见问题
   * @param {string} configContent - Jest配置内容
   */
  checkJestConfigIssues(configContent) {
    // 检查测试文件匹配规则
    if (!configContent.includes('testMatch') && !configContent.includes('testRegex')) {
      this.issues.push({
        type: 'config',
        level: 'warning',
        message: 'Jest配置缺少testMatch或testRegex',
        details: '这可能导致Jest无法找到测试文件'
      });
    }
    
    // 检查模块名映射器
    if (!configContent.includes('moduleNameMapper')) {
      this.issues.push({
        type: 'config',
        level: 'warning',
        message: 'Jest配置缺少moduleNameMapper',
        details: '这可能导致模块导入路径解析错误'
      });
    }
    
    // 检查测试环境
    if (!configContent.includes('testEnvironment')) {
      this.issues.push({
        type: 'config',
        level: 'info',
        message: 'Jest配置未指定testEnvironment',
        details: '默认使用jsdom，但显式指定可能有助于避免问题'
      });
    }
    
    // 检查覆盖率收集
    if (!configContent.includes('collectCoverage')) {
      this.issues.push({
        type: 'config',
        level: 'info',
        message: 'Jest配置未指定collectCoverage',
        details: '需要显式启用覆盖率收集'
      });
    }
  }

  /**
   * 验证package.json
   */
  verifyPackageJson() {
    console.log('正在验证package.json...');
    
    const packageJsonPath = path.join(this.webAppDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        this.configFiles.package = packageJson;
        
        // 检查测试相关脚本
        if (!packageJson.scripts || !packageJson.scripts.test) {
          this.issues.push({
            type: 'config',
            level: 'warning',
            message: 'package.json中缺少test脚本',
            path: packageJsonPath
          });
        } else {
          console.log(`✓ 测试脚本: ${packageJson.scripts.test}`);
        }
        
        // 检查测试相关依赖
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        const testDeps = ['jest'];
        const missingDeps = testDeps.filter(dep => !deps[dep]);
        
        if (missingDeps.length > 0) {
          this.issues.push({
            type: 'dependency',
            level: 'error',
            message: `缺少测试依赖: ${missingDeps.join(', ')}`,
            path: packageJsonPath
          });
        } else {
          console.log('✓ 所有必需的测试依赖都已安装');
        }
      } catch (error) {
        this.issues.push({
          type: 'config',
          level: 'error',
          message: `无法解析package.json: ${error.message}`,
          path: packageJsonPath
        });
      }
    } else {
      this.issues.push({
        type: 'config',
        level: 'error',
        message: 'package.json不存在',
        path: packageJsonPath
      });
    }
  }

  /**
   * 验证模块导入
   */
  verifyModuleImports() {
    console.log('正在验证模块导入...');
    
    // 检查主模块索引文件
    const mainIndexPath = path.join(this.webAppDir, 'components/modules/index.js');
    if (fs.existsSync(mainIndexPath)) {
      console.log('✓ 主模块索引文件存在');
      
      try {
        const content = fs.readFileSync(mainIndexPath, 'utf8');
        const moduleNames = ['auth', 'data', 'store', 'ui', 'utils'];
        
        // 检查是否导入了所有模块
        for (const moduleName of moduleNames) {
          if (!content.includes(`import ${moduleName}`) && !content.includes(`import { ${moduleName}`) && !content.includes(`from './${moduleName}'`)) {
            this.issues.push({
              type: 'import',
              level: 'warning',
              message: `主模块索引文件可能缺少模块导入: ${moduleName}`,
              path: mainIndexPath
            });
          }
        }
        
        // 检查是否导出了所有模块
        for (const moduleName of moduleNames) {
          if (!content.includes(`export { ${moduleName}`) && !content.includes(`export * from './${moduleName}'`)) {
            this.issues.push({
              type: 'export',
              level: 'warning',
              message: `主模块索引文件可能缺少模块导出: ${moduleName}`,
              path: mainIndexPath
            });
          }
        }
      } catch (error) {
        this.issues.push({
          type: 'file',
          level: 'error',
          message: `无法读取主模块索引文件: ${error.message}`,
          path: mainIndexPath
        });
      }
    } else {
      this.issues.push({
        type: 'file',
        level: 'warning',
        message: '主模块索引文件不存在',
        path: mainIndexPath
      });
    }
  }

  /**
   * 验证测试文件
   */
  verifyTestFiles() {
    console.log('正在验证测试文件...');
    
    const testsDirs = {
      'unit': path.join(this.webAppDir, 'tests/unit'),
      'integration': path.join(this.webAppDir, 'tests/integration'),
      'e2e': path.join(this.webAppDir, 'tests/e2e')
    };
    
    let totalTestFiles = 0;
    
    // 递归查找测试文件
    for (const [type, dir] of Object.entries(testsDirs)) {
      if (fs.existsSync(dir)) {
        const testFiles = this.findTestFiles(dir);
        totalTestFiles += testFiles.length;
        this.testPaths[type] = testFiles;
        
        console.log(`✓ ${type} 测试: 找到 ${testFiles.length} 个测试文件`);
        
        // 检查模块测试覆盖
        if (type === 'unit') {
          this.checkModuleTestCoverage(testFiles);
        }
      } else {
        this.issues.push({
          type: 'directory',
          level: 'warning',
          message: `${type} 测试目录不存在`,
          path: dir
        });
      }
    }
    
    if (totalTestFiles === 0) {
      this.issues.push({
        type: 'test',
        level: 'error',
        message: '没有找到任何测试文件',
        details: '请确保测试文件以.test.js或.spec.js结尾'
      });
    } else {
      console.log(`✓ 总共找到 ${totalTestFiles} 个测试文件`);
    }
  }

  /**
   * 递归查找测试文件
   * @param {string} dir - 目录路径
   * @returns {Array<string>} 测试文件列表
   */
  findTestFiles(dir) {
    const testFiles = [];
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        testFiles.push(...this.findTestFiles(filePath));
      } else if (file.endsWith('.test.js') || file.endsWith('.spec.js')) {
        testFiles.push(filePath);
      }
    }
    
    return testFiles;
  }

  /**
   * 检查模块测试覆盖
   * @param {Array<string>} testFiles - 测试文件列表
   */
  checkModuleTestCoverage(testFiles) {
    const moduleNames = ['auth', 'data', 'store', 'ui', 'utils'];
    const moduleTestCounts = {};
    
    // 统计每个模块的测试文件数量
    for (const moduleName of moduleNames) {
      moduleTestCounts[moduleName] = testFiles.filter(file => 
        file.includes(`/unit/${moduleName}/`) || 
        file.includes(`\\unit\\${moduleName}\\`)
      ).length;
      
      if (moduleTestCounts[moduleName] === 0) {
        this.issues.push({
          type: 'test',
          level: 'warning',
          message: `模块 ${moduleName} 没有单元测试`,
          details: `在 tests/unit/${moduleName} 下创建测试文件`
        });
      } else {
        console.log(`✓ 模块 ${moduleName} 有 ${moduleTestCounts[moduleName]} 个测试文件`);
      }
    }
  }

  /**
   * 执行简单的测试运行
   */
  async testRun() {
    console.log('正在执行测试运行检查...');
    
    try {
      // 尝试运行一个简单的测试
      const { execSync } = require('child_process');
      const result = execSync('npx jest --listTests', { 
        cwd: this.webAppDir,
        encoding: 'utf8'
      });
      
      const testCount = result.split('\n').filter(line => line.trim().length > 0).length;
      console.log(`✓ Jest可以找到 ${testCount} 个测试文件`);
      
      if (testCount === 0) {
        this.issues.push({
          type: 'test',
          level: 'error',
          message: 'Jest未能找到任何测试文件',
          details: '检查Jest配置中的testMatch和testRegex设置'
        });
      }
    } catch (error) {
      this.issues.push({
        type: 'test',
        level: 'error',
        message: `Jest测试运行失败: ${error.message}`,
        details: error.stdout || error.stderr || '没有详细输出'
      });
    }
  }
}

/**
 * 查找web-app目录
 * @returns {string} web-app目录的路径
 */
function findWebAppDir() {
  let currentDir = process.cwd();
  
  // 尝试查找当前目录及其父目录
  while (currentDir && currentDir !== path.dirname(currentDir)) {
    if (isWebAppDir(currentDir) || currentDir.endsWith('web-app')) {
      return currentDir;
    }
    
    const webAppDirInCurrent = path.join(currentDir, 'web-app');
    if (fs.existsSync(webAppDirInCurrent) && isWebAppDir(webAppDirInCurrent)) {
      return webAppDirInCurrent;
    }
    
    currentDir = path.dirname(currentDir);
  }
  
  // 如果没有找到，返回当前目录
  console.warn('警告: 无法找到web-app目录，使用当前目录');
  return process.cwd();
}

/**
 * 检查目录是否为web-app目录
 * @param {string} dir - 要检查的目录
 * @returns {boolean} 如果是web-app目录则返回true
 */
function isWebAppDir(dir) {
  // 检查常见的web-app目录标志
  const hasPackageJson = fs.existsSync(path.join(dir, 'package.json'));
  const hasComponentsDir = fs.existsSync(path.join(dir, 'components'));
  const hasTestsDir = fs.existsSync(path.join(dir, 'tests'));
  
  return hasPackageJson && (hasComponentsDir || hasTestsDir);
}

/**
 * 运行验证并输出结果
 */
async function runVerification() {
  console.log('开始验证测试环境...');
  console.log('--------------------------');
  
  const verifier = new TestEnvironmentVerifier();
  const results = verifier.verifyAll();
  
  console.log('--------------------------');
  console.log('验证完成!');
  console.log(`Web-App目录: ${results.webAppDir}`);
  console.log(`发现问题: ${results.issues.length}`);
  
  if (results.issues.length > 0) {
    console.log('\n问题详情:');
    
    const issuesByLevel = {
      error: results.issues.filter(issue => issue.level === 'error'),
      warning: results.issues.filter(issue => issue.level === 'warning'),
      info: results.issues.filter(issue => issue.level === 'info')
    };
    
    if (issuesByLevel.error.length > 0) {
      console.log('\n❌ 错误:');
      issuesByLevel.error.forEach(issue => console.log(`- ${issue.message}`));
    }
    
    if (issuesByLevel.warning.length > 0) {
      console.log('\n⚠️ 警告:');
      issuesByLevel.warning.forEach(issue => console.log(`- ${issue.message}`));
    }
    
    if (issuesByLevel.info.length > 0) {
      console.log('\nℹ️ 信息:');
      issuesByLevel.info.forEach(issue => console.log(`- ${issue.message}`));
    }
    
    console.log('\n解决方案建议:');
    if (issuesByLevel.error.length > 0) {
      console.log('1. 优先解决所有错误级别的问题');
    }
    console.log('2. 检查项目结构和测试配置');
    console.log('3. 确保Jest配置正确识别测试文件');
    console.log('4. 为所有模块创建或修复单元测试');
  } else {
    console.log('\n✅ 测试环境看起来很健康!');
  }
  
  // 尝试执行测试运行检查
  await verifier.testRun();
  
  // 生成验证报告文件
  const reportPath = path.join(verifier.webAppDir, 'test-env-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n详细报告已保存到: ${reportPath}`);
}

// 如果直接运行此脚本，则执行验证
if (require.main === module) {
  runVerification().catch(error => {
    console.error('验证过程中出错:', error);
    process.exit(1);
  });
}

module.exports = {
  TestEnvironmentVerifier,
  findWebAppDir,
  runVerification
}; 