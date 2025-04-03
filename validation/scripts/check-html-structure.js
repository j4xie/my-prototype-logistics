const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const writeFile = promisify(fs.writeFile);

// 要检查的目录
const dirsToCheck = [
  '', // 根目录
  'pages',
  'pages/admin',
  'pages/auth',
  'pages/farming',
  'pages/home',
  'pages/logistics',
  'pages/processing',
  'pages/profile',
  'pages/trace'
];

// 验证目录
const validationReportsDir = path.join(__dirname, '..', 'reports');
if (!fs.existsSync(validationReportsDir)) {
  fs.mkdirSync(validationReportsDir, { recursive: true });
}

// 存储验证结果
const validationResults = {
  totalFiles: 0,
  valid: 0,
  invalid: 0,
  issues: []
};

// 修复建议模板
const fixTemplate = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>页面标题</title>
    <!-- 页面样式和脚本引用 -->
</head>
<body>
    <!-- 原始HTML内容 -->
</body>
</html>
`;

/**
 * 查找特定目录中的所有 HTML 文件
 * @param {string} dir 要搜索的目录
 * @returns {Promise<string[]>} HTML 文件路径数组
 */
async function findHtmlFiles(dir) {
  const baseDir = path.join(process.cwd(), dir);
  let files = [];
  
  try {
    // 读取目录中的所有条目
    const entries = await readdir(baseDir);
    
    // 过滤只保留 .html 文件
    for (const entry of entries) {
      const fullPath = path.join(baseDir, entry);
      const stats = await stat(fullPath);
      
      if (stats.isFile() && path.extname(entry).toLowerCase() === '.html') {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`无法读取目录 ${baseDir}:`, err.message);
  }
  
  return files;
}

/**
 * 检查 HTML 文件是否包含完整的 HTML 结构
 * @param {string} filePath HTML 文件路径
 * @returns {Promise<object>} 验证结果对象
 */
async function validateHtmlStructure(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    const result = {
      file: filePath,
      hasDoctype: content.includes('<!DOCTYPE') || content.includes('<!doctype'),
      hasHtmlTag: /<html[^>]*>/i.test(content),
      hasHeadTag: /<head[^>]*>/i.test(content),
      hasBodyTag: /<body[^>]*>/i.test(content),
      isValid: false,
      missingTags: []
    };

    // 添加缺失的标签到列表
    if (!result.hasDoctype) result.missingTags.push('<!DOCTYPE>');
    if (!result.hasHtmlTag) result.missingTags.push('<html>');
    if (!result.hasHeadTag) result.missingTags.push('<head>');
    if (!result.hasBodyTag) result.missingTags.push('<body>');
    
    // 判断是否有效 (至少有DOCTYPE和html标签)
    result.isValid = result.hasDoctype && result.hasHtmlTag && result.hasHeadTag && result.hasBodyTag;
    
    // 跳过组件HTML文件（以 components/ 目录下的HTML文件为组件文件）
    if (filePath.includes('components') && path.basename(filePath) !== 'page-template.html') {
      result.isComponent = true;
      result.isValid = true; // 组件HTML文件不需要完整HTML结构
    }
    
    return result;
  } catch (err) {
    console.error(`无法读取文件 ${filePath}:`, err.message);
    return {
      file: filePath,
      isValid: false,
      error: err.message
    };
  }
}

/**
 * 生成修复建议
 * @param {object} result 验证结果对象
 * @returns {string} 修复建议
 */
function generateFixSuggestion(result) {
  if (result.isValid || result.isComponent) {
    return '无需修复';
  }
  
  return `建议添加缺失的标签: ${result.missingTags.join(', ')}。
