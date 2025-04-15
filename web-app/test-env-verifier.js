/**
 * 测试环境验证工具
 * 用于检查测试环境配置是否正确
 */
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 要检查的配置文件
const configFiles = [
  './web-app/package.json',
  './web-app/jest.config.js',
  './web-app/tests/setup.js'
];

// 检查项目结构
function checkProjectStructure() {
  console.log('检查项目结构...');
  
  // 查找所有测试文件
  const testFiles = glob.sync('./web-app/tests/**/*.test.js');
  console.log(`找到 ${testFiles.length} 个测试文件`);
  
  // 检查测试目录结构
  const testDirs = new Set(testFiles.map(file => path.dirname(file)));
  console.log('测试目录结构:');
  console.log([...testDirs].sort().join('\n'));
  
  // 检查源代码文件
  const sourceFiles = glob.sync('./web-app/components/modules/**/*.js');
  console.log(`找到 ${sourceFiles.length} 个源代码文件`);
}

// 检查配置文件
function checkConfigFiles() {
  console.log('\n检查配置文件...');
  
  configFiles.forEach(filePath => {
    try {
      const fullPath = path.resolve(filePath);
      if (!fs.existsSync(fullPath)) {
        console.error(`错误: 配置文件不存在: ${fullPath}`);
        return;
      }
      
      console.log(`发现配置文件: ${filePath}`);
      
      // 检查package.json中的脚本
      if (filePath.endsWith('package.json')) {
        const pkg = require(fullPath);
        if (pkg.scripts && pkg.scripts.test) {
          console.log(`测试脚本: ${pkg.scripts.test}`);
        }
        if (pkg.jest) {
          console.log('在package.json中找到Jest配置');
        }
      }
      
      // 检查Jest配置
      if (filePath.endsWith('jest.config.js')) {
        const jestConfig = require(fullPath);
        console.log('Jest配置:');
        console.log('- testEnvironment:', jestConfig.testEnvironment);
        console.log('- setupFilesAfterEnv:', jestConfig.setupFilesAfterEnv);
        console.log('- moduleDirectories:', jestConfig.moduleDirectories);
      }
    } catch (error) {
      console.error(`检查配置文件时出错: ${filePath}`, error);
    }
  });
}

// 检查测试依赖
function checkTestDependencies() {
  console.log('\n检查测试依赖...');
  
  try {
    const pkg = require(path.resolve('./web-app/package.json'));
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    
    const requiredDeps = ['jest', '@testing-library/dom', '@testing-library/jest-dom'];
    const missingDeps = requiredDeps.filter(dep => !dependencies[dep]);
    
    if (missingDeps.length > 0) {
      console.error(`缺少必要的测试依赖: ${missingDeps.join(', ')}`);
    } else {
      console.log('所有必要的测试依赖都已安装');
    }
    
    // 检查Jest版本
    if (dependencies.jest) {
      console.log(`Jest版本: ${dependencies.jest}`);
    }
  } catch (error) {
    console.error('检查测试依赖时出错', error);
  }
}

// 检查测试文件中的导入
function checkTestImports() {
  console.log('\n检查测试文件中的导入...');
  
  const testFiles = glob.sync('./web-app/tests/**/*.test.js');
  const importProblems = [];
  
  testFiles.forEach(filePath => {
    try {
      const content = fs.readFileSync(path.resolve(filePath), 'utf8');
      const importLines = content.match(/^import .+ from ['"].+['"];?$/gm) || [];
      
      // 查找可能有问题的导入语句
      const problematicImports = importLines.filter(line => {
        return line.includes('..') && !line.includes('setup') && !line.includes('test-utils');
      });
      
      if (problematicImports.length > 0) {
        importProblems.push({
          file: filePath,
          imports: problematicImports
        });
      }
    } catch (error) {
      console.error(`检查测试文件导入时出错: ${filePath}`, error);
    }
  });
  
  if (importProblems.length > 0) {
    console.log(`发现 ${importProblems.length} 个测试文件中有可能存在问题的导入:`);
    importProblems.forEach(({ file, imports }) => {
      console.log(`\n${file}:`);
      imports.forEach(imp => console.log(`  ${imp}`));
    });
  } else {
    console.log('未发现明显的导入问题');
  }
}

// 生成修复建议
function generateFixSuggestions() {
  console.log('\n生成修复建议...');
  
  // 检查Jest配置建议
  try {
    const jestConfigPath = path.resolve('./web-app/jest.config.js');
    if (fs.existsSync(jestConfigPath)) {
      const jestConfig = require(jestConfigPath);
      
      // 建议moduleDirectories设置
      if (!jestConfig.moduleDirectories || !jestConfig.moduleDirectories.includes('web-app')) {
        console.log('建议: 在jest.config.js中添加"web-app"到moduleDirectories');
        console.log('  moduleDirectories: ["node_modules", "web-app"]');
      }
      
      // 建议modulePaths设置
      if (!jestConfig.modulePaths || !jestConfig.modulePaths.includes('<rootDir>/web-app')) {
        console.log('建议: 在jest.config.js中添加"<rootDir>/web-app"到modulePaths');
        console.log('  modulePaths: ["<rootDir>", "<rootDir>/web-app"]');
      }
      
      // 建议roots设置
      if (!jestConfig.roots || !jestConfig.roots.includes('<rootDir>/web-app')) {
        console.log('建议: 在jest.config.js中添加"<rootDir>/web-app"到roots');
        console.log('  roots: ["<rootDir>", "<rootDir>/web-app"]');
      }
    }
  } catch (error) {
    console.error('生成Jest配置建议时出错', error);
  }
  
  // 建议创建测试辅助工具
  console.log('\n建议: 创建测试路径解析辅助工具 (test-utils.js)');
  console.log(`
/**
 * 测试辅助工具 - 用于处理模块路径和导入
 */
const path = require('path');

// 解析模块路径
function resolveModulePath(modulePath) {
  // 处理模块路径，支持绝对路径和相对路径
  if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
    return modulePath;
  }
  
  // 假设模块路径相对于web-app目录
  return path.join('../..', modulePath);
}

// 导出工具函数
module.exports = {
  resolveModulePath
};
`);
}

// 执行所有检查
function runAllChecks() {
  console.log('===== 测试环境验证工具 =====\n');
  
  checkProjectStructure();
  checkConfigFiles();
  checkTestDependencies();
  checkTestImports();
  generateFixSuggestions();
  
  console.log('\n===== 验证完成 =====');
}

runAllChecks(); 