/**
 * @file convert-module-format.js
 * @description 将混合模块格式的JS文件转换为一致的ES模块或CommonJS格式
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { analyzeFileFormat } = require('./find-mixed-module-files');

/**
 * 将文件从混合格式转换为统一的格式
 * @param {string} filePath - 要转换的文件路径
 * @param {string} targetFormat - 目标格式 ('esm' 或 'cjs')
 * @param {boolean} [dryRun=false] - 如果为true，只打印更改而不实际修改文件
 * @returns {Object} 转换结果信息
 */
function convertFileFormat(filePath, targetFormat, dryRun = false) {
  if (!['esm', 'cjs'].includes(targetFormat)) {
    throw new Error('目标格式必须是 "esm" 或 "cjs"');
  }

  const analysis = analyzeFileFormat(filePath);
  
  if (!analysis) {
    return {
      file: filePath,
      success: false,
      message: '无法分析文件',
      changes: []
    };
  }
  
  if (!analysis.isMixed) {
    return {
      file: filePath,
      success: true,
      message: '文件不是混合格式，无需转换',
      changes: []
    };
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  const changes = [];
  
  if (targetFormat === 'esm') {
    // 将CommonJS转换为ESM
    changes.push(...convertToEsm(content, analysis));
    content = applyChanges(content, changes);
  } else if (targetFormat === 'cjs') {
    // 将ESM转换为CommonJS
    changes.push(...convertToCjs(content, analysis));
    content = applyChanges(content, changes);
  }
  
  if (!dryRun && changes.length > 0) {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      return {
        file: filePath,
        success: true,
        message: `成功转换为${targetFormat === 'esm' ? 'ES模块' : 'CommonJS'}格式`,
        changes
      };
    } catch (err) {
      return {
        file: filePath,
        success: false,
        message: `写入文件时出错: ${err.message}`,
        changes
      };
    }
  }
  
  return {
    file: filePath,
    success: true,
    message: dryRun ? `将转换为${targetFormat === 'esm' ? 'ES模块' : 'CommonJS'}格式` : '没有进行更改',
    changes,
    dryRun
  };
}

/**
 * 应用变更到内容上
 * @param {string} content - 原始内容
 * @param {Array<Object>} changes - 变更列表
 * @returns {string} 更新后的内容
 */
function applyChanges(content, changes) {
  // 按位置从后向前应用更改，避免位置偏移
  const sortedChanges = [...changes].sort((a, b) => b.position - a.position);
  
  let newContent = content;
  for (const change of sortedChanges) {
    newContent = 
      newContent.substring(0, change.position) + 
      change.newText + 
      newContent.substring(change.position + change.oldText.length);
  }
  
  return newContent;
}

/**
 * 将内容从CommonJS转换为ES模块
 * @param {string} content - 文件内容
 * @param {Object} analysis - 文件分析结果
 * @returns {Array<Object>} 变更列表
 */
