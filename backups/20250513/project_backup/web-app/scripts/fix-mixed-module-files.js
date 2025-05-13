/**
 * @file fix-mixed-module-files.js
 * @description 自动修复项目中混合ES模块和CommonJS语法的JavaScript文件
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { analyzeFileFormat, findMixedModuleFiles } = require('./find-mixed-module-files');

/**
 * 将CommonJS格式转换为ES模块格式
 * @param {string} content - 文件内容
 * @returns {string} 转换后的内容
 */
function convertToESM(content) {
  let modifiedContent = content;
  
  // 替换 require 语句为 import 语句
  const requireRegex = /(?:const|let|var)\s+([^=]+)\s*=\s*require\s*\(['"]([^'"]+)['"]\)/g;
  const requireMatches = [...content.matchAll(requireRegex)];
  
  for (const match of requireMatches) {
    const [fullMatch, importName, modulePath] = match;
    
    // 检查是否是解构赋值
    if (importName.includes('{') && importName.includes('}')) {
      const destructuredVars = importName.replace(/\s*{\s*|\s*}\s*/g, '').trim();
      const importStatement = `import { ${destructuredVars} } from '${modulePath}';`;
      modifiedContent = modifiedContent.replace(fullMatch, importStatement);
    } 
    // 检查是否需要默认导入
    else {
      const cleanedName = importName.trim();
      const importStatement = `import ${cleanedName} from '${modulePath}';`;
      modifiedContent = modifiedContent.replace(fullMatch, importStatement);
    }
  }
  
  // 替换 module.exports = ... 为 export default ...
  modifiedContent = modifiedContent.replace(
    /module\.exports\s*=\s*([^;]+);?/g, 
    "export default $1;"
  );
  
  // 替换 exports.X = Y 为 export const X = Y
  const exportsRegex = /exports\.([^=\s]+)\s*=\s*([^;]+);?/g;
  const exportsMatches = [...modifiedContent.matchAll(exportsRegex)];
  
  for (const match of exportsMatches) {
    const [fullMatch, exportName, exportValue] = match;
    
    // 检查是否是函数声明
    if (exportValue.trim().startsWith('function')) {
      const exportStatement = `export function ${exportName}${exportValue.substring(exportValue.indexOf('('))};`;
      modifiedContent = modifiedContent.replace(fullMatch, exportStatement);
    } 
    // 一般导出
    else {
      const exportStatement = `export const ${exportName} = ${exportValue};`;
      modifiedContent = modifiedContent.replace(fullMatch, exportStatement);
    }
  }
  
  return modifiedContent;
}

/**
 * 将ES模块格式转换为CommonJS格式
 * @param {string} content - 文件内容
 * @returns {string} 转换后的内容
 */
