/**
 * @file find-mixed-module-files.js
 * @description 用于扫描和识别项目中使用混合模块格式的JavaScript文件
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

/**
 * 分析文件的模块系统格式
 * @param {string} filePath - 文件路径
 * @returns {Object|null} 文件分析结果，如果不是JS文件则返回null
 */
function analyzeFileFormat(filePath) {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    // 检查文件扩展名
    if (!filePath.toLowerCase().endsWith('.js') && 
        !filePath.toLowerCase().endsWith('.mjs') && 
        !filePath.toLowerCase().endsWith('.cjs')) {
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 统计ESM和CJS特征数量
    const esmFeatures = [];
    const cjsFeatures = [];
    
    // 检测ESM特征
    const importRegExp = /\b(import\s+(?:.+\s+from\s+)?['"][^'"]+['"])/g;
    const exportRegExp = /\b(export\s+(?:default|const|let|var|function|class|{))/g;
    const exportAsRegExp = /\bexport\s+\*\s+(?:as\s+\w+\s+)?from\s+/g;
    
    // 检测导入语句
    const importMatches = [...content.matchAll(importRegExp)];
    if (importMatches.length > 0) {
      esmFeatures.push(...importMatches.map(m => ({ 
        type: 'import', 
        code: m[0],
        position: m.index 
      })));
    }
    
    // 检测导出语句
    const exportMatches = [...content.matchAll(exportRegExp)];
    if (exportMatches.length > 0) {
      esmFeatures.push(...exportMatches.map(m => ({
        type: 'export',
        code: m[0],
        position: m.index
      })));
    }
    
    // 检测export * from 语法
    const exportAsMatches = [...content.matchAll(exportAsRegExp)];
    if (exportAsMatches.length > 0) {
      esmFeatures.push(...exportAsMatches.map(m => ({
        type: 'export-from',
        code: m[0],
        position: m.index
      })));
    }
    
    // 检测CJS特征
    const requireRegExp = /\brequire\s*\(\s*['"][^'"]+['"]\s*\)/g;
    const moduleExportsRegExp = /\bmodule\.exports\b/g;
    const exportsRegExp = /\bexports\.[a-zA-Z0-9_$]+\s*=/g;
    
    // 检测require语句
    const requireMatches = [...content.matchAll(requireRegExp)];
    if (requireMatches.length > 0) {
      cjsFeatures.push(...requireMatches.map(m => ({
        type: 'require',
        code: m[0],
        position: m.index
      })));
    }
    
    // 检测module.exports语句
    const moduleExportsMatches = [...content.matchAll(moduleExportsRegExp)];
    if (moduleExportsMatches.length > 0) {
      cjsFeatures.push(...moduleExportsMatches.map(m => ({
        type: 'module.exports',
        code: m[0],
        position: m.index
      })));
    }
    
    // 检测exports.xx = 语句
    const exportsMatches = [...content.matchAll(exportsRegExp)];
    if (exportsMatches.length > 0) {
      cjsFeatures.push(...exportsMatches.map(m => ({
        type: 'exports',
        code: m[0],
        position: m.index
      })));
    }
    
    // 检测是否在注释中
    const commentRegexp = /\/\/.*$|\/\*[\s\S]*?\*\//gm;
    const comments = [...content.matchAll(commentRegexp)];
    
    // 过滤掉在注释中的特征
    const filterInComment = (feature) => {
      for (const comment of comments) {
        const commentStart = comment.index;
        const commentEnd = commentStart + comment[0].length;
        
        if (feature.position >= commentStart && feature.position < commentEnd) {
          return false;
        }
      }
      return true;
    };
    
    const validEsmFeatures = esmFeatures.filter(filterInComment);
    const validCjsFeatures = cjsFeatures.filter(filterInComment);
    
    // 确定文件格式
    const hasEsm = validEsmFeatures.length > 0;
    const hasCjs = validCjsFeatures.length > 0;
    const isMixed = hasEsm && hasCjs;
    
    // 确定主导格式
    let detectedFormat;
    if (isMixed) {
      if (validEsmFeatures.length > validCjsFeatures.length) {
        detectedFormat = 'mixed-esm-dominant';
      } else if (validEsmFeatures.length < validCjsFeatures.length) {
        detectedFormat = 'mixed-cjs-dominant';
      } else {
        detectedFormat = 'mixed-balanced';
      }
    } else if (hasEsm) {
      detectedFormat = 'esm';
    } else if (hasCjs) {
      detectedFormat = 'cjs';
    } else {
      detectedFormat = 'unknown';
    }
    
    // 构建结果对象
    return {
      file: filePath,
      isMixed,
      detectedFormat,
      esmFeatures: validEsmFeatures,
      cjsFeatures: validCjsFeatures,
      esmCount: validEsmFeatures.length,
      cjsCount: validCjsFeatures.length,
      packageType: getPackageType(filePath),
      size: content.length
    };
  } catch (err) {
    console.error(`分析文件时出错: ${filePath}`, err);
    return null;
  }
}

/**
 * 获取包的类型（通过查找最近的package.json文件）
 * @param {string} filePath - 文件路径
 * @returns {string|null} 包类型
 */
function getPackageType(filePath) {
  try {
    const dirPath = path.dirname(filePath);
    let currentDir = dirPath;
    let rootDir = path.parse(currentDir).root;
    
    // 寻找最近的package.json文件
    while (currentDir !== rootDir) {
      const packagePath = path.join(currentDir, 'package.json');
      
      if (fs.existsSync(packagePath)) {
        const packageContent = fs.readFileSync(packagePath, 'utf8');
        const packageJson = JSON.parse(packageContent);
        
        return packageJson.type || 'commonjs'; // 默认为commonjs
      }
      
      // 向上一级目录
      currentDir = path.dirname(currentDir);
    }
    
    return null; // 没有找到package.json
  } catch (err) {
    return null;
  }
}

/**
 * 查找目录中的混合模块格式文件
 * @param {string} dirPath - 目录路径
 * @param {Object} options - 选项
 * @returns {Array} 混合模块格式文件列表
 */
function findMixedModuleFiles(dirPath, options = {}) {
  const {
    recursive = true,
    ignoreDirs = [],
    filePattern = /\.js$/,
    includeNonMixed = false,
    returnFormats = ['mixed-esm-dominant', 'mixed-cjs-dominant', 'mixed-balanced']
  } = options;
  
  const absPath = path.resolve(dirPath);
  const results = [];
  
  // 检查是否是需要忽略的目录
  const shouldIgnore = (dir) => {
    if (ignoreDirs.some(ignoreDir => {
      return dir === ignoreDir || 
             dir.startsWith(ignoreDir + path.sep) ||
             path.basename(dir) === 'node_modules';
    })) {
      return true;
    }
    return false;
  };
  
  // 如果目标路径是需要忽略的目录，直接返回
  if (shouldIgnore(absPath)) {
    return results;
  }
  
  try {
    const items = fs.readdirSync(absPath, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(absPath, item.name);
      
      if (item.isDirectory() && recursive) {
        // 如果是目录且不在忽略列表中，则递归扫描
        if (!shouldIgnore(itemPath)) {
          const subdirResults = findMixedModuleFiles(itemPath, options);
          results.push(...subdirResults);
        }
      } 
      else if (item.isFile() && filePattern.test(item.name)) {
        // 如果是文件且符合文件模式，则分析文件格式
        const fileInfo = analyzeFileFormat(itemPath);
        
        if (fileInfo) {
          if (fileInfo.isMixed && returnFormats.includes(fileInfo.detectedFormat)) {
            results.push(fileInfo);
          } else if (includeNonMixed) {
            results.push(fileInfo);
          }
        }
      }
    }
  } catch (err) {
    console.error(`扫描目录出错: ${absPath}`, err);
  }
  
  return results;
}

/**
 * 生成扫描报告
 * @param {Array} files - 扫描结果文件列表
 * @returns {string} 格式化的报告
 */
function generateScanReport(files) {
  if (!files || files.length === 0) {
    return "# 模块格式扫描报告\n\n未发现混合模块格式的文件。";
  }
  
  let report = "# 模块格式扫描报告\n\n";
  
  // 统计信息
  const totalFiles = files.length;
  const formatCounts = {};
  
  files.forEach(file => {
    formatCounts[file.detectedFormat] = (formatCounts[file.detectedFormat] || 0) + 1;
  });
  
  report += `## 统计信息\n\n`;
  report += `- 总文件数: ${totalFiles}\n`;
  
  for (const format in formatCounts) {
    report += `- ${format}: ${formatCounts[format]} 个文件\n`;
  }
  
  report += "\n## 文件详情\n\n";
  
  // 按格式分组文件
  const groupedFiles = {};
  
  files.forEach(file => {
    if (!groupedFiles[file.detectedFormat]) {
      groupedFiles[file.detectedFormat] = [];
    }
    groupedFiles[file.detectedFormat].push(file);
  });
  
  // 按格式输出文件
  for (const format in groupedFiles) {
    report += `### ${format} (${groupedFiles[format].length} 个文件)\n\n`;
    
    groupedFiles[format].forEach(file => {
      const relativePath = path.relative(process.cwd(), file.file);
      
      report += `- **${relativePath}**\n`;
      report += `  - ESM特征: ${file.esmCount}\n`;
      report += `  - CJS特征: ${file.cjsCount}\n`;
      report += `  - 包类型: ${file.packageType || '未定义'}\n`;
      
      // 输出部分特征示例
      if (file.esmFeatures.length > 0) {
        report += `  - ESM示例: \`${file.esmFeatures[0].code}\`\n`;
      }
      
      if (file.cjsFeatures.length > 0) {
        report += `  - CJS示例: \`${file.cjsFeatures[0].code}\`\n`;
      }
      
      report += "\n";
    });
  }
  
  report += "## 建议\n\n";
  report += "- 将混合ESM主导的文件转换为纯ESM格式\n";
  report += "- 将混合CJS主导的文件转换为纯CJS格式\n";
  report += "- 对于平衡的混合文件，根据项目的主要模块系统选择适当的格式\n";
  
  return report;
}

// 当脚本直接运行时的主函数
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('使用方法: node find-mixed-module-files.js <目录路径> [选项]');
    console.log('选项:');
    console.log('  --recursive=false           不递归扫描子目录');
    console.log('  --ignore=dir1,dir2,...      忽略指定目录');
    console.log('  --pattern=<正则表达式>      文件匹配模式（默认为 .js$）');
    console.log('  --include-non-mixed         包含非混合格式的文件在结果中');
    console.log('  --report=<文件路径>         将扫描报告输出到文件');
    console.log('  --format=json|text          输出格式（默认为text）');
    process.exit(1);
  }
  
  const dirPath = path.resolve(args[0]);
  
  if (!fs.existsSync(dirPath)) {
    console.error(`目录不存在: ${dirPath}`);
    process.exit(1);
  }
  
  // 解析选项
  const recursiveOption = args.find(arg => arg.startsWith('--recursive='));
  const recursive = recursiveOption ? recursiveOption.split('=')[1] !== 'false' : true;
  
  // 解析忽略目录
  let ignoreDirs = [];
  const ignoreOption = args.find(arg => arg.startsWith('--ignore='));
  
  if (ignoreOption) {
    const ignoreValue = ignoreOption.split('=')[1];
    ignoreDirs = ignoreValue.split(',').map(dir => path.resolve(dir.trim()));
  }
  
  // 解析文件模式
  let filePattern = /\.js$/;
  const patternOption = args.find(arg => arg.startsWith('--pattern='));
  
  if (patternOption) {
    const patternValue = patternOption.split('=')[1];
    try {
      filePattern = new RegExp(patternValue);
    } catch (err) {
      console.error(`无效的正则表达式: ${patternValue}`);
      process.exit(1);
    }
  }
  
  // 解析是否包含非混合格式
  const includeNonMixed = args.includes('--include-non-mixed');
  
  // 解析报告输出
  const reportOption = args.find(arg => arg.startsWith('--report='));
  const reportPath = reportOption ? reportOption.split('=')[1] : null;
  
  // 解析输出格式
  const formatOption = args.find(arg => arg.startsWith('--format='));
  const outputFormat = formatOption ? formatOption.split('=')[1] : 'text';
  
  console.log(`扫描目录: ${dirPath}`);
  console.log(`递归扫描: ${recursive ? '是' : '否'}`);
  console.log(`忽略目录: ${ignoreDirs.join(', ') || '无'}`);
  console.log(`文件模式: ${filePattern}`);
  console.log(`包含非混合: ${includeNonMixed ? '是' : '否'}\n`);
  
  const files = findMixedModuleFiles(dirPath, {
    recursive,
    ignoreDirs,
    filePattern,
    includeNonMixed
  });
  
  if (files.length === 0) {
    console.log('未找到混合模块格式的文件');
    process.exit(0);
  }
  
  console.log(`找到 ${files.length} 个${includeNonMixed ? '' : '混合模块格式的'}文件\n`);
  
  // 按格式分组统计
  const formatCounts = {};
  
  files.forEach(file => {
    formatCounts[file.detectedFormat] = (formatCounts[file.detectedFormat] || 0) + 1;
  });
  
  // 输出统计信息
  for (const format in formatCounts) {
    console.log(`- ${format}: ${formatCounts[format]} 个文件`);
  }
  
  // 输出详细信息
  if (outputFormat === 'json') {
    const output = JSON.stringify(files, null, 2);
    
    if (reportPath) {
      fs.writeFileSync(reportPath, output, 'utf8');
      console.log(`\n扫描结果已保存到: ${reportPath}`);
    } else {
      console.log('\n扫描结果:');
      console.log(output);
    }
  } else {
    const report = generateScanReport(files);
    
    if (reportPath) {
      fs.writeFileSync(reportPath, report, 'utf8');
      console.log(`\n扫描报告已保存到: ${reportPath}`);
    } else {
      console.log('\n扫描报告:');
      console.log(report);
    }
  }
}

module.exports = {
  analyzeFileFormat,
  findMixedModuleFiles,
  generateScanReport
}; 