function convertToEsm(content, analysis) {
  const changes = [];
  
  // 找出所有require语句
  const requireRegex = /(?:const|let|var)\s+([^=]+)\s*=\s*require\s*\(['"]([^'"]+)['"]\)/g;
  let match;
  
  while ((match = requireRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const importName = match[1].trim();
    const modulePath = match[2];
    const position = match.index;
    
    // 检查是否是解构导入
    if (importName.startsWith('{') && importName.endsWith('}')) {
      const destructuredImports = importName.slice(1, -1).split(',').map(s => s.trim());
      const newImport = `import { ${destructuredImports.join(', ')} } from '${modulePath}';`;
      changes.push({
        position,
        oldText: fullMatch,
        newText: newImport
      });
    } else if (importName.includes(',')) {
      // 多重导入
      const importNames = importName.split(',').map(s => s.trim());
      const hasDefault = !importNames[0].includes(':');
      const namedImports = importNames
        .filter(name => name.includes(':'))
        .map(name => {
          const parts = name.split(':').map(p => p.trim());
          return parts[1] || parts[0];
        });
      
      let newImport = '';
      if (hasDefault && namedImports.length > 0) {
        newImport = `import ${importNames[0]}, { ${namedImports.join(', ')} } from '${modulePath}';`;
      } else if (hasDefault) {
        newImport = `import ${importNames[0]} from '${modulePath}';`;
      } else if (namedImports.length > 0) {
        newImport = `import { ${namedImports.join(', ')} } from '${modulePath}';`;
      }
      
      if (newImport) {
        changes.push({
          position,
          oldText: fullMatch,
          newText: newImport
        });
      }
    } else {
      // 简单导入
      const newImport = `import ${importName} from '${modulePath}';`;
      changes.push({
        position,
        oldText: fullMatch,
        newText: newImport
      });
    }
  }
  
  // 处理module.exports
  const exportsRegex = /module\.exports\s*=\s*({[^;]*}|[^;]+);/g;
  
  while ((match = exportsRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const exportValue = match[1];
    const position = match.index;
    
    // 检查是否是对象导出
    if (exportValue.startsWith('{') && exportValue.endsWith('}')) {
      // 对象字面量导出，转换为命名导出
      const namedExports = exportValue.slice(1, -1);
      const newExport = `export { ${namedExports} };`;
      changes.push({
        position,
        oldText: fullMatch,
        newText: newExport
      });
    } else {
      // 默认导出
      const newExport = `export default ${exportValue};`;
      changes.push({
        position,
        oldText: fullMatch,
        newText: newExport
      });
    }
  }
  
  return changes;
}

/**
 * 将内容从ES模块转换为CommonJS
 * @param {string} content - 文件内容
 * @param {Object} analysis - 文件分析结果
 * @returns {Array<Object>} 变更列表
 */
function convertToCjs(content, analysis) {
  const changes = [];
  
  // 处理import语句
  const importRegex = /import\s+(?:{([^}]+)}|\*\s+as\s+([^;]+)|([^,{;]+)(?:\s*,\s*{([^}]+)})?)(?:\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const namedImports = match[1] ? match[1].trim() : '';
    const namespaceImport = match[2] ? match[2].trim() : '';
    const defaultImport = match[3] ? match[3].trim() : '';
    const namedImportsWithDefault = match[4] ? match[4].trim() : '';
    const modulePath = match[5];
    const position = match.index;
    
    // 命名导入
    if (namedImports) {
      const newRequire = `const { ${namedImports} } = require('${modulePath}');`;
      changes.push({
        position,
        oldText: fullMatch,
        newText: newRequire
      });
    } 
    // 命名空间导入
    else if (namespaceImport) {
      const newRequire = `const ${namespaceImport} = require('${modulePath}');`;
      changes.push({
        position,
        oldText: fullMatch,
        newText: newRequire
      });
    } 
    // 默认导入
    else if (defaultImport && !namedImportsWithDefault) {
      const newRequire = `const ${defaultImport} = require('${modulePath}');`;
      changes.push({
        position,
        oldText: fullMatch,
        newText: newRequire
      });
    } 
    // 默认导入和命名导入
    else if (defaultImport && namedImportsWithDefault) {
      const newRequire = 
        `const ${defaultImport} = require('${modulePath}');\n` +
        `const { ${namedImportsWithDefault} } = require('${modulePath}');`;
      changes.push({
        position,
        oldText: fullMatch,
        newText: newRequire
      });
    }
  }
  
  // 处理export语句
  
  // 默认导出
  const defaultExportRegex = /export\s+default\s+([^;]+);/g;
  while ((match = defaultExportRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const exportValue = match[1];
    const position = match.index;
    
    const newExport = `module.exports = ${exportValue};`;
    changes.push({
      position,
      oldText: fullMatch,
      newText: newExport
    });
  }
  
  // 命名导出
  const namedExportRegex = /export\s+(?:const|let|var|function|class)\s+([^=\s{(]+)(?:[^;]+);/g;
  while ((match = namedExportRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const exportName = match[1];
    const position = match.index;
    
    // 移除export关键字，并在文件末尾添加exports语句
    const newStatement = fullMatch.replace(/export\s+/, '');
    const exportsStatement = `\nmodule.exports.${exportName} = ${exportName};`;
    
    changes.push({
      position,
      oldText: fullMatch,
      newText: newStatement
    });
    
    // 在文件末尾添加导出语句
    changes.push({
      position: content.length,
      oldText: '',
      newText: exportsStatement
    });
  }
  
  // 花括号语法导出
  const bracesExportRegex = /export\s+{([^}]+)};/g;
  while ((match = bracesExportRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const exportNames = match[1].split(',').map(n => n.trim());
    const position = match.index;
    
    const exportStatements = exportNames.map(name => {
      const parts = name.split(' as ');
      const originalName = parts[0].trim();
      const exportedName = parts[1] ? parts[1].trim() : originalName;
      return `module.exports.${exportedName} = ${originalName};`;
    }).join('\n');
    
    changes.push({
      position,
      oldText: fullMatch,
      newText: exportStatements
    });
  }
  
  return changes;
}

/**
 * 处理目录中的文件，将其转换为指定格式
 * @param {string} dirPath - 目录路径
 * @param {string} targetFormat - 目标格式 ('esm' 或 'cjs')
 * @param {Object} options - 选项
 * @returns {Array<Object>} 处理结果列表
 */
function processDirectory(dirPath, targetFormat, options = {}) {
  const { 
    ignoreDirs = [],
    dryRun = false, 
    recursive = true,
    filePattern = /\.js$/,
    results = []
  } = options;
  
  // 确保dirPath是绝对路径
  dirPath = path.resolve(dirPath);
  
  // 检查是否在忽略列表中
  if (ignoreDirs.some(ignoreDir => dirPath.startsWith(path.resolve(ignoreDir)))) {
    return results;
  }
  
  // 常见要忽略的目录
  const commonIgnoreDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory() && recursive) {
        // 忽略常见的不需要扫描的目录
        if (commonIgnoreDirs.includes(entry.name)) {
          continue;
        }
        
        // 递归处理子目录
        processDirectory(entryPath, targetFormat, {
          ...options,
          results
        });
      } 
      else if (entry.isFile() && filePattern.test(entry.name)) {
        // 处理匹配的文件
        const result = convertFileFormat(entryPath, targetFormat, dryRun);
        results.push(result);
      }
    }
  } catch (err) {
    console.error(`读取目录时出错: ${dirPath}`, err);
  }
  
  return results;
}

/**
 * 报告处理结果
 * @param {Array<Object>} results - 处理结果列表
 * @param {boolean} detailed - 是否显示详细信息
 */
function reportResults(results, detailed = false) {
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  const changedCount = results.filter(r => r.changes.length > 0).length;
  
  console.log('\n转换结果摘要:');
  console.log(`总文件数: ${results.length}`);
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${failCount}`);
  console.log(`已更改: ${changedCount}`);
  
  if (detailed) {
    console.log('\n详细报告:');
    results.forEach((result, index) => {
      console.log(`\n[${index + 1}] ${result.file}`);
      console.log(`状态: ${result.success ? '成功' : '失败'}`);
      console.log(`消息: ${result.message}`);
      console.log(`更改数: ${result.changes.length}`);
      
      if (result.changes.length > 0 && detailed) {
        console.log('更改详情:');
        result.changes.slice(0, 5).forEach((change, i) => {
          console.log(`  ${i + 1}. "${change.oldText}" -> "${change.newText}"`);
        });
        
        if (result.changes.length > 5) {
          console.log(`  ... 共 ${result.changes.length} 处更改`);
        }
      }
    });
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('使用方法: node convert-module-format.js <目录路径> <目标格式> [选项]');
    console.log('目标格式: esm 或 cjs');
    console.log('选项:');
    console.log('  --dry-run         不实际修改文件，只显示将要进行的更改');
    console.log('  --no-recursive    不递归处理子目录');
    console.log('  --ignore=dir1,dir2,...  忽略的目录列表');
    console.log('  --detailed        显示详细的转换报告');
    process.exit(1);
  }
  
  const dirPath = path.resolve(args[0]);
  const targetFormat = args[1];
  
  if (!fs.existsSync(dirPath)) {
    console.error(`目录不存在: ${dirPath}`);
    process.exit(1);
  }
  
  if (!['esm', 'cjs'].includes(targetFormat)) {
    console.error('目标格式必须是 "esm" 或 "cjs"');
    process.exit(1);
  }
  
  // 解析选项
  const dryRun = args.includes('--dry-run');
  const recursive = !args.includes('--no-recursive');
  const detailed = args.includes('--detailed');
  
  // 解析忽略目录
  let ignoreDirs = [];
  const ignoreOption = args.find(arg => arg.startsWith('--ignore='));
  
  if (ignoreOption) {
    const ignoreValue = ignoreOption.split('=')[1];
    ignoreDirs = ignoreValue.split(',').map(dir => path.resolve(dir.trim()));
  }
  
  console.log(`开始处理目录: ${dirPath}`);
  console.log(`目标格式: ${targetFormat === 'esm' ? 'ES模块' : 'CommonJS'}`);
  console.log(`模式: ${dryRun ? '试运行' : '实际修改'}`);
  console.log(`递归: ${recursive ? '是' : '否'}`);
  console.log(`忽略的目录: ${ignoreDirs.join(', ') || '无'}`);
  
  const results = processDirectory(dirPath, targetFormat, {
    ignoreDirs,
    dryRun,
    recursive
  });
  
  reportResults(results, detailed);
}

module.exports = {
  convertFileFormat,
  processDirectory,
  reportResults
}; 