function convertToCJS(content) {
  let modifiedContent = content;
  
  // 替换 import ... from ... 语句为 require 语句
  const importDefaultRegex = /import\s+([^*{}\n,]+)\s+from\s+['"]([^'"]+)['"]/g;
  const importDefaultMatches = [...content.matchAll(importDefaultRegex)];
  
  for (const match of importDefaultMatches) {
    const [fullMatch, importName, modulePath] = match;
    const cleanedName = importName.trim();
    const requireStatement = `const ${cleanedName} = require('${modulePath}');`;
    modifiedContent = modifiedContent.replace(fullMatch, requireStatement);
  }
  
  // 替换具名导入
  const importNamedRegex = /import\s+{\s*([^{}]+)\s*}\s+from\s+['"]([^'"]+)['"]/g;
  const importNamedMatches = [...modifiedContent.matchAll(importNamedRegex)];
  
  for (const match of importNamedMatches) {
    const [fullMatch, namedImports, modulePath] = match;
    const cleanedImports = namedImports.split(',').map(i => i.trim()).join(', ');
    const requireStatement = `const { ${cleanedImports} } = require('${modulePath}');`;
    modifiedContent = modifiedContent.replace(fullMatch, requireStatement);
  }
  
  // 替换命名空间导入
  const importNamespaceRegex = /import\s+\*\s+as\s+([^\s,]+)\s+from\s+['"]([^'"]+)['"]/g;
  const importNamespaceMatches = [...modifiedContent.matchAll(importNamespaceRegex)];
  
  for (const match of importNamespaceMatches) {
    const [fullMatch, namespaceName, modulePath] = match;
    const requireStatement = `const ${namespaceName} = require('${modulePath}');`;
    modifiedContent = modifiedContent.replace(fullMatch, requireStatement);
  }
  
  // 处理副作用导入
  modifiedContent = modifiedContent.replace(
    /import\s+['"]([^'"]+)['"]/g,
    "require('$1');"
  );
  
  // 处理导出默认
  modifiedContent = modifiedContent.replace(
    /export\s+default\s+([^;]+);?/g,
    "module.exports = $1;"
  );
  
  // 处理命名导出
  // 处理命名导出声明 (export const x = y)
  const exportNamedDeclRegex = /export\s+(const|let|var|function|class)\s+([^=\s{(]+)([^;]*);?/g;
  const exportNamedDeclMatches = [...modifiedContent.matchAll(exportNamedDeclRegex)];
  
  for (const match of exportNamedDeclMatches) {
    const [fullMatch, declType, exportName, rest] = match;
    let replacement = `${declType} ${exportName}${rest};\nexports.${exportName} = ${exportName};`;
    modifiedContent = modifiedContent.replace(fullMatch, replacement);
  }
  
  // 处理对象解构导出 (export { x, y })
  const exportObjRegex = /export\s+{\s*([^{}]+)\s*};?/g;
  const exportObjMatches = [...modifiedContent.matchAll(exportObjRegex)];
  
  for (const match of exportObjMatches) {
    const [fullMatch, namedExports] = match;
    const exportStatements = namedExports.split(',')
      .map(exp => {
        const trimmed = exp.trim();
        // 处理 "x as y" 形式的重命名导出
        if (trimmed.includes(' as ')) {
          const [original, renamed] = trimmed.split(' as ').map(p => p.trim());
          return `exports.${renamed} = ${original};`;
        }
        return `exports.${trimmed} = ${trimmed};`;
      })
      .join('\n');
    
    modifiedContent = modifiedContent.replace(fullMatch, exportStatements);
  }
  
  return modifiedContent;
}

/**
 * 修复混合模块格式的文件
 * @param {string} filePath - 文件路径
 * @param {string} targetFormat - 目标格式 ('esm' 或 'cjs')
 * @param {boolean} [createBackup=true] - 是否创建备份
 * @returns {Object} 修复结果
 */
function fixMixedModuleFile(filePath, targetFormat, createBackup = true) {
  if (!['esm', 'cjs'].includes(targetFormat)) {
    throw new Error('目标格式必须是 "esm" 或 "cjs"');
  }
  
  try {
    // 分析文件
    const fileInfo = analyzeFileFormat(filePath);
    
    if (!fileInfo || !fileInfo.isMixed) {
      return {
        success: false,
        message: '文件不是混合模块格式，无需修复',
        file: filePath
      };
    }
    
    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 创建备份
    if (createBackup) {
      const backupPath = `${filePath}.backup`;
      fs.writeFileSync(backupPath, content, 'utf8');
    }
    
    // 转换文件内容
    let modifiedContent;
    if (targetFormat === 'esm') {
      modifiedContent = convertToESM(content);
    } else {
      modifiedContent = convertToCJS(content);
    }
    
    // 写入修改后的内容
    fs.writeFileSync(filePath, modifiedContent, 'utf8');
    
    // 再次分析修复后的文件
    const fixedFileInfo = analyzeFileFormat(filePath);
    const fixSuccessful = !fixedFileInfo.isMixed;
    
    return {
      success: fixSuccessful,
      message: fixSuccessful 
        ? `成功将文件转换为 ${targetFormat === 'esm' ? 'ES模块' : 'CommonJS'} 格式` 
        : '文件仍包含混合模块格式，可能需要手动修复',
      file: filePath,
      format: targetFormat,
      fileInfo: fixedFileInfo
    };
  } catch (err) {
    return {
      success: false,
      message: `修复文件时出错: ${err.message}`,
      file: filePath,
      error: err
    };
  }
}

/**
 * 修复目录中的所有混合模块格式文件
 * @param {string} dirPath - 目录路径
 * @param {Object} options - 选项
 * @returns {Array<Object>} 修复结果
 */
function fixMixedModuleFiles(dirPath, options = {}) {
  const {
    targetFormat = 'esm',
    createBackup = true,
    recursive = true,
    ignoreDirs = [],
    dryRun = false,
    autoChooseFormat = true,
    filePattern = /\.js$/,
    verbose = false,
    logFunction = console.log
  } = options;
  
  if (!['esm', 'cjs'].includes(targetFormat)) {
    throw new Error('目标格式必须是 "esm" 或 "cjs"');
  }
  
  // 查找混合模块格式的文件
  const mixedFiles = findMixedModuleFiles(dirPath, {
    recursive,
    ignoreDirs,
    filePattern,
    includeNonMixed: false
  });
  
  if (mixedFiles.length === 0) {
    return {
      success: true,
      message: '未找到需要修复的混合模块格式文件',
      fixedFiles: [],
      failedFiles: []
    };
  }
  
  if (verbose) {
    logFunction(`找到 ${mixedFiles.length} 个混合模块格式的文件`);
  }
  
  const fixResults = [];
  
  for (const fileInfo of mixedFiles) {
    // 如果是试运行模式，不修改文件
    if (dryRun) {
      fixResults.push({
        success: true,
        dryRun: true,
        message: `试运行: 将文件转换为 ${targetFormat} 格式`,
        file: fileInfo.file,
        format: targetFormat
      });
      continue;
    }
    
    // 确定要转换的目标格式
    let fileTargetFormat = targetFormat;
    
    // 如果启用自动选择格式，根据文件内容决定目标格式
    if (autoChooseFormat) {
      if (fileInfo.detectedFormat === 'mixed-esm-dominant') {
        fileTargetFormat = 'esm';
      } else if (fileInfo.detectedFormat === 'mixed-cjs-dominant') {
        fileTargetFormat = 'cjs';
      }
      
      if (verbose && fileTargetFormat !== targetFormat) {
        logFunction(`为文件 ${fileInfo.file} 自动选择目标格式: ${fileTargetFormat}`);
      }
    }
    
    // 修复文件
    const fixResult = fixMixedModuleFile(fileInfo.file, fileTargetFormat, createBackup);
    fixResults.push(fixResult);
    
    if (verbose) {
      logFunction(`${fixResult.success ? '成功' : '失败'}: ${fixResult.file} - ${fixResult.message}`);
    }
  }
  
  // 统计修复结果
  const fixedFiles = fixResults.filter(r => r.success && !r.dryRun);
  const failedFiles = fixResults.filter(r => !r.success && !r.dryRun);
  const dryRunFiles = fixResults.filter(r => r.dryRun);
  
  return {
    success: failedFiles.length === 0,
    message: dryRun 
      ? `试运行完成，有 ${mixedFiles.length} 个文件需要修复` 
      : `修复完成，成功: ${fixedFiles.length}，失败: ${failedFiles.length}`,
    fixedFiles,
    failedFiles,
    dryRunFiles
  };
}

/**
 * 撤销对文件的修复（从备份恢复）
 * @param {string} filePath - 被修复的文件路径
 * @returns {Object} 撤销结果
 */
function undoFix(filePath) {
  const backupPath = `${filePath}.backup`;
  
  try {
    if (!fs.existsSync(backupPath)) {
      return {
        success: false,
        message: '找不到备份文件',
        file: filePath
      };
    }
    
    // 从备份恢复
    const backupContent = fs.readFileSync(backupPath, 'utf8');
    fs.writeFileSync(filePath, backupContent, 'utf8');
    
    return {
      success: true,
      message: '成功从备份恢复',
      file: filePath
    };
  } catch (err) {
    return {
      success: false,
      message: `恢复备份时出错: ${err.message}`,
      file: filePath,
      error: err
    };
  }
}

/**
 * 生成修复报告
 * @param {Object} fixResult - 修复结果
 * @returns {string} 格式化的报告
 */
function generateFixReport(fixResult) {
  const { fixedFiles, failedFiles, dryRunFiles, message } = fixResult;
  
  let report = `# 模块格式修复报告\n\n`;
  report += `${message}\n\n`;
  
  if (dryRunFiles && dryRunFiles.length > 0) {
    report += `## 试运行模式下的文件 (${dryRunFiles.length})\n\n`;
    
    for (const result of dryRunFiles) {
      report += `- ${result.file} (将转换为 ${result.format === 'esm' ? 'ES模块' : 'CommonJS'})\n`;
    }
    
    report += '\n';
    return report;
  }
  
  if (fixedFiles && fixedFiles.length > 0) {
    report += `## 修复成功的文件 (${fixedFiles.length})\n\n`;
    
    for (const result of fixedFiles) {
      report += `- ${result.file} (转换为 ${result.format === 'esm' ? 'ES模块' : 'CommonJS'})\n`;
    }
    
    report += '\n';
  }
  
  if (failedFiles && failedFiles.length > 0) {
    report += `## 修复失败的文件 (${failedFiles.length})\n\n`;
    
    for (const result of failedFiles) {
      report += `- ${result.file}: ${result.message}\n`;
    }
  }
  
  return report;
}

// 当脚本直接运行时的主函数
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('使用方法: node fix-mixed-module-files.js <目录路径> [选项]');
    console.log('选项:');
    console.log('  --format=esm|cjs       指定目标格式 (默认: esm)');
    console.log('  --no-backup            不创建备份文件');
    console.log('  --no-recursive         不递归处理子目录');
    console.log('  --ignore=dir1,dir2,... 忽略的目录列表');
    console.log('  --dry-run              试运行模式，不实际修改文件');
    console.log('  --no-auto-format       不自动选择最适合的格式');
    console.log('  --report=file          将修复报告输出到文件');
    console.log('  --quiet                不输出详细信息');
    process.exit(1);
  }
  
  const dirPath = path.resolve(args[0]);
  
  if (!fs.existsSync(dirPath)) {
    console.error(`目录不存在: ${dirPath}`);
    process.exit(1);
  }
  
  // 解析选项
  const formatOption = args.find(arg => arg.startsWith('--format='));
  const targetFormat = formatOption ? formatOption.split('=')[1] : 'esm';
  
  if (!['esm', 'cjs'].includes(targetFormat)) {
    console.error('目标格式必须是 "esm" 或 "cjs"');
    process.exit(1);
  }
  
  const createBackup = !args.includes('--no-backup');
  const recursive = !args.includes('--no-recursive');
  const dryRun = args.includes('--dry-run');
  const autoChooseFormat = !args.includes('--no-auto-format');
  const verbose = !args.includes('--quiet');
  
  // 解析忽略目录
  let ignoreDirs = [];
  const ignoreOption = args.find(arg => arg.startsWith('--ignore='));
  
  if (ignoreOption) {
    const ignoreValue = ignoreOption.split('=')[1];
    ignoreDirs = ignoreValue.split(',').map(dir => path.resolve(dir.trim()));
  }
  
  // 解析报告输出路径
  let reportPath = '';
  const reportOption = args.find(arg => arg.startsWith('--report='));
  
  if (reportOption) {
    reportPath = reportOption.split('=')[1];
  }
  
  if (verbose) {
    console.log(`开始修复目录: ${dirPath}`);
    console.log(`目标格式: ${targetFormat}`);
    console.log(`创建备份: ${createBackup ? '是' : '否'}`);
    console.log(`递归处理: ${recursive ? '是' : '否'}`);
    console.log(`试运行模式: ${dryRun ? '是' : '否'}`);
    console.log(`自动选择格式: ${autoChooseFormat ? '是' : '否'}`);
    console.log(`忽略的目录: ${ignoreDirs.join(', ') || '无'}`);
  }
  
  // 执行修复
  try {
    const fixResult = fixMixedModuleFiles(dirPath, {
      targetFormat,
      createBackup,
      recursive,
      ignoreDirs,
      dryRun,
      autoChooseFormat,
      verbose
    });
    
    // 输出总结
    console.log(`\n${fixResult.message}`);
    
    if (fixResult.fixedFiles.length > 0 && verbose) {
      console.log(`\n修复成功的文件 (${fixResult.fixedFiles.length}):`);
      fixResult.fixedFiles.forEach(result => {
        console.log(`- ${result.file}`);
      });
    }
    
    if (fixResult.failedFiles.length > 0) {
      console.log(`\n修复失败的文件 (${fixResult.failedFiles.length}):`);
      fixResult.failedFiles.forEach(result => {
        console.log(`- ${result.file}: ${result.message}`);
      });
    }
    
    // 输出报告
    if (reportPath) {
      const report = generateFixReport(fixResult);
      fs.writeFileSync(reportPath, report, 'utf8');
      console.log(`\n报告已输出到: ${reportPath}`);
    }
    
    process.exit(fixResult.success ? 0 : 1);
  } catch (err) {
    console.error(`执行修复时出错: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  fixMixedModuleFile,
  fixMixedModuleFiles,
  undoFix,
  generateFixReport,
  convertToESM,
  convertToCJS
}; 