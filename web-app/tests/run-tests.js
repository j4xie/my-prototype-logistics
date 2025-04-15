/**
 * 食品溯源系统 - 测试运行脚本
 * 版本: 1.0.0
 * 
 * 此脚本用于运行项目中的所有测试，生成覆盖率报告，
 * 并可根据命令行参数运行特定类型的测试。
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 配置
const config = {
  rootDir: path.resolve(__dirname, '..'),
  coverageDir: path.resolve(__dirname, '../coverage'),
  reportFile: path.resolve(__dirname, '../cover-rate.md'),
  testCmd: 'npm test',
  unitTestDirs: ['auth', 'data', 'server', 'store', 'trace', 'ui', 'utils'],
  useParallel: true,
  maxParallelTests: 3,
  excludePatterns: ['node_modules']
};

// 命令行参数
const args = process.argv.slice(2);
const options = {
  unit: args.includes('--unit') || !args.includes('--integration') && !args.includes('--e2e'),
  integration: args.includes('--integration') || !args.includes('--unit') && !args.includes('--e2e'),
  e2e: args.includes('--e2e'),
  coverage: !args.includes('--no-coverage'),
  parallel: !args.includes('--no-parallel'),
  pattern: getArgValue(args, '--pattern'),
  updateReport: !args.includes('--no-report-update'),
  fix: args.includes('--fix'),
  verbose: args.includes('--verbose')
};

// 主函数
async function main() {
  console.log('🚀 启动测试运行...');
  const startTime = Date.now();

  try {
    validateEnvironment();
    
    if (options.fix) {
      await fixCommonTestIssues();
    }
    
    let testResults;
    
    if (options.pattern) {
      // 运行特定测试
      testResults = runSpecificTests(options.pattern);
    } else {
      // 根据类型运行测试
      testResults = runTestsByType();
    }
    
    if (options.coverage) {
      const coverageData = collectCoverageData();
      
      if (options.updateReport) {
        updateCoverageReport(coverageData);
      }
      
      displayCoverageSummary(coverageData);
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ 测试运行结束，总耗时: ${duration}秒`);
    
    // 返回适当的退出码
    process.exit(testResults.success ? 0 : 1);
    
  } catch (error) {
    console.error(`\n❌ 测试运行失败: ${error.message}`);
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

// 验证测试环境
function validateEnvironment() {
  console.log('👀 验证测试环境...');
  
  // 检查Jest是否安装
  try {
    const jestVersion = execSync('npx jest --version', { cwd: config.rootDir, stdio: 'pipe' }).toString().trim();
    console.log(`✓ Jest版本: ${jestVersion}`);
  } catch (error) {
    throw new Error('Jest未安装，请运行: npm install --save-dev jest');
  }
  
  // 检查jest.config.js是否存在
  const jestConfigPath = path.join(config.rootDir, 'jest.config.js');
  if (!fs.existsSync(jestConfigPath)) {
    throw new Error('jest.config.js不存在，请确保配置正确');
  }
  
  // 确保测试目录存在
  ensureDirectoryExists(path.join(__dirname, 'unit'));
  ensureDirectoryExists(path.join(__dirname, 'integration'));
  ensureDirectoryExists(path.join(__dirname, 'e2e'));
  
  console.log('✓ 测试环境验证完成');
}

// 修复常见测试问题
async function fixCommonTestIssues() {
  console.log('🔧 尝试修复常见测试问题...');
  
  // 1. 修复导入路径问题
  fixImportPaths();
  
  // 2. 修复模拟对象问题
  fixMockObjects();
  
  // 3. 创建缺失的目录
  ensureDirectoriesExist();
  
  console.log('✓ 修复完成');
}

// 修复导入路径问题
function fixImportPaths() {
  console.log('  ↳ 修复导入路径...');
  
  const testFiles = findTestFiles();
  let fixCount = 0;
  
  testFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    let newContent = content;
    
    // 修复常见的路径问题
    if (file.includes('/unit/')) {
      // 将三级导入改为两级导入 (../../../components/ -> ../../components/)
      newContent = content.replace(
        /from\s+['"]\.\.\/\.\.\/\.\.\/components\//g, 
        'from \'../../components/'
      );
      
      // 修复Jest模拟引用
      newContent = newContent.replace(
        /jest\.mock\(['"]\.\.\/\.\.\/\.\.\/components\//g, 
        'jest.mock(\'../../components/'
      );
    }
    
    if (content !== newContent) {
      fs.writeFileSync(file, newContent, 'utf8');
      fixCount++;
    }
  });
  
  if (fixCount > 0) {
    console.log(`  ✓ 已修复${fixCount}个文件的导入路径问题`);
  } else {
    console.log('  ✓ 未发现导入路径问题');
  }
}

// 修复模拟对象问题
function fixMockObjects() {
  console.log('  ↳ 修复模拟对象问题...');
  
  // 修复EventEmitter问题
  const serverTestFile = path.join(__dirname, 'unit/server/local-server.test.js');
  if (fs.existsSync(serverTestFile)) {
    let content = fs.readFileSync(serverTestFile, 'utf8');
    if (content.includes('EventEmitter') && !content.includes('const EventEmitter = require(\'events\')')) {
      content = 'const EventEmitter = require(\'events\');\n' + content;
      fs.writeFileSync(serverTestFile, content, 'utf8');
      console.log('  ✓ 已修复EventEmitter导入问题');
    }
  }
  
  // 修复localStorage模拟
  const testFiles = findTestFiles();
  let fixCount = 0;
  
  testFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('localStorage') && !content.includes('Object.defineProperty(global, \'localStorage\'')) {
      let newContent = content.replace(
        /beforeEach\(\(\) => {/,
        `beforeEach(() => {
  // 模拟localStorage
  if (typeof global.localStorage === 'undefined') {
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
      },
      writable: true
    });
  }`
      );
      
      if (content === newContent) {
        // 尝试添加到文件开头
        newContent = `// 模拟localStorage
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  },
  writable: true
});

${content}`;
      }
      
      fs.writeFileSync(file, newContent, 'utf8');
      fixCount++;
    }
  });
  
  if (fixCount > 0) {
    console.log(`  ✓ 已修复${fixCount}个文件的localStorage模拟问题`);
  } else {
    console.log('  ✓ 未发现localStorage模拟问题');
  }
}

// 确保目录存在
function ensureDirectoriesExist() {
  console.log('  ↳ 确保测试目录结构完整...');
  
  const dirs = [
    'unit/auth',
    'unit/data',
    'unit/server',
    'unit/store',
    'unit/trace',
    'unit/ui',
    'unit/utils',
    'integration',
    'e2e'
  ];
  
  dirs.forEach(dir => {
    ensureDirectoryExists(path.join(__dirname, dir));
  });
  
  console.log('  ✓ 目录结构验证完成');
}

// 确保目录存在
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`  ✓ 创建目录: ${dir}`);
  }
}

// 运行特定测试
function runSpecificTests(pattern) {
  console.log(`🔍 运行匹配 "${pattern}" 的测试...`);
  
  const cmd = `${config.testCmd} -- --testPathPattern=${pattern}${options.coverage ? ' --coverage' : ''}`;
  
  try {
    execSync(cmd, { 
      cwd: config.rootDir, 
      stdio: options.verbose ? 'inherit' : 'pipe'
    });
    console.log(`✓ 匹配 "${pattern}" 的测试运行成功`);
    return { success: true };
  } catch (error) {
    console.error(`\n❌ 匹配 "${pattern}" 的测试运行失败`);
    
    if (!options.verbose && error.stdout) {
      console.error(error.stdout.toString());
    }
    
    return { success: false };
  }
}

// 根据类型运行测试
function runTestsByType() {
  const testTypes = [];
  if (options.unit) testTypes.push('unit');
  if (options.integration) testTypes.push('integration');
  if (options.e2e) testTypes.push('e2e');
  
  console.log(`🧪 运行以下类型的测试: ${testTypes.join(', ')}...`);
  
  if (options.parallel && options.unit && testTypes.length === 1) {
    return runUnitTestsInParallel();
  } else {
    return runTestsSequentially(testTypes);
  }
}

// 按顺序运行测试
function runTestsSequentially(testTypes) {
  let success = true;
  
  for (const type of testTypes) {
    console.log(`\n▶️ 运行${type}测试...`);
    
    const cmd = `${config.testCmd} -- --testPathPattern=${type}${options.coverage ? ' --coverage' : ''}`;
    
    try {
      execSync(cmd, { 
        cwd: config.rootDir, 
        stdio: options.verbose ? 'inherit' : 'pipe'
      });
      console.log(`✓ ${type}测试运行成功`);
    } catch (error) {
      success = false;
      console.error(`\n❌ ${type}测试运行失败`);
      
      if (!options.verbose && error.stdout) {
        console.error(error.stdout.toString());
      }
    }
  }
  
  return { success };
}

// 并行运行单元测试
function runUnitTestsInParallel() {
  console.log(`\n▶️ 并行运行单元测试...`);
  
  let success = true;
  const unitDirs = config.unitTestDirs;
  
  // 分批运行，每批最多maxParallelTests个目录
  for (let i = 0; i < unitDirs.length; i += config.maxParallelTests) {
    const batch = unitDirs.slice(i, i + config.maxParallelTests);
    console.log(`  ↳ 批次 ${Math.floor(i / config.maxParallelTests) + 1}: ${batch.join(', ')}`);
    
    const results = batch.map(dir => {
      try {
        const pattern = `unit/${dir}`;
        const cmd = `${config.testCmd} -- --testPathPattern=${pattern}${options.coverage ? ' --coverage' : ''}`;
        
        execSync(cmd, { 
          cwd: config.rootDir, 
          stdio: options.verbose ? 'inherit' : 'pipe'
        });
        
        return { dir, success: true };
      } catch (error) {
        return { 
          dir, 
          success: false, 
          error: options.verbose ? error : (error.stdout ? error.stdout.toString() : error.message)
        };
      }
    });
    
    // 处理结果
    results.forEach(result => {
      if (result.success) {
        console.log(`  ✓ ${result.dir}测试运行成功`);
      } else {
        success = false;
        console.error(`  ❌ ${result.dir}测试运行失败`);
        if (!options.verbose) {
          console.error(result.error);
        }
      }
    });
  }
  
  return { success };
}

// 收集覆盖率数据
function collectCoverageData() {
  console.log('\n📊 收集覆盖率数据...');
  
  const coverageSummaryPath = path.join(config.coverageDir, 'coverage-summary.json');
  
  if (!fs.existsSync(coverageSummaryPath)) {
    console.warn('⚠️ 覆盖率报告不存在，可能需要运行测试以生成报告');
    return null;
  }
  
  try {
    const summary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
    const total = summary.total;
    
    // 计算模块覆盖率
    const modules = {};
    Object.keys(summary).forEach(key => {
      if (key !== 'total') {
        const pathParts = key.split('/');
        let moduleName = 'unknown';
        
        for (let i = 0; i < pathParts.length; i++) {
          if (pathParts[i] === 'components' && i + 1 < pathParts.length) {
            moduleName = pathParts[i + 1];
            break;
          } else if (pathParts[i] === 'server' || pathParts[i] === 'utils') {
            moduleName = pathParts[i];
            break;
          }
        }
        
        if (!modules[moduleName]) {
          modules[moduleName] = {
            statements: { total: 0, covered: 0 },
            branches: { total: 0, covered: 0 },
            functions: { total: 0, covered: 0 },
            lines: { total: 0, covered: 0 }
          };
        }
        
        ['statements', 'branches', 'functions', 'lines'].forEach(metric => {
          modules[moduleName][metric].total += summary[key][metric].total;
          modules[moduleName][metric].covered += summary[key][metric].covered;
        });
      }
    });
    
    // 计算每个模块的百分比
    const modulePercentages = {};
    Object.keys(modules).forEach(moduleName => {
      modulePercentages[moduleName] = {
        statements: calculatePercentage(modules[moduleName].statements),
        branches: calculatePercentage(modules[moduleName].branches),
        functions: calculatePercentage(modules[moduleName].functions),
        lines: calculatePercentage(modules[moduleName].lines)
      };
    });
    
    return {
      total: {
        statements: total.statements.pct,
        branches: total.branches.pct,
        functions: total.functions.pct,
        lines: total.lines.pct
      },
      modules: modulePercentages,
      date: new Date()
    };
  } catch (error) {
    console.error('❌ 解析覆盖率数据失败:', error.message);
    return null;
  }
}

// 计算百分比
function calculatePercentage(metric) {
  if (metric.total === 0) return 0;
  return Math.round((metric.covered / metric.total) * 10000) / 100;
}

// 更新覆盖率报告
function updateCoverageReport(coverageData) {
  if (!coverageData) return;
  
  console.log('\n📝 更新覆盖率报告...');
  
  try {
    if (fs.existsSync(config.reportFile)) {
      const report = fs.readFileSync(config.reportFile, 'utf8');
      
      // 已经有测试状态更新部分
      if (report.includes('## 测试状态更新')) {
        // 从报告中获取上一次的覆盖率
        const prevCoverage = extractPreviousCoverage(report);
        
        // 计算变化
        const changes = calculateCoverageChanges(prevCoverage, coverageData.total);
        
        // 创建新的覆盖率报告部分
        const today = formatDate(coverageData.date);
        const newSection = generateCoverageReportSection(coverageData, changes, today);
        
        // 插入新部分到报告中
        const updatedReport = insertNewSection(report, newSection);
        
        // 保存更新后的报告
        fs.writeFileSync(config.reportFile, updatedReport, 'utf8');
        console.log('✓ 覆盖率报告已更新');
      } else {
        console.warn('⚠️ 报告文件结构不符合预期，跳过更新');
      }
    } else {
      console.warn('⚠️ 报告文件不存在，请确保路径正确');
    }
  } catch (error) {
    console.error('❌ 更新覆盖率报告失败:', error.message);
  }
}

// 从报告中提取上一次的覆盖率
function extractPreviousCoverage(report) {
  const regex = /语句覆盖率：(\d+\.\d+)%.*分支覆盖率：(\d+\.\d+)%.*函数覆盖率：(\d+\.\d+)%.*行覆盖率：(\d+\.\d+)%/s;
  const match = report.match(regex);
  
  if (match) {
    return {
      statements: parseFloat(match[1]),
      branches: parseFloat(match[2]),
      functions: parseFloat(match[3]),
      lines: parseFloat(match[4])
    };
  }
  
  return {
    statements: 0,
    branches: 0,
    functions: 0,
    lines: 0
  };
}

// 计算覆盖率变化
function calculateCoverageChanges(prev, current) {
  return {
    statements: roundToTwoDecimals(current.statements - prev.statements),
    branches: roundToTwoDecimals(current.branches - prev.branches),
    functions: roundToTwoDecimals(current.functions - prev.functions),
    lines: roundToTwoDecimals(current.lines - prev.lines)
  };
}

// 生成覆盖率报告部分
function generateCoverageReportSection(coverageData, changes, date) {
  const modulesTable = Object.keys(coverageData.modules)
    .sort()
    .map(module => {
      const data = coverageData.modules[module];
      return `| modules/${module} | ${data.statements}% | ${data.branches}% | ${data.functions}% | ${data.lines}% |`;
    })
    .join('\n');
  
  const changeText = changes 
    ? `(上升 ${changes.statements > 0 ? changes.statements : 0}%)`
    : '';

  return `## 测试状态更新 (${date})

**当前覆盖率状态：**

- 语句覆盖率：${coverageData.total.statements}% ${changeText}
- 分支覆盖率：${coverageData.total.branches}% ${changes ? `(上升 ${changes.branches > 0 ? changes.branches : 0}%)` : ''}
- 函数覆盖率：${coverageData.total.functions}% ${changes ? `(上升 ${changes.functions > 0 ? changes.functions : 0}%)` : ''}
- 行覆盖率：${coverageData.total.lines}% ${changes ? `(上升 ${changes.lines > 0 ? changes.lines : 0}%)` : ''}

**模块覆盖率明细：**

| 模块 | 语句覆盖率 | 分支覆盖率 | 函数覆盖率 | 行覆盖率 |
|------|------------|------------|------------|----------|
${modulesTable}
`;
}

// 插入新部分到报告中
function insertNewSection(report, newSection) {
  // 找到测试状态更新部分
  const index = report.indexOf('## 测试状态更新');
  
  if (index !== -1) {
    // 在测试状态更新部分前面插入新内容
    return report.slice(0, index) + newSection + '\n' + report.slice(index);
  }
  
  return report + '\n\n' + newSection;
}

// 显示覆盖率摘要
function displayCoverageSummary(coverageData) {
  if (!coverageData) return;
  
  console.log('\n📈 覆盖率摘要：');
  console.log('-------------------------');
  console.log(`语句覆盖率: ${coverageData.total.statements}%`);
  console.log(`分支覆盖率: ${coverageData.total.branches}%`);
  console.log(`函数覆盖率: ${coverageData.total.functions}%`);
  console.log(`行覆盖率:   ${coverageData.total.lines}%`);
  console.log('-------------------------');
  
  // 显示模块覆盖率
  console.log('\n模块覆盖率:');
  Object.keys(coverageData.modules).sort().forEach(module => {
    const data = coverageData.modules[module];
    console.log(`${module.padEnd(20)} 语句: ${data.statements}%, 分支: ${data.branches}%, 函数: ${data.functions}%, 行: ${data.lines}%`);
  });
}

// 工具函数：查找测试文件
function findTestFiles() {
  const testFiles = [];
  
  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !config.excludePatterns.some(p => fullPath.includes(p))) {
        walkDir(fullPath);
      } else if (stat.isFile() && /\.test\.js$/.test(file)) {
        testFiles.push(fullPath);
      }
    });
  }
  
  walkDir(path.join(__dirname));
  return testFiles;
}

// 工具函数：格式化日期
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 工具函数：舍入到两位小数
function roundToTwoDecimals(num) {
  return Math.round(num * 100) / 100;
}

// 工具函数：获取命令行参数值
function getArgValue(args, key) {
  const index = args.indexOf(key);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return null;
}

// 运行主函数
main().catch(error => {
  console.error(`致命错误: ${error.message}`);
  process.exit(1);
}); 