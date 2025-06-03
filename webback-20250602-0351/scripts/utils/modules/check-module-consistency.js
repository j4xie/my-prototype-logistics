/**
 * @file check-module-consistency.js
 * @description 检查指定目录下的所有JavaScript文件是否使用相同的模块系统格式
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

// 要检查的目录
const DEFAULT_DIRS = [
  path.join(__dirname, '..', 'src', 'network'),
  path.join(__dirname, '..', 'src', 'utils'),
  path.join(__dirname, '..', 'src', 'storage')
];

// 检查文件是否使用ES模块语法
function checkFileModuleFormat(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 检查是否包含ES模块语法
    const hasImport = /\bimport\s+.*\bfrom\s+['"][^'"]+['"]/m.test(content);
    const hasExport = /\bexport\s+(default\s+|const\s+|let\s+|var\s+|function\s+|class\s+|{)/m.test(content);
    
    // 检查是否包含CommonJS语法
    const hasRequire = /\brequire\s*\(['"][^'"]+['"]\)/m.test(content);
    const hasModuleExports = /\bmodule\.exports\b/.test(content);
    
    // 确定模块系统
    let moduleSystem = 'unknown';
    if (hasImport || hasExport) {
      moduleSystem = 'esm';
    } else if (hasRequire || hasModuleExports) {
      moduleSystem = 'commonjs';
    }
    
    return {
      file: filePath,
      moduleSystem,
      hasEsm: hasImport || hasExport,
      hasCommonJs: hasRequire || hasModuleExports,
      isConsistent: !(hasImport || hasExport) || !(hasRequire || hasModuleExports)
    };
  } catch (err) {
    console.error(`检查文件时出错: ${filePath}`, err);
    return {
      file: filePath,
      moduleSystem: 'error',
      error: err.message
    };
  }
}

// 处理目录下的所有JavaScript文件
function checkDirectory(dir) {
  const results = [];
  
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        results.push(...checkDirectory(filePath));
      } else if (file.endsWith('.js')) {
        results.push(checkFileModuleFormat(filePath));
      }
    }
  } catch (err) {
    console.error(`读取目录时出错: ${dir}`, err);
  }
  
  return results;
}

// 生成检查报告
function generateReport(results) {
  // 按模块系统分组
  const groupedBySystem = {};
  results.forEach(result => {
    if (!groupedBySystem[result.moduleSystem]) {
      groupedBySystem[result.moduleSystem] = [];
    }
    groupedBySystem[result.moduleSystem].push(result);
  });
  
  // 计算统计信息
  const stats = {
    total: results.length,
    commonjs: groupedBySystem.commonjs ? groupedBySystem.commonjs.length : 0,
    esm: groupedBySystem.esm ? groupedBySystem.esm.length : 0,
    unknown: groupedBySystem.unknown ? groupedBySystem.unknown.length : 0,
    mixed: results.filter(r => !r.isConsistent).length,
    errors: groupedBySystem.error ? groupedBySystem.error.length : 0
  };
  
  // 检查是否一致
  const isConsistent = stats.mixed === 0 && (stats.commonjs === 0 || stats.esm === 0);
  
  // 生成报告
  console.log('===== 模块系统一致性检查报告 =====');
  console.log(`总文件数: ${stats.total}`);
  console.log(`CommonJS: ${stats.commonjs}`);
  console.log(`ES模块: ${stats.esm}`);
  console.log(`未知格式: ${stats.unknown}`);
  console.log(`混合格式: ${stats.mixed}`);
  console.log(`错误文件: ${stats.errors}`);
  console.log(`一致性: ${isConsistent ? '是' : '否'}`);
  
  if (stats.mixed > 0) {
    console.log('\n=== 混合格式文件 ===');
    results.filter(r => !r.isConsistent).forEach(result => {
      console.log(`- ${path.relative(process.cwd(), result.file)}`);
    });
  }
  
  if (stats.esm > 0) {
    console.log('\n=== ES模块格式文件 ===');
    (groupedBySystem.esm || []).forEach(result => {
      console.log(`- ${path.relative(process.cwd(), result.file)}`);
    });
  }
  
  if (stats.errors > 0) {
    console.log('\n=== 错误文件 ===');
    (groupedBySystem.error || []).forEach(result => {
      console.log(`- ${path.relative(process.cwd(), result.file)}: ${result.error}`);
    });
  }
  
  return { stats, isConsistent, results };
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const dirsToCheck = args.length > 0 
    ? args.map(dir => path.resolve(dir))
    : DEFAULT_DIRS;
  
  console.log(`检查目录: ${dirsToCheck.join(', ')}`);
  
  const allResults = [];
  dirsToCheck.forEach(dir => {
    if (fs.existsSync(dir)) {
      allResults.push(...checkDirectory(dir));
    } else {
      console.error(`目录不存在: ${dir}`);
    }
  });
  
  const report = generateReport(allResults);
  
  // 如果不一致，以非零状态码退出
  if (!report.isConsistent) {
    console.log('\n警告: 项目中存在不一致的模块系统格式!');
    console.log('请将所有文件转换为CommonJS格式。');
    process.exit(1);
  } else {
    console.log('\n成功: 所有文件使用一致的模块系统格式。');
  }
}

// 执行主函数
main(); 