参考模板:
${fixTemplate}`;
}

/**
 * 保存验证报告
 * @param {object} results 验证结果
 */
async function saveValidationReport(results) {
  // 保存 JSON 报告
  await writeFile(
    path.join(validationReportsDir, 'html_structure_report.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  
  // 生成 HTML 报告
  const htmlReport = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HTML结构验证报告</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
    }
    .summary {
      background-color: #f8f9fa;
      border-left: 4px solid #3498db;
      padding: 15px;
      margin: 20px 0;
    }
    .file-item {
      margin: 15px 0;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .valid {
      border-left: 4px solid #2ecc71;
    }
    .invalid {
      border-left: 4px solid #e74c3c;
    }
    .file-path {
      font-size: 1.1em;
      font-weight: bold;
      color: #333;
      margin-bottom: 10px;
    }
    .tag-status {
      display: flex;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .tag {
      background-color: #f0f0f0;
      border-radius: 4px;
      padding: 3px 10px;
      margin-right: 10px;
      margin-bottom: 5px;
      display: flex;
      align-items: center;
    }
    .tag-present {
      background-color: #d4edda;
    }
    .tag-missing {
      background-color: #f8d7da;
    }
    .status-icon {
      margin-right: 5px;
    }
    .fix-suggestion {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 10px;
      margin-top: 10px;
      font-family: monospace;
      white-space: pre-wrap;
    }
    .code-block {
      background-color: #f8f9fa;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
    }
    .component-badge {
      display: inline-block;
      background-color: #e0f7fa;
      color: #0277bd;
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 0.9em;
      margin-left: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>HTML结构验证报告</h1>
    
    <div class="summary">
      <h2>验证摘要</h2>
      <p>总计检查文件: ${results.totalFiles}</p>
      <p>有效文件: ${results.valid} (${Math.round(results.valid / results.totalFiles * 100)}%)</p>
      <p>无效文件: ${results.invalid} (${Math.round(results.invalid / results.totalFiles * 100)}%)</p>
    </div>
    
    <h2>详细结果</h2>
    ${results.issues.map(issue => `
      <div class="file-item ${issue.isValid ? 'valid' : 'invalid'}">
        <div class="file-path">
          ${path.relative(process.cwd(), issue.file)} 
          ${issue.isComponent ? '<span class="component-badge">组件文件</span>' : ''}
        </div>
        
        ${!issue.error ? `
        <div class="tag-status">
          <div class="tag ${issue.hasDoctype ? 'tag-present' : 'tag-missing'}">
            <span class="status-icon">${issue.hasDoctype ? '✓' : '✗'}</span>
            DOCTYPE
          </div>
          <div class="tag ${issue.hasHtmlTag ? 'tag-present' : 'tag-missing'}">
            <span class="status-icon">${issue.hasHtmlTag ? '✓' : '✗'}</span>
            &lt;html&gt;
          </div>
          <div class="tag ${issue.hasHeadTag ? 'tag-present' : 'tag-missing'}">
            <span class="status-icon">${issue.hasHeadTag ? '✓' : '✗'}</span>
            &lt;head&gt;
          </div>
          <div class="tag ${issue.hasBodyTag ? 'tag-present' : 'tag-missing'}">
            <span class="status-icon">${issue.hasBodyTag ? '✓' : '✗'}</span>
            &lt;body&gt;
          </div>
        </div>
        ` : `<div class="error">错误: ${issue.error}</div>`}
        
        ${!issue.isValid && !issue.isComponent ? `
        <div class="fix-suggestion">
          ${generateFixSuggestion(issue)}
        </div>
        ` : ''}
      </div>
    `).join('')}
  </div>
</body>
</html>`;

  await writeFile(
    path.join(validationReportsDir, 'html_structure_report.html'),
    htmlReport,
    'utf8'
  );
}

async function run() {
  console.log('启动HTML结构验证...');
  
  try {
    let htmlFiles = [];
    
    // 收集所有HTML文件
    for (const dir of dirsToCheck) {
      const files = await findHtmlFiles(dir);
      htmlFiles = htmlFiles.concat(files);
    }
    
    console.log(`发现 ${htmlFiles.length} 个HTML文件`);
    validationResults.totalFiles = htmlFiles.length;
    
    // 验证每个文件
    for (const file of htmlFiles) {
      const result = await validateHtmlStructure(file);
      
      if (result.isValid) {
        validationResults.valid++;
      } else {
        validationResults.invalid++;
        validationResults.issues.push({
          file: result.file,
          missingTags: result.missingTags,
          suggestion: generateFixSuggestion(result)
        });
      }
    }
    
    // 保存报告
    await saveValidationReport(validationResults);
    
    console.log('HTML结构验证完成');
    console.log(`总计: ${validationResults.totalFiles} 文件`);
    console.log(`有效: ${validationResults.valid} 文件`);
    console.log(`无效: ${validationResults.invalid} 文件`);
    console.log(`报告保存在: ${path.join(validationReportsDir, 'html_structure_report.html')}`);
    
    return {
      timestamp: new Date().toISOString(),
      results: validationResults,
      status: 'success'
    };
    
  } catch (error) {
    console.error('验证过程中出错:', error);
    return {
      timestamp: new Date().toISOString(),
      error: error.message,
      status: 'failed'
    };
  }
}

module.exports = { run }; 